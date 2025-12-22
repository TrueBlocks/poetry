import { stripPossessive } from "../../utils/references";
import { GetItemByWord } from "../../../wailsjs/go/main/App";

/**
 * Helper function to strip possessive from reference word and look up item
 */
export async function lookupItemByRef(refWord: string) {
  const matchWord = stripPossessive(refWord);
  return await GetItemByWord(matchWord);
}
