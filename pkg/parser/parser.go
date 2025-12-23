package parser

import (
	"fmt"
	"regexp"
	"strings"
)

// SegmentType represents the type of a content segment
type SegmentType string

const (
	SegmentText  SegmentType = "text"
	SegmentQuote SegmentType = "quote"
	SegmentPoem  SegmentType = "poem"
)

// TokenType represents the type of a token within a segment
type TokenType string

const (
	TokenText      TokenType = "text"
	TokenReference TokenType = "reference"
)

// Token represents a parsed unit of text or a reference tag
type Token struct {
	Type        TokenType `json:"type"`
	Content     string    `json:"content"`
	RefType     string    `json:"refType,omitempty"`
	RefWord     string    `json:"refWord,omitempty"`
	DisplayWord string    `json:"displayWord,omitempty"`
}

// Segment represents a block of content (text, quote, or poem)
type Segment struct {
	Type       SegmentType `json:"type"`
	Content    string      `json:"content"`
	PreText    string      `json:"preText,omitempty"`
	PostText   string      `json:"postText,omitempty"`
	Tokens     []Token     `json:"tokens,omitempty"`     // For text/quote content
	PreTokens  []Token     `json:"preTokens,omitempty"`  // For poem pre-text
	PostTokens []Token     `json:"postTokens,omitempty"` // For poem post-text
}

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

// ParseTokens parses text into tokens (text, reference tags)
func ParseTokens(text string) []Token {
	var tokens []Token
	lastIndex := 0
	matches := referenceRegex.FindAllStringSubmatchIndex(text, -1)

	for _, match := range matches {
		// Add text before the match
		if match[0] > lastIndex {
			tokens = append(tokens, Token{
				Type:    TokenText,
				Content: text[lastIndex:match[0]],
			})
		}

		// Extract tag details
		fullTag := text[match[0]:match[1]]
		refType := strings.ToLower(text[match[2]:match[3]])
		refWord := strings.TrimSpace(text[match[4]:match[5]])

		tokens = append(tokens, Token{
			Type:        TokenReference,
			Content:     fullTag,
			RefType:     refType,
			RefWord:     refWord,
			DisplayWord: refWord,
		})

		lastIndex = match[1]
	}

	// Add remaining text
	if lastIndex < len(text) {
		tokens = append(tokens, Token{
			Type:    TokenText,
			Content: text[lastIndex:],
		})
	}

	return tokens
}

// ParseDefinition parses the full definition text into structured segments
func ParseDefinition(text string, isPoemType bool) []Segment {
	// Check if it's a poem
	if isPoemType {
		// Regex to match: pre-text [poem content] post-text
		// Using (?s) to allow . to match newlines
		re := regexp.MustCompile(`(?s)^([\s\S]*?)\[([\s\S]*)\]([\s\S]*)$`)
		match := re.FindStringSubmatch(text)

		if len(match) == 4 {
			// It's a poem
			preText := match[1]
			content := strings.TrimSpace(match[2])
			postText := match[3]

			return []Segment{{
				Type:       SegmentPoem,
				Content:    content,
				PreText:    preText,
				PostText:   postText,
				PreTokens:  ParseTokens(preText),
				PostTokens: ParseTokens(postText),
				// Note: Poem content lines are parsed by the frontend PoemRenderer currently.
				// We could parse them here too if we wanted to move all logic to backend.
			}}
		}
	}

	// Split by block quotes (text between [ and ])
	// Regex: [ \n content \n ]
	blockQuoteRegex := regexp.MustCompile(`\[\s*\n([\s\S]*?)\n\s*\]`)
	matches := blockQuoteRegex.FindAllStringSubmatchIndex(text, -1)

	var segments []Segment
	lastIdx := 0

	for _, match := range matches {
		// Add text before the quote
		if match[0] > lastIdx {
			content := text[lastIdx:match[0]]
			segments = append(segments, Segment{
				Type:    SegmentText,
				Content: content,
				Tokens:  ParseTokens(content),
			})
		}

		// Add the quote content
		// match[2]:match[3] is the captured group content
		quoteContent := text[match[2]:match[3]]
		// Strip trailing \ or / from each line (legacy format cleanup)
		quoteContent = regexp.MustCompile(`(?m)[\\/]$`).ReplaceAllString(quoteContent, "")

		segments = append(segments, Segment{
			Type:    SegmentQuote,
			Content: quoteContent,
			// Quotes also contain text that might have tags
			Tokens: ParseTokens(quoteContent),
		})

		lastIdx = match[1]
	}

	// Add remaining text
	if lastIdx < len(text) {
		content := text[lastIdx:]
		segments = append(segments, Segment{
			Type:    SegmentText,
			Content: content,
			Tokens:  ParseTokens(content),
		})
	}

	return segments
}
