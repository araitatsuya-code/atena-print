package usecase

import (
	"fmt"

	"atena-label/internal/entity"
	qrpkg "atena-label/internal/infrastructure/qr"
)

type QRCodeUseCase struct{}

func NewQRCodeUseCase() *QRCodeUseCase {
	return &QRCodeUseCase{}
}

// GeneratePreview returns a PNG-encoded QR code for the given config.
func (uc *QRCodeUseCase) GeneratePreview(config entity.QRConfig) ([]byte, error) {
	png, err := qrpkg.GeneratePreviewPNG(config)
	if err != nil {
		return nil, fmt.Errorf("GeneratePreview: %w", err)
	}
	return png, nil
}
