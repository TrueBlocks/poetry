package database

import (
	"database/sql"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/TrueBlocks/trueblocks-poetry/pkg/constants"
	"github.com/TrueBlocks/trueblocks-poetry/pkg/parser"
	"github.com/mattn/go-sqlite3"
)

// Build with FTS5 support:
// go build -tags "fts5"

func init() {
	sql.Register("sqlite3_regexp", &sqlite3.SQLiteDriver{
		ConnectHook: func(conn *sqlite3.SQLiteConn) error {
			return conn.RegisterFunc("regexp", func(re, s string) (bool, error) {
				return regexp.MatchString(re, s)
			}, true)
		},
	})
}

// DB represents the database connection
type DB struct {
	conn *sql.DB
}

// Conn returns the underlying sql.DB connection
func (db *DB) Conn() *sql.DB {
	return db.conn
}

// Item represents a word/term entry
type Item struct {
	ItemID      int              `json:"itemId"`
	Word        string           `json:"word"`
	Type        string           `json:"type"`
	Definition  *string          `json:"definition"`
	ParsedDef   []parser.Segment `json:"parsedDefinition,omitempty"`
	Derivation  *string          `json:"derivation"`
	Appendicies *string          `json:"appendicies"`
	Source      *string          `json:"source"`
	SourcePg    *string          `json:"sourcePg"`
	Mark        *string          `json:"mark"`
	CreatedAt   time.Time        `json:"createdAt" ts_type:"Date"`
	ModifiedAt  time.Time        `json:"modifiedAt" ts_type:"Date"`
}

// Link represents a relationship between items
type Link struct {
	LinkID            int       `json:"linkId"`
	SourceItemID      int       `json:"sourceItemId"`
	DestinationItemID int       `json:"destinationItemId"`
	LinkType          string    `json:"linkType"`
	CreatedAt         time.Time `json:"createdAt" ts_type:"Date"`
}

// GraphData represents a subset of the graph
type GraphData struct {
	Items []Item `json:"items"`
	Links []Link `json:"links"`
}

// ItemWithStats includes connection statistics
type ItemWithStats struct {
	Item
	OutgoingCount    int `json:"outgoingCount"`
	IncomingCount    int `json:"incomingCount"`
	TotalConnections int `json:"totalConnections"`
}

// Cliche represents a cliche entry
type Cliche struct {
	ClicheID   int       `json:"clicheId"`
	Phrase     string    `json:"phrase"`
	Definition *string   `json:"definition"`
	CreatedAt  time.Time `json:"createdAt" ts_type:"Date"`
}

// Name represents a proper name entry
type Name struct {
	NameID      int       `json:"nameId"`
	Name        string    `json:"name"`
	Type        *string   `json:"type"`
	Gender      *string   `json:"gender"`
	Description *string   `json:"description"`
	Notes       *string   `json:"notes"`
	CreatedAt   time.Time `json:"createdAt" ts_type:"Date"`
}

// LiteraryTerm represents a literary term entry
type LiteraryTerm struct {
	TermID        int       `json:"termId"`
	Term          string    `json:"term"`
	Type          *string   `json:"type"`
	Definition    *string   `json:"definition"`
	Examples      *string   `json:"examples"`
	Notes         *string   `json:"notes"`
	CreatedAt     time.Time `json:"createdAt" ts_type:"Date"`
	ExistsInItems bool      `json:"existsInItems"`
}

// Source represents a reference source entry
type Source struct {
	SourceID  int       `json:"sourceId"`
	Title     string    `json:"title"`
	Author    *string   `json:"author"`
	Notes     *string   `json:"notes"`
	CreatedAt time.Time `json:"createdAt" ts_type:"Date"`
}

// SearchOptions represents advanced search parameters
type SearchOptions struct {
	Query         string   `json:"query"`
	Types         []string `json:"types"`         // Filter by item types (Reference, Writer, Title)
	Source        string   `json:"source"`        // Filter by source field
	UseRegex      bool     `json:"useRegex"`      // Use regex LIKE instead of FTS5
	CaseSensitive bool     `json:"caseSensitive"` // Case sensitivity for regex mode
	HasImage      bool     `json:"hasImage"`      // Filter items that have images
	HasTts        bool     `json:"hasTts"`        // Filter items that have TTS audio
}

// DashboardStats represents extended database statistics
type DashboardStats struct {
	TotalItems  int `json:"totalItems"`
	TotalLinks  int `json:"totalLinks"`
	QuoteCount  int `json:"quoteCount"`  // Definitions with quotes
	CitedCount  int `json:"citedCount"`  // Items with a Source
	WriterCount int `json:"writerCount"` // Items of type 'Writer'
	PoetCount   int `json:"poetCount"`   // Writers with image and poems
	TitleCount  int `json:"titleCount"`  // Items of type 'Title'
	WordCount   int `json:"wordCount"`   // Items of type 'Reference' (Words)
	ErrorCount  int `json:"errorCount"`  // Sum of Orphans + Stubs
}

// HubItem represents a highly connected item
type HubItem struct {
	ItemID    int     `json:"itemId"`
	Word      string  `json:"word"`
	LinkCount int     `json:"linkCount"`
	Mark      *string `json:"mark"`
}

