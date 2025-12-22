package seeding

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"os"
	"path/filepath"
	"testing"
	"testing/fstest"
)

func createMockTarGz(files map[string]string) ([]byte, error) {
	var buf bytes.Buffer
	gw := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gw)

	for name, content := range files {
		hdr := &tar.Header{
			Name: name,
			Mode: 0600,
			Size: int64(len(content)),
		}
		if err := tw.WriteHeader(hdr); err != nil {
			return nil, err
		}
		if _, err := tw.Write([]byte(content)); err != nil {
			return nil, err
		}
	}

	if err := tw.Close(); err != nil {
		return nil, err
	}
	if err := gw.Close(); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func TestEnsureDataSeededWithFS(t *testing.T) {
	// Create a temporary directory for the data folder
	tmpDir, err := os.MkdirTemp("", "seeding-test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer func() { _ = os.RemoveAll(tmpDir) }()

	// 1. Test with missing data.tar.gz
	emptyFS := fstest.MapFS{}
	err = ensureDataSeededWithFS(tmpDir, emptyFS)
	if err != nil {
		t.Errorf("Expected no error when data.tar.gz is missing, got: %v", err)
	}

	// 2. Test successful extraction
	mockData := map[string]string{
		"poetry.db":       "mock database content",
		"images/test.png": "mock image content",
	}
	tarGzData, err := createMockTarGz(mockData)
	if err != nil {
		t.Fatalf("Failed to create mock tar.gz: %v", err)
	}

	mockFS := fstest.MapFS{
		"data.tar.gz": &fstest.MapFile{Data: tarGzData},
	}

	err = ensureDataSeededWithFS(tmpDir, mockFS)
	if err != nil {
		t.Errorf("Expected successful seeding, got: %v", err)
	}

	// Verify files exist
	dbPath := filepath.Join(tmpDir, "poetry.db")
	if content, err := os.ReadFile(dbPath); err != nil || string(content) != "mock database content" {
		t.Errorf("poetry.db not extracted correctly")
	}

	imgPath := filepath.Join(tmpDir, "images/test.png")
	if content, err := os.ReadFile(imgPath); err != nil || string(content) != "mock image content" {
		t.Errorf("images/test.png not extracted correctly")
	}

	// 3. Test NO overwrite of existing database
	// Modify the database file on disk
	err = os.WriteFile(dbPath, []byte("existing user data"), 0644)
	if err != nil {
		t.Fatalf("Failed to write existing db: %v", err)
	}

	// Create a new mock tar with DIFFERENT content
	newData := map[string]string{
		"poetry.db":      "NEW database content",
		"images/new.png": "new image",
	}
	newTarGz, _ := createMockTarGz(newData)
	newMockFS := fstest.MapFS{
		"data.tar.gz": &fstest.MapFile{Data: newTarGz},
	}

	err = ensureDataSeededWithFS(tmpDir, newMockFS)
	if err != nil {
		t.Errorf("Expected successful seeding run 2, got: %v", err)
	}

	// Verify poetry.db was NOT overwritten
	if content, err := os.ReadFile(dbPath); err != nil || string(content) != "existing user data" {
		t.Errorf("poetry.db was overwritten! Expected 'existing user data', got '%s'", string(content))
	}

	// Verify new file WAS extracted
	newImgPath := filepath.Join(tmpDir, "images/new.png")
	if _, err := os.Stat(newImgPath); os.IsNotExist(err) {
		t.Errorf("New file images/new.png was not extracted")
	}
}
