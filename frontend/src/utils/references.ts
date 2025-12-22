import { Patterns } from "./constants";

/**
 * Reference parsing utilities for dbPoetry
 * Handles extraction and parsing of {word:}, {writer:}, and {title:} reference tags
 */

/**
 * Strip possessive 's or s' from text (both regular and curly apostrophes)
 */
export function stripPossessive(text: string): string {
  if (text.endsWith("s'")) {
    return text.slice(0, -1);
  }
  if (text.endsWith("s'")) {
    return text.slice(0, -1);
  }
  if (text.endsWith("'s")) {
    return text.slice(0, -2);
  }
  if (text.endsWith("'s")) {
    return text.slice(0, -2);
  }
  return text;
}

/**
 * Extract reference type from tag prefix
 * @param refType - The reference type: word, writer, or title
 * @returns The full reference type name
 */
export function extractReferenceType(
  refType: string,
): "Reference" | "Writer" | "Title" | null {
  const lowerType = refType.toLowerCase();
  switch (lowerType) {
    case "word":
      return "Reference";
    case "writer":
      return "Writer";
    case "title":
      return "Title";
    default:
      return null;
  }
}

/**
 * Parse definition text and extract all references
 * @param text - The definition text containing reference tags
 * @returns Array of reference words (possessives stripped for person references)
 */
export function parseReferences(text: string | null | undefined): string[] {
  if (!text) return [];
  // Matches backend ReferenceTagPattern in pkg/parser/parser.go
  const matches = text.matchAll(Patterns.ReferenceTag);
  const refs: string[] = [];
  for (const match of matches) {
    const refType = match[1].toLowerCase();
    let refWord = match[2].trim();
    // Strip possessive 's from writer references
    if (refType === "writer") {
      refWord = stripPossessive(refWord);
    }
    refs.push(refWord);
  }
  return refs;
}

/**
 * Color mapping for reference types
 */
export const REFERENCE_COLOR_MAP: Record<string, string> = {
  word: "#0000FF", // Reference - blue
  writer: "#FF0000", // Writer - red
  title: "#008000", // Title - green
};
