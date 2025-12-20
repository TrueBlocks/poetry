# dbPoetry Architecture

This document describes the technical architecture and design decisions of the dbPoetry application.

## Technology Stack

### Core Framework
- **Wails v2.10.2**: Go + Web frontend framework with native desktop integration
- **Go 1.23+**: Backend logic, database operations, business rules
- **React 18**: Frontend UI framework with TypeScript
- **TypeScript 5**: Type-safe frontend development
- **Vite**: Fast development server and build tool

### UI & Styling
- **Mantine v7**: Component library for consistent UI
- **React Flow**: Interactive graph visualization
- **D3.js**: Force simulation for graph layouts
- **Lucide React**: Icon library

### Data & State
- **SQLite**: Embedded database with FTS5 full-text search
- **TanStack Query**: Async state management, caching, and data fetching
- **React Hooks**: Local component state

### Build & Development
- **Wails CGO Bridge**: Direct JavaScript ↔ Go function calls (no HTTP)
- **Auto-generated TypeScript Types**: From Go structs via Wails
- **Vitest**: Frontend testing framework
- **Go testing**: Backend unit and integration tests

## Architecture Overview

### Three-Layer Architecture

```
┌─────────────────────────────────────────┐
│         Frontend (React/TS)             │
│  - UI Components (Mantine)              │
│  - Pages & Views                        │
│  - State Management (TanStack Query)    │
│  - Custom Hooks                          │
└────────────┬────────────────────────────┘
             │ Wails CGO Bridge
             │ (Auto-generated TypeScript bindings)
┌────────────▼────────────────────────────┐
│       Application Layer (Go)            │
│  - API Methods (app.go)                 │
│  - Business Logic                       │
│  - Settings Management                  │
│  - TTS Integration (OpenAI)             │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│       Data Layer (SQLite)               │
│  - Items, Links, Cliches, Names         │
│  - FTS5 Full-Text Search                │
│  - Indexes & Views                      │
│  - Automated Backups                    │
└─────────────────────────────────────────┘
```

## Project Structure

```
dbPoetry_ddr/
├── app.go                    # Main application API methods
├── main.go                   # Entry point, Wails app initialization
├── backend/
│   ├── database/
│   │   ├── database.go      # SQLite operations, queries, CRUD
│   │   └── database_test.go # Backend unit tests
│   └── settings/
│       └── settings.go      # Settings persistence (JSON file)
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Root component, routing
│   │   ├── pages/           # Main application pages
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Search.tsx
│   │   │   ├── ItemDetail.tsx
│   │   │   ├── ItemEdit.tsx
│   │   │   ├── Graph.tsx
│   │   │   ├── Reports.tsx
│   │   │   ├── Export.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── Tables.tsx
│   │   ├── components/      # Reusable components
│   │   │   ├── Layout.tsx
│   │   │   ├── CommandPalette.tsx
│   │   │   ├── KeyboardShortcutsHelp.tsx
│   │   │   ├── ItemDetail/  # ItemDetail subcomponents
│   │   │   └── Reports/     # Reports subcomponents
│   │   ├── hooks/           # Custom React hooks
│   │   │   ├── useDarkMode.ts
│   │   │   ├── useKeyboardShortcuts.ts
│   │   │   ├── useWindowPersistence.ts
│   │   │   └── useReferenceValidation.ts
│   │   └── utils/           # Utility functions
│   │       ├── colors.ts    # Item type color mapping
│   │       └── references.ts # Reference parsing utilities
│   └── wailsjs/            # Auto-generated Wails bindings
│       ├── go/
│       │   ├── models.ts   # TypeScript types from Go structs
│       │   └── main/App.js # Frontend API methods
│       └── runtime/        # Wails runtime utilities
├── schema.sql              # Database schema definition
└── wails.json             # Wails configuration
```

## Core Concepts

### 1. Wails CGO Bridge

The application uses Wails' direct CGO bridge for frontend-backend communication:

- **No HTTP/REST**: JavaScript calls Go functions directly in the same process
- **Type Safety**: Go structs automatically generate TypeScript interfaces
- **Performance**: Zero serialization overhead, native function calls
- **Simplicity**: No API versioning, no HTTP headers, no REST conventions

