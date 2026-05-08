package app

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	appkit "github.com/TrueBlocks/trueblocks-art/packages/appkit/v2"
	"github.com/TrueBlocks/trueblocks-poetry/v2/internal/db"
	"github.com/TrueBlocks/trueblocks-poetry/v2/pkg/constants"
	"github.com/TrueBlocks/trueblocks-poetry/v2/pkg/parser"
)

func resolveTagsForMarkdown(text string) string {
	return parser.ReplaceTags(text, func(ref parser.Reference) string {
		return fmt.Sprintf("**<small>%s</small>**", strings.ToUpper(ref.Value))
	})
}

func copyImageToExport(itemID int, exportFolder string) (string, error) {
	imagesDir, err := constants.GetImagesDir()
	if err != nil {
		return "", err
	}

	srcPath := filepath.Join(imagesDir, fmt.Sprintf("%d.png", itemID))

	if _, err := os.Stat(srcPath); os.IsNotExist(err) {
		return "", nil
	}

	exportImagesDir := filepath.Join(exportFolder, "images")
	if err := os.MkdirAll(exportImagesDir, appkit.DirPermissions); err != nil {
		return "", fmt.Errorf("failed to create export images directory: %w", err)
	}

	destPath := filepath.Join(exportImagesDir, fmt.Sprintf("%d.png", itemID))
	data, err := os.ReadFile(srcPath)
	if err != nil {
		return "", fmt.Errorf("failed to read image: %w", err)
	}

	if err := os.WriteFile(destPath, data, appkit.FilePermissions); err != nil {
		return "", fmt.Errorf("failed to write image: %w", err)
	}

	return fmt.Sprintf("images/%d.png", itemID), nil
}

func writeItemToMarkdown(item db.Entity, markdown *strings.Builder, exportFolder string) {
	fmt.Fprintf(markdown, "## %s\n\n", item.PrimaryLabel)
	fmt.Fprintf(markdown, "**Type:** %s\n\n", item.TypeSlug)

	getAttr := func(key string) string {
		if val, ok := item.Attributes[key]; ok {
			if str, ok := val.(string); ok {
				return str
			}
		}
		return ""
	}

	getBoolAttr := func(keys ...string) bool {
		for _, key := range keys {
			if val, ok := item.Attributes[key]; ok {
				if b, ok := val.(bool); ok {
					return b
				}
				if f, ok := val.(float64); ok {
					return f == 1
				}
				if i, ok := val.(int); ok {
					return i == 1
				}
			}
		}
		return false
	}

	if getBoolAttr("has_image", "hasImage") {
		if imagePath, err := copyImageToExport(item.ID, exportFolder); err == nil && imagePath != "" {
			fmt.Fprintf(markdown, "![%s](%s)\n\n", item.PrimaryLabel, imagePath)
		}
	}

	if getBoolAttr("has_tts", "hasTts") {
		markdown.WriteString("\xf0\x9f\x94\x8a **Has TTS**\n\n")
	}

	if item.Description != nil && *item.Description != "" {
		resolved := resolveTagsForMarkdown(*item.Description)
		fmt.Fprintf(markdown, "### Definition\n\n%s\n\n", resolved)
	}

	derivation := getAttr("derivation")
	if derivation != "" {
		resolved := resolveTagsForMarkdown(derivation)
		fmt.Fprintf(markdown, "### Etymology\n\n%s\n\n", resolved)
	}

	appendicies := getAttr("appendicies")
	if appendicies != "" {
		resolved := resolveTagsForMarkdown(appendicies)
		fmt.Fprintf(markdown, "### Notes\n\n%s\n\n", resolved)
	}

	source := getAttr("source")
	sourcePg := getAttr("source_pg")
	if sourcePg == "" {
		sourcePg = getAttr("sourcePg")
	}
	if source != "" || sourcePg != "" {
		if source != "" {
			resolved := resolveTagsForMarkdown(source)
			fmt.Fprintf(markdown, "**Source:** %s", resolved)
		}
		if sourcePg != "" {
			fmt.Fprintf(markdown, ", p. %s", sourcePg)
		}
		markdown.WriteString("\n\n")
	}

	markdown.WriteString("---\n\n")
}

