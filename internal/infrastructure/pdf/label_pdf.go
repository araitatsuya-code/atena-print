package pdf

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"log"
	"os"
	"runtime"
	"strings"

	"github.com/jung-kurt/gofpdf"
	qrcode "github.com/skip2/go-qrcode"

	"atena-label/internal/entity"
)

// Generator implements PDF generation using gofpdf.
type Generator struct {
	fontPath  string // path to a Japanese TrueType font (.ttf/.ttc)
	fontBytes []byte // pre-loaded and validated font bytes, nil if unavailable
}

// NewGenerator creates a Generator. Pass an empty fontPath for auto-detection.
func NewGenerator(fontPath string) *Generator {
	g := &Generator{}
	if fontPath != "" {
		fb, err := loadAndValidateFont(fontPath)
		if err != nil {
			log.Printf("pdf: explicit font path %q unusable (%v); falling back to system detection", fontPath, err)
			fb, fontPath = detectAndLoadJapaneseFont()
		}
		g.fontPath = fontPath
		g.fontBytes = fb
	} else {
		g.fontBytes, g.fontPath = detectAndLoadJapaneseFont()
	}
	return g
}

// detectAndLoadJapaneseFont tries each candidate font and returns the first
// that can be successfully used by gofpdf.
func detectAndLoadJapaneseFont() ([]byte, string) {
	for _, p := range japaneseFontCandidates() {
		fb, err := loadAndValidateFont(p)
		if err == nil {
			return fb, p
		}
	}
	return nil, ""
}

// japaneseFontCandidates returns platform-specific font paths to try.
func japaneseFontCandidates() []string {
	switch runtime.GOOS {
	case "darwin":
		return []string{
			// TrueType fonts that gofpdf can embed (tested to work)
			"/System/Library/Fonts/Supplemental/Songti.ttc",        // CJK TrueType — reliable fallback
			"/System/Library/Fonts/Supplemental/STHeiti Medium.ttc", // CJK TrueType
			// Hiragino / Yu fonts are OpenType CFF and will be skipped automatically
			"/System/Library/Fonts/ヒラギノ明朝 ProN.ttc",
			"/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc",
			"/Library/Fonts/YuMincho.ttc",
		}
	case "windows":
		return []string{
			`C:\Windows\Fonts\msmincho.ttc`,
			`C:\Windows\Fonts\YuMincho.ttc`,
			`C:\Windows\Fonts\mingliu.ttc`,
			`C:\Windows\Fonts\msgothic.ttc`,
		}
	default:
		return []string{
			"/usr/share/fonts/truetype/noto/NotoSerifCJK-Regular.ttc",
			"/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc",
			"/usr/share/fonts/truetype/fonts-japanese-mincho.ttf",
		}
	}
}

// loadAndValidateFont reads font bytes and verifies that gofpdf can actually
// embed the font in a PDF. Returns a meaningful error for every failure mode so
// callers can distinguish explicit-path misconfiguration from "no font found".
// TTC files contain absolute offsets into the container and must be extracted
// to standalone TTF bytes before gofpdf can embed them correctly.
func loadAndValidateFont(path string) ([]byte, error) {
	fontBytes, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read font %q: %w", path, err)
	}
	// TTC files need to be unwrapped; OpenType CFF (OTTO) is not supported by gofpdf.
	if len(fontBytes) >= 4 {
		switch string(fontBytes[:4]) {
		case "ttcf":
			extracted := extractTTFFromTTC(fontBytes)
			if extracted == nil {
				return nil, fmt.Errorf("font %q: TTC contains no embeddable TrueType face", path)
			}
			fontBytes = extracted
		case "OTTO":
			return nil, fmt.Errorf("font %q: OpenType CFF (OTTO) is not supported by gofpdf", path)
		}
	}
	const testName = "jfont_validate"
	testPDF := gofpdf.New("P", "mm", "A4", "")
	testPDF.AddUTF8FontFromBytes(testName, "", fontBytes)
	if testPDF.Error() != nil {
		return nil, fmt.Errorf("font %q: register failed: %w", path, testPDF.Error())
	}
	testPDF.AddPage()
	testPDF.SetFont(testName, "", 10)
	if testPDF.Error() != nil {
		return nil, fmt.Errorf("font %q: SetFont failed: %w", path, testPDF.Error())
	}
	var buf bytes.Buffer
	if err := testPDF.Output(&buf); err != nil {
		return nil, fmt.Errorf("font %q: PDF output validation failed: %w", path, err)
	}
	return fontBytes, nil
}

