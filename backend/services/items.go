package services

import (
	"fmt"
	"log/slog"
	"os"
	"strings"

	"github.com/TrueBlocks/trueblocks-poetry/backend/database"
	"github.com/TrueBlocks/trueblocks-poetry/pkg/constants"
	"github.com/TrueBlocks/trueblocks-poetry/pkg/parser"
	"github.com/TrueBlocks/trueblocks-poetry/pkg/validator"
)

// ItemService handles item operations
type ItemService struct {
	db           *database.DB
	imageService *ImageService
}

// NewItemService creates a new ItemService
func NewItemService(db *database.DB, imageService *ImageService) *ItemService {
	return &ItemService{
		db:           db,
		imageService: imageService,
	}
}

// SearchItems performs full-text search on items
func (s *ItemService) SearchItems(query string) ([]database.Item, error) {
	items, err := s.db.SearchItems(query)
	if err != nil {
		return nil, err
	}

	// Parse definitions for all items
	for i := range items {
		if items[i].Definition != nil {
			isPoem := parser.IsPoem(items[i].Type, *items[i].Definition)
			items[i].ParsedDef = parser.ParseDefinition(*items[i].Definition, isPoem)
		}
	}

	return items, nil
}

// SearchItemsWithOptions performs advanced search with filters
func (s *ItemService) SearchItemsWithOptions(options database.SearchOptions) ([]database.Item, error) {
	items, err := s.db.SearchItemsWithOptions(options)
	if err != nil {
		return nil, err
	}

	// Parse definitions for all items
	for i := range items {
		if items[i].Definition != nil {
			isPoem := parser.IsPoem(items[i].Type, *items[i].Definition)
			items[i].ParsedDef = parser.ParseDefinition(*items[i].Definition, isPoem)
		}
	}

	return items, nil
}

// GetItem retrieves a single item by ID
func (s *ItemService) GetItem(itemID int) (*database.Item, error) {
	item, err := s.db.GetItem(itemID)
	if err != nil {
		slog.Error("[GetItem] ERROR fetching item", "id", itemID, "error", err)
		return nil, err
	}

	// Parse definition into structured segments
	if item.Definition != nil {
		isPoem := parser.IsPoem(item.Type, *item.Definition)
		item.ParsedDef = parser.ParseDefinition(*item.Definition, isPoem)
	}

	return item, nil
}

// GetItemByWord retrieves a single item by word
func (s *ItemService) GetItemByWord(word string) (*database.Item, error) {
	item, err := s.db.GetItemByWord(word)
	if err != nil {
		return nil, err
	}

	// Parse definition into structured segments
	if item.Definition != nil {
		isPoem := parser.IsPoem(item.Type, *item.Definition)
		item.ParsedDef = parser.ParseDefinition(*item.Definition, isPoem)
	}

	return item, nil
}

// GetRandomItem returns a random item
func (s *ItemService) GetRandomItem() (*database.Item, error) {
	item, err := s.db.GetRandomItem()
	if err != nil {
		return nil, err
	}

	// Parse definition into structured segments
	if item.Definition != nil {
		isPoem := parser.IsPoem(item.Type, *item.Definition)
		item.ParsedDef = parser.ParseDefinition(*item.Definition, isPoem)
	}

	return item, nil
}

// GetPoetIds returns a list of item IDs for writers that have an image and at least one poem
func (s *ItemService) GetPoetIds() ([]int, error) {
	return s.db.GetPoetIds()
}

// LinkOrTagResult is the return type for CreateLinkOrRemoveTags
type LinkOrTagResult struct {
	LinkCreated bool   `json:"linkCreated"`
	Message     string `json:"message"`
}

// CreateLinkOrRemoveTags attempts to create a link to the referenced word.
// If the referenced word doesn't exist, it removes the reference tags from the source item's text fields.
func (s *ItemService) CreateLinkOrRemoveTags(sourceItemID int, refWord string) (*LinkOrTagResult, error) {
	linkCreated, message, err := s.db.CreateLinkOrRemoveTags(sourceItemID, refWord)
	if err != nil {
		return nil, err
	}
	return &LinkOrTagResult{
		LinkCreated: linkCreated,
		Message:     message,
	}, nil
}

