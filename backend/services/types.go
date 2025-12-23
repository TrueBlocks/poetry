package services

// UnlinkedReferenceDetail represents a single unlinked reference within an item
type UnlinkedReferenceDetail struct {
	Ref    string `json:"ref"`
	Reason string `json:"reason"`
}

// UnlinkedReferenceResult represents an item with unlinked references
type UnlinkedReferenceResult struct {
	ItemID       int                       `json:"itemId"`
	Word         string                    `json:"word"`
	Type         string                    `json:"type"`
	UnlinkedRefs []UnlinkedReferenceDetail `json:"unlinkedRefs"`
	RefCount     int                       `json:"refCount"`
}

// DuplicateItemDetail represents a simplified item structure for duplicate reports
type DuplicateItemDetail struct {
	ItemID int    `json:"itemId"`
	Word   string `json:"word"`
	Type   string `json:"type"`
}

// DuplicateItemResult represents a group of duplicate items
type DuplicateItemResult struct {
	StrippedWord string                `json:"strippedWord"`
	Original     DuplicateItemDetail   `json:"original"`
	Duplicates   []DuplicateItemDetail `json:"duplicates"`
	Count        int                   `json:"count"`
}

// DanglingLinkResult represents a link that points to a non-existent item
type DanglingLinkResult struct {
	LinkID            int    `json:"linkId"`
	SourceItemID      int    `json:"sourceItemId"`
	DestinationItemID int    `json:"destinationItemId"`
	LinkType          string `json:"linkType"`
	SourceWord        string `json:"sourceWord"`
	SourceType        string `json:"sourceType"`
	MissingSide       string `json:"missingSide"` // "source" or "destination"
}

// SelfReferenceResult represents an item that references itself
type SelfReferenceResult struct {
	ItemID int    `json:"itemId"`
	Word   string `json:"word"`
	Type   string `json:"type"`
	Tag    string `json:"tag"`
}

// OrphanedItemResult represents an item with no links
type OrphanedItemResult struct {
	ItemID int    `json:"itemId"`
	Word   string `json:"word"`
	Type   string `json:"type"`
}

// LinkedItemNotInDefinitionResult represents an item that has links not present in its definition
type LinkedItemNotInDefinitionResult struct {
	ItemID            int      `json:"itemId"`
	Word              string   `json:"word"`
	Type              string   `json:"type"`
	MissingReferences []string `json:"missingReferences"`
}

// ItemWithoutDefinitionResult represents an item missing a definition
type ItemWithoutDefinitionResult struct {
	ItemID                   int    `json:"itemId"`
	Word                     string `json:"word"`
	Type                     string `json:"type"`
	HasMissingData           bool   `json:"hasMissingData"`
	SingleIncomingLinkItemID int    `json:"singleIncomingLinkItemId,omitempty"`
	SingleIncomingLinkWord   string `json:"singleIncomingLinkWord,omitempty"`
}

// ItemWithUnknownTypeResult represents an item with a non-standard type
type ItemWithUnknownTypeResult struct {
	ItemID                   int    `json:"itemId"`
	Word                     string `json:"word"`
	Type                     string `json:"type"`
	IncomingLinkCount        int    `json:"incomingLinkCount"`
	SingleIncomingLinkItemID int    `json:"singleIncomingLinkItemId,omitempty"`
	SingleIncomingLinkWord   string `json:"singleIncomingLinkWord,omitempty"`
}

// UnknownTagResult represents an item containing unknown tags
type UnknownTagResult struct {
	ItemID      int      `json:"itemId"`
	Word        string   `json:"word"`
	Type        string   `json:"type"`
	UnknownTags []string `json:"unknownTags"`
	TagCount    int      `json:"tagCount"`
}
