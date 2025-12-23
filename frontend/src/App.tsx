import { useState, useEffect, useRef } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Search from "./pages/Search";
import ItemPage from "./pages/ItemPage";
import Export from "./pages/Export";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import Tables from "./pages/Tables";
import CommandPalette from "./components/CommandPalette";
import KeyboardShortcutsHelp from "./components/KeyboardShortcutsHelp";
import { ErrorBoundary } from "./components/ErrorBoundary";
import useKeyboardShortcuts from "./hooks/useKeyboardShortcuts";
import { useWindowPersistence } from "./hooks/useWindowPersistence";
import { LogInfo } from "@wailsjs/runtime/runtime.js";
import { FirstRunModal } from "./components/FirstRunModal";
import { useUIStore } from "./stores/useUIStore";
import { useAppInitialization } from "./hooks/useAppInitialization";

function AppContent({ initialPath }: { initialPath: string }) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const hasNavigated = useRef(false);
  const { setLastView } = useUIStore();

  useKeyboardShortcuts(commandPaletteOpen, setCommandPaletteOpen);
  useWindowPersistence();

  // Navigate to initial path (last viewed word) ONCE on mount only
  useEffect(() => {
    if (!hasNavigated.current && initialPath !== "/") {
      LogInfo(`[App] Initial navigation to: ${initialPath}`);
      navigate(initialPath, { replace: true });
      hasNavigated.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track view changes and save to settings
  useEffect(() => {
    const path = location.pathname;
    let view = "dashboard";

    if (path.startsWith("/search")) {
      view = "search";
    } else if (path.startsWith("/item/")) {
      view = "item";
    } else if (path.startsWith("/export")) {
      view = "export";
    } else if (path.startsWith("/reports")) {
      view = "reports";
    } else if (path.startsWith("/tables")) {
      view = "tables";
    } else if (path.startsWith("/settings")) {
      view = "settings";
    }

    LogInfo(`[App] View changed to: ${view}`);
    setLastView(view);
  }, [location.pathname, setLastView]);

  return (
    <>
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
      />
      <KeyboardShortcutsHelp />
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="search" element={<Search />} />
            <Route
              path="item/:id"
              element={
                <ErrorBoundary fallbackTitle="Item Error">
                  <ItemPage />
                </ErrorBoundary>
              }
            />
            <Route path="graph" element={<Navigate to="/" replace />} />
            <Route path="export" element={<Export />} />
            <Route path="reports" element={<Reports />} />
            <Route path="tables" element={<Tables />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </>
  );
}

function App() {
  const { loading, initialPath, firstRunModalOpen, setFirstRunModalOpen } =
    useAppInitialization();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Loading Poetry Database...
          </p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppContent initialPath={initialPath} />
      <FirstRunModal
        opened={firstRunModalOpen}
        onClose={() => setFirstRunModalOpen(false)}
      />
    </BrowserRouter>
  );
}

export default App;
