-- Poetry Database Schema
-- SQLite database for literary reference system

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Items table (main word/term entries)
CREATE TABLE items (
    item_id INTEGER PRIMARY KEY,
    word TEXT NOT NULL,
    type TEXT DEFAULT 'Reference',
    definition TEXT,
    derivation TEXT,
    appendicies TEXT,
    source TEXT,
    source_pg TEXT,
    mark TEXT,
    has_image INTEGER DEFAULT 0,
    has_tts INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    modified_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Links table (relationships between items)
CREATE TABLE links (
    link_id INTEGER PRIMARY KEY,
    source_item_id INTEGER NOT NULL,
    destination_item_id INTEGER NOT NULL,
    link_type TEXT DEFAULT 'related',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_item_id) REFERENCES items(item_id) ON DELETE CASCADE,
    FOREIGN KEY (destination_item_id) REFERENCES items(item_id) ON DELETE CASCADE
);

-- Cliches table
CREATE TABLE cliches (
    cliche_id INTEGER PRIMARY KEY,
    phrase TEXT NOT NULL,
    definition TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Names table (proper names, characters, literary figures)
CREATE TABLE names (
    name_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT,
    gender TEXT,
    description TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Literary Terms table
CREATE TABLE literary_terms (
    term_id INTEGER PRIMARY KEY,
    term TEXT NOT NULL,
    type TEXT,
    definition TEXT,
    examples TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sources table (reference books, dictionaries)
CREATE TABLE sources (
    source_id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User preferences/settings
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Full-text search tables
CREATE VIRTUAL TABLE items_fts USING fts5(
    word,
    definition,
    derivation,
    appendicies,
    content=items,
    content_rowid=item_id
);

CREATE VIRTUAL TABLE cliches_fts USING fts5(
    phrase,
    definition,
    content=cliches,
    content_rowid=cliche_id
);

CREATE VIRTUAL TABLE literary_terms_fts USING fts5(
    term,
    definition,
    examples,
    content=literary_terms,
    content_rowid=term_id
);

-- Triggers to keep FTS tables in sync with items
CREATE TRIGGER items_ai AFTER INSERT ON items BEGIN
    INSERT INTO items_fts(rowid, word, definition, derivation, appendicies)
    VALUES (new.item_id, new.word, new.definition, new.derivation, new.appendicies);
END;

CREATE TRIGGER items_ad AFTER DELETE ON items BEGIN
    DELETE FROM items_fts WHERE rowid = old.item_id;
END;

CREATE TRIGGER items_au AFTER UPDATE ON items BEGIN
    UPDATE items_fts SET
        word = new.word,
        definition = new.definition,
        derivation = new.derivation,
        appendicies = new.appendicies
    WHERE rowid = new.item_id;
END;

-- Triggers for cliches FTS
CREATE TRIGGER cliches_ai AFTER INSERT ON cliches BEGIN
    INSERT INTO cliches_fts(rowid, phrase, definition)
    VALUES (new.cliche_id, new.phrase, new.definition);
END;

CREATE TRIGGER cliches_ad AFTER DELETE ON cliches BEGIN
    DELETE FROM cliches_fts WHERE rowid = old.cliche_id;
END;

CREATE TRIGGER cliches_au AFTER UPDATE ON cliches BEGIN
    UPDATE cliches_fts SET
        phrase = new.phrase,
        definition = new.definition
    WHERE rowid = new.cliche_id;
END;

-- Triggers for literary_terms FTS
CREATE TRIGGER literary_terms_ai AFTER INSERT ON literary_terms BEGIN
    INSERT INTO literary_terms_fts(rowid, term, definition, examples)
    VALUES (new.term_id, new.term, new.definition, new.examples);
END;

CREATE TRIGGER literary_terms_ad AFTER DELETE ON literary_terms BEGIN
    DELETE FROM literary_terms_fts WHERE rowid = old.term_id;
END;

CREATE TRIGGER literary_terms_au AFTER UPDATE ON literary_terms BEGIN
    UPDATE literary_terms_fts SET
        term = new.term,
        definition = new.definition,
        examples = new.examples
    WHERE rowid = new.term_id;
END;

-- Indexes for performance
CREATE INDEX idx_items_word ON items(word COLLATE NOCASE);
CREATE INDEX idx_items_type ON items(type);
CREATE INDEX idx_items_modified ON items(modified_at DESC);
CREATE INDEX idx_items_has_image ON items(has_image);
CREATE INDEX idx_items_has_tts ON items(has_tts);

-- Link indexes - covering indexes include all columns to avoid table lookups
CREATE INDEX idx_links_source_covering ON links(source_item_id, created_at DESC, destination_item_id, link_type);
CREATE INDEX idx_links_destination_covering ON links(destination_item_id, created_at DESC, source_item_id, link_type);
CREATE INDEX idx_links_type ON links(link_type);

-- Other table indexes
CREATE INDEX idx_names_name ON names(name COLLATE NOCASE);
CREATE INDEX idx_literary_terms_term ON literary_terms(term COLLATE NOCASE);
CREATE INDEX idx_cliches_phrase ON cliches(phrase COLLATE NOCASE);

-- Views for common queries

-- Item with connection counts
CREATE VIEW items_with_stats AS
SELECT 
    i.*,
    COUNT(DISTINCT l_out.link_id) AS outgoing_count,
    COUNT(DISTINCT l_in.link_id) AS incoming_count,
    COUNT(DISTINCT l_out.link_id) + COUNT(DISTINCT l_in.link_id) AS total_connections
FROM items i
LEFT JOIN links l_out ON i.item_id = l_out.source_item_id
LEFT JOIN links l_in ON i.item_id = l_in.destination_item_id
GROUP BY i.item_id;

-- Recently modified items
CREATE VIEW recent_items AS
SELECT * FROM items
ORDER BY modified_at DESC
LIMIT 50;

-- Items without definitions
CREATE VIEW incomplete_items AS
SELECT * FROM items
WHERE definition IS NULL OR definition = '' OR definition = 'MISSING DATA'
ORDER BY word;

-- Most connected items (hubs)
CREATE VIEW hub_items AS
SELECT 
    i.*,
    COUNT(DISTINCT l_out.link_id) + COUNT(DISTINCT l_in.link_id) AS connection_count
FROM items i
LEFT JOIN links l_out ON i.item_id = l_out.source_item_id
LEFT JOIN links l_in ON i.item_id = l_in.destination_item_id
GROUP BY i.item_id
ORDER BY connection_count DESC
LIMIT 100;
