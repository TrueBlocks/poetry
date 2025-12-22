// Centralized color definitions for item types
export const ITEM_TYPE_COLORS = {
  Title: "#FFB6D9", // light pink
  Reference: "#ADD8E6", // light blue
  Writer: "#90EE90", // light green
} as const;

export type ItemType = keyof typeof ITEM_TYPE_COLORS;

export function getItemColor(
  type: string,
  defaultColor: string = "#E5E7EB",
): string {
  return ITEM_TYPE_COLORS[type as ItemType] || defaultColor;
}

export function getItemTextColor(type: string): string {
  switch (type) {
    case "Title":
      return "#831843";
    case "Reference":
      return "#1e3a8a";
    case "Writer":
      return "#14532d";
    default:
      return "#111827";
  }
}
