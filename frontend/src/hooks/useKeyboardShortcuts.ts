import { useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { notifications } from "@mantine/notifications";
import { useViewHotkeys } from "@trueblocks/ui";
import { GetSettings } from "@wailsjs/go/app/App";
import { LogError } from "@utils/logger";

// The standard cross-app navigation (see ai/Architecture.md §7): Cmd+N jumps
// to a view, repeating it cycles the view's tabs. View ids double as the
// cycle-event keys that ItemPage, Settings, and Experimental listen for.
const VIEWS = [
  { num: 1, id: "dashboard" },
  { num: 2, id: "itemView" },
  { num: 3, id: "search" },
  { num: 4, id: "tables" },
  { num: 5, id: "reports" },
  { num: 6, id: "export" },
  { num: 7, id: "settings" },
  { num: 8, id: "experimental" },
];

const VIEW_PATHS: Record<string, string> = {
  dashboard: "/",
  search: "/search",
  tables: "/tables",
  reports: "/reports",
  export: "/export",
  settings: "/settings",
  experimental: "/experimental",
};

function activeViewFromPath(pathname: string): string {
  if (pathname === "/") return "dashboard";
  if (pathname.startsWith("/item")) return "itemView";
  const entry = Object.entries(VIEW_PATHS).find(
    ([, path]) =>
      path !== "/" && (pathname === path || pathname.startsWith(path + "/")),
  );
  return entry ? entry[0] : "";
}

function focusSearchInput() {
  setTimeout(() => {
    const searchInput = document.querySelector(
      'input[type="text"]',
    ) as HTMLInputElement;
    searchInput?.focus();
  }, 100);
}

export default function useKeyboardShortcuts(
  commandPaletteOpen: boolean,
  _: (open: boolean) => void,
) {
  const navigate = useNavigate();
  const location = useLocation();

  const onNavigate = useCallback(
    (id: string) => {
      if (id === "itemView") {
        GetSettings().then((settings) => {
          const lastId = settings.lastWordId || 1;
          navigate(`/item/${lastId}`);
        });
        return;
      }
      navigate(VIEW_PATHS[id] ?? "/");
      if (id === "search") focusSearchInput();
    },
    [navigate],
  );

  useViewHotkeys({
    views: VIEWS,
    activeView: activeViewFromPath(location.pathname),
    onNavigate,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Cmd+N or Ctrl+N to create new item
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        navigate("/item/new?tab=detail");
        return;
      }

      // Cmd+G or Ctrl+G to go to graph view
      if ((e.metaKey || e.ctrlKey) && e.key === "g") {
        e.preventDefault();

        // If on an item page, switch to graph tab for that item
        const match = location.pathname.match(/^\/item\/(\d+)/);
        if (match) {
          navigate(`/item/${match[1]}?tab=graph`);
        } else {
          // Otherwise go to graph of last viewed item
          GetSettings().then((settings) => {
            const lastId = settings.lastWordId || 1;
            navigate(`/item/${lastId}?tab=graph`);
          });
        }
        return;
      }

      // Cmd+X or Ctrl+X to export both
      if ((e.metaKey || e.ctrlKey) && e.key === "x") {
        e.preventDefault();

        const handleExport = async () => {
          try {
            const { SelectExportFolder, ExportToJSON, ExportToMarkdown } =
              await import("../../wailsjs/go/app/App");

            // Check if folder is selected
            const settings = await GetSettings();
            let folder = settings.exportFolder;

            if (!folder) {
              folder = await SelectExportFolder();
              if (!folder) {
                notifications.show({
                  title: "Folder Required",
                  message: "Please select an export folder to continue",
                  color: "orange",
                });
                return;
              }
            }

            notifications.show({
              title: "Exporting...",
              message: "Starting export of both formats",
              color: "blue",
              loading: true,
            });

            // Export JSON
            await ExportToJSON();

            // Export Markdown
            await ExportToMarkdown();

            notifications.show({
              title: "Export Complete",
              message: `Both formats saved successfully`,
              color: "teal",
            });
          } catch (error) {
            LogError(`Export failed: ${error}`);
            notifications.show({
              title: "Export Failed",
              message: String(error),
              color: "red",
            });
          }
        };

        handleExport();
        return;
      }

      switch (e.key) {
        case "/":
          e.preventDefault();
          navigate("/search");
          focusSearchInput();
          break;

        case "n":
          if (!commandPaletteOpen) {
            e.preventDefault();
            navigate("/item/new?tab=detail");
          }
          break;

        case "h":
          if (!commandPaletteOpen) {
            e.preventDefault();
            navigate("/");
          }
          break;

        case "Escape":
          // Go back on ESC if not on home page
          if (location.pathname !== "/" && !commandPaletteOpen) {
            e.preventDefault();
            navigate(-1);
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigate, location, commandPaletteOpen]);
}
