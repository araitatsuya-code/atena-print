package pdf

import (
	"bytes"
	"embed"
	"encoding/base64"
	"encoding/binary"
	"fmt"
	"log"
	"math"
	"os"
	"runtime"
	"sort"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/jung-kurt/gofpdf"
	qrcode "github.com/skip2/go-qrcode"

	"atena-label/internal/entity"
)

// fontFS holds font files placed under internal/infrastructure/pdf/fonts/.
// If IPAGothic.ttf (sans-serif) and/or IPAMincho.ttf (serif) are present
// they are used automatically, giving proper Japanese character shapes.
// Download from https://moji.or.jp/ipafont/ipafontdownload/ (IPA Font License).
//
//go:embed fonts
var fontFS embed.FS

// Generator implements PDF generation using gofpdf.
type Generator struct {
	fontPath      string // serif font path
	fontBytes     []byte // serif font bytes (nil if unavailable)
	sansFontPath  string // sans-serif font path
	sansFontBytes []byte // sans-serif font bytes (nil if unavailable)
}

// NewGenerator creates a Generator. Pass an empty fontPath for auto-detection.
func NewGenerator(fontPath string) *Generator {
	g := &Generator{}

	// 1. Bundled fonts (fonts/ directory): proper Japanese shapes, highest priority.
	g.fontBytes = loadBundledFontBytes("fonts/IPAMincho.ttf")
	if g.fontBytes == nil {
		g.fontBytes = loadBundledFontBytes("fonts/IPAGothic.ttf")
	}
	g.sansFontBytes = loadBundledFontBytes("fonts/IPAGothic.ttf")

	// 2. Explicit font path (serif only).
	if g.fontBytes == nil {
		if fontPath != "" {
			fb, err := loadAndValidateFont(fontPath)
			if err != nil {
				log.Printf("pdf: explicit font path %q unusable (%v); falling back to system detection", fontPath, err)
				fb, fontPath = detectAndLoadFont(japaneseFontCandidates())
			}
			g.fontPath = fontPath
			g.fontBytes = fb
		} else {
			g.fontBytes, g.fontPath = detectAndLoadFont(japaneseFontCandidates())
		}
	}

	// 3. System sans-serif font if bundled font not available.
	if g.sansFontBytes == nil {
		g.sansFontBytes, g.sansFontPath = detectAndLoadFont(japaneseSansFontCandidates())
	}

	return g
}

// loadBundledFontBytes reads a font from the embedded fontFS and validates it.
// Returns nil if the file is absent or cannot be used by gofpdf.
func loadBundledFontBytes(name string) []byte {
	data, err := fontFS.ReadFile(name)
	if err != nil {
		return nil // file not present — silently skip
	}
	fb, err := validateFontBytes(data, name)
	if err != nil {
		log.Printf("pdf: bundled font %q unusable: %v", name, err)
		return nil
	}
	return fb
}

// detectAndLoadFont tries each candidate font path and returns the first usable one.
func detectAndLoadFont(candidates []string) ([]byte, string) {
	for _, p := range candidates {
		fb, err := loadAndValidateFont(p)
		if err == nil {
			return fb, p
		}
	}
	return nil, ""
}

// japaneseFontCandidates returns platform-specific serif font paths to try.
func japaneseFontCandidates() []string {
	switch runtime.GOOS {
	case "darwin":
		return []string{
			// TrueType fonts that gofpdf can embed (tested to work)
			"/System/Library/Fonts/Supplemental/Songti.ttc",         // CJK TrueType — reliable fallback
			"/System/Library/Fonts/Supplemental/STHeiti Medium.ttc", // CJK TrueType
			// Hiragino / Yu fonts are OpenType CFF and will be skipped automatically
			"/System/Library/Fonts/ヒラギノ明朝 ProN.ttc",
			"/Library/Fonts/YuMincho.ttc",
		}
	case "windows":
		return []string{
			`C:\Windows\Fonts\msmincho.ttc`,
			`C:\Windows\Fonts\YuMincho.ttc`,
			`C:\Windows\Fonts\mingliu.ttc`,
		}
	default:
		return []string{
			"/usr/share/fonts/truetype/noto/NotoSerifCJK-Regular.ttc",
			"/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc",
			"/usr/share/fonts/truetype/fonts-japanese-mincho.ttf",
		}
	}
}

// japaneseSansFontCandidates returns platform-specific sans-serif font paths to try.
func japaneseSansFontCandidates() []string {
	switch runtime.GOOS {
	case "darwin":
		return []string{
			"/System/Library/Fonts/Supplemental/STHeiti Medium.ttc", // CJK sans TrueType
			"/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc",                // OpenType CFF — will be skipped
		}
	case "windows":
		return []string{
			`C:\Windows\Fonts\msgothic.ttc`,
			`C:\Windows\Fonts\YuGothM.ttc`,
		}
	default:
		return []string{
			"/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
			"/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
			"/usr/share/fonts/truetype/fonts-japanese-gothic.ttf",
		}
	}
}

// loadAndValidateFont reads a font from disk and validates it via validateFontBytes.
func loadAndValidateFont(path string) ([]byte, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read font %q: %w", path, err)
	}
	return validateFontBytes(raw, path)
}

