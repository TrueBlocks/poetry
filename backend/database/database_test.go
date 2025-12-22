package database

import (
	"testing"
)

func TestStripPossessiveRegularApostrophe(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"Shakespeare's", "Shakespeare"},
		{"Keats's", "Keats"},
		{"Burns'", "Burns"},
		{"James'", "James"},
		{"Dickens", "Dickens"},
		{"", ""},
	}

	for _, tt := range tests {
		result := stripPossessive(tt.input)
		if result != tt.expected {
			t.Errorf("stripPossessive(%q) = %q; want %q", tt.input, result, tt.expected)
		}
	}
}

func TestStripPossessiveCurlyApostrophe(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"Shakespeare\u2019s", "Shakespeare"},
		{"Keats\u2019s", "Keats"},
		{"Burns\u2019", "Burns"},
		{"James\u2019", "James"},
	}

	for _, tt := range tests {
		result := stripPossessive(tt.input)
		if result != tt.expected {
			t.Errorf("stripPossessive(%q) = %q; want %q", tt.input, result, tt.expected)
		}
	}
}
func TestNormalizeDefinitionReferences(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "lowercases {word:} references",
			input:    "Reference to {word: SHAKESPEARE}",
			expected: "Reference to {word: shakespeare}",
		},
		{
			name:     "handles multiple references",
			input:    "See {word: Keats} and {word: Byron}",
			expected: "See {word: keats} and {word: byron}",
		},
		{
			name:     "preserves spaces in references",
			input:    "{word:  WILLIAM SHAKESPEARE  }",
			expected: "{word: william shakespeare}",
		},
		{
			name:     "empty string unchanged",
			input:    "",
			expected: "",
		},
		{
			name:     "no references unchanged",
			input:    "Plain text without tags",
			expected: "Plain text without tags",
		},
		{
			name:     "does not modify writer or title tags",
			input:    "By {writer: Shakespeare} in {title: Hamlet}",
			expected: "By {writer: Shakespeare} in {title: Hamlet}",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.input
			normalizeDefinition(&result)
			if result != tt.expected {
				t.Errorf("normalizeDefinition(%q) = %q; want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestNormalizeDefinitionNilPointer(t *testing.T) {
	var nilPtr *string
	normalizeDefinition(nilPtr) // Should not panic
}

// Note: GetItemByWord, GetDuplicateItems, and CreateLinkOrRemoveTags require database integration tests
// These would need:
// 1. Test database setup/teardown
// 2. Sample data insertion
// 3. Query execution and validation
//
// Example test structure (not implemented to keep tests fast):
//
// func TestGetItemByWordCaseInsensitive(t *testing.T) {
//     db := setupTestDB(t)
//     defer db.Close()
//
//     // Insert test data
//     db.CreateItem(Item{Word: "Shakespeare", Type: "Writer"})
//
//     // Test case-insensitive lookup
//     item, err := db.GetItemByWord("shakespeare")
//     if err != nil || item.Word != "Shakespeare" {
//         t.Errorf("Expected case-insensitive match")
//     }
// }
