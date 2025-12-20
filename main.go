package main

import (
	"embed"
	"log"
	"os"

	"github.com/TrueBlocks/trueblocks-poetry/backend/settings"
	"github.com/TrueBlocks/trueblocks-poetry/pkg/constants"

	"github.com/joho/godotenv"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/logger"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Load .env file from current working directory, or fallback to ~/.poetry-app
	cwd, _ := os.Getwd()
	envPath := cwd + "/.env"

	// Try loading from current directory first
	if err := godotenv.Load(envPath); err != nil {
		log.Printf("No .env at %s, trying fallback location...", envPath)
		// If not found in current directory, try config folder
		fallbackPath, err := constants.GetEnvPath()
		if err != nil {
			log.Printf("Could not determine config directory: %v", err)
		} else {
			log.Printf("Checking for .env at: %s", fallbackPath)

			// Check if file exists
			if _, err := os.Stat(fallbackPath); err == nil {
				log.Printf("File exists at %s, attempting to load...", fallbackPath)
				if err := godotenv.Load(fallbackPath); err != nil {
					log.Printf("ERROR loading .env from %s: %v", fallbackPath, err)
				} else {
					log.Printf("Successfully loaded .env file from %s", fallbackPath)
				}
			} else {
				log.Printf("No .env file found at %s or %s (this is okay if not needed)", envPath, fallbackPath)
			}
		}
	} else {
		log.Printf("Loaded .env file from %s", envPath)
	}

	// Create an instance of the app structure
	app := NewApp()

	// Load settings to get window position
	settingsMgr, _ := settings.NewManager()
	savedSettings := settingsMgr.Get()

	// Use defaults if values are zero
	width := savedSettings.Window.Width
	if width <= 0 {
		width = 1024
	}
	height := savedSettings.Window.Height
	if height <= 0 {
		height = 768
	}
	x := savedSettings.Window.X
	if x <= 0 {
		x = 100
	}
	y := savedSettings.Window.Y
	if y <= 0 {
		y = 100
	}

	// Create application with options
	err := wails.Run(&options.App{
		Width:       width,
		Height:      height,
		StartHidden: true,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		Bind: []interface{}{
			app,
		},
		LogLevel: logger.DEBUG,
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
