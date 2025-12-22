package settings

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/TrueBlocks/trueblocks-poetry/pkg/constants"
)

// SavedSearch represents a named search query
type SavedSearch struct {
	Name   string   `json:"name"`
	Query  string   `json:"query"`
	Types  []string `json:"types,omitempty"`
	Source string   `json:"source,omitempty"`
}

// Search stores search-related data
type Search struct {
	RecentSearches []string      `json:"recentSearches"` // most recent first, max 50
	SavedSearches  []SavedSearch `json:"savedSearches"`  // user-named search bookmarks
}

// Window stores window position and size
type Window struct {
	X            int `json:"x"`
	Y            int `json:"y"`
	Width        int `json:"width"`
	Height       int `json:"height"`
	LeftbarWidth int `json:"leftbarWidth"`
}

// CollapsedState stores UI collapse states
type CollapsedState struct {
	Outgoing      bool `json:"outgoing"`      // default true (collapsed)
	Incoming      bool `json:"incoming"`      // default false (expanded)
	LinkIntegrity bool `json:"linkIntegrity"` // default false
	ItemHealth    bool `json:"itemHealth"`    // default false
}

// TableSort stores sorting state for a table (field1: primary sort, field2: secondary sort)
// direction: "asc", "desc", or "" (unsorted)
type TableSort struct {
	Field1 string `json:"field1,omitempty"`
	Dir1   string `json:"dir1,omitempty"`
	Field2 string `json:"field2,omitempty"`
	Dir2   string `json:"dir2,omitempty"`
}

// History stores navigation history
type History struct {
	NavigationHistory []int `json:"navigationHistory"` // list of recently visited item IDs
}

// Settings stores user preferences
type Settings struct {
	Window         Window               `json:"window"`
	ExportFolder   string               `json:"exportFolder"`
	LastWordID     int                  `json:"lastWordId"`
	LastView       string               `json:"lastView"`      // dashboard, graph, search, item, export
	LastTable      string               `json:"lastTable"`     // last viewed table in Tables view
	TabSelections  map[string]string    `json:"tabSelections"` // view/component ID -> selected tab ID
	RevealMarkdown bool                 `json:"revealMarkdown"`
	ShowMarked     bool                 `json:"showMarked"`           // toggle between Workbench and Top Hubs
	Collapsed      CollapsedState       `json:"collapsed"`            // UI collapse states
	TableSorts     map[string]TableSort `json:"tableSorts,omitempty"` // sorting state per table
	CurrentSearch  string               `json:"currentSearch"`        // current table search query
	ManagerOldType string               `json:"managerOldType"`       // Item Manager: last selected old type
	ManagerNewType string               `json:"managerNewType"`       // Item Manager: last selected new type
}

// Manager handles settings persistence
type Manager struct {
	settingsPath string
	searchPath   string
	historyPath  string
	settings     *Settings
	search       *Search
	history      *History
}

// NewManager creates a new settings manager
func NewManager() (*Manager, error) {
	configDir, err := constants.GetConfigDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get config directory: %w", err)
	}

	if err := os.MkdirAll(configDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create config directory: %w", err)
	}

	settingsPath := filepath.Join(configDir, "settings.json")
	searchPath := filepath.Join(configDir, "search.json")
	historyPath := filepath.Join(configDir, "history.json")

	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get user home directory: %w", err)
	}
	defaultExportFolder := filepath.Join(homeDir, "Documents", "Poetry", "exports")

	m := &Manager{
		settingsPath: settingsPath,
		searchPath:   searchPath,
		historyPath:  historyPath,
		settings: &Settings{
			Window: Window{
				X:            100,
				Y:            100,
				Width:        1024,
				Height:       768,
				LeftbarWidth: 260,
			},
			ExportFolder: defaultExportFolder,
			TableSorts:   make(map[string]TableSort),
			Collapsed: CollapsedState{
				Outgoing: true,  // default collapsed
				Incoming: false, // default expanded
			},
		},
		search: &Search{
			RecentSearches: []string{},
			SavedSearches:  []SavedSearch{},
		},
		history: &History{
			NavigationHistory: []int{},
		},
	}

	// Load existing settings if available
	_ = m.Load()
	_ = m.LoadSearch()
	_ = m.LoadHistory()

	return m, nil
}

// Load reads settings from disk
func (m *Manager) Load() error {
	data, err := os.ReadFile(m.settingsPath)
	if err != nil {
		if os.IsNotExist(err) {
			// File doesn't exist yet, use defaults
			return nil
		}
		return fmt.Errorf("failed to read settings: %w", err)
	}

	if err := json.Unmarshal(data, m.settings); err != nil {
		return fmt.Errorf("failed to parse settings: %w", err)
	}

	return nil
}

