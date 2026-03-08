package repository

// Printer opens or sends a PDF file to the OS print subsystem.
type Printer interface {
	Print(pdfPath string) error
}
