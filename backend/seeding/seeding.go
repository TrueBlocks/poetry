package seeding

import (
	"archive/tar"
	"compress/gzip"
	"embed"
	"fmt"
	"io"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"strings"
)

//go:embed data.tar.gz
var seedData embed.FS

// EnsureDataSeeded checks if the data folder is populated and seeds it if necessary.
func EnsureDataSeeded(dataFolder string) error {
	return ensureDataSeededWithFS(dataFolder, seedData)
}

// ensureDataSeededWithFS performs the seeding using the provided file system
func ensureDataSeededWithFS(dataFolder string, sourceFS fs.FS) error {
	log.Printf("[Seeding] Checking data folder: %s", dataFolder)

	// Ensure data folder exists
	if err := os.MkdirAll(dataFolder, 0755); err != nil {
		return fmt.Errorf("failed to create data folder: %w", err)
	}

	// Open the embedded tar.gz file
	f, err := sourceFS.Open("data.tar.gz")
	if err != nil {
		// If the file is missing (e.g. dev environment without publish run), just warn and return
		log.Printf("[Seeding] Warning: data.tar.gz not found in embedded assets. Skipping seeding.")
		return nil
	}
	defer f.Close()

	gzr, err := gzip.NewReader(f)
	if err != nil {
		return fmt.Errorf("failed to create gzip reader: %w", err)
	}
	defer gzr.Close()

	tr := tar.NewReader(gzr)

	for {
		header, err := tr.Next()
		if err == io.EOF {
			break // End of archive
		}
		if err != nil {
			return fmt.Errorf("error reading tar header: %w", err)
		}

		// Target path
		target := filepath.Join(dataFolder, header.Name)

		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, 0755); err != nil {
				return fmt.Errorf("failed to create directory %s: %w", target, err)
			}
		case tar.TypeReg:
			// Check if file exists
			if _, err := os.Stat(target); err == nil {
				// File exists.
				// If it's the database, NEVER overwrite.
				if strings.HasSuffix(target, "poetry.db") {
					// log.Printf("[Seeding] Database exists, skipping: %s", target)
					continue
				}
				// For other files (images/tts), we also skip if they exist (per design)
				// log.Printf("[Seeding] File exists, skipping: %s", target)
				continue
			}

			// File doesn't exist, extract it
			log.Printf("[Seeding] Extracting missing file: %s", header.Name)

			// Ensure parent directory exists
			if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
				return fmt.Errorf("failed to create parent directory for %s: %w", target, err)
			}

			outFile, err := os.Create(target)
			if err != nil {
				return fmt.Errorf("failed to create file %s: %w", target, err)
			}

			if _, err := io.Copy(outFile, tr); err != nil {
				outFile.Close()
				return fmt.Errorf("failed to write file %s: %w", target, err)
			}
			outFile.Close()
		}
	}

	log.Printf("[Seeding] Seeding check complete.")
	return nil
}
