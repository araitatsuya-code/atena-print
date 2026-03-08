package repository

import "atena-label/internal/entity"

// PDFGenerator generates a label PDF from a print job.
type PDFGenerator interface {
	GenerateLabelPDF(job entity.PrintJob, contacts []entity.Contact, sender *entity.Sender) ([]byte, error)
}
