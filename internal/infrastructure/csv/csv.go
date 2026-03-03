package csv

import (
	"bufio"
	"encoding/csv"
	"fmt"
	"os"
	"regexp"
	"strings"

	"github.com/google/uuid"

	"atena-label/internal/entity"
)

var postalCodeRe = regexp.MustCompile(`^\d{7}$`)

// Adapter implements usecase.CSVPort using the package-level Import/Export functions.
type Adapter struct{}

// NewAdapter returns a new Adapter.
func NewAdapter() *Adapter { return &Adapter{} }

// Import delegates to the package-level Import function.
func (a *Adapter) Import(filePath string) ([]entity.Contact, []string) {
	return Import(filePath)
}

// Export delegates to the package-level Export function.
func (a *Adapter) Export(contacts []entity.Contact, filePath string) error {
	return Export(contacts, filePath)
}

// csvHeader defines the canonical CSV column order.
// 姓, 名, 姓（カナ）, 名（カナ）, 敬称, 郵便番号, 都道府県, 市区町村, 番地, 建物名, 会社名, 部署名, メモ
var csvHeader = []string{
	"姓", "名", "姓（カナ）", "名（カナ）", "敬称",
	"郵便番号", "都道府県", "市区町村", "番地", "建物名",
	"会社名", "部署名", "メモ",
}

// Import reads a CSV file and returns parsed contacts and per-row errors.
func Import(filePath string) ([]entity.Contact, []string) {
	f, err := os.Open(filePath)
	if err != nil {
		return nil, []string{fmt.Sprintf("ファイルを開けません: %v", err)}
	}
	defer f.Close()

	// Strip UTF-8 BOM if present.
	br := bufio.NewReader(f)
	if bom, _ := br.Peek(3); len(bom) == 3 && bom[0] == 0xEF && bom[1] == 0xBB && bom[2] == 0xBF {
		_, _ = br.Discard(3)
	}

	r := csv.NewReader(br)
	r.FieldsPerRecord = -1 // allow variable-length rows
	r.LazyQuotes = true

	records, err := r.ReadAll()
	if err != nil {
		return nil, []string{fmt.Sprintf("CSVの読み込みに失敗しました: %v", err)}
	}

	if len(records) == 0 {
		return nil, nil
	}

	// Skip header row if present.
	startIdx := 0
	if isHeaderRow(records[0]) {
		startIdx = 1
	}

	var contacts []entity.Contact
	var errors []string

	for i := startIdx; i < len(records); i++ {
		row := records[i]
		if isEmptyRow(row) {
			continue
		}
		c, err := rowToContact(row, i+1)
		if err != nil {
			errors = append(errors, err.Error())
			continue
		}
		contacts = append(contacts, c)
	}

	return contacts, errors
}

// Export writes contacts to a CSV file with BOM-prefixed UTF-8 for Excel compatibility.
func Export(contacts []entity.Contact, filePath string) (retErr error) {
	f, err := os.Create(filePath)
	if err != nil {
		return fmt.Errorf("ファイルを作成できません: %w", err)
	}
	defer func() {
		if err := f.Close(); err != nil && retErr == nil {
			retErr = fmt.Errorf("ファイルのクローズに失敗しました: %w", err)
		}
	}()

	// Write BOM so Excel opens the file without encoding issues.
	if _, err := f.Write([]byte{0xEF, 0xBB, 0xBF}); err != nil {
		return fmt.Errorf("BOMの書き込みに失敗しました: %w", err)
	}

	w := csv.NewWriter(f)

	if err := w.Write(csvHeader); err != nil {
		return fmt.Errorf("ヘッダーの書き込みに失敗しました: %w", err)
	}

	for _, c := range contacts {
		if err := w.Write(contactToRow(c)); err != nil {
			return fmt.Errorf("データの書き込みに失敗しました: %w", err)
		}
	}

	w.Flush()
	if err := w.Error(); err != nil {
		return fmt.Errorf("データの書き込みに失敗しました: %w", err)
	}

	return nil
}

func isHeaderRow(row []string) bool {
	return len(row) > 0 && strings.TrimSpace(row[0]) == "姓"
}

func isEmptyRow(row []string) bool {
	for _, v := range row {
		if strings.TrimSpace(v) != "" {
			return false
		}
	}
	return true
}

func col(row []string, idx int) string {
	if idx < len(row) {
		return strings.TrimSpace(row[idx])
	}
	return ""
}

func rowToContact(row []string, lineNum int) (entity.Contact, error) {
	if len(row) < 1 {
		return entity.Contact{}, fmt.Errorf("行 %d: データが空です", lineNum)
	}

	honorific := col(row, 4)
	if honorific == "" {
		honorific = "様"
	}

	postal := col(row, 5)
	if postal != "" && !postalCodeRe.MatchString(postal) {
		return entity.Contact{}, fmt.Errorf("行 %d: 郵便番号が無効です (%q)", lineNum, postal)
	}

	return entity.Contact{
		ID:             uuid.New().String(),
		FamilyName:     col(row, 0),
		GivenName:      col(row, 1),
		FamilyNameKana: col(row, 2),
		GivenNameKana:  col(row, 3),
		Honorific:      honorific,
		PostalCode:     postal,
		Prefecture:     col(row, 6),
		City:           col(row, 7),
		Street:         col(row, 8),
		Building:       col(row, 9),
		Company:        col(row, 10),
		Department:     col(row, 11),
		Notes:          col(row, 12),
	}, nil
}

func contactToRow(c entity.Contact) []string {
	return []string{
		c.FamilyName,
		c.GivenName,
		c.FamilyNameKana,
		c.GivenNameKana,
		c.Honorific,
		c.PostalCode,
		c.Prefecture,
		c.City,
		c.Street,
		c.Building,
		c.Company,
		c.Department,
		c.Notes,
	}
}
