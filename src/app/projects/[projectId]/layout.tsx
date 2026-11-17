import { ProjectAccessDenied } from "@/components/project-access-denied"
import { getProjectAccess } from "@/lib/project-access"

/**
 * Guards every project page. Visitors without access (e.g. someone following the link in an
 * exported PDF) get an explanation instead of an empty project. The page stays at the project's
 * URL, so signing in from here leads straight into the project.
 */
export default async function ProjectLayout({ children, params }: LayoutProps<"/projects/[projectId]">) {
  const { projectId } = await params
  const access = await getProjectAccess(projectId)

  if (access.status === "signed-out") return <ProjectAccessDenied status="signed-out" />
  if (access.status === "forbidden") return <ProjectAccessDenied status="forbidden" userName={access.userName} />
  return children
}
