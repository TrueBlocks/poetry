import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PoemRenderer } from '../PoemRenderer';
import { MantineProvider } from '@mantine/core';

// Wrapper for Mantine components
const renderWithMantine = (ui: React.ReactNode) => {
  return render(
    <MantineProvider>
      {ui}
    </MantineProvider>
  );
};

describe('PoemRenderer', () => {
  it('renders short poem without line numbers', () => {
    const shortPoem = `Line 1
Line 2
Line 3`;
    renderWithMantine(<PoemRenderer content={shortPoem} />);
    
    // Use regex for partial match since the Text component contains the whole block
    expect(screen.getByText(/Line 1/)).toBeTruthy();
    expect(screen.getByText(/Line 3/)).toBeTruthy();
    // Should not have line numbers
    expect(screen.queryByText('5')).toBeNull();
  });

  it('renders long poem with line numbers', () => {
    // Create 10 lines with unique content to avoid regex overlap (e.g. Line 1 vs Line 10)
    const lines = [
      'One', 'Two', 'Three', 'Four', 'Five',
      'Six', 'Seven', 'Eight', 'Nine', 'Ten'
    ];
    const longPoem = lines.join('\n');
    renderWithMantine(<PoemRenderer content={longPoem} />);
    
    // Check for text presence
    expect(screen.getByText(/One/)).toBeTruthy();
    expect(screen.getByText(/Ten/)).toBeTruthy();
    
    // Should show '5' and '10'
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
  });

  it('skips line numbers for long lines', () => {
    const longLine = 'A'.repeat(85);
    // Create 5 lines, where the 5th is long
    const poem = `Line 1
Line 2
Line 3
Line 4
${longLine}`;
    
    renderWithMantine(<PoemRenderer content={poem} />);
    
    expect(screen.getByText(new RegExp(longLine))).toBeTruthy();
    // Should NOT show '5' because the line is too long
    expect(screen.queryByText('5')).toBeNull();
  });

  it('preserves empty lines', () => {
    const poem = `Line 1

Line 3`;
    renderWithMantine(<PoemRenderer content={poem} />);
    
    expect(screen.getByText(/Line 1/)).toBeTruthy();
    expect(screen.getByText(/Line 3/)).toBeTruthy();
  });

  it('ignores stanza numbers and blank lines in line count', () => {
    // Structure:
    // 1. "1" (ignored)
    // 2. "Line One" (Count: 1)
    // 3. "Line Two" (Count: 2)
    // 4. "Line Three" (Count: 3)
    // 5. "Line Four" (Count: 4)
    // 6. "" (ignored)
    // 7. "2" (ignored)
    // 8. "Line Five" (Count: 5) -> Should show '5'
    
    const poem = `1
Line One
Line Two
Line Three
Line Four

2
Line Five
Line Six
Line Seven
Line Eight
Line Nine`;

    renderWithMantine(<PoemRenderer content={poem} />);
    
    expect(screen.getByText(/Line One/)).toBeTruthy();
    expect(screen.getByText(/Line Five/)).toBeTruthy();
    
    // "Line Five" is the 5th *poetry* line.
    expect(screen.getByText('5')).toBeTruthy();
  });
});
