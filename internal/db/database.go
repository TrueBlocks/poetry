package db

import (
	"database/sql"
	"database/sql/driver"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/TrueBlocks/trueblocks-poetry/v2/pkg/constants"
	sqlite "modernc.org/sqlite"
)

func init() {
	sqlite.MustRegisterDeterministicScalarFunction("regexp", 2,
		func(_ *sqlite.FunctionContext, args []driver.Value) (driver.Value, error) {
			pattern, ok1 := args[0].(string)
			text, ok2 := args[1].(string)
			if !ok1 || !ok2 {
				return int64(0), nil
			}
			matched, err := regexp.MatchString(pattern, text)
			if err != nil {
				return int64(0), nil
			}
			if matched {
				return int64(1), nil
			}
			return int64(0), nil
		},
	)
}

// DB represents the database connection
type DB struct {
	conn *sql.DB
}

// Conn returns the underlying sql.DB connection
func (db *DB) Conn() *sql.DB {
	return db.conn
}

// Entity represents a generic entity
type Entity struct {
	ID             int                    `json:"id"`
	TypeSlug       string                 `json:"typeSlug"`
	PrimaryLabel   string                 `json:"primaryLabel"`
	SecondaryLabel *string                `json:"secondaryLabel"`
	Description    *string                `json:"description"`
	Attributes     map[string]interface{} `json:"attributes"`
	CreatedAt      time.Time              `json:"createdAt" ts_type:"Date"`
	UpdatedAt      time.Time              `json:"updatedAt" ts_type:"Date"`
}

// Relationship represents a generic relationship
type Relationship struct {
	ID        int       `json:"id"`
	SourceID  int       `json:"sourceId"`
	TargetID  int       `json:"targetId"`
	Label     string    `json:"label"`
	CreatedAt time.Time `json:"createdAt" ts_type:"Date"`
}

// Source represents a reference source entry
type Source struct {
	SourceID  int       `json:"sourceId"`
	Title     string    `json:"title"`
	Author    *string   `json:"author"`
	Notes     *string   `json:"notes"`
	CreatedAt time.Time `json:"createdAt" ts_type:"Date"`
}

// DashboardStats represents extended database statistics
type DashboardStats struct {
	TotalEntities int `json:"totalEntities"`
	TotalLinks    int `json:"totalLinks"`
	QuoteCount    int `json:"quoteCount"`  // Definitions with quotes
	CitedCount    int `json:"citedCount"`  // Items with a Source
	WriterCount   int `json:"writerCount"` // Items of type 'Writer'
	PoetCount     int `json:"poetCount"`   // Writers with image and poems
	TitleCount    int `json:"titleCount"`  // Items of type 'Title'
	WordCount     int `json:"wordCount"`   // Items of type 'Reference' (Words)
	ErrorCount    int `json:"errorCount"`  // Sum of Orphans + Stubs
}

// NewDB creates a new database connection
func NewDB(dbPath string) (*DB, error) {
	conn, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Configure SQLite for concurrent writes
	// WAL mode allows concurrent readers during writes
	if _, err := conn.Exec("PRAGMA journal_mode = WAL"); err != nil {
		return nil, fmt.Errorf("failed to set WAL mode: %w", err)
	}

	// Set busy timeout to 5 seconds - retries if database is locked
	if _, err := conn.Exec("PRAGMA busy_timeout = 5000"); err != nil {
		return nil, fmt.Errorf("failed to set busy timeout: %w", err)
	}

	// Enable foreign keys
	if _, err := conn.Exec("PRAGMA foreign_keys = ON"); err != nil {
		return nil, fmt.Errorf("failed to enable foreign keys: %w", err)
	}

	triggers := []string{"cliches_ai", "cliches_ad", "cliches_au", "literary_terms_ai", "literary_terms_ad", "literary_terms_au"}
	for _, trigger := range triggers {
		if _, err := conn.Exec(fmt.Sprintf("DROP TRIGGER IF EXISTS %s", trigger)); err != nil {
			slog.Warn("Failed to drop trigger", "trigger", trigger, "error", err)
		}
	}

	// Test connection
	if err := conn.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return &DB{conn: conn}, nil
}

