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
