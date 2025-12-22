package parser

import (
	"fmt"
	"regexp"
	"strings"
)

// ReferenceTagPattern is the regex pattern for matching valid reference tags
// Matches: {type: value} where type is word, writer, or title
const ReferenceTagPattern = `\{(word|writer|title):\s*([^}]+)\}`

// GenericTagPattern matches any tag-like structure {key: value}
const GenericTagPattern = `\{([a-zA-Z0-9_]+):\s*([^}]+)\}`

var referenceRegex = regexp.MustCompile(ReferenceTagPattern)
var genericRegex = regexp.MustCompile(GenericTagPattern)

// Reference represents a parsed reference tag
type Reference struct {
	Type     string `json:"type"`
	Value    string `json:"value"`
	Original string `json:"original"` // The full tag string e.g. {word: test}
}

// ParseReferences extracts all valid reference tags from the given text
func ParseReferences(text string) []Reference {
	matches := referenceRegex.FindAllStringSubmatch(text, -1)
	var refs []Reference

	for _, match := range matches {
		if len(match) == 3 {
			refs = append(refs, Reference{
				Type:     strings.ToLower(match[1]),
				Value:    strings.TrimSpace(match[2]),
				Original: match[0],
			})
		}
	}
	return refs
}

// ParseAllTags extracts all tag-like structures from the text
func ParseAllTags(text string) []Reference {
	matches := genericRegex.FindAllStringSubmatch(text, -1)
	var refs []Reference

	for _, match := range matches {
		if len(match) == 3 {
			refs = append(refs, Reference{
				Type:     strings.ToLower(match[1]),
				Value:    strings.TrimSpace(match[2]),
				Original: match[0],
			})
		}
	}
	return refs
}

// ReplaceTags replaces all tags matching the generic pattern using the replacer function
func ReplaceTags(text string, replacer func(Reference) string) string {
	return genericRegex.ReplaceAllStringFunc(text, func(match string) string {
		submatches := genericRegex.FindStringSubmatch(match)
		if len(submatches) == 3 {
			ref := Reference{
				Type:     strings.ToLower(submatches[1]),
				Value:    strings.TrimSpace(submatches[2]),
				Original: match,
			}
			return replacer(ref)
		}
		return match
	})
}

// GetSpecificReferenceRegex returns a regex that matches a specific tag type and value
// The value is escaped and the match is case-insensitive
func GetSpecificReferenceRegex(tagType, value string) (*regexp.Regexp, error) {
	escapedValue := regexp.QuoteMeta(value)
	pattern := fmt.Sprintf(`(?i)\{%s:\s*%s\}`, regexp.QuoteMeta(tagType), escapedValue)
	return regexp.Compile(pattern)
}

// GetPossessiveReferenceRegex returns a regex that matches a reference to the word,
// including possessive forms (word's, word', etc.)
// Matches: {type: word} or {type: word's} etc.
func GetPossessiveReferenceRegex(word string) (*regexp.Regexp, error) {
	escapedWord := regexp.QuoteMeta(word)
	// Matches {word|writer|title: word('s|s'|...)?}
	pattern := fmt.Sprintf(`(?i)\{(?:word|writer|title):\s*(%s(?:'s|'s|s'|s')?)\}`, escapedWord)
	return regexp.Compile(pattern)
}

// GetReferencePattern returns the regex pattern string
// This allows the frontend to fetch the exact pattern used by the backend
func GetReferencePattern() string {
	return ReferenceTagPattern
}

// HasLineNumbers checks if the text contains line numbers at the end of lines
// It looks for lines ending with at least 2 spaces followed by a number
// Returns true if at least 2 such lines are found
func HasLineNumbers(text string) bool {
	lines := strings.Split(text, "\n")
	count := 0
	// Require at least 2 spaces before the number to avoid false positives like "born in 1990"
	re := regexp.MustCompile(`\s{2,}\d+$`)

	for _, line := range lines {
		if re.MatchString(line) {
			count++
			if count >= 2 {
				return true
			}
		}
	}
	return false
}

// StripLineNumbers removes trailing line numbers from the text
// It removes the number and the preceding whitespace (if >= 2 spaces)
func StripLineNumbers(text string) string {
	lines := strings.Split(text, "\n")
	re := regexp.MustCompile(`\s{2,}\d+$`)
	var result []string

	for _, line := range lines {
		result = append(result, re.ReplaceAllString(line, ""))
	}
	return strings.Join(result, "\n")
}

// IsPoem determines if an item is considered a poem.
// A poem is an item of type 'Title' that contains exactly one pair of brackets enclosing the poem content.
func IsPoem(itemType, definition string) bool {
	if itemType != "Title" {
		return false
	}
	// Strict rule: Exactly one opening and one closing bracket
	openCount := strings.Count(definition, "[")
	closeCount := strings.Count(definition, "]")

	return openCount == 1 && closeCount == 1
}

// ExtractPoemContent extracts the text inside the first pair of square brackets.
// Returns empty string if no brackets are found or if indices are invalid.
func ExtractPoemContent(definition string) string {
	start := strings.Index(definition, "[")
	end := strings.LastIndex(definition, "]")

	if start == -1 || end == -1 || start >= end {
		return ""
	}

	// Return content inside brackets, trimmed of whitespace
	return strings.TrimSpace(definition[start+1 : end])
}
