package database

import (
	"embed"
	"fmt"
	"strings"
)

//go:embed queries/*.sql
var queryFiles embed.FS

// LoadQuery loads a SQL query from an embedded file
func LoadQuery(name string) (string, error) {
	// Add .sql extension if not present
	if !strings.HasSuffix(name, ".sql") {
		name = name + ".sql"
	}

	content, err := queryFiles.ReadFile("queries/" + name)
	if err != nil {
		return "", fmt.Errorf("failed to load query %s: %w", name, err)
	}

	return string(content), nil
}

// MustLoadQuery loads a query and panics on error (for initialization)
func MustLoadQuery(name string) string {
	query, err := LoadQuery(name)
	if err != nil {
		panic(err)
	}
	return query
}
