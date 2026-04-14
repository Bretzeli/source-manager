"use client"

import { useEffect } from "react"
import { useProjectContext } from "@/contexts/project-context"

interface ProjectNavbarSyncProps {
  projectId?: string
  projectName?: string
}

export function ProjectNavbarSync({ projectId, projectName }: ProjectNavbarSyncProps) {
  const { setCurrentProject } = useProjectContext()

  useEffect(() => {
    setCurrentProject(projectId, projectName)
    return () => setCurrentProject(undefined, undefined)
  }, [projectId, projectName, setCurrentProject])

  return null
}
