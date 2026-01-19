import { getProject, hasGithubConnection } from "@/app/actions/projects"
import { notFound } from "next/navigation"
import { GithubRepoSettings } from "@/components/github-repo-settings"
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
      currentRepoUrl={project.githubRepoUrl || undefined}
      currentSelectedFiles={project.githubRepoFiles ? JSON.parse(project.githubRepoFiles) : undefined}
      hasConnection={hasConnection}
    />
  )
}
