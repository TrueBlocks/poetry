# Architecture Overview

The Poetry Application is built using the **Wails** framework, which allows for writing desktop applications using Go for the backend and web technologies (React) for the frontend.

## High-Level Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS (or custom CSS).
- **Backend**: Go (Golang).
- **Bridge**: Wails (handles communication between Go and JavaScript).
- **Database**: SQLite (embedded relational database).

## Application Lifecycle

1.  **Main Entry**: `main.go` initializes the Wails application.
2.  **App Struct**: `app.go` defines the `App` struct, which holds the application state and lifecycle hooks (`startup`, `domReady`, `shutdown`).
3.  **Service Initialization**: On startup, the backend initializes the SQLite database connection and instantiates services (`ItemsService`, `TTSService`, etc.).
4.  **Frontend Launch**: Wails launches a webview rendering the React application served by Vite.

## Directory Structure

- `app.go` / `main.go`: Application entry points.
- `backend/`: Go packages for business logic and data access.
    - `database/`: SQLite queries and connection management.
    - `services/`: Domain-specific logic exposed to the frontend.
- `frontend/`: The React application.
    - `src/`: Source code (Components, Pages, Stores).
    - `wailsjs/`: Auto-generated bindings for Go methods.
- `pkg/`: Shared Go packages (`parser`, `logger`, `validator`).
- `build/`: Build artifacts and configuration.
