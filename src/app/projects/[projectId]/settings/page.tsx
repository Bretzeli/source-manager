import { getProjects } from "@/app/actions/projects"
import { notFound } from "next/navigation"

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const projects = await getProjects()
  const project = projects.find((p) => p.id === projectId)

  if (!project) {
    notFound()
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Project settings for {project.title}
        </p>
      </div>
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Settings page coming soon...</p>
      </div>
    </div>
  )
}

