"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { projects, sources, sourceTags, tags } from "@/lib/db/app-schema"
import {
  PROJECT_BACKUP_FORMAT,
  PROJECT_BACKUP_VERSION,
  backupProjectSchema,
  backupSourceSchema,
  backupTagSchema,
  uniqueProjectTitle,
  type ProjectBackup,
} from "@/lib/project-backup"
import { asc, eq } from "drizzle-orm"
import type { BatchItem } from "drizzle-orm/batch"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { z } from "zod"

/** Rows per INSERT statement, well below Postgres' limit of 65535 bind parameters. */
const INSERT_CHUNK_SIZE = 1000

async function currentUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  const id = session?.user?.id
  return typeof id === "string" && id ? id : null
}

function parseRepoFiles(json: string | null): string[] {
  if (!json) return []
  try {
    const files: unknown = JSON.parse(json)
    return Array.isArray(files) ? files.filter((file): file is string => typeof file === "string") : []
  } catch {
    return []
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

/** Everything needed to recreate a project, ready to be saved as a JSON file. */
export async function exportProjectBackup(
  projectId: string,
  options: { includeGithub: boolean }
): Promise<ProjectBackup> {
  const userId = await currentUserId()
  if (!userId) {
    throw new Error("Unauthorized")
  }

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1)
  if (!project || project.ownerId !== userId) {
    throw new Error("Project not found or unauthorized")
  }

  const [projectTags, projectSources, tagLinks] = await Promise.all([
    db.select().from(tags).where(eq(tags.projectId, projectId)).orderBy(asc(tags.name)),
    db
      .select()
      .from(sources)
      .where(eq(sources.projectId, projectId))
      .orderBy(asc(sources.abbreviation), asc(sources.title)),
    db
      .select({ sourceId: sourceTags.sourceId, tagId: sourceTags.tagId })
      .from(sourceTags)
      .innerJoin(sources, eq(sources.id, sourceTags.sourceId))
      .where(eq(sources.projectId, projectId)),
  ])

  // The queries above aren't one snapshot: skip links to a tag created in between,
  // since the backup could not be imported with a reference to a tag it doesn't contain.
  const exportedTagIds = new Set(projectTags.map((tag) => tag.id))
  const tagIdsBySource = new Map<string, string[]>()
  for (const link of tagLinks) {
    if (!exportedTagIds.has(link.tagId)) continue
    const tagIds = tagIdsBySource.get(link.sourceId) ?? []
    tagIds.push(link.tagId)
    tagIdsBySource.set(link.sourceId, tagIds)
  }

  return {
    format: PROJECT_BACKUP_FORMAT,
    version: PROJECT_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    project: {
      title: project.title,
      description: project.description,
      createdAt: project.createdAt.toISOString(),
      lastEditedAt: project.lastEditedAt.toISOString(),
      github:
        options.includeGithub && project.githubRepoUrl
          ? { repoUrl: project.githubRepoUrl, files: parseRepoFiles(project.githubRepoFiles) }
          : null,
    },
    tags: projectTags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      abbreviation: tag.abbreviation,
      description: tag.description,
      notes: tag.notes,
      color: tag.color,
    })),
    sources: projectSources.map((source) => ({
      abbreviation: source.abbreviation,
      title: source.title,
      description: source.description,
      authors: source.authors,
      publicationDate: source.publicationDate,
      notes: source.notes,
      links: source.links,
      bibtex: source.bibtex,
      tagIds: tagIdsBySource.get(source.id) ?? [],
    })),
  }
}

/*
 * Importing a backup takes several requests (see src/lib/project-backup-import.ts), so that a
 * backup of any size stays below the request size limit: first the project is created, then its
 * tags and sources are added in pieces. Each piece is written in one transaction.
 */