Example:
```typescript
// Frontend (TypeScript)
import { GetItem } from '../../wailsjs/go/main/App.js'

const item = await GetItem(123)  // Direct Go function call
```

```go
// Backend (Go)
func (a *App) GetItem(id int) (*database.Item, error) {
    return a.db.GetItem(id)
}
```

### 2. Reference System

Items can reference other items using semantic tags:

- `{w: word}` - Reference to a word/term/concept
- `{p: person}` - Reference to a writer/person (handles possessives)
- `{t: title}` - Reference to a title/work

**Parsing**: Uses regex to extract references from definitions
**Linking**: Creates bidirectional links between items
**Display**: Renders as interactive links in UI
**Validation**: Real-time checking for missing references

### 3. Data Flow Pattern

```
User Action
    ↓
Component Event Handler
    ↓
TanStack Query Mutation
    ↓
Wails API Call (Go function)
    ↓
Database Operation
    ↓
Return Result
    ↓
Query Cache Update
    ↓
Component Re-render
```

**Key Features**:
- **Optimistic Updates**: UI updates before backend confirmation
- **Automatic Caching**: TanStack Query caches responses
- **Invalidation**: Manual cache invalidation after mutations
- **Loading States**: Built-in loading/error states

### 4. Graph Visualization

Uses D3.js force simulation with React Flow for interactive graph:

- **Nodes**: Items (color-coded by type)
- **Edges**: Links between items
- **Forces**: 
  - Force Many Body: Repulsion between nodes
  - Force Link: Attraction along edges
  - Force Center: Centering force
  - Force Collide: Collision detection
- **Filtering**: By type (Reference, Writer, Title) and connection count
- **Performance**: Limits to 500 nodes, then sorts by connection count

### 5. Full-Text Search (FTS5)

SQLite FTS5 provides fast, flexible search:

- **Boolean Operators**: AND, OR, NOT, parentheses
- **Phrase Search**: "exact phrase" in quotes
- **Regex Support**: Optional regex mode for pattern matching
- **Filters**: By type, source, and custom options
- **Ranking**: Results sorted by relevance score
- **Triggers**: Automatic FTS index updates on data changes

### 6. Settings Persistence

Settings stored in JSON file:

```go
type Settings struct {
    DataFolder          string   `json:"dataFolder"`
    DatabaseFile        string   `json:"databaseFile"`
    RecentSearches      []string `json:"recentSearches"`
    SavedSearches       []SavedSearch `json:"savedSearches"`
    WindowX, WindowY    int      `json:"windowX,windowY"`
    WindowWidth, WindowHeight int `json:"windowWidth,windowHeight"`
    // ... other settings
}
```

**Location**: `~/.config/dbpoetry/settings.json` (or OS equivalent)
**Updates**: Atomic write with backup on error
**Validation**: Loaded with defaults for missing fields

## Design Patterns

### Component Composition

Large components decomposed into focused subcomponents:

```
ItemDetail.tsx (main)
├── ItemHeader.tsx         # Title, badges, actions
├── DefinitionRenderer.tsx # Definition with links
├── ReferenceAnalysis.tsx  # Unlinked references
├── LinksList.tsx          # Outgoing/incoming links
└── TextToSpeech.tsx       # Speaker icon logic
```

**Benefits**:
- Easier testing
- Better code organization
- Component reuse
- Clearer responsibilities

### Custom Hooks

Encapsulate complex logic:

- `useDarkMode`: System theme detection and persistence
- `useKeyboardShortcuts`: Global keyboard navigation
- `useWindowPersistence`: Window size/position restoration
- `useReferenceValidation`: Real-time reference checking with debouncing

### Path Aliases

TypeScript path aliases for cleaner imports:

```typescript
import { Item } from '@models'           // vs '../../wailsjs/go/models'
import { Button } from '@components'     // vs '../../../components'
import { Log } from '@utils'            // vs '../../utils'
import { useQuery } from '@hooks'       // vs '../hooks'
```

## Performance Optimizations

