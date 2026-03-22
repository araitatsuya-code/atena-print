package usecase

import (
	"os"
	"strings"
	"testing"

	"atena-label/internal/entity"
)

type stubContactRepo struct {
	findByIDCalls int
}

func (r *stubContactRepo) FindAll(groupID string) ([]entity.Contact, error) {
	return nil, nil
}

func (r *stubContactRepo) FindByID(id string) (*entity.Contact, error) {
	r.findByIDCalls++
	return nil, nil
}

func (r *stubContactRepo) Create(c *entity.Contact) error {
	return nil
}

func (r *stubContactRepo) Update(c *entity.Contact) error {
	return nil
}

func (r *stubContactRepo) Delete(id string) error {
	return nil
}

func (r *stubContactRepo) Search(query string) ([]entity.Contact, error) {
	return nil, nil
}

type stubSenderRepo struct{}

func (r *stubSenderRepo) FindAll() ([]entity.Sender, error) {
	return nil, nil
}

func (r *stubSenderRepo) FindByID(id string) (*entity.Sender, error) {
	return nil, nil
}

func (r *stubSenderRepo) Create(s *entity.Sender) error {
	return nil
}

func (r *stubSenderRepo) Update(s *entity.Sender) error {
	return nil
}

func (r *stubSenderRepo) Delete(id string) error {
	return nil
}

type stubPDFGenerator struct {
	calls int
}

func (g *stubPDFGenerator) GenerateLabelPDF(job entity.PrintJob, contacts []entity.Contact, sender *entity.Sender) ([]byte, error) {
	g.calls++
	return []byte("%PDF-1.4\n"), nil
}

type stubPrinter struct{}

func (p *stubPrinter) Print(pdfPath string) error {
	return nil
}

func TestGenerateLabelPDF_RejectsMismatchedLabelImageCount(t *testing.T) {
	contactRepo := &stubContactRepo{}
	senderRepo := &stubSenderRepo{}
	pdfGen := &stubPDFGenerator{}
	uc := NewPrintUseCase(contactRepo, senderRepo, pdfGen, &stubPrinter{})

	outPath := t.TempDir() + "/out.pdf"
	job := entity.PrintJob{
		ContactIDs:         []string{"c1", "c2"},
		LabelImageDataURLs: []string{"data:image/png;base64,AAA="},
	}

	_, err := uc.GenerateLabelPDF(job, outPath)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "label image count (1) does not match contact count (2)") {
		t.Fatalf("unexpected error: %v", err)
	}
	if contactRepo.findByIDCalls != 0 {
		t.Fatalf("FindByID calls = %d, want 0", contactRepo.findByIDCalls)
	}
	if pdfGen.calls != 0 {
		t.Fatalf("GenerateLabelPDF calls = %d, want 0", pdfGen.calls)
	}
	if _, statErr := os.Stat(outPath); !os.IsNotExist(statErr) {
		t.Fatalf("output file should not exist, statErr=%v", statErr)
	}
}
