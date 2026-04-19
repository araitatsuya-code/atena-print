package usecase

import (
	"bufio"
	"encoding/csv"
	"fmt"
	"os"
	"regexp"
	"strings"

	"github.com/google/uuid"

	"atena-label/internal/entity"
	"atena-label/internal/repository"
)

// CSVPort abstracts CSV file I/O so the use-case layer has no dependency on
// any specific CSV infrastructure implementation.
type CSVPort interface {
	Import(filePath string) ([]entity.Contact, []string)
	Export(contacts []entity.Contact, filePath string) error
}

type CSVUseCase struct {
	repo repository.ContactRepository
	csv  CSVPort
}

const csvDuplicateRule = "氏名（姓+名）と住所（郵便番号・都道府県・市区町村・番地）が一致した場合に重複と判定します"

var csvImportPostalCodeRe = regexp.MustCompile(`^\d{7}$`)

type csvFieldSpec struct {
	key           string
	label         string
	required      bool
	fallbackIndex int
	aliases       []string
}

var csvFieldSpecs = []csvFieldSpec{
	{key: "familyName", label: "姓", required: true, fallbackIndex: 0, aliases: []string{"姓", "familyname", "family_name", "last_name", "lastname"}},
	{key: "givenName", label: "名", required: true, fallbackIndex: 1, aliases: []string{"名", "givenname", "given_name", "first_name", "firstname"}},
	{key: "familyNameKana", label: "姓（カナ）", fallbackIndex: 2, aliases: []string{"姓（カナ）", "姓(カナ)", "familynamekana", "family_name_kana"}},
	{key: "givenNameKana", label: "名（カナ）", fallbackIndex: 3, aliases: []string{"名（カナ）", "名(カナ)", "givennamekana", "given_name_kana"}},
	{key: "honorific", label: "敬称", fallbackIndex: 4, aliases: []string{"敬称", "honorific"}},
	{key: "postalCode", label: "郵便番号", fallbackIndex: 5, aliases: []string{"郵便番号", "postalcode", "postal_code", "zip"}},
	{key: "prefecture", label: "都道府県", fallbackIndex: 6, aliases: []string{"都道府県", "prefecture"}},
	{key: "city", label: "市区町村", fallbackIndex: 7, aliases: []string{"市区町村", "city"}},
	{key: "street", label: "番地", fallbackIndex: 8, aliases: []string{"番地", "street", "address1", "address_1"}},
	{key: "building", label: "建物名", fallbackIndex: 9, aliases: []string{"建物名", "building", "address2", "address_2"}},
	{key: "company", label: "会社名", fallbackIndex: 10, aliases: []string{"会社名", "company"}},
	{key: "department", label: "部署名", fallbackIndex: 11, aliases: []string{"部署名", "department"}},
	{key: "notes", label: "メモ", fallbackIndex: 12, aliases: []string{"メモ", "notes", "note"}},
	{key: "isPrintTarget", label: "印刷対象", fallbackIndex: 13, aliases: []string{"印刷対象", "printtarget", "print_target"}},
}

type parsedCSVRow struct {
	rowNumber    int
	contact      entity.Contact
	duplicate    bool
	duplicateKey string
}

func NewCSVUseCase(repo repository.ContactRepository, csv CSVPort) *CSVUseCase {
	return &CSVUseCase{repo: repo, csv: csv}
}

// Import reads a CSV file and saves each row as a new contact.
func (uc *CSVUseCase) Import(filePath string) (entity.ImportResult, error) {
	contacts, rowErrors := uc.csv.Import(filePath)

	result := entity.ImportResult{
		Total:  len(contacts) + len(rowErrors),
		Errors: rowErrors,
	}

	if len(rowErrors) > 0 && len(contacts) == 0 {
		return result, fmt.Errorf("CSVのインポートに失敗しました: %s", rowErrors[0])
	}

	for i := range contacts {
		if err := uc.repo.Create(&contacts[i]); err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("保存に失敗しました: %v", err))
			continue
		}
		result.Imported++
	}

	return result, nil
}

// CreateImportPlan reads headers and sample rows for the CSV import wizard.
func (uc *CSVUseCase) CreateImportPlan(filePath string) (entity.CSVImportPlan, error) {
	headers, rows, hasHeader, _, err := readCSVTable(filePath)
	if err != nil {
		return entity.CSVImportPlan{}, err
	}

	plan := entity.CSVImportPlan{
		Headers:          headers,
		SampleRows:       sampleRows(rows, 5),
		SuggestedMapping: suggestMapping(headers, hasHeader),
		FieldDefinitions: fieldDefinitions(),
		RowCount:         len(rows),
		DuplicateRule:    csvDuplicateRule,
	}
	return plan, nil
}

