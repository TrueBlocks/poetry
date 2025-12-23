/**
 * Wails-compatible logging utilities
 *
 * These functions write to Wails log files and are visible in production,
 * unlike console.log which is invisible in Wails builds.
 */
export {
  LogPrint,
  LogTrace,
  LogDebug,
  LogInfo,
  LogWarning,
  LogError,
  LogFatal,
} from "@wailsjs/runtime/runtime.js";
