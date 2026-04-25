package usecase

import (
	"fmt"
	"os"

	"atena-label/internal/entity"
	"atena-label/internal/repository"
)

// PrintUseCase orchestrates PDF generation for label printing.
type PrintUseCase struct {
	contactRepo  repository.ContactRepository
	senderRepo   repository.SenderRepository
	pdfGenerator repository.PDFGenerator
	printer      repository.Printer
}

// NewPrintUseCase creates a new PrintUseCase.
func NewPrintUseCase(
	contactRepo repository.ContactRepository,
	senderRepo repository.SenderRepository,
	pdfGenerator repository.PDFGenerator,
	printer repository.Printer,
) *PrintUseCase {
	return &PrintUseCase{
		contactRepo:  contactRepo,
		senderRepo:   senderRepo,
		pdfGenerator: pdfGenerator,
		printer:      printer,
	}
}

// Print opens the given PDF file via the OS printer.
func (uc *PrintUseCase) Print(pdfPath string) error {
	if err := uc.printer.Print(pdfPath); err != nil {
		return fmt.Errorf("print: %w", err)
	}
	return nil
}

// GenerateLabelPDF resolves contacts and sender from the job, generates a PDF,
// writes it to outPath, and returns the path.
func (uc *PrintUseCase) GenerateLabelPDF(job entity.PrintJob, outPath string) (string, error) {
	// Frontend-rendered image flow: skip contact resolution and place provided images directly.
	useLabelImages := len(job.LabelImageDataURLs) > 0
	if useLabelImages && len(job.ContactIDs) > 0 && len(job.LabelImageDataURLs) != len(job.ContactIDs) {
		return "", fmt.Errorf(
			"label image count (%d) does not match contact count (%d)",
			len(job.LabelImageDataURLs),
			len(job.ContactIDs),
		)
	}

	contacts := []entity.Contact{}
	if !useLabelImages {
		// Resolve contacts for the legacy backend-rendering flow.
		var err error
		contacts, err = uc.resolveContacts(job.ContactIDs, false)
		if err != nil {
			return "", err
		}
	}

	// Resolve sender (optional).
	var sender *entity.Sender
	if job.SenderID != "" {
		s, err := uc.senderRepo.FindByID(job.SenderID)
		if err != nil {
			return "", fmt.Errorf("sender %s: %w", job.SenderID, err)
		}
		if s == nil {
			return "", fmt.Errorf("sender %s: not found", job.SenderID)
		}
		sender = s
	}

	// Generate PDF bytes.
	pdfBytes, err := uc.pdfGenerator.GenerateLabelPDF(job, contacts, sender)
	if err != nil {
		return "", fmt.Errorf("generate PDF: %w", err)
	}

	// Write to file.
	if err := os.WriteFile(outPath, pdfBytes, 0644); err != nil {
		return "", fmt.Errorf("write PDF file: %w", err)
	}
	return outPath, nil
}

// CheckUnsupportedCharacters scans printable text and returns unsupported glyph warnings per contact.
func (uc *PrintUseCase) CheckUnsupportedCharacters(job entity.PrintJob) ([]entity.UnsupportedCharacterWarning, error) {
	contacts, err := uc.resolveContacts(job.ContactIDs, true)
	if err != nil {
		return nil, err
	}
	if len(contacts) == 0 {
		return []entity.UnsupportedCharacterWarning{}, nil
	}

	warnings, err := uc.pdfGenerator.DetectUnsupportedCharacters(job, contacts)
	if err != nil {
		return nil, fmt.Errorf("detect unsupported characters: %w", err)
	}
	if warnings == nil {
		return []entity.UnsupportedCharacterWarning{}, nil
	}
	return warnings, nil
}

func (uc *PrintUseCase) resolveContacts(contactIDs []string, allowEmpty bool) ([]entity.Contact, error) {
	if len(contactIDs) == 0 {
		if allowEmpty {
			return []entity.Contact{}, nil
		}
		return nil, fmt.Errorf("no contacts specified for printing")
	}

	contacts := make([]entity.Contact, 0, len(contactIDs))
	cache := make(map[string]*entity.Contact, len(contactIDs))
	for _, id := range contactIDs {
		if cached, ok := cache[id]; ok {
			contacts = append(contacts, *cached)
			continue
		}

		c, err := uc.contactRepo.FindByID(id)
		if err != nil {
			return nil, fmt.Errorf("contact %s: %w", id, err)
		}
		if c == nil {
			return nil, fmt.Errorf("contact %s: not found", id)
		}
		cache[id] = c
		contacts = append(contacts, *c)
	}

	return contacts, nil
}
