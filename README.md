# dbPoetry

A desktop application for managing literary references, definitions, and relationships built with Wails, Go, and React.

## Features

### Core Functionality
- **Item Management**: Create and manage References, Definitions, Terms, Concepts, Titles, and Writers
- **Full-Text Search**: Powered by SQLite FTS5 with Boolean operators (AND, OR, NOT), regex support, and advanced filters
- **Reference Linking**: Automatic parsing and linking of `{w: word}`, `{p: person}`, and `{t: title}` references in definitions
- **Real-Time Validation**: Live validation of references as you type with quick-create for missing items
- **Interactive Graph**: Visualize relationships between items with filtering by type and connection count
- **Text-to-Speech**: Pronunciation support using OpenAI TTS API with intelligent caching

### Data Quality & Reports
- Unlinked references detection
- Duplicate item detection
- Orphaned items (no connections)
- Missing definitions report
- Unknown tags and types analysis
- Items linked but not mentioned in definitions

### Export & Backup
- **JSON Export**: Complete structured data with all metadata and relationships
- **Markdown Export**: Human-readable format with resolved references and table of contents
- **Export Both**: Simultaneous export in both formats
- **Automated Backups**: Daily backups with 7-day rotation
- **Manual Backup/Restore**: On-demand database snapshots

### User Experience
- **Keyboard Shortcuts**: Fast navigation with `/` (search), `n` (new item), `g` (graph), `h` (home), `Esc` (back)
- **Command Palette**: Quick access to all features with `Cmd/Ctrl+K`
- **Dark Mode**: Automatic system theme detection
- **Window Persistence**: Remembers window size and position
- **Recent Searches**: Quick access to previous search queries
- **Saved Searches**: Store frequently used search filters

## Setup

### Prerequisites

- **Go 1.23+**: [Download Go](https://go.dev/dl/)
- **Node.js 18+**: [Download Node.js](https://nodejs.org/)
- **Wails CLI v2.10.2**: `go install github.com/wailsapp/wails/v2/cmd/wails@latest`

### Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your API keys:
   ```bash
   # Required for text-to-speech functionality (optional)
   OPENAI_API_KEY=sk-your-actual-key-here
   ```

3. Get an OpenAI API key at: <https://platform.openai.com/api-keys>

**Note**: The `.env` file contains sensitive data and is excluded from version control.

### Database Setup

The application uses SQLite with FTS5 (Full-Text Search) support. On first launch, it will:
- Create a database at the location specified in settings (default: project root)
- Initialize tables, indexes, and FTS search structures
- Set up automated daily backups

To use a different database location:
1. Open Settings
2. Select "Change Data Folder"
3. Choose your preferred location
4. Update the Database File name if needed
5. Restart the application

## Development

### Live Development

To run in live development mode:

```bash
wails dev
```

This will:
- Start a Vite development server with hot module reload
- Launch the desktop application
- Expose a dev server at <http://localhost:34115> for browser-based development

### Testing

```bash
# Run all tests (Go + Frontend)
yarn test

# Run Go backend tests only
yarn test-go

# Run frontend tests only
yarn test-tsx

# Run with coverage
cd frontend && yarn test --coverage
```

### Linting

```bash
# Lint both Go and TypeScript
yarn lint

# Lint Go only
cd backend && go vet ./...

# Lint TypeScript only
cd frontend && yarn lint
```

### Building

To build a production package with SQLite FTS5 support:

```bash
wails build -tags fts5
```

**Important**: Always include `-tags fts5` to enable full-text search functionality.

The built application will be in `build/bin/`.

## Architecture

### Technology Stack
- **Backend**: Go with Wails framework for native API bridge
- **Frontend**: React with TypeScript, Mantine UI components
- **Database**: SQLite with FTS5 full-text search
- **Graph**: D3.js force simulation with React Flow
- **State Management**: TanStack Query (React Query)
- **API**: Direct CGO bridge (no HTTP/REST overhead)

### Project Structure
```
dbPoetry_ddr/
├── app.go                 # Main application logic, API handlers
├── main.go               # Entry point
├── backend/
│   ├── database/         # Database layer with SQLite operations
│   └── settings/         # Settings persistence
├── frontend/
│   ├── src/
│   │   ├── pages/       # Main application pages
│   │   ├── components/  # Reusable UI components
│   │   ├── hooks/       # Custom React hooks
│   │   └── utils/       # Shared utilities
│   └── wailsjs/         # Auto-generated TypeScript bindings
├── schema.sql           # Database schema with indexes and views
└── wails.json          # Wails configuration
```

### Key Patterns
- **Direct CGO Bridge**: Frontend calls Go functions directly (no REST API)
- **Type Safety**: Auto-generated TypeScript types from Go structs
- **Reference System**: `{w:}, {p:}, {t:}` tags for semantic linking
- **Optimistic Updates**: UI updates immediately with background sync
- **Streaming Data**: Progressive loading for large datasets

## Documentation

- [CONTRIBUTING.md](CONTRIBUTING.md) - Development guidelines and workflow
- [ARCHITECTURE.md](ARCHITECTURE.md) - Detailed technical architecture
- [API.md](API.md) - Go backend API reference
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues and solutions

## License

See LICENSE file for details.
