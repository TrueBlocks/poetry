import { Box, Text } from '@mantine/core';
import React from 'react';

interface PoemRendererProps {
  content: string;
  renderLine?: (line: string, index: number) => React.ReactNode;
}

export function PoemRenderer({ content, renderLine }: PoemRendererProps) {
  // Split by newline
  const lines = content.split('\n');
  const isShortPoem = lines.length <= 9;

  // Common style for the poem container (blockquote look)
  // We use Mantine theme variables where possible, but hardcode some for the specific look
  const containerStyle: React.CSSProperties = {
    // fontStyle: 'italic', // Removed to keep normal text style for poems
    borderLeft: '4px solid var(--mantine-color-gray-3)',
    paddingLeft: 'var(--mantine-spacing-md)',
    margin: 'var(--mantine-spacing-md) 0',
    backgroundColor: 'var(--mantine-color-gray-0)', // Very subtle background
    padding: 'var(--mantine-spacing-sm) var(--mantine-spacing-md)',
    borderRadius: '0 4px 4px 0',
  };

  const textStyle: React.CSSProperties = {
    whiteSpace: 'pre-wrap',
    // fontFamily: 'inherit', // Use default font
    fontSize: '0.95em',
    lineHeight: 1.6,
  };

  if (isShortPoem) {
    return (
      <Box style={containerStyle}>
        <Text style={textStyle}>
          {renderLine ? lines.map((line, i) => (
            <React.Fragment key={i}>
              {renderLine(line, i)}
              {i < lines.length - 1 && '\n'}
            </React.Fragment>
          )) : content}
        </Text>
      </Box>
    );
  }

  // Long Poem: Grid Layout
  let poetryLineCount = 0;

  return (
    <Box style={containerStyle}>
      <div style={{ 
        display: 'inline-grid', 
        gridTemplateColumns: 'auto min-content', 
        gap: '0 2rem', // Row gap 0, Col gap 2rem
      }}>
        {lines.map((line, i) => {
          // Determine if this is a countable poetry line
          // Not empty/whitespace AND not just a number (stanza markers)
          const isContentLine = line.trim().length > 0 && !/^\s*\d+\s*$/.test(line);
          
          let displayNum = null;
          if (isContentLine) {
            poetryLineCount++;
            if (poetryLineCount % 5 === 0 && line.length <= 80) {
              displayNum = poetryLineCount;
            }
          }

          return (
            <React.Fragment key={i}>
              {/* Column 1: Poem Text */}
              <div style={textStyle}>
                {/* Ensure empty lines take up space even with custom renderer */}
                {line.length === 0 
                  ? '\u00A0' 
                  : (renderLine ? renderLine(line, i) : line)
                }
              </div>
              
              {/* Column 2: Line Number */}
              <div style={{ 
                textAlign: 'right', 
                fontSize: '0.85em',
                userSelect: 'none',
                alignSelf: 'start', // Align to top of line
                paddingTop: '2px', // Slight adjustment for baseline alignment
                fontFamily: 'var(--mantine-font-family)', // Use UI font for numbers
                fontStyle: 'normal', // Numbers shouldn't be italic
              }}>
                {displayNum}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </Box>
  );
}
