package app

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"github.com/TrueBlocks/trueblocks-poetry/v2/internal/settings"
	"github.com/TrueBlocks/trueblocks-poetry/v2/pkg/constants"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) GetSettings() *settings.Settings {
	return a.settings.Get()
}

func (a *App) GetDatabasePath() (string, error) {
	return constants.GetDatabasePath()
}

func (a *App) UpdateSettings(s settings.Settings) error {
	return a.settings.Update(s)
}

// SaveWindowGeometry is part of the standard cross-app navigation surface
// (see ai/Architecture.md §7); the shared useWindowGeometry hook calls it.
func (a *App) SaveWindowGeometry(x, y, width, height int) {
	_ = a.settings.UpdateWindowPosition(x, y, width, height)
}

func (a *App) SaveLeftbarWidth(width int) error {
	return a.settings.UpdateLeftbarWidth(width)
}

func (a *App) SaveTabSelection(viewID, tabID string) error {
	return a.settings.UpdateTabSelection(viewID, tabID)
}

// GetTab, SetTab, GetLastRoute, and SetLastRoute are the standard
// cross-app navigation persistence surface (see ai/Architecture.md §7).
// They delegate to the poetry-specific settings manager.
func (a *App) GetTab(viewID string) string {
	return a.settings.Get().TabSelections[viewID]
}

func (a *App) SetTab(viewID string, tabID string) error {
	return a.settings.UpdateTabSelection(viewID, tabID)
}

func (a *App) GetLastRoute() string {
	return a.settings.Get().LastView
}

func (a *App) SetLastRoute(route string) error {
	return a.settings.UpdateLastView(route)
}

func (a *App) SaveTableSort(tableName, field1, dir1, field2, dir2 string) error {
	return a.settings.UpdateTableSort(tableName, field1, dir1, field2, dir2)
}

func (a *App) SaveCurrentSearch(query string) error {
	return a.settings.UpdateCurrentSearch(query)
}

func (a *App) SaveLastWord(wordID int) error {
	err := a.settings.UpdateLastWord(wordID)
	if err != nil {
		slog.Error("[SaveLastWord] ERROR", "error", err)
	}
	return err
}

func (a *App) SaveLastView(view string) error {
	slog.Info("[SaveLastView] Saving last view", "view", view)
	err := a.settings.UpdateLastView(view)
	if err != nil {
		slog.Error("[SaveLastView] ERROR", "error", err)
	}
	return err
}

func (a *App) SaveRevealMarkdown(reveal bool) error {
	slog.Info("[SaveRevealMarkdown] Saving reveal markdown", "reveal", reveal)
	err := a.settings.UpdateRevealMarkdown(reveal)
	if err != nil {
		slog.Error("[SaveRevealMarkdown] ERROR", "error", err)
	}
	return err
}

func (a *App) SaveOutgoingCollapsed(collapsed bool) error {
	slog.Info("[SaveOutgoingCollapsed] Saving outgoing collapsed", "collapsed", collapsed)
	err := a.settings.UpdateOutgoingCollapsed(collapsed)
	if err != nil {
		slog.Error("[SaveOutgoingCollapsed] ERROR", "error", err)
	}
	return err
}

func (a *App) SaveIncomingCollapsed(collapsed bool) error {
	slog.Info("[SaveIncomingCollapsed] Saving incoming collapsed", "collapsed", collapsed)
	err := a.settings.UpdateIncomingCollapsed(collapsed)
	if err != nil {
		slog.Error("[SaveIncomingCollapsed] ERROR", "error", err)
	}
	return err
}

func (a *App) SaveReportLinkIntegrityCollapsed(collapsed bool) error {
	return a.settings.UpdateReportLinkIntegrityCollapsed(collapsed)
}

func (a *App) SaveReportItemHealthCollapsed(collapsed bool) error {
	return a.settings.UpdateReportItemHealthCollapsed(collapsed)
}

type TTSCacheInfo struct {
	FileCount int   `json:"fileCount"`
	TotalSize int64 `json:"totalSize"`
}

type ImageCacheInfo struct {
	FileCount int   `json:"fileCount"`
	TotalSize int64 `json:"totalSize"`
}

func (a *App) GetTTSCacheInfo() (*TTSCacheInfo, error) {
	cacheDir, err := constants.GetTTSCacheDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get TTS cache directory: %w", err)
	}

	if _, err := os.Stat(cacheDir); os.IsNotExist(err) {
		return &TTSCacheInfo{FileCount: 0, TotalSize: 0}, nil
	}

	var fileCount int
	var totalSize int64

	err = filepath.Walk(cacheDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			fileCount++
			totalSize += info.Size()
		}
		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to walk cache directory: %w", err)
	}

	return &TTSCacheInfo{
		FileCount: fileCount,
		TotalSize: totalSize,
	}, nil
}

func (a *App) GetImageCacheInfo() (*ImageCacheInfo, error) {
	cacheDir, err := constants.GetImagesDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get images directory: %w", err)
	}

	if _, err := os.Stat(cacheDir); os.IsNotExist(err) {
		return &ImageCacheInfo{FileCount: 0, TotalSize: 0}, nil
	}

	var fileCount int
	var totalSize int64

	err = filepath.Walk(cacheDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			fileCount++
			totalSize += info.Size()
		}
		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to walk cache directory: %w", err)
	}

	return &ImageCacheInfo{
		FileCount: fileCount,
		TotalSize: totalSize,
	}, nil
}

func (a *App) SelectExportFolder() (string, error) {
	folder, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Export Folder",
	})

	if err != nil {
		return "", err
	}

	if folder == "" {
		return "", nil
	}

	base := filepath.Base(folder)
	if !strings.EqualFold(base, "exports") {
		folder = filepath.Join(folder, "exports")
	}

	if err := a.settings.UpdateExportFolder(folder); err != nil {
		return "", fmt.Errorf("failed to save export folder: %w", err)
	}

	return folder, nil
}

func (a *App) GetRecentSearches() []string {
	return a.settings.GetRecentSearches()
}

func (a *App) AddRecentSearch(term string) error {
	return a.settings.AddRecentSearch(term)
}

func (a *App) RemoveRecentSearch(term string) error {
	return a.settings.RemoveRecentSearch(term)
}

func (a *App) GetSavedSearches() []settings.SavedSearch {
	return a.settings.GetSavedSearches()
}

func (a *App) SaveSearch(name, query string, types []string, source string) error {
	return a.settings.AddSavedSearch(name, query, types, source)
}

func (a *App) DeleteSavedSearch(name string) error {
	return a.settings.DeleteSavedSearch(name)
}

func (a *App) GetAllSettings() map[string]any {
	s := a.settings.Get()
	return map[string]any{
		"window":         s.Window,
		"exportFolder":   s.ExportFolder,
		"lastWordId":     s.LastWordID,
		"lastView":       s.LastView,
		"revealMarkdown": s.RevealMarkdown,
		"collapsed":      s.Collapsed,
	}
}
