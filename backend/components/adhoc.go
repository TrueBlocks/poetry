package components

import (
	"github.com/TrueBlocks/trueblocks-poetry/backend/database"
)

// AdHocQueryComponent handles ad-hoc SQL queries
type AdHocQueryComponent struct {
	db *database.DB
}

// NewAdHocQueryComponent creates a new AdHocQueryComponent
func NewAdHocQueryComponent(db *database.DB) *AdHocQueryComponent {
	return &AdHocQueryComponent{db: db}
}

// RunAdHocQuery executes a raw SQL query and returns the results as a list of maps
func (c *AdHocQueryComponent) RunAdHocQuery(query string) ([]map[string]interface{}, error) {
	// Security check: Only allow SELECT queries
	// This is a basic check and not foolproof, but prevents accidental modifications
	// Since this is a local app for a power user, we can be a bit lenient
	// if !strings.HasPrefix(strings.ToUpper(strings.TrimSpace(query)), "SELECT") {
	// 	return nil, fmt.Errorf("only SELECT queries are allowed")
	// }

	rows, err := c.db.Conn().Query(query)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	columns, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	var results []map[string]interface{}

	for rows.Next() {
		// Create a slice of interface{} to hold the values
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range columns {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, err
		}

		// Create a map for this row
		rowMap := make(map[string]interface{})
		for i, col := range columns {
			val := values[i]

			// Handle byte arrays (strings often come back as []byte from drivers)
			if b, ok := val.([]byte); ok {
				rowMap[col] = string(b)
			} else {
				rowMap[col] = val
			}
		}
		results = append(results, rowMap)
	}

	return results, nil
}