// validateFontBytes unwraps TTC containers, rejects CFF fonts, then verifies
// that gofpdf can actually embed the bytes in a PDF.
func validateFontBytes(raw []byte, label string) ([]byte, error) {
	fontBytes := raw
	if len(fontBytes) >= 4 {
		switch string(fontBytes[:4]) {
		case "ttcf":
			extracted := extractTTFFromTTC(fontBytes)
			if extracted == nil {
				return nil, fmt.Errorf("font %q: TTC contains no embeddable TrueType face", label)
			}
			fontBytes = extracted
		case "OTTO":
			return nil, fmt.Errorf("font %q: OpenType CFF (OTTO) is not supported by gofpdf", label)
		}
	}
	const testName = "jfont_validate"
	testPDF := gofpdf.New("P", "mm", "A4", "")
	testPDF.AddUTF8FontFromBytes(testName, "", fontBytes)
	if testPDF.Error() != nil {
		return nil, fmt.Errorf("font %q: register failed: %w", label, testPDF.Error())
	}
	testPDF.AddPage()
	testPDF.SetFont(testName, "", 10)
	if testPDF.Error() != nil {
		return nil, fmt.Errorf("font %q: SetFont failed: %w", label, testPDF.Error())
	}
	var buf bytes.Buffer
	if err := testPDF.Output(&buf); err != nil {
		return nil, fmt.Errorf("font %q: PDF output validation failed: %w", label, err)
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

// ptToMm converts typographic points to millimetres (1 pt = 25.4/72 mm ≈ 0.3528 mm).
// Template font sizes are stored in pt; gofpdf SetFont takes pt but all coordinate
// parameters (X, Y, cell widths/heights) are in mm — so sizes used as positions
// must be converted.
const ptToMm = 25.4 / 72.0

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

type labelPlacement struct {
	Page  int
	Index int
	X     float64
	Y     float64
}

func computeLabelPlacements(layout entity.LabelLayout, labelCount int) ([]labelPlacement, error) {
	if labelCount < 0 {
		return nil, fmt.Errorf("invalid label count: %d", labelCount)
	}

	labelsPerPage := layout.Columns * layout.Rows
	if labelsPerPage <= 0 {
		return nil, fmt.Errorf("invalid label layout: columns=%d rows=%d", layout.Columns, layout.Rows)
	}

	placements := make([]labelPlacement, 0, labelCount)
	for i := 0; i < labelCount; i++ {
		page := i / labelsPerPage
		pageIdx := i % labelsPerPage
		col := pageIdx % layout.Columns
		row := pageIdx / layout.Columns

		originX := layout.MarginLeft + float64(col)*(layout.LabelWidth+layout.GapX) + layout.OffsetX
		originY := layout.MarginTop + float64(row)*(layout.LabelHeight+layout.GapY) + layout.OffsetY

		placements = append(placements, labelPlacement{
			Page:  page,
			Index: i,
			X:     originX,
			Y:     originY,
		})
	}

	return placements, nil
}

func decodeDataURLImage(dataURL string) ([]byte, string, error) {
	if !strings.HasPrefix(dataURL, "data:") {
		return nil, "", fmt.Errorf("unsupported label image format: expected data URL")
	}

	parts := strings.SplitN(dataURL, ",", 2)
	if len(parts) != 2 {
		return nil, "", fmt.Errorf("invalid data URL")
	}
	if !strings.Contains(parts[0], ";base64") {
		return nil, "", fmt.Errorf("unsupported data URL encoding: expected base64")
	}

	imgBytes, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, "", fmt.Errorf("decode base64: %w", err)
	}

	header := strings.ToLower(parts[0])
	imgType := "PNG"
	if strings.Contains(header, "image/jpeg") || strings.Contains(header, "image/jpg") {
		imgType = "JPG"
	}

	return imgBytes, imgType, nil
}

func drawLabelImages(
	pdf *gofpdf.Fpdf,
	layout entity.LabelLayout,
	labelImageDataURLs []string,
	showBorder bool,
) error {
	placements, err := computeLabelPlacements(layout, len(labelImageDataURLs))
	if err != nil {
		return err
	}

	currentPage := -1
	for _, placement := range placements {
		if placement.Page != currentPage {
			pdf.AddPage()
			currentPage = placement.Page
		}

		imgBytes, imgType, err := decodeDataURLImage(labelImageDataURLs[placement.Index])
		if err != nil {
			return fmt.Errorf("label image %d: %w", placement.Index, err)
		}

		imgKey := fmt.Sprintf("label_img_%d", placement.Index)
		opts := gofpdf.ImageOptions{ImageType: imgType}
		pdf.RegisterImageOptionsReader(imgKey, opts, bytes.NewReader(imgBytes))
		if pdf.Error() != nil {
			return fmt.Errorf("register label image %d: %w", placement.Index, pdf.Error())
		}
		pdf.ImageOptions(imgKey, placement.X, placement.Y, layout.LabelWidth, layout.LabelHeight, false, opts, 0, "")

		if showBorder {
			pdf.SetDrawColor(180, 180, 180)
			pdf.SetLineWidth(0.2)
			pdf.Rect(placement.X, placement.Y, layout.LabelWidth, layout.LabelHeight, "D")
		}
	}

	return nil
}

type textSegment struct {
	Field      string
	FontFamily string
	Text       string
}

type fontRuneChecker struct {
	fmt4  *cmapFormat4
	fmt12 []cmapFormat12Group
}

type cmapFormat4 struct {
	data      []byte
	segCount  int
	endBase   int
	startBase int
	deltaBase int
	rangeBase int
}

type cmapFormat12Group struct {
	startCode uint32
	endCode   uint32
	startGID  uint32
}

func newFontRuneChecker(fontBytes []byte) *fontRuneChecker {
	if len(fontBytes) == 0 {
		return &fontRuneChecker{}
	}

	cmap := findCmapTable(fontBytes)
	if len(cmap) == 0 {
		return &fontRuneChecker{}
	}

	fmt4, fmt12 := parseUnicodeCmaps(cmap)
	return &fontRuneChecker{
		fmt4:  fmt4,
		fmt12: fmt12,
	}
}

func (c *fontRuneChecker) SupportsRune(r rune) bool {
	if r == '\n' || r == '\r' || r == '\t' {
		return true
	}
	if r >= 0x20 && r <= 0x7E {
		return true
	}
	if c == nil {
		return false
	}

	if c.fmt4 != nil && r >= 0 && r <= 0xFFFF {
		if supportsRuneFormat4(c.fmt4, uint16(r)) {
			return true
		}
	}
	if len(c.fmt12) > 0 && supportsRuneFormat12(c.fmt12, uint32(r)) {
		return true
	}
	return false
}

func findCmapTable(ttfBytes []byte) []byte {
	if len(ttfBytes) < 12 {
		return nil
	}
	numTables := int(binary.BigEndian.Uint16(ttfBytes[4:6]))
	for i := 0; i < numTables; i++ {
		base := 12 + i*16
		if base+16 > len(ttfBytes) {
			return nil
		}
		if string(ttfBytes[base:base+4]) != "cmap" {
			continue
		}
		off := binary.BigEndian.Uint32(ttfBytes[base+8 : base+12])
		length := binary.BigEndian.Uint32(ttfBytes[base+12 : base+16])
		if off == 0 || length == 0 || int(off+length) > len(ttfBytes) {
			return nil
		}
		return ttfBytes[off : off+length]
	}
	return nil
}

func parseUnicodeCmaps(cmap []byte) (*cmapFormat4, []cmapFormat12Group) {
	if len(cmap) < 4 {
		return nil, nil
	}
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
		switch format {
		case 4:
			if platformID == 3 && encodingID == 1 {
				fmt4Off = off
			} else if platformID == 0 && encodingID >= 3 && fmt4Off == 0 {
				fmt4Off = off
			} else if fmt4Off == 0 {
				fmt4Off = off
			}
		case 12:
			if (platformID == 3 && encodingID == 10) || (platformID == 0 && encodingID == 4) {
				if fmt12Off == 0 {
					fmt12Off = off
				}
			} else if fmt12Off == 0 {
				fmt12Off = off
			}
		}
	}

	var parsedFmt4 *cmapFormat4
	if fmt4Off != 0 {
		parsedFmt4 = parseCmapFormat4(cmap, fmt4Off)
	}
	var parsedFmt12 []cmapFormat12Group
	if fmt12Off != 0 {
		parsedFmt12 = parseCmapFormat12(cmap, fmt12Off)
	}
	return parsedFmt4, parsedFmt12
}

