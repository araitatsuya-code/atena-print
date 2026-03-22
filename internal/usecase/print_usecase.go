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

	contacts := make([]entity.Contact, 0, len(job.ContactIDs))
	if !useLabelImages {
		// Resolve contacts for the legacy backend-rendering flow.
		for _, id := range job.ContactIDs {
			c, err := uc.contactRepo.FindByID(id)
			if err != nil {
				return "", fmt.Errorf("contact %s: %w", id, err)
			}
			if c == nil {
				return "", fmt.Errorf("contact %s: not found", id)
			}
			contacts = append(contacts, *c)
		}
		if len(contacts) == 0 {
			return "", fmt.Errorf("no contacts specified for printing")
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