// extractTTFFromTTC extracts the TrueType face with the best Japanese character
// coverage from a TTC file. It scores each TrueType face by scanning its cmap
// for a set of traditional CJK characters (often missing from Simplified Chinese
// faces) and returns the highest-scoring face. This ensures that, for example,
// Songti.ttc returns the Traditional Chinese face rather than the Simplified one.
// Returns nil when the TTC contains no embeddable TrueType face.
func extractTTFFromTTC(ttcBytes []byte) []byte {
	if len(ttcBytes) < 12 || string(ttcBytes[:4]) != "ttcf" {
		return nil
	}
	numFonts := int(binary.BigEndian.Uint32(ttcBytes[8:12]))
	if numFonts < 1 || len(ttcBytes) < 12+4*numFonts {
		return nil
	}

	var bestFace []byte
	bestScore := -1
	for fi := 0; fi < numFonts; fi++ {
		face := extractTTCFace(ttcBytes, fi)
		if face == nil {
			continue
		}
		score := japaneseCmapScore(face)
		if score > bestScore {
			bestScore = score
			bestFace = face
		}
	}
	return bestFace
}

// extractTTCFace extracts raw TTF bytes for the face at faceIdx in a TTC.
// Table-data offsets are absolute in TTC, so the extracted bytes are rebuilt
// with offsets relative to the new file start. Returns nil for CFF faces or
// out-of-bounds indices.
func extractTTCFace(ttcBytes []byte, faceIdx int) []byte {
	numFonts := int(binary.BigEndian.Uint32(ttcBytes[8:12]))
	if faceIdx < 0 || faceIdx >= numFonts {
		return nil
	}
	fontOff := int(binary.BigEndian.Uint32(ttcBytes[12+faceIdx*4 : 16+faceIdx*4]))
	if fontOff+12 > len(ttcBytes) {
		return nil
	}
	if string(ttcBytes[fontOff:fontOff+4]) == "OTTO" {
		return nil // OpenType CFF — gofpdf cannot embed
	}

	numTables := int(binary.BigEndian.Uint16(ttcBytes[fontOff+4 : fontOff+6]))
	dirSize := 12 + numTables*16
	if fontOff+dirSize > len(ttcBytes) {
		return nil
	}

	type tableInfo struct {
		tag      [4]byte
		checksum uint32
		srcOff   uint32
		length   uint32
	}
	tables := make([]tableInfo, numTables)
	for i := 0; i < numTables; i++ {
		b := fontOff + 12 + i*16
		copy(tables[i].tag[:], ttcBytes[b:b+4])
		tables[i].checksum = binary.BigEndian.Uint32(ttcBytes[b+4 : b+8])
		tables[i].srcOff = binary.BigEndian.Uint32(ttcBytes[b+8 : b+12])
		tables[i].length = binary.BigEndian.Uint32(ttcBytes[b+12 : b+16])
		if int(tables[i].srcOff)+int(tables[i].length) > len(ttcBytes) {
			return nil
		}
	}

	newOffsets := make([]uint32, numTables)
	cur := uint32(dirSize)
	for i, t := range tables {
		newOffsets[i] = cur
		cur += (t.length + 3) &^ 3
	}

	result := make([]byte, int(cur))
	copy(result[0:4], ttcBytes[fontOff:fontOff+4]) // sfVersion
	binary.BigEndian.PutUint16(result[4:6], uint16(numTables))
	es := uint16(0)
	for n := numTables; n > 1; n >>= 1 {
		es++
	}
	sr := uint16(1<<es) * 16
	binary.BigEndian.PutUint16(result[6:8], sr)
	binary.BigEndian.PutUint16(result[8:10], es)
	binary.BigEndian.PutUint16(result[10:12], uint16(numTables)*16-sr)

	for i, t := range tables {
		b := 12 + i*16
		copy(result[b:b+4], t.tag[:])
		binary.BigEndian.PutUint32(result[b+4:b+8], t.checksum)
		binary.BigEndian.PutUint32(result[b+8:b+12], newOffsets[i])
		binary.BigEndian.PutUint32(result[b+12:b+16], t.length)
		copy(result[newOffsets[i]:newOffsets[i]+t.length], ttcBytes[t.srcOff:t.srcOff+t.length])
	}
	return result
}

