package services

import (
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/TrueBlocks/trueblocks-art/packages/appkit/v2"
	"github.com/TrueBlocks/trueblocks-poetry/v2/internal/db"
	"github.com/TrueBlocks/trueblocks-poetry/v2/pkg/constants"
)

// ImageService handles image operations
type ImageService struct {
	db *db.DB
}

// NewImageService creates a new ImageService
func NewImageService(db *db.DB) *ImageService {
	return &ImageService{
		db: db,
	}
}

func (s *ImageService) SetDB(db *db.DB) {
	s.db = db
}

// GetEntityImage retrieves an image for an entity from the cache
func (s *ImageService) GetEntityImage(entityId int) (string, error) {
	imagesDir, err := constants.GetImagesDir()
	if err != nil {
		return "", fmt.Errorf("failed to get images directory: %w", err)
	}
	imagePath := filepath.Join(imagesDir, fmt.Sprintf("%d.png", entityId))

	// Check if file exists
	if _, err := os.Stat(imagePath); os.IsNotExist(err) {
		return "", nil // No image exists
	}

	// Read the image file
	imageBytes, err := os.ReadFile(imagePath)
	if err != nil {
		return "", fmt.Errorf("failed to read image file: %w", err)
	}

	// Encode to base64
	encoded := base64.StdEncoding.EncodeToString(imageBytes)
	return fmt.Sprintf("data:image/png;base64,%s", encoded), nil
}

// DeleteEntityImage removes an image for an entity from the cache
func (s *ImageService) DeleteEntityImage(entityId int) error {
	imagesDir, err := constants.GetImagesDir()
	if err != nil {
		return fmt.Errorf("failed to get images directory: %w", err)
	}
	imagePath := filepath.Join(imagesDir, fmt.Sprintf("%d.png", entityId))

	// Check if file exists
	if _, err := os.Stat(imagePath); os.IsNotExist(err) {
		return nil // Already doesn't exist
	}

	// Delete the file
	if err := os.Remove(imagePath); err != nil {
		return fmt.Errorf("failed to delete image file: %w", err)
	}

	// Update database flag
	_, err = s.db.Conn().Exec("UPDATE entities SET attributes = json_set(COALESCE(attributes, '{}'), '$.has_image', 0) WHERE id = ?", entityId)
	if err != nil {
		return fmt.Errorf("failed to update has_image flag: %w", err)
	}

	return nil
}

// SaveEntityImage saves an image for an entity to the cache directory
func (s *ImageService) SaveEntityImage(entityId int, imageData string) error {
	// Get user config directory
	cacheDir, err := constants.GetImagesDir()
	if err != nil {
		return fmt.Errorf("failed to get images directory: %w", err)
	}
	if err := os.MkdirAll(cacheDir, appkit.DirPermissions); err != nil {
		return fmt.Errorf("failed to create cache directory: %w", err)
	}

	// Parse base64 image data (data:image/png;base64,...)
	parts := strings.Split(imageData, ",")
	if len(parts) != 2 {
		return fmt.Errorf("invalid image data format")
	}

	// Decode from base64
	decoded, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil {
		return fmt.Errorf("failed to decode base64: %w", err)
	}

	// Save to file
	imagePath := filepath.Join(cacheDir, fmt.Sprintf("%d.png", entityId))
	if err := os.WriteFile(imagePath, decoded, appkit.FilePermissions); err != nil {
		return fmt.Errorf("failed to write image file: %w", err)
	}

	// Update database flag
	_, err = s.db.Conn().Exec("UPDATE entities SET attributes = json_set(COALESCE(attributes, '{}'), '$.has_image', 1) WHERE id = ?", entityId)
	if err != nil {
		return fmt.Errorf("failed to update has_image flag: %w", err)
	}

	return nil
}
