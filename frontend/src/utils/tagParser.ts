import { Patterns } from "./constants";

export interface ParsedTag {
  type: "text" | "reference";
  content: string;
  refType?: string;
  refWord?: string;
  displayWord?: string;
  matchWord?: string;
}

export interface ParsedSegment {
  type: "text" | "quote" | "poem";
  content: string;
  preText?: string;
  postText?: string;
}

/**
 * Parse text containing reference tags like {word:}, {writer:}, {title:}
 * Returns an array of tokens for rendering
 */
export function parseReferenceTags(text: string): ParsedTag[] {
  const parts: ParsedTag[] = [];
  const regex = new RegExp(Patterns.ReferenceTag, "gi");
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: text.substring(lastIndex, match.index),
      });
    }

    const refType = match[1].toLowerCase();
    const refWord = match[2].trim();

    parts.push({
      type: "reference",
      content: match[0],
      refType,
      refWord,
      displayWord: refWord,
      matchWord: refWord, // Will be processed by caller if needed (e.g., stripPossessive)
    });

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      content: text.substring(lastIndex),
    });
  }

  return parts;
}

/**
 * Parse text into segments: normal text, block quotes, or poems
 */
export function parseTextSegments(
  text: string,
  isPoem: boolean,
): ParsedSegment[] {
  if (isPoem) {
    // Extract content between brackets, capturing text before and after
    const match = text.match(/^([\s\S]*?)\[([\s\S]*)\]([\s\S]*)$/);
    if (match) {
      return [
        {
          type: "poem",
          content: match[2].trim(),
          preText: match[1],
          postText: match[3],
        },
      ];
    }
  }

  // Split by block quotes (text between [ and ])
  const blockQuoteRegex = /\[\s*\n([\s\S]*?)\n\s*\]/g;
  const segments: ParsedSegment[] = [];
  let lastIdx = 0;
  let blockMatch;

  while ((blockMatch = blockQuoteRegex.exec(text)) !== null) {
    // Add text before the quote
    if (blockMatch.index > lastIdx) {
      segments.push({
        type: "text",
        content: text.substring(lastIdx, blockMatch.index),
      });
    }
    // Add the quote content (without the brackets), stripping trailing \ or / from each line
    const quoteContent = blockMatch[1].replace(/[\\\/]$/gm, "");
    segments.push({ type: "quote", content: quoteContent });
    lastIdx = blockQuoteRegex.lastIndex;
  }

  // Add remaining text
  if (lastIdx < text.length) {
    segments.push({ type: "text", content: text.substring(lastIdx) });
  }

  return segments;
}