// normalizeFTS5Query converts lowercase boolean operators to uppercase for FTS5
// and replaces hyphens with spaces to avoid FTS5 column operator syntax errors
func normalizeFTS5Query(query string) string {
	// Replace hyphens with spaces to prevent FTS5 from treating them as column operators
	query = strings.ReplaceAll(query, "-", " ")

	// Replace word-boundary surrounded boolean operators (case-insensitive)
	re := regexp.MustCompile(`(?i)\b(and|or|not)\b`)
	return re.ReplaceAllStringFunc(query, func(match string) string {
		return strings.ToUpper(match)
	})
}

// NewDB creates a new database connection
func NewDB(dbPath string) (*DB, error) {
	conn, err := sql.Open("sqlite3_regexp", dbPath)
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

	// Drop FTS5 triggers if they exist (FTS5 module not available)
	// This allows CRUD operations to work without FTS5
	triggers := []string{"items_ai", "items_ad", "items_au", "cliches_ai", "cliches_ad", "cliches_au", "literary_terms_ai", "literary_terms_ad", "literary_terms_au"}
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
		DELETE FROM links 
		WHERE NOT EXISTS (SELECT 1 FROM items WHERE item_id = links.destination_item_id)
		   OR NOT EXISTS (SELECT 1 FROM items WHERE item_id = links.source_item_id)
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

	tables := []string{"items", "links", "cliches", "names", "literary_terms", "sources"}
	for _, table := range tables {
		var count int
		query := fmt.Sprintf("SELECT COUNT(*) FROM %s", table)
		if err := db.conn.QueryRow(query).Scan(&count); err != nil {
			return nil, fmt.Errorf("failed to count %s: %w", table, err)
		}
		stats[table] = count
	}

	return stats, nil
}

// GetExtendedStats returns detailed database statistics
func (db *DB) GetExtendedStats() (*DashboardStats, error) {
	stats := &DashboardStats{}

	// Total Items
	if err := db.conn.QueryRow("SELECT COUNT(*) FROM items").Scan(&stats.TotalItems); err != nil {
		return nil, fmt.Errorf("failed to count items: %w", err)
	}

	// Total Links
	if err := db.conn.QueryRow("SELECT COUNT(*) FROM links").Scan(&stats.TotalLinks); err != nil {
		return nil, fmt.Errorf("failed to count links: %w", err)
	}

	// Orphans (Items with no links)
	var orphanCount int
	queryOrphans := MustLoadQuery("orphans")
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
	querySelfRef := MustLoadQuery("self_ref_items")

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

// GetPoetIds returns a list of item IDs for writers that have an image and at least one poem
func (db *DB) GetPoetIds() ([]int, error) {
	rows, err := db.conn.Query("SELECT item_id FROM items WHERE type = 'Writer'")
	if err != nil {
		return nil, fmt.Errorf("failed to query writers: %w", err)
	}
	defer func() { _ = rows.Close() }()

	imagesDir, err := constants.GetImagesDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get images dir: %w", err)
	}

	var poetIds []int
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
		queryPoems := `
			SELECT COUNT(*) 
			FROM links l 
			JOIN items i ON l.source_item_id = i.item_id 
			WHERE l.destination_item_id = ? AND i.type = 'Title'
		`
		if err := db.conn.QueryRow(queryPoems, itemId).Scan(&poemCount); err != nil {
			continue
		}

		if poemCount > 0 {
			poetIds = append(poetIds, itemId)
		}
	}

	return poetIds, nil
}

// GetTopHubs returns items with the most connections
func (db *DB) GetTopHubs(limit int) ([]HubItem, error) {
	query := `
		SELECT i.item_id, i.word, COUNT(l.link_id) as link_count, i.mark
		FROM items i
		JOIN links l ON i.item_id = l.source_item_id OR i.item_id = l.destination_item_id
		WHERE i.mark NOT LIKE "1"
		GROUP BY i.item_id
		ORDER BY link_count DESC
		LIMIT ?
	`

	rows, err := db.conn.Query(query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get top hubs: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var hubs []HubItem
	for rows.Next() {
		var hub HubItem
		if err := rows.Scan(&hub.ItemID, &hub.Word, &hub.LinkCount, &hub.Mark); err != nil {
			return nil, fmt.Errorf("failed to scan hub item: %w", err)
		}
		hubs = append(hubs, hub)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("row iteration failed: %w", err)
	}

	return hubs, nil
}

// GetMarkedItems returns items that have a mark
func (db *DB) GetMarkedItems() ([]Item, error) {
	query := `
		SELECT item_id, word, type, definition, derivation,
		       appendicies, source, source_pg, mark, created_at, modified_at
		FROM items
		WHERE mark IS NOT NULL AND mark != ''
		ORDER BY modified_at DESC
	`

	rows, err := db.conn.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get marked items: %w", err)
	}
	defer func() { _ = rows.Close() }()

	return db.scanItems(rows)
}

