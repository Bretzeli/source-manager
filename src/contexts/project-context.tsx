"use client"

import { createContext, useContext, useMemo, useState } from "react"

type ProjectContextValue = {
  projectId?: string
  projectName?: string
  setCurrentProject: (projectId?: string, projectName?: string) => void
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projectId, setProjectId] = useState<string | undefined>(undefined)
  const [projectName, setProjectName] = useState<string | undefined>(undefined)

  const value = useMemo<ProjectContextValue>(() => ({
    projectId,
    projectName,
    setCurrentProject: (nextProjectId?: string, nextProjectName?: string) => {
      setProjectId(nextProjectId)
      setProjectName(nextProjectName)
    },
  }), [projectId, projectName])

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

export function useProjectContext() {
  const context = useContext(ProjectContext)
  if (!context) {
    throw new Error("useProjectContext must be used within ProjectProvider")
  }
  return context
}
