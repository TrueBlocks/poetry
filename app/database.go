package app

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	appkit "github.com/TrueBlocks/trueblocks-art/packages/appkit/v2"
	"github.com/TrueBlocks/trueblocks-poetry/v2/internal/db"
	"github.com/TrueBlocks/trueblocks-poetry/v2/internal/services"
	"github.com/TrueBlocks/trueblocks-poetry/v2/pkg/constants"
)

func (a *App) loadEnvFile() {
	cwd, _ := os.Getwd()
	envPath := cwd + "/.env"

	data, err := os.ReadFile(envPath)
	if err != nil {
		fallbackPath, pathErr := constants.GetEnvPath()
		if pathErr != nil {
			return
		}
		data, err = os.ReadFile(fallbackPath)
		if err != nil {
			return
		}
		envPath = fallbackPath
	}

	slog.Info("Loading .env file", "path", envPath)
	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			key := strings.TrimSpace(parts[0])
			value := strings.TrimSpace(parts[1])
			value = strings.Trim(value, "\"'")
			if err := os.Setenv(key, value); err != nil {
				slog.Warn("Failed to set env var", "key", key, "error", err)
			}
		}
	}
}

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

func (a *App) GetEnvVars() map[string]string {
	envVars := make(map[string]string)

	cwd, err := os.Getwd()
	if err != nil {
		slog.Error("Failed to get working directory", "error", err)
		return envVars
	}

	envPath := cwd + "/.env"
	data, err := os.ReadFile(envPath)
	if err != nil {
		fallbackPath, err := constants.GetEnvPath()
		if err == nil {
			data, err = os.ReadFile(fallbackPath)
			if err != nil {
				slog.Info("No .env file found", "path1", envPath, "path2", fallbackPath)
				return envVars
			}
		} else {
			slog.Info("No .env file found", "path", envPath)
			return envVars
		}
	}

	sensitivePatterns := []string{
		"KEY", "SECRET", "TOKEN", "PASSWORD", "PASS", "AUTH", "CREDENTIAL",
	}

	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			key := strings.TrimSpace(parts[0])
			value := strings.TrimSpace(parts[1])

			keyUpper := strings.ToUpper(key)
			isSensitive := false
			for _, pattern := range sensitivePatterns {
				if strings.Contains(keyUpper, pattern) {
					isSensitive = true
					break
				}
			}

			if isSensitive {
				if value != "" {
					envVars[key] = "***REDACTED***"
				}
			} else {
				value = strings.Trim(value, "\"'")
				envVars[key] = value
			}
		}
	}

	return envVars
}

func (a *App) SaveEnvVar(key, value string) error {
	envPath, err := constants.GetEnvPath()
	if err != nil {
		return fmt.Errorf("failed to get env path: %w", err)
	}

	content := ""
	if data, err := os.ReadFile(envPath); err == nil {
		content = string(data)
	}

	content = strings.TrimSpace(content)

	var lines []string
	if content != "" {
		lines = strings.Split(content, "\n")
	}

	found := false
	var newLines []string

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, key+"=") {
			newLines = append(newLines, fmt.Sprintf("%s=%s", key, value))
			found = true
		} else {
			newLines = append(newLines, line)
		}
	}

	if !found {
		newLines = append(newLines, fmt.Sprintf("%s=%s", key, value))
	}

	output := strings.Join(newLines, "\n") + "\n"
	dir := filepath.Dir(envPath)
	if err := os.MkdirAll(dir, appkit.DirPermissions); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	if err := os.WriteFile(envPath, []byte(output), 0o600); err != nil {
		return fmt.Errorf("failed to write .env file: %w", err)
	}

	if err := os.Setenv(key, value); err != nil {
		slog.Warn("Failed to update in-memory environment variable", "error", err)
	}

	return nil
}

func (a *App) HasEnvFile() bool {
	envPath, err := constants.GetEnvPath()
	if err != nil {
		return false
	}
	_, err = os.Stat(envPath)
	return err == nil
}

func (a *App) SkipAiSetup() error {
	envPath, err := constants.GetEnvPath()
	if err != nil {
		return fmt.Errorf("failed to get env path: %w", err)
	}

	if _, err := os.Stat(envPath); err == nil {
		return nil
	}

	dir := filepath.Dir(envPath)
	if err := os.MkdirAll(dir, appkit.DirPermissions); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	content := "# AI Setup Skipped\n"
	if err := os.WriteFile(envPath, []byte(content), 0o600); err != nil {
		return fmt.Errorf("failed to write .env file: %w", err)
	}

	return nil
}

func (a *App) GetEnvLocation() string {
	cwd, err := os.Getwd()
	if err != nil {
		return "Unknown (failed to get working directory)"
	}

	envPath := cwd + "/.env"
	if _, err := os.Stat(envPath); err == nil {
		return envPath
	}

	fallbackPath, err := constants.GetEnvPath()
	if err == nil {
		if _, err := os.Stat(fallbackPath); err == nil {
			return fallbackPath
		}
	}

	return "No .env file found"
}
