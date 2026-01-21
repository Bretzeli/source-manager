"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { sources, tags, sourceTags, projects } from "@/lib/db/app-schema"
import { eq, and, desc, asc, or, like, sql, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { sourceFieldsToBibtex, serializeBibtex } from "@/lib/bibtex"

/**
 * Normalize date string to valid PostgreSQL DATE format
 * Handles formats like "2024-04" (YYYY-MM) or "2024" (YYYY)
 */
function normalizeDate(dateString: string | null | undefined): string | null {
  if (!dateString || !dateString.trim()) return null
  
  const trimmed = dateString.trim()
  
  // If it's already a full date (YYYY-MM-DD), return as is
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }
  
  // If it's YYYY-MM format, add day 01
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return `${trimmed}-01`
  }
  
  // If it's just YYYY format, use January 1st
  if (/^\d{4}$/.test(trimmed)) {
    return `${trimmed}-01-01`
  }
  
  // Try to parse and format
  try {
    const date = new Date(trimmed)
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]
    }
  } catch {
    // Invalid date format
  }
  
  return null
}

export async function getSources(projectId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  
  if (!session?.user) {
    return []
  }

  // Verify project ownership
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project || project.ownerId !== session.user.id) {
    return []
  }

  const allSources = await db
    .select()
    .from(sources)
    .where(eq(sources.projectId, projectId))
    .orderBy(asc(sources.abbreviation))

  // Get tags for each source
  const sourcesWithTags = await Promise.all(
    allSources.map(async (source) => {
      const sourceTagRelations = await db
        .select({
          tagId: sourceTags.tagId,
        })
        .from(sourceTags)
        .where(eq(sourceTags.sourceId, source.id))

      const tagIds = sourceTagRelations.map((st) => st.tagId)
      
      let sourceTagsData: Array<{
        id: string
        abbreviation: string | null
        name: string
        color: string
      }> = []

      if (tagIds.length > 0) {
        const tagsData = await db
          .select({
            id: tags.id,
            abbreviation: tags.abbreviation,
            name: tags.name,
            color: tags.color,
          })
          .from(tags)
          .where(inArray(tags.id, tagIds))

        sourceTagsData = tagsData
      }

      return {
        ...source,
        tags: sourceTagsData,
      }
    })
  )

  return sourcesWithTags
}

export async function getTags(projectId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  
  if (!session?.user) {
    return []
  }

  // Verify project ownership
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project || project.ownerId !== session.user.id) {
    return []
  }

  const allTags = await db
    .select()
    .from(tags)
    .where(eq(tags.projectId, projectId))
    .orderBy(asc(tags.name))

  return allTags
}

export async function createSource(projectId: string, data: {
  abbreviation?: string | null
  title: string
  description?: string | null
  authors?: string | null
  publicationDate?: string | null
  notes?: string | null
  links?: string | null
  bibtex?: string | null
  tagIds?: string[]
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  
  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  // Verify project ownership
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project || project.ownerId !== session.user.id) {
    throw new Error("Project not found or unauthorized")
  }

  const [newSource] = await db
    .insert(sources)
    .values({
      projectId,
      abbreviation: data.abbreviation?.trim() || null,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      authors: data.authors?.trim() || null,
      publicationDate: normalizeDate(data.publicationDate),
      notes: data.notes?.trim() || null,
      links: data.links?.trim() || null,
      bibtex: data.bibtex?.trim() || null,
    })
    .returning()

  // Add tag relations if provided
  if (data.tagIds && data.tagIds.length > 0) {
    await db.insert(sourceTags).values(
      data.tagIds.map((tagId) => ({
        sourceId: newSource.id,
        tagId,
      }))
    )
  }

  revalidatePath(`/projects/${projectId}/sources`)
  return newSource
}

export async function updateSource(
  projectId: string,
  sourceId: string,
  data: {
    abbreviation?: string | null
    title?: string
    description?: string | null
    authors?: string | null
    publicationDate?: string | null
    notes?: string | null
    links?: string | null
    bibtex?: string | null
    tagIds?: string[]
  }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  
  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  // Verify project ownership
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project || project.ownerId !== session.user.id) {
    throw new Error("Project not found or unauthorized")
  }

  // Verify source belongs to project
  const [source] = await db
    .select()
    .from(sources)
    .where(and(eq(sources.id, sourceId), eq(sources.projectId, projectId)))
    .limit(1)

  if (!source) {
    throw new Error("Source not found")
  }

  const updateData: Partial<typeof sources.$inferInsert> = {}
  
  if (data.abbreviation !== undefined) updateData.abbreviation = data.abbreviation?.trim() || null
  if (data.title !== undefined) updateData.title = data.title.trim()
  if (data.description !== undefined) updateData.description = data.description?.trim() || null
  if (data.authors !== undefined) updateData.authors = data.authors?.trim() || null
  if (data.publicationDate !== undefined) updateData.publicationDate = normalizeDate(data.publicationDate)
  if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null
  if (data.links !== undefined) updateData.links = data.links?.trim() || null
  if (data.bibtex !== undefined) updateData.bibtex = data.bibtex?.trim() || null

  // Only update source fields if there are any to update
  if (Object.keys(updateData).length > 0) {
    await db
      .update(sources)
      .set(updateData)
      .where(eq(sources.id, sourceId))
  }

  // Update tag relations if provided
  if (data.tagIds !== undefined) {
    // Delete existing relations
    await db
      .delete(sourceTags)
      .where(eq(sourceTags.sourceId, sourceId))

    // Insert new relations
    if (data.tagIds.length > 0) {
      await db.insert(sourceTags).values(
        data.tagIds.map((tagId) => ({
          sourceId,
          tagId,
        }))
      )
    }
  }

  revalidatePath(`/projects/${projectId}/sources`)
}

