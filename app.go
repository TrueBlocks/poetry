package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/TrueBlocks/trueblocks-poetry/backend/components"
	"github.com/TrueBlocks/trueblocks-poetry/backend/database"
	"github.com/TrueBlocks/trueblocks-poetry/backend/seeding"
	"github.com/TrueBlocks/trueblocks-poetry/backend/settings"
	"github.com/TrueBlocks/trueblocks-poetry/pkg/constants"
	"github.com/TrueBlocks/trueblocks-poetry/pkg/parser"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx      context.Context
	db       *database.DB
	settings *settings.Manager
	adhoc    *components.AdHocQueryComponent
}

// LinkOrTagResult is the return type for CreateLinkOrRemoveTags
type LinkOrTagResult struct {
	LinkCreated bool   `json:"linkCreated"`
	Message     string `json:"message"`
}

// TTSResult is the return type for SpeakWord
type TTSResult struct {
	AudioData []byte `json:"audioData"`
	Cached    bool   `json:"cached"`
	Error     string `json:"error"`
	ErrorType string `json:"errorType"` // "missing_key", "network", "api", "unknown"
}

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

// domReady is called after front-end resources have been loaded
// func (a *App) domReady(ctx context.Context) {
// 	// Add your action here
// }

// shutdown is called at application termination
func (a *App) shutdown(ctx context.Context) {
	// Close database connection and checkpoint WAL
	if a.db != nil {
		_ = a.db.Close()
	}
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
	query := `
		SELECT 
			l.link_id,
			l.source_item_id,
			l.destination_item_id,
			l.link_type,
			i.word as source_word,
			i.type as source_type,
			CASE 
				WHEN dest.item_id IS NULL THEN 'destination'
				ELSE 'source'
			END as missing_side
		FROM links l
		LEFT JOIN items i ON l.source_item_id = i.item_id
		LEFT JOIN items dest ON l.destination_item_id = dest.item_id
		WHERE i.item_id IS NULL OR dest.item_id IS NULL
		ORDER BY i.word
	`

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
func (a *App) SearchItems(query string) ([]database.Item, error) {
	return a.db.SearchItems(query)
}

// SearchItemsWithOptions performs advanced search with filters
func (a *App) SearchItemsWithOptions(options database.SearchOptions) ([]database.Item, error) {
	items, err := a.db.SearchItemsWithOptions(options)
	if err != nil {
		return nil, err
	}

	// Post-filter based on HasImage and HasTts if either is enabled
	if !options.HasImage && !options.HasTts {
		return items, nil
	}

	var filtered []database.Item
	for _, item := range items {
		includeItem := true

		// Check HasImage filter
		if options.HasImage {
			imagesDir, _ := constants.GetImagesDir()
			imagePath := filepath.Join(imagesDir, fmt.Sprintf("%d.png", item.ItemID))
			if _, err := os.Stat(imagePath); os.IsNotExist(err) {
				includeItem = false
			}
		}

		// Check HasTts filter (only if still included after image check)
		if includeItem && options.HasTts {
			// TTS files are stored with hash of the word, not itemId
			// We need to check if any TTS file exists for this item's word
			cacheDir, _ := constants.GetTTSCacheDir()
			hash := fmt.Sprintf("%x", sha256.Sum256([]byte(item.Word)))
			ttsPath := filepath.Join(cacheDir, hash+".mp3")
			if _, err := os.Stat(ttsPath); os.IsNotExist(err) {
				includeItem = false
			}
		}

		if includeItem {
			filtered = append(filtered, item)
		}
	}

	return filtered, nil
}

// GetItem retrieves a single item by ID
func (a *App) GetItem(itemID int) (*database.Item, error) {
	// slog.Debug("[GetItem] Fetching item", "id", itemID)
	item, err := a.db.GetItem(itemID)
	if err != nil {
		slog.Error("[GetItem] ERROR fetching item", "id", itemID, "error", err)
		return nil, err
	}
	// slog.Debug("[GetItem] Successfully fetched item", "word", item.Word, "type", item.Type)
	return item, nil
}

// GetItemByWord retrieves a single item by word
func (a *App) GetItemByWord(word string) (*database.Item, error) {
	return a.db.GetItemByWord(word)
}

// GetRandomItem returns a random item
func (a *App) GetRandomItem() (*database.Item, error) {
	return a.db.GetRandomItem()
}

// GetPoetIds returns a list of item IDs for writers that have an image and at least one poem
func (a *App) GetPoetIds() ([]int, error) {
	return a.db.GetPoetIds()
}

// CreateLinkOrRemoveTags attempts to create a link to the referenced word.
// If the referenced word doesn't exist, it removes the reference tags from the source item's text fields.
func (a *App) CreateLinkOrRemoveTags(sourceItemID int, refWord string) (*LinkOrTagResult, error) {
	linkCreated, message, err := a.db.CreateLinkOrRemoveTags(sourceItemID, refWord)
	if err != nil {
		return nil, err
	}
	return &LinkOrTagResult{
		LinkCreated: linkCreated,
		Message:     message,
	}, nil
}

// CreateItem creates a new item
func (a *App) CreateItem(item database.Item) (int, error) {
	return a.db.CreateItem(item)
}

// UpdateItem updates an existing item
func (a *App) UpdateItem(item database.Item) error {
	// Delete TTS cache for this item
	cacheDir, err := constants.GetTTSCacheDir()
	if err == nil {
		cacheFile := fmt.Sprintf("%s/%d.mp3", cacheDir, item.ItemID)
		if err := os.Remove(cacheFile); err != nil && !os.IsNotExist(err) {
			slog.Warn("Failed to delete TTS cache", "id", item.ItemID, "error", err)
		}
	}

	return a.db.UpdateItem(item)
}

// ToggleItemMark toggles the mark field for an item
func (a *App) ToggleItemMark(itemID int, marked bool) error {
	return a.db.ToggleItemMark(itemID, marked)
}

// DeleteItem deletes an item
func (a *App) DeleteItem(itemID int) error {
	slog.Info("[App] DeleteItem called", "id", itemID)

	// Delete TTS cache for this item
	cacheDir, err := constants.GetTTSCacheDir()
	if err == nil {
		cacheFile := fmt.Sprintf("%s/%d.mp3", cacheDir, itemID)
		if err := os.Remove(cacheFile); err != nil && !os.IsNotExist(err) {
			slog.Warn("Failed to delete TTS cache", "id", itemID, "error", err)
		}
	}

	// Delete Image cache for this item
	if err := a.DeleteItemImage(itemID); err != nil {
		slog.Warn("Failed to delete image cache", "id", itemID, "error", err)
	}

	// Update settings: remove from history and update lastWordId if needed
	settings := a.settings.Get()

	// Remove from NavigationHistory
	if err := a.settings.RemoveFromHistory(itemID); err != nil {
		slog.Warn("Failed to remove item from history", "error", err)
	}

	// Check LastWordID
	if settings.LastWordID == itemID {
		if a.settings.GetHistoryLength() > 0 {
			settings.LastWordID = a.settings.GetHistoryItem(0)
		} else {
			settings.LastWordID = 0
		}
	}

	if err := a.settings.Save(); err != nil {
		slog.Warn("Failed to save settings after deleting item", "error", err)
	}

	err = a.db.DeleteItem(itemID)
	if err != nil {
		slog.Error("[App] DeleteItem failed", "error", err)
		return err
	}
	slog.Info("[App] DeleteItem succeeded", "id", itemID)
	return nil
}

// CreateLink creates a new link between items
func (a *App) CreateLink(sourceID, destID int, linkType string) error {
	return a.db.CreateLink(sourceID, destID, linkType)
}

// DeleteLink deletes a link
func (a *App) DeleteLink(linkID int) error {
	slog.Info("[App] DeleteLink called", "id", linkID)
	err := a.db.DeleteLink(linkID)
	if err != nil {
		slog.Error("[App] DeleteLink failed", "error", err)
		return err
	}
	slog.Info("[App] DeleteLink succeeded", "id", linkID)
	return nil
}

// DeleteLinkByItems deletes a link between two items
func (a *App) DeleteLinkByItems(sourceItemID, destinationItemID int) error {
	return a.db.DeleteLinkByItems(sourceItemID, destinationItemID)
}

// GetItemLinks gets all links for an item
func (a *App) GetItemLinks(itemID int) ([]database.Link, error) {
	return a.db.GetItemLinks(itemID)
}

// GetRecentItems gets recently modified items
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

// resolveTagsForMarkdown converts {x:value} tags to bold small caps in markdown
// Example: {word:shakespeare} becomes **<small>SHAKESPEARE</small>**
func resolveTagsForMarkdown(text string) string {
	return parser.ReplaceTags(text, func(ref parser.Reference) string {
		// Convert to uppercase for small caps effect and wrap in bold + small tag
		return fmt.Sprintf("**<small>%s</small>**", strings.ToUpper(ref.Value))
	})
}

// ExportToJSON exports all data to a JSON file and returns the full path
func (a *App) ExportToJSON() (string, error) {
	items, err := a.db.GetAllItems()
	if err != nil {
		return "", fmt.Errorf("failed to get items: %w", err)
	}

	links, err := a.db.GetAllLinks()
	if err != nil {
		return "", fmt.Errorf("failed to get links: %w", err)
	}

	// Separate items by type
	var references []database.Item
	var writers []database.Item
	var titles []database.Item
	var other []database.Item

	for _, item := range items {
		switch item.Type {
		case "Reference":
			references = append(references, item)
		case "Writer":
			writers = append(writers, item)
		case "Title":
			titles = append(titles, item)
		case "Other":
			other = append(other, item)
		}
	}

	// Sort each type alphabetically by Word
	sort.Slice(references, func(i, j int) bool {
		return strings.ToLower(references[i].Word) < strings.ToLower(references[j].Word)
	})
	sort.Slice(writers, func(i, j int) bool {
		return strings.ToLower(writers[i].Word) < strings.ToLower(writers[j].Word)
	})
	sort.Slice(titles, func(i, j int) bool {
		return strings.ToLower(titles[i].Word) < strings.ToLower(titles[j].Word)
	})
	sort.Slice(other, func(i, j int) bool {
		return strings.ToLower(other[i].Word) < strings.ToLower(other[j].Word)
	})

	// Get all reports
	unlinkedRefs, _ := a.GetUnlinkedReferences()
	duplicates, _ := a.GetDuplicateItems()
	orphanedItems, _ := a.GetOrphanedItems()
	linkedNotInDef, _ := a.GetLinkedItemsNotInDefinition()
	missingDefs, _ := a.GetItemsWithoutDefinitions()
	unknownTypes, _ := a.GetItemsWithUnknownTypes()
	unknownTags, _ := a.GetUnknownTags()

	// Get settings
	s := a.settings.Get()

	// Get database info
	dbPath, _ := constants.GetDatabasePath()
	exportFolder := s.ExportFolder

	data := map[string]interface{}{
		"metadata": map[string]interface{}{
			"version":        "1.0",
			"databasePath":   dbPath,
			"exportFolder":   exportFolder,
			"itemCount":      len(items),
			"referenceCount": len(references),
			"writerCount":    len(writers),
			"titleCount":     len(titles),
			"otherCount":     len(other),
			"linkCount":      len(links),
		},
		"references": references,
		"writers":    writers,
		"titles":     titles,
		"other":      other,
		"links":      links,
		"reports": map[string]interface{}{
			"unlinkedReferences":         unlinkedRefs,
			"duplicateItems":             duplicates,
			"orphanedItems":              orphanedItems,
			"linkedItemsNotInDefinition": linkedNotInDef,
			"itemsWithoutDefinitions":    missingDefs,
			"unknownTypes":               unknownTypes,
			"unknownTags":                unknownTags,
		},
	}

	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal JSON: %w", err)
	}

	// Get export path from settings or use default
	exportFolder = s.ExportFolder
	if exportFolder == "" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return "", fmt.Errorf("failed to get home directory: %w", err)
		}
		exportFolder = filepath.Join(homeDir, "Documents", "Poetry", "exports")
	}

	// Create export directory
	if err := os.MkdirAll(exportFolder, 0755); err != nil {
		return "", fmt.Errorf("failed to create export directory: %w", err)
	}

	// Create filename
	filename := "poetry-database.json"
	fullPath := filepath.Join(exportFolder, filename)

	err = os.WriteFile(fullPath, jsonData, 0644)
	if err != nil {
		return "", fmt.Errorf("failed to write file: %w", err)
	}

	return fullPath, nil
}

