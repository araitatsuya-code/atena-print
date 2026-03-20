package pdf

import (
	"os"
	"testing"
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

func readUint32BE(b []byte) uint32 {
	return uint32(b[0])<<24 | uint32(b[1])<<16 | uint32(b[2])<<8 | uint32(b[3])
}
