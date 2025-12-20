#!/usr/bin/env python3
"""
Import FileMaker CSV exports into SQLite database
Handles CSVs with no header row, FileMaker IDs as primary keys
"""

import csv
import sqlite3
from pathlib import Path
from datetime import datetime

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
DATA_DIR = PROJECT_DIR / "data"
DB_PATH = PROJECT_DIR / "poetry.db"
SCHEMA_PATH = PROJECT_DIR / "schema.sql"

def clean_text(text):
    """Clean text fields - replace FileMaker paragraph markers and special characters"""
    if not text:
        return None
    # Replace FileMaker paragraph symbol with newlines
    text = text.replace('¶', '\n')
    # Replace vertical tab (\x0b) with newlines
    text = text.replace('\x0b', '\n')
    # Replace carriage returns
    text = text.replace('\r\n', '\n')
    text = text.replace('\r', '\n')
    # Replace Unicode replacement character with standard double quote
    text = text.replace('\ufffd', '"')
    text = text.strip()
    return text if text else None

def create_database():
    """Create SQLite database from schema"""
    print(f"\nCreating database at: {DB_PATH}")
    
    # Remove existing database
    if DB_PATH.exists():
        DB_PATH.unlink()
        print("  Removed existing database")
    
    # Create new database
    conn = sqlite3.connect(DB_PATH)
    
    # Load and execute schema
    with open(SCHEMA_PATH, 'r') as f:
        schema = f.read()
        conn.executescript(schema)
    
    print("  Database schema created")
    return conn

def import_items(conn, csv_path):
    """Import items from CSV (no header row)"""
    print(f"\nImporting items from {csv_path}")
    
    if not csv_path.exists():
        print(f"  File not found: {csv_path}")
        return
    
    cursor = conn.cursor()
    count = 0
    errors = 0
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        
        for row in reader:
            try:
                if len(row) < 10:
                    print(f"  Skipping row with insufficient columns: {len(row)}")
                    errors += 1
                    continue
                
                item_id = int(row[0]) if row[0] else None
                if not item_id:
                    print(f"  Skipping row with missing ID")
                    errors += 1
                    continue
                
                cursor.execute("""
                    INSERT OR IGNORE INTO items (
                        item_id, word, type, definition, derivation,
                        appendicies, source, source_pg, mark, modified_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    item_id,
                    row[1] if len(row) > 1 else '',
                    row[2] if len(row) > 2 else 'Reference',
                    clean_text(row[3]) if len(row) > 3 else None,
                    clean_text(row[4]) if len(row) > 4 else None,
                    clean_text(row[5]) if len(row) > 5 else None,
                    row[6] if len(row) > 6 else None,
                    row[7] if len(row) > 7 else None,
                    row[8] if len(row) > 8 else None,
                    row[9] if len(row) > 9 else datetime.now().isoformat()
                ))
                count += 1
            except Exception as e:
                print(f"  Error importing item: {e}")
                errors += 1
                if errors < 5:  # Show first few errors
                    print(f"  Row data: {row[:3]}...")
    
    conn.commit()
    print(f"  Imported {count} items, {errors} errors")

def import_links(conn, csv_path):
    """Import links from CSV (no header row, 3 columns: link_id, source_id, dest_id)"""
    print(f"\nImporting links from {csv_path}")
    
    if not csv_path.exists():
        print(f"  File not found: {csv_path}")
        return
    
    cursor = conn.cursor()
    count = 0
    skipped = 0
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        
        for row in reader:
            try:
                if len(row) < 3:
                    skipped += 1
                    continue
                
                link_id = int(row[0]) if row[0] else None
                source_id = int(row[1]) if row[1] else None
                dest_id = int(row[2]) if row[2] else None
                
                if link_id and source_id and dest_id:
                    cursor.execute("""
                        INSERT OR IGNORE INTO links (
                            link_id, source_item_id, destination_item_id, link_type
                        ) VALUES (?, ?, ?, ?)
                    """, (
                        link_id,
                        source_id,
                        dest_id,
                        'related'
                    ))
                    count += 1
                else:
                    skipped += 1
            except Exception as e:
                print(f"  Error importing link: {e}")
                skipped += 1
    
    conn.commit()
    print(f"  Imported {count} links, skipped {skipped}")

def import_cliches(conn, csv_path):
    """Import cliches from CSV (no header row)"""
    print(f"\nImporting cliches from {csv_path}")
    
    if not csv_path.exists():
        print(f"  File not found: {csv_path}")
        return
    
    cursor = conn.cursor()
    count = 0
    errors = 0
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        
        for row in reader:
            try:
                if len(row) < 2:
                    errors += 1
                    continue
                
                cliche_id = int(row[0]) if row[0] else None
                if not cliche_id:
                    errors += 1
                    continue
                
                cursor.execute("""
                    INSERT OR IGNORE INTO cliches (cliche_id, phrase, definition)
                    VALUES (?, ?, ?)
                """, (
                    cliche_id,
                    row[1] if len(row) > 1 else '',
                    clean_text(row[2]) if len(row) > 2 else None
                ))
                count += 1
            except Exception as e:
                print(f"  Error importing cliche: {e}")
                errors += 1
    
    conn.commit()
    print(f"  Imported {count} cliches, {errors} errors")

def import_names(conn, csv_path):
    """Import names from CSV (columns: id, name, type, gender)"""
    print(f"\nImporting names from {csv_path}")
    
    if not csv_path.exists():
        print(f"  File not found: {csv_path}")
        return
    
    cursor = conn.cursor()
    count = 0
    errors = 0
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        
        for row in reader:
            try:
                if len(row) < 2:
                    errors += 1
                    continue
                
                # Columns are: [id, name, type, gender]
                # Example: "1005","Adams","last",""
                # Example: "3325","Aaron","first","male"
                
                try:
                    name_id = int(row[0]) if row[0] else None
                except ValueError:
                    # Try the old format just in case: [empty, name, id, type]
                    if len(row) > 2 and row[2].isdigit():
                         name_id = int(row[2])
                    else:
                        print(f"  Skipping row with invalid ID: {row}")
                        errors += 1
                        continue

                if not name_id:
                    errors += 1
                    continue
                
                name = row[1] if len(row) > 1 else ''
                
                # Determine type and gender based on format
                # If parsing as [id, name, type, gender]
                type_val = row[2] if len(row) > 2 else None
                gender_val = row[3] if len(row) > 3 else None
                
                # If it was the old format [empty, name, id, type], then type is row[3]
                # But let's assume the file on disk (data/names.csv) is the source of truth
                # which we verified is [id, name, type, gender]
                
                cursor.execute("""
                    INSERT OR IGNORE INTO names (name_id, name, type, gender, description, notes)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    name_id,
                    name,
                    type_val,
                    gender_val,
                    None,  # no description in this CSV
                    None   # no notes in this CSV
                ))
                count += 1
            except Exception as e:
                print(f"  Error importing name: {e}")
                errors += 1
    
    conn.commit()
    print(f"  Imported {count} names, {errors} errors")