// ExportToMarkdown exports all items to a Markdown file and returns the full path
func (a *App) ExportToMarkdown() (string, error) {
	items, err := a.db.GetAllItems()
	if err != nil {
		return "", fmt.Errorf("failed to get items: %w", err)
	}

	// Separate items by type
	var references []database.Item
	var writers []database.Item
	var titles []database.Item
	var other []database.Item

	for _, item := range items {
		switch item.Type {
		case "Reference":
			references = append(references, item)
		case "Writer":
			writers = append(writers, item)
		case "Title":
			titles = append(titles, item)
		case "Other":
			other = append(other, item)
		}
	}

	// Sort each type alphabetically by Word
	sort.Slice(references, func(i, j int) bool {
		return strings.ToLower(references[i].Word) < strings.ToLower(references[j].Word)
	})
	sort.Slice(writers, func(i, j int) bool {
		return strings.ToLower(writers[i].Word) < strings.ToLower(writers[j].Word)
	})
	sort.Slice(titles, func(i, j int) bool {
		return strings.ToLower(titles[i].Word) < strings.ToLower(titles[j].Word)
	})
	sort.Slice(other, func(i, j int) bool {
		return strings.ToLower(other[i].Word) < strings.ToLower(other[j].Word)
	})

	// Get settings for database info and export path
	s := a.settings.Get()

	// Get database info
	dbPath, _ := constants.GetDatabasePath()
	exportFolder := s.ExportFolder

	var markdown strings.Builder
	markdown.WriteString("<a name=\"top\"></a>\n\n")
	markdown.WriteString("# Poetry Database Export\n\n")
	markdown.WriteString(fmt.Sprintf("**Database Path:** %s  \n", dbPath))
	markdown.WriteString(fmt.Sprintf("**Export Folder:** %s  \n\n", exportFolder))
	markdown.WriteString(fmt.Sprintf("**Total Items:** %d\n\n", len(items)))
	markdown.WriteString(fmt.Sprintf("- References: %d\n", len(references)))
	markdown.WriteString(fmt.Sprintf("- Writers: %d\n", len(writers)))
	markdown.WriteString(fmt.Sprintf("- Titles: %d\n", len(titles)))
	markdown.WriteString(fmt.Sprintf("- Other: %d\n\n", len(other)))

	// Table of Contents
	markdown.WriteString("## Table of Contents\n\n")
	markdown.WriteString("1. [References](#references)\n")
	markdown.WriteString("2. [Writers](#writers)\n")
	markdown.WriteString("3. [Titles](#titles)\n")
	markdown.WriteString("4. [Other](#other)\n")
	markdown.WriteString("5. [Data Quality Reports](#data-quality-reports)\n\n")
	markdown.WriteString("---\n\n")

	// References Section
	markdown.WriteString("# References\n\n")
	markdown.WriteString("[↑ Back to top](#top)\n\n")
	for _, item := range references {
		markdown.WriteString(fmt.Sprintf("## %s\n\n", item.Word))
		markdown.WriteString(fmt.Sprintf("**Type:** %s\n\n", item.Type))

		if item.Definition != nil && *item.Definition != "" {
			resolved := resolveTagsForMarkdown(*item.Definition)
			markdown.WriteString(fmt.Sprintf("### Definition\n\n%s\n\n", resolved))
		}

		if item.Derivation != nil && *item.Derivation != "" {
			resolved := resolveTagsForMarkdown(*item.Derivation)
			markdown.WriteString(fmt.Sprintf("### Etymology\n\n%s\n\n", resolved))
		}

		if item.Appendicies != nil && *item.Appendicies != "" {
			resolved := resolveTagsForMarkdown(*item.Appendicies)
			markdown.WriteString(fmt.Sprintf("### Notes\n\n%s\n\n", resolved))
		}

		if (item.Source != nil && *item.Source != "") || (item.SourcePg != nil && *item.SourcePg != "") {
			if item.Source != nil {
				resolved := resolveTagsForMarkdown(*item.Source)
				markdown.WriteString(fmt.Sprintf("**Source:** %s", resolved))
			}
			if item.SourcePg != nil && *item.SourcePg != "" {
				markdown.WriteString(fmt.Sprintf(", p. %s", *item.SourcePg))
			}
			markdown.WriteString("\n\n")
		}

		markdown.WriteString("---\n\n")
	}

	// Writers Section
	markdown.WriteString("\n# Writers\n\n")
	markdown.WriteString("[↑ Back to top](#top)\n\n")
	for _, item := range writers {
		markdown.WriteString(fmt.Sprintf("## %s\n\n", item.Word))
		markdown.WriteString(fmt.Sprintf("**Type:** %s\n\n", item.Type))

		if item.Definition != nil && *item.Definition != "" {
			resolved := resolveTagsForMarkdown(*item.Definition)
			markdown.WriteString(fmt.Sprintf("### Definition\n\n%s\n\n", resolved))
		}

		if item.Derivation != nil && *item.Derivation != "" {
			resolved := resolveTagsForMarkdown(*item.Derivation)
			markdown.WriteString(fmt.Sprintf("### Etymology\n\n%s\n\n", resolved))
		}

		if item.Appendicies != nil && *item.Appendicies != "" {
			resolved := resolveTagsForMarkdown(*item.Appendicies)
			markdown.WriteString(fmt.Sprintf("### Notes\n\n%s\n\n", resolved))
		}

		if (item.Source != nil && *item.Source != "") || (item.SourcePg != nil && *item.SourcePg != "") {
			if item.Source != nil {
				resolved := resolveTagsForMarkdown(*item.Source)
				markdown.WriteString(fmt.Sprintf("**Source:** %s", resolved))
			}
			if item.SourcePg != nil && *item.SourcePg != "" {
				markdown.WriteString(fmt.Sprintf(", p. %s", *item.SourcePg))
			}
			markdown.WriteString("\n\n")
		}

		markdown.WriteString("---\n\n")
	}

	// Titles Section
	markdown.WriteString("\n# Titles\n\n")
	markdown.WriteString("[↑ Back to top](#top)\n\n")
	for _, item := range titles {
		markdown.WriteString(fmt.Sprintf("## %s\n\n", item.Word))
		markdown.WriteString(fmt.Sprintf("**Type:** %s\n\n", item.Type))

		if item.Definition != nil && *item.Definition != "" {
			resolved := resolveTagsForMarkdown(*item.Definition)
			markdown.WriteString(fmt.Sprintf("### Definition\n\n%s\n\n", resolved))
		}

		if item.Derivation != nil && *item.Derivation != "" {
			resolved := resolveTagsForMarkdown(*item.Derivation)
			markdown.WriteString(fmt.Sprintf("### Etymology\n\n%s\n\n", resolved))
		}

		if item.Appendicies != nil && *item.Appendicies != "" {
			resolved := resolveTagsForMarkdown(*item.Appendicies)
			markdown.WriteString(fmt.Sprintf("### Notes\n\n%s\n\n", resolved))
		}

		if (item.Source != nil && *item.Source != "") || (item.SourcePg != nil && *item.SourcePg != "") {
			if item.Source != nil {
				resolved := resolveTagsForMarkdown(*item.Source)
				markdown.WriteString(fmt.Sprintf("**Source:** %s", resolved))
			}
			if item.SourcePg != nil && *item.SourcePg != "" {
				markdown.WriteString(fmt.Sprintf(", p. %s", *item.SourcePg))
			}
			markdown.WriteString("\n\n")
		}

		markdown.WriteString("---\n\n")
	}

	// Other Section
	markdown.WriteString("\n# Other\n\n")
	markdown.WriteString("[↑ Back to top](#top)\n\n")
	for _, item := range other {
		markdown.WriteString(fmt.Sprintf("## %s\n\n", item.Word))
		markdown.WriteString(fmt.Sprintf("**Type:** %s\n\n", item.Type))

		if item.Definition != nil && *item.Definition != "" {
			resolved := resolveTagsForMarkdown(*item.Definition)
			markdown.WriteString(fmt.Sprintf("### Definition\n\n%s\n\n", resolved))
		}

		if item.Derivation != nil && *item.Derivation != "" {
			resolved := resolveTagsForMarkdown(*item.Derivation)
			markdown.WriteString(fmt.Sprintf("### Etymology\n\n%s\n\n", resolved))
		}

		if item.Appendicies != nil && *item.Appendicies != "" {
			resolved := resolveTagsForMarkdown(*item.Appendicies)
			markdown.WriteString(fmt.Sprintf("### Notes\n\n%s\n\n", resolved))
		}

		if (item.Source != nil && *item.Source != "") || (item.SourcePg != nil && *item.SourcePg != "") {
			if item.Source != nil {
				resolved := resolveTagsForMarkdown(*item.Source)
				markdown.WriteString(fmt.Sprintf("**Source:** %s", resolved))
			}
			if item.SourcePg != nil && *item.SourcePg != "" {
				markdown.WriteString(fmt.Sprintf(", p. %s", *item.SourcePg))
			}
			markdown.WriteString("\n\n")
		}

		markdown.WriteString("---\n\n")
	}

	// Add Reports Section
	markdown.WriteString("\n\n# Data Quality Reports\n\n")
	markdown.WriteString("[↑ Back to top](#top)\n\n")

	// Unlinked References Report
	unlinkedRefs, _ := a.GetUnlinkedReferences()
	markdown.WriteString(fmt.Sprintf("## Unlinked References (%d)\n\n", len(unlinkedRefs)))
	markdown.WriteString("[↑ Back to top](#top)\n\n")
	if len(unlinkedRefs) > 0 {
		markdown.WriteString("Items containing reference tags without corresponding links.\n\n")
		markdown.WriteString("| Word | Type | Unlinked Count |\n")
		markdown.WriteString("|------|------|----------------|\n")
		for _, item := range unlinkedRefs {
			markdown.WriteString(fmt.Sprintf("| %s | %s | %v |\n",
				item["word"], item["type"], item["refCount"]))
		}
		markdown.WriteString("\n")
	} else {
		markdown.WriteString("✓ No unlinked references found.\n\n")
	}

	// Duplicate Items Report
	duplicates, _ := a.GetDuplicateItems()
	markdown.WriteString(fmt.Sprintf("## Duplicate Items (%d)\n\n", len(duplicates)))
	markdown.WriteString("[↑ Back to top](#top)\n\n")
	if len(duplicates) > 0 {
		markdown.WriteString("Items with duplicate stripped names.\n\n")
		markdown.WriteString("| Word | Item ID |\n")
		markdown.WriteString("|------|---------|\n")
		for _, item := range duplicates {
			markdown.WriteString(fmt.Sprintf("| %s | %v |\n", item["word"], item["itemId"]))
		}
		markdown.WriteString("\n")
	} else {
		markdown.WriteString("✓ No duplicate items found.\n\n")
	}

	// Orphaned Items Report
	orphanedItems, _ := a.GetOrphanedItems()
	markdown.WriteString(fmt.Sprintf("## Orphaned Items (%d)\n\n", len(orphanedItems)))
	markdown.WriteString("[↑ Back to top](#top)\n\n")
	if len(orphanedItems) > 0 {
		markdown.WriteString("Items with no incoming or outgoing links.\n\n")
		markdown.WriteString("| Word | Type |\n")
		markdown.WriteString("|------|------|\n")
		for _, item := range orphanedItems {
			markdown.WriteString(fmt.Sprintf("| %s | %s |\n", item["word"], item["type"]))
		}
		markdown.WriteString("\n")
	} else {
		markdown.WriteString("✓ No orphaned items found.\n\n")
	}

	// Linked Items Not In Definition Report
	linkedNotInDef, _ := a.GetLinkedItemsNotInDefinition()
	markdown.WriteString(fmt.Sprintf("## Linked Items Not In Definition (%d)\n\n", len(linkedNotInDef)))
	markdown.WriteString("[↑ Back to top](#top)\n\n")
	if len(linkedNotInDef) > 0 {
		markdown.WriteString("Items that have links but those linked items aren't referenced in the definition.\n\n")
		markdown.WriteString("| Word | Type | Unreferenced Count |\n")
		markdown.WriteString("|------|------|--------------------|\n")
		for _, item := range linkedNotInDef {
			markdown.WriteString(fmt.Sprintf("| %s | %s | %v |\n",
				item["word"], item["type"], item["unreferencedCount"]))
		}
		markdown.WriteString("\n")
	} else {
		markdown.WriteString("✓ No unreferenced links found.\n\n")
	}

	// Missing Definitions Report
	missingDefs, _ := a.GetItemsWithoutDefinitions()
	markdown.WriteString(fmt.Sprintf("## Items Without Definitions (%d)\n\n", len(missingDefs)))
	markdown.WriteString("[↑ Back to top](#top)\n\n")
	if len(missingDefs) > 0 {
		markdown.WriteString("Items that have no definition.\n\n")
		markdown.WriteString("| Word | Type |\n")
		markdown.WriteString("|------|------|\n")
		for _, item := range missingDefs {
			markdown.WriteString(fmt.Sprintf("| %s | %s |\n", item["word"], item["type"]))
		}
		markdown.WriteString("\n")
	} else {
		markdown.WriteString("✓ All items have definitions.\n\n")
	}

	// Unknown Types Report
	unknownTypes, _ := a.GetItemsWithUnknownTypes()
	markdown.WriteString(fmt.Sprintf("## Unknown Types (%d)\n\n", len(unknownTypes)))
	markdown.WriteString("[↑ Back to top](#top)\n\n")
	if len(unknownTypes) > 0 {
		markdown.WriteString("Items whose type is not Writer, Title, or Reference.\n\n")
		markdown.WriteString("| Word | Type |\n")
		markdown.WriteString("|------|------|\n")
		for _, item := range unknownTypes {
			markdown.WriteString(fmt.Sprintf("| %s | %s |\n", item["word"], item["type"]))
		}
		markdown.WriteString("\n")
	} else {
		markdown.WriteString("✓ All items have valid types.\n\n")
	}

	// Unknown Tags Report
	unknownTags, _ := a.GetUnknownTags()
	markdown.WriteString(fmt.Sprintf("## Unknown Tags (%d)\n\n", len(unknownTags)))
	markdown.WriteString("[↑ Back to top](#top)\n\n")
	if len(unknownTags) > 0 {
		markdown.WriteString("Items with tags other than {word:}, {writer:}, or {title:}.\n\n")
		markdown.WriteString("| Word | Type | Unknown Tag Count |\n")
		markdown.WriteString("|------|------|-------------------|\n")
		for _, item := range unknownTags {
			markdown.WriteString(fmt.Sprintf("| %s | %s | %v |\n",
				item["word"], item["type"], item["tagCount"]))
		}
		markdown.WriteString("\n")
	} else {
		markdown.WriteString("✓ No unknown tags found.\n\n")
	}

	// Get export path from settings or use default
	exportFolder = s.ExportFolder
	if exportFolder == "" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return "", fmt.Errorf("failed to get home directory: %w", err)
		}
		exportFolder = filepath.Join(homeDir, "Documents", "PoetryExports")
	}

	// Create export directory
	if err := os.MkdirAll(exportFolder, 0755); err != nil {
		return "", fmt.Errorf("failed to create export directory: %w", err)
	}

	// Create filename
	filename := "poetry-database.md"
	fullPath := filepath.Join(exportFolder, filename)

	err = os.WriteFile(fullPath, []byte(markdown.String()), 0644)
	if err != nil {
		return "", fmt.Errorf("failed to write file: %w", err)
	}

	return fullPath, nil
}

