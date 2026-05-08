package services

import (
	"encoding/json"
	"log/slog"
	"strings"
	"time"

	"github.com/TrueBlocks/trueblocks-poetry/v2/internal/db"
	"github.com/TrueBlocks/trueblocks-poetry/v2/pkg/constants"
	"github.com/TrueBlocks/trueblocks-poetry/v2/pkg/parser"
)

type EntityService struct {
	db *db.DB
}

func NewEntityService(db *db.DB) *EntityService {
	return &EntityService{db: db}
}

func (s *EntityService) SetDB(db *db.DB) { s.db = db }

func (s *EntityService) GetEntity(id int) (*db.Entity, error) {
	query := `SELECT id, type_slug, primary_label, secondary_label, description, attributes, created_at, updated_at FROM entities WHERE id = ?`
	row := s.db.Conn().QueryRow(query, id)

	var e db.Entity
	var attrJSON []byte

	err := row.Scan(&e.ID, &e.TypeSlug, &e.PrimaryLabel, &e.SecondaryLabel, &e.Description, &attrJSON, &e.CreatedAt, &e.UpdatedAt)
	if err != nil {
		return nil, err
	}

	if len(attrJSON) > 0 {
		if err := json.Unmarshal(attrJSON, &e.Attributes); err != nil {
			slog.Error("Failed to unmarshal attributes", "id", id, "error", err)
			e.Attributes = make(map[string]interface{})
		}
	}

	return &e, nil
}

func (s *EntityService) SearchEntities(query string, typeSlug string) ([]db.Entity, error) {
	var sqlQuery string
	var args []interface{}

	if query != "" {
		// Note: Using 'entities_fts' table name in MATCH clause
		sqlQuery = `SELECT e.id, e.type_slug, e.primary_label, e.secondary_label, e.description, e.attributes, e.created_at, e.updated_at 
		            FROM entities e 
		            JOIN entities_fts fts ON e.id = fts.rowid 
		            WHERE entities_fts MATCH ?`
		args = append(args, query)
	} else {
		sqlQuery = `SELECT id, type_slug, primary_label, secondary_label, description, attributes, created_at, updated_at FROM entities e WHERE 1=1`
	}

	if typeSlug != "" {
		sqlQuery += " AND e.type_slug = ?"
		args = append(args, typeSlug)
	}

	sqlQuery += " ORDER BY e.primary_label LIMIT 100"

	rows, err := s.db.Conn().Query(sqlQuery, args...)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := rows.Close(); err != nil {
			slog.Error("Failed to close rows", "error", err)
		}
	}()

	var entities []db.Entity
	for rows.Next() {
		var e db.Entity
		var attrJSON []byte
		if err := rows.Scan(&e.ID, &e.TypeSlug, &e.PrimaryLabel, &e.SecondaryLabel, &e.Description, &attrJSON, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, err
		}
		if len(attrJSON) > 0 {
			if err := json.Unmarshal(attrJSON, &e.Attributes); err != nil {
				slog.Error("Failed to unmarshal attributes", "error", err)
			}
		}
		entities = append(entities, e)
	}
	return entities, nil
}

func (s *EntityService) GetRelationships(entityID int) ([]db.Relationship, error) {
	query := `SELECT id, source_id, target_id, label, created_at FROM relationships WHERE source_id = ? OR target_id = ?`
	rows, err := s.db.Conn().Query(query, entityID, entityID)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := rows.Close(); err != nil {
			slog.Error("Failed to close rows", "error", err)
		}
	}()

	var relationships []db.Relationship
	for rows.Next() {
		var r db.Relationship
		if err := rows.Scan(&r.ID, &r.SourceID, &r.TargetID, &r.Label, &r.CreatedAt); err != nil {
			return nil, err
		}
		relationships = append(relationships, r)
	}
	return relationships, nil
}

func (s *EntityService) GetRelationshipsWithDetails(entityID int) ([]RelationshipDetail, error) {
	query := `
		SELECT 
			r.id, r.source_id, r.target_id, r.label,
			CASE WHEN r.source_id = ? THEN r.target_id ELSE r.source_id END as other_id,
			e.primary_label,
			e.type_slug
		FROM relationships r
		JOIN entities e ON e.id = (CASE WHEN r.source_id = ? THEN r.target_id ELSE r.source_id END)
		WHERE r.source_id = ? OR r.target_id = ?
		ORDER BY e.primary_label
	`
	rows, err := s.db.Conn().Query(query, entityID, entityID, entityID, entityID)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := rows.Close(); err != nil {
			slog.Error("Failed to close rows", "error", err)
		}
	}()

	var details []RelationshipDetail
	for rows.Next() {
		var r RelationshipDetail
		if err := rows.Scan(&r.ID, &r.SourceID, &r.TargetID, &r.Label, &r.OtherEntityID, &r.OtherEntityLabel, &r.OtherEntityType); err != nil {
			return nil, err
		}
		details = append(details, r)
	}
	return details, nil
}

