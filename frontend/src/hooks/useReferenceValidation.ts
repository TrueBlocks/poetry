import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { GetAllItems } from "../../wailsjs/go/main/App.js";
import { parseReferences } from "../utils/references";

interface ValidationResult {
  reference: string;
  exists: boolean;
  itemId?: number;
}

export function useReferenceValidation(text: string, debounceMs: number = 500) {
  const [validationResults, setValidationResults] = useState<
    Map<string, ValidationResult>
  >(new Map());
  const [debouncedText, setDebouncedText] = useState(text);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  // Debounce the text input
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setDebouncedText(text);
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [text, debounceMs]);

  // Fetch all items for validation
  const { data: allItems } = useQuery({
    queryKey: ["allItems"],
    queryFn: GetAllItems,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Validate references when debounced text or items change
  useEffect(() => {
    if (!debouncedText || !allItems) {
      setValidationResults(new Map());
      return;
    }

    const references = parseReferences(debouncedText);
    const results = new Map<string, ValidationResult>();

    for (const ref of references) {
      const matchedItem = allItems.find(
        (item: any) => item.word.toLowerCase() === ref.toLowerCase(),
      );

      results.set(ref, {
        reference: ref,
        exists: !!matchedItem,
        itemId: matchedItem?.itemId,
      });
    }

    setValidationResults(results);
  }, [debouncedText, allItems]);

  const getValidationForReference = useCallback(
    (reference: string): ValidationResult | undefined => {
      return validationResults.get(reference);
    },
    [validationResults],
  );

  const getMissingReferences = useCallback((): string[] => {
    return Array.from(validationResults.values())
      .filter((result) => !result.exists)
      .map((result) => result.reference);
  }, [validationResults]);

  const getExistingReferences = useCallback((): ValidationResult[] => {
    return Array.from(validationResults.values()).filter(
      (result) => result.exists,
    );
  }, [validationResults]);

  return {
    validationResults,
    getValidationForReference,
    getMissingReferences,
    getExistingReferences,
    isValidating: text !== debouncedText,
  };
}
