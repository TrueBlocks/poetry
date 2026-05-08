package settings

import (
	"fmt"
	"os"
	"path/filepath"

	appkit "github.com/TrueBlocks/trueblocks-art/packages/appkit/v2"
	"github.com/TrueBlocks/trueblocks-poetry/v2/pkg/constants"
)

type SavedSearch struct {
	Name   string   `json:"name"`
	Query  string   `json:"query"`
	Types  []string `json:"types,omitempty"`
	Source string   `json:"source,omitempty"`
}

type Search struct {
	RecentSearches []string      `json:"recentSearches"`
	SavedSearches  []SavedSearch `json:"savedSearches"`
}

type Window struct {
	X            int `json:"x"`
	Y            int `json:"y"`
	Width        int `json:"width"`
	Height       int `json:"height"`
	LeftbarWidth int `json:"leftbarWidth"`
}

type CollapsedState struct {
	Outgoing      bool `json:"outgoing"`
	Incoming      bool `json:"incoming"`
	LinkIntegrity bool `json:"linkIntegrity"`
	ItemHealth    bool `json:"itemHealth"`
	RecentPath    bool `json:"recentPath"`
}

type TableSort struct {
	Field1 string `json:"field1,omitempty"`
	Dir1   string `json:"dir1,omitempty"`
	Field2 string `json:"field2,omitempty"`
	Dir2   string `json:"dir2,omitempty"`
}

type History struct {
	NavigationHistory []int `json:"navigationHistory"`
}

type Settings struct {
	Window         Window               `json:"window"`
	ExportFolder   string               `json:"exportFolder"`
	LastWordID     int                  `json:"lastWordId"`
	LastView       string               `json:"lastView"`
	LastTable      string               `json:"lastTable"`
	TabSelections  map[string]string    `json:"tabSelections"`
	RevealMarkdown bool                 `json:"revealMarkdown"`
	ShowMarked     bool                 `json:"showMarked"`
	Collapsed      CollapsedState       `json:"collapsed"`
	TableSorts     map[string]TableSort `json:"tableSorts,omitempty"`
	CurrentSearch  string               `json:"currentSearch"`
	ManagerOldType string               `json:"managerOldType"`
	ManagerNewType string               `json:"managerNewType"`
}

type Manager struct {
	settings *appkit.Store[Settings]
	search   *appkit.Store[Search]
	history  *appkit.Store[History]
}

func NewManager() (*Manager, error) {
	configDir, err := constants.GetConfigDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get config directory: %w", err)
	}

	if err := os.MkdirAll(configDir, appkit.DirPermissions); err != nil {
		return nil, fmt.Errorf("failed to create config directory: %w", err)
	}

	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get user home directory: %w", err)
	}
	defaultExportFolder := filepath.Join(homeDir, "Documents", "Poetry", "exports")

	settingsStore := appkit.NewStore(filepath.Join(configDir, "settings.json"), Settings{
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
			Outgoing: true,
			Incoming: false,
		},
	})
	_ = settingsStore.Load()

	searchStore := appkit.NewStore(filepath.Join(configDir, "search.json"), Search{
		RecentSearches: []string{},
		SavedSearches:  []SavedSearch{},
	})
	_ = searchStore.Load()

	historyStore := appkit.NewStore(filepath.Join(configDir, "history.json"), History{
		NavigationHistory: []int{},
	})
	_ = historyStore.Load()

	return &Manager{
		settings: settingsStore,
		search:   searchStore,
		history:  historyStore,
	}, nil
}

func (m *Manager) Get() *Settings {
	s := m.settings.Get()
	return &s
}

func (m *Manager) Update(s Settings) error {
	return m.settings.Set(s)
}

func (m *Manager) UpdateWindowPosition(x, y, width, height int) error {
	return m.settings.Update(func(s *Settings) {
		s.Window.X = x
		s.Window.Y = y
		s.Window.Width = width
		s.Window.Height = height
	})
}

func (m *Manager) UpdateLeftbarWidth(width int) error {
	return m.settings.Update(func(s *Settings) {
		s.Window.LeftbarWidth = width
	})
}

func (m *Manager) UpdateTabSelection(viewID, tabID string) error {
	return m.settings.Update(func(s *Settings) {
		if s.TabSelections == nil {
			s.TabSelections = make(map[string]string)
		}
		s.TabSelections[viewID] = tabID
	})
}

func (m *Manager) UpdateTableSort(tableName, field1, dir1, field2, dir2 string) error {
	return m.settings.Update(func(s *Settings) {
		if s.TableSorts == nil {
			s.TableSorts = make(map[string]TableSort)
		}
		s.TableSorts[tableName] = TableSort{
			Field1: field1,
			Dir1:   dir1,
			Field2: field2,
			Dir2:   dir2,
		}
	})
}

func (m *Manager) UpdateCurrentSearch(query string) error {
	return m.settings.Update(func(s *Settings) {
		s.CurrentSearch = query
	})
}

