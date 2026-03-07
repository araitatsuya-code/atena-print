package usecase

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/google/uuid"

	"atena-label/internal/entity"
	"atena-label/internal/repository"
)

var presets = []entity.Watermark{
	{ID: "none", Name: "なし", Type: "preset", FilePath: "", Opacity: 1.0},
	{ID: "sakura", Name: "桜", Type: "preset", FilePath: "sakura", Opacity: 1.0},
	{ID: "wave", Name: "波", Type: "preset", FilePath: "wave", Opacity: 1.0},
	{ID: "bamboo", Name: "竹", Type: "preset", FilePath: "bamboo", Opacity: 1.0},
	{ID: "fuji", Name: "富士山", Type: "preset", FilePath: "fuji", Opacity: 1.0},
	{ID: "crane", Name: "鶴", Type: "preset", FilePath: "crane", Opacity: 1.0},
}

type WatermarkUseCase struct {
	repo       repository.WatermarkRepository
	storage    repository.StorageRepository
	storageDir string
}

func NewWatermarkUseCase(repo repository.WatermarkRepository, storage repository.StorageRepository, storageDir string) *WatermarkUseCase {
	return &WatermarkUseCase{repo: repo, storage: storage, storageDir: storageDir}
}

// GetPresets returns all preset and custom watermarks.
func (uc *WatermarkUseCase) GetPresets() ([]entity.Watermark, error) {
	custom, err := uc.repo.FindCustomAll()
	if err != nil {
		return nil, fmt.Errorf("get custom watermarks: %w", err)
	}
	result := make([]entity.Watermark, 0, len(presets)+len(custom))
	result = append(result, presets...)
	result = append(result, custom...)
	return result, nil
}

// Upload copies the source image to storage and saves a custom watermark record.
func (uc *WatermarkUseCase) Upload(srcPath string) (entity.Watermark, error) {
	if err := os.MkdirAll(uc.storageDir, 0755); err != nil {
		return entity.Watermark{}, fmt.Errorf("create storage dir: %w", err)
	}

	id := uuid.New().String()
	ext := filepath.Ext(srcPath)
	if ext == "" {
		ext = ".png"
	}
	dstPath := filepath.Join(uc.storageDir, id+ext)

	if err := uc.storage.CopyFile(srcPath, dstPath); err != nil {
		return entity.Watermark{}, fmt.Errorf("copy watermark: %w", err)
	}

	w := entity.Watermark{
		ID:       id,
		Name:     filepath.Base(srcPath),
		Type:     "custom",
		FilePath: dstPath,
		Opacity:  1.0,
	}
	if err := uc.repo.Create(&w); err != nil {
		return entity.Watermark{}, fmt.Errorf("save watermark: %w", err)
	}
	return w, nil
}

// Delete removes a custom watermark record and its file.
func (uc *WatermarkUseCase) Delete(id string) error {
	customs, err := uc.repo.FindCustomAll()
	if err != nil {
		return fmt.Errorf("find watermarks: %w", err)
	}
	var filePath string
	for _, w := range customs {
		if w.ID == id {
			filePath = w.FilePath
			break
		}
	}
	if filePath == "" {
		return fmt.Errorf("watermark not found: %s", id)
	}
	if err := uc.repo.Delete(id); err != nil {
		return fmt.Errorf("delete watermark record: %w", err)
	}
	if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("delete watermark file: %w", err)
	}
	return nil
}
