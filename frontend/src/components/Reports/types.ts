// Shared types for Reports components
export interface UnlinkedRefDetail {
  ref: string;
  reason: "missing" | "unlinked";
}

export interface UnlinkedRefResult {
  itemId: number;
  word: string;
  type: string;
  unlinkedRefs: UnlinkedRefDetail[];
  refCount: number;
}

export interface DuplicateItem {
  itemId: number;
  word: string;
  type: string;
}

export interface DuplicateResult {
  strippedWord: string;
  original: DuplicateItem;
  duplicates: DuplicateItem[];
  count: number;
}

export interface SimpleItem {
  itemId: number;
  word: string;
  type: string;
  incomingLinkCount?: number;
  singleIncomingLinkItemId?: number;
  singleIncomingLinkWord?: string;
  hasMissingData?: boolean;
}

export interface UnknownTagsResult {
  itemId: number;
  word: string;
  type: string;
  unknownTags: string[];
  tagCount: number;
}

export interface LinkedNotInDefResult {
  itemId: number;
  word: string;
  type: string;
  missingReferences: string[];
}

export interface SelfReferentialResult {
  itemId: number;
  word: string;
  type: string;
  tag: string;
}
