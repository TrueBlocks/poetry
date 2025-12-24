package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/TrueBlocks/trueblocks-poetry/backend/database"
	"github.com/TrueBlocks/trueblocks-poetry/pkg/constants"
	"github.com/TrueBlocks/trueblocks-poetry/pkg/parser"
)

// Example: {word:shakespeare} becomes **<small>SHAKESPEARE</small>**
func resolveTagsForMarkdown(text string) string {
	return parser.ReplaceTags(text, func(ref parser.Reference) string {
		// Convert to uppercase for small caps effect and wrap in bold + small tag
		return fmt.Sprintf("**<small>%s</small>**", strings.ToUpper(ref.Value))
	})
}

// copyImageToExport copies an image file to the export folder's images subdirectory
func copyImageToExport(itemID int, exportFolder string) (string, error) {
	imagesDir, err := constants.GetImagesDir()
	if err != nil {
		return "", err
	}

	srcPath := filepath.Join(imagesDir, fmt.Sprintf("%d.png", itemID))

	// Check if source image exists
	if _, err := os.Stat(srcPath); os.IsNotExist(err) {
		return "", nil
	}

	// Create images subdirectory in export folder
	exportImagesDir := filepath.Join(exportFolder, "images")
	if err := os.MkdirAll(exportImagesDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create export images directory: %w", err)
	}

	// Copy image to export folder
	destPath := filepath.Join(exportImagesDir, fmt.Sprintf("%d.png", itemID))
	data, err := os.ReadFile(srcPath)
	if err != nil {
		return "", fmt.Errorf("failed to read image: %w", err)
	}

	if err := os.WriteFile(destPath, data, 0644); err != nil {
		return "", fmt.Errorf("failed to write image: %w", err)
	}

	// Return relative path for markdown
	return fmt.Sprintf("images/%d.png", itemID), nil
}

// writeItemToMarkdown writes an item's details to the markdown builder
func writeItemToMarkdown(item database.Item, markdown *strings.Builder, exportFolder string) {
	fmt.Fprintf(markdown, "## %s\n\n", item.Word)
	fmt.Fprintf(markdown, "**Type:** %s\n\n", item.Type)

	// Add image if present
	if item.HasImage == 1 {
		if imagePath, err := copyImageToExport(item.ItemID, exportFolder); err == nil && imagePath != "" {
			fmt.Fprintf(markdown, "![%s](%s)\n\n", item.Word, imagePath)
		}
	}

	// Add TTS note if present
	if item.HasTts == 1 {
		markdown.WriteString("🔊 **Has TTS**\n\n")
	}

	if item.Definition != nil && *item.Definition != "" {
		resolved := resolveTagsForMarkdown(*item.Definition)
		fmt.Fprintf(markdown, "### Definition\n\n%s\n\n", resolved)
	}

	if item.Derivation != nil && *item.Derivation != "" {
		resolved := resolveTagsForMarkdown(*item.Derivation)
		fmt.Fprintf(markdown, "### Etymology\n\n%s\n\n", resolved)
	}

	if item.Appendicies != nil && *item.Appendicies != "" {
		resolved := resolveTagsForMarkdown(*item.Appendicies)
		fmt.Fprintf(markdown, "### Notes\n\n%s\n\n", resolved)
	}

	if (item.Source != nil && *item.Source != "") || (item.SourcePg != nil && *item.SourcePg != "") {
		if item.Source != nil {
			resolved := resolveTagsForMarkdown(*item.Source)
			fmt.Fprintf(markdown, "**Source:** %s", resolved)
		}
		if item.SourcePg != nil && *item.SourcePg != "" {
			fmt.Fprintf(markdown, ", p. %s", *item.SourcePg)
		}
		markdown.WriteString("\n\n")
	}

	markdown.WriteString("---\n\n")
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

	// Set up export folder early
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
		writeItemToMarkdown(item, &markdown, exportFolder)
	}

	// Writers Section
	markdown.WriteString("\n# Writers\n\n")
	markdown.WriteString("[↑ Back to top](#top)\n\n")
	for _, item := range writers {
		writeItemToMarkdown(item, &markdown, exportFolder)
	}

	// Titles Section
	markdown.WriteString("\n# Titles\n\n")
	markdown.WriteString("[↑ Back to top](#top)\n\n")
	for _, item := range titles {
		writeItemToMarkdown(item, &markdown, exportFolder)
	}

	// Other Section
	markdown.WriteString("\n# Other\n\n")
	markdown.WriteString("[↑ Back to top](#top)\n\n")
	for _, item := range other {
		writeItemToMarkdown(item, &markdown, exportFolder)
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
				item.Word, item.Type, item.RefCount))
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
		markdown.WriteString("| Stripped Word | Count |\n")
		markdown.WriteString("|---------------|-------|\n")
		for _, item := range duplicates {
			markdown.WriteString(fmt.Sprintf("| %s | %v |\n", item.StrippedWord, item.Count))
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
			markdown.WriteString(fmt.Sprintf("| %s | %s |\n", item.Word, item.Type))
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
				item.Word, item.Type, len(item.MissingReferences)))
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
			markdown.WriteString(fmt.Sprintf("| %s | %s |\n", item.Word, item.Type))
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
			markdown.WriteString(fmt.Sprintf("| %s | %s |\n", item.Word, item.Type))
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
				item.Word, item.Type, item.TagCount))
		}
		markdown.WriteString("\n")
	} else {
		markdown.WriteString("✓ No unknown tags found.\n\n")
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