// japaneseCoverageChars are traditional CJK characters that are present in
// Traditional Chinese / Japanese fonts but absent from Simplified Chinese fonts
// (whose simplified equivalents use different Unicode codepoints).
var japaneseCoverageChars = []rune{
	'東', '達', '橋', '様', '際', '応', '辺', '澤', '廣', '邊',
}

// japaneseCmapScore returns the number of japaneseCoverageChars mapped in the
// font's Unicode BMP cmap (Format 4). A higher score indicates better Japanese
// character coverage.
func japaneseCmapScore(ttfBytes []byte) int {
	if len(ttfBytes) < 12 {
		return 0
	}
	numTables := int(binary.BigEndian.Uint16(ttfBytes[4:6]))

	var cmapOff, cmapLen uint32
	for i := 0; i < numTables; i++ {
		b := 12 + i*16
		if b+16 > len(ttfBytes) {
			break
		}
		if string(ttfBytes[b:b+4]) == "cmap" {
			cmapOff = binary.BigEndian.Uint32(ttfBytes[b+8 : b+12])
			cmapLen = binary.BigEndian.Uint32(ttfBytes[b+12 : b+16])
			break
		}
	}
	if cmapOff == 0 || int(cmapOff+cmapLen) > len(ttfBytes) {
		return 0
	}
	cmap := ttfBytes[cmapOff : cmapOff+cmapLen]
	if len(cmap) < 4 {
		return 0
	}

	// Locate the best Unicode subtable: prefer Format 4 (BMP) but also accept
	// Format 12 (full Unicode), which newer fonts like Songti TC use exclusively.
	// Priority: platform 3 enc 1 (Format 4) > platform 0 enc 4 (Format 12) > others.
	numSubtables := int(binary.BigEndian.Uint16(cmap[2:4]))
	var fmt4Off, fmt12Off uint32
	for i := 0; i < numSubtables; i++ {
		base := 4 + i*8
		if base+8 > len(cmap) {
			break
		}
		platformID := binary.BigEndian.Uint16(cmap[base : base+2])
		encodingID := binary.BigEndian.Uint16(cmap[base+2 : base+4])
		off := binary.BigEndian.Uint32(cmap[base+4 : base+8])
		if off+2 > uint32(len(cmap)) {
			continue
		}
		format := binary.BigEndian.Uint16(cmap[off : off+2])
		if format == 4 && platformID == 3 && encodingID == 1 {
			fmt4Off = off
		} else if format == 4 && platformID == 0 && encodingID >= 3 && fmt4Off == 0 {
			fmt4Off = off
		} else if format == 12 && (platformID == 3 && encodingID == 10 || platformID == 0 && encodingID == 4) {
			if fmt12Off == 0 {
				fmt12Off = off
			}
		}
	}

	count := 0

	if fmt4Off != 0 && int(fmt4Off)+14 <= len(cmap) {
		sub := cmap[fmt4Off:]
		segCount := int(binary.BigEndian.Uint16(sub[6:8])) / 2
		endBase := 14
		startBase := 14 + segCount*2 + 2
		deltaBase := 14 + segCount*4 + 2
		rangeBase := 14 + segCount*6 + 2
		if rangeBase+segCount*2 <= len(sub) {
			for _, ch := range japaneseCoverageChars {
				cp := uint16(ch)
				for s := 0; s < segCount; s++ {
					end := binary.BigEndian.Uint16(sub[endBase+s*2 : endBase+s*2+2])
					if cp > end {
						continue
					}
					start := binary.BigEndian.Uint16(sub[startBase+s*2 : startBase+s*2+2])
					if cp >= start {
						rangeOff := binary.BigEndian.Uint16(sub[rangeBase+s*2 : rangeBase+s*2+2])
						if rangeOff == 0 {
							delta := int16(binary.BigEndian.Uint16(sub[deltaBase+s*2 : deltaBase+s*2+2]))
							if (int(cp)+int(delta))&0xFFFF != 0 {
								count++
							}
						} else {
							count++
						}
					}
					break
				}
			}
		}
	}

	if count == 0 && fmt12Off != 0 && int(fmt12Off)+16 <= len(cmap) {
		// Format 12: fixed header (16 bytes) followed by numGroups × 12-byte groups.
		// Each group: startCharCode (4), endCharCode (4), startGlyphId (4).
		sub := cmap[fmt12Off:]
		if len(sub) < 16 {
			return 0
		}
		numGroups := int(binary.BigEndian.Uint32(sub[12:16]))
		if 16+numGroups*12 > len(sub) {
			return 0
		}
		for _, ch := range japaneseCoverageChars {
			cp := uint32(ch)
			for g := 0; g < numGroups; g++ {
				base := 16 + g*12
				startCC := binary.BigEndian.Uint32(sub[base : base+4])
				endCC := binary.BigEndian.Uint32(sub[base+4 : base+8])
				if cp < startCC {
					break // groups are sorted
				}
				if cp <= endCC {
					count++
					break
				}
			}
		}
	}

	return count
}

