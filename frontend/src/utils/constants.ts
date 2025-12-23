import { LogError } from "@utils/logger";

export const Patterns = {
  // Default values matching backend pkg/parser/parser.go
  // These will be updated from the backend on app startup
  ReferenceTag: /\{(word|writer|title):\s*([^}]+)\}/gi,
  GenericTag: /\{([a-zA-Z0-9_]+):\s*([^}]+)\}/gi,
};

export const updatePatterns = (patterns: Record<string, string>) => {
  if (patterns.ReferenceTagPattern) {
    // Convert Go regex to JS regex
    // Go: `\{(word|writer|title):\s*([^}]+)\}`
    // JS: /\{(word|writer|title):\s*([^}]+)\}/gi
    // We need to be careful with flags. The backend regex doesn't specify flags in the string,
    // but we usually want 'g' and 'i' for these tags in frontend.

    // For now, we'll trust the structure but ensure flags
    try {
      Patterns.ReferenceTag = new RegExp(patterns.ReferenceTagPattern, "gi");
    } catch (e) {
      LogError(`Failed to update ReferenceTag pattern: ${e}`);
    }
  }

  if (patterns.GenericTagPattern) {
    try {
      Patterns.GenericTag = new RegExp(patterns.GenericTagPattern, "gi");
    } catch (e) {
      LogError(`Failed to update GenericTag pattern: ${e}`);
    }
  }
};