// Save writes settings to disk
func (m *Manager) Save() error {
	data, err := json.MarshalIndent(m.settings, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal settings: %w", err)
	}

	if err := os.WriteFile(m.settingsPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write settings: %w", err)
	}

	return nil
}

// Get returns current settings
func (m *Manager) Get() *Settings {
	return m.settings
}

// Update updates all settings and saves
func (m *Manager) Update(s Settings) error {
	*m.settings = s
	return m.Save()
}

// UpdateWindowPosition updates and saves window position
func (m *Manager) UpdateWindowPosition(x, y, width, height int) error {
	m.settings.Window.X = x
	m.settings.Window.Y = y
	m.settings.Window.Width = width
	m.settings.Window.Height = height
	return m.Save()
}

// UpdateLeftbarWidth updates and saves leftbar width
func (m *Manager) UpdateLeftbarWidth(width int) error {
	m.settings.Window.LeftbarWidth = width
	return m.Save()
}

// UpdateTabSelection updates and saves a tab selection for a specific view
func (m *Manager) UpdateTabSelection(viewID, tabID string) error {
	if m.settings.TabSelections == nil {
		m.settings.TabSelections = make(map[string]string)
	}
	m.settings.TabSelections[viewID] = tabID
	return m.Save()
}

// UpdateLastWord updates and saves last viewed word
func (m *Manager) UpdateLastWord(wordID int) error {
	m.settings.LastWordID = wordID

	// Update history
	if wordID > 0 {
		// Remove if already exists (to move to front)
		filtered := make([]int, 0, len(m.history.NavigationHistory))
		for _, id := range m.history.NavigationHistory {
			if id != wordID {
				filtered = append(filtered, id)
			}
		}

		// Add to front
		m.history.NavigationHistory = append([]int{wordID}, filtered...)

		// Limit to 50
		if len(m.history.NavigationHistory) > 50 {
			m.history.NavigationHistory = m.history.NavigationHistory[:50]
		}
		if err := m.SaveHistory(); err != nil {
			return err
		}
	}

	return m.Save()
}

// GetNavigationHistory returns the navigation history
func (m *Manager) GetNavigationHistory() []int {
	// Return only the first 10 items for display
	if len(m.history.NavigationHistory) > 10 {
		return m.history.NavigationHistory[:10]
	}
	return m.history.NavigationHistory
}

// LoadHistory reads history from disk
func (m *Manager) LoadHistory() error {
	data, err := os.ReadFile(m.historyPath)
	if err != nil {
		if os.IsNotExist(err) {
			// File doesn't exist yet, check if we have history in settings to migrate
			// Note: We are not doing a migration as requested by the user
			return nil
		}
		return fmt.Errorf("failed to read history: %w", err)
	}

	if err := json.Unmarshal(data, m.history); err != nil {
		return fmt.Errorf("failed to parse history: %w", err)
	}

	return nil
}

// SaveHistory writes history to disk
func (m *Manager) SaveHistory() error {
	data, err := json.MarshalIndent(m.history, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal history: %w", err)
	}

	if err := os.WriteFile(m.historyPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write history: %w", err)
	}

	return nil
}

// RemoveFromHistory removes an item ID from the navigation history
func (m *Manager) RemoveFromHistory(itemID int) error {
	filtered := make([]int, 0, len(m.history.NavigationHistory))
	for _, id := range m.history.NavigationHistory {
		if id != itemID {
			filtered = append(filtered, id)
		}
	}
	m.history.NavigationHistory = filtered
	return m.SaveHistory()
}

// GetHistoryItem returns the item at the specified index, or 0 if out of bounds
func (m *Manager) GetHistoryItem(index int) int {
	if index >= 0 && index < len(m.history.NavigationHistory) {
		return m.history.NavigationHistory[index]
	}
	return 0
}

// GetHistoryLength returns the number of items in history
func (m *Manager) GetHistoryLength() int {
	return len(m.history.NavigationHistory)
}
func (m *Manager) UpdateLastView(view string) error {
	m.settings.LastView = view
	return m.Save()
}

// UpdateRevealMarkdown updates the reveal markdown setting
func (m *Manager) UpdateRevealMarkdown(reveal bool) error {
	m.settings.RevealMarkdown = reveal
	return m.Save()
}

// UpdateOutgoingCollapsed updates the outgoing collapsed setting
func (m *Manager) UpdateOutgoingCollapsed(collapsed bool) error {
	m.settings.Collapsed.Outgoing = collapsed
	return m.Save()
}