// GenerateLabelPDF generates an A4 label PDF and returns the raw bytes.
func (g *Generator) GenerateLabelPDF(
	job entity.PrintJob,
	contacts []entity.Contact,
	sender *entity.Sender,
) ([]byte, error) {
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(0, 0, 0)
	pdf.SetAutoPageBreak(false, 0)
	pdf.SetCompression(true)

	// Register Japanese font if available.
	// Use pre-validated fontBytes to avoid TTC/OTF files that register
	// without error but fail at pdf.Output() with "undefined font".
	const fontName = "jfont"
	hasJFont := false
	if g.fontBytes != nil {
		pdf.AddUTF8FontFromBytes(fontName, "", g.fontBytes)
		if pdf.Error() == nil {
			hasJFont = true
		}
	}

	setFont := func(size float64) {
		if hasJFont {
			pdf.SetFont(fontName, "", size)
		} else {
			pdf.SetFont("Courier", "", size)
		}
	}

	layout := job.LabelLayout
	tmpl := job.Template

	labelsPerPage := layout.Columns * layout.Rows
	if labelsPerPage == 0 {
		return nil, fmt.Errorf("invalid label layout: columns=%d rows=%d", layout.Columns, layout.Rows)
	}

	// Pre-generate QR PNG bytes once (reused for every label).
	var qrPNG []byte
	if job.QRConfig != nil && job.QRConfig.Enabled && job.QRConfig.Content != "" {
		sizePx := job.QRConfig.Size
		if sizePx <= 0 {
			sizePx = 128
		}
		var err error
		qrPNG, err = qrcode.Encode(job.QRConfig.Content, qrcode.Medium, sizePx)
		if err != nil {
			// QR generation failure is non-fatal.
			qrPNG = nil
		}
	}

	for i, contact := range contacts {
		if i%labelsPerPage == 0 {
			pdf.AddPage()
		}

		pageIdx := i % labelsPerPage
		col := pageIdx % layout.Columns
		row := pageIdx / layout.Columns

		originX := layout.MarginLeft + float64(col)*(layout.LabelWidth+layout.GapX) + layout.OffsetX
		originY := layout.MarginTop + float64(row)*(layout.LabelHeight+layout.GapY) + layout.OffsetY

		// Watermark background.
		if job.Watermark != nil && job.Watermark.FilePath != "" {
			if _, err := os.Stat(job.Watermark.FilePath); err == nil {
				imgType := imageType(job.Watermark.FilePath)
				opts := gofpdf.ImageOptions{ImageType: imgType}
				pdf.ImageOptions(job.Watermark.FilePath, originX, originY, layout.LabelWidth, layout.LabelHeight, false, opts, 0, "")
			}
		}

		// Label content.
		drawLabel(pdf, setFont, &contact, sender, tmpl, originX, originY)

		// QR code.
		if qrPNG != nil {
			drawQR(pdf, job.QRConfig, qrPNG, originX, originY, layout.LabelWidth, layout.LabelHeight, i)
		}
	}

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, fmt.Errorf("pdf output: %w", err)
	}
	return buf.Bytes(), nil
}