// Checkpoint flushes the WAL to the main database file
func (db *DB) Checkpoint() error {
	slog.Info("[DB] Checkpointing WAL")
	_, err := db.conn.Exec("PRAGMA wal_checkpoint(TRUNCATE)")
	if err != nil {
		slog.Error("[DB] WAL checkpoint failed", "error", err)
		return fmt.Errorf("failed to checkpoint WAL: %w", err)
	}
	slog.Info("[DB] WAL checkpoint succeeded")
	return nil
}

// CleanOrphanedLinks removes links that point to non-existent items
func (db *DB) CleanOrphanedLinks() (int, error) {
	slog.Info("[DB] Cleaning orphaned links")

	result, err := db.conn.Exec(`
		DELETE FROM relationships 
		WHERE NOT EXISTS (SELECT 1 FROM entities WHERE id = relationships.target_id)
		   OR NOT EXISTS (SELECT 1 FROM entities WHERE id = relationships.source_id)
	`)
	if err != nil {
		slog.Error("[DB] Failed to clean orphaned links", "error", err)
		return 0, fmt.Errorf("failed to clean orphaned links: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		slog.Error("[DB] Failed to get rows affected", "error", err)
		return 0, fmt.Errorf("failed to get rows affected: %w", err)
	}

	slog.Info("[DB] Cleaned orphaned links", "count", rows)
	return int(rows), nil
}

// Close closes the database connection and checkpoints the WAL
func (db *DB) Close() error {
	// Checkpoint and truncate WAL file before closing
	_, err := db.conn.Exec("PRAGMA wal_checkpoint(TRUNCATE)")
	if err != nil {
		slog.Warn("[DB] Warning: WAL checkpoint failed", "error", err)
	}
	return db.conn.Close()
}

// Query executes a query that returns rows
func (db *DB) Query(query string, args ...interface{}) (*sql.Rows, error) {
	return db.conn.Query(query, args...)
}

// GetStats returns database statistics
func (db *DB) GetStats() (map[string]int, error) {
	stats := make(map[string]int)

	// Entities (Reference, Writer, Title)
	var entitiesCount int
	if err := db.conn.QueryRow("SELECT COUNT(*) FROM entities WHERE type_slug IN ('reference', 'writer', 'title')").Scan(&entitiesCount); err != nil {
		return nil, fmt.Errorf("failed to count entities: %w", err)
	}
	stats["entities"] = entitiesCount

	// Links
	var linksCount int
	if err := db.conn.QueryRow("SELECT COUNT(*) FROM relationships").Scan(&linksCount); err != nil {
		return nil, fmt.Errorf("failed to count links: %w", err)
	}
	stats["links"] = linksCount

	// Cliches
	var clichesCount int
	if err := db.conn.QueryRow("SELECT COUNT(*) FROM cliches").Scan(&clichesCount); err != nil {
		return nil, fmt.Errorf("failed to count cliches: %w", err)
	}
	stats["cliches"] = clichesCount

	// Names
	var namesCount int
	if err := db.conn.QueryRow("SELECT COUNT(*) FROM names").Scan(&namesCount); err != nil {
		return nil, fmt.Errorf("failed to count names: %w", err)
	}
	stats["names"] = namesCount

	// Literary Terms
	var termsCount int
	if err := db.conn.QueryRow("SELECT COUNT(*) FROM literary_terms").Scan(&termsCount); err != nil {
		return nil, fmt.Errorf("failed to count literary terms: %w", err)
	}
	stats["literary_terms"] = termsCount

	// Sources
	var sourcesCount int
	if err := db.conn.QueryRow("SELECT COUNT(*) FROM sources").Scan(&sourcesCount); err != nil {
		return nil, fmt.Errorf("failed to count sources: %w", err)
	}
	stats["sources"] = sourcesCount

	return stats, nil
}

// GetExtendedStats returns detailed database statistics
func (db *DB) GetExtendedStats() (*DashboardStats, error) {
	stats := &DashboardStats{}

	// Total Items
	// Total Entities
	if err := db.conn.QueryRow("SELECT COUNT(*) FROM entities").Scan(&stats.TotalEntities); err != nil {
		return nil, fmt.Errorf("failed to count entities: %w", err)
	}

	// Total Links
	if err := db.conn.QueryRow("SELECT COUNT(*) FROM relationships").Scan(&stats.TotalLinks); err != nil {
		return nil, fmt.Errorf("failed to count links: %w", err)
	}

	// Orphans (Items with no links)
	var orphanCount int
	queryOrphans := MustLoadQuery("orphan_entities")
	if err := db.conn.QueryRow(queryOrphans).Scan(&orphanCount); err != nil {
		return nil, fmt.Errorf("failed to count orphans: %w", err)
	}

	// Quotes (Titles with brackets in definition)
	// Note: This SQL query approximates the logic in parser.IsPoem()
	// We use LIKE for performance instead of fetching all rows to check balanced brackets
	queryQuotes := MustLoadQuery("quotes_count")
	if err := db.conn.QueryRow(queryQuotes).Scan(&stats.QuoteCount); err != nil {
		return nil, fmt.Errorf("failed to count quotes: %w", err)
	}

	// Cited (Items with a source)
	queryCited := MustLoadQuery("cited_count")
	if err := db.conn.QueryRow(queryCited).Scan(&stats.CitedCount); err != nil {
		return nil, fmt.Errorf("failed to count cited items: %w", err)
	}

	// Stubs (Items with no definition)
	var stubCount int
	queryStubs := MustLoadQuery("stubs_count")
	if err := db.conn.QueryRow(queryStubs).Scan(&stubCount); err != nil {
		return nil, fmt.Errorf("failed to count stubs: %w", err)
	}

	// Writers
	queryWriters := MustLoadQuery("writers_count")
	if err := db.conn.QueryRow(queryWriters).Scan(&stats.WriterCount); err != nil {
		return nil, fmt.Errorf("failed to count writers: %w", err)
	}

	// Poets (Writers with image and poems)
	queryWritersList := MustLoadQuery("writers")
	rows, err := db.conn.Query(queryWritersList)
	if err != nil {
		return nil, fmt.Errorf("failed to query writers for poet count: %w", err)
	}
	defer func() { _ = rows.Close() }()

	imagesDir, err := constants.GetImagesDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get images dir: %w", err)
	}

	poetCount := 0
	for rows.Next() {
		var itemId int
		if err := rows.Scan(&itemId); err != nil {
			continue
		}

		// Check image
		imagePath := filepath.Join(imagesDir, fmt.Sprintf("%d.png", itemId))
		if _, err := os.Stat(imagePath); os.IsNotExist(err) {
			continue
		}

		// Check linked poems (incoming links from Titles)
		var poemCount int
		queryPoems := MustLoadQuery("poems_for_writer")
		if err := db.conn.QueryRow(queryPoems, itemId).Scan(&poemCount); err != nil {
			continue
		}

		if poemCount > 0 {
			poetCount++
		}
	}
	stats.PoetCount = poetCount

	// Titles
	queryTitles := MustLoadQuery("titles_count")
	if err := db.conn.QueryRow(queryTitles).Scan(&stats.TitleCount); err != nil {
		return nil, fmt.Errorf("failed to count titles: %w", err)
	}

	// Words (Reference)
	queryWords := MustLoadQuery("words_count")
	if err := db.conn.QueryRow(queryWords).Scan(&stats.WordCount); err != nil {
		return nil, fmt.Errorf("failed to count words: %w", err)
	}

	// Self Referential Items
	var selfRefCount int
	querySelfRef := MustLoadQuery("self_ref_entities")

	rows, err = db.conn.Query(querySelfRef)
	if err != nil {
		return nil, fmt.Errorf("failed to query self ref items: %w", err)
	}
	defer func() { _ = rows.Close() }()

	for rows.Next() {
		var itemID int
		var word, itemType string
		var definition, derivation, appendicies *string

		if err := rows.Scan(&itemID, &word, &itemType, &definition, &derivation, &appendicies); err != nil {
			continue
		}

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

		var prefix string
		switch strings.ToLower(itemType) {
		case constants.EntityTypeTitle:
			prefix = constants.EntityTypeTitle
		case constants.EntityTypeWriter:
			prefix = constants.EntityTypeWriter
		case constants.EntityTypeReference:
			prefix = constants.EntityTypeWord
		default:
			continue
		}

		escapedWord := regexp.QuoteMeta(word)
		pattern := fmt.Sprintf(`(?i)\{%s:\s*%s\}`, prefix, escapedWord)
		re, err := regexp.Compile(pattern)
		if err != nil {
			continue
		}

		if (def != "" && re.MatchString(def)) ||
			(der != "" && re.MatchString(der)) ||
			(app != "" && re.MatchString(app)) {
			selfRefCount++
		}
	}

	// Errors = Orphans + Stubs + SelfRef
	stats.ErrorCount = orphanCount + stubCount + selfRefCount

	return stats, nil
}

