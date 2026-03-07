package repository

// StorageRepository handles file copy operations for asset storage.
type StorageRepository interface {
	CopyFile(srcPath, dstPath string) error
}