// drawQR places a pre-generated QR PNG at the configured position within the label.
func drawQR(pdf *gofpdf.Fpdf, qr *entity.QRConfig, pngBytes []byte, originX, originY, labelW, labelH float64, idx int) {
	// size in mm: qr.Size pixels * 0.264583 mm/px (96 dpi)
	sizeMM := float64(qr.Size) * 0.264583
	if sizeMM < 15 {
		sizeMM = 15 // minimum readable QR size
	}

	var qrX, qrY float64
	switch qr.Position {
	case "top-left":
		qrX = originX + 1
		qrY = originY + 1
	case "top-right":
		qrX = originX + labelW - sizeMM - 1
		qrY = originY + 1
	case "bottom-left":
		qrX = originX + 1
		qrY = originY + labelH - sizeMM - 1
	default: // "bottom-right"
		qrX = originX + labelW - sizeMM - 1
		qrY = originY + labelH - sizeMM - 1
	}

	// Register once with a fixed key; gofpdf caches it after first registration.
	const imgKey = "qr_code"
	if idx == 0 {
		reader := bytes.NewReader(pngBytes)
		pdf.RegisterImageOptionsReader(imgKey, gofpdf.ImageOptions{ImageType: "PNG"}, reader)
	}
	pdf.ImageOptions(imgKey, qrX, qrY, sizeMM, sizeMM, false, gofpdf.ImageOptions{ImageType: "PNG"}, 0, "")
}

// drawLabel renders postal code, recipient and sender onto a single label cell.
func drawLabel(
	pdf *gofpdf.Fpdf,
	setFont func(float64),
	contact *entity.Contact,
	sender *entity.Sender,
	tmpl entity.Template,
	ox, oy float64,
) {
	pdf.SetTextColor(0, 0, 0)

	// ── 郵便番号 ────────────────────────────────────────────────────────────
	// アプリプレビューと同様に〒マーク＋"NNN-NNNN"形式で1文字ずつ描画する。
	if tmpl.PostalCode != nil && contact.PostalCode != "" {
		setFont(tmpl.PostalCode.FontSize)
		spacing := tmpl.PostalCode.DigitSpacing
		if spacing <= 0 {
			spacing = 4
		}
		cellH := tmpl.PostalCode.FontSize * 0.4
		baseX := ox + tmpl.PostalCode.X
		baseY := oy + tmpl.PostalCode.Y

		// 〒マーク
		pdf.SetXY(baseX-spacing*0.3, baseY)
		pdf.CellFormat(spacing*0.8, cellH, "〒", "", 0, "C", false, 0, "")

		// 数字部分を "NNN-NNNN" に整形してから1文字ずつ描画
		digits := strings.Map(func(r rune) rune {
			if r >= '0' && r <= '9' {
				return r
			}
			return -1
		}, contact.PostalCode)
		formatted := digits
		if len(digits) == 7 {
			formatted = digits[:3] + "-" + digits[3:]
		}
		curX := baseX + spacing*0.5
		for _, ch := range formatted {
			if ch == '-' {
				pdf.SetXY(curX, baseY)
				pdf.CellFormat(spacing*0.5, cellH, "-", "", 0, "C", false, 0, "")
				curX += spacing * 0.5
			} else {
				pdf.SetXY(curX, baseY)
				pdf.CellFormat(spacing, cellH, string(ch), "", 0, "C", false, 0, "")
				curX += spacing
			}
		}
	}

	// ── 宛先氏名 ─────────────────────────────────────────────────────────────
	rec := tmpl.Recipient
	honorific := contact.Honorific
	if honorific == "" {
		honorific = "様"
	}

	var nameLines []string
	if contact.Company != "" {
		nameLines = append(nameLines, contact.Company)
		if contact.Department != "" {
			nameLines = append(nameLines, contact.Department)
		}
	}
	// 横書きはアプリ同様に全角スペースで姓名と敬称を区切る
	fullName := contact.FamilyName + contact.GivenName + "\u3000" + honorific
	nameLines = append(nameLines, fullName)

	// ── 住所を2行(横書き) / 2カラム(縦書き)に分割 ─────────────────────────
	// アプリプレビューと同じく「都道府県+市区町村」/「番地+建物名」で分割する。
	addrLine1 := contact.Prefecture + contact.City
	addrLine2 := contact.Street
	if contact.Building != "" {
		addrLine2 += "\u3000" + contact.Building
	}
	addrLines := []string{}
	if addrLine1 != "" {
		addrLines = append(addrLines, addrLine1)
	}
	if addrLine2 != "" {
		addrLines = append(addrLines, addrLine2)
	}

	if tmpl.Orientation == "vertical" {
		setFont(rec.NameFont)
		xOff := ox + rec.NameX
		for _, line := range nameLines {
			drawVerticalText(pdf, line, xOff, oy+rec.NameY, rec.NameFont)
			xOff -= rec.NameFont * 0.5 // 次カラムは左へ
		}

		setFont(rec.AddressFont)
		colW := rec.AddressFont * 0.5 // 縦書きカラム幅
		xOff = ox + rec.AddressX
		for _, line := range addrLines {
			drawVerticalText(pdf, line, xOff, oy+rec.AddressY, rec.AddressFont)
			xOff -= colW
		}
	} else {
		setFont(rec.NameFont)
		nameLineH := rec.NameFont * 0.5
		for i, line := range nameLines {
			pdf.SetXY(ox+rec.NameX, oy+rec.NameY+float64(i)*nameLineH)
			pdf.CellFormat(0, nameLineH, line, "", 0, "L", false, 0, "")
		}

		setFont(rec.AddressFont)
		addrLineH := rec.AddressFont * 0.55
		for i, line := range addrLines {
			pdf.SetXY(ox+rec.AddressX, oy+rec.AddressY+float64(i)*addrLineH)
			pdf.CellFormat(0, addrLineH, line, "", 0, "L", false, 0, "")
		}
	}

	// ── 差出人 ───────────────────────────────────────────────────────────────
	if sender != nil {
		snd := tmpl.Sender
		senderName := sender.FamilyName + sender.GivenName
		if sender.Company != "" {
			senderName = sender.Company + " " + senderName
		}
		sndLine1 := sender.Prefecture + sender.City
		sndLine2 := sender.Street
		if sender.Building != "" {
			sndLine2 += "\u3000" + sender.Building
		}
		sndAddrLines := []string{}
		if sndLine1 != "" {
			sndAddrLines = append(sndAddrLines, sndLine1)
		}
		if sndLine2 != "" {
			sndAddrLines = append(sndAddrLines, sndLine2)
		}

		if tmpl.Orientation == "vertical" {
			setFont(snd.NameFont)
			drawVerticalText(pdf, senderName, ox+snd.NameX, oy+snd.NameY, snd.NameFont)
			setFont(snd.AddressFont)
			colW := snd.AddressFont * 0.5
			xOff := ox + snd.AddressX
			for _, line := range sndAddrLines {
				drawVerticalText(pdf, line, xOff, oy+snd.AddressY, snd.AddressFont)
				xOff -= colW
			}
		} else {
			setFont(snd.NameFont)
			pdf.SetXY(ox+snd.NameX, oy+snd.NameY)
			pdf.CellFormat(0, snd.NameFont*0.5, senderName, "", 0, "L", false, 0, "")
			setFont(snd.AddressFont)
			addrLineH := snd.AddressFont * 0.55
			for i, line := range sndAddrLines {
				pdf.SetXY(ox+snd.AddressX, oy+snd.AddressY+float64(i)*addrLineH)
				pdf.CellFormat(0, addrLineH, line, "", 0, "L", false, 0, "")
			}
		}
	}
}

