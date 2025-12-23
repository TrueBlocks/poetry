/**
 * Prepare quoted text for text-to-speech by extracting quote,
 * truncating if needed, and combining with item word
 */
export function prepareTTSText(
  definition: string,
  itemWord: string,
): string | null {
  const quoteRegex = /\[\s*\n([\s\S]*?)\n\s*\]/;
  const match = definition.match(quoteRegex);

  if (!match || !match[1]) {
    return null;
  }

  let quotedText = match[1].replace(/[\\\/]$/gm, "").trim();
  const wordCount = quotedText.split(/\s+/).length;

  // For shorter quotes (< 500 words), just truncate to character limit
  if (wordCount < 500) {
    if (quotedText.length > 4000) {
      quotedText = quotedText.substring(0, 4000);
    }
  } else {
    // For longer quotes, select first few stanzas up to 5 lines
    const stanzas = quotedText.split(/\n\s*\n/);
    let selectedText = stanzas[0] || "";
    let lineCount = selectedText.split("\n").length;
    let stanzaIndex = 1;

    while (lineCount < 5 && stanzaIndex < stanzas.length) {
      const nextStanza = stanzas[stanzaIndex];
      const combined = selectedText + "\n\n" + nextStanza;
      if (combined.length > 4000) break;
      selectedText = combined;
      lineCount = selectedText.split("\n").length;
      stanzaIndex++;
    }
    quotedText = selectedText.trim();
  }

  const textToSpeak = `${itemWord}. ${quotedText}`;
  return textToSpeak.length > 4000
    ? textToSpeak.substring(0, 4000)
    : textToSpeak;
}
