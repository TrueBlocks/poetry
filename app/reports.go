package app

import (
	"fmt"
	"sort"
	"strings"

	"github.com/TrueBlocks/trueblocks-poetry/v2/internal/db"
	"github.com/TrueBlocks/trueblocks-poetry/v2/internal/services"
	"github.com/TrueBlocks/trueblocks-poetry/v2/pkg/constants"
	"github.com/TrueBlocks/trueblocks-poetry/v2/pkg/parser"
)

func (a *App) GetUnlinkedReferences() ([]services.UnlinkedReferenceResult, error) {
	allEntities, err := a.entityService.GetAllEntities()
	if err != nil {
		return nil, fmt.Errorf("failed to get entities: %w", err)
	}

	allRelationships, err := a.entityService.GetAllRelationships()
	if err != nil {
		return nil, fmt.Errorf("failed to get relationships: %w", err)
	}

	entitiesByLabel := make(map[string]*db.Entity)
	for i := range allEntities {
		entitiesByLabel[strings.ToLower(allEntities[i].PrimaryLabel)] = &allEntities[i]
	}

	relationshipsMap := make(map[int]map[int]bool)
	for _, rel := range allRelationships {
		if relationshipsMap[rel.SourceID] == nil {
			relationshipsMap[rel.SourceID] = make(map[int]bool)
		}
		relationshipsMap[rel.SourceID][rel.TargetID] = true
	}

	var results []services.UnlinkedReferenceResult

	for i := range allEntities {
		entity := &allEntities[i]
		if entity.Description == nil || *entity.Description == "" {
			continue
		}

		unlinkedRefs := []services.UnlinkedReferenceDetail{}

		refs := parser.ParseReferences(*entity.Description)
		for _, ref := range refs {
			refType := ref.Type
			refWord := ref.Value

			matchWord := refWord
			if refType == constants.EntityTypeWriter {
				lowerWord := strings.ToLower(refWord)
				if strings.HasSuffix(lowerWord, "'s") {
					matchWord = refWord[:len(refWord)-2]
				} else if strings.HasSuffix(lowerWord, "s'") {
					matchWord = refWord[:len(refWord)-1]
				}
			}

			matchedEntity := entitiesByLabel[strings.ToLower(matchWord)]
			if matchedEntity == nil {
				unlinkedRefs = append(unlinkedRefs, services.UnlinkedReferenceDetail{
					Ref:    refWord,
					Reason: "missing",
				})
			} else {
				if relationshipsMap[entity.ID] == nil || !relationshipsMap[entity.ID][matchedEntity.ID] {
					unlinkedRefs = append(unlinkedRefs, services.UnlinkedReferenceDetail{
						Ref:    refWord,
						Reason: "unlinked",
					})
				}
			}
		}

		if len(unlinkedRefs) > 0 {
			results = append(results, services.UnlinkedReferenceResult{
				ID:           entity.ID,
				PrimaryLabel: entity.PrimaryLabel,
				TypeSlug:     entity.TypeSlug,
				UnlinkedRefs: unlinkedRefs,
				RefCount:     len(unlinkedRefs),
			})
		}
	}

	return results, nil
}

func (a *App) GetAllSources() ([]db.Source, error) {
	return a.db.GetAllSources()
}

func (a *App) GetDuplicateEntities() ([]services.DuplicateEntityResult, error) {
	allEntities, err := a.entityService.GetAllEntities()
	if err != nil {
		return nil, fmt.Errorf("failed to get entities: %w", err)
	}

	groups := make(map[string][]db.Entity)
	for _, entity := range allEntities {
		stripped := strings.ToLower(db.StripPossessive(entity.PrimaryLabel))
		groups[stripped] = append(groups[stripped], entity)
	}

	var results []services.DuplicateEntityResult
	for strippedLabel, entities := range groups {
		if len(entities) > 1 {
			sort.Slice(entities, func(i, j int) bool {
				return entities[i].ID < entities[j].ID
			})

			original := entities[0]
			duplicates := entities[1:]

			duplicateInfo := []services.DuplicateEntityDetail{}
			for _, dup := range duplicates {
				duplicateInfo = append(duplicateInfo, services.DuplicateEntityDetail{
					ID:           dup.ID,
					PrimaryLabel: dup.PrimaryLabel,
					TypeSlug:     dup.TypeSlug,
				})
			}

			results = append(results, services.DuplicateEntityResult{
				StrippedLabel: strippedLabel,
				Original: services.DuplicateEntityDetail{
					ID:           original.ID,
					PrimaryLabel: original.PrimaryLabel,
					TypeSlug:     original.TypeSlug,
				},
				Duplicates: duplicateInfo,
				Count:      len(duplicates),
			})
		}
	}

	return results, nil
}