def import_literary_terms(conn, csv_path):
    """Import literary terms from CSV (no header row)"""
    print(f"\nImporting literary terms from {csv_path}")
    
    if not csv_path.exists():
        print(f"  File not found: {csv_path}")
        return
    
    cursor = conn.cursor()
    count = 0
    errors = 0
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        
        for row in reader:
            try:
                if len(row) < 2:
                    errors += 1
                    continue
                
                term_id = int(row[0]) if row[0] else None
                if not term_id:
                    errors += 1
                    continue
                
                cursor.execute("""
                    INSERT OR IGNORE INTO literary_terms (term_id, term, type, definition, examples, notes)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    term_id,
                    row[1] if len(row) > 1 else '',
                    None, # type
                    clean_text(row[2]) if len(row) > 2 else None,
                    clean_text(row[3]) if len(row) > 3 else None,
                    clean_text(row[4]) if len(row) > 4 else None
                ))
                count += 1
            except Exception as e:
                print(f"  Error importing literary term: {e}")
                errors += 1
    
    conn.commit()
    print(f"  Imported {count} literary terms, {errors} errors")

def import_sources(conn, csv_path):
    """Import sources from CSV (columns: author, short_name, title - no IDs)"""
    print(f"\nImporting sources from {csv_path}")
    
    if not csv_path.exists():
        print(f"  File not found: {csv_path}")
        return
    
    cursor = conn.cursor()
    count = 0
    errors = 0
    source_id = 1000  # Start IDs at 1000
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        
        for row in reader:
            try:
                if len(row) < 2:
                    errors += 1
                    continue
                
                # Columns are: [author, short_name, title]
                title = row[2] if len(row) > 2 else row[1] if len(row) > 1 else ''
                author = row[0] if row[0] else None
                
                if not title:
                    errors += 1
                    continue
                
                cursor.execute("""
                    INSERT OR IGNORE INTO sources (source_id, title, author, notes)
                    VALUES (?, ?, ?, ?)
                """, (
                    source_id,
                    title,
                    author,
                    row[1] if len(row) > 1 else None  # short_name as notes
                ))
                source_id += 1
                count += 1
            except Exception as e:
                print(f"  Error importing source: {e}")
                errors += 1
    
    conn.commit()
    print(f"  Imported {count} sources, {errors} errors")

def print_statistics(conn):
    """Print database statistics"""
    print("\n" + "="*50)
    print("Database Statistics")
    print("="*50)
    
    cursor = conn.cursor()
    
    tables = ['items', 'links', 'cliches', 'names', 'literary_terms', 'sources']
    for table in tables:
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        count = cursor.fetchone()[0]
        print(f"  {table:20} {count:>10,}")

def main():
    """Main import process"""
    print("Poetry Database Import")
    print("="*50)
    
    # Create database
    conn = create_database()
    if not conn:
        return
    
    # Import data (using actual filenames from your export)
    import_items(conn, DATA_DIR / "items.csv")
    import_links(conn, DATA_DIR / "links.csv")
    import_cliches(conn, DATA_DIR / "cliches.csv")
    import_names(conn, DATA_DIR / "names.csv")
    import_literary_terms(conn, DATA_DIR / "literary terms.csv")
    import_sources(conn, DATA_DIR / "sources.csv")
    
    # Print statistics
    print_statistics(conn)
    
    conn.close()
    print(f"\nDatabase created successfully at: {DB_PATH}")

if __name__ == "__main__":
    main()