### 1. Database Indexes

Strategic indexes on frequently queried columns:

```sql
-- Covering indexes include all query columns
CREATE INDEX idx_links_source_covering 
ON links(source_item_id, created_at DESC, destination_item_id, link_type);

CREATE INDEX idx_links_destination_covering 
ON links(destination_item_id, created_at DESC, source_item_id, link_type);
```

### 2. Query Caching

TanStack Query with intelligent cache management:

```typescript
const { data } = useQuery({
  queryKey: ['item', id],
  queryFn: () => GetItem(id),
  staleTime: 30000,  // Cache for 30 seconds
})
```

### 3. Debouncing

User input debounced to reduce API calls:

- **Search**: 300ms delay
- **Reference Validation**: 500ms delay
- **Window Resize**: 200ms delay

### 4. Result Limiting

Large result sets paginated or limited:

- **Search**: 50 results initially, "Show More" button
- **Graph**: 500 nodes max, sorted by connection count
- **Reports**: Virtual scrolling for long lists

### 5. Memoization

Expensive computations memoized with `useMemo`:

```typescript
const sortedResults = useMemo(() => {
  return results.sort((a, b) => b.connections - a.connections)
}, [results])
```

## Security Considerations

### API Key Protection

- Environment variables in `.env` file
- Backend filters sensitive keys from GetEnvVars()
- `.env` excluded from git via `.gitignore`

### SQL Injection Prevention

- Parameterized queries throughout
- No string concatenation for SQL
- Prepared statements in Go database layer

### Input Validation

- Type checking on Go API boundaries
- Frontend validation before API calls
- Database constraints (unique, foreign key)

## Error Handling

### Frontend

```typescript
const mutation = useMutation({
  mutationFn: updateItem,
  onSuccess: () => {
    notifications.show({ title: 'Success', color: 'green' })
    queryClient.invalidateQueries(['item', id])
  },
  onError: (error) => {
    notifications.show({ 
      title: 'Error', 
      message: error.message,
      color: 'red' 
    })
  },
})
```

### Backend

```go
func (a *App) GetItem(id int) (*database.Item, error) {
    if id <= 0 {
        return nil, fmt.Errorf("invalid item ID: %d", id)
    }
    return a.db.GetItem(id)
}
```

### Error Boundaries

React error boundaries wrap risky components:

```typescript
<ErrorBoundary fallback={<ErrorFallback />}>
  <Graph />
</ErrorBoundary>
```

## Testing Strategy

### Backend Tests

```bash
go test -tags fts5 ./backend/...
```

- Unit tests for database operations
- Test cases for reference parsing
- Edge case handling (possessives, unicode, etc.)

### Frontend Tests

```bash
cd frontend && yarn test
```

- Component rendering tests
- Hook behavior tests
- Utility function tests
- Integration tests for critical paths

### Test Coverage Goals

- **Backend**: >80% coverage on database operations
- **Frontend**: >70% coverage on components and hooks
- **Utils**: 100% coverage on parsing functions

## Future Considerations

### Scalability

- **Large Datasets**: Currently handles 3500+ items smoothly
- **Graph Performance**: May need WebGL for >1000 nodes
- **Search Optimization**: FTS5 scales well, consider result streaming

### Extensibility

- **Plugin System**: Could add plugin architecture for custom reports
- **Export Formats**: Easy to add PDF, CSV, or custom formats
- **Custom Fields**: Schema allows adding columns without breaking existing code

### Multi-Database Support

- **Current**: Single database per instance
- **Future**: Multiple database tabs/windows
- **Challenge**: State management for multiple DB contexts

## Conclusion

dbPoetry uses modern web technologies with native desktop performance via Wails. The architecture prioritizes:

- **Simplicity**: Boring, straightforward code
- **Performance**: Strategic caching and indexing
- **Type Safety**: Go + TypeScript with auto-generated bindings
- **User Experience**: Fast, responsive, keyboard-driven UI
- **Maintainability**: Clean separation of concerns, comprehensive tests

For questions or clarifications, consult the [CONTRIBUTING.md](CONTRIBUTING.md) guide or open an issue.
