# dbPoetry API Reference

This document describes all public API methods exposed by the Go backend through the Wails CGO bridge.

## Table of Contents

- [Application Lifecycle](#application-lifecycle)
- [Item Operations](#item-operations)
- [Link Operations](#link-operations)
- [Search Operations](#search-operations)
- [Settings Management](#settings-management)
- [Reports & Analytics](#reports--analytics)
- [Reference Tables](#reference-tables)
- [Export Operations](#export-operations)
- [Text-to-Speech](#text-to-speech)

---

## Application Lifecycle

### `startup(ctx context.Context)`

**Internal method** called by Wails when the application starts.

**Actions**:
- Initializes settings manager
- Determines database path from `DataFolder` and `DatabaseFile` settings
- Opens SQLite database connection with FTS5 enabled

---

## Item Operations

### `GetStats() (map[string]int, error)`

Returns statistics about the database.

**Returns**:
```go
{
  "totalItems": 3500,
  "references": 2100,
  "writers": 850,
  "titles": 450,
  "other": 100,
  "totalLinks": 5200
}
```

**Errors**: Database query failures

**Frontend Usage**:
```typescript
import { GetStats } from '@wailsjs/go/main/App'

const stats = await GetStats()
console.log(`Total items: ${stats.totalItems}`)
```

---

### `GetItem(itemID int) (*database.Item, error)`

Retrieves a single item by its ID.

**Parameters**:
- `itemID` (int): Unique item identifier

**Returns**: `Item` object or `nil` if not found

**Errors**:
- Item not found
- Database query failures

**Frontend Usage**:
```typescript
import { GetItem } from '@wailsjs/go/main/App'

const item = await GetItem(123)
console.log(item.word, item.type, item.definition)
```

---

### `GetItemByWord(word string) (*database.Item, error)`

Retrieves a single item by its word field (case-sensitive).

**Parameters**:
- `word` (string): Exact word to search for

**Returns**: `Item` object or `nil` if not found

**Errors**:
- Item not found
- Database query failures

---

### `GetAllItems() ([]database.Item, error)`

Retrieves all items from the database (used for export and validation).

**Returns**: Array of all items

**Errors**: Database query failures

**Performance Note**: Can be slow with large datasets (3500+ items). Use sparingly, cache results when possible.

---

### `GetRecentItems(limit int) ([]database.Item, error)`

Retrieves recently modified items ordered by `updated_at` DESC.

**Parameters**:
- `limit` (int): Maximum number of items to return

**Returns**: Array of items

**Errors**: Database query failures

**Frontend Usage**:
```typescript
const recent = await GetRecentItems(10)
```

---

### `CreateItem(item database.Item) (int, error)`

Creates a new item in the database.

**Parameters**:
- `item` (Item): Item object with required fields (`word`, `type`)

**Returns**: New item's `itemId`

**Errors**:
- Validation failures (missing required fields)
- Duplicate word constraint violations
- Database insert failures

**Frontend Usage**:
```typescript
const newId = await CreateItem({
  word: 'Shakespeare',
  type: 'Writer',
  definition: 'English playwright and poet',
  source: 'Encyclopedia Britannica',
})
```

---

### `UpdateItem(item database.Item) error`

Updates an existing item.

**Parameters**:
- `item` (Item): Item object with `itemId` and fields to update

**Returns**: `nil` on success

**Errors**:
- Item not found
- Validation failures
- Database update failures

**Frontend Usage**:
```typescript
await UpdateItem({
  itemId: 123,
  word: 'Shakespeare',
  definition: 'Updated definition...',
})
```

---

### `DeleteItem(itemID int) error`

Deletes an item and all associated links.

**Parameters**:
- `itemID` (int): Item ID to delete

**Returns**: `nil` on success

**Errors**:
- Item not found
- Database delete failures

**Side Effects**: All links (incoming and outgoing) are automatically deleted via CASCADE.

---

## Link Operations

### `GetItemLinks(itemID int) ([]database.Link, error)`

Retrieves all links (incoming and outgoing) for a specific item.

**Parameters**:
- `itemID` (int): Item ID

**Returns**: Array of `Link` objects

**Errors**: Database query failures

**Frontend Usage**:
```typescript
const links = await GetItemLinks(123)
const outgoing = links.filter(l => l.source_item_id === 123)
const incoming = links.filter(l => l.destination_item_id === 123)
```

---

### `GetAllLinks() ([]database.Link, error)`

Retrieves all links in the database (used for export and graph visualization).

**Returns**: Array of all links

**Errors**: Database query failures

---

### `CreateLink(sourceID, destID int, linkType string) error`

Creates a new link between two items.

**Parameters**:
- `sourceID` (int): Source item ID
- `destID` (int): Destination item ID
- `linkType` (string): Link type (`"reference"`, `"related"`, etc.)

**Returns**: `nil` on success

**Errors**:
- Source or destination item not found
- Duplicate link (already exists)
- Database insert failures

---

### `DeleteLink(linkID int) error`

Deletes a link by its ID.

**Parameters**:
- `linkID` (int): Link ID

**Returns**: `nil` on success

**Errors**:
- Link not found
- Database delete failures

---

### `DeleteLinkByItems(sourceItemID, destinationItemID int) error`

Deletes a link between two specific items.

**Parameters**:
- `sourceItemID` (int): Source item ID
- `destinationItemID` (int): Destination item ID

**Returns**: `nil` on success

**Errors**:
- Link not found
- Database delete failures

---

### `CreateLinkOrRemoveTags(sourceItemID int, refWord string) (*LinkOrTagResult, error)`

Attempts to create a link to the referenced word. If the word doesn't exist, removes reference tags from the source item's text fields.

**Parameters**:
- `sourceItemID` (int): Source item ID
- `refWord` (string): Referenced word to link to

**Returns**:
```go
type LinkOrTagResult struct {
    LinkCreated bool   `json:"linkCreated"`
    Message     string `json:"message"`
}
```

**Frontend Usage**:
```typescript
const result = await CreateLinkOrRemoveTags(123, 'Shakespeare')
if (result.linkCreated) {
  console.log('Link created successfully')
} else {
  console.log('Tags removed:', result.message)
}
```

---

## Search Operations

### `SearchItems(query string) ([]database.Item, error)`

Performs FTS5 full-text search on items.

**Parameters**:
- `query` (string): Search query (supports FTS5 boolean syntax)

**Returns**: Array of matching items sorted by relevance

**Query Syntax**:
- `word1 word2` - Match both words (implicit AND)
- `word1 OR word2` - Match either word
- `"exact phrase"` - Match exact phrase
- `word1 NOT word2` - Match first but not second

**Errors**: Database query failures

---

### `SearchItemsWithOptions(options database.SearchOptions) ([]database.Item, error)`

Performs advanced search with filters.

**Parameters**:
```go
type SearchOptions struct {
    Query    string   `json:"query"`
    Types    []string `json:"types"`    // ["Reference", "Writer", "Title", "Other"]
    Source   string   `json:"source"`   // Filter by source
    UseRegex bool     `json:"useRegex"` // Use regex instead of FTS5
}
```

**Returns**: Array of matching items

**Errors**:
- Invalid regex pattern
- Database query failures

**Frontend Usage**:
```typescript
const results = await SearchItemsWithOptions({
  query: 'shakespeare',
  types: ['Writer', 'Title'],
  source: 'Encyclopedia Britannica',
  useRegex: false,
})
```

---

## Settings Management

### `GetSettings() *settings.Settings`

Returns current settings object.

**Returns**:
```go
type Settings struct {
    DataFolder          string
    DatabaseFile        string
    WindowX, WindowY    int
    WindowWidth, WindowHeight int
    LastWord            int
    LastView            string
    RevealMarkdown      bool
    OutgoingCollapsed   bool
    IncomingCollapsed   bool
    RecentSearches      []string
    SavedSearches       []SavedSearch
    // ... collapse states for reports
}
```

---

### `GetAllSettings() map[string]interface{}`

Returns all settings as a map (for debugging/export).

**Returns**: Key-value map of all settings

---

### `GetEnvVars() map[string]string`

Returns environment variables (filtered to exclude sensitive keys).

**Returns**: Map of environment variables

**Security Note**: Automatically filters out `OPENAI_API_KEY` and other sensitive values.

---

### `SaveWindowPosition(x, y, width, height int) error`

Persists window position and dimensions.

**Parameters**:
- `x`, `y` (int): Window position
- `width`, `height` (int): Window dimensions

**Returns**: `nil` on success

---

### `SaveLastWord(wordID int) error`

Saves the last viewed item ID (for session restoration).

---

### `SaveLastView(view string) error`

Saves the last active view/page.

**Parameters**:
- `view` (string): View name (`"dashboard"`, `"search"`, etc.)

---

### `SaveRevealMarkdown(reveal bool) error`

Saves markdown reveal preference for ItemDetail.

---

### `SaveOutgoingCollapsed(collapsed bool) error`

Saves outgoing links collapse state.

---

### `SaveIncomingCollapsed(collapsed bool) error`

Saves incoming links collapse state.

---

### `SaveReportUnlinkedRefsCollapsed(collapsed bool) error`

Saves collapse state for Unlinked References report.

---

### `SaveReportDuplicatesCollapsed(collapsed bool) error`

Saves collapse state for Duplicates report.

---

### `SaveReportOrphanedCollapsed(collapsed bool) error`

Saves collapse state for Orphaned Items report.

---

### `SaveReportUnknownTagsCollapsed(collapsed bool) error`

Saves collapse state for Unknown Tags report.

---

### `SaveReportUnknownTypesCollapsed(collapsed bool) error`

Saves collapse state for Unknown Types report.

---

### `SaveReportLinkedNotInDefCollapsed(collapsed bool) error`

Saves collapse state for Linked Items Not In Definition report.

---

### `SaveReportMissingDefinitionsCollapsed(collapsed bool) error`

Saves collapse state for Missing Definitions report.

---

### `SelectDataFolder() (string, error)`

Opens native folder picker dialog for selecting data directory.

**Returns**: Selected folder path or empty string if cancelled

**Frontend Usage**:
```typescript
const folder = await SelectDataFolder()
if (folder) {
  await SaveDataFolder(folder)
}
```

---

### `SaveDataFolder(folder string) error`

Saves data folder path to settings.

**Parameters**:
- `folder` (string): Absolute path to data folder

---

### `SaveDatabaseFile(filename string) error`

Saves database filename to settings.

**Parameters**:
- `filename` (string): Database filename (e.g., `"poetry.db"`)

---

### `AddRecentSearch(term string) error`

Adds a search term to recent searches (max 10, FIFO).

---

### `SaveSearch(name, query string, types []string, source string) error`

Saves a named search with filters.

**Parameters**:
- `name` (string): Search name
- `query` (string): Search query
- `types` ([]string): Filtered types
- `source` (string): Filtered source

---

### `DeleteSavedSearch(name string) error`

Deletes a saved search by name.

---

## Reports & Analytics

### `GetUnlinkedReferences() ([]map[string]interface{}, error)`

Returns items containing reference tags without corresponding links.

**Returns**:
```json
[
  {
    "itemId": 123,
    "word": "sonnet",
    "type": "Reference",
    "refCount": 3,
    "definition": "Contains {w:Shakespeare} but no link exists"
  }
]
```

---

### `GetDuplicateItems() ([]map[string]interface{}, error)`

Returns items with duplicate stripped names (case-insensitive, punctuation-removed).

**Returns**:
```json
[
  { "itemId": 123, "word": "Shakespeare", "strippedName": "shakespeare" },
  { "itemId": 456, "word": "SHAKESPEARE", "strippedName": "shakespeare" }
]
```

---

### `GetOrphanedItems() ([]map[string]interface{}, error)`

Returns items with no incoming or outgoing links.

**Returns**:
```json
[
  { "itemId": 789, "word": "orphan", "type": "Reference" }
]
```

---

### `GetLinkedItemsNotInDefinition() ([]map[string]interface{}, error)`

Returns items with links but no reference tags in their text fields.

**Returns**:
```json
[
  {
    "itemId": 123,
    "word": "sonnet",
    "type": "Reference",
    "linkedItems": ["Shakespeare", "Petrarch"],
    "definition": "A 14-line poem (no {w:} tags)"
  }
]
```

---

### `GetItemsWithoutDefinitions() ([]map[string]interface{}, error)`

Returns items with empty or null `definition` field.

---

### `GetItemsWithUnknownTypes() ([]map[string]interface{}, error)`

Returns items with types other than `Reference`, `Writer`, `Title`, or `Other`.

---

### `GetUnknownTags() ([]map[string]interface{}, error)`

Returns items containing tags other than `{w:}`, `{p:}`, or `{t:}`.

**Returns**:
```json
[
  {
    "itemId": 123,
    "word": "example",
    "unknownTags": ["{x:unknown}"],
    "context": "Definition contains {x:unknown} tag"
  }
]
```

---

### `MergeDuplicateItems(originalID int, duplicateIDs []int) error`

Merges duplicate items into a single item.

**Parameters**:
- `originalID` (int): Item to keep
- `duplicateIDs` ([]int): Items to merge and delete

**Actions**:
1. Moves all links from duplicate items to original
2. Deletes duplicate items
3. Updates FTS5 index

**Returns**: `nil` on success

---

## Reference Tables

### `GetAllCliches() ([]database.Cliche, error)`

Returns all clichés from the `cliches` reference table.

**Returns**: Array of `Cliche` objects

---

### `GetAllNames() ([]database.Name, error)`

Returns all names from the `names` reference table.

**Returns**: Array of `Name` objects

---

### `GetAllLiteraryTerms() ([]database.LiteraryTerm, error)`

Returns all literary terms from the `literary_terms` reference table.

**Returns**: Array of `LiteraryTerm` objects

---

### `GetAllSources() ([]database.Source, error)`

Returns all sources from the `sources` reference table.

**Returns**: Array of `Source` objects

---

## Export Operations

### `ExportToJSON() (string, error)`

Exports entire database to JSON file.

**Returns**: Full path to exported file (e.g., `~/exports/poetry-database.json`)

**File Structure**:
```json
{
  "metadata": {
    "version": "1.0",
    "databaseFile": "poetry.db",
    "dataFolder": "/path/to/data",
    "itemCount": 3500
  },
  "references": [...],
  "writers": [...],
  "titles": [...],
  "other": [...],
  "links": [...],
  "reports": {
    "unlinkedReferences": [...],
    "duplicateItems": [...]
  }
}
```

**Errors**:
- File write failures
- Directory creation failures

---

### `ExportToMarkdown() (string, error)`

Exports entire database to Markdown file with formatted sections.

**Returns**: Full path to exported file (e.g., `~/exports/poetry-database.md`)

**File Structure**:
- Table of Contents
- References section (alphabetically sorted)
- Writers section
- Titles section
- Other section
- Data Quality Reports

**Formatting**:
- Reference tags `{w:Shakespeare}` converted to **<small>SHAKESPEARE</small>**
- Sections with anchors for navigation
- Back-to-top links

---

## Text-to-Speech

### `SpeakWord(text string, itemType string, itemWord string) TTSResult`

Generates audio for text using OpenAI TTS API.

**Parameters**:
- `text` (string): Text to speak
- `itemType` (string): Item type (`"Writer"`, `"Reference"`, etc.)
- `itemWord` (string): Item word (used for cache key)

**Returns**:
```go
type TTSResult struct {
    AudioData []byte `json:"audioData"` // MP3 audio bytes
    Cached    bool   `json:"cached"`    // From cache?
    Error     string `json:"error"`     // Error message if failed
    ErrorType string `json:"errorType"` // "missing_key", "network", "api", "unknown"
}
```

**Caching**:
- Cache key: SHA256 hash of `text`
- Cache location: `~/.cache/dbpoetry/audio/`
- Voice: `alloy` for Writers, `nova` for others

**Error Types**:
- `"missing_key"`: `OPENAI_API_KEY` not set
- `"network"`: Network connection failed
- `"api"`: OpenAI API returned error
- `"unknown"`: Other failures

**Frontend Usage**:
```typescript
const result = await SpeakWord(definition, 'Writer', 'Shakespeare')
if (result.error) {
  console.error(result.errorType, result.error)
} else {
  const audio = new Audio(`data:audio/mp3;base64,${btoa(String.fromCharCode(...result.audioData))}`)
  audio.play()
}
```

---

## Data Types

### Item

```go
type Item struct {
    ItemId      int     `json:"itemId"`
    Word        string  `json:"word"`
    Type        string  `json:"type"` // "Reference", "Writer", "Title", "Other"
    Definition  *string `json:"definition"`
    Derivation  *string `json:"derivation"`
    Appendicies *string `json:"appendicies"`
    Source      *string `json:"source"`
    SourcePg    *string `json:"sourcePg"`
    CreatedAt   string  `json:"createdAt"`
    UpdatedAt   string  `json:"updatedAt"`
}
```

### Link

```go
type Link struct {
    LinkId             int    `json:"linkId"`
    SourceItemId       int    `json:"source_item_id"`
    DestinationItemId  int    `json:"destination_item_id"`
    LinkType           string `json:"link_type"`
    CreatedAt          string `json:"createdAt"`
}
```

### SearchOptions

```go
type SearchOptions struct {
    Query    string   `json:"query"`
    Types    []string `json:"types"`
    Source   string   `json:"source"`
    UseRegex bool     `json:"useRegex"`
}
```

---

## Error Handling

All API methods return errors following Go conventions:

```go
func (a *App) GetItem(itemID int) (*database.Item, error) {
    // Returns (item, nil) on success
    // Returns (nil, error) on failure
}
```

**Frontend Error Handling**:

```typescript
try {
  const item = await GetItem(123)
  // Success
} catch (error) {
  // Error contains Go error message
  notifications.show({
    title: 'Error',
    message: error.message,
    color: 'red'
  })
}
```

---

## Performance Considerations

### Expensive Operations

- `GetAllItems()`: O(n) with 3500+ items - cache results
- `GetAllLinks()`: O(n) with 5000+ links - used rarely for export/graph
- `SearchItems()`: FTS5 indexed, generally fast (<100ms)
- `GetStats()`: Requires COUNT queries, moderate cost

### Optimization Strategies

1. **Caching**: Use TanStack Query with `staleTime` for expensive queries
2. **Debouncing**: Debounce user input (300-500ms) before API calls
3. **Pagination**: Limit result sets (e.g., 50 items initially)
4. **Batch Operations**: Use transactions for multiple writes (handled internally)

---

## Development Notes

### Adding New API Methods

1. Add method to `App` struct in [app.go](app.go)
2. Run `wails generate module` to update TypeScript bindings
3. Import from `@wailsjs/go/main/App` in frontend
4. Document here in API.md

### Type Generation

TypeScript types for Go structs are auto-generated in:
- [frontend/wailsjs/go/models.ts](frontend/wailsjs/go/models.ts)

Never edit this file manually - regenerate with `wails generate module`.

---

## See Also

- [ARCHITECTURE.md](ARCHITECTURE.md): System architecture and design patterns
- [CONTRIBUTING.md](CONTRIBUTING.md): Development workflow and guidelines
- [README.md](README.md): Project overview and setup