func (s *EntityService) CreateRelationship(sourceID, targetID int, label string) error {
	query := `INSERT INTO relationships (source_id, target_id, label) VALUES (?, ?, ?)`
	_, err := s.db.Conn().Exec(query, sourceID, targetID, label)
	return err
}

func (s *EntityService) DeleteRelationship(id int) error {
	query := `DELETE FROM relationships WHERE id = ?`
	_, err := s.db.Conn().Exec(query, id)
	return err
}

func (s *EntityService) GetAllRelationships() ([]db.Relationship, error) {
	query := `SELECT id, source_id, target_id, label, created_at FROM relationships`
	rows, err := s.db.Conn().Query(query)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := rows.Close(); err != nil {
			slog.Error("Failed to close rows", "error", err)
		}
	}()

	var relationships []db.Relationship
	for rows.Next() {
		var r db.Relationship
		if err := rows.Scan(&r.ID, &r.SourceID, &r.TargetID, &r.Label, &r.CreatedAt); err != nil {
			return nil, err
		}
		relationships = append(relationships, r)
	}
	return relationships, nil
}

func (s *EntityService) CreateEntity(e db.Entity) (int, error) {
	query := `INSERT INTO entities (type_slug, primary_label, secondary_label, description, attributes, created_at, updated_at) 
	          VALUES (?, ?, ?, ?, ?, ?, ?)`

	// Re-parse definition to ensure it's in sync
	if e.Description != nil {
		if e.Attributes == nil {
			e.Attributes = make(map[string]interface{})
		}
		isPoem := strings.ToLower(e.TypeSlug) == constants.EntityTypeTitle
		segments := parser.ParseDefinition(*e.Description, isPoem)
		e.Attributes["parsedDefinition"] = segments
	}

	attrJSON, err := json.Marshal(e.Attributes)
	if err != nil {
		return 0, err
	}

	res, err := s.db.Conn().Exec(query, e.TypeSlug, e.PrimaryLabel, e.SecondaryLabel, e.Description, attrJSON, time.Now(), time.Now())
	if err != nil {
		return 0, err
	}
	id, err := res.LastInsertId()
	return int(id), err
}

func (s *EntityService) UpdateEntity(e db.Entity) error {
	query := `UPDATE entities SET type_slug=?, primary_label=?, secondary_label=?, description=?, attributes=?, updated_at=? WHERE id=?`

	// Re-parse definition to ensure it's in sync
	if e.Description != nil {
		if e.Attributes == nil {
			e.Attributes = make(map[string]interface{})
		}
		isPoem := strings.ToLower(e.TypeSlug) == constants.EntityTypeTitle
		segments := parser.ParseDefinition(*e.Description, isPoem)
		e.Attributes["parsedDefinition"] = segments
	}

	attrJSON, err := json.Marshal(e.Attributes)
	if err != nil {
		return err
	}

	_, err = s.db.Conn().Exec(query, e.TypeSlug, e.PrimaryLabel, e.SecondaryLabel, e.Description, attrJSON, time.Now(), e.ID)
	return err
}

func (s *EntityService) DeleteEntity(id int) error {
	// Delete relationships
	_, err := s.db.Conn().Exec("DELETE FROM relationships WHERE source_id = ? OR target_id = ?", id, id)
	if err != nil {
		return err
	}

	_, err = s.db.Conn().Exec("DELETE FROM entities WHERE id = ?", id)
	return err
}

func (s *EntityService) SearchEntitiesWithOptions(query string, types []string, source string) ([]db.Entity, error) {
	var args []interface{}
	var sqlQuery string

	if query != "" {
		// Use FTS
		sqlQuery = `SELECT e.id, e.type_slug, e.primary_label, e.secondary_label, e.description, e.attributes, e.created_at, e.updated_at 
		            FROM entities e 
		            JOIN entities_fts fts ON e.id = fts.rowid 
		            WHERE entities_fts MATCH ?`
		args = append(args, query)
	} else {
		sqlQuery = `SELECT id, type_slug, primary_label, secondary_label, description, attributes, created_at, updated_at FROM entities e WHERE 1=1`
	}

	if len(types) > 0 {
		placeholders := make([]string, len(types))
		for i, t := range types {
			placeholders[i] = "?"
			args = append(args, t)
		}
		sqlQuery += " AND e.type_slug IN (" + strings.Join(placeholders, ",") + ")"
	}

	if source != "" {
		// Source is in attributes JSON
		sqlQuery += " AND json_extract(e.attributes, '$.source') LIKE ?"
		args = append(args, "%"+source+"%")
	}

	sqlQuery += " ORDER BY e.primary_label LIMIT 100"

	rows, err := s.db.Conn().Query(sqlQuery, args...)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := rows.Close(); err != nil {
			slog.Error("Failed to close rows", "error", err)
		}
	}()

	var entities []db.Entity
	for rows.Next() {
		var e db.Entity
		var attrJSON []byte
		if err := rows.Scan(&e.ID, &e.TypeSlug, &e.PrimaryLabel, &e.SecondaryLabel, &e.Description, &attrJSON, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, err
		}
		if len(attrJSON) > 0 {
			if err := json.Unmarshal(attrJSON, &e.Attributes); err != nil {
				slog.Error("Failed to unmarshal attributes", "error", err)
			}
		}
		entities = append(entities, e)
	}
	return entities, nil
}

