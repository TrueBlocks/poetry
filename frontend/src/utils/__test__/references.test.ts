import { describe, test, expect } from 'vitest'
import { stripPossessive, parseReferences, extractReferenceType } from '../references'

describe('stripPossessive', () => {
  test('removes regular apostrophe s', () => {
    expect(stripPossessive("Shakespeare's")).toBe("Shakespeare")
  })

  test('removes regular apostrophe after s', () => {
    expect(stripPossessive("Burns'")).toBe("Burns")
  })

  test('removes curly apostrophe s', () => {
    expect(stripPossessive("Shakespeare's")).toBe("Shakespeare")
  })

  test('removes curly apostrophe after s', () => {
    expect(stripPossessive("Burns'")).toBe("Burns")
  })

  test('returns unchanged if no possessive', () => {
    expect(stripPossessive("Shakespeare")).toBe("Shakespeare")
  })
})

describe('parseReferences', () => {
  test('extracts word: references', () => {
    const refs = parseReferences('See {word: Keats} and {word: Byron}')
    expect(refs).toEqual(['Keats', 'Byron'])
  })

  test('extracts writer: references and strips possessives', () => {
    const refs = parseReferences("Reference to {writer: Shakespeare's} work")
    expect(refs).toEqual(['Shakespeare'])
  })

  test('extracts title: references', () => {
    const refs = parseReferences('In {title: Ode to a Nightingale}')
    expect(refs).toEqual(['Ode to a Nightingale'])
  })

  test('handles mixed reference types', () => {
    const refs = parseReferences('{word: poetry} by {writer: Keats} in {title: Endymion}')
    expect(refs).toEqual(['poetry', 'Keats', 'Endymion'])
  })

  test('returns empty array for no references', () => {
    expect(parseReferences('Plain text')).toEqual([])
  })

  test('returns empty array for null', () => {
    expect(parseReferences(null)).toEqual([])
  })
})

describe('extractReferenceType', () => {
  test('maps word to Reference', () => {
    expect(extractReferenceType('word')).toBe('Reference')
  })

  test('maps writer to Writer', () => {
    expect(extractReferenceType('writer')).toBe('Writer')
  })

  test('maps title to Title', () => {
    expect(extractReferenceType('title')).toBe('Title')
  })

  test('case insensitive', () => {
    expect(extractReferenceType('Word')).toBe('Reference')
    expect(extractReferenceType('Writer')).toBe('Writer')
    expect(extractReferenceType('Title')).toBe('Title')
  })

  test('returns null for invalid type', () => {
    expect(extractReferenceType('x')).toBe(null)
  })
})