async function requireOwnedProject(projectId: string) {
  const userId = await currentUserId()
  if (!userId) {
    throw new Error("Unauthorized")
  }

  const [project] = await db
    .select({ ownerId: projects.ownerId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)
  if (!project || project.ownerId !== userId) {
    throw new Error("Project not found or unauthorized")
  }
}

async function runInTransaction(queries: BatchItem<"pg">[]) {
  const [first, ...rest] = queries
  if (first) await db.batch([first, ...rest])
}

/**
 * Import step 1: create the project. If the user already has a project with the backup's
 * title, the new one is named "title (n)".
 */
export async function createImportedProject(input: unknown): Promise<{ id: string; title: string }> {
  const userId = await currentUserId()
  if (!userId) {
    throw new Error("Unauthorized")
  }

  const parsed = backupProjectSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error("Invalid project backup")
  }
  const project = parsed.data

  const existingProjects = await db
    .select({ title: projects.title })
    .from(projects)
    .where(eq(projects.ownerId, userId))
  const title = uniqueProjectTitle(
    project.title,
    existingProjects.map((existing) => existing.title)
  )

  const [created] = await db
    .insert(projects)
    .values({
      ownerId: userId,
      title,
      description: project.description,
      githubRepoUrl: project.github?.repoUrl ?? null,
      githubRepoFiles:
        project.github && project.github.files.length > 0 ? JSON.stringify(project.github.files) : null,
      createdAt: new Date(project.createdAt),
      lastEditedAt: new Date(project.lastEditedAt),
    })
    .returning({ id: projects.id, title: projects.title })

  revalidatePath("/")
  return created
}

/** Import step 2: add tags to the project. Returns their new ids, in the order given. */
export async function importBackupTags(projectId: string, input: unknown): Promise<string[]> {
  await requireOwnedProject(projectId)

  const parsed = z.array(backupTagSchema).safeParse(input)
  if (!parsed.success) {
    throw new Error("Invalid project backup")
  }

  const tagRows = parsed.data.map((tag) => ({
    id: crypto.randomUUID(),
    projectId,
    name: tag.name,
    abbreviation: tag.abbreviation,
    description: tag.description,
    notes: tag.notes,
    color: tag.color,
  }))

  await runInTransaction(chunk(tagRows, INSERT_CHUNK_SIZE).map((rows) => db.insert(tags).values(rows)))
  return tagRows.map((tag) => tag.id)
}

/** Import step 3: add sources to the project. Their `tagIds` must be (new) tags of this project. */
export async function importBackupSources(projectId: string, input: unknown): Promise<void> {
  await requireOwnedProject(projectId)

  const parsed = z.array(backupSourceSchema).safeParse(input)
  if (!parsed.success) {
    throw new Error("Invalid project backup")
  }
  const sourcesData = parsed.data

  const projectTags = await db.select({ id: tags.id }).from(tags).where(eq(tags.projectId, projectId))
  const projectTagIds = new Set(projectTags.map((tag) => tag.id))
  if (sourcesData.some((source) => source.tagIds.some((tagId) => !projectTagIds.has(tagId)))) {
    throw new Error("Invalid project backup")
  }

  const sourceRows = sourcesData.map((source) => ({
    id: crypto.randomUUID(),
    projectId,
    abbreviation: source.abbreviation,
    title: source.title,
    description: source.description,
    authors: source.authors,
    publicationDate: source.publicationDate,
    notes: source.notes,
    links: source.links,
    bibtex: source.bibtex,
  }))

  const sourceTagRows = sourcesData.flatMap((source, index) =>
    [...new Set(source.tagIds)].map((tagId) => ({ sourceId: sourceRows[index].id, tagId }))
  )

  await runInTransaction([
    ...chunk(sourceRows, INSERT_CHUNK_SIZE).map((rows) => db.insert(sources).values(rows)),
    ...chunk(sourceTagRows, INSERT_CHUNK_SIZE).map((rows) => db.insert(sourceTags).values(rows)),
  ])
}
