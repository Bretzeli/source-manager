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
  {
    id: "amber-minimal",
    label: "Amber Minimal",
  },
  {
    id: "muted-amber",
    label: "Muted Amber",
  },
  {
    id: "bubblegum",
    label: "Bubblegum",
  },
  {
    id: "muted-bubblegum",
    label: "Muted Bubblegum",
  },
  {
    id: "candyland",
    label: "Candyland",
  },
  {
    id: "darkmatter",
    label: "Dark Matter",
  },
  {
    id: "midnight-bloom",
    label: "Midnight Bloom",
  },
  {
    id: "northern-lights",
    label: "Northern Lights",
  },
  {
    id: "notebook",
    label: "Notebook",
  },
] as const

export type AppTheme = (typeof appThemes)[number]
export type AppThemeId = AppTheme["id"]
