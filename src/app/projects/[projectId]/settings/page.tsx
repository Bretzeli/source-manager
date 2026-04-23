import { getProject, hasGithubConnection } from "@/app/actions/projects"
import { notFound } from "next/navigation"
import { SettingsPageClient } from "./settings-client"

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const project = await getProject(projectId)

  if (!project) {
    notFound()
  }

  const hasConnection = await hasGithubConnection(projectId)

  return (
    <SettingsPageClient 
      projectId={projectId}
      projectTitle={project.title}
      projectDescription={project.description}
      currentRepoUrl={project.githubRepoUrl || undefined}
      currentSelectedFiles={project.githubRepoFiles ? JSON.parse(project.githubRepoFiles) : undefined}
      hasConnection={hasConnection}
    />
  )
}