// drawVerticalText places each rune top-to-bottom in a single column.
func drawVerticalText(pdf *gofpdf.Fpdf, text string, x, y, fontSize float64) {
	charW := fontSize * 0.45
	lineH := fontSize * 0.48
	for i, ch := range text {
		pdf.SetXY(x, y+float64(i)*lineH)
		pdf.CellFormat(charW, lineH, string(ch), "", 0, "C", false, 0, "")
	}
}

func buildAddress(c *entity.Contact) string {
	var parts []string
	if c.Prefecture != "" {
		parts = append(parts, c.Prefecture)
	}
	if c.City != "" {
		parts = append(parts, c.City)
	}
	if c.Street != "" {
		parts = append(parts, c.Street)
	}
	if c.Building != "" {
		parts = append(parts, c.Building)
	}
	return strings.Join(parts, "")
}

func buildSenderAddress(s *entity.Sender) string {
	var parts []string
	if s.Prefecture != "" {
		parts = append(parts, s.Prefecture)
	}
	if s.City != "" {
		parts = append(parts, s.City)
	}
	if s.Street != "" {
		parts = append(parts, s.Street)
	}
	if s.Building != "" {
		parts = append(parts, s.Building)
	}
	return strings.Join(parts, "")
}

func imageType(path string) string {
	lower := strings.ToLower(path)
	switch {
	case strings.HasSuffix(lower, ".png"):
		return "PNG"
	case strings.HasSuffix(lower, ".jpg"), strings.HasSuffix(lower, ".jpeg"):
		return "JPG"
	default:
		return "PNG"
	}
}
