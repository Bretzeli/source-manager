/** Public URL prefix for files under `public/avatars/`. */
export const PUBLIC_AVATARS_URL_PREFIX = "/avatars"

/** Returns the URL if it is exactly one of the allowed preset avatar URLs; otherwise null. */
export function sanitizePresetAvatarUrl(candidate: string | null | undefined, allowed: string[]): string | null {
  if (candidate == null || typeof candidate !== "string") return null
  const trimmed = candidate.trim()
  if (!trimmed.startsWith(`${PUBLIC_AVATARS_URL_PREFIX}/`)) return null
  const allowedSet = new Set(allowed)
  if (allowedSet.has(trimmed)) return trimmed
  return null
}
