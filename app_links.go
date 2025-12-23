package main

import (
"github.com/TrueBlocks/trueblocks-poetry/backend/database"
)

func (a *App) CreateLink(sourceID, destID int, linkType string) error {
	return a.itemService.CreateLink(sourceID, destID, linkType)
}

// DeleteLink deletes a link
func (a *App) DeleteLink(linkID int) error {
	return a.itemService.DeleteLink(linkID)
}

// DeleteLinkByItems deletes a link between two items
func (a *App) DeleteLinkByItems(sourceItemID, destinationItemID int) error {
	return a.itemService.DeleteLinkByItems(sourceItemID, destinationItemID)
}

// GetItemLinks gets all links for an item
func (a *App) GetItemLinks(itemID int) ([]database.Link, error) {
	return a.itemService.GetItemLinks(itemID)
}
