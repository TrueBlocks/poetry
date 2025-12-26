# Frontend Application

The frontend is a Single Page Application (SPA) built with React and TypeScript, bundled by Vite.

## Routing

Routing is handled by `react-router-dom`. The main routes are defined in `App.tsx`:

- `/`: Dashboard
- `/search`: Search interface
- `/item/:id`: Item details
- `/settings`: Application settings
- `/reports`: Data reports
- `/tables`: Raw data tables

## State Management

The application uses **Zustand** for state management. Stores are located in `frontend/src/stores/`.

- `useUIStore`: Manages UI state (theme, sidebar visibility, last view).
- `useDataStore`: (If applicable) Caches fetched data.

## Wails Bindings

Communication with the Go backend is done via auto-generated bindings in `frontend/wailsjs/`.
- `go/main/App`: General app methods.
- `go/services/*`: Service-specific methods (e.g., `ItemsService.GetItem`).

## Components

- **Layout**: The main wrapper component containing the Sidebar and Content area.
- **CommandPalette**: A global modal for quick actions (`Cmd+K`).
- **ItemDetail**: The complex component for rendering parsed item definitions.

## Styling

Styling is handled via CSS modules or global CSS (`style.css`, `app.css`). The application supports theming (Light/Dark mode).
