package main

import (
	"log/slog"

	"github.com/TrueBlocks/trueblocks-poetry/backend/database"
)

func (a *App) SearchItems(query string) ([]database.Item, error) {
	return a.itemService.SearchItems(query)
}

// SearchItemsWithOptions performs advanced search with filters
func (a *App) SearchItemsWithOptions(options database.SearchOptions) ([]database.Item, error) {
	return a.itemService.SearchItemsWithOptions(options)
}

// GetItem retrieves a single item by ID
func (a *App) GetItem(itemID int) (*database.Item, error) {
	return a.itemService.GetItem(itemID)
}

// GetItemByWord retrieves a single item by word
func (a *App) GetItemByWord(word string) (*database.Item, error) {
	return a.itemService.GetItemByWord(word)
}

// GetRandomItem returns a random item
func (a *App) GetRandomItem() (*database.Item, error) {
	return a.itemService.GetRandomItem()
}

// GetPoetIds returns a list of item IDs for writers that have an image and at least one poem
func (a *App) GetPoetIds() ([]int, error) {
	return a.itemService.GetPoetIds()
}

// CreateLinkOrRemoveTags attempts to create a link to the referenced word.
// If the referenced word doesn't exist, it removes the reference tags from the source item's text fields.
func (a *App) CreateLinkOrRemoveTags(sourceItemID int, refWord string) (*LinkOrTagResult, error) {
	return a.itemService.CreateLinkOrRemoveTags(sourceItemID, refWord)
}

// CreateItem creates a new item
func (a *App) CreateItem(item database.Item) (int, error) {
	return a.itemService.CreateItem(item)
}

// UpdateItem updates an existing item
func (a *App) UpdateItem(item database.Item) error {
	return a.itemService.UpdateItem(item)
}

// ToggleItemMark toggles the mark field for an item
func (a *App) ToggleItemMark(itemID int, marked bool) error {
	return a.itemService.ToggleItemMark(itemID, marked)
}

// DeleteItem deletes an item
func (a *App) DeleteItem(itemID int) error {
	// slog.Info("[App] DeleteItem called", "id", itemID)

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

	return a.itemService.DeleteItem(itemID)
}
