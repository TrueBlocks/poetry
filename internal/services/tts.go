package services

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strings"

	"github.com/TrueBlocks/trueblocks-art/packages/ai"
	"github.com/TrueBlocks/trueblocks-art/packages/appkit/v2"
	"github.com/TrueBlocks/trueblocks-art/packages/creds"
	"github.com/TrueBlocks/trueblocks-poetry/v2/internal/db"
	"github.com/TrueBlocks/trueblocks-poetry/v2/pkg/constants"
)

// TTSResult is the return type for SpeakWord
type TTSResult struct {
	AudioData []byte `json:"audioData"`
	Cached    bool   `json:"cached"`
	Error     string `json:"error"`
	ErrorType string `json:"errorType"` // "missing_key", "network", "api", "unknown"
}

// TTSService handles Text-to-Speech operations
type TTSService struct {
	db *db.DB
}

// NewTTSService creates a new TTSService
func NewTTSService(db *db.DB) *TTSService {
	return &TTSService{
		db: db,
	}
}

func (s *TTSService) SetDB(db *db.DB) {
	s.db = db
}

// SpeakWord uses OpenAI's text-to-speech API to pronounce text with gender-matched voices and caching
func (s *TTSService) SpeakWord(text string, itemType string, itemWord string, itemID int) TTSResult {
	// Set up cache directory
	cacheDir, err := constants.GetTTSCacheDir()
	if err != nil {
		return TTSResult{
			Error:     fmt.Sprintf("Failed to get TTS cache directory: %v", err),
			ErrorType: "unknown",
		}
	}

	if err := os.MkdirAll(cacheDir, appkit.DirPermissions); err != nil {
		return TTSResult{
			Error:     fmt.Sprintf("Failed to create cache directory: %v", err),
			ErrorType: "unknown",
		}
	}

	// Use ItemID for cache filename
	cacheFile := fmt.Sprintf("%s/%d.mp3", cacheDir, itemID)

	// Check if cached file exists
	if cachedData, err := os.ReadFile(cacheFile); err == nil {
		slog.Info("Using cached TTS audio", "itemID", itemID)
		return TTSResult{
			AudioData: cachedData,
			Cached:    true,
		}
	}

	slog.Info("Cache miss, calling OpenAI API", "itemID", itemID)

	apiKey, err := creds.Get("OPENAI_API_KEY")
	if err != nil {
		return TTSResult{
			Error:     "OpenAI API key not configured. Please add OPENAI_API_KEY to your credentials file.",
			ErrorType: "missing_key",
		}
	}

	// Determine voice based on item type and gender
	voice := "alloy" // Default voice
	if itemType == "Writer" && itemWord != "" {
		// Extract first name (first word before space)
		parts := strings.Fields(itemWord)
		if len(parts) > 0 {
			firstName := parts[0]
			gender, err := s.db.GetGenderByFirstName(firstName)
			if err != nil {
				slog.Warn("Failed to get gender", "name", firstName, "error", err)
			} else if gender == "male" {
				voice = "onyx" // Male voice
			} else if gender == "female" {
				voice = "nova" // Female voice
			}
		}
	}

	provider := &ai.OpenAI{APIKey: apiKey}
	audioData, err := provider.Speak(context.Background(), text, ai.SpeechOptions{Voice: voice})
	if err != nil {
		msg := err.Error()
		errorMsg := fmt.Sprintf("OpenAI API error: %v", err)
		errorType := "api"
		switch {
		case strings.Contains(msg, "speech API error 401"):
			errorMsg = "Invalid API key. Please check your OPENAI_API_KEY credential."
			errorType = "missing_key"
		case strings.Contains(msg, "speech API error 429"):
			errorMsg = "Rate limit exceeded. Please try again in a moment."
		case strings.Contains(msg, "speech API error 5"):
			errorMsg = "OpenAI server error. Please try again later."
		case !strings.Contains(msg, "speech API error"):
			errorMsg = fmt.Sprintf("Network error: %v. Please check your internet connection.", err)
			errorType = "network"
		}
		return TTSResult{
			Error:     errorMsg,
			ErrorType: errorType,
		}
	}

	// Cache the audio data for future use
	if err := os.WriteFile(cacheFile, audioData, appkit.FilePermissions); err != nil {
		slog.Warn("Failed to cache audio data", "error", err)
		// Don't fail the request if caching fails
	} else {
		slog.Info("Cached TTS audio", "path", cacheFile)
		// Update database flag
		if _, err := s.db.Conn().Exec("UPDATE entities SET attributes = json_set(COALESCE(attributes, '{}'), '$.has_tts', 1) WHERE id = ?", itemID); err != nil {
			slog.Warn("Failed to update has_tts flag", "error", err)
		}
	}

	return TTSResult{
		AudioData: audioData,
		Cached:    false,
	}
}
