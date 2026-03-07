package qr

import (
	"fmt"

	qrcode "github.com/skip2/go-qrcode"

	"atena-label/internal/entity"
)

const previewSize = 256 // pixels for preview PNG

// Generator implements repository.QRGenerator using go-qrcode.
type Generator struct{}

// GeneratePreviewPNG encodes config.Content as a QR code and returns PNG bytes.
func (g *Generator) GeneratePreviewPNG(config entity.QRConfig) ([]byte, error) {
	if config.Content == "" {
		return nil, fmt.Errorf("QR content cannot be empty")
	}

	pngBytes, err := qrcode.Encode(config.Content, qrcode.Medium, previewSize)
	if err != nil {
		return nil, fmt.Errorf("generate QR: %w", err)
	}
	return pngBytes, nil
}
