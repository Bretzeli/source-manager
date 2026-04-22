/** Google and other CDNs often block hotlinked avatars unless Referer is stripped. */
export function avatarImageProps(src: string | undefined | null) {
  if (!src) return { src: undefined as string | undefined }
  if (src.startsWith("https://") || src.startsWith("http://")) {
    return { src, referrerPolicy: "no-referrer" as const }
  }
  return { src }
}
