package pdf

import (
	"regexp"
	"testing"

	"atena-label/internal/entity"
)

const onePixelPNGDataURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z3mQAAAAASUVORK5CYII="

func TestComputeLabelPlacementsSingleLabelWithOffsetA410(t *testing.T) {
	layout := entity.LabelLayout{
		PaperWidth:  210,
		PaperHeight: 297,
		LabelWidth:  86.4,
		LabelHeight: 50.8,
		Columns:     2,
		Rows:        5,
		MarginTop:   23,
		MarginLeft:  10,
		GapX:        0,
		GapY:        0,
		OffsetX:     1.2,
		OffsetY:     -0.8,
	}

	placements, err := computeLabelPlacements(layout, 1)
	if err != nil {
		t.Fatalf("computeLabelPlacements: %v", err)
	}
	if len(placements) != 1 {
		t.Fatalf("placements length = %d, want 1", len(placements))
	}

	p := placements[0]
	if p.Page != 0 {
		t.Fatalf("page = %d, want 0", p.Page)
	}
	if !almostEqual(p.X, 11.2) {
		t.Fatalf("x = %.4f, want 11.2", p.X)
	}
	if !almostEqual(p.Y, 22.2) {
		t.Fatalf("y = %.4f, want 22.2", p.Y)
	}
}

func TestComputeLabelPlacementsFullSheetA410(t *testing.T) {
	layout := entity.LabelLayout{
		PaperWidth:  210,
		PaperHeight: 297,
		LabelWidth:  86.4,
		LabelHeight: 50.8,
		Columns:     2,
		Rows:        5,
		MarginTop:   23,
		MarginLeft:  10,
		GapX:        0,
		GapY:        0,
	}

	placements, err := computeLabelPlacements(layout, 10)
	if err != nil {
		t.Fatalf("computeLabelPlacements: %v", err)
	}
	if len(placements) != 10 {
		t.Fatalf("placements length = %d, want 10", len(placements))
	}

	last := placements[9]
	if last.Page != 0 {
		t.Fatalf("last page = %d, want 0", last.Page)
	}
	if !almostEqual(last.X, 96.4) {
		t.Fatalf("last x = %.4f, want 96.4", last.X)
	}
	if !almostEqual(last.Y, 226.2) {
		t.Fatalf("last y = %.4f, want 226.2", last.Y)
	}
}

func TestComputeLabelPlacementsFullSheetPlusOneA410(t *testing.T) {
	layout := entity.LabelLayout{
		PaperWidth:  210,
		PaperHeight: 297,
		LabelWidth:  86.4,
		LabelHeight: 50.8,
		Columns:     2,
		Rows:        5,
		MarginTop:   23,
		MarginLeft:  10,
		GapX:        0,
		GapY:        0,
	}

	placements, err := computeLabelPlacements(layout, 11)
	if err != nil {
		t.Fatalf("computeLabelPlacements: %v", err)
	}
	if len(placements) != 11 {
		t.Fatalf("placements length = %d, want 11", len(placements))
	}

	p := placements[10]
	if p.Page != 1 {
		t.Fatalf("11th page = %d, want 1", p.Page)
	}
	if !almostEqual(p.X, 10) {
		t.Fatalf("11th x = %.4f, want 10", p.X)
	}
	if !almostEqual(p.Y, 23) {
		t.Fatalf("11th y = %.4f, want 23", p.Y)
	}
}

func TestComputeLabelPlacementsFullSheetA412(t *testing.T) {
	layout := entity.LabelLayout{
		PaperWidth:  210,
		PaperHeight: 297,
		LabelWidth:  86.4,
		LabelHeight: 42.3,
		Columns:     2,
		Rows:        6,
		MarginTop:   13,
		MarginLeft:  10,
		GapX:        0,
		GapY:        0,
	}

	placements, err := computeLabelPlacements(layout, 12)
	if err != nil {
		t.Fatalf("computeLabelPlacements: %v", err)
	}
	if len(placements) != 12 {
		t.Fatalf("placements length = %d, want 12", len(placements))
	}

	last := placements[11]
	if last.Page != 0 {
		t.Fatalf("last page = %d, want 0", last.Page)
	}
	if !almostEqual(last.X, 96.4) {
		t.Fatalf("last x = %.4f, want 96.4", last.X)
	}
	if !almostEqual(last.Y, 224.5) {
		t.Fatalf("last y = %.4f, want 224.5", last.Y)
	}
}

