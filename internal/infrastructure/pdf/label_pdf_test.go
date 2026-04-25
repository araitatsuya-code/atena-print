package pdf

import (
	"os"
	"testing"

	"atena-label/internal/entity"
)

// TestJapaneseCmapScoreWithSongti verifies that the Traditional Chinese face
// of Songti.ttc scores higher than the Simplified Chinese face.
func TestJapaneseCmapScoreWithSongti(t *testing.T) {
	ttcPath := "/System/Library/Fonts/Supplemental/Songti.ttc"
	data, err := os.ReadFile(ttcPath)
	if err != nil {
		t.Skipf("Songti.ttc not available: %v", err)
	}

	numFonts := int(readUint32BE(data[8:12]))
	t.Logf("Songti.ttc: %d faces", numFonts)

	for i := 0; i < numFonts; i++ {
		face := extractTTCFace(data, i)
		if face == nil {
			t.Logf("  face %d: nil (CFF or error)", i)
			continue
		}
		score := japaneseCmapScore(face)
		t.Logf("  face %d: score=%d", i, score)
	}

	best := extractTTFFromTTC(data)
	if best == nil {
		t.Fatal("extractTTFFromTTC returned nil")
	}
	bestScore := japaneseCmapScore(best)
	t.Logf("Best face score: %d", bestScore)

	if bestScore < len(japaneseCoverageChars)/2 {
		t.Errorf("Best face covers only %d/%d Japanese chars; expected ≥%d",
			bestScore, len(japaneseCoverageChars), len(japaneseCoverageChars)/2)
	}
}

// TestExtractTTFFromTTCRoundtrip ensures the extracted bytes form a valid font.
func TestExtractTTFFromTTCRoundtrip(t *testing.T) {
	ttcPath := "/System/Library/Fonts/Supplemental/Songti.ttc"
	data, err := os.ReadFile(ttcPath)
	if err != nil {
		t.Skipf("Songti.ttc not available: %v", err)
	}

	face := extractTTFFromTTC(data)
	if face == nil {
		t.Fatal("extractTTFFromTTC returned nil")
	}

	fb, err := validateFontBytes(face, "extracted-face")
	if err != nil {
		t.Fatalf("validateFontBytes on extracted face failed: %v", err)
	}
	if len(fb) == 0 {
		t.Fatal("empty font bytes from validateFontBytes")
	}
	t.Logf("Font bytes: %d", len(fb))
}

func TestComputeVerticalNameLayoutSplitsLongName(t *testing.T) {
	contact := &entity.Contact{
		FamilyName: "山田太郎次郎三郎四郎五郎六郎七郎八郎九郎十郎",
		GivenName:  "",
		Honorific:  "様",
	}
	tmpl := entity.Template{
		LabelWidth:  86.4,
		LabelHeight: 42.3,
		Recipient: entity.TextConfig{
			NameX:       79,
			NameY:       8,
			NameFont:    13,
			AddressX:    69,
			AddressY:    8,
			AddressFont: 8.5,
		},
	}

	layout := computeVerticalNameLayout(contact, tmpl, "様")
	if len(layout.Columns) < 2 {
		t.Fatalf("expected long name to be split into multiple columns, got %v", layout.Columns)
	}
	if layout.FontPt > tmpl.Recipient.NameFont {
		t.Fatalf("font size must not increase (got %.1f > %.1f)", layout.FontPt, tmpl.Recipient.NameFont)
	}
}

func TestComputeHorizontalNameLayoutSplitsJointName(t *testing.T) {
	contact := &entity.Contact{
		FamilyName: "山田太郎・山田花子",
		GivenName:  "",
		Honorific:  "様",
	}
	tmpl := entity.Template{
		LabelWidth:  23,
		LabelHeight: 30,
		Recipient: entity.TextConfig{
			NameX:       5,
			NameY:       4,
			NameFont:    12,
			AddressX:    5,
			AddressY:    16,
			AddressFont: 8.5,
		},
	}

	layout := computeHorizontalNameLayout(contact, tmpl, "様")
	if len(layout.Lines) < 2 {
		t.Fatalf("expected joint name to wrap, got %v", layout.Lines)
	}
	if layout.Lines[0] != "山田太郎・" || layout.Lines[1] != "山田花子　様" {
		t.Fatalf("unexpected wrapped lines: %v", layout.Lines)
	}
}

func readUint32BE(b []byte) uint32 {
	return uint32(b[0])<<24 | uint32(b[1])<<16 | uint32(b[2])<<8 | uint32(b[3])
}