// CreateItem creates a new item
func (s *ItemService) CreateItem(item database.Item) (int, error) {
	if err := validator.ValidateItem(item); err != nil {
		return 0, err
	}
	return s.db.CreateItem(item)
}

// UpdateItem updates an existing item
func (s *ItemService) UpdateItem(item database.Item) error {
	if err := validator.ValidateID(item.ItemID); err != nil {
		return err
	}
	if err := validator.ValidateItem(item); err != nil {
		return err
	}

	// Delete TTS cache for this item
	cacheDir, err := constants.GetTTSCacheDir()
	if err == nil {
		cacheFile := fmt.Sprintf("%s/%d.mp3", cacheDir, item.ItemID)
		if err := os.Remove(cacheFile); err != nil && !os.IsNotExist(err) {
			slog.Warn("Failed to delete TTS cache", "id", item.ItemID, "error", err)
		} else if err == nil {
			// Clear has_tts flag since file was deleted
			if _, err := s.db.Conn().Exec("UPDATE items SET has_tts = 0 WHERE item_id = ?", item.ItemID); err != nil {
				slog.Warn("Failed to clear has_tts flag", "id", item.ItemID, "error", err)
			}
		}
	}

	return s.db.UpdateItem(item)
}

// ToggleItemMark toggles the mark field for an item
func (s *ItemService) ToggleItemMark(itemID int, marked bool) error {
	return s.db.ToggleItemMark(itemID, marked)
}

// DeleteItem deletes an item
func (s *ItemService) DeleteItem(itemID int) error {
	if err := validator.ValidateID(itemID); err != nil {
		return err
	}
	slog.Info("[ItemService] DeleteItem called", "id", itemID)

	// Delete TTS cache for this item
	cacheDir, err := constants.GetTTSCacheDir()
	if err == nil {
		cacheFile := fmt.Sprintf("%s/%d.mp3", cacheDir, itemID)
		if err := os.Remove(cacheFile); err != nil && !os.IsNotExist(err) {
			slog.Warn("Failed to delete TTS cache", "id", itemID, "error", err)
		} else if err == nil {
			// Clear has_tts flag since file was deleted
			if _, err := s.db.Conn().Exec("UPDATE items SET has_tts = 0 WHERE item_id = ?", itemID); err != nil {
				slog.Warn("Failed to clear has_tts flag", "id", itemID, "error", err)
			}
		}
	}

	// Delete Image cache for this item
	if err := s.imageService.DeleteItemImage(itemID); err != nil {
		slog.Warn("Failed to delete image cache", "id", itemID, "error", err)
	}

	return s.db.DeleteItem(itemID)
}

// GetItemsWithoutDefinitions returns items that have no definition or "MISSING DATA"
func (s *ItemService) GetItemsWithoutDefinitions() ([]ItemWithoutDefinitionResult, error) {
	// Get all items
	allItems, err := s.db.SearchItems("")
	if err != nil {
		return nil, fmt.Errorf("failed to get items: %w", err)
	}

	// Find items without definitions or with "MISSING DATA"
	var results []ItemWithoutDefinitionResult
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
			result := ItemWithoutDefinitionResult{
				ItemID:         item.ItemID,
				Word:           item.Word,
				Type:           item.Type,
				HasMissingData: hasMissingData,
			}

			// Get all links for this item
			links, err := s.db.GetItemLinks(item.ItemID)
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
					sourceItem, err := s.db.GetItem(incomingLinks[0].SourceItemID)
					if err == nil {
						result.SingleIncomingLinkItemID = sourceItem.ItemID
						result.SingleIncomingLinkWord = sourceItem.Word
					}
				}
			}

			results = append(results, result)
		}
	}

	return results, nil
}