// AnalyzeImport evaluates parse errors and duplicate candidates for the given mapping.
func (uc *CSVUseCase) AnalyzeImport(filePath string, mapping map[string]int) (entity.CSVImportAnalysis, error) {
	rows, parseErrors, err := uc.parseRows(filePath, mapping)
	if err != nil {
		return entity.CSVImportAnalysis{}, err
	}

	existing, err := uc.repo.FindAll("")
	if err != nil {
		return entity.CSVImportAnalysis{}, fmt.Errorf("連絡先の取得に失敗しました: %w", err)
	}

	existingByKey := make(map[string][]entity.Contact)
	for _, c := range existing {
		if key, ok := buildDuplicateKey(c); ok {
			existingByKey[key] = append(existingByKey[key], c)
		}
	}

	duplicates := make([]entity.CSVDuplicateCandidate, 0)
	for _, row := range rows {
		if !row.duplicate {
			continue
		}
		cands := existingByKey[row.duplicateKey]
		if len(cands) == 0 {
			continue
		}
		existingContact := cands[0]
		duplicates = append(duplicates, entity.CSVDuplicateCandidate{
			RowNumber:       row.rowNumber,
			Incoming:        toSnapshot(row.contact),
			Existing:        toSnapshot(existingContact),
			SuggestedAction: "overwrite",
		})
	}

	return entity.CSVImportAnalysis{
		DuplicateRule: csvDuplicateRule,
		ValidRowCount: len(rows),
		Errors:        parseErrors,
		Duplicates:    duplicates,
	}, nil
}

// ImportWithOptions runs CSV import with explicit duplicate resolutions.
func (uc *CSVUseCase) ImportWithOptions(filePath string, mapping map[string]int, resolutions []entity.CSVDuplicateResolution) (entity.CSVImportExecutionResult, error) {
	rows, parseErrors, err := uc.parseRows(filePath, mapping)
	if err != nil {
		return entity.CSVImportExecutionResult{}, err
	}

	existing, err := uc.repo.FindAll("")
	if err != nil {
		return entity.CSVImportExecutionResult{}, fmt.Errorf("連絡先の取得に失敗しました: %w", err)
	}
	existingByKey := make(map[string][]entity.Contact)
	for _, c := range existing {
		if key, ok := buildDuplicateKey(c); ok {
			existingByKey[key] = append(existingByKey[key], c)
		}
	}

	resolutionByRow := make(map[int]string, len(resolutions))
	for _, r := range resolutions {
		resolutionByRow[r.RowNumber] = normalizeDuplicateAction(r.Action)
	}

	result := entity.CSVImportExecutionResult{
		TotalRows: len(rows),
		Errors:    append([]string{}, parseErrors...),
	}

	for _, row := range rows {
		action := "new"
		isDuplicate := false
		var existingContact *entity.Contact

		if row.duplicate {
			matches := existingByKey[row.duplicateKey]
			if len(matches) > 0 {
				isDuplicate = true
				existingContact = &matches[0]
				action = resolutionByRow[row.rowNumber]
				if action == "" {
					action = "skip"
				}
			}
		}

		if isDuplicate {
			result.DuplicateResolved++
		}

		switch action {
		case "new":
			if err := uc.repo.Create(&row.contact); err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("行 %d: 保存に失敗しました: %v", row.rowNumber, err))
				continue
			}
			result.Created++
		case "overwrite":
			if existingContact == nil {
				result.Errors = append(result.Errors, fmt.Sprintf("行 %d: 上書き対象が見つかりません", row.rowNumber))
				continue
			}
			updated := row.contact
			updated.ID = existingContact.ID
			if err := uc.repo.Update(&updated); err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("行 %d: 上書き保存に失敗しました: %v", row.rowNumber, err))
				continue
			}
			result.Updated++
		case "skip":
			result.Skipped++
		default:
			result.Errors = append(result.Errors, fmt.Sprintf("行 %d: 不明な重複アクションです (%s)", row.rowNumber, action))
		}
	}

	return result, nil
}

// Export writes the given contacts (or all if ids is empty) to a CSV file.
func (uc *CSVUseCase) Export(ids []string, filePath string) error {
	var contacts []entity.Contact

	if len(ids) == 0 {
		cs, err := uc.repo.FindAll("")
		if err != nil {
			return fmt.Errorf("連絡先の取得に失敗しました: %w", err)
		}
		contacts = cs
	} else {
		for _, id := range ids {
			c, err := uc.repo.FindByID(id)
			if err != nil {
				return fmt.Errorf("連絡先の取得に失敗しました (id=%s): %w", id, err)
			}
			if c != nil {
				contacts = append(contacts, *c)
			}
		}
	}

	if err := uc.csv.Export(contacts, filePath); err != nil {
		return fmt.Errorf("CSVエクスポートに失敗しました: %w", err)
	}
	return nil
}

