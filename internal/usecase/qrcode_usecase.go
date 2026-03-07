package usecase

import (
	"fmt"

	"atena-label/internal/entity"
	"atena-label/internal/repository"
)

type QRCodeUseCase struct {
	generator repository.QRGenerator
}

func NewQRCodeUseCase(gen repository.QRGenerator) *QRCodeUseCase {
	return &QRCodeUseCase{generator: gen}
}

// GeneratePreview returns a PNG-encoded QR code for the given config.
func (uc *QRCodeUseCase) GeneratePreview(config entity.QRConfig) ([]byte, error) {
	png, err := uc.generator.GeneratePreviewPNG(config)
	if err != nil {
		return nil, fmt.Errorf("GeneratePreview: %w", err)
	}
	return png, nil
}
