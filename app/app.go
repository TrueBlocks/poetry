package app

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/TrueBlocks/trueblocks-poetry/v2/internal/components"
	"github.com/TrueBlocks/trueblocks-poetry/v2/internal/db"
	"github.com/TrueBlocks/trueblocks-poetry/v2/internal/seeding"
	"github.com/TrueBlocks/trueblocks-poetry/v2/internal/services"
	"github.com/TrueBlocks/trueblocks-poetry/v2/internal/settings"
	"github.com/TrueBlocks/trueblocks-poetry/v2/pkg/constants"
	applogger "github.com/TrueBlocks/trueblocks-poetry/v2/pkg/logger"
	"github.com/TrueBlocks/trueblocks-poetry/v2/pkg/parser"

	appkit "github.com/TrueBlocks/trueblocks-art/packages/appkit/v2"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx           context.Context
	db            *db.DB
	settings      *settings.Manager
	adhoc         *components.AdHocQueryComponent
	ttsService    *services.TTSService
	imageService  *services.ImageService
	entityService *services.EntityService
}

type TTSResult = services.TTSResult

func NewApp() *App {
	return &App{
		ttsService:    &services.TTSService{},
		imageService:  &services.ImageService{},
		entityService: &services.EntityService{},
	}
}

func (a *App) TTSService() *services.TTSService       { return a.ttsService }
func (a *App) ImageService() *services.ImageService    { return a.imageService }
func (a *App) EntityService() *services.EntityService  { return a.entityService }

func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx

	if err := applogger.InitLogger(); err != nil {
		println("Failed to initialize logger:", err.Error())
	}

	a.loadEnvFile()

	settingsMgr, err := settings.NewManager()
	if err != nil {
		slog.Error("Failed to initialize settings", "error", err)
		return
	}
	a.settings = settingsMgr

	dbPath, err := constants.GetDatabasePath()
	if err != nil {
		slog.Error("Failed to get database path", "error", err)
		return
	}

	slog.Info("Database path", "path", dbPath)

	bm := appkit.NewBackupManager(dbPath, filepath.Join(appkit.BackupDirFor("poetry"), "backups"), "poetry")
	if _, err := bm.AutoBackup(); err != nil {
		slog.Warn("Auto-backup failed", "error", err)
	}

	if err := seeding.EnsureDataSeeded(filepath.Dir(dbPath)); err != nil {
		slog.Warn("Failed to seed data", "error", err)
	}

	database, err := db.NewDB(dbPath)
	if err != nil {
		slog.Error("Failed to initialize database", "error", err)
		return
	}
	a.db = database

	a.adhoc = components.NewAdHocQueryComponent(database)
	a.ttsService.SetDB(database)
	a.imageService.SetDB(database)
	a.entityService.SetDB(database)

	savedSettings := settingsMgr.Get()
	runtime.WindowSetPosition(ctx, savedSettings.Window.X, savedSettings.Window.Y)
	slog.Info("Set window position", "x", savedSettings.Window.X, "y", savedSettings.Window.Y)

	runtime.WindowShow(ctx)

	if err := a.db.SyncFileFlags(); err != nil {
		slog.Warn("Failed to sync file flags", "error", err)
	}
}

func (a *App) GetWindowGeometry() (x, y, width, height int) {
	if a.settings == nil {
		return 0, 0, 1024, 768
	}
	s := a.settings.Get()
	w := s.Window.Width
	if w <= 0 {
		w = 1024
	}
	h := s.Window.Height
	if h <= 0 {
		h = 768
	}
	return s.Window.X, s.Window.Y, w, h
}

type Capabilities struct {
	HasTTS    bool `json:"hasTts"`
	HasImages bool `json:"hasImages"`
	HasAI     bool `json:"hasAi"`
}

func (a *App) GetCapabilities() *Capabilities {
	return &Capabilities{
		HasTTS:    os.Getenv("OPENAI_API_KEY") != "",
		HasImages: true,
		HasAI:     os.Getenv("OPENAI_API_KEY") != "",
	}
}

func (a *App) RunAdHocQuery(query string) ([]map[string]interface{}, error) {
	return a.adhoc.RunAdHocQuery(query)
}

func (a *App) GetConstants() map[string]string {
	return map[string]string{
		"ReferenceTagPattern": parser.ReferenceTagPattern,
		"GenericTagPattern":   parser.GenericTagPattern,
	}
}

func (a *App) GetReferencePattern() string {
	return parser.GetReferencePattern()
}

func (a *App) Shutdown(ctx context.Context) {
	if a.db != nil {
		if err := a.db.Close(); err != nil {
			slog.Error("Failed to close database during shutdown", "error", err)
		}
	}
}

func (a *App) SaveEntityImage(entityId int, imageData string) error {
	return a.imageService.SaveEntityImage(entityId, imageData)
}

func (a *App) GetEntityImage(entityId int) (string, error) {
	return a.imageService.GetEntityImage(entityId)
}

func (a *App) DeleteEntityImage(entityId int) error {
	return a.imageService.DeleteEntityImage(entityId)
}

func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}
