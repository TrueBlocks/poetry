package app

import (
	"fmt"
	"os"

	"github.com/TrueBlocks/trueblocks-art/packages/creds"
	"github.com/TrueBlocks/trueblocks-poetry/v2/internal/db"
	"github.com/TrueBlocks/trueblocks-poetry/v2/internal/services"
	"github.com/TrueBlocks/trueblocks-poetry/v2/pkg/constants"
)

func (a *App) CheckpointDatabase() error {
	return a.db.Checkpoint()
}

func (a *App) CleanOrphanedLinks() (int, error) {
	return a.db.CleanOrphanedLinks()
}

func (a *App) GetStats() (map[string]int, error) {
	return a.db.GetStats()
}

func (a *App) GetDatabaseFileSize() (int64, error) {
	dbPath, err := constants.GetDatabasePath()
	if err != nil {
		return 0, fmt.Errorf("failed to get database path: %w", err)
	}

	fileInfo, err := os.Stat(dbPath)
	if err != nil {
		return 0, fmt.Errorf("failed to get file info: %w", err)
	}

	return fileInfo.Size(), nil
}

func (a *App) GetAllRelationships() ([]db.Relationship, error) {
	return a.entityService.GetAllRelationships()
}

func (a *App) GetEgoGraph(centerNodeID int, depth int) (*services.GraphData, error) {
	return a.entityService.GetEgoGraph(centerNodeID)
}

func (a *App) GetAllGraphData() (*services.GraphData, error) {
	return a.entityService.GetAllGraphData()
}

func (a *App) GetCredentialsPath() string {
	return creds.Path()
}