func TestComputeLabelPlacementsFullSheetPlusOneA412(t *testing.T) {
	layout := entity.LabelLayout{
		PaperWidth:  210,
		PaperHeight: 297,
		LabelWidth:  86.4,
		LabelHeight: 42.3,
		Columns:     2,
		Rows:        6,
		MarginTop:   13,
		MarginLeft:  10,
		GapX:        0,
		GapY:        0,
	}

	placements, err := computeLabelPlacements(layout, 13)
	if err != nil {
		t.Fatalf("computeLabelPlacements: %v", err)
	}
	if len(placements) != 13 {
		t.Fatalf("placements length = %d, want 13", len(placements))
	}

	p := placements[12]
	if p.Page != 1 {
		t.Fatalf("13th page = %d, want 1", p.Page)
	}
	if !almostEqual(p.X, 10) {
		t.Fatalf("13th x = %.4f, want 10", p.X)
	}
	if !almostEqual(p.Y, 13) {
		t.Fatalf("13th y = %.4f, want 13", p.Y)
	}
}

func TestGenerateLabelPDFFromLabelImageDataURLsSingleSheetA410(t *testing.T) {
	layout := entity.LabelLayout{
		PaperWidth:  210,
		PaperHeight: 297,
		LabelWidth:  86.4,
		LabelHeight: 50.8,
		Columns:     2,
		Rows:        5,
		MarginTop:   23,
		MarginLeft:  10,
		GapX:        0,
		GapY:        0,
	}

	images := make([]string, 10)
	for i := range images {
		images[i] = onePixelPNGDataURL
	}

	g := NewGenerator("")
	pdfBytes, err := g.GenerateLabelPDF(entity.PrintJob{
		LabelLayout:        layout,
		LabelImageDataURLs: images,
	}, nil, nil)
	if err != nil {
		t.Fatalf("GenerateLabelPDF: %v", err)
	}
	if len(pdfBytes) == 0 {
		t.Fatal("GenerateLabelPDF returned empty bytes")
	}

	pagePattern := regexp.MustCompile(`/Type /Page\b`)
	pageCount := len(pagePattern.FindAll(pdfBytes, -1))
	if pageCount != 1 {
		t.Fatalf("page count = %d, want 1", pageCount)
	}
}

func TestGenerateLabelPDFFromLabelImageDataURLsPageBreak(t *testing.T) {
	layout := entity.LabelLayout{
		PaperWidth:  210,
		PaperHeight: 297,
		LabelWidth:  86.4,
		LabelHeight: 42.3,
		Columns:     2,
		Rows:        6,
		MarginTop:   13,
		MarginLeft:  10,
		GapX:        0,
		GapY:        0,
	}

	images := make([]string, 13)
	for i := range images {
		images[i] = onePixelPNGDataURL
	}

	g := NewGenerator("")
	pdfBytes, err := g.GenerateLabelPDF(entity.PrintJob{
		LabelLayout:        layout,
		LabelImageDataURLs: images,
	}, nil, nil)
	if err != nil {
		t.Fatalf("GenerateLabelPDF: %v", err)
	}
	if len(pdfBytes) == 0 {
		t.Fatal("GenerateLabelPDF returned empty bytes")
	}

	pagePattern := regexp.MustCompile(`/Type /Page\b`)
	pageCount := len(pagePattern.FindAll(pdfBytes, -1))
	if pageCount != 2 {
		t.Fatalf("page count = %d, want 2", pageCount)
	}
}

func TestGenerateLabelPDFFromLabelImageDataURLsPageBreakA410(t *testing.T) {
	layout := entity.LabelLayout{
		PaperWidth:  210,
		PaperHeight: 297,
		LabelWidth:  86.4,
		LabelHeight: 50.8,
		Columns:     2,
		Rows:        5,
		MarginTop:   23,
		MarginLeft:  10,
		GapX:        0,
		GapY:        0,
	}

	images := make([]string, 11)
	for i := range images {
		images[i] = onePixelPNGDataURL
	}

	g := NewGenerator("")
	pdfBytes, err := g.GenerateLabelPDF(entity.PrintJob{
		LabelLayout:        layout,
		LabelImageDataURLs: images,
	}, nil, nil)
	if err != nil {
		t.Fatalf("GenerateLabelPDF: %v", err)
	}
	if len(pdfBytes) == 0 {
		t.Fatal("GenerateLabelPDF returned empty bytes")
	}

	pagePattern := regexp.MustCompile(`/Type /Page\b`)
	pageCount := len(pagePattern.FindAll(pdfBytes, -1))
	if pageCount != 2 {
		t.Fatalf("page count = %d, want 2", pageCount)
	}
}

func almostEqual(got, want float64) bool {
	const eps = 1e-6
	diff := got - want
	if diff < 0 {
		diff = -diff
	}
	return diff < eps
}
