package main

import (
	"fmt"
	"sort"
	"strings"

	"github.com/TrueBlocks/trueblocks-poetry/backend/database"
	"github.com/TrueBlocks/trueblocks-poetry/pkg/parser"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

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
	query := database.MustLoadQuery("self_ref_items")

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
	return a.itemService.GetItemsWithoutDefinitions()
}

// GetItemsWithUnknownTypes returns items whose type is not Writer, Title, or Reference
func (a *App) GetItemsWithUnknownTypes() ([]map[string]interface{}, error) {
	return a.itemService.GetItemsWithUnknownTypes()
}

// GetUnknownTags returns items with tags other than {word:, {writer:, or {title:
func (a *App) GetUnknownTags() ([]map[string]interface{}, error) {
	return a.itemService.GetUnknownTags()
}

// MergeDuplicateItems merges duplicate items into the original by redirecting links and deleting duplicates
func (a *App) MergeDuplicateItems(originalID int, duplicateIDs []int) error {
	return a.itemService.MergeDuplicateItems(originalID, duplicateIDs)
}