// GetItemsWithUnknownTypes returns items whose type is not Writer, Title, or Reference
func (s *ItemService) GetItemsWithUnknownTypes() ([]ItemWithUnknownTypeResult, error) {
	// Get all items
	allItems, err := s.db.SearchItems("")
	if err != nil {
		return nil, fmt.Errorf("failed to get items: %w", err)
	}

	// Find items with unknown types
	var results []ItemWithUnknownTypeResult
	for _, item := range allItems {
		if item.Type != "Reference" && item.Type != "Title" && item.Type != "Writer" {
			result := ItemWithUnknownTypeResult{
				ItemID: item.ItemID,
				Word:   item.Word,
				Type:   item.Type,
			}

			// Get all links for this item
			links, err := s.db.GetItemLinks(item.ItemID)
			if err == nil {
				// Filter for incoming links (where this item is destination)
				var incomingLinks []database.Link
				for _, link := range links {
					if link.DestinationItemID == item.ItemID {
						incomingLinks = append(incomingLinks, link)
					}
				}

				// Set the incoming link count
				result.IncomingLinkCount = len(incomingLinks)

				// If exactly one incoming link, get source item info
				if len(incomingLinks) == 1 {
					sourceItem, err := s.db.GetItem(incomingLinks[0].SourceItemID)
					if err == nil {
						result.SingleIncomingLinkItemID = sourceItem.ItemID
						result.SingleIncomingLinkWord = sourceItem.Word
					}
				}
			}

			results = append(results, result)
		}
	}

	return results, nil
}

// GetUnknownTags returns items with tags other than {word:, {writer:, or {title:
func (s *ItemService) GetUnknownTags() ([]UnknownTagResult, error) {
	// Get all items
	allItems, err := s.db.SearchItems("")
	if err != nil {
		return nil, fmt.Errorf("failed to get items: %w", err)
	}

	var results []UnknownTagResult

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
			results = append(results, UnknownTagResult{
				ItemID:      item.ItemID,
				Word:        item.Word,
				Type:        item.Type,
				UnknownTags: unknownTags,
				TagCount:    len(unknownTags),
			})
		}
	}

	return results, nil
}

// MergeDuplicateItems merges duplicate items into the original by redirecting links and deleting duplicates
func (s *ItemService) MergeDuplicateItems(originalID int, duplicateIDs []int) error {
	for _, duplicateID := range duplicateIDs {
		// Update all links that point TO this duplicate to point to the original instead (incoming links)
		if err := s.db.UpdateLinksDestination(duplicateID, originalID); err != nil {
			return fmt.Errorf("failed to update links for duplicate item %d: %w", duplicateID, err)
		}

		// Update all links that originate FROM this duplicate to originate from the original instead (outgoing links)
		if err := s.db.UpdateLinksSource(duplicateID, originalID); err != nil {
			return fmt.Errorf("failed to redirect outgoing links for item %d: %w", duplicateID, err)
		}

		// Delete the duplicate item
		// We use DeleteItem to ensure cleanup of cache files
		if err := s.DeleteItem(duplicateID); err != nil {
			return fmt.Errorf("failed to delete duplicate item %d: %w", duplicateID, err)
		}
	}
	return nil
}

// GetItemLinks gets all links for an item
func (s *ItemService) GetItemLinks(itemID int) ([]database.Link, error) {
	return s.db.GetItemLinks(itemID)
}

// CreateLink creates a new link between items
func (s *ItemService) CreateLink(sourceID, destID int, linkType string) error {
	if err := validator.ValidateID(sourceID); err != nil {
		return fmt.Errorf("invalid sourceID: %w", err)
	}
	if err := validator.ValidateID(destID); err != nil {
		return fmt.Errorf("invalid destID: %w", err)
	}
	if sourceID == destID {
		return fmt.Errorf("cannot create self-link")
	}
	if err := validator.ValidateLinkType(linkType); err != nil {
		return err
	}
	return s.db.CreateLink(sourceID, destID, linkType)
}

// DeleteLink deletes a link
func (s *ItemService) DeleteLink(linkID int) error {
	if err := validator.ValidateID(linkID); err != nil {
		return err
	}
	slog.Info("[ItemService] DeleteLink called", "id", linkID)
	err := s.db.DeleteLink(linkID)
	if err != nil {
		slog.Error("[ItemService] DeleteLink failed", "error", err)
		return err
	}
	slog.Info("[ItemService] DeleteLink succeeded", "id", linkID)
	return nil
}

// DeleteLinkByItems deletes a link between two items
func (s *ItemService) DeleteLinkByItems(sourceItemID, destinationItemID int) error {
	return s.db.DeleteLinkByItems(sourceItemID, destinationItemID)
}
