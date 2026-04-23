export const ACTIVE_THEME_COOKIE = "active_theme"
export const ACTIVE_THEME_STORAGE_KEY = "source-manager-active-theme"
export const DEFAULT_ACTIVE_THEME = "default"

export const appThemes = [
  {
    id: "default",
    label: "Default",
  },
  {
    id: "kodama-grove",
    label: "Kodama Grove",
  },
  {
    id: "claude",
    label: "Claude",
  },
  {
    id: "claymorphism",
    label: "Claymorphism",
  },
  {
    id: "vintage-paper",
    label: "Vintage Paper",
  },
  {
    id: "caffeine",
    label: "Caffeine",
  },
  {
    id: "amethyst-haze",
    label: "Amethyst Haze",
  },
] as const

export type AppTheme = (typeof appThemes)[number]
export type AppThemeId = AppTheme["id"]
