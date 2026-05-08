package config

import (
	_ "embed"
	"os"
	"path/filepath"

	appkit "github.com/TrueBlocks/trueblocks-art/packages/appkit/v2"
	"github.com/TrueBlocks/trueblocks-poetry/v2/pkg/constants"
)

//go:embed default_config.json
var defaultConfig []byte

type Field struct {
	Key     string   `json:"key"`
	Label   string   `json:"label"`
	Type    string   `json:"type"`
	Options []string `json:"options,omitempty"`
}

type EntityType struct {
	Slug        string   `json:"slug"`
	DisplayName string   `json:"displayName"`
	Icon        string   `json:"icon"`
	Fields      []Field  `json:"fields"`
	ListColumns []string `json:"listColumns,omitempty"`
}

type AppConfig struct {
	AppName     string       `json:"appName"`
	Version     string       `json:"version"`
	EntityTypes []EntityType `json:"entityTypes"`
}

func GetConfigPath() (string, error) {
	configDir, err := constants.GetConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(configDir, "app_config.json"), nil
}

func EnsureConfigExists() (string, error) {
	path, err := GetConfigPath()
	if err != nil {
		return "", err
	}

	// Check if config exists
	if _, err := os.Stat(path); os.IsNotExist(err) {
		// Ensure directory exists
		if err := os.MkdirAll(filepath.Dir(path), appkit.DirPermissions); err != nil {
			return "", err
		}
		// Write default config
		if err := os.WriteFile(path, defaultConfig, appkit.FilePermissions); err != nil {
			return "", err
		}
	}
	return path, nil
}

func LoadConfig() (*AppConfig, error) {
	path, err := EnsureConfigExists()
	if err != nil {
		return nil, err
	}

	cfg, err := appkit.LoadJSON(path, AppConfig{})
	if err != nil {
		return nil, err
	}

	return &cfg, nil
}

func GetConfigContent() (string, error) {
	path, err := EnsureConfigExists()
	if err != nil {
		return "", err
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}

	return string(data), nil
}

func SaveConfig(content string) error {
	path, err := GetConfigPath()
	if err != nil {
		return err
	}
	return os.WriteFile(path, []byte(content), appkit.FilePermissions)
}