func parseCmapFormat4(cmap []byte, off uint32) *cmapFormat4 {
	if int(off)+16 > len(cmap) {
		return nil
	}
	sub := cmap[off:]
	segCount := int(binary.BigEndian.Uint16(sub[6:8])) / 2
	if segCount <= 0 {
		return nil
	}

	endBase := 14
	startBase := endBase + segCount*2 + 2
	deltaBase := startBase + segCount*2
	rangeBase := deltaBase + segCount*2
	if rangeBase+segCount*2 > len(sub) {
		return nil
	}

	return &cmapFormat4{
		data:      sub,
		segCount:  segCount,
		endBase:   endBase,
		startBase: startBase,
		deltaBase: deltaBase,
		rangeBase: rangeBase,
	}
}

func parseCmapFormat12(cmap []byte, off uint32) []cmapFormat12Group {
	if int(off)+16 > len(cmap) {
		return nil
	}
	sub := cmap[off:]
	numGroups := int(binary.BigEndian.Uint32(sub[12:16]))
	if numGroups <= 0 || 16+numGroups*12 > len(sub) {
		return nil
	}

	groups := make([]cmapFormat12Group, 0, numGroups)
	for i := 0; i < numGroups; i++ {
		base := 16 + i*12
		groups = append(groups, cmapFormat12Group{
			startCode: binary.BigEndian.Uint32(sub[base : base+4]),
			endCode:   binary.BigEndian.Uint32(sub[base+4 : base+8]),
			startGID:  binary.BigEndian.Uint32(sub[base+8 : base+12]),
		})
	}
	return groups
}

func supportsRuneFormat4(fmt4 *cmapFormat4, cp uint16) bool {
	sub := fmt4.data
	for s := 0; s < fmt4.segCount; s++ {
		end := binary.BigEndian.Uint16(sub[fmt4.endBase+s*2 : fmt4.endBase+s*2+2])
		if cp > end {
			continue
		}

		start := binary.BigEndian.Uint16(sub[fmt4.startBase+s*2 : fmt4.startBase+s*2+2])
		if cp < start {
			return false
		}

		delta := int16(binary.BigEndian.Uint16(sub[fmt4.deltaBase+s*2 : fmt4.deltaBase+s*2+2]))
		rangeOff := binary.BigEndian.Uint16(sub[fmt4.rangeBase+s*2 : fmt4.rangeBase+s*2+2])
		if rangeOff == 0 {
			return uint16(int(cp)+int(delta)) != 0
		}

		// idRangeOffset points to a glyph ID array relative to the current idRangeOffset word.
		rangeWordPos := fmt4.rangeBase + s*2
		glyphPos := rangeWordPos + int(rangeOff) + int(cp-start)*2
		if glyphPos+2 > len(sub) {
			return false
		}
		glyph := binary.BigEndian.Uint16(sub[glyphPos : glyphPos+2])
		if glyph == 0 {
			return false
		}
		glyph = uint16(int(glyph) + int(delta))
		return glyph != 0
	}
	return false
}

