package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/TrueBlocks/trueblocks-poetry/backend/components"
	"github.com/TrueBlocks/trueblocks-poetry/backend/database"
	"github.com/TrueBlocks/trueblocks-poetry/backend/seeding"
	"github.com/TrueBlocks/trueblocks-poetry/backend/services"
	"github.com/TrueBlocks/trueblocks-poetry/backend/settings"
	"github.com/TrueBlocks/trueblocks-poetry/pkg/constants"
	"github.com/TrueBlocks/trueblocks-poetry/pkg/parser"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx          context.Context
	db           *database.DB
	settings     *settings.Manager
	adhoc        *components.AdHocQueryComponent
	ttsService   *services.TTSService
	imageService *services.ImageService
	itemService  *services.ItemService
}

// LinkOrTagResult is the return type for CreateLinkOrRemoveTags
// Deprecated: Use services.LinkOrTagResult instead
type LinkOrTagResult = services.LinkOrTagResult

// TTSResult is the return type for SpeakWord
// Deprecated: Use services.TTSResult instead
type TTSResult = services.TTSResult

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Initialize settings first so we can get the dataFolder
	settingsMgr, err := settings.NewManager()
	if err != nil {
		slog.Error("Failed to initialize settings", "error", err)
		os.Exit(1)
	}
	a.settings = settingsMgr

	// Set window position from saved settings
	savedSettings := a.settings.Get()
	runtime.WindowSetPosition(ctx, savedSettings.Window.X, savedSettings.Window.Y)
	slog.Info("Set window position", "x", savedSettings.Window.X, "y", savedSettings.Window.Y)

	// Show window after positioning
	runtime.WindowShow(ctx)

	// Determine database path from constants
	dbPath, err := constants.GetDatabasePath()
	if err != nil {
		slog.Error("Failed to get database path", "error", err)
		os.Exit(1)
	}

	slog.Info("Database path", "path", dbPath)

	// Ensure data is seeded before opening database
	if err := seeding.EnsureDataSeeded(filepath.Dir(dbPath)); err != nil {
		slog.Warn("Failed to seed data", "error", err)
	}

	// Initialize database
	db, err := database.NewDB(dbPath)
	if err != nil {
		slog.Error("Failed to initialize database", "error", err)
		os.Exit(1)
	}
	a.db = db
	a.adhoc = components.NewAdHocQueryComponent(db)
	a.ttsService = services.NewTTSService(db)
	a.imageService = services.NewImageService(db)
	a.itemService = services.NewItemService(db, a.imageService)

	// Run one-time data migrations
	if err := a.runMigration1(); err != nil {
		slog.Warn("Migration 1 failed", "error", err)
	}

	// Sync file flags on startup
	if err := db.SyncFileFlags(); err != nil {
		slog.Warn("Failed to sync file flags", "error", err)
	}
}

// Capabilities defines what features are available based on configuration
type Capabilities struct {
	HasTTS    bool `json:"hasTts"`
	HasImages bool `json:"hasImages"`
	HasAI     bool `json:"hasAi"`
}

// GetCapabilities returns the available features of the application
func (a *App) GetCapabilities() *Capabilities {
	return &Capabilities{
		HasTTS:    os.Getenv("OPENAI_API_KEY") != "",
		HasImages: true, // Always available
		HasAI:     os.Getenv("OPENAI_API_KEY") != "",
	}
}

// RunAdHocQuery executes a raw SQL query
func (a *App) RunAdHocQuery(query string) ([]map[string]interface{}, error) {
	return a.adhoc.RunAdHocQuery(query)
}

// GetConstants returns shared constants to the frontend
func (a *App) GetConstants() map[string]string {
	return map[string]string{
		"ReferenceTagPattern": parser.ReferenceTagPattern,
		"GenericTagPattern":   parser.GenericTagPattern,
	}
}

// GetReferencePattern returns the regex pattern for reference tags
func (a *App) GetReferencePattern() string {
	return parser.GetReferencePattern()
}

// shutdown is called at application termination
func (a *App) shutdown(ctx context.Context) {
	// Close database connection and checkpoint WAL
	if a.db != nil {
		if err := a.db.Close(); err != nil {
			slog.Error("Failed to close database during shutdown", "error", err)
		}
	}
}

// SaveItemImage saves an image for an item to the cache
func (a *App) SaveItemImage(itemId int, imageData string) error {
	return a.imageService.SaveItemImage(itemId, imageData)
}

// GetItemImage retrieves an image for an item from the cache
func (a *App) GetItemImage(itemId int) (string, error) {
	return a.imageService.GetItemImage(itemId)
}

// DeleteItemImage removes an image for an item from the cache
func (a *App) DeleteItemImage(itemId int) error {
	return a.imageService.DeleteItemImage(itemId)
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}