// GetSettings returns current settings
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
	slog.Info("[SaveLastWord] Saving last word ID", "id", wordID)
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
	// Set up cache directory
	cacheDir, err := constants.GetTTSCacheDir()
	if err != nil {
		return TTSResult{
			Error:     fmt.Sprintf("Failed to get TTS cache directory: %v", err),
			ErrorType: "unknown",
		}
	}
	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		return TTSResult{
			Error:     fmt.Sprintf("Failed to create cache directory: %v", err),
			ErrorType: "unknown",
		}
	}

	// Determine voice based on item type and gender
	voice := "alloy" // Default voice
	if itemType == "Writer" && itemWord != "" {
		// Extract first name (first word before space)
		parts := strings.Fields(itemWord)
		if len(parts) > 0 {
			firstName := parts[0]
			gender, err := a.db.GetGenderByFirstName(firstName)
			if err != nil {
				slog.Warn("Failed to get gender", "name", firstName, "error", err)
			} else if gender == "male" {
				voice = "onyx" // Male voice
			} else if gender == "female" {
				voice = "nova" // Female voice
			}
		}
	}

	// Use ItemID for cache filename
	cacheFile := fmt.Sprintf("%s/%d.mp3", cacheDir, itemID)

	// Check if cached file exists
	if cachedData, err := os.ReadFile(cacheFile); err == nil {
		slog.Info("Using cached TTS audio", "itemID", itemID)
		return TTSResult{
			AudioData: cachedData,
			Cached:    true,
		}
	}

	slog.Info("Cache miss, calling OpenAI API", "itemID", itemID)

	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return TTSResult{
			Error:     "OpenAI API key not configured. Please add OPENAI_API_KEY to your .env file.",
			ErrorType: "missing_key",
		}
	}

	// Create request to OpenAI TTS API
	url := "https://api.openai.com/v1/audio/speech"

	// Properly marshal JSON to handle special characters
	type TTSRequest struct {
		Model string `json:"model"`
		Input string `json:"input"`
		Voice string `json:"voice"`
	}

	requestData := TTSRequest{
		Model: "tts-1",
		Input: text,
		Voice: voice,
	}

	jsonData, err := json.Marshal(requestData)
	if err != nil {
		return TTSResult{
			Error:     fmt.Sprintf("Failed to prepare request: %v", err),
			ErrorType: "unknown",
		}
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(jsonData))
	if err != nil {
		return TTSResult{
			Error:     fmt.Sprintf("Failed to create request: %v", err),
			ErrorType: "unknown",
		}
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return TTSResult{
			Error:     fmt.Sprintf("Network error: %v. Please check your internet connection.", err),
			ErrorType: "network",
		}
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		errorMsg := fmt.Sprintf("OpenAI API error (%d): %s", resp.StatusCode, string(body))

		// Detect specific API error types
		errorType := "api"
		if resp.StatusCode == 401 {
			errorMsg = "Invalid API key. Please check your OPENAI_API_KEY in .env file."
			errorType = "missing_key"
		} else if resp.StatusCode == 429 {
			errorMsg = "Rate limit exceeded. Please try again in a moment."
		} else if resp.StatusCode >= 500 {
			errorMsg = fmt.Sprintf("OpenAI server error (%d). Please try again later.", resp.StatusCode)
		}

		return TTSResult{
			Error:     errorMsg,
			ErrorType: errorType,
		}
	}

	// Read audio data
	audioData, err := io.ReadAll(resp.Body)
	if err != nil {
		return TTSResult{
			Error:     fmt.Sprintf("Failed to read audio data: %v", err),
			ErrorType: "network",
		}
	}

	// Cache the audio data for future use
	if err := os.WriteFile(cacheFile, audioData, 0644); err != nil {
		slog.Warn("Failed to cache audio data", "error", err)
		// Don't fail the request if caching fails
	} else {
		slog.Info("Cached TTS audio", "path", cacheFile)
	}

	return TTSResult{
		AudioData: audioData,
		Cached:    false,
	}
}

