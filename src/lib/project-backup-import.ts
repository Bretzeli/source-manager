/**
 * Importing a project backup from the browser.
 *
 * A request to a server action may be at most 1 MB (and Vercel caps every request at 4.5 MB),
 * so instead of sending the whole backup at once, it is sent in pieces well below that.
 */

import { createImportedProject, importBackupSources, importBackupTags } from "@/app/actions/project-backup"
import { deleteProject } from "@/app/actions/projects"
import type { ProjectBackup } from "@/lib/project-backup"

const MAX_CHUNK_BYTES = 512 * 1024

/**
 * Split items into consecutive groups whose JSON stays below `maxBytes`. An item that is larger
 * on its own gets a group of its own (it was saved through a server action, so it fits one).
 */
function chunkBySize<T>(items: T[], maxBytes: number): T[][] {
  const encoder = new TextEncoder()
  const chunks: T[][] = []
  let current: T[] = []
  let currentBytes = 2 // the surrounding []

  for (const item of items) {
    const itemBytes = encoder.encode(JSON.stringify(item)).length + 1 // plus a comma
    if (current.length > 0 && currentBytes + itemBytes > maxBytes) {
      chunks.push(current)
      current = []
      currentBytes = 2
    }
    current.push(item)
    currentBytes += itemBytes
  }
  if (current.length > 0) chunks.push(current)

  return chunks
}

/**
 * Create a new project from a (validated) backup. If any step fails, the partly imported
 * project is deleted again and the error is rethrown.
 */
export async function importProjectBackup(backup: ProjectBackup): Promise<{ id: string; title: string }> {
  const project = await createImportedProject(backup.project)

  try {
    const newTagIds = new Map<string, string>()
    for (const tagChunk of chunkBySize(backup.tags, MAX_CHUNK_BYTES)) {
      const ids = await importBackupTags(project.id, tagChunk)
      tagChunk.forEach((tag, index) => newTagIds.set(tag.id, ids[index]))
    }

    // The backup was validated, so every tag a source refers to has been imported above.
    const sourcesWithNewTagIds = backup.sources.map((source) => ({
      ...source,
      tagIds: source.tagIds.map((tagId) => newTagIds.get(tagId)!),
    }))
    for (const sourceChunk of chunkBySize(sourcesWithNewTagIds, MAX_CHUNK_BYTES)) {
      await importBackupSources(project.id, sourceChunk)
    }
  } catch (error) {
    await deleteProject(project.id).catch((cleanupError) => {
      console.error("Failed to remove the partly imported project:", cleanupError)
    })
    throw error
  }

  return project
}
