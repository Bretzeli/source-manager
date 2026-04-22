import type { Locale } from "@/lib/i18n"
import { PUBLIC_AVATARS_URL_PREFIX } from "@/lib/public-avatars-shared"

/**
 * Display names for files in `public/avatars/` (keys = exact filenames on disk).
 * Add an entry whenever you add a new preset avatar so settings show a proper label
 * instead of the raw filename.
 */
export const AVATAR_PRESET_DISPLAY_NAMES: Record<string, { en: string; de: string }> = {
  "christmas-reindeer.svg": {
    en: "Christmas reindeer",
    de: "Weihnachtsrentier",
  },
  "refreshing-beverage.svg": {
    en: "Refreshing drink",
    de: "Erfrischendes Getränk",
  },
  "easter_bunny.svg": {
    en: "Easter bunny",
    de: "Osterhase",
  },
}

function filenameFromPresetUrl(presetUrl: string): string {
  const prefix = `${PUBLIC_AVATARS_URL_PREFIX}/`
  if (!presetUrl.startsWith(prefix)) return presetUrl
  try {
    return decodeURIComponent(presetUrl.slice(prefix.length))
  } catch {
    return presetUrl.slice(prefix.length)
  }
}

function humanizeFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "")
  return base
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Label for a preset avatar URL in the account settings picker. */
export function getPresetAvatarDisplayLabel(presetUrl: string, locale: Locale): string {
  const filename = filenameFromPresetUrl(presetUrl)
  const row = AVATAR_PRESET_DISPLAY_NAMES[filename]
  if (row) return locale === "de" ? row.de : row.en
  return humanizeFilename(filename)
}
