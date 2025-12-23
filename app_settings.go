package main

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"github.com/TrueBlocks/trueblocks-poetry/backend/settings"
	"github.com/TrueBlocks/trueblocks-poetry/pkg/constants"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) GetSettings() *settings.Settings {
	return a.settings.Get()
}

// GetDatabasePath returns the current database path
func (a *App) GetDatabasePath() (string, error) {
	return constants.GetDatabasePath()
}

// UpdateSettings updates all settings
func (a *App) UpdateSettings(s settings.Settings) error {
	return a.settings.Update(s)
}

// SaveWindowPosition saves window position immediately
func (a *App) SaveWindowPosition(x, y, width, height int) error {
	return a.settings.UpdateWindowPosition(x, y, width, height)
}

// SaveLeftbarWidth saves leftbar width immediately
func (a *App) SaveLeftbarWidth(width int) error {
	return a.settings.UpdateLeftbarWidth(width)
}

// SaveTabSelection saves the selected tab for a view
func (a *App) SaveTabSelection(viewID, tabID string) error {
	return a.settings.UpdateTabSelection(viewID, tabID)
}

// SaveTableSort saves table sorting state immediately
func (a *App) SaveTableSort(tableName, field1, dir1, field2, dir2 string) error {
	return a.settings.UpdateTableSort(tableName, field1, dir1, field2, dir2)
}

// SaveCurrentSearch saves the current table search query immediately
func (a *App) SaveCurrentSearch(query string) error {
	return a.settings.UpdateCurrentSearch(query)
}

// SaveLastWord saves last viewed word immediately
func (a *App) SaveLastWord(wordID int) error {
	// slog.Info("[SaveLastWord] Saving last word ID", "id", wordID)
	err := a.settings.UpdateLastWord(wordID)
	if err != nil {
		slog.Error("[SaveLastWord] ERROR", "error", err)
	}
	return err
}

// SaveLastView saves last viewed page immediately
func (a *App) SaveLastView(view string) error {
	slog.Info("[SaveLastView] Saving last view", "view", view)
	err := a.settings.UpdateLastView(view)
	if err != nil {
		slog.Error("[SaveLastView] ERROR", "error", err)
	}
	return err
}

// SaveRevealMarkdown saves reveal markdown mode immediately
func (a *App) SaveRevealMarkdown(reveal bool) error {
	slog.Info("[SaveRevealMarkdown] Saving reveal markdown", "reveal", reveal)
	err := a.settings.UpdateRevealMarkdown(reveal)
	if err != nil {
		slog.Error("[SaveRevealMarkdown] ERROR", "error", err)
	}
	return err
}

// SaveOutgoingCollapsed saves outgoing collapsed state immediately
func (a *App) SaveOutgoingCollapsed(collapsed bool) error {
	slog.Info("[SaveOutgoingCollapsed] Saving outgoing collapsed", "collapsed", collapsed)
	err := a.settings.UpdateOutgoingCollapsed(collapsed)
	if err != nil {
		slog.Error("[SaveOutgoingCollapsed] ERROR", "error", err)
	}
	return err
}

// SaveIncomingCollapsed saves incoming collapsed state immediately
func (a *App) SaveIncomingCollapsed(collapsed bool) error {
	slog.Info("[SaveIncomingCollapsed] Saving incoming collapsed", "collapsed", collapsed)
	err := a.settings.UpdateIncomingCollapsed(collapsed)
	if err != nil {
		slog.Error("[SaveIncomingCollapsed] ERROR", "error", err)
	}
	return err
}

// SaveReportLinkIntegrityCollapsed saves report collapsed state
func (a *App) SaveReportLinkIntegrityCollapsed(collapsed bool) error {
	return a.settings.UpdateReportLinkIntegrityCollapsed(collapsed)
}

// SaveReportItemHealthCollapsed saves report collapsed state
func (a *App) SaveReportItemHealthCollapsed(collapsed bool) error {
	return a.settings.UpdateReportItemHealthCollapsed(collapsed)
}

// TTSCacheInfo contains information about the TTS cache
type TTSCacheInfo struct {
	FileCount int   `json:"fileCount"`
	TotalSize int64 `json:"totalSize"`
}

// ImageCacheInfo contains information about the image cache
type ImageCacheInfo struct {
	FileCount int   `json:"fileCount"`
	TotalSize int64 `json:"totalSize"`
}

// GetTTSCacheInfo returns information about the TTS cache directory
func (a *App) GetTTSCacheInfo() (*TTSCacheInfo, error) {
	cacheDir, err := constants.GetTTSCacheDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get TTS cache directory: %w", err)
	}

	// Check if directory exists
	if _, err := os.Stat(cacheDir); os.IsNotExist(err) {
		return &TTSCacheInfo{FileCount: 0, TotalSize: 0}, nil
	}

	var fileCount int
	var totalSize int64

	// Walk through the directory
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

// GetImageCacheInfo returns information about the image cache directory
func (a *App) GetImageCacheInfo() (*ImageCacheInfo, error) {
	cacheDir, err := constants.GetImagesDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get images directory: %w", err)
	}

	// Check if directory exists
	if _, err := os.Stat(cacheDir); os.IsNotExist(err) {
		return &ImageCacheInfo{FileCount: 0, TotalSize: 0}, nil
	}

	var fileCount int
	var totalSize int64

	// Walk through the directory
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

// SelectExportFolder opens a directory selection dialog and saves the chosen folder
func (a *App) SelectExportFolder() (string, error) {
	// Open directory selection dialog
	folder, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Export Folder",
	})

	if err != nil {
		return "", err
	}

	// If user cancelled, return empty string
	if folder == "" {
		return "", nil
	}

	// If the selected folder is not already named "exports",
	// append "exports" to keep the files organized in a subdirectory.
	base := filepath.Base(folder)
	if !strings.EqualFold(base, "exports") {
		folder = filepath.Join(folder, "exports")
	}

	// Save the selected folder
	if err := a.settings.UpdateExportFolder(folder); err != nil {
		return "", fmt.Errorf("failed to save export folder: %w", err)
	}

	return folder, nil
}

// GetRecentSearches returns the list of recent searches
func (a *App) GetRecentSearches() []string {
	return a.settings.GetRecentSearches()
}

// AddRecentSearch adds a search term to recent searches
func (a *App) AddRecentSearch(term string) error {
	return a.settings.AddRecentSearch(term)
}

// RemoveRecentSearch removes a search term from recent searches
func (a *App) RemoveRecentSearch(term string) error {
	return a.settings.RemoveRecentSearch(term)
}

// GetSavedSearches returns the list of saved searches
func (a *App) GetSavedSearches() []settings.SavedSearch {
	return a.settings.GetSavedSearches()
}

// SaveSearch saves a named search query
func (a *App) SaveSearch(name, query string, types []string, source string) error {
	return a.settings.AddSavedSearch(name, query, types, source)
}

// DeleteSavedSearch deletes a saved search by name
func (a *App) DeleteSavedSearch(name string) error {
	return a.settings.DeleteSavedSearch(name)
}

// GetAllSettings returns all settings as a map for display
func (a *App) GetAllSettings() map[string]interface{} {
	s := a.settings.Get()
	return map[string]interface{}{
		"window":         s.Window,
		"exportFolder":   s.ExportFolder,
		"lastWordId":     s.LastWordID,
		"lastView":       s.LastView,
		"revealMarkdown": s.RevealMarkdown,
		"collapsed":      s.Collapsed,
	}
}