func supportsRuneFormat12(groups []cmapFormat12Group, cp uint32) bool {
	low, high := 0, len(groups)-1
	for low <= high {
		mid := low + (high-low)/2
		g := groups[mid]
		if cp < g.startCode {
			high = mid - 1
			continue
		}
		if cp > g.endCode {
			low = mid + 1
			continue
		}
		gid := g.startGID + (cp - g.startCode)
		return gid != 0
	}
	return false
}

func formatPostalCodeForLabel(raw string) string {
	digits := strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, raw)
	if len(digits) == 7 {
		return digits[:3] + "-" + digits[3:]
	}
	return digits
}

func collectAddressLines(contact entity.Contact) []string {
	addrLine1 := contact.Prefecture + contact.City
	addrLine2 := contact.Street
	if contact.Building != "" {
		addrLine2 += "\u3000" + contact.Building
	}
	lines := []string{}
	if addrLine1 != "" {
		lines = append(lines, addrLine1)
	}
	if addrLine2 != "" {
		lines = append(lines, addrLine2)
	}
	return lines
}

func labelTextSegments(contact entity.Contact, tmpl entity.Template) []textSegment {
	segments := []textSegment{}

	if tmpl.PostalCode != nil && contact.PostalCode != "" {
		segments = append(segments, textSegment{
			Field:      "postalCode",
			FontFamily: tmpl.PostalCode.FontFamily,
			Text:       "〒" + formatPostalCodeForLabel(contact.PostalCode),
		})
	}

	rec := tmpl.Recipient
	honorific := contact.Honorific
	if honorific == "" {
		honorific = "様"
	}

	if tmpl.Orientation == "vertical" {
		segments = append(segments, textSegment{
			Field:      "recipientName",
			FontFamily: rec.NameFontFamily,
			Text:       contact.FamilyName + contact.GivenName + honorific,
		})
		for _, line := range collectAddressLines(contact) {
			segments = append(segments, textSegment{
				Field:      "recipientAddress",
				FontFamily: rec.AddressFontFamily,
				Text:       toKanjiNumerals(line),
			})
		}
		return segments
	}

	if contact.Company != "" {
		segments = append(segments, textSegment{
			Field:      "recipientName",
			FontFamily: rec.NameFontFamily,
			Text:       contact.Company,
		})
		if contact.Department != "" {
			segments = append(segments, textSegment{
				Field:      "recipientName",
				FontFamily: rec.NameFontFamily,
				Text:       contact.Department,
			})
		}
	}
	segments = append(segments, textSegment{
		Field:      "recipientName",
		FontFamily: rec.NameFontFamily,
		Text:       contact.FamilyName + contact.GivenName + "\u3000" + honorific,
	})
	for _, line := range collectAddressLines(contact) {
		segments = append(segments, textSegment{
			Field:      "recipientAddress",
			FontFamily: rec.AddressFontFamily,
			Text:       line,
		})
	}
	return segments
}

func fallbackContactName(contact entity.Contact) string {
	name := strings.TrimSpace(contact.FamilyName + contact.GivenName)
	if name != "" {
		return name
	}
	if contact.Company != "" {
		return contact.Company
	}
	return contact.ID
}

func shouldSkipGlyphCheckRune(r rune) bool {
	return unicode.IsSpace(r) || unicode.IsControl(r)
}

