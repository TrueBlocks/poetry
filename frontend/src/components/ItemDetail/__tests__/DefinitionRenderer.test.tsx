import { describe, test, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { DefinitionRenderer } from '../DefinitionRenderer'
import { BrowserRouter } from 'react-router-dom'
import { MantineProvider } from '@mantine/core'

const mockItems = [
  { itemId: 1, word: 'Shakespeare', type: 'Writer', definition: 'English playwright' },
  { itemId: 2, word: 'Hamlet', type: 'Title', definition: 'A tragedy by Shakespeare' },
  { itemId: 3, word: 'poetry', type: 'Reference', definition: 'Literary art form' },
]

const mockStopAudio = vi.fn()
const mockAudioRef = { current: null }

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <MantineProvider>
      <BrowserRouter>{component}</BrowserRouter>
    </MantineProvider>
  )
}

describe('DefinitionRenderer', () => {
  test('renders plain text without references', () => {
    const { container } = renderWithRouter(
      <DefinitionRenderer
        text="This is plain text"
        allItems={mockItems}
        stopAudio={mockStopAudio}
        currentAudioRef={mockAudioRef}
      />
    )
    expect(container.textContent).toContain('This is plain text')
  })

  test('renders word: reference - shows word in output', () => {
    const { container } = renderWithRouter(
      <DefinitionRenderer
        text="A form of {word: poetry}"
        allItems={mockItems}
        stopAudio={mockStopAudio}
        currentAudioRef={mockAudioRef}
      />
    )
    expect(container.textContent).toContain('poetry')
    expect(container.textContent).toContain('A form of')
  })

  test('renders writer: reference with possessive', () => {
    const { container } = renderWithRouter(
      <DefinitionRenderer
        text="{writer: Shakespeare's} works"
        allItems={mockItems}
        stopAudio={mockStopAudio}
        currentAudioRef={mockAudioRef}
      />
    )
    expect(container.textContent).toContain('Shakespeare')
    expect(container.textContent).toContain('works')
  })

  test('renders title: reference - shows title in output', () => {
    const { container } = renderWithRouter(
      <DefinitionRenderer
        text="The play {title: Hamlet}"
        allItems={mockItems}
        stopAudio={mockStopAudio}
        currentAudioRef={mockAudioRef}
      />
    )
    expect(container.textContent).toContain('Hamlet')
    expect(container.textContent).toContain('The play')
  })

  test('renders unmatched reference as plain text', () => {
    const { container } = renderWithRouter(
      <DefinitionRenderer
        text="Reference to {word: NonExistent}"
        allItems={mockItems}
        stopAudio={mockStopAudio}
        currentAudioRef={mockAudioRef}
      />
    )
    expect(container.textContent).toContain('NonExistent')
  })

  test('handles block quotes with square brackets', () => {
    const textWithQuote = 'Some text [\nQuoted line\n] more text'
    const { container } = renderWithRouter(
      <DefinitionRenderer
        text={textWithQuote}
        allItems={mockItems}
        stopAudio={mockStopAudio}
        currentAudioRef={mockAudioRef}
      />
    )
    expect(container.textContent).toContain('Quoted line')
  })

  test('renders multiple references in one text', () => {
    const { container } = renderWithRouter(
      <DefinitionRenderer
        text="{writer: Shakespeare's} play {title: Hamlet} is {word: poetry}"
        allItems={mockItems}
        stopAudio={mockStopAudio}
        currentAudioRef={mockAudioRef}
      />
    )
    expect(container.textContent).toContain('Shakespeare')
    expect(container.textContent).toContain('Hamlet')
    expect(container.textContent).toContain('poetry')
  })
})