// GetUnlinkedReferences returns a report of all items with unlinked references
func (a *App) GetUnlinkedReferences() ([]map[string]interface{}, error) {
	// Get all items
	allItems, err := a.db.SearchItems("") // Empty search returns all
	if err != nil {
		return nil, fmt.Errorf("failed to get items: %w", err)
	}

	// Get all links
	allLinks, err := a.db.GetAllLinks()
	if err != nil {
		return nil, fmt.Errorf("failed to get links: %w", err)
	}

	// Create a map of item words for quick lookup
	itemsByWord := make(map[string]*database.Item)
	for i := range allItems {
		itemsByWord[strings.ToLower(allItems[i].Word)] = &allItems[i]
	}

	// Create a map of links for quick lookup
	linksMap := make(map[int]map[int]bool) // sourceId -> map[destId]bool
	for _, link := range allLinks {
		if linksMap[link.SourceItemID] == nil {
			linksMap[link.SourceItemID] = make(map[int]bool)
		}
		linksMap[link.SourceItemID][link.DestinationItemID] = true
	}

	// Analyze each item for unlinked references
	var results []map[string]interface{}

	for i := range allItems {
		item := &allItems[i]
		if item.Definition == nil || *item.Definition == "" {
			continue
		}

		// Find all {word:}, {writer:}, {title:} references in definition
		unlinkedRefs := []map[string]string{}

		// Use centralized parser
		refs := parser.ParseReferences(*item.Definition)
		for _, ref := range refs {
			refType := ref.Type
			refWord := ref.Value

			// Strip possessive 's or s' from writer references
			matchWord := refWord
			if refType == "writer" {
				lowerWord := strings.ToLower(refWord)
				if strings.HasSuffix(lowerWord, "'s") {
					matchWord = refWord[:len(refWord)-2]
				} else if strings.HasSuffix(lowerWord, "s'") {
					matchWord = refWord[:len(refWord)-1]
				}
			}

			// Check if this reference exists in items
			matchedItem := itemsByWord[strings.ToLower(matchWord)]
			if matchedItem == nil {
				// Item doesn't exist
				unlinkedRefs = append(unlinkedRefs, map[string]string{
					"ref":    refWord,
					"reason": "missing",
				})
			} else {
				// Item exists, check if it's linked
				if linksMap[item.ItemID] == nil || !linksMap[item.ItemID][matchedItem.ItemID] {
					unlinkedRefs = append(unlinkedRefs, map[string]string{
						"ref":    refWord,
						"reason": "unlinked",
					})
				}
			}
		}

		if len(unlinkedRefs) > 0 {
			results = append(results, map[string]interface{}{
				"itemId":       item.ItemID,
				"word":         item.Word,
				"type":         item.Type,
				"unlinkedRefs": unlinkedRefs,
				"refCount":     len(unlinkedRefs),
			})
		}
	}

	return results, nil
}

