/**
 * Project backups: a JSON file holding everything needed to recreate a project
 * (its details, tags and sources, optionally its GitHub repository link).
 *
 * Shared by the export/import server actions and the import dialog, so the file
 * is validated the same way in the browser (for the preview) and on the server.
 */

import { z } from "zod"

export const PROJECT_BACKUP_FORMAT = "source-manager/project-backup"
export const PROJECT_BACKUP_VERSION = 1

const DEFAULT_TAG_COLOR = "#3b82f6"

const optionalText = z
  .string()
  .nullish()
  .transform((value) => value ?? null)

const timestamp = z.iso.datetime({ offset: true })

export const backupTagSchema = z.object({
  /** Only meaningful inside the backup: sources refer to their tags by this id. */
  id: z.string().min(1),
  name: z.string(),
  abbreviation: optionalText,
  description: optionalText,
  notes: optionalText,
  color: z.string().min(1).default(DEFAULT_TAG_COLOR),
})

export const backupSourceSchema = z.object({
  abbreviation: optionalText,
  title: z.string(),
  description: optionalText,
  authors: optionalText,
  publicationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish()
    .transform((value) => value ?? null),
  notes: optionalText,
  links: optionalText,
  bibtex: optionalText,
  tagIds: z.array(z.string()).default([]),
})

const backupGithubSchema = z.object({
  repoUrl: z.string().min(1),
  /** Files selected for citation checks. */
  files: z.array(z.string()).default([]),
})

export const backupProjectSchema = z.object({
  title: z.string().trim().min(1),
  description: optionalText,
  createdAt: timestamp,
  lastEditedAt: timestamp,
  /** Only present when the GitHub link was included in the export. */
  github: backupGithubSchema.nullish().transform((value) => value ?? null),
})

export const projectBackupSchema = z
  .object({
    format: z.literal(PROJECT_BACKUP_FORMAT),
    version: z.literal(PROJECT_BACKUP_VERSION),
    exportedAt: timestamp,
    project: backupProjectSchema,
    tags: z.array(backupTagSchema),
    sources: z.array(backupSourceSchema),
  })
  .superRefine((backup, ctx) => {
    const tagIds = new Set<string>()
    backup.tags.forEach((tag, index) => {
      if (tagIds.has(tag.id)) {
        ctx.addIssue({ code: "custom", message: `Duplicate tag id "${tag.id}"`, path: ["tags", index, "id"] })
      }
      tagIds.add(tag.id)
    })
    backup.sources.forEach((source, sourceIndex) => {
      source.tagIds.forEach((tagId, tagIndex) => {
        if (!tagIds.has(tagId)) {
          ctx.addIssue({
            code: "custom",
            message: `Unknown tag id "${tagId}"`,
            path: ["sources", sourceIndex, "tagIds", tagIndex],
          })
        }
      })
    })
  })

export type ProjectBackup = z.output<typeof projectBackupSchema>

export type ProjectBackupError = "notABackup" | "unsupportedVersion" | "invalid"

export type ProjectBackupParseResult =
  | { ok: true; backup: ProjectBackup }
  | { ok: false; error: ProjectBackupError }

/** Read a backup file's text, telling apart the ways it can be unusable. */
export function parseProjectBackup(text: string): ProjectBackupParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: "notABackup" }
  }

  if (typeof data !== "object" || data === null || (data as { format?: unknown }).format !== PROJECT_BACKUP_FORMAT) {
    return { ok: false, error: "notABackup" }
  }
  if ((data as { version?: unknown }).version !== PROJECT_BACKUP_VERSION) {
    return { ok: false, error: "unsupportedVersion" }
  }

  const result = projectBackupSchema.safeParse(data)
  if (!result.success) {
    console.warn("Invalid project backup:", result.error.issues)
    return { ok: false, error: "invalid" }
  }

  return { ok: true, backup: result.data }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * The title an imported project gets: `title` itself if it's free, otherwise `title (n)`,
 * where n is one above the highest number already used that way.
 */
export function uniqueProjectTitle(title: string, existingTitles: Iterable<string>): string {
  const taken = new Set(existingTitles)
  if (!taken.has(title)) return title

  const numbered = new RegExp(`^${escapeRegExp(title)} \\((\\d+)\\)$`)
  let highest = 0
  for (const existing of taken) {
    const match = numbered.exec(existing)
    if (match) highest = Math.max(highest, Number(match[1]))
  }
  return `${title} (${highest + 1})`
}
