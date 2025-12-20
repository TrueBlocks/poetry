# Contributing to dbPoetry

Thank you for your interest in contributing to dbPoetry! This document provides guidelines and workflows for development.

## Development Environment

### Required Tools
- Go 1.23 or later
- Node.js 18 or later  
- Wails CLI v2.10.2
- **Package Manager**: YARN ONLY (never use npm or npx)
- **Shell**: fish (commands in this guide use fish syntax)

### Initial Setup

1. Clone the repository:
   ```fish
   git clone <repository-url>
   cd poetry
   ```

2. Install dependencies:
   ```fish
   cd frontend
   yarn install
   cd ..
   ```

3. Set up environment variables:
   ```fish
   cp .env.example .env
   # Edit .env and add your OPENAI_API_KEY
   ```

4. Run in development mode:
   ```fish
   wails dev
   ```

## Development Workflow

### Code Style

#### Go
- Use `gofmt` for formatting
- Follow standard Go conventions
- Package declarations first, then imports
- Group imports: standard library, third-party, local packages
- Run `go vet ./...` before committing

#### TypeScript/React
- **NO React imports** (implicitly available in Vite)
- Use path aliases: `@models`, `@components`, `@utils`, `@hooks`
- **No `any` types** - always use specific types
- **No comments in production code** - only for TODO items
- Use `Log` from `@utils` instead of console.log (console is invisible in Wails)

### Code Patterns

#### Reference System
Use DataFacet enum values, never custom strings:
```typescript
import { types } from '@models'

const facet = types.DataFacet.MONITORS // ✓ Correct
const facet = "monitors" // ✗ Wrong
```

#### ViewStateKey Pattern
```typescript
interface ViewStateKey {
  viewName: string
  tabName: types.DataFacet
}
```

#### Component Structure
```
views/[viewname]/
├── [ViewName].tsx     # Main component
├── facets.ts          # DataFacet configurations
├── columns.ts         # Table column definitions
└── index.ts           # Exports
```

### File Placement

#### Go Files
- Package declarations first
- Proper import grouping
- Include sufficient context in code edits
- Never insert before package lines or between imports

#### TypeScript Files
- Imports grouped by: external, internal, types
- Respect class/function boundaries
- Use multi-line edits for related changes

### Testing

We follow a "Pragmatic Testing" philosophy. We value high-value tests over 100% coverage.

#### Philosophy
- **High Value:** Test complex logic (regex, data transformation) and critical backend paths (database init, seeding).
- **Avoid Brittle Tests:** Do not write snapshot tests or complex DOM mocking for React components unless they contain heavy business logic.
- **No Mocks for Logic:** Pure logic functions should be tested with real inputs and outputs.

#### Frontend Tests
- Place tests in a `__tests__` directory next to the file being tested.
- Example: `frontend/src/components/ItemDetail/__tests__/DefinitionRenderer.regex.test.tsx`
- Run tests: `cd frontend && yarn test`

#### Backend Tests
- Place tests in the same package as the code (e.g., `seeding_test.go` next to `seeding.go`).
- Run tests: `go test ./...`

#### Before Committing
```fish
# Run all tests
yarn test

# Run Go tests
yarn test-go

# Run frontend tests
cd frontend && yarn test

# Lint everything
yarn lint
```

#### Writing Tests
- **Backend**: Use `go test -tags fts5 ./backend/...`
- **Frontend**: Place tests in `__tests__` folders next to components
- **Coverage**: Aim for >80% on critical paths

### Building

#### Development Build
```fish
wails dev
```

#### Production Build
```fish
wails build -tags fts5
```

**CRITICAL**: Always include `-tags fts5` for SQLite FTS5 support.

### Regenerating TypeScript Bindings

After changing Go structs exposed to frontend:
```fish
wails generate module
```

This updates `frontend/wailsjs/go/models.ts` with new TypeScript types.

## Code Quality Principles