func (a *App) ExportToJSON() (string, error) {
	items, err := a.entityService.GetAllEntities()
	if err != nil {
		return "", fmt.Errorf("failed to get items: %w", err)
	}

	links, err := a.entityService.GetAllRelationships()
	if err != nil {
		return "", fmt.Errorf("failed to get links: %w", err)
	}

	var references []db.Entity
	var writers []db.Entity
	var titles []db.Entity
	var other []db.Entity

	for _, item := range items {
		switch item.TypeSlug {
		case constants.EntityTypeReference:
			references = append(references, item)
		case constants.EntityTypeWriter:
			writers = append(writers, item)
		case constants.EntityTypeTitle:
			titles = append(titles, item)
		default:
			other = append(other, item)
		}
	}

	sort.Slice(references, func(i, j int) bool {
		return strings.ToLower(references[i].PrimaryLabel) < strings.ToLower(references[j].PrimaryLabel)
	})
	sort.Slice(writers, func(i, j int) bool {
		return strings.ToLower(writers[i].PrimaryLabel) < strings.ToLower(writers[j].PrimaryLabel)
	})
	sort.Slice(titles, func(i, j int) bool {
		return strings.ToLower(titles[i].PrimaryLabel) < strings.ToLower(titles[j].PrimaryLabel)
	})
	sort.Slice(other, func(i, j int) bool {
		return strings.ToLower(other[i].PrimaryLabel) < strings.ToLower(other[j].PrimaryLabel)
	})

	unlinkedRefs, _ := a.GetUnlinkedReferences()
	duplicates, _ := a.GetDuplicateEntities()
	orphanedItems, _ := a.GetOrphanedEntities()
	linkedNotInDef, _ := a.GetLinkedEntitiesNotInDescription()
	missingDefs, _ := a.GetEntitiesWithoutDescriptions()
	unknownTypes, _ := a.GetEntitiesWithUnknownTypes()
	unknownTags, _ := a.GetUnknownTags()

	s := a.settings.Get()

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

	exportFolder = s.ExportFolder
	if exportFolder == "" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return "", fmt.Errorf("failed to get home directory: %w", err)
		}
		exportFolder = filepath.Join(homeDir, "Documents", "Poetry", "exports")
	}

	if err := os.MkdirAll(exportFolder, appkit.DirPermissions); err != nil {
		return "", fmt.Errorf("failed to create export directory: %w", err)
	}

	filename := "poetry-database.json"
	fullPath := filepath.Join(exportFolder, filename)

	err = os.WriteFile(fullPath, jsonData, appkit.FilePermissions)
	if err != nil {
		return "", fmt.Errorf("failed to write file: %w", err)
	}

	return fullPath, nil
}