func (uc *CSVUseCase) parseRows(filePath string, mapping map[string]int) ([]parsedCSVRow, []string, error) {
	_, rows, _, startLine, err := readCSVTable(filePath)
	if err != nil {
		return nil, nil, err
	}
	if err := validateMapping(mapping); err != nil {
		return nil, nil, err
	}

	parsed := make([]parsedCSVRow, 0, len(rows))
	errs := make([]string, 0)

	for i, row := range rows {
		lineNum := i + startLine
		if isEmptyRow(row) {
			continue
		}
		contact, err := mapRowToContact(row, lineNum, mapping)
		if err != nil {
			errs = append(errs, err.Error())
			continue
		}
		key, ok := buildDuplicateKey(contact)
		parsed = append(parsed, parsedCSVRow{
			rowNumber:    lineNum,
			contact:      contact,
			duplicate:    ok,
			duplicateKey: key,
		})
	}

	return parsed, errs, nil
}

func readCSVTable(filePath string) ([]string, [][]string, bool, int, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return nil, nil, false, 0, fmt.Errorf("ファイルを開けません: %w", err)
	}
	defer f.Close()

	br := bufio.NewReader(f)
	if bom, _ := br.Peek(3); len(bom) == 3 && bom[0] == 0xEF && bom[1] == 0xBB && bom[2] == 0xBF {
		_, _ = br.Discard(3)
	}

	r := csv.NewReader(br)
	r.FieldsPerRecord = -1
	r.LazyQuotes = true

	records, err := r.ReadAll()
	if err != nil {
		return nil, nil, false, 0, fmt.Errorf("CSVの読み込みに失敗しました: %w", err)
	}
	if len(records) == 0 {
		return []string{}, [][]string{}, false, 1, nil
	}

	hasHeader := isLikelyHeaderRow(records[0])
	start := 0
	startLine := 1
	headers := []string{}
	if hasHeader {
		start = 1
		startLine = 2
		headers = trimRow(records[0])
	} else {
		maxCols := maxColumnCount(records)
		headers = make([]string, maxCols)
		for i := range headers {
			headers[i] = fmt.Sprintf("列%d", i+1)
		}
	}

	rows := make([][]string, 0, len(records)-start)
	for i := start; i < len(records); i++ {
		rows = append(rows, trimRow(records[i]))
	}

	return headers, rows, hasHeader, startLine, nil
}

func sampleRows(rows [][]string, max int) [][]string {
	if len(rows) <= max {
		return rows
	}
	return rows[:max]
}

func suggestMapping(headers []string, hasHeader bool) map[string]int {
	mapping := make(map[string]int, len(csvFieldSpecs))
	for _, spec := range csvFieldSpecs {
		mapping[spec.key] = -1
	}

	if !hasHeader {
		for _, spec := range csvFieldSpecs {
			if spec.fallbackIndex < len(headers) {
				mapping[spec.key] = spec.fallbackIndex
			}
		}
		return mapping
	}

	headerIndex := make(map[string]int, len(headers))
	for idx, h := range headers {
		n := normalizeHeader(h)
		if n == "" {
			continue
		}
		if _, exists := headerIndex[n]; !exists {
			headerIndex[n] = idx
		}
	}

	for _, spec := range csvFieldSpecs {
		for _, alias := range spec.aliases {
			if idx, ok := headerIndex[normalizeHeader(alias)]; ok {
				mapping[spec.key] = idx
				break
			}
		}
	}

	return mapping
}

func fieldDefinitions() []entity.CSVImportField {
	defs := make([]entity.CSVImportField, 0, len(csvFieldSpecs))
	for _, spec := range csvFieldSpecs {
		defs = append(defs, entity.CSVImportField{
			Key:      spec.key,
			Label:    spec.label,
			Required: spec.required,
		})
	}
	return defs
}

func validateMapping(mapping map[string]int) error {
	if mapping == nil {
		return fmt.Errorf("列マッピングが指定されていません")
	}
	for _, spec := range csvFieldSpecs {
		if _, ok := mapping[spec.key]; !ok {
			mapping[spec.key] = -1
		}
	}
	for _, spec := range csvFieldSpecs {
		if spec.required && mapping[spec.key] < 0 {
			return fmt.Errorf("必須項目 %s のマッピングが未設定です", spec.label)
		}
	}
	return nil
}

