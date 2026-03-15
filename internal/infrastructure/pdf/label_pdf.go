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

// extractTTFFromTTC extracts the first embeddable TrueType face from a TTC.
// It iterates all faces in the collection and skips OpenType CFF ("OTTO") faces.
// In a TTC the table-data offsets are absolute (from the TTC start), so the
// extracted bytes are rebuilt with offsets relative to the new file start.
// Returns nil when the TTC contains no usable TrueType face.
func extractTTFFromTTC(ttcBytes []byte) []byte {
	if len(ttcBytes) < 12 || string(ttcBytes[:4]) != "ttcf" {
		return nil
	}
	numFonts := int(binary.BigEndian.Uint32(ttcBytes[8:12]))
	if numFonts < 1 || len(ttcBytes) < 12+4*numFonts {
		return nil
	}

	// Iterate all faces; pick the first TrueType (non-CFF) one.
	for fi := 0; fi < numFonts; fi++ {
		fontOff := int(binary.BigEndian.Uint32(ttcBytes[12+fi*4 : 16+fi*4]))
		if fontOff+12 > len(ttcBytes) {
			continue
		}
		// Skip OpenType CFF faces — gofpdf cannot embed them.
		if string(ttcBytes[fontOff:fontOff+4]) == "OTTO" {
			continue
		}

		numTables := int(binary.BigEndian.Uint16(ttcBytes[fontOff+4 : fontOff+6]))
		dirSize := 12 + numTables*16
		if fontOff+dirSize > len(ttcBytes) {
			continue
		}

		type tableInfo struct {
			tag      [4]byte
			checksum uint32
			srcOff   uint32
			length   uint32
		}
		tables := make([]tableInfo, numTables)
		valid := true
		for i := 0; i < numTables; i++ {
			b := fontOff + 12 + i*16
			copy(tables[i].tag[:], ttcBytes[b:b+4])
			tables[i].checksum = binary.BigEndian.Uint32(ttcBytes[b+4 : b+8])
			tables[i].srcOff = binary.BigEndian.Uint32(ttcBytes[b+8 : b+12])
			tables[i].length = binary.BigEndian.Uint32(ttcBytes[b+12 : b+16])
			if int(tables[i].srcOff)+int(tables[i].length) > len(ttcBytes) {
				valid = false
				break
			}
		}
		if !valid {
			continue
		}

		// Assign new packed, 4-byte-aligned offsets starting right after the directory.
		newOffsets := make([]uint32, numTables)
		cur := uint32(dirSize)
		for i, t := range tables {
			newOffsets[i] = cur
			cur += (t.length + 3) &^ 3
		}

		result := make([]byte, int(cur))

		// Offset table header.
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

		// Table directory and data.
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
	return nil
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

	// Postal code digits.
	if tmpl.PostalCode != nil && contact.PostalCode != "" {
		setFont(tmpl.PostalCode.FontSize)
		digits := strings.ReplaceAll(contact.PostalCode, "-", "")
		spacing := tmpl.PostalCode.DigitSpacing
		if spacing <= 0 {
			spacing = 4
		}
		cellH := tmpl.PostalCode.FontSize * 0.4
		for i, ch := range digits {
			xPos := ox + tmpl.PostalCode.X + float64(i)*spacing
			pdf.SetXY(xPos, oy+tmpl.PostalCode.Y)
			pdf.CellFormat(spacing, cellH, string(ch), "", 0, "C", false, 0, "")
		}
	}

	// Recipient name.
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
	fullName := contact.FamilyName + contact.GivenName + " " + honorific
	nameLines = append(nameLines, fullName)

	addr := buildAddress(contact)

	if tmpl.Orientation == "vertical" {
		setFont(rec.NameFont)
		xOff := ox + rec.NameX
		for _, line := range nameLines {
			drawVerticalText(pdf, line, xOff, oy+rec.NameY, rec.NameFont)
			xOff -= rec.NameFont * 0.5 // next column to the left
		}

		setFont(rec.AddressFont)
		drawVerticalText(pdf, addr, ox+rec.AddressX, oy+rec.AddressY, rec.AddressFont)
	} else {
		setFont(rec.NameFont)
		lineH := rec.NameFont * 0.5
		for i, line := range nameLines {
			pdf.SetXY(ox+rec.NameX, oy+rec.NameY+float64(i)*lineH)
			pdf.CellFormat(0, lineH, line, "", 0, "L", false, 0, "")
		}

		setFont(rec.AddressFont)
		pdf.SetXY(ox+rec.AddressX, oy+rec.AddressY)
		pdf.CellFormat(0, rec.AddressFont*0.5, addr, "", 0, "L", false, 0, "")
	}

	// Sender.
	if sender != nil {
		snd := tmpl.Sender
		senderName := sender.FamilyName + sender.GivenName
		if sender.Company != "" {
			senderName = sender.Company + " " + senderName
		}
		senderAddr := buildSenderAddress(sender)

		if tmpl.Orientation == "vertical" {
			setFont(snd.NameFont)
			drawVerticalText(pdf, senderName, ox+snd.NameX, oy+snd.NameY, snd.NameFont)
			setFont(snd.AddressFont)
			drawVerticalText(pdf, senderAddr, ox+snd.AddressX, oy+snd.AddressY, snd.AddressFont)
		} else {
			setFont(snd.NameFont)
			pdf.SetXY(ox+snd.NameX, oy+snd.NameY)
			pdf.CellFormat(0, snd.NameFont*0.5, senderName, "", 0, "L", false, 0, "")
			setFont(snd.AddressFont)
			pdf.SetXY(ox+snd.AddressX, oy+snd.AddressY)
			pdf.CellFormat(0, snd.AddressFont*0.5, senderAddr, "", 0, "L", false, 0, "")
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
