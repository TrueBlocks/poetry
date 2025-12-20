import { getItemColor } from '../colors'

describe('getItemColor', () => {
  test('Reference items are light blue', () => {
    expect(getItemColor('Reference')).toBe('#ADD8E6')
  })

  test('Writer items are light green', () => {
    expect(getItemColor('Writer')).toBe('#90EE90')
  })

  test('Title items are light pink', () => {
    expect(getItemColor('Title')).toBe('#FFB6D9')
  })

  test('unknown types use default gray', () => {
    expect(getItemColor('Unknown')).toBe('#E5E7EB')
  })

  test('custom default color', () => {
    expect(getItemColor('Unknown', '#FF0000')).toBe('#FF0000')
  })

  test('case sensitive - lowercase reference uses default', () => {
    expect(getItemColor('reference')).toBe('#E5E7EB')
  })
})
