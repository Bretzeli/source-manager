"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { projects } from "@/lib/db/app-schema"
import { eq, desc } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

export async function getProjects() {
  const session = await auth.api.getSession({ headers: await headers() })
  
  if (!session?.user) {
    return []
  }

  const userProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.ownerId, session.user.id))
    .orderBy(desc(projects.lastEditedAt))

  return userProjects
}

export async function getProject(projectId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  
  if (!session?.user) {
    return null
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project || project.ownerId !== session.user.id) {
    return null
  }

  return project
}

export async function createProject(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() })
  
  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  const title = formData.get("title") as string
  const description = formData.get("description") as string | null

  if (!title || title.trim().length === 0) {
    throw new Error("Title is required")
  }

  const [newProject] = await db
    .insert(projects)
    .values({
      ownerId: session.user.id,
      title: title.trim(),
      description: description?.trim() || null,
    })
    .returning()

  revalidatePath("/")
  return newProject
}

export async function deleteProject(projectId: string) {
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

  await db
    .delete(projects)
    .where(eq(projects.id, projectId))

  revalidatePath("/")
}