func (a *App) ExportToMarkdown() (string, error) {
	items, err := a.entityService.GetAllEntities()
	if err != nil {
		return "", fmt.Errorf("failed to get items: %w", err)
	}

	var references []db.Entity
	var writers []db.Entity
	var titles []db.Entity
	var other []db.Entity

	for _, item := range items {
		switch item.TypeSlug {
		case constants.EntityTypeReference:
			references = append(references, item)
		case constants.EntityTypeWriter:
			writers = append(writers, item)
		case constants.EntityTypeTitle:
			titles = append(titles, item)
		default:
			other = append(other, item)
		}
	}

	sort.Slice(references, func(i, j int) bool {
		return strings.ToLower(references[i].PrimaryLabel) < strings.ToLower(references[j].PrimaryLabel)
	})
	sort.Slice(writers, func(i, j int) bool {
		return strings.ToLower(writers[i].PrimaryLabel) < strings.ToLower(writers[j].PrimaryLabel)
	})
	sort.Slice(titles, func(i, j int) bool {
		return strings.ToLower(titles[i].PrimaryLabel) < strings.ToLower(titles[j].PrimaryLabel)
	})
	sort.Slice(other, func(i, j int) bool {
		return strings.ToLower(other[i].PrimaryLabel) < strings.ToLower(other[j].PrimaryLabel)
	})

	s := a.settings.Get()

	dbPath, _ := constants.GetDatabasePath()
	exportFolder := s.ExportFolder

	if exportFolder == "" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return "", fmt.Errorf("failed to get home directory: %w", err)
		}
		exportFolder = filepath.Join(homeDir, "Documents", "PoetryExports")
	}

	if err := os.MkdirAll(exportFolder, appkit.DirPermissions); err != nil {
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

	markdown.WriteString("## Table of Contents\n\n")
	markdown.WriteString("1. [References](#references)\n")
	markdown.WriteString("2. [Writers](#writers)\n")
	markdown.WriteString("3. [Titles](#titles)\n")
	markdown.WriteString("4. [Other](#other)\n")
	markdown.WriteString("5. [Data Quality Reports](#data-quality-reports)\n\n")
	markdown.WriteString("---\n\n")

	markdown.WriteString("# References\n\n")
	markdown.WriteString("[^ Back to top](#top)\n\n")
	for _, item := range references {
		writeItemToMarkdown(item, &markdown, exportFolder)
	}

	markdown.WriteString("\n# Writers\n\n")
	markdown.WriteString("[^ Back to top](#top)\n\n")
	for _, item := range writers {
		writeItemToMarkdown(item, &markdown, exportFolder)
	}

	markdown.WriteString("\n# Titles\n\n")
	markdown.WriteString("[^ Back to top](#top)\n\n")
	for _, item := range titles {
		writeItemToMarkdown(item, &markdown, exportFolder)
	}

	markdown.WriteString("\n# Other\n\n")
	markdown.WriteString("[^ Back to top](#top)\n\n")
	for _, item := range other {
		writeItemToMarkdown(item, &markdown, exportFolder)
	}

	markdown.WriteString("\n\n# Data Quality Reports\n\n")
	markdown.WriteString("[^ Back to top](#top)\n\n")

	unlinkedRefs, _ := a.GetUnlinkedReferences()
	markdown.WriteString(fmt.Sprintf("## Unlinked References (%d)\n\n", len(unlinkedRefs)))
	markdown.WriteString("[^ Back to top](#top)\n\n")
	if len(unlinkedRefs) > 0 {
		markdown.WriteString("Items containing reference tags without corresponding links.\n\n")
		markdown.WriteString("| Word | Type | Unlinked Count |\n")
		markdown.WriteString("|------|------|----------------|\n")
		for _, item := range unlinkedRefs {
			markdown.WriteString(fmt.Sprintf("| %s | %s | %v |\n",
				item.PrimaryLabel, item.TypeSlug, item.RefCount))
		}
		markdown.WriteString("\n")
	} else {
		markdown.WriteString("No unlinked references found.\n\n")
	}

	duplicates, _ := a.GetDuplicateEntities()
	markdown.WriteString(fmt.Sprintf("## Duplicate Items (%d)\n\n", len(duplicates)))
	markdown.WriteString("[^ Back to top](#top)\n\n")
	if len(duplicates) > 0 {
		markdown.WriteString("Items with duplicate stripped names.\n\n")
		markdown.WriteString("| Stripped Word | Count |\n")
		markdown.WriteString("|---------------|-------|\n")
		for _, item := range duplicates {
			markdown.WriteString(fmt.Sprintf("| %s | %v |\n", item.StrippedLabel, item.Count))
		}
		markdown.WriteString("\n")
	} else {
		markdown.WriteString("No duplicate items found.\n\n")
	}

	orphanedItems, _ := a.GetOrphanedEntities()
	markdown.WriteString(fmt.Sprintf("## Orphaned Items (%d)\n\n", len(orphanedItems)))
	markdown.WriteString("[^ Back to top](#top)\n\n")
	if len(orphanedItems) > 0 {
		markdown.WriteString("Items with no incoming or outgoing links.\n\n")
		markdown.WriteString("| Word | Type |\n")
		markdown.WriteString("|------|------|\n")
		for _, item := range orphanedItems {
			markdown.WriteString(fmt.Sprintf("| %s | %s |\n", item.PrimaryLabel, item.TypeSlug))
		}
		markdown.WriteString("\n")
	} else {
		markdown.WriteString("No orphaned items found.\n\n")
	}

	linkedNotInDef, _ := a.GetLinkedEntitiesNotInDescription()
	markdown.WriteString(fmt.Sprintf("## Linked Items Not In Definition (%d)\n\n", len(linkedNotInDef)))
	markdown.WriteString("[^ Back to top](#top)\n\n")
	if len(linkedNotInDef) > 0 {
		markdown.WriteString("Items that have links but those linked items aren't referenced in the definition.\n\n")
		markdown.WriteString("| Word | Type | Unreferenced Count |\n")
		markdown.WriteString("|------|------|--------------------|\n")
		for _, item := range linkedNotInDef {
			markdown.WriteString(fmt.Sprintf("| %s | %s | %v |\n",
				item.PrimaryLabel, item.TypeSlug, len(item.MissingReferences)))
		}
		markdown.WriteString("\n")
	} else {
		markdown.WriteString("No unreferenced links found.\n\n")
	}

	missingDefs, _ := a.GetEntitiesWithoutDescriptions()
	markdown.WriteString(fmt.Sprintf("## Items Without Definitions (%d)\n\n", len(missingDefs)))
	markdown.WriteString("[^ Back to top](#top)\n\n")
	if len(missingDefs) > 0 {
		markdown.WriteString("Items that have no definition.\n\n")
		markdown.WriteString("| Word | Type |\n")
		markdown.WriteString("|------|------|\n")
		for _, item := range missingDefs {
			markdown.WriteString(fmt.Sprintf("| %s | %s |\n", item.PrimaryLabel, item.TypeSlug))
		}
		markdown.WriteString("\n")
	} else {
		markdown.WriteString("All items have definitions.\n\n")
	}

	unknownTypes, _ := a.GetEntitiesWithUnknownTypes()
	markdown.WriteString(fmt.Sprintf("## Unknown Types (%d)\n\n", len(unknownTypes)))
	markdown.WriteString("[^ Back to top](#top)\n\n")
	if len(unknownTypes) > 0 {
		markdown.WriteString("Items whose type is not Writer, Title, or Reference.\n\n")
		markdown.WriteString("| Word | Type |\n")
		markdown.WriteString("|------|------|\n")
		for _, item := range unknownTypes {
			markdown.WriteString(fmt.Sprintf("| %s | %s |\n", item.PrimaryLabel, item.TypeSlug))
		}
		markdown.WriteString("\n")
	} else {
		markdown.WriteString("All items have valid types.\n\n")
	}

	unknownTags, _ := a.GetUnknownTags()
	markdown.WriteString(fmt.Sprintf("## Unknown Tags (%d)\n\n", len(unknownTags)))
	markdown.WriteString("[^ Back to top](#top)\n\n")
	if len(unknownTags) > 0 {
		markdown.WriteString("Items with tags other than {word:}, {writer:}, or {title:}.\n\n")
		markdown.WriteString("| Word | Type | Unknown Tag Count |\n")
		markdown.WriteString("|------|------|-------------------|\n")
		for _, item := range unknownTags {
			markdown.WriteString(fmt.Sprintf("| %s | %s | %v |\n",
				item.PrimaryLabel, item.TypeSlug, item.TagCount))
		}
		markdown.WriteString("\n")
	} else {
		markdown.WriteString("No unknown tags found.\n\n")
	}

	filename := "poetry-database.md"
	fullPath := filepath.Join(exportFolder, filename)

	err = os.WriteFile(fullPath, []byte(markdown.String()), appkit.FilePermissions)
	if err != nil {
		return "", fmt.Errorf("failed to write file: %w", err)
	}

	return fullPath, nil
}