func (s *EntityService) GetEgoGraph(entityID int) (*GraphData, error) {
	// Get the central entity
	center, err := s.GetEntity(entityID)
	if err != nil {
		return nil, err
	}

	nodes := []db.Entity{*center}
	edges := []db.Relationship{}
	nodeMap := make(map[int]bool)
	nodeMap[entityID] = true

	// Get relationships
	rels, err := s.GetRelationships(entityID)
	if err != nil {
		return nil, err
	}

	for _, r := range rels {
		edges = append(edges, r)

		otherID := r.SourceID
		if otherID == entityID {
			otherID = r.TargetID
		}

		if !nodeMap[otherID] {
			other, err := s.GetEntity(otherID)
			if err != nil {
				// Skip if not found
				continue
			}
			nodes = append(nodes, *other)
			nodeMap[otherID] = true
		}
	}

	return &GraphData{
		Nodes: nodes,
		Edges: edges,
	}, nil
}

func (s *EntityService) GetAllGraphData() (*GraphData, error) {
	nodes, err := s.GetAllEntities()
	if err != nil {
		return nil, err
	}

	edges, err := s.GetAllRelationships()
	if err != nil {
		return nil, err
	}

	return &GraphData{
		Nodes: nodes,
		Edges: edges,
	}, nil
}

func (s *EntityService) GetAllEntities() ([]db.Entity, error) {
	query := `SELECT id, type_slug, primary_label, secondary_label, description, attributes, created_at, updated_at FROM entities ORDER BY primary_label`
	rows, err := s.db.Conn().Query(query)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var entities []db.Entity
	for rows.Next() {
		var e db.Entity
		var attrJSON []byte
		if err := rows.Scan(&e.ID, &e.TypeSlug, &e.PrimaryLabel, &e.SecondaryLabel, &e.Description, &attrJSON, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, err
		}
		if len(attrJSON) > 0 {
			if err := json.Unmarshal(attrJSON, &e.Attributes); err != nil {
				slog.Error("Failed to unmarshal attributes", "error", err)
			}
		}
		entities = append(entities, e)
	}
	return entities, nil
}

func (s *EntityService) GetRandomEntity() (*db.Entity, error) {
	query := `SELECT id FROM entities ORDER BY RANDOM() LIMIT 1`
	var id int
	err := s.db.Conn().QueryRow(query).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.GetEntity(id)
}

func (s *EntityService) GetExtendedStats() (*db.DashboardStats, error) {
	return s.db.GetExtendedStats()
}

func (s *EntityService) GetTopHubs(limit int) ([]db.Entity, error) {
	query := `
		SELECT e.id, COUNT(r.id) as rel_count
		FROM entities e
		JOIN relationships r ON e.id = r.source_id OR e.id = r.target_id
		WHERE (json_extract(e.attributes, '$.mark') IS NULL OR json_extract(e.attributes, '$.mark') != 1)
		GROUP BY e.id
		ORDER BY rel_count DESC
		LIMIT ?
	`
	rows, err := s.db.Conn().Query(query, limit)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var entities []db.Entity
	for rows.Next() {
		var id, count int
		if err := rows.Scan(&id, &count); err != nil {
			return nil, err
		}
		e, err := s.GetEntity(id)
		if err == nil {
			if e.Attributes == nil {
				e.Attributes = make(map[string]interface{})
			}
			e.Attributes["linkCount"] = count
			entities = append(entities, *e)
		}
	}
	return entities, nil
}

func (s *EntityService) GetMarkedEntities() ([]db.Entity, error) {
	query := `SELECT id FROM entities WHERE json_extract(attributes, '$.mark') IS NOT NULL AND json_extract(attributes, '$.mark') != ''`
	rows, err := s.db.Conn().Query(query)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var entities []db.Entity
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		e, err := s.GetEntity(id)
		if err == nil {
			entities = append(entities, *e)
		}
	}
	return entities, nil
}