func (m *Manager) UpdateLastWord(wordID int) error {
	if err := m.settings.Update(func(s *Settings) {
		s.LastWordID = wordID
	}); err != nil {
		return err
	}

	if wordID > 0 {
		return m.history.Update(func(h *History) {
			filtered := make([]int, 0, len(h.NavigationHistory))
			for _, id := range h.NavigationHistory {
				if id != wordID {
					filtered = append(filtered, id)
				}
			}
			h.NavigationHistory = append([]int{wordID}, filtered...)
			if len(h.NavigationHistory) > 50 {
				h.NavigationHistory = h.NavigationHistory[:50]
			}
		})
	}
	return nil
}

func (m *Manager) UpdateLastView(view string) error {
	return m.settings.Update(func(s *Settings) {
		s.LastView = view
	})
}

func (m *Manager) UpdateRevealMarkdown(reveal bool) error {
	return m.settings.Update(func(s *Settings) {
		s.RevealMarkdown = reveal
	})
}

func (m *Manager) UpdateOutgoingCollapsed(collapsed bool) error {
	return m.settings.Update(func(s *Settings) {
		s.Collapsed.Outgoing = collapsed
	})
}

func (m *Manager) UpdateIncomingCollapsed(collapsed bool) error {
	return m.settings.Update(func(s *Settings) {
		s.Collapsed.Incoming = collapsed
	})
}

func (m *Manager) UpdateReportLinkIntegrityCollapsed(collapsed bool) error {
	return m.settings.Update(func(s *Settings) {
		s.Collapsed.LinkIntegrity = collapsed
	})
}

func (m *Manager) UpdateReportItemHealthCollapsed(collapsed bool) error {
	return m.settings.Update(func(s *Settings) {
		s.Collapsed.ItemHealth = collapsed
	})
}

func (m *Manager) UpdateExportFolder(folder string) error {
	return m.settings.Update(func(s *Settings) {
		s.ExportFolder = folder
	})
}

func (m *Manager) GetNavigationHistory() []int {
	h := m.history.Get()
	if len(h.NavigationHistory) > 50 {
		return h.NavigationHistory[:50]
	}
	return h.NavigationHistory
}

func (m *Manager) RemoveFromHistory(itemID int) error {
	return m.history.Update(func(h *History) {
		filtered := make([]int, 0, len(h.NavigationHistory))
		for _, id := range h.NavigationHistory {
			if id != itemID {
				filtered = append(filtered, id)
			}
		}
		h.NavigationHistory = filtered
	})
}

func (m *Manager) GetHistoryItem(index int) int {
	h := m.history.Get()
	if index >= 0 && index < len(h.NavigationHistory) {
		return h.NavigationHistory[index]
	}
	return 0
}

func (m *Manager) GetHistoryLength() int {
	return len(m.history.Get().NavigationHistory)
}

func (m *Manager) GetRecentSearches() []string {
	return m.search.Get().RecentSearches
}

func (m *Manager) GetSavedSearches() []SavedSearch {
	return m.search.Get().SavedSearches
}

func (m *Manager) AddRecentSearch(term string) error {
	if term == "" {
		return nil
	}
	return m.search.Update(func(s *Search) {
		filtered := make([]string, 0, len(s.RecentSearches))
		for _, t := range s.RecentSearches {
			if t != term {
				filtered = append(filtered, t)
			}
		}
		s.RecentSearches = append([]string{term}, filtered...)
		if len(s.RecentSearches) > 50 {
			s.RecentSearches = s.RecentSearches[:50]
		}
	})
}

func (m *Manager) RemoveRecentSearch(term string) error {
	return m.search.Update(func(s *Search) {
		filtered := make([]string, 0, len(s.RecentSearches))
		for _, t := range s.RecentSearches {
			if t != term {
				filtered = append(filtered, t)
			}
		}
		s.RecentSearches = filtered
	})
}

func (m *Manager) AddSavedSearch(name, query string, types []string, source string) error {
	if name == "" || query == "" {
		return fmt.Errorf("name and query are required")
	}
	return m.search.Update(func(s *Search) {
		for i, saved := range s.SavedSearches {
			if saved.Name == name {
				s.SavedSearches[i] = SavedSearch{
					Name:   name,
					Query:  query,
					Types:  types,
					Source: source,
				}
				return
			}
		}
		s.SavedSearches = append(s.SavedSearches, SavedSearch{
			Name:   name,
			Query:  query,
			Types:  types,
			Source: source,
		})
	})
}

func (m *Manager) DeleteSavedSearch(name string) error {
	return m.search.Update(func(s *Search) {
		filtered := make([]SavedSearch, 0, len(s.SavedSearches))
		for _, saved := range s.SavedSearches {
			if saved.Name != name {
				filtered = append(filtered, saved)
			}
		}
		s.SavedSearches = filtered
	})
}
