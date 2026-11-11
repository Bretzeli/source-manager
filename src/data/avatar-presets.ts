import type { Locale } from "@/lib/i18n"
import { PUBLIC_AVATARS_URL_PREFIX } from "@/lib/public-avatars-shared"

/** Groups for preset avatars from `public/avatars/`, in the order they are shown in settings. */
export const PRESET_AVATAR_GROUP_IDS = ["other", "dinosaurs", "animals"] as const
export type PresetAvatarGroupId = (typeof PRESET_AVATAR_GROUP_IDS)[number]

type PresetAvatarMeta = {
  group: Exclude<PresetAvatarGroupId, "other">
  en: string
  de: string
}

/**
 * Metadata for files in `public/avatars/` (keys = exact filenames on disk).
 * Add an entry whenever you add a new preset avatar so settings show it in the right group
 * with a proper label. Entry order is the display order within a group. Files without an
 * entry are still shown, in the "other" group, labelled from their filename.
 */
export const AVATAR_PRESETS: Record<string, PresetAvatarMeta> = {
  "christmas-reindeer.svg": {
    group: "animals",
    en: "Christmas reindeer",
    de: "Weihnachtsrentier",
  },
  "easter_bunny.svg": {
    group: "animals",
    en: "Easter bunny",
    de: "Osterhase",
  },
  "refreshing-beverage.svg": {
    group: "animals",
    en: "Refreshing drink",
    de: "Erfrischendes Getränk",
  },
  "dino-triceratops.svg": {
    group: "dinosaurs",
    en: "Triceratops",
    de: "Triceratops",
  },
  "dino-brontosaurus.svg": {
    group: "dinosaurs",
    en: "Brontosaurus",
    de: "Brontosaurus",
  },
  "dino-t-rex.svg": {
    group: "dinosaurs",
    en: "T-Rex",
    de: "T-Rex",
  },
  "dino-raptor.svg": {
    group: "dinosaurs",
    en: "Raptor",
    de: "Raptor",
  },
  "dino-dodo.svg": {
    group: "dinosaurs",
    en: "Dodo",
    de: "Dodo",
  },
  "dino-spinosaurus.svg": {
    group: "dinosaurs",
    en: "Spinosaurus",
    de: "Spinosaurus",
  },
}

const PRESET_ORDER = Object.keys(AVATAR_PRESETS)

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
  const row = AVATAR_PRESETS[filename]
  if (row) return locale === "de" ? row.de : row.en
  return humanizeFilename(filename)
}

/**
 * Splits preset avatar URLs into their groups (in `PRESET_AVATAR_GROUP_IDS` order), sorted by
 * their position in `AVATAR_PRESETS`. Empty groups are omitted.
 */
export function groupPresetAvatarUrls(
  presetUrls: string[]
): Array<{ group: PresetAvatarGroupId; urls: string[] }> {
  const rank = (url: string) => {
    const index = PRESET_ORDER.indexOf(filenameFromPresetUrl(url))
    return index === -1 ? Number.POSITIVE_INFINITY : index
  }
  const sorted = [...presetUrls].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))

  return PRESET_AVATAR_GROUP_IDS.map((group) => ({
    group,
    urls: sorted.filter(
      (url) => (AVATAR_PRESETS[filenameFromPresetUrl(url)]?.group ?? "other") === group
    ),
  })).filter((entry) => entry.urls.length > 0)
}