// UpdateIncomingCollapsed updates the incoming collapsed setting
func (m *Manager) UpdateIncomingCollapsed(collapsed bool) error {
	m.settings.Collapsed.Incoming = collapsed
	return m.Save()
}

// LoadSearch reads search data from disk
func (m *Manager) LoadSearch() error {
	data, err := os.ReadFile(m.searchPath)
	if err != nil {
		if os.IsNotExist(err) {
			// File doesn't exist yet, use defaults
			return nil
		}
		return fmt.Errorf("failed to read search data: %w", err)
	}

	if err := json.Unmarshal(data, m.search); err != nil {
		return fmt.Errorf("failed to parse search data: %w", err)
	}

	return nil
}

// SaveSearch writes search data to disk
func (m *Manager) SaveSearch() error {
	data, err := json.MarshalIndent(m.search, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal search data: %w", err)
	}

	if err := os.WriteFile(m.searchPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write search data: %w", err)
	}

	return nil
}

// GetRecentSearches returns the recent searches list
func (m *Manager) GetRecentSearches() []string {
	return m.search.RecentSearches
}

// GetSavedSearches returns the saved searches list
func (m *Manager) GetSavedSearches() []SavedSearch {
	return m.search.SavedSearches
}

// AddRecentSearch adds a search term to recent searches (most recent first, max 50)
func (m *Manager) AddRecentSearch(term string) error {
	if term == "" {
		return nil
	}

	// Remove if already exists (to move to front)
	filtered := make([]string, 0, len(m.search.RecentSearches))
	for _, s := range m.search.RecentSearches {
		if s != term {
			filtered = append(filtered, s)
		}
	}

	// Add to front
	m.search.RecentSearches = append([]string{term}, filtered...)

	// Limit to 50
	if len(m.search.RecentSearches) > 50 {
		m.search.RecentSearches = m.search.RecentSearches[:50]
	}

	return m.SaveSearch()
}

// RemoveRecentSearch removes a search term from recent searches
func (m *Manager) RemoveRecentSearch(term string) error {
	filtered := make([]string, 0, len(m.search.RecentSearches))
	for _, s := range m.search.RecentSearches {
		if s != term {
			filtered = append(filtered, s)
		}
	}
	m.search.RecentSearches = filtered
	return m.SaveSearch()
}

// AddSavedSearch saves a named search for later recall
func (m *Manager) AddSavedSearch(name, query string, types []string, source string) error {
	if name == "" || query == "" {
		return fmt.Errorf("name and query are required")
	}

	// Check if already exists and update
	for i, saved := range m.search.SavedSearches {
		if saved.Name == name {
			m.search.SavedSearches[i] = SavedSearch{
				Name:   name,
				Query:  query,
				Types:  types,
				Source: source,
			}
			return m.SaveSearch()
		}
	}

	// Add new saved search
	m.search.SavedSearches = append(m.search.SavedSearches, SavedSearch{
		Name:   name,
		Query:  query,
		Types:  types,
		Source: source,
	})

	return m.SaveSearch()
}

// DeleteSavedSearch removes a saved search by name
func (m *Manager) DeleteSavedSearch(name string) error {
	filtered := make([]SavedSearch, 0, len(m.search.SavedSearches))
	for _, saved := range m.search.SavedSearches {
		if saved.Name != name {
			filtered = append(filtered, saved)
		}
	}
	m.search.SavedSearches = filtered
	return m.SaveSearch()
}

// UpdateReportLinkIntegrityCollapsed updates the link integrity report collapsed state
func (m *Manager) UpdateReportLinkIntegrityCollapsed(collapsed bool) error {
	m.settings.Collapsed.LinkIntegrity = collapsed
	return m.Save()
}

// UpdateReportItemHealthCollapsed updates the item health report collapsed state
func (m *Manager) UpdateReportItemHealthCollapsed(collapsed bool) error {
	m.settings.Collapsed.ItemHealth = collapsed
	return m.Save()
}

// UpdateTableSort updates the sorting state for a table
func (m *Manager) UpdateTableSort(tableName, field1, dir1, field2, dir2 string) error {
	if m.settings.TableSorts == nil {
		m.settings.TableSorts = make(map[string]TableSort)
	}
	m.settings.TableSorts[tableName] = TableSort{
		Field1: field1,
		Dir1:   dir1,
		Field2: field2,
		Dir2:   dir2,
	}
	return m.Save()
}

// UpdateCurrentSearch updates the current table search query
func (m *Manager) UpdateCurrentSearch(query string) error {
	m.settings.CurrentSearch = query
	return m.Save()
}

// UpdateExportFolder updates the export folder path
func (m *Manager) UpdateExportFolder(folder string) error {
	m.settings.ExportFolder = folder
	return m.Save()
}
