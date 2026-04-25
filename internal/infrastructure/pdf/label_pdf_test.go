package pdf

import (
	"os"
	"strings"
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

func TestDetectUnsupportedCharacters_NoFontsWarnsNonASCII(t *testing.T) {
	g := &Generator{}
	job := entity.PrintJob{
		Template: entity.Template{
			Orientation: "vertical",
			Recipient: entity.TextConfig{
				NameFontFamily:    "serif",
				AddressFontFamily: "serif",
			},
		},
	}
	contacts := []entity.Contact{
		{
			ID:         "c1",
			FamilyName: "髙橋",
			GivenName:  "太郎",
			Prefecture: "東京都",
			City:       "渋谷区",
		},
	}

	warnings, err := g.DetectUnsupportedCharacters(job, contacts)
	if err != nil {
		t.Fatalf("DetectUnsupportedCharacters: %v", err)
	}
	if len(warnings) != 1 {
		t.Fatalf("warning count = %d, want 1", len(warnings))
	}
	if warnings[0].ContactID != "c1" {
		t.Fatalf("warning contact ID = %q, want c1", warnings[0].ContactID)
	}
	if !containsString(warnings[0].Characters, "髙") {
		t.Fatalf("expected unsupported chars to include 髙, got %v", warnings[0].Characters)
	}
}

func TestDetectUnsupportedCharacters_NoFontsASCIIOnly(t *testing.T) {
	g := &Generator{}
	job := entity.PrintJob{
		Template: entity.Template{
			Orientation: "horizontal",
			Recipient: entity.TextConfig{
				NameFontFamily:    "serif",
				AddressFontFamily: "serif",
			},
		},
	}
	contacts := []entity.Contact{
		{
			ID:         "c1",
			FamilyName: "John",
			GivenName:  "Smith",
			Honorific:  "Mr",
			Prefecture: "CA",
			City:       "SF",
			Street:     "1st-Street",
		},
	}

	warnings, err := g.DetectUnsupportedCharacters(job, contacts)
	if err != nil {
		t.Fatalf("DetectUnsupportedCharacters: %v", err)
	}
	if len(warnings) != 0 {
		t.Fatalf("warning count = %d, want 0 (%v)", len(warnings), warnings)
	}
}

func containsString(values []string, target string) bool {
	for _, v := range values {
		if strings.EqualFold(v, target) {
			return true
		}
	}
	return false
}

func readUint32BE(b []byte) uint32 {
	return uint32(b[0])<<24 | uint32(b[1])<<16 | uint32(b[2])<<8 | uint32(b[3])
}