export async function deleteSource(projectId: string, sourceId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  
  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  // Verify project ownership
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project || project.ownerId !== session.user.id) {
    throw new Error("Project not found or unauthorized")
  }

  // Verify source belongs to project
  const [source] = await db
    .select()
    .from(sources)
    .where(and(eq(sources.id, sourceId), eq(sources.projectId, projectId)))
    .limit(1)

  if (!source) {
    throw new Error("Source not found")
  }

  await db
    .delete(sources)
    .where(eq(sources.id, sourceId))

  revalidatePath(`/projects/${projectId}/sources`)
}

export async function deleteAllSources(projectId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  
  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  // Verify project ownership
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project || project.ownerId !== session.user.id) {
    throw new Error("Project not found or unauthorized")
  }

  // Delete all sources for this project (cascade will handle sourceTags)
  await db
    .delete(sources)
    .where(eq(sources.projectId, projectId))

  revalidatePath(`/projects/${projectId}/sources`)
}

export async function createTag(projectId: string, data: {
  abbreviation?: string | null
  name: string
  description?: string | null
  notes?: string | null
  color?: string
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  
  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  // Verify project ownership
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project || project.ownerId !== session.user.id) {
    throw new Error("Project not found or unauthorized")
  }

  const [newTag] = await db
    .insert(tags)
    .values({
      projectId,
      abbreviation: data.abbreviation?.trim() || null,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      notes: data.notes?.trim() || null,
      color: data.color || "#3b82f6",
    })
    .returning()

  revalidatePath(`/projects/${projectId}/sources`)
  return newTag
}

export async function updateTag(
  projectId: string,
  tagId: string,
  data: {
    abbreviation?: string | null
    name?: string
    description?: string | null
    notes?: string | null
    color?: string
  }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  
  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  // Verify project ownership
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project || project.ownerId !== session.user.id) {
    throw new Error("Project not found or unauthorized")
  }

  // Verify tag belongs to project
  const [tag] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.id, tagId), eq(tags.projectId, projectId)))
    .limit(1)

  if (!tag) {
    throw new Error("Tag not found")
  }

  const updateData: Partial<typeof tags.$inferInsert> = {}
  
  if (data.abbreviation !== undefined) updateData.abbreviation = data.abbreviation?.trim() || null
  if (data.name !== undefined) updateData.name = data.name.trim()
  if (data.description !== undefined) updateData.description = data.description?.trim() || null
  if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null
  if (data.color !== undefined) updateData.color = data.color

  await db
    .update(tags)
    .set(updateData)
    .where(eq(tags.id, tagId))

  revalidatePath(`/projects/${projectId}/sources`)
}

export async function deleteTag(projectId: string, tagId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  
  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  // Verify project ownership
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project || project.ownerId !== session.user.id) {
    throw new Error("Project not found or unauthorized")
  }

  // Verify tag belongs to project
  const [tag] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.id, tagId), eq(tags.projectId, projectId)))
    .limit(1)

  if (!tag) {
    throw new Error("Tag not found")
  }

  // Delete tag (cascade will handle sourceTags relations)
  await db
    .delete(tags)
    .where(eq(tags.id, tagId))

  revalidatePath(`/projects/${projectId}/sources`)
}