// StripPossessive removes possessive suffixes from text, handling both regular (') and curly (') apostrophes.
// Examples: "Shakespeare's" -> "Shakespeare", "Burns'" -> "Burns"
func StripPossessive(text string) string {
	if strings.HasSuffix(text, "s'") {
		return strings.TrimSuffix(text, "'")
	}
	if strings.HasSuffix(text, "s\u2019") {
		return strings.TrimSuffix(text, "\u2019")
	}
	if strings.HasSuffix(text, "'s") {
		return strings.TrimSuffix(text, "'s")
	}
	if strings.HasSuffix(text, "\u2019s") {
		return strings.TrimSuffix(text, "\u2019s")
	}
	return text
}

// CreateLink creates a link between two items
func (db *DB) CreateLink(sourceID, destID int, linkType string) error {
	query := `
		INSERT INTO relationships (source_id, target_id, label)
		VALUES (?, ?, ?)
	`

	_, err := db.conn.Exec(query, sourceID, destID, linkType)
	if err != nil {
		return fmt.Errorf("failed to create link: %w", err)
	}

	return nil
}

// DeleteLink deletes a link
func (db *DB) DeleteLink(linkID int) error {
	slog.Info("[DB] DeleteLink called", "linkID", linkID)
	result, err := db.conn.Exec("DELETE FROM relationships WHERE id = ?", linkID)
	if err != nil {
		slog.Error("[DB] DeleteLink SQL exec failed", "error", err)
		return fmt.Errorf("failed to delete link: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		slog.Error("[DB] DeleteLink failed to get rows affected", "error", err)
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	slog.Info("[DB] DeleteLink affected rows", "rows", rows)
	if rows == 0 {
		slog.Warn("[DB] DeleteLink found no link", "linkID", linkID)
		return fmt.Errorf("link not found")
	}

	slog.Info("[DB] DeleteLink succeeded", "linkID", linkID)
	return nil
}

// DeleteLinkByItems deletes a link between two items
func (db *DB) DeleteLinkByItems(sourceItemID, destinationItemID int) error {
	result, err := db.conn.Exec("DELETE FROM relationships WHERE source_id = ? AND target_id = ?", sourceItemID, destinationItemID)
	if err != nil {
		return fmt.Errorf("failed to delete link: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		return fmt.Errorf("link not found")
	}

	return nil
}

// UpdateLinksDestination updates all links pointing to oldItemID to point to newItemID
func (db *DB) UpdateLinksDestination(oldItemID, newItemID int) error {
	query := `UPDATE relationships SET target_id = ? WHERE target_id = ?`
	_, err := db.conn.Exec(query, newItemID, oldItemID)
	if err != nil {
		return fmt.Errorf("failed to update link destinations: %w", err)
	}
	return nil
}

// UpdateLinksSource updates all links originating from oldItemID to originate from newItemID
func (db *DB) UpdateLinksSource(oldItemID, newItemID int) error {
	query := `UPDATE relationships SET source_id = ? WHERE source_id = ?`
	_, err := db.conn.Exec(query, newItemID, oldItemID)
	if err != nil {
		return fmt.Errorf("failed to update link sources: %w", err)
	}
	return nil
}

// Helper functions

// GetAllSources returns all sources
func (db *DB) GetAllSources() ([]Source, error) {
	query := MustLoadQuery("all_sources")
	rows, err := db.conn.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get all sources: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var sources []Source
	for rows.Next() {
		var s Source
		if err := rows.Scan(&s.SourceID, &s.Title, &s.Author, &s.Notes, &s.CreatedAt); err != nil {
			return nil, err
		}
		sources = append(sources, s)
	}
	return sources, rows.Err()
}

// GetGenderByFirstName returns the gender ("male", "female", or empty string) for a given first name
func (db *DB) GetGenderByFirstName(firstName string) (string, error) {
	var gender sql.NullString
	err := db.conn.QueryRow(`
		SELECT gender
		FROM names 
		WHERE type = 'first' AND LOWER(name) = LOWER(?)
		LIMIT 1
	`, firstName).Scan(&gender)

	if err == sql.ErrNoRows {
		return "", nil // Not found, return empty string
	}
	if err != nil {
		return "", fmt.Errorf("failed to get gender for name %s: %w", firstName, err)
	}

	if gender.Valid {
		return gender.String, nil
	}
	return "", nil
}

// ToggleEntityMark toggles the mark attribute for an entity
func (db *DB) ToggleEntityMark(entityID int, marked bool) error {
	if !marked {
		_, err := db.conn.Exec(`UPDATE entities SET attributes = json_remove(COALESCE(attributes, '{}'), '$.mark') WHERE id = ?`, entityID)
		if err != nil {
			return fmt.Errorf("failed to unmark entity: %w", err)
		}
		return nil
	}

	_, err := db.conn.Exec(`UPDATE entities SET attributes = json_set(COALESCE(attributes, '{}'), '$.mark', 1) WHERE id = ?`, entityID)
	if err != nil {
		return fmt.Errorf("failed to mark entity: %w", err)
	}
	return nil
}

// DeleteEntity deletes an entity by ID
func (db *DB) DeleteEntity(id int) error {
	_, err := db.conn.Exec("DELETE FROM entities WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete entity: %w", err)
	}
	return nil
}

// GetSetting retrieves a setting value from the database
func (db *DB) GetSetting(key string) (string, error) {
	var value string
	err := db.conn.QueryRow("SELECT value FROM settings WHERE key = ?", key).Scan(&value)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("failed to get setting: %w", err)
	}
	return value, nil
}

// SetSetting stores or updates a setting value in the database
func (db *DB) SetSetting(key, value string) error {
	_, err := db.conn.Exec(`
		INSERT INTO settings (key, value, updated_at) 
		VALUES (?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(key) DO UPDATE SET 
			value = excluded.value,
			updated_at = CURRENT_TIMESTAMP
	`, key, value)
	if err != nil {
		return fmt.Errorf("failed to set setting: %w", err)
	}
	return nil
}

// SyncFileFlags updates has_image and has_tts flags based on existing files.
// This function is idempotent and can be called multiple times safely.
func (db *DB) SyncFileFlags() error {
	slog.Info("Starting file flags sync...")

	// Get all item IDs
	rows, err := db.conn.Query("SELECT id FROM entities")
	if err != nil {
		return fmt.Errorf("failed to query entities: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var itemIDs []int
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			return fmt.Errorf("failed to scan entity ID: %w", err)
		}
		itemIDs = append(itemIDs, id)
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("error iterating entities: %w", err)
	}

	// Get directory paths
	imagesDir, err := constants.GetImagesDir()
	if err != nil {
		return fmt.Errorf("failed to get images directory: %w", err)
	}

	ttsDir, err := constants.GetTTSCacheDir()
	if err != nil {
		return fmt.Errorf("failed to get TTS cache directory: %w", err)
	}

	// Check for existing files and update flags
	imageCount := 0
	ttsCount := 0

	for _, itemID := range itemIDs {
		var hasImage, hasTTS int

		// Check for image file
		imagePath := filepath.Join(imagesDir, fmt.Sprintf("%d.png", itemID))
		if _, err := os.Stat(imagePath); err == nil {
			hasImage = 1
			imageCount++
		}

		// Check for TTS file
		ttsPath := filepath.Join(ttsDir, fmt.Sprintf("%d.mp3", itemID))
		if _, err := os.Stat(ttsPath); err == nil {
			hasTTS = 1
			ttsCount++
		}

		// Update database flags in attributes JSON
		_, err := db.conn.Exec(`
			UPDATE entities 
			SET attributes = json_set(COALESCE(attributes, '{}'), '$.has_image', ?, '$.has_tts', ?)
			WHERE id = ?
		`, hasImage, hasTTS, itemID)

		if err != nil {
			return fmt.Errorf("failed to update flags for item %d: %w", itemID, err)
		}
	}

	slog.Info("File flags sync complete",
		"total_items", len(itemIDs),
		"images_found", imageCount,
		"tts_found", ttsCount)

	return nil
}
