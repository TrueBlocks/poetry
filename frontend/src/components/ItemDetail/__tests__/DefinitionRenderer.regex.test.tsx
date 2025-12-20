import { describe, test, expect } from 'vitest'

describe('DefinitionRenderer regex matching', () => {
  test('regex matches {word:} tag', () => {
    const regex = /\{(word|writer|title):\s*([^}]+)\}/gi
    const text = 'A type of {word: acrostic}'
    const matches = Array.from(text.matchAll(regex))
    
    expect(matches.length).toBe(1)
    expect(matches[0][1]).toBe('word')
    expect(matches[0][2]).toBe('acrostic')
  })

  test('regex matches {writer:} tag', () => {
    const regex = /\{(word|writer|title):\s*([^}]+)\}/gi
    const text = 'By {writer: Shakespeare}'
    const matches = Array.from(text.matchAll(regex))
    
    expect(matches.length).toBe(1)
    expect(matches[0][1]).toBe('writer')
    expect(matches[0][2]).toBe('Shakespeare')
  })

  test('regex matches {title:} tag', () => {
    const regex = /\{(word|writer|title):\s*([^}]+)\}/gi
    const text = 'In {title: Hamlet}'
    const matches = Array.from(text.matchAll(regex))
    
    expect(matches.length).toBe(1)
    expect(matches[0][1]).toBe('title')
    expect(matches[0][2]).toBe('Hamlet')
  })

  test('regex matches multiple tags', () => {
    const regex = /\{(word|writer|title):\s*([^}]+)\}/gi
    const text = '{writer: Shakespeare} wrote {title: Hamlet} with {word: poetry}'
    const matches = Array.from(text.matchAll(regex))
    
    expect(matches.length).toBe(3)
    expect(matches[0][1]).toBe('writer')
    expect(matches[1][1]).toBe('title')
    expect(matches[2][1]).toBe('word')
  })

  test('regex does NOT match old format {w:} tag', () => {
    const regex = /\{(word|writer|title):\s*([^}]+)\}/gi
    const text = 'A type of {w: acrostic}'
    const matches = Array.from(text.matchAll(regex))
    
    expect(matches.length).toBe(0)
  })

  test('regex does NOT match old format {p:} tag', () => {
    const regex = /\{(word|writer|title):\s*([^}]+)\}/gi
    const text = 'By {p: Shakespeare}'
    const matches = Array.from(text.matchAll(regex))
    
    expect(matches.length).toBe(0)
  })

  test('regex does NOT match old format {t:} tag', () => {
    const regex = /\{(word|writer|title):\s*([^}]+)\}/gi
    const text = 'In {t: Hamlet}'
    const matches = Array.from(text.matchAll(regex))
    
    expect(matches.length).toBe(0)
  })

  test('regex matches with extra whitespace', () => {
    const regex = /\{(word|writer|title):\s*([^}]+)\}/gi
    const text = 'A {word:  acrostic  }'
    const matches = Array.from(text.matchAll(regex))
    
    expect(matches.length).toBe(1)
    expect(matches[0][2]).toBe('acrostic  ')
  })

  test('blockQuoteRegex matches content between [ and ] with newlines', () => {
    const blockQuoteRegex = /\[\s*\n([\s\S]*?)\n\s*\]/g
    const text = 'Start [\nquoted text\n] End'
    const matches = Array.from(text.matchAll(blockQuoteRegex))
    
    expect(matches.length).toBe(1)
    expect(matches[0][1]).toBe('quoted text')
  })

  test('blockQuoteRegex matches multiple blocks', () => {
    const blockQuoteRegex = /\[\s*\n([\s\S]*?)\n\s*\]/g
    const text = '[\nblock 1\n] middle [\nblock 2\n]'
    const matches = Array.from(text.matchAll(blockQuoteRegex))
    
    expect(matches.length).toBe(2)
    expect(matches[0][1]).toBe('block 1')
    expect(matches[1][1]).toBe('block 2')
  })

  test('blockQuoteRegex handles multiline content', () => {
    const blockQuoteRegex = /\[\s*\n([\s\S]*?)\n\s*\]/g
    const text = '[\nline 1\nline 2\n]'
    const matches = Array.from(text.matchAll(blockQuoteRegex))
    
    expect(matches.length).toBe(1)
    expect(matches[0][1]).toBe('line 1\nline 2')
  })
})