export async function mergeTags(
  projectId: string,
  sourceTagIds: string[],
  targetTagData: {
    name: string
    abbreviation?: string | null
    color?: string
  }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  
  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  // Verify project ownership
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project || project.ownerId !== session.user.id) {
    throw new Error("Project not found or unauthorized")
  }

  if (sourceTagIds.length < 2) {
    throw new Error("At least 2 tags must be selected for merging")
  }

  // Verify all tags belong to project
  const allTags = await db
    .select()
    .from(tags)
    .where(and(
      eq(tags.projectId, projectId),
      inArray(tags.id, sourceTagIds)
    ))

  if (allTags.length !== sourceTagIds.length) {
    throw new Error("One or more tags not found")
  }

  // Create the merged tag
  const [mergedTag] = await db
    .insert(tags)
    .values({
      projectId,
      name: targetTagData.name.trim(),
      abbreviation: targetTagData.abbreviation?.trim() || null,
      color: targetTagData.color || "#3b82f6",
    })
    .returning()

  // Get all source-tag relations for the tags being merged
  const sourceTagRelations = await db
    .select()
    .from(sourceTags)
    .where(inArray(sourceTags.tagId, sourceTagIds))

  // Group by sourceId and merge to avoid duplicates
  const sourceIdToTagIds = new Map<string, Set<string>>()
  sourceTagRelations.forEach((rel) => {
    if (!sourceIdToTagIds.has(rel.sourceId)) {
      sourceIdToTagIds.set(rel.sourceId, new Set())
    }
    sourceIdToTagIds.get(rel.sourceId)!.add(rel.tagId)
  })

  // Update all source-tag relations to point to the merged tag
  // First, remove existing relations for merged tags
  await db
    .delete(sourceTags)
    .where(inArray(sourceTags.tagId, sourceTagIds))

  // Then, add new relations to merged tag (avoiding duplicates)
  const newRelations = Array.from(sourceIdToTagIds.keys()).map((sourceId) => ({
    sourceId,
    tagId: mergedTag.id,
  }))

  if (newRelations.length > 0) {
    // Remove duplicates by converting to Set and back
    const uniqueRelations = Array.from(
      new Map(newRelations.map(r => [`${r.sourceId}-${r.tagId}`, r])).values()
    )
    await db.insert(sourceTags).values(uniqueRelations)
  }

  // Delete the source tags
  await db
    .delete(tags)
    .where(inArray(tags.id, sourceTagIds))

  revalidatePath(`/projects/${projectId}/sources`)
  return mergedTag
}

export async function batchImportSources(
  projectId: string,
  sourcesData: Array<{
    abbreviation?: string | null
    title: string
    description?: string | null
    authors?: string | null
    publicationDate?: string | null
    notes?: string | null
    links?: string | null
    bibtex?: string | null
    tagNames?: string[]
    tagColors?: Record<string, string>
    tagAbbreviations?: Record<string, string>
  }>
) {
  const session = await auth.api.getSession({ headers: await headers() })
  
  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  // Verify project ownership
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project || project.ownerId !== session.user.id) {
    throw new Error("Project not found or unauthorized")
  }

  // Get existing tags for this project
  const existingTags = await db
    .select()
    .from(tags)
    .where(eq(tags.projectId, projectId))

  const tagNameToId: Record<string, string> = {}
  existingTags.forEach((tag) => {
    tagNameToId[tag.name.toLowerCase()] = tag.id
  })

  // Get existing sources with bibtex to check for duplicates
  const existingSources = await db
    .select({ id: sources.id, bibtex: sources.bibtex })
    .from(sources)
    .where(eq(sources.projectId, projectId))

  const existingBibtexSet = new Set(
    existingSources
      .map((s) => s.bibtex)
      .filter((b): b is string => b !== null && b.trim() !== "")
  )

  const createdSources: string[] = []

  for (const sourceData of sourcesData) {
    // Skip if bibtex already exists
    if (sourceData.bibtex && existingBibtexSet.has(sourceData.bibtex.trim())) {
      continue
    }

    // Use provided bibtex - do NOT auto-generate
    // Miro CSV imports explicitly set bibtex to null, so we keep it null
    // Regular CSV/JSON imports will have bibtex if provided in the file
    const bibtex = sourceData.bibtex?.trim() || null

    // Create the source
    const [newSource] = await db
      .insert(sources)
      .values({
        projectId,
        abbreviation: sourceData.abbreviation?.trim() || null,
        title: sourceData.title.trim(),
        description: sourceData.description || null, // Don't trim to preserve newlines
        authors: sourceData.authors?.trim() || null,
        publicationDate: normalizeDate(sourceData.publicationDate),
        notes: sourceData.notes || null, // Don't trim to preserve newlines
        links: sourceData.links || null, // Don't trim links to preserve newlines
        bibtex: bibtex,
      })
      .returning()

    createdSources.push(newSource.id)

    // Handle tags
    if (sourceData.tagNames && sourceData.tagNames.length > 0) {
      const tagIds: string[] = []

      for (const tagName of sourceData.tagNames) {
        const tagNameLower = tagName.toLowerCase()
        let tagId = tagNameToId[tagNameLower]

        // Create tag if it doesn't exist (default color is blue)
        if (!tagId) {
          const color = sourceData.tagColors?.[tagName] || "#3b82f6" // Default blue
          const abbreviation = sourceData.tagAbbreviations?.[tagName] || null
          const [newTag] = await db
            .insert(tags)
            .values({
              projectId,
              name: tagName.trim(),
              abbreviation: abbreviation?.trim() || null,
              color,
            })
            .returning()

          tagId = newTag.id
          tagNameToId[tagNameLower] = tagId
        }

        tagIds.push(tagId)
      }

      // Create source-tag relations
      if (tagIds.length > 0) {
        await db.insert(sourceTags).values(
          tagIds.map((tagId) => ({
            sourceId: newSource.id,
            tagId,
          }))
        )
      }
    }
  }

  revalidatePath(`/projects/${projectId}/sources`)
  return { count: createdSources.length }
}

