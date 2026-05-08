package services

import (
	"testing"

	"github.com/TrueBlocks/trueblocks-poetry/v2/internal/db"
	"github.com/TrueBlocks/trueblocks-poetry/v2/pkg/constants"
)

// minimalSchema is a trimmed-down version of schema.sql sufficient for
// EntityService round-trip tests. The fts5 virtual table and triggers from
// the production schema are intentionally omitted — entity_service does not
// query them.
const minimalSchema = `
CREATE TABLE entities (
    id INTEGER PRIMARY KEY,
    type_slug TEXT NOT NULL,
    primary_label TEXT NOT NULL,
    secondary_label TEXT,
    description TEXT,
    attributes JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE relationships (
    id INTEGER PRIMARY KEY,
    source_id INTEGER NOT NULL,
    target_id INTEGER NOT NULL,
    label TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_id) REFERENCES entities(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES entities(id) ON DELETE CASCADE
);
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`

func newTestService(t *testing.T) *EntityService {
	t.Helper()
	dbPath := t.TempDir() + "/test.db"
	d, err := db.NewDB(dbPath)
	if err != nil {
		t.Fatalf("NewDB: %v", err)
	}
	t.Cleanup(func() { _ = d.Close() })
	if _, err := d.Conn().Exec(minimalSchema); err != nil {
		t.Fatalf("schema: %v", err)
	}
	return NewEntityService(d)
}

func TestEntityServiceCreateGetUpdate(t *testing.T) {
	svc := newTestService(t)

	desc := "A great writer."
	in := db.Entity{
		TypeSlug:     constants.EntityTypeWriter,
		PrimaryLabel: "Shakespeare",
		Description:  &desc,
	}
	id, err := svc.CreateEntity(in)
	if err != nil {
		t.Fatalf("CreateEntity: %v", err)
	}
	if id <= 0 {
		t.Fatalf("got id %d, want > 0", id)
	}

	got, err := svc.GetEntity(id)
	if err != nil {
		t.Fatalf("GetEntity: %v", err)
	}
	if got.PrimaryLabel != "Shakespeare" {
		t.Errorf("PrimaryLabel = %q, want Shakespeare", got.PrimaryLabel)
	}
	if got.TypeSlug != constants.EntityTypeWriter {
		t.Errorf("TypeSlug = %q, want %q", got.TypeSlug, constants.EntityTypeWriter)
	}

	got.PrimaryLabel = "William Shakespeare"
	if err := svc.UpdateEntity(*got); err != nil {
		t.Fatalf("UpdateEntity: %v", err)
	}
	got2, err := svc.GetEntity(id)
	if err != nil {
		t.Fatalf("GetEntity (after update): %v", err)
	}
	if got2.PrimaryLabel != "William Shakespeare" {
		t.Errorf("PrimaryLabel after update = %q, want William Shakespeare", got2.PrimaryLabel)
	}
}

func TestEntityServiceGetAllEntities(t *testing.T) {
	svc := newTestService(t)

	for _, label := range []string{"alpha", "beta", "gamma"} {
		if _, err := svc.CreateEntity(db.Entity{
			TypeSlug:     constants.EntityTypeReference,
			PrimaryLabel: label,
		}); err != nil {
			t.Fatalf("CreateEntity %q: %v", label, err)
		}
	}

	all, err := svc.GetAllEntities()
	if err != nil {
		t.Fatalf("GetAllEntities: %v", err)
	}
	if len(all) != 3 {
		t.Fatalf("len(all) = %d, want 3", len(all))
	}
}

func TestEntityServiceRelationshipsRoundTrip(t *testing.T) {
	svc := newTestService(t)

	srcID, err := svc.CreateEntity(db.Entity{
		TypeSlug:     constants.EntityTypeWriter,
		PrimaryLabel: "Keats",
	})
	if err != nil {
		t.Fatalf("CreateEntity src: %v", err)
	}
	dstID, err := svc.CreateEntity(db.Entity{
		TypeSlug:     constants.EntityTypeTitle,
		PrimaryLabel: "Ode on a Grecian Urn",
	})
	if err != nil {
		t.Fatalf("CreateEntity dst: %v", err)
	}

	if err := svc.db.CreateLink(srcID, dstID, "author_of"); err != nil {
		t.Fatalf("CreateLink: %v", err)
	}

	rels, err := svc.GetAllRelationships()
	if err != nil {
		t.Fatalf("GetAllRelationships: %v", err)
	}
	if len(rels) != 1 {
		t.Fatalf("len(rels) = %d, want 1", len(rels))
	}
	if rels[0].SourceID != srcID || rels[0].TargetID != dstID {
		t.Errorf("rel = {%d -> %d}, want {%d -> %d}", rels[0].SourceID, rels[0].TargetID, srcID, dstID)
	}
}