### NO Over-Engineering
- **Simple, boring code** beats complex "elegant" solutions
- **STOP and THINK**: Ask "What's the simplest solution?" before coding
- **If solution has >3 moving parts**, it's probably over-engineered

### Discovery-Driven Development
- Implementation may reveal better solutions - be open to pivoting
- When multiple approaches exist, prefer removing redundant functionality
- Document architectural decisions when discovering superior patterns
- Build context incrementally through targeted investigation

### Collaboration Protocol
- **Ask early, ask often**: When complexity starts creeping in, stop and discuss
- **Own mistakes**: Broken code is our responsibility
- **Use existing utilities first**: Check `@utils` before creating new ones
- **Stop conditions**: Test failures, lint errors, unclear requirements - stop and report

## Common Operations

### Adding a New View
1. Create folder: `frontend/src/views/[viewname]/`
2. Add main component: `[ViewName].tsx`
3. Define facets: `facets.ts`
4. Configure columns: `columns.ts`
5. Export: `index.ts`
6. Update routing in App.tsx

### Adding a Go API Method
1. Add method to `app.go`
2. Run `wails generate module`
3. Import in frontend: `import { MethodName } from '../../wailsjs/go/main/App.js'`
4. Use with TanStack Query for caching

### Adding a Database Table
1. Update `schema.sql`
2. Add indexes for performance
3. Add FTS table if searchable
4. Create triggers to keep FTS in sync
5. Update Go structs in `backend/database/`

### Debugging

#### React Timing Issues (50% of bugs)
- **ASSUMPTION**: Unexpected UI behavior is likely timing/async related
- **Add comprehensive logging**: `Log` from `@utils` throughout data flow
- **Required logging points**: Action start → State change → API call → Data received → Component re-render → Final result
- **Common scenarios**: Optimistic updates vs real data, race conditions, useEffect dependency issues

#### VS Code Problems Server
When VS Code shows stale errors:
```fish
# Restart TypeScript server
Cmd+Shift+P → "TypeScript: Restart TS Server"

# Or reload window
Cmd+Shift+P → "Developer: Reload Window"
```

## Pull Request Process

1. **Create feature branch**: `git checkout -b feature/your-feature`
2. **Make changes**: Follow code style and patterns
3. **Test thoroughly**: Run full test suite
4. **Update documentation**: If adding features or changing APIs
5. **Commit with clear messages**: Explain what and why
6. **Push and create PR**: Include description of changes
7. **Address review feedback**: Iterate based on comments

### Commit Messages
```
feat: Add real-time reference validation to ItemEdit
fix: Resolve race condition in search debouncing
docs: Update README with new export features
refactor: Extract Reports components to separate files
test: Add coverage for useReferenceValidation hook
```

## Architecture Guidelines

### Data Flow
- **Streaming/decoupled fetching**: Pages appear immediately, data streams progressively
- **Collection/Store/Page pattern**: Auto-generated types like `monitors.MonitorsPage`
- **Optimistic updates**: Update UI first, sync in background
- **Error boundaries**: Wrap risky components to prevent app crashes

### Performance
- **Debounce user input**: 300ms for search, 500ms for validation
- **Query caching**: Use TanStack Query `staleTime` for frequently accessed data
- **Pagination/filtering**: For large datasets (>500 items)
- **Memoization**: Use `useMemo` for expensive computations

### Security
- **Never commit secrets**: Use `.env` for sensitive data
- **Filter sensitive data**: Backend filters API keys from settings display
- **Validate input**: Sanitize user input before database operations
- **SQL injection**: Use parameterized queries always

## Getting Help

- **Design documents**: Check `./design/` folder for architectural guidance
- **API reference**: See `API.md` for backend method documentation
- **Troubleshooting**: Consult `TROUBLESHOOTING.md` for common issues
- **Architecture**: Read `ARCHITECTURE.md` for system design details

## Code of Conduct

- Be respectful and constructive
- Focus on code, not people
- Welcome newcomers
- Assume good intentions
- Ask questions when unclear

Thank you for contributing to dbPoetry!
