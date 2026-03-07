package repository

import "atena-label/internal/entity"

// QRGenerator generates a QR code PNG from a QRConfig.
type QRGenerator interface {
	GeneratePreviewPNG(config entity.QRConfig) ([]byte, error)
}
