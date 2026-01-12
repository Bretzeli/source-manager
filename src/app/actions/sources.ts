"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { sources, topics, sourceTopics, projects } from "@/lib/db/app-schema"
import { eq, and, desc, asc, or, like, sql, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

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

  // Get topics for each source
  const sourcesWithTopics = await Promise.all(
    allSources.map(async (source) => {
      const sourceTopicRelations = await db
        .select({
          topicId: sourceTopics.topicId,
        })
        .from(sourceTopics)
        .where(eq(sourceTopics.sourceId, source.id))

      const topicIds = sourceTopicRelations.map((st) => st.topicId)
      
      let sourceTopicsData: Array<{
        id: string
        abbreviation: string
        name: string
        color: string
      }> = []

      if (topicIds.length > 0) {
        const topicsData = await db
          .select({
            id: topics.id,
            abbreviation: topics.abbreviation,
            name: topics.name,
            color: topics.color,
          })
          .from(topics)
          .where(inArray(topics.id, topicIds))

        sourceTopicsData = topicsData
      }

      return {
        ...source,
        topics: sourceTopicsData,
      }
    })
  )

  return sourcesWithTopics
}

export async function getTopics(projectId: string) {
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

  const allTopics = await db
    .select()
    .from(topics)
    .where(eq(topics.projectId, projectId))
    .orderBy(asc(topics.name))

  return allTopics
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
  topicIds?: string[]
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

  // Add topic relations if provided
  if (data.topicIds && data.topicIds.length > 0) {
    await db.insert(sourceTopics).values(
      data.topicIds.map((topicId) => ({
        sourceId: newSource.id,
        topicId,
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
    abbreviation?: string
    title?: string
    description?: string | null
    authors?: string | null
    publicationDate?: string | null
    notes?: string | null
    links?: string | null
    bibtex?: string | null
    topicIds?: string[]
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
  
  if (data.abbreviation !== undefined) updateData.abbreviation = data.abbreviation.trim()
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

  // Update topic relations if provided
  if (data.topicIds !== undefined) {
    // Delete existing relations
    await db
      .delete(sourceTopics)
      .where(eq(sourceTopics.sourceId, sourceId))

    // Insert new relations
    if (data.topicIds.length > 0) {
      await db.insert(sourceTopics).values(
        data.topicIds.map((topicId) => ({
          sourceId,
          topicId,
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

export async function createTopic(projectId: string, data: {
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

  const [newTopic] = await db
    .insert(topics)
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
  return newTopic
}

