import { useEffect, useRef } from "react";
import { SaveWindowPosition } from "../../wailsjs/go/main/App";
import {
  WindowGetPosition,
  WindowGetSize,
} from "../../wailsjs/runtime/runtime";

export function useWindowPersistence() {
  const lastSavedPosition = useRef({ x: 0, y: 0, width: 0, height: 0 });

  useEffect(() => {
    const savePosition = async () => {
      try {
        const position = await WindowGetPosition();
        const size = await WindowGetSize();
        const x = position.x;
        const y = position.y;
        const width = size.w;
        const height = size.h;

        // Only save if values have changed to avoid excessive writes
        const last = lastSavedPosition.current;
        if (
          x !== last.x ||
          y !== last.y ||
          width !== last.width ||
          height !== last.height
        ) {
          lastSavedPosition.current = { x, y, width, height };
          await SaveWindowPosition(x, y, width, height);
        }
      } catch (err) {
        console.error("Failed to save window position:", err);
      }
    };

    // Save immediately on mount
    savePosition();

    // Save on resize
    window.addEventListener("resize", savePosition);

    // Poll frequently for position/size changes (every 250ms)
    const positionInterval = setInterval(savePosition, 250);

    // Also save on visibility change (when user switches away/back)
    document.addEventListener("visibilitychange", savePosition);

    return () => {
      window.removeEventListener("resize", savePosition);
      clearInterval(positionInterval);
      document.removeEventListener("visibilitychange", savePosition);
      // Save one final time on unmount
      savePosition();
    };
  }, []);
}
