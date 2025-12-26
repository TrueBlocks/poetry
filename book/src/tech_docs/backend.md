# Backend Services

The backend is structured around **Services**, which are Go structs with methods exposed to the frontend via Wails.

## Core Services

### ItemsService (`backend/services/items.go`)
Handles all operations related to `Items`.
- `GetItem(id)`: Fetches a single item.
- `Search(query)`: Performs full-text search.
- `GetRandomItem()`: Returns a random entry.

### TTSService (`backend/services/tts.go`)
Manages Text-to-Speech functionality.
- Generates audio files for item definitions.
- Caches audio files in `data/tts-cache/`.

### ImagesService (`backend/services/images.go`)
Handles image retrieval and management for items.

## Database Layer (`backend/database`)

The application uses `database/sql` with a SQLite driver.
- **Queries**: SQL queries are stored in `backend/database/queries/` or defined as constants.
- **Migration**: Schema migrations are handled to ensure the local database is up-to-date.

## The Parser (`pkg/parser`)

A critical component is the text parser. It transforms raw definition text into structured data for the frontend.
- **Input**: `The definition of {word: poetry}...`
- **Output**: A JSON-serializable structure of `Segments` and `Tokens`.
- **Logic**: Uses regex to identify tags and split text into processable chunks.
