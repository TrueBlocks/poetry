# Troubleshooting Guide

Common issues and solutions for dbPoetry development and usage.

## Table of Contents

- [Build Issues](#build-issues)
- [Database Issues](#database-issues)
- [TypeScript/Frontend Issues](#typescriptfrontend-issues)
- [React Timing Issues](#react-timing-issues)
- [VS Code Issues](#vs-code-issues)
- [Wails Issues](#wails-issues)
- [Search Issues](#search-issues)
- [TTS Issues](#tts-issues)
- [Performance Issues](#performance-issues)

---

## Build Issues

### Error: `undefined: database.NewDB`

**Cause**: FTS5 build tag not specified

**Solution**:
```bash
# Always use -tags fts5 for Go builds
go build -tags fts5 -o /tmp/app .
go test -tags fts5 ./...

# Wails automatically includes fts5 tag
wails dev
wails build
```

**Why**: SQLite FTS5 requires CGO compilation flag. Without it, the FTS5 extension is not available.

---

### Error: `yarn: command not found`

**Cause**: Using npm/npx instead of yarn

**Solution**: Install and use yarn exclusively:
```bash
npm install -g yarn
cd frontend
yarn install
yarn dev
```

**Note**: See `.github/copilot-instructions.md` - **YARN ONLY, NEVER NPM**.

---

### Error: `go.mod file not found`

**Cause**: Running go commands from wrong directory

**Solution**: Always run from repository root:
```bash
cd /Users/jrush/Databases/dbPoetry_ddr
go build -tags fts5 .
```

---

### Error: `package github.com/TrueBlocks/trueblocks-poetry/backend/database is not in GOROOT`

**Cause**: Go module path mismatch

**Solution**: Check [go.mod](go.mod) module name matches imports in Go files:
```go
// go.mod
module github.com/TrueBlocks/trueblocks-poetry

// app.go imports
import "github.com/TrueBlocks/trueblocks-poetry/backend/database"
```

---

## Database Issues

### Error: `no such table: items_fts`

**Cause**: Database schema not initialized or FTS5 not enabled

**Solution**:
1. Delete old database: `rm poetry.db`
2. Rebuild with FTS5: `wails build -tags fts5`
3. Restart app - schema auto-creates on startup

**Verification**:
```bash
sqlite3 poetry.db "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%fts%';"
# Should show: items_fts
```

---

### Error: `UNIQUE constraint failed: items.word`

**Cause**: Attempting to create duplicate item

**Solution**: Check for existing item before creating:
```typescript
const existing = await GetItemByWord('shakespeare')
if (existing) {
  await UpdateItem({ ...existing, definition: newDef })
} else {
  await CreateItem({ word: 'shakespeare', type: 'Writer', definition: newDef })
}
```

---

### Database file not found after changing `dataDir`

**Cause**: Database path not updated after settings change

**Solution**:
1. Ensure [app.go](app.go) `startup()` uses `DataFolder` setting:
   ```go
   dbPath := filepath.Join(a.settings.Get().DataFolder, dbFile)
   ```
2. Restart application after changing data folder
3. Check settings file: `~/.config/dbpoetry/settings.json`

---

### Database locked error

**Cause**: Multiple processes accessing same database

**Solution**:
1. Close all dbPoetry instances
2. Check for zombie processes: `ps aux | grep poetry`
3. Kill if necessary: `kill -9 <PID>`
4. Reopen database

---

## TypeScript/Frontend Issues

### Error: `Cannot find module '@wailsjs/go/main/App'`

**Cause**: Wails bindings not generated

**Solution**:
```bash
wails generate module
# or run in dev mode (auto-generates)
wails dev
```

**Location**: Bindings generated in [frontend/wailsjs/go/](frontend/wailsjs/go/)

---

### Error: `Property 'X' does not exist on type 'Item'`

**Cause**: TypeScript types out of sync with Go structs

**Solution**:
1. Check Go struct definition in [backend/database/database.go](backend/database/database.go)
2. Regenerate types: `wails generate module`
3. Restart TypeScript server in VS Code: `Cmd+Shift+P` → "TypeScript: Restart TS Server"

---

### Error: `Module not found: Error: Can't resolve '@components'`

**Cause**: TypeScript path aliases not configured

**Solution**: Check [frontend/tsconfig.json](frontend/tsconfig.json):
```json
{
  "compilerOptions": {
    "paths": {
      "@components/*": ["./src/components/*"],
      "@utils/*": ["./src/utils/*"],
      "@hooks/*": ["./src/hooks/*"],
      "@models": ["./wailsjs/go/models"]
    }
  }
}
```

---

### Imports showing errors but code compiles fine

**Cause**: VS Code TypeScript server using wrong `tsconfig.json`

**Solution**:
1. Open [frontend/tsconfig.json](frontend/tsconfig.json) in VS Code
2. `Cmd+Shift+P` → "TypeScript: Select TypeScript Version" → "Use Workspace Version"
3. `Cmd+Shift+P` → "TypeScript: Restart TS Server"

---

## React Timing Issues

> **CRITICAL**: 50% of bugs are React timing/async issues. Always suspect timing first.

### Symptom: Data appears then disappears

**Cause**: Optimistic update overwritten by stale query data

**Debugging**:
```typescript
import Log from '@utils'

const mutation = useMutation({
  mutationFn: updateItem,
  onMutate: async (newItem) => {
    Log('MUTATION START', newItem)
    await queryClient.cancelQueries(['item', id])
    const previous = queryClient.getQueryData(['item', id])
    queryClient.setQueryData(['item', id], newItem)
    Log('OPTIMISTIC UPDATE', newItem)
    return { previous }
  },
  onSuccess: (data) => {
    Log('MUTATION SUCCESS', data)
    queryClient.invalidateQueries(['item', id])
  },
  onError: (err, newItem, context) => {
    Log('MUTATION ERROR', err)
    queryClient.setQueryData(['item', id], context.previous)
  },
})
```

**Solution**: Ensure `cancelQueries` called before optimistic update.

---

### Symptom: Selection wrong after navigation

**Cause**: Navigation happens before data loads, component renders with stale selected item

**Debugging**:
```typescript
useEffect(() => {
  Log('NAVIGATION', { view, selectedId })
}, [view, selectedId])

useEffect(() => {
  Log('DATA LOADED', { items, loading })
}, [items, loading])
```

**Solution**: Wait for data load before setting selection:
```typescript
const { data: items, isLoading } = useQuery(['items'], getItems)

useEffect(() => {
  if (!isLoading && items && items.length > 0) {
    setSelectedId(items[0].itemId)
  }
}, [isLoading, items])
```

---

### Symptom: Action works sometimes, fails other times

**Cause**: Race condition between multiple async operations

**Debugging**:
```typescript
Log('ACTION START', Date.now())
await operation1()
Log('OPERATION 1 DONE', Date.now())
await operation2()
Log('OPERATION 2 DONE', Date.now())
```

**Solution**: Use sequential `await` instead of `Promise.all()` for state-modifying operations:
```typescript
// BAD - race condition
await Promise.all([updateItem(1), updateItem(2)])

// GOOD - sequential
await updateItem(1)
await updateItem(2)
```

---

### Symptom: State "one step behind"

**Cause**: `useEffect` missing dependencies or stale closure

**Debugging**:
```typescript
useEffect(() => {
  Log('EFFECT RAN', { selectedId, items })
  // Do something with selectedId
}, [selectedId]) // Missing items dependency?
```

**Solution**: Add all dependencies or use functional updates:
```typescript
// Option 1: Add all dependencies
useEffect(() => {
  // ...
}, [selectedId, items])

// Option 2: Functional update
setSelectedId(prev => {
  Log('PREV', prev)
  return newId
})
```

---

## VS Code Issues

### TypeScript errors for deleted files

**Symptom**: VS Code shows errors for files that no longer exist

**Solution**:
```bash
# Method 1: Restart TypeScript server (fastest)
Cmd+Shift+P → "TypeScript: Restart TS Server"

# Method 2: Reload VS Code window
Cmd+Shift+P → "Developer: Reload Window"

# Method 3: Clear workspace state (nuclear option)
Cmd+Shift+P → "Developer: Reset Workspace State"
# Then reload window
```

---

### IntelliSense not working for Wails imports

**Cause**: TypeScript server not indexing `wailsjs/` directory

**Solution**:
1. Ensure [frontend/tsconfig.json](frontend/tsconfig.json) includes:
   ```json
   {
     "include": ["src/**/*", "wailsjs/**/*"]
   }
   ```
2. Restart TS Server: `Cmd+Shift+P` → "TypeScript: Restart TS Server"

---

### ESLint/Prettier conflicts

**Cause**: Competing formatters

**Solution**: Disable Prettier if using ESLint:
```json
// .vscode/settings.json
{
  "editor.defaultFormatter": "dbaeumer.vscode-eslint",
  "editor.formatOnSave": true
}
```

---

## Wails Issues

### Error: `Wails version mismatch`

**Cause**: Wails CLI version doesn't match [go.mod](go.mod) version

**Solution**:
```bash
# Check versions
wails version
grep wails go.mod

# Update CLI to match go.mod
go install github.com/wailsapp/wails/v2/cmd/wails@v2.10.2
```

---

### Error: `frontend build failed`

**Cause**: Missing frontend dependencies

**Solution**:
```bash
cd frontend
yarn install
yarn build

# Then retry Wails build
cd ..
wails build
```

---

### Application window doesn't appear

**Cause**: Window position saved off-screen

**Solution**: Delete settings file to reset window position:
```bash
rm ~/.config/dbpoetry/settings.json
```

---

### Hot reload not working in dev mode

**Cause**: Vite config issue or port conflict

**Solution**:
1. Check [frontend/vite.config.ts](frontend/vite.config.ts)
2. Kill processes on port 34115: `lsof -ti:34115 | xargs kill -9`
3. Restart: `wails dev`

---

## Search Issues

### FTS5 search returns no results

**Cause**: Special characters breaking FTS5 syntax

**Solution**: Escape special characters or use regex mode:
```typescript
// Option 1: Escape for FTS5
const escaped = query.replace(/[()"|*]/g, '\\$&')
await SearchItems(escaped)

// Option 2: Use regex mode
await SearchItemsWithOptions({
  query: query,
  useRegex: true,
  types: [],
  source: ''
})
```

---

### Search very slow (>1 second)

**Cause**: Large result set or missing indexes

**Solution**:
1. Check indexes exist:
   ```bash
   sqlite3 poetry.db "PRAGMA index_list('items');"
   ```
2. Add result limiting:
   ```typescript
   const LIMIT = 50
   const results = allResults.slice(0, LIMIT)
   ```
3. Add debouncing (300ms):
   ```typescript
   const [debouncedQuery, setDebouncedQuery] = useState('')
   useEffect(() => {
     const timer = setTimeout(() => setDebouncedQuery(query), 300)
     return () => clearTimeout(timer)
   }, [query])
   ```

---

## TTS Issues

### Error: `OpenAI API key not set`

**Cause**: `OPENAI_API_KEY` environment variable missing

**Solution**:
```bash
# Create .env file in repo root
echo "OPENAI_API_KEY=sk-..." > .env

# Or set in shell (temporary)
export OPENAI_API_KEY=sk-...

# Restart app
```

---

### TTS audio garbled or cut off

**Cause**: Audio data corruption during base64 encoding

**Solution**: Check audio playback in [ItemDetail.tsx](frontend/src/pages/ItemDetail.tsx):
```typescript
const audioBlob = new Blob([result.audioData], { type: 'audio/mp3' })
const audioUrl = URL.createObjectURL(audioBlob)
const audio = new Audio(audioUrl)
audio.play()
```

---

### TTS very slow (>5 seconds)

**Cause**: Network latency to OpenAI API

**Solution**: Use caching (already implemented):
- First request: 3-5 seconds (OpenAI API call)
- Subsequent requests: <100ms (from disk cache)
- Cache location: `~/.cache/dbpoetry/audio/`

---

## Performance Issues

### Application startup slow (>3 seconds)

**Cause**: Large database or slow disk

**Solution**:
1. Check database size: `ls -lh poetry.db`
2. Optimize database:
   ```bash
   sqlite3 poetry.db "VACUUM;"
   sqlite3 poetry.db "ANALYZE;"
   ```
3. Move database to SSD if on HDD

---

### Graph rendering freezes UI

**Cause**: Too many nodes (>500)

**Solution**: Limit nodes in [Graph.tsx](frontend/src/pages/Graph.tsx):
```typescript
const MAX_NODES = 500
const limitedNodes = sortedNodes
  .slice(0, MAX_NODES)
  .map(/* ... */)
```

---

### Memory usage grows over time

**Cause**: Query cache not being garbage collected

**Solution**: Set cache limits in [App.tsx](frontend/src/App.tsx):
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      gcTime: 300000, // 5 minutes
    },
  },
})
```

---

### Typing lag in large text fields

**Cause**: React re-rendering on every keystroke

**Solution**: Debounce state updates:
```typescript
const [value, setValue] = useState('')
const [debouncedValue, setDebouncedValue] = useState('')

useEffect(() => {
  const timer = setTimeout(() => setDebouncedValue(value), 300)
  return () => clearTimeout(timer)
}, [value])

// Use debouncedValue for expensive operations
useEffect(() => {
  expensiveOperation(debouncedValue)
}, [debouncedValue])
```

---

## Getting Help

### Before asking for help:

1. **Check this document** - most issues are documented here
2. **Check recent git history** - might be a known regression
3. **Run tests**: `yarn test` - isolate the failure
4. **Add logging**: Use `Log` from `@utils`, check console

### When reporting issues:

Include:
- OS version (macOS, Windows, Linux)
- Wails version: `wails version`
- Go version: `go version`
- Node version: `node -v`
- Yarn version: `yarn -v`
- Error message (full stack trace)
- Steps to reproduce
- Relevant logs with timestamps

### Useful debugging commands:

```bash
# Check environment
wails doctor

# Verbose build
wails build -v

# Check database schema
sqlite3 poetry.db ".schema"

# Check FTS5 availability
sqlite3 poetry.db "PRAGMA compile_options;" | grep FTS

# Check port usage
lsof -i :34115

# Check process list
ps aux | grep poetry

# Check logs (if implemented)
tail -f ~/Library/Logs/dbpoetry/app.log
```

---

## Common Patterns

### Debugging React rendering

```typescript
import Log from '@utils'

useEffect(() => {
  Log('COMPONENT MOUNTED', { props })
  return () => Log('COMPONENT UNMOUNTED')
}, [])

useEffect(() => {
  Log('PROP CHANGED', { propName })
}, [propName])

Log('RENDER', { state, props })
```

### Debugging TanStack Query

```typescript
const { data, isLoading, error, dataUpdatedAt } = useQuery({
  queryKey: ['item', id],
  queryFn: async () => {
    Log('QUERY START', id)
    const result = await GetItem(id)
    Log('QUERY SUCCESS', result)
    return result
  },
  onError: (err) => Log('QUERY ERROR', err),
})

useEffect(() => {
  Log('QUERY STATE', { isLoading, dataUpdatedAt, hasData: !!data })
}, [isLoading, dataUpdatedAt, data])
```

### Debugging mutations

```typescript
const mutation = useMutation({
  mutationFn: updateItem,
  onMutate: (vars) => Log('MUTATION START', vars),
  onSuccess: (data) => Log('MUTATION SUCCESS', data),
  onError: (err) => Log('MUTATION ERROR', err),
  onSettled: () => Log('MUTATION SETTLED'),
})
```

---

## See Also

- [CONTRIBUTING.md](CONTRIBUTING.md): Development workflow and debugging strategies
- [ARCHITECTURE.md](ARCHITECTURE.md): System architecture and design patterns
- [API.md](API.md): API reference with error handling
- [README.md](README.md): Setup and getting started
