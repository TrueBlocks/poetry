# Exporting Data from FileMaker

## Manual Export Process

Since we don't have direct access to FileMaker scripting, follow these steps to export your data:

### 1. Export Items Table

1. Open `dbPoetry.fmp12` in FileMaker Pro
2. Go to the Items layout
3. Find all records (Cmd+J or Records > Show All Records)
4. File > Export Records...
5. Choose format: **Tab-Separated Text** or **CSV**
6. Name file: `items_export.csv`
7. Select these fields in order:
   - Item ID
   - Word
   - Type
   - Definition
   - Derivation
   - Appendicies
   - Source
   - SourcePg
   - Mark
   - modifyDate

### 2. Export Links Table

1. Switch to Links layout
2. Show all records
3. Export as `links_export.csv`
4. Fields:
   - Link ID (if available)
   - Source Item ID
   - Destination Item ID

### 3. Export Cliches Table

1. Switch to Cliches layout
2. Export as `cliches_export.csv`
3. Fields:
   - Cliche ID
   - Phrase
   - Definition

### 4. Export Names Table

1. Switch to Names layout
2. Export as `names_export.csv`
3. Fields:
   - Name ID
   - Name
   - Type
   - Description (if available)
   - Notes (if available)

### 5. Export Literary Terms Table

1. Switch to Literary Terms layout
2. Export as `literary_terms_export.csv`
3. Fields:
   - Term ID
   - Term
   - Definition
   - Examples (if available)
   - Notes (if available)

### 6. Export Sources Table

1. Switch to Sources layout
2. Export as `sources_export.csv`
3. Fields:
   - Source ID
   - Title
   - Author
   - Notes

## File Locations

Place all exported files in:
```
/Users/jrush/Databases/dbPoetry_ddr/data/
```

## CSV Format Notes

- Use UTF-8 encoding
- Include header row with field names
- Escape quotes and commas properly
- Preserve paragraph breaks (¶) in text fields

## Next Step

After exporting, run the import script:
```bash
cd /Users/jrush/Databases/dbPoetry_ddr/scripts
python import_data.py
```
