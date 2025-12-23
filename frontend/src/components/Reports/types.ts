import { services } from "@wailsjs/go/models";

// Re-export generated types for convenience and backward compatibility
export type UnlinkedRefResult = services.UnlinkedReferenceResult;
export type UnlinkedRefDetail = services.UnlinkedReferenceDetail;
export type DuplicateResult = services.DuplicateItemResult;
export type DuplicateItem = services.DuplicateItemDetail;
export type UnknownTagsResult = services.UnknownTagResult;
export type LinkedNotInDefResult = services.LinkedItemNotInDefinitionResult;
export type SelfRefResult = services.SelfReferenceResult;
export type DanglingLinkResult = services.DanglingLinkResult;
export type ItemWithUnknownTypeResult = services.ItemWithUnknownTypeResult;
export type ItemWithoutDefinitionResult = services.ItemWithoutDefinitionResult;
export type OrphanedItemResult = services.OrphanedItemResult;