// GetAllCliches returns all cliches
func (a *App) GetAllCliches() ([]database.Cliche, error) {
	return a.db.GetAllCliches()
}

// GetAllNames returns all names
func (a *App) GetAllNames() ([]database.Name, error) {
	return a.db.GetAllNames()
}

// GetAllLiteraryTerms returns all literary terms
func (a *App) GetAllLiteraryTerms() ([]database.LiteraryTerm, error) {
	return a.db.GetAllLiteraryTerms()
}

// MergeLiteraryTerm merges a literary term into an existing item
func (a *App) MergeLiteraryTerm(termID int) error {
	return a.db.MergeLiteraryTerm(termID)
}

// DeleteLiteraryTerm permanently deletes a literary term
func (a *App) DeleteLiteraryTerm(termID int) error {
	runtime.LogInfof(a.ctx, "DeleteLiteraryTerm called with ID: %d", termID)
	err := a.db.DeleteLiteraryTerm(termID)
	if err != nil {
		runtime.LogErrorf(a.ctx, "DeleteLiteraryTerm error: %v", err)
		return err
	}
	runtime.LogInfof(a.ctx, "DeleteLiteraryTerm success for ID: %d", termID)
	return nil
}

// GetAllSources returns all sources
func (a *App) GetAllSources() ([]database.Source, error) {
	return a.db.GetAllSources()
}

