package validator

import (
	"fmt"
	"strings"

	"github.com/TrueBlocks/trueblocks-poetry/backend/database"
)

// ValidateID checks if an ID is positive
func ValidateID(id int) error {
	if id <= 0 {
		return fmt.Errorf("invalid ID: %d (must be positive)", id)
	}
	return nil
}

// ValidateLinkType checks if the link type is valid
func ValidateLinkType(linkType string) error {
	if strings.TrimSpace(linkType) == "" {
		return fmt.Errorf("link type cannot be empty")
	}
	return nil
}

// ValidateItem checks if an item has required fields
func ValidateItem(item database.Item) error {
	if strings.TrimSpace(item.Word) == "" {
		return fmt.Errorf("item word cannot be empty")
	}
	if strings.TrimSpace(item.Type) == "" {
		return fmt.Errorf("item type cannot be empty")
	}
	// Length checks could be added here, e.g. max 255 chars for Word
	if len(item.Word) > 255 {
		return fmt.Errorf("item word too long (max 255 characters)")
	}
	return nil
}
