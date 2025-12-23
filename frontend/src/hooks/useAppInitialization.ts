import { useState, useEffect } from "react";
import {
  GetStats,
  GetSettings,
  GetItem,
  GetItemByWord,
  HasEnvFile,
  GetConstants,
} from "@wailsjs/go/main/App.js";
import { updatePatterns } from "@utils/constants";

export function useAppInitialization() {
  const [loading, setLoading] = useState(true);
  const [initialPath, setInitialPath] = useState<string>("/");
  const [firstRunModalOpen, setFirstRunModalOpen] = useState(false);

  useEffect(() => {
    // Load initial stats and settings
    Promise.all([GetStats(), GetSettings(), HasEnvFile(), GetConstants()])
      .then(([_statsData, settings, hasEnv, constants]) => {
        if (constants) updatePatterns(constants);
        // We don't need to store stats in local state as they are not used in App.tsx
        // If they are needed globally, they should be in a store, but for now we just fetch them to ensure backend is ready

        // Check for First Run condition
        // If .env file does not exist, show First Run Modal
        if (!hasEnv) {
          setFirstRunModalOpen(true);
        }

        // Determine initial path based on lastView preference
        if (settings.lastView) {
          switch (settings.lastView) {
            case "graph":
              setInitialPath("/graph");
              break;
            case "search":
              setInitialPath("/search");
              break;
            case "export":
              setInitialPath("/export");
              break;
            case "reports":
              setInitialPath("/reports");
              break;
            case "tables":
              setInitialPath("/tables");
              break;
            case "item":
              if (settings.lastWordId && settings.lastWordId > 0) {
                GetItem(settings.lastWordId)
                  .then(() => {
                    setInitialPath(`/item/${settings.lastWordId}`);
                  })
                  .catch(() => {
                    GetItemByWord("poetry")
                      .then((poetryItem) => {
                        if (poetryItem) {
                          setInitialPath(`/item/${poetryItem.itemId}`);
                        }
                      })
                      .catch(console.error);
                  });
              }
              break;
            case "dashboard":
            default:
              // Stay on dashboard (default '/')
              break;
          }
        } else if (settings.lastWordId && settings.lastWordId > 0) {
          // Fallback to old behavior if lastView not set
          GetItem(settings.lastWordId)
            .then(() => {
              setInitialPath(`/item/${settings.lastWordId}`);
            })
            .catch(() => {
              GetItemByWord("poetry")
                .then((poetryItem) => {
                  if (poetryItem) {
                    setInitialPath(`/item/${poetryItem.itemId}`);
                  }
                })
                .catch(console.error);
            });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return {
    loading,
    initialPath,
    firstRunModalOpen,
    setFirstRunModalOpen,
  };
}
