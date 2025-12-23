package main

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"github.com/TrueBlocks/trueblocks-poetry/backend/database"
	"github.com/TrueBlocks/trueblocks-poetry/pkg/constants"
)

func (a *App) runMigration1() error {
	// Check if migration already ran
	if value, _ := a.db.GetSetting("migration_1"); value == "true" {
		slog.Info("Migration 1 already completed, skipping")
		return nil
	}

	slog.Info("Starting migration 1: normalizing all items")

	// Get all items
	items, err := a.db.GetAllItems()
	if err != nil {
		return fmt.Errorf("failed to get items for migration: %w", err)
	}

	slog.Info("Migration 1: processing items", "count", len(items))

	// Get TTS cache directory for cleanup
	cacheDir, err := constants.GetTTSCacheDir()
	if err != nil {
		slog.Warn("Migration 1: failed to get TTS cache dir", "error", err)
	}

	// Normalize each item
	for i, item := range items {
		if err := a.db.UpdateItem(item); err != nil {
			slog.Warn("Migration 1: failed to update item", "itemId", item.ItemID, "word", item.Word, "error", err)
			continue
		}

		// Delete TTS cache for this item (same as UpdateItem service does)
		if cacheDir != "" {
			cacheFile := fmt.Sprintf("%s/%d.mp3", cacheDir, item.ItemID)
			if err := os.Remove(cacheFile); err != nil && !os.IsNotExist(err) {
				slog.Warn("Migration 1: failed to delete TTS cache", "itemId", item.ItemID, "error", err)
			}
		}

		// Log progress every 100 items
		if (i+1)%100 == 0 {
			slog.Info("Migration 1: progress", "processed", i+1, "total", len(items))
		}
	}

	// Mark migration as complete
	if err := a.db.SetSetting("migration_1", "true"); err != nil {
		return fmt.Errorf("failed to save migration_1 setting: %w", err)
	}

	slog.Info("Migration 1: completed successfully", "items_processed", len(items))
	return nil
}

// CheckpointDatabase flushes WAL to main database file
func (a *App) CheckpointDatabase() error {
	slog.Info("[App] Checkpointing database WAL")
	return a.db.Checkpoint()
}

// CleanOrphanedLinks removes links pointing to non-existent items
func (a *App) CleanOrphanedLinks() (int, error) {
	slog.Info("[App] Cleaning orphaned links")
	return a.db.CleanOrphanedLinks()
}

// GetDanglingLinks returns links that point to non-existent items
func (a *App) GetDanglingLinks() ([]map[string]interface{}, error) {
	query := database.MustLoadQuery("dangling_links")

	rows, err := a.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get dangling links: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var results []map[string]interface{}
	for rows.Next() {
		var linkID, sourceItemID, destinationItemID int
		var linkType, sourceWord, sourceType, missingSide string
		var sourceWordPtr, sourceTypePtr *string

		err := rows.Scan(&linkID, &sourceItemID, &destinationItemID, &linkType, &sourceWordPtr, &sourceTypePtr, &missingSide)
		if err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		if sourceWordPtr != nil {
			sourceWord = *sourceWordPtr
		}
		if sourceTypePtr != nil {
			sourceType = *sourceTypePtr
		}

		results = append(results, map[string]interface{}{
			"linkId":            linkID,
			"sourceItemId":      sourceItemID,
			"destinationItemId": destinationItemID,
			"linkType":          linkType,
			"sourceWord":        sourceWord,
			"sourceType":        sourceType,
			"missingSide":       missingSide,
		})
	}

	return results, nil
}

// GetStats returns statistics about the database
func (a *App) GetStats() (map[string]int, error) {
	return a.db.GetStats()
}

// GetDatabaseFileSize returns the size of the database file in bytes
func (a *App) GetDatabaseFileSize() (int64, error) {
	dbPath, err := constants.GetDatabasePath()
	if err != nil {
		return 0, fmt.Errorf("failed to get database path: %w", err)
	}

	fileInfo, err := os.Stat(dbPath)
	if err != nil {
		return 0, fmt.Errorf("failed to get file info: %w", err)
	}

	return fileInfo.Size(), nil
}

// SearchItems performs full-text search on items
func (a *App) GetRecentItems(limit int) ([]database.Item, error) {
	return a.db.GetRecentItems(limit)
}

// GetExtendedStats returns detailed database statistics
func (a *App) GetExtendedStats() (*database.DashboardStats, error) {
	return a.db.GetExtendedStats()
}

// GetTopHubs returns items with the most connections
func (a *App) GetTopHubs(limit int) ([]database.HubItem, error) {
	return a.db.GetTopHubs(limit)
}

// GetMarkedItems returns items that have a mark
func (a *App) GetMarkedItems() ([]database.Item, error) {
	return a.db.GetMarkedItems()
}

// GetNavigationHistory returns the list of recently visited items
func (a *App) GetNavigationHistory() ([]database.Item, error) {
	historyIDs := a.settings.GetNavigationHistory()
	var items []database.Item

	for _, id := range historyIDs {
		item, err := a.db.GetItem(id)
		if err != nil {
			slog.Warn("[GetNavigationHistory] Failed to get item", "id", id, "error", err)
			continue
		}
		if item != nil {
			items = append(items, *item)
		}
	}

	return items, nil
}

// GetAllItems gets all items for export
func (a *App) GetAllItems() ([]database.Item, error) {
	return a.db.GetAllItems()
}

