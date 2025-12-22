package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"

	"github.com/TrueBlocks/trueblocks-poetry/backend/database"
	"github.com/TrueBlocks/trueblocks-poetry/pkg/constants"
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
	db *database.DB
}

// NewTTSService creates a new TTSService
func NewTTSService(db *database.DB) *TTSService {
	return &TTSService{
		db: db,
	}
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

	if err := os.MkdirAll(cacheDir, 0755); err != nil {
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

	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return TTSResult{
			Error:     "OpenAI API key not configured. Please add OPENAI_API_KEY to your .env file.",
			ErrorType: "missing_key",
		}
	}

	// Create request to OpenAI TTS API
	url := "https://api.openai.com/v1/audio/speech"

	// Properly marshal JSON to handle special characters
	type TTSRequest struct {
		Model string `json:"model"`
		Input string `json:"input"`
		Voice string `json:"voice"`
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

	requestData := TTSRequest{
		Model: "tts-1",
		Input: text,
		Voice: voice,
	}

	jsonData, err := json.Marshal(requestData)
	if err != nil {
		return TTSResult{
			Error:     fmt.Sprintf("Failed to prepare request: %v", err),
			ErrorType: "unknown",
		}
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(jsonData))
	if err != nil {
		return TTSResult{
			Error:     fmt.Sprintf("Failed to create request: %v", err),
			ErrorType: "unknown",
		}
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return TTSResult{
			Error:     fmt.Sprintf("Network error: %v. Please check your internet connection.", err),
			ErrorType: "network",
		}
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		errorMsg := fmt.Sprintf("OpenAI API error (%d): %s", resp.StatusCode, string(body))
		errorType := "api"

		// Detect specific API error types
		if resp.StatusCode == 401 {
			errorMsg = "Invalid API key. Please check your OPENAI_API_KEY in .env file."
			errorType = "missing_key"
		} else if resp.StatusCode == 429 {
			errorMsg = "Rate limit exceeded. Please try again in a moment."
		} else if resp.StatusCode >= 500 {
			errorMsg = fmt.Sprintf("OpenAI server error (%d). Please try again later.", resp.StatusCode)
		}

		return TTSResult{
			Error:     errorMsg,
			ErrorType: errorType,
		}
	}

	// Read audio data
	audioData, err := io.ReadAll(resp.Body)
	if err != nil {
		return TTSResult{
			Error:     fmt.Sprintf("Failed to read audio data: %v", err),
			ErrorType: "network",
		}
	}

	// Cache the audio data for future use
	if err := os.WriteFile(cacheFile, audioData, 0644); err != nil {
		slog.Warn("Failed to cache audio data", "error", err)
		// Don't fail the request if caching fails
	} else {
		slog.Info("Cached TTS audio", "path", cacheFile)
	}

	return TTSResult{
		AudioData: audioData,
		Cached:    false,
	}
}
