package image

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"os"

	"atena-label/assets"
)

// LoadPreset returns the raw PNG bytes for a preset watermark by ID (e.g. "sakura").
func LoadPreset(id string) ([]byte, error) {
	data, err := assets.Watermarks.ReadFile("watermarks/" + id + ".png")
	if err != nil {
		return nil, fmt.Errorf("load preset %s: %w", id, err)
	}
	return data, nil
}

// LoadCustom reads a custom watermark PNG from the filesystem.
func LoadCustom(filePath string) ([]byte, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("load custom watermark: %w", err)
	}
	return data, nil
}

// ApplyOpacity takes PNG data and returns new PNG bytes with opacity (0.0–1.0) applied to the alpha channel.
func ApplyOpacity(pngData []byte, opacity float64) ([]byte, error) {
	img, _, err := image.Decode(bytes.NewReader(pngData))
	if err != nil {
		return nil, fmt.Errorf("decode image: %w", err)
	}

	bounds := img.Bounds()
	out := image.NewNRGBA(bounds)
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			r, g, b, a := img.At(x, y).RGBA()
			newA := uint8(float64(a>>8) * opacity)
			out.SetNRGBA(x, y, color.NRGBA{
				R: uint8(r >> 8),
				G: uint8(g >> 8),
				B: uint8(b >> 8),
				A: newA,
			})
		}
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, out); err != nil {
		return nil, fmt.Errorf("encode image: %w", err)
	}
	return buf.Bytes(), nil
}

// CopyToStorage copies a file from src path to dst path.
func CopyToStorage(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return fmt.Errorf("open src: %w", err)
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return fmt.Errorf("create dst: %w", err)
	}
	defer out.Close()

	if _, err := io.Copy(out, in); err != nil {
		return fmt.Errorf("copy: %w", err)
	}
	return nil
}
