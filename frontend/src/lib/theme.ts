export const themeIds = ["emerald", "ocean", "saffron", "graphite", "clean", "mint", "ivory"] as const;

export type ThemeId = (typeof themeIds)[number];

export const themes: Array<{ id: ThemeId; name: string; description: string; mode: "light" | "dark" }> = [
  { id: "clean", name: "Clean White", description: "Bright and high contrast", mode: "light" },
  { id: "mint", name: "Soft Mint", description: "Fresh and easy on the eyes", mode: "light" },
  { id: "ivory", name: "Warm Ivory", description: "Soft warmth for long sessions", mode: "light" },
  { id: "emerald", name: "Emerald", description: "Focused and familiar", mode: "dark" },
  { id: "ocean", name: "Ocean", description: "Calm blue clarity", mode: "dark" },
  { id: "saffron", name: "Saffron", description: "Warm market energy", mode: "dark" },
  { id: "graphite", name: "Graphite", description: "Neutral and minimal", mode: "dark" },
];

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && themeIds.some((theme) => theme === value);
}

export function applyTheme(theme: ThemeId) {
  document.documentElement.setAttribute("data-theme", theme);
}