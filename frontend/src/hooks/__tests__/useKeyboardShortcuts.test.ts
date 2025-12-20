import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import useKeyboardShortcuts from '../useKeyboardShortcuts'

// Mock navigate and location
const mockNavigate = vi.fn()
const mockLocation = { pathname: '/', search: '', hash: '', state: null }

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
  }
})

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  test('navigates to search on / key', () => {
    renderHook(() => useKeyboardShortcuts(false, vi.fn()))
    
    const event = new KeyboardEvent('keydown', { key: '/' })
    document.dispatchEvent(event)
    
    expect(mockNavigate).toHaveBeenCalledWith('/search')
  })

  test('navigates to new item on n key', () => {
    renderHook(() => useKeyboardShortcuts(false, vi.fn()))
    
    const event = new KeyboardEvent('keydown', { key: 'n' })
    document.dispatchEvent(event)
    
    expect(mockNavigate).toHaveBeenCalledWith('/item/new')
  })

  test('navigates to home on h key', () => {
    renderHook(() => useKeyboardShortcuts(false, vi.fn()))
    
    const event = new KeyboardEvent('keydown', { key: 'h' })
    document.dispatchEvent(event)
    
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  test('does not trigger shortcuts when command palette is open', () => {
    renderHook(() => useKeyboardShortcuts(true, vi.fn()))
    
    const event = new KeyboardEvent('keydown', { key: 'n' })
    document.dispatchEvent(event)
    
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  test('does not trigger shortcuts when typing in input', () => {
    renderHook(() => useKeyboardShortcuts(false, vi.fn()))
    
    const input = document.createElement('input')
    document.body.appendChild(input)
    
    const event = new KeyboardEvent('keydown', { key: 'n', bubbles: true })
    Object.defineProperty(event, 'target', { value: input, writable: false })
    input.dispatchEvent(event)
    
    expect(mockNavigate).not.toHaveBeenCalled()
    
    document.body.removeChild(input)
  })

  test('does not trigger shortcuts when typing in textarea', () => {
    renderHook(() => useKeyboardShortcuts(false, vi.fn()))
    
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    
    const event = new KeyboardEvent('keydown', { key: 'n', bubbles: true })
    Object.defineProperty(event, 'target', { value: textarea, writable: false })
    textarea.dispatchEvent(event)
    
    expect(mockNavigate).not.toHaveBeenCalled()
    
    document.body.removeChild(textarea)
  })

  test('navigates back on Escape when not on home page', () => {
    mockLocation.pathname = '/item/123'
    renderHook(() => useKeyboardShortcuts(false, vi.fn()))
    
    const event = new KeyboardEvent('keydown', { key: 'Escape' })
    document.dispatchEvent(event)
    
    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })

  test('does not navigate back on Escape when on home page', () => {
    mockLocation.pathname = '/'
    renderHook(() => useKeyboardShortcuts(false, vi.fn()))
    
    const event = new KeyboardEvent('keydown', { key: 'Escape' })
    document.dispatchEvent(event)
    
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  test('does not navigate back on Escape when command palette is open', () => {
    mockLocation.pathname = '/item/123'
    renderHook(() => useKeyboardShortcuts(true, vi.fn()))
    
    const event = new KeyboardEvent('keydown', { key: 'Escape' })
    document.dispatchEvent(event)
    
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
