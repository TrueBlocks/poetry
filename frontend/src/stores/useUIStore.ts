import { create } from "zustand";
import { persist, createJSONStorage, StateStorage } from "zustand/middleware";
import {
  GetSettings,
  UpdateSettings,
  SaveLastWord,
} from "../../wailsjs/go/main/App";

interface TableSort {
  field1: string;
  dir1: string;
  field2: string;
  dir2: string;
}

interface UIState {
  sidebarWidth: number;
  lastWordId: number;
  lastView: string;
  lastTable: string;
  showMarked: boolean;
  revealMarkdown: boolean;
  outgoingCollapsed: boolean;
  incomingCollapsed: boolean;
  recentPathCollapsed: boolean;
  currentSearch: string;
  tabSelections: Record<string, string>;
  tableSorts: Record<string, TableSort>;

  setSidebarWidth: (width: number) => void;
  setLastWordId: (id: number) => void;
  setLastView: (view: string) => void;
  setLastTable: (table: string) => void;
  setShowMarked: (show: boolean) => void;
  setRevealMarkdown: (reveal: boolean) => void;
  setOutgoingCollapsed: (collapsed: boolean) => void;
  setIncomingCollapsed: (collapsed: boolean) => void;
  setRecentPathCollapsed: (collapsed: boolean) => void;
  setCurrentSearch: (search: string) => void;
  setTabSelection: (viewId: string, tabId: string) => void;
  setTableSort: (tableName: string, sort: TableSort) => void;
}

const storage: StateStorage = {
  getItem: async (_name: string): Promise<string | null> => {
    try {
      const s = await GetSettings();
      if (!s) return null;

      const state = {
        state: {
          sidebarWidth: s.window?.leftbarWidth || 260,
          tabSelections: s.tabSelections || {},
          lastWordId: s.lastWordId || 0,
          lastView: s.lastView || "dashboard",
          lastTable: s.lastTable || "items",
          showMarked: s.showMarked || false,
          revealMarkdown: s.revealMarkdown || false,
          outgoingCollapsed:
            s.collapsed?.outgoing !== undefined ? s.collapsed.outgoing : true,
          incomingCollapsed:
            s.collapsed?.incoming !== undefined ? s.collapsed.incoming : false,
          recentPathCollapsed:
            s.collapsed?.recentPath !== undefined
              ? s.collapsed.recentPath
              : true,
          currentSearch: s.currentSearch || "",
          tableSorts: s.tableSorts || {},
        },
        version: 0,
      };
      return JSON.stringify(state);
    } catch (e) {
      console.error("Failed to load settings", e);
      return null;
    }
  },
  setItem: async (_name: string, value: string): Promise<void> => {
    try {
      const { state } = JSON.parse(value);
      const current = await GetSettings();

      // Update fields managed by this store
      if (current.window) {
        current.window.leftbarWidth = state.sidebarWidth;
      }

      // Handle history update if lastWordId changed
      if (current.lastWordId !== state.lastWordId) {
        await SaveLastWord(state.lastWordId);
      }

      current.lastWordId = state.lastWordId;
      current.lastTable = state.lastTable;
      current.showMarked = state.showMarked;
      current.tabSelections = state.tabSelections;
      current.lastView = state.lastView;
      current.revealMarkdown = state.revealMarkdown;
      current.currentSearch = state.currentSearch;
      current.tableSorts = state.tableSorts;

      if (!current.collapsed) {
        current.collapsed = {
          outgoing: true,
          incoming: false,
          linkIntegrity: false,
          itemHealth: false,
          recentPath: true,
        };
      }
      current.collapsed.outgoing = state.outgoingCollapsed;
      current.collapsed.incoming = state.incomingCollapsed;
      current.collapsed.recentPath = state.recentPathCollapsed;

      await UpdateSettings(current);
    } catch (e) {
      console.error("Failed to save settings", e);
    }
  },
  removeItem: async (_name: string): Promise<void> => {
    // Not implemented
  },
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarWidth: 260,
      lastWordId: 0,
      lastView: "dashboard",
      lastTable: "items",
      showMarked: false,
      revealMarkdown: false,
      outgoingCollapsed: true,
      incomingCollapsed: false,
      recentPathCollapsed: true,
      currentSearch: "",
      tabSelections: {},
      tableSorts: {},

      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      setLastWordId: (id) => set({ lastWordId: id }),
      setLastView: (view) => set({ lastView: view }),
      setLastTable: (table) => set({ lastTable: table }),
      setShowMarked: (show) => set({ showMarked: show }),
      setRevealMarkdown: (reveal) => set({ revealMarkdown: reveal }),
      setOutgoingCollapsed: (collapsed) =>
        set({ outgoingCollapsed: collapsed }),
      setIncomingCollapsed: (collapsed) =>
        set({ incomingCollapsed: collapsed }),
      setRecentPathCollapsed: (collapsed) =>
        set({ recentPathCollapsed: collapsed }),
      setCurrentSearch: (search) => set({ currentSearch: search }),
      setTabSelection: (viewId, tabId) =>
        set((state) => ({
          tabSelections: { ...state.tabSelections, [viewId]: tabId },
        })),
      setTableSort: (tableName, sort) =>
        set((state) => ({
          tableSorts: { ...state.tableSorts, [tableName]: sort },
        })),
    }),
    {
      name: "ui-storage",
      storage: createJSONStorage(() => storage),
    },
  ),
);
