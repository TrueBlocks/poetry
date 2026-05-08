// Entity type slugs. Must match constants in pkg/constants/entitytypes.go.
export const ENTITY_TYPE_WRITER = "writer";
export const ENTITY_TYPE_TITLE = "title";
export const ENTITY_TYPE_REFERENCE = "reference";
export const ENTITY_TYPE_POET = "poet";
export const ENTITY_TYPE_WORD = "word";

export type EntityType =
  | typeof ENTITY_TYPE_WRITER
  | typeof ENTITY_TYPE_TITLE
  | typeof ENTITY_TYPE_REFERENCE
  | typeof ENTITY_TYPE_POET
  | typeof ENTITY_TYPE_WORD;

export const ENTITY_TYPES: EntityType[] = [
  ENTITY_TYPE_WRITER,
  ENTITY_TYPE_TITLE,
  ENTITY_TYPE_REFERENCE,
  ENTITY_TYPE_POET,
  ENTITY_TYPE_WORD,
];
