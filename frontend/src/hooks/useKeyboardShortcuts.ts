import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { notifications } from "@mantine/notifications";
import { GetSettings } from "../../wailsjs/go/main/App.js";

export default function useKeyboardShortcuts(
  commandPaletteOpen: boolean,
  _: (open: boolean) => void,
) {
  const navigate = useNavigate();
  const location = useLocation();

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

      // Navigation Shortcuts (Cmd+1 to Cmd+7)
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case "1":
            e.preventDefault();
            navigate("/");
            return;
          case "2":
            e.preventDefault();
            GetSettings().then((settings) => {
              const lastId = settings.lastWordId || 1;
              navigate(`/item/${lastId}?tab=detail`);
            });
            return;
          case "3":
            e.preventDefault();
            navigate("/search");
            // Focus search input
            setTimeout(() => {
              const searchInput = document.querySelector(
                'input[type="text"]',
              ) as HTMLInputElement;
              searchInput?.focus();
            }, 100);
            return;
          case "4":
            e.preventDefault();
            navigate("/tables");
            return;
          case "5":
            e.preventDefault();
            navigate("/reports");
            return;
          case "6":
            e.preventDefault();
            navigate("/export");
            return;
          case "7":
            e.preventDefault();
            navigate("/settings");
            return;
        }
      }

      // Command Palette is handled in CommandPalette component
      // Just handle other shortcuts here

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
              await import("../../wailsjs/go/main/App.js");

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
            console.error("Export failed:", error);
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
          // Focus the search input after navigation
          setTimeout(() => {
            const searchInput = document.querySelector(
              'input[type="text"]',
            ) as HTMLInputElement;
            searchInput?.focus();
          }, 100);
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
