package parser

import (
	"testing"
)

func TestLineNumberStripping(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
		hasNums  bool
	}{
		{
			name: "Poem with line numbers",
			input: `Line one   5
Line two   10
Line three`,
			expected: `Line one
Line two
Line three`,
			hasNums: true,
		},
		{
			name: "Regular text with numbers",
			input: `I was born in 1990
My lucky number is 7`,
			expected: `I was born in 1990
My lucky number is 7`,
			hasNums: false, // Should be false now with \s{2,} requirement
		},
		{
			name: "Poem with single line number (should not trigger)",
			input: `Line one
Line two   5
Line three`,
			expected: `Line one
Line two   5
Line three`,
			hasNums: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := HasLineNumbers(tt.input); got != tt.hasNums {
				t.Errorf("HasLineNumbers() = %v, want %v", got, tt.hasNums)
			}

			if tt.hasNums {
				if got := StripLineNumbers(tt.input); got != tt.expected {
					t.Errorf("StripLineNumbers() = %q, want %q", got, tt.expected)
				}
			}
		})
	}
}

func TestIsPoem(t *testing.T) {
	tests := []struct {
		name       string
		itemType   string
		definition string
		want       bool
	}{
		{
			name:       "Valid Poem (Single Bracket)",
			itemType:   "Title",
			definition: "Written by X\n\n[The Poem Content]",
			want:       true,
		},
		{
			name:       "Multiple Brackets (Invalid)",
			itemType:   "Title",
			definition: "Some text [1] more text [2]",
			want:       false,
		},
		{
			name:       "Not a Title",
			itemType:   "Reference",
			definition: "Some text [1]",
			want:       false,
		},
		{
			name:       "Title without brackets",
			itemType:   "Title",
			definition: "Just a title definition",
			want:       false,
		},
		{
			name:       "Unbalanced brackets",
			itemType:   "Title",
			definition: "Some text [1 more text",
			want:       false,
		},
		{
			name:       "Empty definition",
			itemType:   "Title",
			definition: "",
			want:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsPoem(tt.itemType, tt.definition); got != tt.want {
				t.Errorf("IsPoem() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestParseDefinition(t *testing.T) {
	tests := []struct {
		name       string
		definition string
		isPoem     bool
		wantType   SegmentType
		wantCount  int
	}{
		{
			name:       "Standard Poem",
			definition: "Intro [Poem Content]",
			isPoem:     true,
			wantType:   SegmentPoem,
			wantCount:  1,
		},
		{
			name:       "Multiline Poem",
			definition: "[\nLine 1\nLine 2\n]",
			isPoem:     true,
			wantType:   SegmentPoem,
			wantCount:  1,
		},
		{
			name:       "Regular Text with Quotes",
			definition: "Some text [\nQuote\n] more text",
			isPoem:     false,
			wantType:   SegmentText, // First segment
			wantCount:  3,           // Text, Quote, Text
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			segments := ParseDefinition(tt.definition, tt.isPoem)
			if len(segments) != tt.wantCount {
				t.Errorf("ParseDefinition() count = %d, want %d", len(segments), tt.wantCount)
			}
			if len(segments) > 0 && segments[0].Type != tt.wantType {
				t.Errorf("ParseDefinition() first type = %v, want %v", segments[0].Type, tt.wantType)
			}
		})
	}
}