func mapRowToContact(row []string, lineNum int, mapping map[string]int) (entity.Contact, error) {
	postal := mappedValue(row, mapping, "postalCode")
	if postal != "" && !csvImportPostalCodeRe.MatchString(postal) {
		return entity.Contact{}, fmt.Errorf("行 %d: 郵便番号が無効です (%q)", lineNum, postal)
	}

	printTargetRaw := mappedValue(row, mapping, "isPrintTarget")
	printTarget, err := parsePrintTargetForWizard(printTargetRaw)
	if err != nil {
		return entity.Contact{}, fmt.Errorf("行 %d: 印刷対象の値が無効です (%q)", lineNum, printTargetRaw)
	}

	honorific := mappedValue(row, mapping, "honorific")
	if honorific == "" {
		honorific = "様"
	}

	contact := entity.Contact{
		ID:             uuid.New().String(),
		FamilyName:     mappedValue(row, mapping, "familyName"),
		GivenName:      mappedValue(row, mapping, "givenName"),
		FamilyNameKana: mappedValue(row, mapping, "familyNameKana"),
		GivenNameKana:  mappedValue(row, mapping, "givenNameKana"),
		Honorific:      honorific,
		PostalCode:     postal,
		Prefecture:     mappedValue(row, mapping, "prefecture"),
		City:           mappedValue(row, mapping, "city"),
		Street:         mappedValue(row, mapping, "street"),
		Building:       mappedValue(row, mapping, "building"),
		Company:        mappedValue(row, mapping, "company"),
		Department:     mappedValue(row, mapping, "department"),
		Notes:          mappedValue(row, mapping, "notes"),
		IsPrintTarget:  printTarget,
	}

	return contact, nil
}

func parsePrintTargetForWizard(raw string) (bool, error) {
	v := strings.TrimSpace(strings.ToLower(raw))
	switch v {
	case "", "1", "true", "on":
		return true, nil
	case "0", "false", "off":
		return false, nil
	default:
		return false, fmt.Errorf("invalid print target: %q", raw)
	}
}

func mappedValue(row []string, mapping map[string]int, key string) string {
	idx, ok := mapping[key]
	if !ok || idx < 0 || idx >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[idx])
}

func buildDuplicateKey(c entity.Contact) (string, bool) {
	family := normalizeDuplicateToken(c.FamilyName)
	given := normalizeDuplicateToken(c.GivenName)
	postal := normalizeDuplicateToken(c.PostalCode)
	pref := normalizeDuplicateToken(c.Prefecture)
	city := normalizeDuplicateToken(c.City)
	street := normalizeDuplicateToken(c.Street)

	if family == "" || given == "" {
		return "", false
	}
	if postal == "" && pref == "" && city == "" && street == "" {
		return "", false
	}

	return strings.Join([]string{family, given, postal, pref, city, street}, "|"), true
}

func toSnapshot(c entity.Contact) entity.CSVContactSnapshot {
	displayName := strings.TrimSpace(c.FamilyName + c.GivenName)
	if displayName == "" {
		displayName = strings.TrimSpace(c.Company)
	}
	if displayName == "" {
		displayName = "(名称なし)"
	}

	return entity.CSVContactSnapshot{
		ID:          c.ID,
		DisplayName: displayName,
		PostalCode:  c.PostalCode,
		Prefecture:  c.Prefecture,
		City:        c.City,
		Street:      c.Street,
		Company:     c.Company,
	}
}

func normalizeDuplicateAction(action string) string {
	switch strings.ToLower(strings.TrimSpace(action)) {
	case "new", "overwrite", "skip":
		return strings.ToLower(strings.TrimSpace(action))
	default:
		return ""
	}
}

func normalizeDuplicateToken(value string) string {
	s := strings.TrimSpace(strings.ToLower(value))
	s = strings.ReplaceAll(s, " ", "")
	s = strings.ReplaceAll(s, "　", "")
	return s
}

func normalizeHeader(header string) string {
	s := strings.TrimSpace(strings.ToLower(header))
	s = strings.ReplaceAll(s, " ", "")
	s = strings.ReplaceAll(s, "　", "")
	s = strings.ReplaceAll(s, "_", "")
	s = strings.ReplaceAll(s, "-", "")
	return s
}

func isLikelyHeaderRow(row []string) bool {
	if len(row) == 0 {
		return false
	}

	known := make(map[string]struct{})
	for _, spec := range csvFieldSpecs {
		for _, alias := range spec.aliases {
			known[normalizeHeader(alias)] = struct{}{}
		}
	}

	matches := 0
	for _, col := range row {
		if _, ok := known[normalizeHeader(col)]; ok {
			matches++
		}
	}
	return matches >= 2
}

func isEmptyRow(row []string) bool {
	for _, v := range row {
		if strings.TrimSpace(v) != "" {
			return false
		}
	}
	return true
}

func trimRow(row []string) []string {
	trimmed := make([]string, len(row))
	for i, v := range row {
		trimmed[i] = strings.TrimSpace(v)
	}
	return trimmed
}

func maxColumnCount(rows [][]string) int {
	max := 0
	for _, row := range rows {
		if len(row) > max {
			max = len(row)
		}
	}
	return max
}
