import { useState, useEffect } from "react";
import {
  GetStats,
  GetSettings,
  GetEntity,
  SearchEntities,
  GetCapabilities,
  GetConstants,
} from "@wailsjs/go/app/App";
import { updatePatterns } from "@utils/constants";
import { LogError } from "@utils/logger";

export function useAppInitialization() {
  const [loading, setLoading] = useState(true);
  const [initialPath, setInitialPath] = useState<string>("/");
  const [firstRunModalOpen, setFirstRunModalOpen] = useState(false);

  useEffect(() => {
    // Load initial stats and settings
    Promise.all([GetStats(), GetSettings(), GetCapabilities(), GetConstants()])
      .then(([_statsData, settings, capabilities, constants]) => {
        if (constants) updatePatterns(constants);

        // Check for First Run condition
        // If no AI credential is configured, show First Run Modal
        if (!capabilities?.hasAi) {
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
            case "experimental":
              setInitialPath("/experimental");
              break;
            case "item":
              if (settings.lastWordId && settings.lastWordId > 0) {
                GetEntity(settings.lastWordId)
                  .then(() => {
                    setInitialPath(`/item/${settings.lastWordId}`);
                  })
                  .catch((e) => {
                    LogError(
                      `Failed to load last item ${settings.lastWordId}, falling back to poetry: ${e}`,
                    );
                    SearchEntities("poetry", "")
                      .then((results) => {
                        if (results && results.length > 0) {
                          setInitialPath(`/item/${results[0].id}`);
                        }
                      })
                      .catch((e) =>
                        LogError(`Failed to get poetry item: ${e}`),
                      );
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
          GetEntity(settings.lastWordId)
            .then(() => {
              setInitialPath(`/item/${settings.lastWordId}`);
            })
            .catch((e) => {
              LogError(
                `Failed to load last item ${settings.lastWordId}, falling back to poetry: ${e}`,
              );
              SearchEntities("poetry", "")
                .then((results) => {
                  if (results && results.length > 0) {
                    setInitialPath(`/item/${results[0].id}`);
                  }
                })
                .catch((e) => LogError(`Failed to get poetry item: ${e}`));
            });
        }
      })
      .catch((e) => LogError(`Failed to initialize app: ${e}`))
      .finally(() => setLoading(false));
  }, []);

  return {
    loading,
    initialPath,
    firstRunModalOpen,
    setFirstRunModalOpen,
  };
}