// stripPossessive removes possessive 's or s' from text
func stripPossessive(text string) string {
	lowerText := strings.ToLower(text)
	// Handle straight apostrophe 's
	if strings.HasSuffix(lowerText, "'s") {
		return text[:len(text)-2]
	}
	// Handle curly apostrophe 's
	if strings.HasSuffix(lowerText, "'s") {
		return text[:len(text)-2]
	}
	// Handle straight apostrophe s'
	if strings.HasSuffix(lowerText, "s'") {
		return text[:len(text)-1]
	}
	// Handle curly apostrophe s'
	if strings.HasSuffix(lowerText, "s'") {
		return text[:len(text)-1]
	}
	return text
}

// GetDuplicateItems returns a report of items with duplicate stripped names
func (a *App) GetDuplicateItems() ([]map[string]interface{}, error) {
	// Get all items
	allItems, err := a.db.SearchItems("")
	if err != nil {
		return nil, fmt.Errorf("failed to get items: %w", err)
	}

	// Group items by stripped word (case-insensitive)
	groups := make(map[string][]database.Item)
	for _, item := range allItems {
		stripped := strings.ToLower(stripPossessive(item.Word))
		groups[stripped] = append(groups[stripped], item)
	}

	// Find groups with more than one item
	var results []map[string]interface{}
	for strippedWord, items := range groups {
		if len(items) > 1 {
			// Sort items by ID to have consistent ordering
			sort.Slice(items, func(i, j int) bool {
				return items[i].ItemID < items[j].ItemID
			})

			// First item is the "original", rest are duplicates
			original := items[0]
			duplicates := items[1:]

			duplicateInfo := []map[string]interface{}{}
			for _, dup := range duplicates {
				duplicateInfo = append(duplicateInfo, map[string]interface{}{
					"itemId": dup.ItemID,
					"word":   dup.Word,
				})
			}

			results = append(results, map[string]interface{}{
				"strippedWord": strippedWord,
				"original": map[string]interface{}{
					"itemId": original.ItemID,
					"word":   original.Word,
				},
				"duplicates": duplicateInfo,
				"count":      len(duplicates),
			})
		}
	}

	return results, nil
}

func (a *App) GetSelfReferentialItems() ([]map[string]interface{}, error) {
	// Get all items that might have tags
	query := `SELECT item_id, word, type, definition, derivation, appendicies FROM items 
              WHERE definition LIKE '%{%' OR derivation LIKE '%{%' OR appendicies LIKE '%{%'`

	rows, err := a.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query items: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var results []map[string]interface{}

	for rows.Next() {
		var itemID int
		var word, itemType string
		var definition, derivation, appendicies *string // Use pointers for nullable fields

		if err := rows.Scan(&itemID, &word, &itemType, &definition, &derivation, &appendicies); err != nil {
			continue
		}

		// Dereference pointers safely
		def := ""
		if definition != nil {
			def = *definition
		}
		der := ""
		if derivation != nil {
			der = *derivation
		}
		app := ""
		if appendicies != nil {
			app = *appendicies
		}

		// Determine tag prefix
		var prefix string
		switch itemType {
		case "Title":
			prefix = "title"
		case "Writer":
			prefix = "writer"
		case "Reference":
			prefix = "word"
		default:
			continue
		}

		// Construct regex pattern: \{prefix:\s*word\}
		re, err := parser.GetSpecificReferenceRegex(prefix, word)
		if err != nil {
			continue
		}

		// Check fields
		found := false
		if def != "" && re.MatchString(def) {
			found = true
		} else if der != "" && re.MatchString(der) {
			found = true
		} else if app != "" && re.MatchString(app) {
			found = true
		}

		if found {
			results = append(results, map[string]interface{}{
				"itemId": itemID,
				"word":   word,
				"type":   itemType,
				"tag":    fmt.Sprintf("{%s: %s}", prefix, word),
			})
		}
	}
	return results, nil
}