// GetAllLinks gets all links for export
func (a *App) GetAllLinks() ([]database.Link, error) {
	return a.db.GetAllLinks()
}

// GetEgoGraph gets the ego graph for a given node
func (a *App) GetEgoGraph(centerNodeID int, depth int) (*database.GraphData, error) {
	return a.db.GetEgoGraph(centerNodeID, depth)
}

// GetEnvVars returns all environment variables from .env file
func (a *App) GetEnvVars() map[string]string {
	envVars := make(map[string]string)

	// Try to read from current directory first, then fallback to ~/.poetry-app
	cwd, err := os.Getwd()
	if err != nil {
		slog.Error("Failed to get working directory", "error", err)
		return envVars
	}

	envPath := cwd + "/.env"
	data, err := os.ReadFile(envPath)
	if err != nil {
		// Try fallback location
		fallbackPath, err := constants.GetEnvPath()
		if err == nil {
			data, err = os.ReadFile(fallbackPath)
			if err != nil {
				slog.Info("No .env file found", "path1", envPath, "path2", fallbackPath)
				return envVars
			}
			// envPath = fallbackPath
		} else {
			slog.Info("No .env file found", "path", envPath)
			return envVars
		}
	}

	// Sensitive key patterns to filter out
	sensitivePatterns := []string{
		"KEY", "SECRET", "TOKEN", "PASSWORD", "PASS", "AUTH", "CREDENTIAL",
	}

	// Parse .env file
	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		// Skip empty lines and comments
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		// Split on first = sign
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			key := strings.TrimSpace(parts[0])
			value := strings.TrimSpace(parts[1])

			// Check if key contains sensitive patterns
			keyUpper := strings.ToUpper(key)
			isSensitive := false
			for _, pattern := range sensitivePatterns {
				if strings.Contains(keyUpper, pattern) {
					isSensitive = true
					break
				}
			}

			// Only include non-sensitive values, mask sensitive ones
			if isSensitive {
				if value != "" {
					envVars[key] = "***REDACTED***"
				}
			} else {
				// Remove quotes if present
				value = strings.Trim(value, "\"'")
				envVars[key] = value
			}
		}
	}

	return envVars
}

// SaveEnvVar saves an environment variable to the .env file
func (a *App) SaveEnvVar(key, value string) error {
	// Determine .env path (prioritize ~/.local/share/trueblocks/poetry/.env)
	envPath, err := constants.GetEnvPath()
	if err != nil {
		return fmt.Errorf("failed to get env path: %w", err)
	}

	// Read existing file
	content := ""
	if data, err := os.ReadFile(envPath); err == nil {
		content = string(data)
	}

	// Normalize content
	content = strings.TrimSpace(content)

	var lines []string
	if content != "" {
		lines = strings.Split(content, "\n")
	}

	found := false
	var newLines []string

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, key+"=") {
			newLines = append(newLines, fmt.Sprintf("%s=%s", key, value))
			found = true
		} else {
			newLines = append(newLines, line)
		}
	}

	if !found {
		newLines = append(newLines, fmt.Sprintf("%s=%s", key, value))
	}

	// Write back to file
	output := strings.Join(newLines, "\n") + "\n"
	// Ensure directory exists
	dir := filepath.Dir(envPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	if err := os.WriteFile(envPath, []byte(output), 0600); err != nil {
		return fmt.Errorf("failed to write .env file: %w", err)
	}

	// Update in-memory environment variable so changes take effect immediately
	if err := os.Setenv(key, value); err != nil {
		slog.Warn("Failed to update in-memory environment variable", "error", err)
	}

	return nil
}

// HasEnvFile checks if the .env file exists
func (a *App) HasEnvFile() bool {
	envPath, err := constants.GetEnvPath()
	if err != nil {
		return false
	}
	_, err = os.Stat(envPath)
	return err == nil
}

// SkipAiSetup creates the .env file with a marker if it doesn't exist
func (a *App) SkipAiSetup() error {
	envPath, err := constants.GetEnvPath()
	if err != nil {
		return fmt.Errorf("failed to get env path: %w", err)
	}

	// Check if file already exists
	if _, err := os.Stat(envPath); err == nil {
		return nil
	}

	// Ensure directory exists
	dir := filepath.Dir(envPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// Create file with a comment
	content := "# AI Setup Skipped\n"
	if err := os.WriteFile(envPath, []byte(content), 0600); err != nil {
		return fmt.Errorf("failed to write .env file: %w", err)
	}

	return nil
}

// GetEnvLocation returns the path to the .env file being used
func (a *App) GetEnvLocation() string {
	cwd, err := os.Getwd()
	if err != nil {
		return "Unknown (failed to get working directory)"
	}

	envPath := cwd + "/.env"
	if _, err := os.Stat(envPath); err == nil {
		return envPath
	}

	// Check fallback location
	fallbackPath, err := constants.GetEnvPath()
	if err == nil {
		if _, err := os.Stat(fallbackPath); err == nil {
			return fallbackPath
		}
	}

	return "No .env file found"
}

// SpeakWord uses OpenAI's text-to-speech API to pronounce text with gender-matched voices and caching
func (a *App) SpeakWord(text string, itemType string, itemWord string, itemID int) TTSResult {
	return a.ttsService.SpeakWord(text, itemType, itemWord, itemID)
}
