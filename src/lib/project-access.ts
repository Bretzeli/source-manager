import { headers } from "next/headers"
import { eq } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { projects } from "@/lib/db/app-schema"

export type ProjectAccess =
  | { status: "granted" }
  /** Nobody is signed in: signing in may grant access. */
  | { status: "signed-out" }
  /** Signed in, but the project belongs to someone else or doesn't exist (deliberately indistinguishable). */
  | { status: "forbidden"; userName: string }

/** Whether the current visitor may open a project. Server-only. */
export async function getProjectAccess(projectId: string): Promise<ProjectAccess> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { status: "signed-out" }

  const [project] = await db
    .select({ ownerId: projects.ownerId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (project && project.ownerId === session.user.id) return { status: "granted" }
  const { name, email } = session.user as { name?: unknown; email?: unknown }
  const userName = (typeof name === "string" && name.trim()) || (typeof email === "string" ? email : "")
  return { status: "forbidden", userName }
}