func (a *App) MergeDuplicateEntities(originalID int, duplicateIDs []int) error {
	for _, dupID := range duplicateIDs {
		if err := a.db.UpdateLinksDestination(dupID, originalID); err != nil {
			return fmt.Errorf("failed to update link destinations for %d: %w", dupID, err)
		}
		if err := a.db.UpdateLinksSource(dupID, originalID); err != nil {
			return fmt.Errorf("failed to update link sources for %d: %w", dupID, err)
		}
		if err := a.db.DeleteEntity(dupID); err != nil {
			return fmt.Errorf("failed to delete duplicate entity %d: %w", dupID, err)
		}
	}
	return nil
}

func (a *App) GetSelfReferentialEntities() ([]services.SelfReferenceResult, error) {
	allEntities, err := a.entityService.GetAllEntities()
	if err != nil {
		return nil, fmt.Errorf("failed to get entities: %w", err)
	}

	var results []services.SelfReferenceResult

	for _, entity := range allEntities {
		if entity.Description == nil || *entity.Description == "" {
			continue
		}

		var prefix string
		switch entity.TypeSlug {
		case constants.EntityTypeTitle:
			prefix = constants.EntityTypeTitle
		case constants.EntityTypeWriter:
			prefix = constants.EntityTypeWriter
		case constants.EntityTypeReference:
			prefix = constants.EntityTypeWord
		default:
			continue
		}

		re, err := parser.GetSpecificReferenceRegex(prefix, entity.PrimaryLabel)
		if err != nil {
			continue
		}

		if re.MatchString(*entity.Description) {
			results = append(results, services.SelfReferenceResult{
				ID:           entity.ID,
				PrimaryLabel: entity.PrimaryLabel,
				TypeSlug:     entity.TypeSlug,
				Tag:          fmt.Sprintf("{%s: %s}", prefix, entity.PrimaryLabel),
			})
		}
	}
	return results, nil
}

func (a *App) GetOrphanedEntities() ([]services.OrphanedEntityResult, error) {
	allEntities, err := a.entityService.GetAllEntities()
	if err != nil {
		return nil, fmt.Errorf("failed to get entities: %w", err)
	}

	allRelationships, err := a.entityService.GetAllRelationships()
	if err != nil {
		return nil, fmt.Errorf("failed to get relationships: %w", err)
	}

	connectedEntities := make(map[int]bool)
	for _, rel := range allRelationships {
		connectedEntities[rel.SourceID] = true
		connectedEntities[rel.TargetID] = true
	}

	var results []services.OrphanedEntityResult
	for _, entity := range allEntities {
		if !connectedEntities[entity.ID] {
			results = append(results, services.OrphanedEntityResult{
				ID:           entity.ID,
				PrimaryLabel: entity.PrimaryLabel,
				TypeSlug:     entity.TypeSlug,
			})
		}
	}

	return results, nil
}

func (a *App) GetLinkedEntitiesNotInDescription() ([]services.LinkedEntityNotInDescriptionResult, error) {
	allEntities, err := a.entityService.GetAllEntities()
	if err != nil {
		return nil, fmt.Errorf("failed to get entities: %w", err)
	}

	allRelationships, err := a.entityService.GetAllRelationships()
	if err != nil {
		return nil, fmt.Errorf("failed to get relationships: %w", err)
	}

	type linkInfo struct {
		Label string
		RelID int
	}
	linkedLabels := make(map[int][]linkInfo)
	entitiesByID := make(map[int]db.Entity)
	for _, e := range allEntities {
		entitiesByID[e.ID] = e
	}

	for _, rel := range allRelationships {
		if target, ok := entitiesByID[rel.TargetID]; ok {
			linkedLabels[rel.SourceID] = append(linkedLabels[rel.SourceID], linkInfo{target.PrimaryLabel, rel.ID})
		}
	}

	var results []services.LinkedEntityNotInDescriptionResult

	for _, entity := range allEntities {
		if entity.Description == nil || *entity.Description == "" {
			continue
		}

		labels, hasLinks := linkedLabels[entity.ID]
		if !hasLinks {
			continue
		}

		description := strings.ToLower(*entity.Description)

		if val, ok := entity.Attributes["derivation"]; ok {
			if str, ok := val.(string); ok {
				description += " " + strings.ToLower(str)
			}
		}
		if val, ok := entity.Attributes["appendicies"]; ok {
			if str, ok := val.(string); ok {
				description += " " + strings.ToLower(str)
			}
		}

		description = strings.ReplaceAll(description, "'s}", "}")
		description = strings.ReplaceAll(description, "s'}", "s}")
		description = strings.ReplaceAll(description, "\u2019s}", "}")
		description = strings.ReplaceAll(description, "s\u2019}", "s}")

		var missingReferences []services.MissingReferenceDetail
		for _, info := range labels {
			normalizedLabel := strings.ToLower(db.StripPossessive(info.Label))
			if !strings.Contains(description, normalizedLabel+"}") {
				missingReferences = append(missingReferences, services.MissingReferenceDetail{
					Label:          info.Label,
					RelationshipID: info.RelID,
				})
			}
		}

		if len(missingReferences) > 0 {
			results = append(results, services.LinkedEntityNotInDescriptionResult{
				ID:                entity.ID,
				PrimaryLabel:      entity.PrimaryLabel,
				TypeSlug:          entity.TypeSlug,
				MissingReferences: missingReferences,
			})
		}
	}

	return results, nil
}

