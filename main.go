package main

import (
	"embed"
	"log"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"

	"atena-label/internal/infrastructure/postal"
	dbpkg "atena-label/internal/infrastructure/sqlite"
	"atena-label/internal/usecase"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	dbPath, err := resolveDBPath()
	if err != nil {
		log.Fatal("DB path:", err)
	}

	db, err := dbpkg.Open(dbPath)
	if err != nil {
		log.Fatal("Open DB:", err)
	}
	defer db.Close()

	contactRepo := dbpkg.NewContactRepo(db)
	contactUC := usecase.NewContactUseCase(contactRepo)
	csvUC := usecase.NewCSVUseCase(contactRepo)
	groupRepo := dbpkg.NewGroupRepo(db)

	postalRepo := postal.NewRepo()
	app := NewApp(contactUC, csvUC, groupRepo, postalRepo)

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

func resolveDBPath() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(homeDir, ".atena-label")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", err
	}
	return filepath.Join(dir, "atena.db"), nil
}
