import { readdir } from "node:fs/promises"
import path from "node:path"
import { PUBLIC_AVATARS_URL_PREFIX } from "@/lib/public-avatars-shared"

const ALLOWED_EXTENSIONS = new Set([
  ".webp",
  ".png",
  ".svg",
  ".jpg",
  ".jpeg",
  ".gif",
  ".avif",
])

function avatarsDir() {
  return path.join(process.cwd(), "public", "avatars")
}

/** Lists image files in `public/avatars` as public path strings (e.g. `/avatars/foo.webp`). */
export async function listPublicAvatarUrls(): Promise<string[]> {
  try {
    const entries = await readdir(avatarsDir(), { withFileTypes: true })
    const urls: string[] = []
    for (const entry of entries) {
      if (!entry.isFile()) continue
      const name = entry.name
      if (name !== path.basename(name) || name.includes("..") || name.includes("/") || name.includes("\\")) {
        continue
      }
      const ext = path.extname(name).toLowerCase()
      if (!ALLOWED_EXTENSIONS.has(ext)) continue
      urls.push(`${PUBLIC_AVATARS_URL_PREFIX}/${encodeURIComponent(name)}`)
    }
    return urls.sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
}