func (a *App) GetEntitiesWithoutDescriptions() ([]services.EntityWithoutDescriptionResult, error) {
	allEntities, err := a.entityService.GetAllEntities()
	if err != nil {
		return nil, err
	}

	var results []services.EntityWithoutDescriptionResult
	for _, entity := range allEntities {
		if entity.Description == nil || *entity.Description == "" {
			results = append(results, services.EntityWithoutDescriptionResult{
				ID:             entity.ID,
				PrimaryLabel:   entity.PrimaryLabel,
				TypeSlug:       entity.TypeSlug,
				HasMissingData: true,
			})
		}
	}
	return results, nil
}

func (a *App) GetEntitiesWithUnknownTypes() ([]services.EntityWithUnknownTypeResult, error) {
	allEntities, err := a.entityService.GetAllEntities()
	if err != nil {
		return nil, err
	}

	var results []services.EntityWithUnknownTypeResult
	knownTypes := map[string]bool{
		constants.EntityTypeWriter:    true,
		constants.EntityTypeTitle:     true,
		constants.EntityTypeReference: true,
	}

	for _, entity := range allEntities {
		if !knownTypes[strings.ToLower(entity.TypeSlug)] {
			results = append(results, services.EntityWithUnknownTypeResult{
				ID:           entity.ID,
				PrimaryLabel: entity.PrimaryLabel,
				TypeSlug:     entity.TypeSlug,
			})
		}
	}
	return results, nil
}

func (a *App) GetUnknownTags() ([]services.UnknownTagResult, error) {
	allEntities, err := a.entityService.GetAllEntities()
	if err != nil {
		return nil, err
	}

	var results []services.UnknownTagResult
	for _, entity := range allEntities {
		if entity.Description == nil {
			continue
		}

		refs := parser.ParseReferences(*entity.Description)
		var unknownTags []string
		for _, ref := range refs {
			if ref.Type != constants.EntityTypeWord && ref.Type != constants.EntityTypeWriter && ref.Type != constants.EntityTypeTitle {
				unknownTags = append(unknownTags, ref.Original)
			}
		}

		if len(unknownTags) > 0 {
			results = append(results, services.UnknownTagResult{
				ID:           entity.ID,
				PrimaryLabel: entity.PrimaryLabel,
				TypeSlug:     entity.TypeSlug,
				UnknownTags:  unknownTags,
				TagCount:     len(unknownTags),
			})
		}
	}
	return results, nil
}

func (a *App) GetDanglingRelationships() ([]services.DanglingRelationshipResult, error) {
	allRelationships, err := a.entityService.GetAllRelationships()
	if err != nil {
		return nil, err
	}

	var results []services.DanglingRelationshipResult
	for _, rel := range allRelationships {
		source, err := a.entityService.GetEntity(rel.SourceID)
		if err != nil {
			results = append(results, services.DanglingRelationshipResult{
				RelationshipID: rel.ID,
				SourceID:       rel.SourceID,
				TargetID:       rel.TargetID,
				Label:          rel.Label,
				MissingSide:    "source",
			})
			continue
		}

		_, err = a.entityService.GetEntity(rel.TargetID)
		if err != nil {
			results = append(results, services.DanglingRelationshipResult{
				RelationshipID: rel.ID,
				SourceID:       rel.SourceID,
				TargetID:       rel.TargetID,
				Label:          rel.Label,
				SourceLabel:    source.PrimaryLabel,
				SourceType:     source.TypeSlug,
				MissingSide:    "target",
			})
		}
	}
	return results, nil
}
