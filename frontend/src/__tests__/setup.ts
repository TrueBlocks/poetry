import { vi } from 'vitest'

// Mock window.matchMedia for jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock Wails runtime functions
vi.mock('../../wailsjs/runtime/runtime.js', () => ({
  LogInfo: vi.fn(),
  LogError: vi.fn(),
  LogDebug: vi.fn(),
  LogWarning: vi.fn(),
}))

// Mock Wails Go bindings
vi.mock('../../wailsjs/go/main/App.js', () => ({
  GetAllItems: vi.fn(() => Promise.resolve([])),
  GetItem: vi.fn(() => Promise.resolve(null)),
  GetAllLinks: vi.fn(() => Promise.resolve([])),
  SearchItems: vi.fn(() => Promise.resolve([])),
  CreateItem: vi.fn(() => Promise.resolve({ itemId: 1 })),
  UpdateItem: vi.fn(() => Promise.resolve()),
  DeleteItem: vi.fn(() => Promise.resolve()),
  SpeakWord: vi.fn(() => Promise.resolve()),
  GetSettings: vi.fn(() => Promise.resolve({})),
  SaveSettings: vi.fn(() => Promise.resolve()),
  GetItemImage: vi.fn(() => Promise.resolve("")),
  GetEnvVars: vi.fn(() => Promise.resolve({})),
  HasEnvFile: vi.fn(() => Promise.resolve(true)),
}))

// Mock React Router
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: vi.fn(() => vi.fn()),
    useLocation: vi.fn(() => ({ pathname: '/', search: '', hash: '', state: null })),
    useParams: vi.fn(() => ({})),
    Link: vi.fn(({ children }: any) => children),
  }
})

// Mock Mantine notifications
vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
    hide: vi.fn(),
    clean: vi.fn(),
  },
}))
