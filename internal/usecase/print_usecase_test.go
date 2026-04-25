package usecase

import (
	"os"
	"strings"
	"testing"

	"atena-label/internal/entity"
)

type stubContactRepo struct {
	findByIDCalls int
	contacts      map[string]entity.Contact
}

func (r *stubContactRepo) FindAll(groupID string) ([]entity.Contact, error) {
	return nil, nil
}

func (r *stubContactRepo) FindByID(id string) (*entity.Contact, error) {
	r.findByIDCalls++
	if c, ok := r.contacts[id]; ok {
		contact := c
		return &contact, nil
	}
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
	calls             int
	detectCalls       int
	unsupportedResult []entity.UnsupportedCharacterWarning
}

func (g *stubPDFGenerator) GenerateLabelPDF(job entity.PrintJob, contacts []entity.Contact, sender *entity.Sender) ([]byte, error) {
	g.calls++
	return []byte("%PDF-1.4\n"), nil
}

func (g *stubPDFGenerator) DetectUnsupportedCharacters(job entity.PrintJob, contacts []entity.Contact) ([]entity.UnsupportedCharacterWarning, error) {
	g.detectCalls++
	return g.unsupportedResult, nil
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

func TestCheckUnsupportedCharacters_ReturnsWarnings(t *testing.T) {
	contactRepo := &stubContactRepo{
		contacts: map[string]entity.Contact{
			"c1": {ID: "c1", FamilyName: "髙橋", GivenName: "太郎"},
		},
	}
	senderRepo := &stubSenderRepo{}
	pdfGen := &stubPDFGenerator{
		unsupportedResult: []entity.UnsupportedCharacterWarning{
			{
				ContactID:   "c1",
				ContactName: "髙橋太郎",
				Characters:  []string{"髙"},
			},
		},
	}
	uc := NewPrintUseCase(contactRepo, senderRepo, pdfGen, &stubPrinter{})

	warnings, err := uc.CheckUnsupportedCharacters(entity.PrintJob{
		ContactIDs: []string{"c1"},
	})
	if err != nil {
		t.Fatalf("CheckUnsupportedCharacters: %v", err)
	}
	if len(warnings) != 1 {
		t.Fatalf("warning count = %d, want 1", len(warnings))
	}
	if warnings[0].ContactID != "c1" {
		t.Fatalf("warning contact ID = %q, want c1", warnings[0].ContactID)
	}
	if warnings[0].Characters[0] != "髙" {
		t.Fatalf("warning character = %q, want 髙", warnings[0].Characters[0])
	}
	if contactRepo.findByIDCalls != 1 {
		t.Fatalf("FindByID calls = %d, want 1", contactRepo.findByIDCalls)
	}
	if pdfGen.detectCalls != 1 {
		t.Fatalf("DetectUnsupportedCharacters calls = %d, want 1", pdfGen.detectCalls)
	}
}

func TestCheckUnsupportedCharacters_EmptyContactIDs(t *testing.T) {
	contactRepo := &stubContactRepo{}
	senderRepo := &stubSenderRepo{}
	pdfGen := &stubPDFGenerator{}
	uc := NewPrintUseCase(contactRepo, senderRepo, pdfGen, &stubPrinter{})

	warnings, err := uc.CheckUnsupportedCharacters(entity.PrintJob{})
	if err != nil {
		t.Fatalf("CheckUnsupportedCharacters: %v", err)
	}
	if len(warnings) != 0 {
		t.Fatalf("warning count = %d, want 0", len(warnings))
	}
	if contactRepo.findByIDCalls != 0 {
		t.Fatalf("FindByID calls = %d, want 0", contactRepo.findByIDCalls)
	}
	if pdfGen.detectCalls != 0 {
		t.Fatalf("DetectUnsupportedCharacters calls = %d, want 0", pdfGen.detectCalls)
	}
}
