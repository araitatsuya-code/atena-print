package main

import (
	"embed"
	"log"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"

	csvpkg "atena-label/internal/infrastructure/csv"
	imagepkg "atena-label/internal/infrastructure/image"
	"atena-label/internal/infrastructure/postal"
	qrpkg "atena-label/internal/infrastructure/qr"
	dbpkg "atena-label/internal/infrastructure/sqlite"
	"atena-label/internal/usecase"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	appDataDir, err := resolveDataDir()
	if err != nil {
		log.Fatal("data dir:", err)
	}

	db, err := dbpkg.Open(filepath.Join(appDataDir, "atena.db"))
	if err != nil {
		log.Fatal("Open DB:", err)
	}
	defer db.Close()

	contactRepo := dbpkg.NewContactRepo(db)
	contactUC := usecase.NewContactUseCase(contactRepo)
	csvUC := usecase.NewCSVUseCase(contactRepo, csvpkg.NewAdapter())
	groupRepo := dbpkg.NewGroupRepo(db)
	groupUC := usecase.NewGroupUseCase(groupRepo)
	watermarkRepo := dbpkg.NewWatermarkRepo(db)
	watermarkUC := usecase.NewWatermarkUseCase(watermarkRepo, &imagepkg.FileStorage{}, filepath.Join(appDataDir, "watermarks"))
	qrCodeUC := usecase.NewQRCodeUseCase(&qrpkg.Generator{})

	postalRepo := postal.NewRepo()
	app := NewApp(contactUC, csvUC, groupUC, watermarkUC, qrCodeUC, postalRepo)

	err = wails.Run(&options.App{
		Title:  "Atena ラベル印刷",
		Width:  1280,
		Height: 800,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 255, G: 255, B: 255, A: 1},
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		log.Println("Error:", err.Error())
	}
}

func resolveDataDir() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(homeDir, ".atena-label")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", err
	}
	return dir, nil
}