// DetectUnsupportedCharacters checks whether each printable rune can be rendered by the selected font family.
func (g *Generator) DetectUnsupportedCharacters(
	job entity.PrintJob,
	contacts []entity.Contact,
) ([]entity.UnsupportedCharacterWarning, error) {
	serifChecker := newFontRuneChecker(g.fontBytes)
	sansChecker := newFontRuneChecker(g.sansFontBytes)
	hasSerifFont := len(g.fontBytes) > 0
	hasSansFont := len(g.sansFontBytes) > 0

	selectChecker := func(family string) *fontRuneChecker {
		if family == "sans-serif" && hasSansFont {
			return sansChecker
		}
		if hasSerifFont {
			return serifChecker
		}
		return &fontRuneChecker{}
	}

	warnings := make([]entity.UnsupportedCharacterWarning, 0)
	warningIndexByContact := make(map[string]int, len(contacts))

	for _, contact := range contacts {
		segments := labelTextSegments(contact, job.Template)
		if len(segments) == 0 {
			continue
		}

		unsupportedRunes := make(map[rune]struct{})
		for _, segment := range segments {
			checker := selectChecker(segment.FontFamily)
			for _, r := range segment.Text {
				if shouldSkipGlyphCheckRune(r) {
					continue
				}
				if !checker.SupportsRune(r) {
					unsupportedRunes[r] = struct{}{}
				}
			}
		}
		if len(unsupportedRunes) == 0 {
			continue
		}

		runes := make([]rune, 0, len(unsupportedRunes))
		for r := range unsupportedRunes {
			runes = append(runes, r)
		}
		sort.Slice(runes, func(i, j int) bool { return runes[i] < runes[j] })

		chars := make([]string, 0, len(runes))
		for _, r := range runes {
			chars = append(chars, string(r))
		}

		idx, exists := warningIndexByContact[contact.ID]
		if !exists {
			warnings = append(warnings, entity.UnsupportedCharacterWarning{
				ContactID:   contact.ID,
				ContactName: fallbackContactName(contact),
				Characters:  chars,
			})
			warningIndexByContact[contact.ID] = len(warnings) - 1
			continue
		}

		// Merge duplicates when the same contact appears multiple times (e.g. repeat fill).
		existing := make(map[string]struct{}, len(warnings[idx].Characters))
		for _, ch := range warnings[idx].Characters {
			existing[ch] = struct{}{}
		}
		for _, ch := range chars {
			if _, ok := existing[ch]; ok {
				continue
			}
			warnings[idx].Characters = append(warnings[idx].Characters, ch)
		}
		sort.Strings(warnings[idx].Characters)
	}

	return warnings, nil
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

	layout := job.LabelLayout
	if len(job.LabelImageDataURLs) > 0 {
		if err := drawLabelImages(pdf, layout, job.LabelImageDataURLs, job.ShowBorder); err != nil {
			return nil, err
		}
		var buf bytes.Buffer
		if err := pdf.Output(&buf); err != nil {
			return nil, fmt.Errorf("pdf output: %w", err)
		}
		return buf.Bytes(), nil
	}

	// Register Japanese fonts (serif + sans-serif) if available.
	// Use pre-validated fontBytes to avoid TTC/OTF files that register
	// without error but fail at pdf.Output() with "undefined font".
	const (
		serifFontName = "jfont"
		sansFontName  = "jfont_sans"
	)
	hasSerifFont := false
	if g.fontBytes != nil {
		pdf.AddUTF8FontFromBytes(serifFontName, "", g.fontBytes)
		if pdf.Error() == nil {
			hasSerifFont = true
		}
	}
	hasSansFont := false
	if g.sansFontBytes != nil {
		pdf.AddUTF8FontFromBytes(sansFontName, "", g.sansFontBytes)
		if pdf.Error() == nil {
			hasSansFont = true
		}
	}

	// setFont selects the appropriate registered font by family ("" or "serif" → serif, "sans-serif" → sans).
	setFont := func(size float64, family string) {
		useSans := family == "sans-serif" && hasSansFont
		switch {
		case useSans:
			pdf.SetFont(sansFontName, "", size)
		case hasSerifFont:
			pdf.SetFont(serifFontName, "", size)
		default:
			pdf.SetFont("Courier", "", size)
		}
	}

	tmpl := job.Template

	labelsPerPage := layout.Columns * layout.Rows
	if labelsPerPage <= 0 {
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

	// Pre-register watermark image from base64 data URL (set by frontend before printing).
	// For preset watermarks the frontend renders an emoji canvas to PNG and sets FilePath to
	// "data:image/png;base64,…"; for custom watermarks FilePath already contains a data URL.
	var wmKey, wmImgType string
	if job.Watermark != nil && strings.HasPrefix(job.Watermark.FilePath, "data:") {
		parts := strings.SplitN(job.Watermark.FilePath, ",", 2)
		if len(parts) == 2 {
			imgBytes, err := base64.StdEncoding.DecodeString(parts[1])
			if err == nil {
				wmKey = "wm_img"
				wmImgType = "PNG"
				if strings.Contains(parts[0], "jpeg") || strings.Contains(parts[0], "jpg") {
					wmImgType = "JPG"
				}
				pdf.RegisterImageOptionsReader(wmKey, gofpdf.ImageOptions{ImageType: wmImgType}, bytes.NewReader(imgBytes))
			}
		}
	}

	placements, err := computeLabelPlacements(layout, len(contacts))
	if err != nil {
		return nil, err
	}

	currentPage := -1
	for _, placement := range placements {
		if placement.Page != currentPage {
			pdf.AddPage()
			currentPage = placement.Page
		}

		contact := contacts[placement.Index]
		originX := placement.X
		originY := placement.Y

		// Watermark background (base64 data URL pre-registered above, or file path fallback).
		if wmKey != "" {
			pdf.ImageOptions(wmKey, originX, originY, layout.LabelWidth, layout.LabelHeight, false, gofpdf.ImageOptions{ImageType: wmImgType}, 0, "")
		} else if job.Watermark != nil && job.Watermark.FilePath != "" {
			if _, err := os.Stat(job.Watermark.FilePath); err == nil {
				imgType := imageType(job.Watermark.FilePath)
				pdf.ImageOptions(job.Watermark.FilePath, originX, originY, layout.LabelWidth, layout.LabelHeight, false, gofpdf.ImageOptions{ImageType: imgType}, 0, "")
			}
		}

		// ラベル枠線
		if job.ShowBorder {
			pdf.SetDrawColor(180, 180, 180) // 薄いグレー
			pdf.SetLineWidth(0.2)
			pdf.Rect(originX, originY, layout.LabelWidth, layout.LabelHeight, "D")
		}

		// Label content.
		drawLabel(pdf, setFont, &contact, sender, tmpl, originX, originY)

		// QR code.
		if qrPNG != nil {
			drawQR(pdf, job.QRConfig, qrPNG, originX, originY, layout.LabelWidth, layout.LabelHeight, placement.Index)
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

const (
	nameHorizontalMinFontPt       = 7.0
	nameHorizontalSplitThreshold  = 12
	nameHorizontalLineHeightRatio = 1.35
	nameHorizontalRightPaddingMm  = 2.0
	nameHorizontalBottomPaddingMm = 2.0
	nameHorizontalAddressGapMm    = 1.2
	nameHorizontalGlyphWidthRatio = 0.95
	nameVerticalMinFontPt         = 6.0
	nameVerticalBottomPaddingMm   = 2.0
	nameVerticalLeftPaddingMm     = 2.0
	nameVerticalAddressGapMm      = 1.2
	nameVerticalColumnGapRatio    = 0.2
	nameVerticalCharHeightRatio   = 1.05
	nameVerticalMaxColumns        = 3
)

var jointNameSeparators = map[rune]struct{}{
	'・': {}, '･': {}, '/': {}, '／': {}, '&': {}, '＆': {},
}

type horizontalNameLayout struct {
	Lines       []string
	FontPt      float64
	LineHeightM float64
}

type verticalNameLayout struct {
	Columns []string
	FontPt  float64
}

func estimateTextUnits(text string) float64 {
	units := 0.0
	for _, ch := range text {
		switch {
		case ch == ' ' || ch == '\u3000':
			units += 0.55
		case isHalfWidthRune(ch):
			units += 0.55
		case ch == 'ー' || ch == 'ｰ' || ch == '-':
			units += 0.8
		default:
			units += 1
		}
	}
	return units
}

func isHalfWidthRune(ch rune) bool {
	return (ch >= 0x20 && ch <= 0x7E) || (ch >= 0xFF61 && ch <= 0xFF9F)
}

func estimateLineWidthMm(text string, fontPt float64) float64 {
	return estimateTextUnits(text) * fontPt * ptToMm * nameHorizontalGlyphWidthRatio
}

func listFontCandidates(basePt, minPt float64) []float64 {
	floor := minPt
	if basePt < floor {
		floor = basePt
	}
	if basePt <= floor+1e-6 {
		return []float64{basePt}
	}

	out := make([]float64, 0, int((basePt-floor)*2)+2)
	for pt := basePt; pt >= floor-1e-6; pt -= 0.5 {
		out = append(out, math.Round(pt*10)/10)
	}
	if len(out) == 0 || math.Abs(out[len(out)-1]-floor) > 1e-6 {
		out = append(out, floor)
	}

	uniq := make([]float64, 0, len(out))
	seen := map[float64]struct{}{}
	for _, pt := range out {
		if _, ok := seen[pt]; ok {
			continue
		}
		seen[pt] = struct{}{}
		uniq = append(uniq, pt)
	}
	return uniq
}

func splitEvenly(text string, pieces int) []string {
	runes := []rune(text)
	if pieces <= 1 || len(runes) <= 1 {
		return []string{text}
	}

	bucketCount := pieces
	if bucketCount > len(runes) {
		bucketCount = len(runes)
	}
	out := make([]string, 0, bucketCount)
	idx := 0
	for i := 0; i < bucketCount; i++ {
		remainingChars := len(runes) - idx
		remainingBuckets := bucketCount - i
		take := (remainingChars + remainingBuckets - 1) / remainingBuckets
		out = append(out, string(runes[idx:idx+take]))
		idx += take
	}
	return out
}

func splitJointNameBody(nameBody string) []string {
	out := []string{}
	buf := []rune{}
	for _, ch := range nameBody {
		if _, ok := jointNameSeparators[ch]; ok {
			if len(buf) > 0 {
				part := append([]rune{}, buf...)
				part = append(part, ch)
				out = append(out, string(part))
				buf = buf[:0]
			}
			continue
		}
		buf = append(buf, ch)
	}
	if len(buf) > 0 {
		out = append(out, string(buf))
	}
	if len(out) < 2 {
		return nil
	}
	return out
}

func buildHorizontalNameCandidates(contact *entity.Contact, honorific string) [][]string {
	nameBody := contact.FamilyName + contact.GivenName
	defaultNameLine := nameBody + "\u3000" + honorific

	orgLines := []string{}
	if v := strings.TrimSpace(contact.Company); v != "" {
		orgLines = append(orgLines, v)
	}
	if v := strings.TrimSpace(contact.Department); v != "" {
		orgLines = append(orgLines, v)
	}

	splitNameLines := []string{defaultNameLine}
	if jointParts := splitJointNameBody(nameBody); len(jointParts) >= 2 {
		splitNameLines = append([]string{}, jointParts...)
		splitNameLines[len(splitNameLines)-1] = splitNameLines[len(splitNameLines)-1] + "\u3000" + honorific
	} else if utf8.RuneCountInString(nameBody) >= nameHorizontalSplitThreshold {
		parts := splitEvenly(nameBody, 2)
		if len(parts) == 2 {
			splitNameLines = []string{parts[0], parts[1] + "\u3000" + honorific}
		}
	}

	mergedOrgLines := orgLines
	if len(orgLines) > 1 {
		mergedOrgLines = []string{strings.Join(orgLines, " ")}
	}

	candidates := make([][]string, 0, 6)
	seen := map[string]struct{}{}
	add := func(lines []string) {
		normalized := make([]string, 0, len(lines))
		for _, line := range lines {
			if line == "" {
				continue
			}
			normalized = append(normalized, line)
		}
		if len(normalized) == 0 {
			return
		}
		key := strings.Join(normalized, "\n")
		if _, ok := seen[key]; ok {
			return
		}
		seen[key] = struct{}{}
		candidates = append(candidates, normalized)
	}

	add(append(append([]string{}, orgLines...), defaultNameLine))
	add(append(append([]string{}, orgLines...), splitNameLines...))
	add(append(append([]string{}, mergedOrgLines...), defaultNameLine))
	add(append(append([]string{}, mergedOrgLines...), splitNameLines...))
	add([]string{defaultNameLine})
	add(splitNameLines)

	return candidates
}

func computeHorizontalNameLayout(contact *entity.Contact, tmpl entity.Template, honorific string) horizontalNameLayout {
	rec := tmpl.Recipient
	candidates := buildHorizontalNameCandidates(contact, honorific)

	baseFontPt := rec.NameFont
	minFontPt := rec.NameFont
	if nameHorizontalMinFontPt < minFontPt {
		minFontPt = nameHorizontalMinFontPt
	}

	availableWidthMm := tmpl.LabelWidth - rec.NameX - nameHorizontalRightPaddingMm
	if availableWidthMm < 10 {
		availableWidthMm = 10
	}
	availableHeightMm := tmpl.LabelHeight - rec.NameY - nameHorizontalBottomPaddingMm
	if rec.AddressY > rec.NameY {
		availableHeightMm = math.Min(availableHeightMm, rec.AddressY-rec.NameY-nameHorizontalAddressGapMm)
	}
	minRequiredHeight := minFontPt * ptToMm * nameHorizontalLineHeightRatio
	if availableHeightMm < minRequiredHeight {
		availableHeightMm = minRequiredHeight
	}

	fontCandidates := listFontCandidates(baseFontPt, minFontPt)
	for _, lines := range candidates {
		for _, fontPt := range fontCandidates {
			lineHeightMm := fontPt * ptToMm * nameHorizontalLineHeightRatio
			if lineHeightMm*float64(len(lines)) > availableHeightMm+1e-6 {
				continue
			}
			maxLineWidthMm := 0.0
			for _, line := range lines {
				w := estimateLineWidthMm(line, fontPt)
				if w > maxLineWidthMm {
					maxLineWidthMm = w
				}
			}
			if maxLineWidthMm <= availableWidthMm+1e-6 {
				return horizontalNameLayout{
					Lines:       lines,
					FontPt:      fontPt,
					LineHeightM: lineHeightMm,
				}
			}
		}
	}

	fallback := []string{contact.FamilyName + contact.GivenName + "\u3000" + honorific}
	if len(candidates) > 0 {
		fallback = candidates[len(candidates)-1]
	}
	return horizontalNameLayout{
		Lines:       fallback,
		FontPt:      minFontPt,
		LineHeightM: minFontPt * ptToMm * nameHorizontalLineHeightRatio,
	}
}

func buildVerticalNameCandidates(nameBody, honorific string) [][]string {
	fullName := nameBody + honorific
	candidates := make([][]string, 0, nameVerticalMaxColumns+1)
	seen := map[string]struct{}{}
	add := func(cols []string) {
		normalized := make([]string, 0, len(cols))
		for _, line := range cols {
			if line == "" {
				continue
			}
			normalized = append(normalized, line)
		}
		if len(normalized) == 0 {
			return
		}
		key := strings.Join(normalized, "\n")
		if _, ok := seen[key]; ok {
			return
		}
		seen[key] = struct{}{}
		candidates = append(candidates, normalized)
	}

	add([]string{fullName})

	if joint := splitJointNameBody(nameBody); len(joint) >= 2 {
		cols := append([]string{}, joint...)
		if len(cols) > nameVerticalMaxColumns {
			merged := append([]string{}, cols[:nameVerticalMaxColumns-1]...)
			merged = append(merged, strings.Join(cols[nameVerticalMaxColumns-1:], ""))
			cols = merged
		}
		cols[len(cols)-1] = cols[len(cols)-1] + honorific
		add(cols)
	}

	for n := 2; n <= nameVerticalMaxColumns; n++ {
		cols := splitEvenly(nameBody, n)
		if len(cols) <= 1 {
			continue
		}
		cols[len(cols)-1] = cols[len(cols)-1] + honorific
		add(cols)
	}

	return candidates
}

func computeVerticalNameLayout(contact *entity.Contact, tmpl entity.Template, honorific string) verticalNameLayout {
	rec := tmpl.Recipient
	nameBody := contact.FamilyName + contact.GivenName
	candidates := buildVerticalNameCandidates(nameBody, honorific)

	baseFontPt := rec.NameFont
	minFontPt := rec.NameFont
	if nameVerticalMinFontPt < minFontPt {
		minFontPt = nameVerticalMinFontPt
	}
	fontCandidates := listFontCandidates(baseFontPt, minFontPt)

	availableHeightMm := tmpl.LabelHeight - rec.NameY - nameVerticalBottomPaddingMm
	minRequiredHeight := minFontPt * ptToMm * nameVerticalCharHeightRatio
	if availableHeightMm < minRequiredHeight {
		availableHeightMm = minRequiredHeight
	}

	leftLimitMm := nameVerticalLeftPaddingMm
	if rec.AddressX > 0 && rec.AddressX < rec.NameX {
		limit := rec.AddressX + rec.AddressFont*ptToMm*1.2 + nameVerticalAddressGapMm
		if limit > leftLimitMm {
			leftLimitMm = limit
		}
	}
	availableWidthMm := rec.NameX - leftLimitMm
	minRequiredWidth := minFontPt * ptToMm
	if availableWidthMm < minRequiredWidth {
		availableWidthMm = minRequiredWidth
	}

	for _, columns := range candidates {
		maxChars := 0
		for _, line := range columns {
			if n := utf8.RuneCountInString(line); n > maxChars {
				maxChars = n
			}
		}
		if maxChars <= 0 {
			continue
		}

		for _, fontPt := range fontCandidates {
			fontMm := fontPt * ptToMm
			colGap := fontMm * nameVerticalColumnGapRatio
			requiredWidthMm := fontMm*float64(len(columns)) + colGap*float64(len(columns)-1)
			requiredHeightMm := float64(maxChars) * fontMm * nameVerticalCharHeightRatio
			if requiredWidthMm <= availableWidthMm+1e-6 && requiredHeightMm <= availableHeightMm+1e-6 {
				return verticalNameLayout{
					Columns: columns,
					FontPt:  fontPt,
				}
			}
		}
	}

	fallback := []string{nameBody + honorific}
	if len(candidates) > 0 {
		fallback = candidates[len(candidates)-1]
	}
	return verticalNameLayout{
		Columns: fallback,
		FontPt:  minFontPt,
	}
}

// drawLabel renders postal code, recipient and sender onto a single label cell.
func drawLabel(
	pdf *gofpdf.Fpdf,
	setFont func(float64, string),
	contact *entity.Contact,
	sender *entity.Sender,
	tmpl entity.Template,
	ox, oy float64,
) {
	pdf.SetTextColor(0, 0, 0)

	// ── 郵便番号 ────────────────────────────────────────────────────────────
	// アプリプレビューと同様に〒マーク＋"NNN-NNNN"形式で1文字ずつ描画する。
	if tmpl.PostalCode != nil && contact.PostalCode != "" {
		setFont(tmpl.PostalCode.FontSize, tmpl.PostalCode.FontFamily)
		spacing := tmpl.PostalCode.DigitSpacing
		if spacing <= 0 {
			spacing = 4
		}
		cellH := tmpl.PostalCode.FontSize * ptToMm * 1.3
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
		// 縦書き: 長文や連名は自動で縮小/列分割して枠内に収める
		nameLayout := computeVerticalNameLayout(contact, tmpl, honorific)
		setFont(nameLayout.FontPt, rec.NameFontFamily)
		drawVerticalBlockPDF(pdf, nameLayout.Columns, ox+rec.NameX, oy+rec.NameY, nameLayout.FontPt*ptToMm)

		setFont(rec.AddressFont, rec.AddressFontFamily)
		addrFontMm := rec.AddressFont * ptToMm
		// 縦書き住所は数字を漢数字に変換 (プレビュー convertNumbers=true と一致)
		var kanjiAddrLines []string
		for _, l := range addrLines {
			kanjiAddrLines = append(kanjiAddrLines, toKanjiNumerals(l))
		}
		drawVerticalBlockPDF(pdf, kanjiAddrLines, ox+rec.AddressX, oy+rec.AddressY, addrFontMm)
	} else {
		// 横書き: 長文や連名は自動で縮小/改行し、優先順で行構成を調整する
		nameLayout := computeHorizontalNameLayout(contact, tmpl, honorific)
		setFont(nameLayout.FontPt, rec.NameFontFamily)
		for i, line := range nameLayout.Lines {
			pdf.SetXY(ox+rec.NameX, oy+rec.NameY+float64(i)*nameLayout.LineHeightM)
			pdf.CellFormat(0, nameLayout.LineHeightM, line, "", 0, "L", false, 0, "")
		}

		setFont(rec.AddressFont, rec.AddressFontFamily)
		addrFontMm := rec.AddressFont * ptToMm
		addrLineH := addrFontMm * 1.5 // プレビューの lineH = addrFontPx * 1.5 と一致
		for i, line := range addrLines {
			pdf.SetXY(ox+rec.AddressX, oy+rec.AddressY+float64(i)*addrLineH)
			pdf.CellFormat(0, addrLineH, line, "", 0, "L", false, 0, "")
		}
	}

	// TODO: 差出人描画はアプリプレビュー (LabelCanvas) が対応次第ここに実装する。
	// 現時点では LabelCanvas が差出人を描画しないため、PDF でも非表示にしてプレビューと一致させる。
	_ = sender
}

// drawVerticalBlockPDF renders lines of text as vertical columns, matching the
// preview's drawVerticalBlock semantics:
//   - lines[0] = rightmost column, lines[1] = next to the left, …
//   - rightX  = right edge of the entire block (in mm, relative to page origin)
//   - topY    = top of the block (mm)
//   - fontMm  = font size converted to mm (pt * ptToMm)
func drawVerticalBlockPDF(pdf *gofpdf.Fpdf, lines []string, rightX, topY, fontMm float64) {
	colGap := fontMm * 0.2  // matches preview: columnGap = fontSize * 0.2
	colW := fontMm + colGap // = fontMm * 1.2
	charH := fontMm * 1.05  // matches preview: cellHeight = fontSize * (1 + charGap=0.05)

	for i, line := range lines {
		if line == "" {
			continue
		}
		// Column center, same formula as preview:
		//   colCenterX = rightX - fontSize/2 - colWidth * i
		centerX := rightX - fontMm/2.0 - colW*float64(i)
		leftX := centerX - fontMm/2.0
		for j, ch := range line {
			pdf.SetXY(leftX, topY+float64(j)*charH)
			pdf.CellFormat(fontMm, charH, string(ch), "", 0, "C", false, 0, "")
		}
	}
}

// arabicToKanji maps ASCII digits to kanji numerals for vertical-text address rendering,
// matching the preview's convertNumbers=true behaviour.
var arabicToKanji = map[rune]string{
	'0': "〇", '1': "一", '2': "二", '3': "三", '4': "四",
	'5': "五", '6': "六", '7': "七", '8': "八", '9': "九",
}

func toKanjiNumerals(s string) string {
	var b strings.Builder
	for _, r := range s {
		if k, ok := arabicToKanji[r]; ok {
			b.WriteString(k)
		} else {
			b.WriteRune(r)
		}
	}
	return b.String()
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
