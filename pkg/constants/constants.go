package constants

import (
	"os"
	"path/filepath"
)

const (
	OrgName = "trueblocks"
	AppName = "poetry"
)

func GetConfigDir() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(homeDir, ".local", "share", OrgName, AppName), nil
}

func GetImagesDir() (string, error) {
	configDir, err := GetConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(configDir, "images"), nil
}

func GetTTSCacheDir() (string, error) {
	configDir, err := GetConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(configDir, "tts-cache"), nil
}

func GetEnvPath() (string, error) {
	configDir, err := GetConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(configDir, ".env"), nil
}
