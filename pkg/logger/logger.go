package logger

import (
	"io"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/TrueBlocks/trueblocks-poetry/pkg/constants"
)

var Log *slog.Logger

// InitLogger initializes the global logger to write to both stdout and a file
func InitLogger() error {
	configDir, err := constants.GetConfigDir()
	if err != nil {
		return err
	}

	// Create logs directory
	logsDir := filepath.Join(configDir, "logs")
	if err := os.MkdirAll(logsDir, 0755); err != nil {
		return err
	}

	// Open log file
	logPath := filepath.Join(logsDir, "app.log")
	file, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}

	// Create multi-writer
	multiWriter := io.MultiWriter(os.Stdout, file)

	// Create handler
	handler := slog.NewTextHandler(multiWriter, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})

	// Set global logger
	Log = slog.New(handler)
	slog.SetDefault(Log)

	Log.Info("Logger initialized", "path", logPath)
	return nil
}