// GetOrphanedItems returns items with no incoming or outgoing links
func (a *App) GetOrphanedItems() ([]map[string]interface{}, error) {
	// Get all items
	allItems, err := a.db.SearchItems("")
	if err != nil {
		return nil, fmt.Errorf("failed to get items: %w", err)
	}

	// Get all links
	allLinks, err := a.db.GetAllLinks()
	if err != nil {
		return nil, fmt.Errorf("failed to get links: %w", err)
	}

	// Create a set of item IDs that have links
	connectedItems := make(map[int]bool)
	for _, link := range allLinks {
		connectedItems[link.SourceItemID] = true
		connectedItems[link.DestinationItemID] = true
	}

	// Find items without any links
	var results []map[string]interface{}
	for _, item := range allItems {
		if !connectedItems[item.ItemID] {
			results = append(results, map[string]interface{}{
				"itemId": item.ItemID,
				"word":   item.Word,
				"type":   item.Type,
			})
		}
	}

	return results, nil
}

// GetLinkedItemsNotInDefinition returns items that have links but those linked items aren't referenced in the definition
func (a *App) GetLinkedItemsNotInDefinition() ([]map[string]interface{}, error) {
	// Single SQL query to get all items with their outgoing links efficiently
	query := `
		SELECT 
			i.item_id,
			i.word,
			i.type,
			COALESCE(i.definition, ''),
			COALESCE(i.derivation, ''),
			COALESCE(i.appendicies, ''),
			dest.word as linked_word
		FROM items i
		INNER JOIN links l ON i.item_id = l.source_item_id
		INNER JOIN items dest ON l.destination_item_id = dest.item_id
		WHERE (i.definition IS NOT NULL AND TRIM(i.definition) != '')
		   OR (i.derivation IS NOT NULL AND TRIM(i.derivation) != '')
		   OR (i.appendicies IS NOT NULL AND TRIM(i.appendicies) != '')
		ORDER BY i.item_id, dest.word
	`

	rows, err := a.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query items with links: %w", err)
	}
	defer func() { _ = rows.Close() }()

	// Group results by item
	itemMap := make(map[int]map[string]interface{})
	itemOrder := []int{}

	for rows.Next() {
		var itemID int
		var word, itemType, linkedWord string
		var definition, derivation, appendicies string

		if err := rows.Scan(&itemID, &word, &itemType, &definition, &derivation, &appendicies, &linkedWord); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		// Initialize item if not seen before
		if _, exists := itemMap[itemID]; !exists {
			itemMap[itemID] = map[string]interface{}{
				"itemId":            itemID,
				"word":              word,
				"type":              itemType,
				"definition":        definition,
				"derivation":        derivation,
				"appendicies":       appendicies,
				"linkedWords":       []string{},
				"missingReferences": []string{},
			}
			itemOrder = append(itemOrder, itemID)
		}

		// Add linked word to this item's list
		itemData := itemMap[itemID]
		itemData["linkedWords"] = append(itemData["linkedWords"].([]string), linkedWord)
	}

	// Now check each item's text fields for missing references
	var results []map[string]interface{}
	for _, itemID := range itemOrder {
		itemData := itemMap[itemID]
		// Combine all text fields and strip possessives from tags
		combinedText := itemData["definition"].(string) + " " +
			itemData["derivation"].(string) + " " +
			itemData["appendicies"].(string)

		// Strip possessives from text (e.g., {writer:Larry Stark's} -> {writer:larry stark})
		allText := strings.ToLower(combinedText)
		// Replace 's} with } (straight apostrophe)
		allText = strings.ReplaceAll(allText, "'s}", "}")
		// Replace 's} with } (curly apostrophe)
		allText = strings.ReplaceAll(allText, "'s}", "}")
		// Replace s'} with s} (straight apostrophe)
		allText = strings.ReplaceAll(allText, "s'}", "s}")
		// Replace s'} with s} (curly apostrophe)
		allText = strings.ReplaceAll(allText, "s'}", "s}")

		linkedWords := itemData["linkedWords"].([]string)
		var missingReferences []string

		for _, linkedWord := range linkedWords {
			// Simply check if linkedWord + "}" appears in any text field (matches any tag type)
			normalizedWord := strings.ToLower(stripPossessive(linkedWord))
			if !strings.Contains(allText, normalizedWord+"}") {
				missingReferences = append(missingReferences, linkedWord)
			}
		}

		if len(missingReferences) > 0 {
			results = append(results, map[string]interface{}{
				"itemId":            itemData["itemId"],
				"word":              itemData["word"],
				"type":              itemData["type"],
				"missingReferences": missingReferences,
			})
		}
	}

	return results, nil
}

// GetItemsWithoutDefinitions returns items that have no definition or "MISSING DATA"
func (a *App) GetItemsWithoutDefinitions() ([]map[string]interface{}, error) {
	// Get all items
	allItems, err := a.db.SearchItems("")
	if err != nil {
		return nil, fmt.Errorf("failed to get items: %w", err)
	}

	// Find items without definitions or with "MISSING DATA"
	var results []map[string]interface{}
	for _, item := range allItems {
		var hasMissingData bool
		var includeItem bool

		if item.Definition == nil || strings.TrimSpace(*item.Definition) == "" {
			includeItem = true
			hasMissingData = false
		} else if strings.TrimSpace(*item.Definition) == "MISSING DATA" {
			includeItem = true
			hasMissingData = true
		}

		if includeItem {
			result := map[string]interface{}{
				"itemId":         item.ItemID,
				"word":           item.Word,
				"type":           item.Type,
				"hasMissingData": hasMissingData,
			}

			// Get all links for this item
			links, err := a.db.GetItemLinks(item.ItemID)
			if err == nil {
				// Filter for incoming links (where this item is destination)
				var incomingLinks []database.Link
				for _, link := range links {
					if link.DestinationItemID == item.ItemID {
						incomingLinks = append(incomingLinks, link)
					}
				}

				// If exactly one incoming link, get source item info
				if len(incomingLinks) == 1 {
					sourceItem, err := a.db.GetItem(incomingLinks[0].SourceItemID)
					if err == nil {
						result["singleIncomingLinkItemId"] = sourceItem.ItemID
						result["singleIncomingLinkWord"] = sourceItem.Word
					}
				}
			}

			results = append(results, result)
		}
	}

	return results, nil
}