// SearchItems performs search on items using LIKE
func (db *DB) SearchItems(query string) ([]Item, error) {
	var sqlQuery string
	var rows *sql.Rows
	var err error

	if query == "" {
		// Return all items if query is empty (for reference matching)
		sqlQuery = `
			SELECT item_id, word, type, definition, derivation,
			       appendicies, source, source_pg, mark, created_at, modified_at
			FROM items
			ORDER BY word
		`
		rows, err = db.conn.Query(sqlQuery)
	} else {
		// Normalize FTS5 query (convert lowercase and/or/not to uppercase)
		normalizedQuery := normalizeFTS5Query(query)

		// Try FTS5 search first for better performance and relevance ranking
		sqlQuery = `
			SELECT items.item_id, items.word, items.type, items.definition, items.derivation,
			       items.appendicies, items.source, items.source_pg, items.mark, 
			       items.created_at, items.modified_at
			FROM items_fts
			JOIN items ON items.item_id = items_fts.rowid
			WHERE items_fts MATCH ?
			ORDER BY rank
		`
		rows, err = db.conn.Query(sqlQuery, normalizedQuery)

		// If FTS5 fails (module not available or query syntax error), fall back to LIKE
		if err != nil {
			slog.Warn("[SearchItems] FTS5 search failed, falling back to LIKE", "error", err)
			searchTerm := "%" + query + "%"
			sqlQuery = `
				SELECT item_id, word, type, definition, derivation,
				       appendicies, source, source_pg, mark, created_at, modified_at
				FROM items
				WHERE word LIKE ? OR definition LIKE ? OR derivation LIKE ? OR appendicies LIKE ?
				ORDER BY 
					CASE WHEN LOWER(word) = LOWER(?) THEN 0 ELSE 1 END,
					word
			`
			rows, err = db.conn.Query(sqlQuery, searchTerm, searchTerm, searchTerm, searchTerm, query)
		}
	}

	if err != nil {
		return nil, fmt.Errorf("search failed: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var items []Item
	for rows.Next() {
		var item Item
		err := rows.Scan(
			&item.ItemID, &item.Word, &item.Type, &item.Definition,
			&item.Derivation, &item.Appendicies, &item.Source, &item.SourcePg,
			&item.Mark, &item.CreatedAt, &item.ModifiedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan item: %w", err)
		}
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("row iteration failed: %w", err)
	}

	return items, nil
}

// SearchItemsWithOptions performs search with advanced filtering options
func (db *DB) SearchItemsWithOptions(options SearchOptions) ([]Item, error) {
	var sqlQuery string
	var args []interface{}
	var whereClauses []string

	// Build WHERE clauses for filters
	if len(options.Types) > 0 {
		placeholders := make([]string, len(options.Types))
		for i, t := range options.Types {
			placeholders[i] = "?"
			args = append(args, t)
		}
		whereClauses = append(whereClauses, fmt.Sprintf("items.type IN (%s)", strings.Join(placeholders, ",")))
	}

	if options.Source != "" {
		whereClauses = append(whereClauses, "items.source = ?")
		args = append(args, options.Source)
	}

	if options.HasImage {
		whereClauses = append(whereClauses, "items.has_image = 1")
	}

	if options.HasTts {
		whereClauses = append(whereClauses, "items.has_tts = 1")
	}

	// Empty query returns all items with filters
	if options.Query == "" {
		sqlQuery = `
			SELECT item_id, word, type, definition, derivation,
			       appendicies, source, source_pg, mark, created_at, modified_at
			FROM items
		`
		if len(whereClauses) > 0 {
			sqlQuery += " WHERE " + strings.Join(whereClauses, " AND ")
		}
		sqlQuery += " ORDER BY word"
		rows, err := db.conn.Query(sqlQuery, args...)
		if err != nil {
			return nil, fmt.Errorf("search failed: %w", err)
		}
		return scanItems(rows)
	}

	// Regex mode
	if options.UseRegex {
		searchTerm := options.Query
		if !options.CaseSensitive {
			searchTerm = "(?i)" + searchTerm // SQLite REGEXP with case-insensitive flag
		}

		sqlQuery = `
			SELECT item_id, word, type, definition, derivation,
			       appendicies, source, source_pg, mark, created_at, modified_at
			FROM items
			WHERE (IFNULL(word, '') REGEXP ? OR IFNULL(definition, '') REGEXP ? OR IFNULL(derivation, '') REGEXP ? OR IFNULL(appendicies, '') REGEXP ?)
		`
		if len(whereClauses) > 0 {
			sqlQuery += " AND " + strings.Join(whereClauses, " AND ")
		}
		sqlQuery += " ORDER BY word"

		regexArgs := []interface{}{searchTerm, searchTerm, searchTerm, searchTerm}
		regexArgs = append(regexArgs, args...)
		rows, err := db.conn.Query(sqlQuery, regexArgs...)
		if err != nil {
			return nil, fmt.Errorf("regex search failed: %w", err)
		}
		return scanItems(rows)
	}

	// FTS5 mode with filters
	normalizedQuery := normalizeFTS5Query(options.Query)
	sqlQuery = `
		SELECT items.item_id, items.word, items.type, items.definition, items.derivation,
		       items.appendicies, items.source, items.source_pg, items.mark,
		       items.created_at, items.modified_at
		FROM items_fts
		JOIN items ON items.item_id = items_fts.rowid
		WHERE items_fts MATCH ?
	`
	ftsArgs := []interface{}{normalizedQuery}
	if len(whereClauses) > 0 {
		sqlQuery += " AND " + strings.Join(whereClauses, " AND ")
		ftsArgs = append(ftsArgs, args...)
	}
	sqlQuery += " ORDER BY rank"

	rows, err := db.conn.Query(sqlQuery, ftsArgs...)
	if err != nil {
		// Fallback to LIKE search
		slog.Warn("[SearchItemsWithOptions] FTS5 search failed, falling back to LIKE", "error", err)
		searchTerm := "%" + options.Query + "%"
		sqlQuery = `
			SELECT item_id, word, type, definition, derivation,
			       appendicies, source, source_pg, mark, created_at, modified_at
			FROM items
			WHERE (word LIKE ? OR definition LIKE ? OR derivation LIKE ? OR appendicies LIKE ?)
		`
		likeArgs := []interface{}{searchTerm, searchTerm, searchTerm, searchTerm}
		if len(whereClauses) > 0 {
			sqlQuery += " AND " + strings.Join(whereClauses, " AND ")
			likeArgs = append(likeArgs, args...)
		}
		sqlQuery += " ORDER BY CASE WHEN LOWER(word) = LOWER(?) THEN 0 ELSE 1 END, word"
		likeArgs = append(likeArgs, options.Query)
		rows, err = db.conn.Query(sqlQuery, likeArgs...)
		if err != nil {
			return nil, fmt.Errorf("search failed: %w", err)
		}
	}

	return scanItems(rows)
}

// scanItems is a helper to scan rows into Item slice
func scanItems(rows *sql.Rows) ([]Item, error) {
	defer func() { _ = rows.Close() }()
	var items []Item
	for rows.Next() {
		var item Item
		err := rows.Scan(
			&item.ItemID, &item.Word, &item.Type, &item.Definition,
			&item.Derivation, &item.Appendicies, &item.Source, &item.SourcePg,
			&item.Mark, &item.CreatedAt, &item.ModifiedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan item: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("row iteration failed: %w", err)
	}
	return items, nil
}

// GetItem retrieves a single item by item_id
func (db *DB) GetItem(itemID int) (*Item, error) {
	query := `
		SELECT item_id, word, type, definition, derivation,
		       appendicies, source, source_pg, mark, created_at, modified_at
		FROM items
		WHERE item_id = ?
	`

	item := &Item{}
	err := db.conn.QueryRow(query, itemID).Scan(
		&item.ItemID, &item.Word, &item.Type, &item.Definition,
		&item.Derivation, &item.Appendicies, &item.Source, &item.SourcePg,
		&item.Mark, &item.CreatedAt, &item.ModifiedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("item not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get item: %w", err)
	}

	return item, nil
}

// GetRandomItem retrieves a random item from the database
func (db *DB) GetRandomItem() (*Item, error) {
	query := `
		SELECT item_id, word, type, definition, derivation,
		       appendicies, source, source_pg, mark, created_at, modified_at
		FROM items
		ORDER BY RANDOM()
		LIMIT 1
	`

	item := &Item{}
	err := db.conn.QueryRow(query).Scan(
		&item.ItemID, &item.Word, &item.Type, &item.Definition,
		&item.Derivation, &item.Appendicies, &item.Source, &item.SourcePg,
		&item.Mark, &item.CreatedAt, &item.ModifiedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("no items found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get random item: %w", err)
	}

	return item, nil
}

// GetItemByWord retrieves a single item by word (case-insensitive)
func (db *DB) GetItemByWord(word string) (*Item, error) {
	query := `
		SELECT item_id, word, type, definition, derivation,
		       appendicies, source, source_pg, mark, created_at, modified_at
		FROM items
		WHERE LOWER(word) = LOWER(?)
		LIMIT 1
	`

	item := &Item{}
	err := db.conn.QueryRow(query, word).Scan(
		&item.ItemID, &item.Word, &item.Type, &item.Definition,
		&item.Derivation, &item.Appendicies, &item.Source, &item.SourcePg,
		&item.Mark, &item.CreatedAt, &item.ModifiedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("item not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get item: %w", err)
	}

	return item, nil
}

// stripPossessive removes possessive suffixes from text, handling both regular (') and curly (') apostrophes.
// Examples: "Shakespeare's" -> "Shakespeare", "Burns'" -> "Burns"
func stripPossessive(text string) string {
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

// CreateLinkOrRemoveTags attempts to create a link to the referenced word.
// If the referenced word doesn't exist, it removes the reference tags from the source item's text fields.
// Returns: linkCreated (bool), message (string), error
func (db *DB) CreateLinkOrRemoveTags(sourceItemID int, refWord string) (bool, string, error) {
	slog.Debug("[CreateLinkOrRemoveTags] START", "sourceItemID", sourceItemID, "refWord", refWord)

	matchWord := stripPossessive(refWord)
	if matchWord != refWord {
		slog.Debug("[CreateLinkOrRemoveTags] Stripped possessive", "original", refWord, "stripped", matchWord)
	}

	// Try to find the destination item
	slog.Debug("[CreateLinkOrRemoveTags] Calling GetItemByWord", "word", matchWord)
	destItem, err := db.GetItemByWord(matchWord)
	if err != nil {
		slog.Error("[CreateLinkOrRemoveTags] GetItemByWord ERROR", "error", err)
	} else if destItem == nil {
		slog.Debug("[CreateLinkOrRemoveTags] GetItemByWord returned nil item (no error)")
	} else {
		slog.Debug("[CreateLinkOrRemoveTags] GetItemByWord SUCCESS", "itemID", destItem.ItemID, "word", destItem.Word)
	}

	if err == nil && destItem != nil {
		// Item exists - try to create the link
		slog.Debug("[CreateLinkOrRemoveTags] Attempting to create link", "source", sourceItemID, "dest", destItem.ItemID)
		linkErr := db.CreateLink(sourceItemID, destItem.ItemID, "reference")
		if linkErr == nil {
			slog.Debug("[CreateLinkOrRemoveTags] Link created successfully")
			return true, fmt.Sprintf("Added link to %s", destItem.Word), nil
		}
		slog.Warn("[CreateLinkOrRemoveTags] CreateLink FAILED - will remove tag instead", "error", linkErr)
		// Link creation failed, fall through to remove tag
	}

	// Item doesn't exist or link creation failed - remove the reference tags
	slog.Debug("[CreateLinkOrRemoveTags] Removing tags - getting source item", "sourceItemID", sourceItemID)
	sourceItem, err := db.GetItem(sourceItemID)
	if err != nil {
		slog.Error("[CreateLinkOrRemoveTags] GetItem FAILED", "error", err)
		return false, "", fmt.Errorf("failed to get source item: %w", err)
	}
	slog.Debug("[CreateLinkOrRemoveTags] Got source item", "word", sourceItem.Word)

	// Build regex to match reference tags with optional possessive forms
	regex, err := parser.GetPossessiveReferenceRegex(matchWord)
	if err != nil {
		slog.Error("[CreateLinkOrRemoveTags] Failed to compile regex", "error", err)
		return false, "", fmt.Errorf("failed to compile regex: %w", err)
	}
	slog.Debug("[CreateLinkOrRemoveTags] Regex pattern", "pattern", regex.String())

	// Remove tags from all text fields, keeping the actual word
	updatedDefinition := ""
	defChanged := false
	if sourceItem.Definition != nil {
		originalDef := *sourceItem.Definition
		updatedDefinition = regex.ReplaceAllString(originalDef, "$1")
		defChanged = originalDef != updatedDefinition
	}

	updatedDerivation := ""
	derChanged := false
	if sourceItem.Derivation != nil {
		originalDer := *sourceItem.Derivation
		updatedDerivation = regex.ReplaceAllString(originalDer, "$1")
		derChanged = originalDer != updatedDerivation
	}

	updatedAppendicies := ""
	appChanged := false
	if sourceItem.Appendicies != nil {
		originalApp := *sourceItem.Appendicies
		updatedAppendicies = regex.ReplaceAllString(originalApp, "$1")
		appChanged = originalApp != updatedAppendicies
	}

	// Check if anything actually changed
	if !defChanged && !derChanged && !appChanged {
		slog.Debug("[CreateLinkOrRemoveTags] Nothing changed - returning success")
		return false, "No changes needed", nil
	}

	slog.Debug("[CreateLinkOrRemoveTags] Changes detected", "defChanged", defChanged, "derChanged", derChanged, "appChanged", appChanged)

	// Update the item
	sourceItem.Definition = &updatedDefinition
	sourceItem.Derivation = &updatedDerivation
	sourceItem.Appendicies = &updatedAppendicies

	slog.Debug("[CreateLinkOrRemoveTags] Calling UpdateItem")
	err = db.UpdateItem(*sourceItem)
	if err != nil {
		slog.Error("[CreateLinkOrRemoveTags] UpdateItem FAILED", "error", err)
		return false, "", fmt.Errorf("failed to update item: %w", err)
	}

	slog.Info("[CreateLinkOrRemoveTags] SUCCESS - tags removed")
	return false, fmt.Sprintf("Removed non-existent reference to %s", matchWord), nil
}

// GetItemLinks retrieves all links for an item (both incoming and outgoing)
func (db *DB) GetItemLinks(itemID int) ([]Link, error) {
	query := `
		SELECT link_id, source_item_id, destination_item_id, link_type, created_at
		FROM links
		WHERE source_item_id = ? OR destination_item_id = ?
		ORDER BY created_at DESC
	`

	rows, err := db.conn.Query(query, itemID, itemID)
	if err != nil {
		return nil, fmt.Errorf("failed to get links: %w", err)
	}
	defer func() { _ = rows.Close() }()

	return db.scanLinks(rows)
}

// GetRecentItems retrieves recently modified items
func (db *DB) GetRecentItems(limit int) ([]Item, error) {
	query := `
		SELECT item_id, word, type, definition, derivation,
		       appendicies, source, source_pg, mark, created_at, modified_at
		FROM items
		ORDER BY modified_at DESC
		LIMIT ?
	`

	rows, err := db.conn.Query(query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get recent items: %w", err)
	}
	defer func() { _ = rows.Close() }()

	return db.scanItems(rows)
}

// CreateItem creates a new item
func (db *DB) CreateItem(item Item) (int, error) {
	sql := `
		INSERT INTO items (
			item_id, word, type, definition, derivation,
			appendicies, source, source_pg, mark
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	result, err := db.conn.Exec(sql,
		item.ItemID, item.Word, item.Type, item.Definition,
		item.Derivation, item.Appendicies, item.Source,
		item.SourcePg, item.Mark,
	)
	if err != nil {
		// Check for unique constraint violation
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return 0, fmt.Errorf("an item with the word '%s' already exists", item.Word)
		}
		return 0, fmt.Errorf("failed to create item: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("failed to get last insert id: %w", err)
	}

	return int(id), nil
}

// normalizeDefinition converts {word: ...} references to lowercase
func normalizeDefinition(text *string) {
	if text == nil || *text == "" {
		return
	}

	*text = parser.ReplaceTags(*text, func(ref parser.Reference) string {
		if ref.Type == "word" {
			return "{word: " + strings.TrimSpace(strings.ToLower(ref.Value)) + "}"
		}
		return ref.Original
	})

	// Strip line numbers if detected (e.g. "Line of text   5")
	if parser.HasLineNumbers(*text) {
		*text = parser.StripLineNumbers(*text)
	}
}

// UpdateItem updates an existing item
func (db *DB) UpdateItem(item Item) error { // Normalize {word: ...} references to lowercase
	normalizeDefinition(item.Definition)
	normalizeDefinition(item.Derivation)
	normalizeDefinition(item.Appendicies)
	sql := `
		UPDATE items SET
			word = ?, type = ?, definition = ?, derivation = ?,
			appendicies = ?, source = ?, source_pg = ?, mark = ?,
			modified_at = CURRENT_TIMESTAMP
		WHERE item_id = ?
	`

	result, err := db.conn.Exec(sql,
		item.Word, item.Type, item.Definition, item.Derivation,
		item.Appendicies, item.Source, item.SourcePg, item.Mark,
		item.ItemID,
	)
	if err != nil {
		return fmt.Errorf("failed to update item: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rows == 0 {
		// Item doesn't exist, create it instead
		_, err := db.CreateItem(item)
		return err
	}

	return nil
}

// ToggleItemMark toggles the mark field for an item
func (db *DB) ToggleItemMark(itemID int, marked bool) error {
	var markVal *string
	if marked {
		s := "1"
		markVal = &s
	}

	query := `UPDATE items SET mark = ?, modified_at = CURRENT_TIMESTAMP WHERE item_id = ?`
	_, err := db.conn.Exec(query, markVal, itemID)
	if err != nil {
		return fmt.Errorf("failed to toggle item mark: %w", err)
	}
	return nil
}

// DeleteItem deletes an item
func (db *DB) DeleteItem(itemID int) error {
	slog.Info("[DB] DeleteItem called", "itemID", itemID)
	result, err := db.conn.Exec("DELETE FROM items WHERE item_id = ?", itemID)
	if err != nil {
		slog.Error("[DB] DeleteItem SQL exec failed", "error", err)
		return fmt.Errorf("failed to delete item: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		slog.Error("[DB] DeleteItem failed to get rows affected", "error", err)
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	slog.Info("[DB] DeleteItem affected rows", "rows", rows)
	if rows == 0 {
		slog.Warn("[DB] DeleteItem found no item", "itemID", itemID)
		return fmt.Errorf("item not found")
	}

	slog.Info("[DB] DeleteItem succeeded", "itemID", itemID)
	return nil
}

// CreateLink creates a link between two items
func (db *DB) CreateLink(sourceID, destID int, linkType string) error {
	sql := `
		INSERT INTO links (source_item_id, destination_item_id, link_type)
		VALUES (?, ?, ?)
	`

	_, err := db.conn.Exec(sql, sourceID, destID, linkType)
	if err != nil {
		return fmt.Errorf("failed to create link: %w", err)
	}

	return nil
}

// DeleteLink deletes a link
func (db *DB) DeleteLink(linkID int) error {
	slog.Info("[DB] DeleteLink called", "linkID", linkID)
	result, err := db.conn.Exec("DELETE FROM links WHERE link_id = ?", linkID)
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
	result, err := db.conn.Exec("DELETE FROM links WHERE source_item_id = ? AND destination_item_id = ?", sourceItemID, destinationItemID)
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
	query := `UPDATE links SET destination_item_id = ? WHERE destination_item_id = ?`
	_, err := db.conn.Exec(query, newItemID, oldItemID)
	if err != nil {
		return fmt.Errorf("failed to update link destinations: %w", err)
	}
	return nil
}

// UpdateLinksSource updates all links originating from oldItemID to originate from newItemID
func (db *DB) UpdateLinksSource(oldItemID, newItemID int) error {
	query := `UPDATE links SET source_item_id = ? WHERE source_item_id = ?`
	_, err := db.conn.Exec(query, newItemID, oldItemID)
	if err != nil {
		return fmt.Errorf("failed to update link sources: %w", err)
	}
	return nil
}

// Helper functions

func (db *DB) scanItems(rows *sql.Rows) ([]Item, error) {
	var items []Item
	for rows.Next() {
		item := Item{}
		err := rows.Scan(
			&item.ItemID, &item.Word, &item.Type, &item.Definition,
			&item.Derivation, &item.Appendicies, &item.Source, &item.SourcePg,
			&item.Mark, &item.CreatedAt, &item.ModifiedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan item: %w", err)
		}
		items = append(items, item)
	}
	return items, nil
}

func (db *DB) scanLinks(rows *sql.Rows) ([]Link, error) {
	var links []Link
	for rows.Next() {
		link := Link{}
		err := rows.Scan(
			&link.LinkID, &link.SourceItemID,
			&link.DestinationItemID, &link.LinkType, &link.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan link: %w", err)
		}
		links = append(links, link)
	}
	return links, nil
}

// GetAllItems returns all items
func (db *DB) GetAllItems() ([]Item, error) {
	query := MustLoadQuery("all_items")
	rows, err := db.conn.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get all items: %w", err)
	}
	defer func() { _ = rows.Close() }()
	return db.scanItems(rows)
}

// GetAllLinks returns all links
func (db *DB) GetAllLinks() ([]Link, error) {
	query := MustLoadQuery("all_links")
	rows, err := db.conn.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get all links: %w", err)
	}
	defer func() { _ = rows.Close() }()
	return db.scanLinks(rows)
}

// GetEgoGraph returns the ego graph for a given node
func (db *DB) GetEgoGraph(centerNodeID int, depth int) (*GraphData, error) {
	if depth < 1 {
		depth = 1
	}

	// Use a map to store unique node IDs
	nodeIDs := make(map[int]bool)
	nodeIDs[centerNodeID] = true

	// Current frontier
	frontier := []int{centerNodeID}

	for i := 0; i < depth; i++ {
		if len(frontier) == 0 {
			break
		}

		// Build query for neighbors
		placeholders := make([]string, len(frontier))
		args := make([]interface{}, len(frontier)*2)
		for j, id := range frontier {
			placeholders[j] = "?"
			args[j] = id
			args[len(frontier)+j] = id
		}

		query := fmt.Sprintf(`
			SELECT source_item_id, destination_item_id 
			FROM links 
			WHERE source_item_id IN (%s) OR destination_item_id IN (%s)
		`, strings.Join(placeholders, ","), strings.Join(placeholders, ","))

		rows, err := db.conn.Query(query, args...)
		if err != nil {
			return nil, fmt.Errorf("failed to query neighbors: %w", err)
		}

		var newFrontier []int
		for rows.Next() {
			var src, dst int
			if err := rows.Scan(&src, &dst); err != nil {
				_ = rows.Close()
				return nil, fmt.Errorf("failed to scan neighbors: %w", err)
			}

			if !nodeIDs[src] {
				nodeIDs[src] = true
				newFrontier = append(newFrontier, src)
			}
			if !nodeIDs[dst] {
				nodeIDs[dst] = true
				newFrontier = append(newFrontier, dst)
			}
		}
		_ = rows.Close()
		frontier = newFrontier

		// Hard limit check (500 nodes)
		if len(nodeIDs) > 500 {
			break
		}
	}

	// Convert map to slice
	ids := make([]int, 0, len(nodeIDs))
	for id := range nodeIDs {
		ids = append(ids, id)
	}

	// Fetch Items
	placeholders := make([]string, len(ids))
	args := make([]interface{}, len(ids))
	for i, id := range ids {
		placeholders[i] = "?"
		args[i] = id
	}

	queryItems := fmt.Sprintf(`
		SELECT item_id, word, type, definition, derivation, appendicies, source, source_pg, mark, created_at, modified_at 
		FROM items 
		WHERE item_id IN (%s)
		ORDER BY word
	`, strings.Join(placeholders, ","))

	rowsItems, err := db.conn.Query(queryItems, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to get items: %w", err)
	}
	defer func() { _ = rowsItems.Close() }()

	items, err := db.scanItems(rowsItems)
	if err != nil {
		return nil, err
	}

	// Fetch Links (induced subgraph)
	// We want links where BOTH source and destination are in our set of IDs
	// Re-use placeholders and args as they are the same (list of IDs)

	// We need to pass the list of IDs twice for the two IN clauses
	argsLinks := make([]interface{}, len(ids)*2)
	copy(argsLinks, args)
	copy(argsLinks[len(ids):], args)

	queryLinks := fmt.Sprintf(`
		SELECT link_id, source_item_id, destination_item_id, link_type, created_at 
		FROM links 
		WHERE source_item_id IN (%s) AND destination_item_id IN (%s)
		ORDER BY link_id
	`, strings.Join(placeholders, ","), strings.Join(placeholders, ","))

	rowsLinks, err := db.conn.Query(queryLinks, argsLinks...)
	if err != nil {
		return nil, fmt.Errorf("failed to get links: %w", err)
	}
	defer func() { _ = rowsLinks.Close() }()

	links, err := db.scanLinks(rowsLinks)
	if err != nil {
		return nil, err
	}

	return &GraphData{
		Items: items,
		Links: links,
	}, nil
}

// GetAllCliches returns all cliches
func (db *DB) GetAllCliches() ([]Cliche, error) {
	query := MustLoadQuery("all_cliches")
	rows, err := db.conn.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get all cliches: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var cliches []Cliche
	for rows.Next() {
		var c Cliche
		if err := rows.Scan(&c.ClicheID, &c.Phrase, &c.Definition, &c.CreatedAt); err != nil {
			return nil, err
		}
		cliches = append(cliches, c)
	}
	return cliches, rows.Err()
}

// GetAllNames returns all names
func (db *DB) GetAllNames() ([]Name, error) {
	query := MustLoadQuery("all_names")
	rows, err := db.conn.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get all names: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var names []Name
	for rows.Next() {
		var n Name
		if err := rows.Scan(&n.NameID, &n.Name, &n.Type, &n.Gender, &n.Description, &n.Notes, &n.CreatedAt); err != nil {
			return nil, err
		}
		names = append(names, n)
	}
	return names, rows.Err()
}

// GetAllLiteraryTerms returns all literary terms
func (db *DB) GetAllLiteraryTerms() ([]LiteraryTerm, error) {
	query := `
		SELECT 
			t.term_id, 
			t.term, 
			t.type,
			t.definition, 
			t.examples, 
			t.notes, 
			t.created_at,
			(SELECT COUNT(*) FROM items WHERE word = t.term) > 0 as exists_in_items
		FROM literary_terms t
		ORDER BY t.term
	`
	rows, err := db.conn.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get all literary terms: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var terms []LiteraryTerm
	for rows.Next() {
		var t LiteraryTerm
		if err := rows.Scan(&t.TermID, &t.Term, &t.Type, &t.Definition, &t.Examples, &t.Notes, &t.CreatedAt, &t.ExistsInItems); err != nil {
			return nil, err
		}
		terms = append(terms, t)
	}
	return terms, rows.Err()
}

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

// MergeLiteraryTerm merges a literary term into an existing item
func (db *DB) MergeLiteraryTerm(termID int) error {
	// 1. Get the literary term
	var term LiteraryTerm
	err := db.conn.QueryRow(`
		SELECT term_id, term, definition, examples, notes 
		FROM literary_terms 
		WHERE term_id = ?
	`, termID).Scan(&term.TermID, &term.Term, &term.Definition, &term.Examples, &term.Notes)
	if err != nil {
		return fmt.Errorf("failed to get literary term: %w", err)
	}

	// 2. Find the matching item (case-sensitive)
	var item Item
	err = db.conn.QueryRow(`
		SELECT item_id, word, definition, source 
		FROM items 
		WHERE word = ? COLLATE BINARY
	`, term.Term).Scan(&item.ItemID, &item.Word, &item.Definition, &item.Source)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("matching item not found for term: %s", term.Term)
		}
		return fmt.Errorf("failed to find matching item: %w", err)
	}

	// 3. Prepare updated fields
	newDef := ""
	if item.Definition != nil {
		newDef = *item.Definition
	}

	termDef := ""
	if term.Definition != nil {
		termDef = *term.Definition
	}

	// Clean up replacement characters
	termDef = strings.ReplaceAll(termDef, "\ufffd", "\"")
	// Clean up HTML tags
	termDef = strings.ReplaceAll(termDef, "<p>", "\n\n")
	termDef = strings.ReplaceAll(termDef, "</p>", "")

	if termDef != "" {
		if newDef != "" {
			newDef += "\n\n----\n\n"
		}
		newDef += termDef
	}

	newSource := ""
	if item.Source != nil {
		newSource = *item.Source
	}
	if newSource != "" {
		newSource += "; "
	}
	newSource += "from literary term table"

	// 4. Update the item
	_, err = db.conn.Exec(`
		UPDATE items 
		SET definition = ?, source = ?, modified_at = CURRENT_TIMESTAMP 
		WHERE item_id = ?
	`, newDef, newSource, item.ItemID)
	if err != nil {
		return fmt.Errorf("failed to update item: %w", err)
	}

	// 5. Delete the literary term
	_, err = db.conn.Exec(`
		DELETE FROM literary_terms 
		WHERE term_id = ?
	`, termID)
	if err != nil {
		return fmt.Errorf("failed to delete literary term: %w", err)
	}

	return nil
}

// DeleteLiteraryTerm permanently deletes a literary term
func (db *DB) DeleteLiteraryTerm(termID int) error {
	_, err := db.conn.Exec("DELETE FROM literary_terms WHERE term_id = ?", termID)
	if err != nil {
		return fmt.Errorf("failed to delete literary term: %w", err)
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
	rows, err := db.conn.Query("SELECT item_id FROM items")
	if err != nil {
		return fmt.Errorf("failed to query items: %w", err)
	}
	defer func() { _ = rows.Close() }()
	
	var itemIDs []int
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			return fmt.Errorf("failed to scan item ID: %w", err)
		}
		itemIDs = append(itemIDs, id)
	}
	
	if err := rows.Err(); err != nil {
		return fmt.Errorf("error iterating items: %w", err)
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
		
		// Update database flags
		_, err := db.conn.Exec(`
			UPDATE items 
			SET has_image = ?, has_tts = ?
			WHERE item_id = ?
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