// GetItemsWithUnknownTypes returns items whose type is not Writer, Title, or Reference
func (a *App) GetItemsWithUnknownTypes() ([]map[string]interface{}, error) {
	// Get all items
	allItems, err := a.db.SearchItems("")
	if err != nil {
		return nil, fmt.Errorf("failed to get items: %w", err)
	}

	// Find items with unknown types
	var results []map[string]interface{}
	for _, item := range allItems {
		if item.Type != "Reference" && item.Type != "Title" && item.Type != "Writer" {
			result := map[string]interface{}{
				"itemId": item.ItemID,
				"word":   item.Word,
				"type":   item.Type,
			}

			// Get all links for this item
			links, err := a.db.GetItemLinks(item.ItemID)
			if err == nil {
				// Filter for incoming links (where this item is destination)
				var incomingLinks []database.Link
				for _, link := range links {
					if link.DestinationItemID == item.ItemID {
						incomingLinks = append(incomingLinks, link)
					}
				}

				// Set the incoming link count
				result["incomingLinkCount"] = len(incomingLinks)

				// If exactly one incoming link, get source item info
				if len(incomingLinks) == 1 {
					sourceItem, err := a.db.GetItem(incomingLinks[0].SourceItemID)
					if err == nil {
						result["singleIncomingLinkItemId"] = sourceItem.ItemID
						result["singleIncomingLinkWord"] = sourceItem.Word
					}
				}
			}

			results = append(results, result)
		}
	}

	return results, nil
}

// GetUnknownTags returns items with tags other than {word:, {writer:, or {title:
func (a *App) GetUnknownTags() ([]map[string]interface{}, error) {
	// Get all items
	allItems, err := a.db.SearchItems("")
	if err != nil {
		return nil, fmt.Errorf("failed to get items: %w", err)
	}

	var results []map[string]interface{}

	for _, item := range allItems {
		// Only check Reference, Title, or Writer types
		if item.Type != "Reference" && item.Type != "Title" && item.Type != "Writer" {
			continue
		}

		// Check all text fields for tags
		fieldsToCheck := []string{}
		if item.Definition != nil {
			fieldsToCheck = append(fieldsToCheck, *item.Definition)
		}
		if item.Derivation != nil {
			fieldsToCheck = append(fieldsToCheck, *item.Derivation)
		}
		if item.Appendicies != nil {
			fieldsToCheck = append(fieldsToCheck, *item.Appendicies)
		}

		unknownTags := []string{}
		seenTags := make(map[string]bool)

		for _, text := range fieldsToCheck {
			refs := parser.ParseAllTags(text)
			for _, ref := range refs {
				// Check if it's an unknown tag (not word, writer, or title)
				if ref.Type != "word" && ref.Type != "writer" && ref.Type != "title" {
					if !seenTags[ref.Original] {
						unknownTags = append(unknownTags, ref.Original)
						seenTags[ref.Original] = true
					}
				}
			}
		}

		if len(unknownTags) > 0 {
			results = append(results, map[string]interface{}{
				"itemId":      item.ItemID,
				"word":        item.Word,
				"type":        item.Type,
				"unknownTags": unknownTags,
				"tagCount":    len(unknownTags),
			})
		}
	}

	return results, nil
}

// MergeDuplicateItems merges duplicate items into the original by redirecting links and deleting duplicates
func (a *App) MergeDuplicateItems(originalID int, duplicateIDs []int) error {
	for _, duplicateID := range duplicateIDs {
		// Update all links that point TO this duplicate to point to the original instead (incoming links)
		if err := a.db.UpdateLinksDestination(duplicateID, originalID); err != nil {
			return fmt.Errorf("failed to redirect incoming links for item %d: %w", duplicateID, err)
		}

		// Update all links that originate FROM this duplicate to originate from the original instead (outgoing links)
		if err := a.db.UpdateLinksSource(duplicateID, originalID); err != nil {
			return fmt.Errorf("failed to redirect outgoing links for item %d: %w", duplicateID, err)
		}

		// Now safe to delete the duplicate
		if err := a.db.DeleteItem(duplicateID); err != nil {
			return fmt.Errorf("failed to delete duplicate item %d: %w", duplicateID, err)
		}
	}
	return nil
}

// SaveItemImage saves an image for an item to the cache directory
func (a *App) SaveItemImage(itemId int, imageData string) error {
	// Get user config directory
	cacheDir, err := constants.GetImagesDir()
	if err != nil {
		return fmt.Errorf("failed to get images directory: %w", err)
	}
	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		return fmt.Errorf("failed to create cache directory: %w", err)
	}

	// Parse base64 image data (data:image/png;base64,...)
	parts := strings.Split(imageData, ",")
	if len(parts) != 2 {
		return fmt.Errorf("invalid image data format")
	}

	// Decode from base64
	decoded, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil {
		return fmt.Errorf("failed to decode base64: %w", err)
	}

	// Save to file
	imagePath := filepath.Join(cacheDir, fmt.Sprintf("%d.png", itemId))
	if err := os.WriteFile(imagePath, decoded, 0644); err != nil {
		return fmt.Errorf("failed to write image file: %w", err)
	}

	return nil
}

// GetItemImage retrieves an image for an item from the cache
func (a *App) GetItemImage(itemId int) (string, error) {
	imagesDir, err := constants.GetImagesDir()
	if err != nil {
		return "", fmt.Errorf("failed to get images directory: %w", err)
	}
	imagePath := filepath.Join(imagesDir, fmt.Sprintf("%d.png", itemId))

	// Check if file exists
	if _, err := os.Stat(imagePath); os.IsNotExist(err) {
		return "", nil // No image exists
	}

	// Read the image file
	imageBytes, err := os.ReadFile(imagePath)
	if err != nil {
		return "", fmt.Errorf("failed to read image file: %w", err)
	}

	// Encode to base64
	encoded := base64.StdEncoding.EncodeToString(imageBytes)
	return fmt.Sprintf("data:image/png;base64,%s", encoded), nil
}

// DeleteItemImage removes an image for an item from the cache
func (a *App) DeleteItemImage(itemId int) error {
	imagesDir, err := constants.GetImagesDir()
	if err != nil {
		return fmt.Errorf("failed to get images directory: %w", err)
	}
	imagePath := filepath.Join(imagesDir, fmt.Sprintf("%d.png", itemId))

	// Check if file exists
	if _, err := os.Stat(imagePath); os.IsNotExist(err) {
		return nil // Already doesn't exist
	}

	// Delete the file
	if err := os.Remove(imagePath); err != nil {
		return fmt.Errorf("failed to delete image file: %w", err)
	}

	return nil
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}
