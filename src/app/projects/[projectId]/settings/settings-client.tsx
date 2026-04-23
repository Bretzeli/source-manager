"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "@/lib/i18n"
import { GithubRepoSettings } from "@/components/github-repo-settings"
import { ProjectNavbarSync } from "@/components/project-navbar-sync"
import { updateProjectData } from "@/app/actions/projects"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface SettingsPageClientProps {
  projectId: string
  projectTitle: string
  projectDescription: string | null
  currentRepoUrl?: string
  currentSelectedFiles?: string[]
  hasConnection: boolean
}

export function SettingsPageClient({
  projectId,
  projectTitle,
  projectDescription,
  currentRepoUrl,
  currentSelectedFiles,
  hasConnection,
}: SettingsPageClientProps) {
  const { t } = useTranslations()
  const [isSavingProject, startSavingProject] = useTransition()
  const [title, setTitle] = useState(projectTitle)
  const [description, setDescription] = useState(projectDescription ?? "")

  const hasProjectChanges = title !== projectTitle || description !== (projectDescription ?? "")

  const handleSaveProject = () => {
    startSavingProject(async () => {
      try {
        await updateProjectData(projectId, title, description)
        toast.success(t.home.projectUpdated)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t.errors.generic)
      }
    })
  }

  // Safety check to prevent errors during locale switching
  if (!t.settings) {
    return (
      <div className="container mx-auto px-4 py-8">
        <ProjectNavbarSync projectId={projectId} projectName={title} />
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Project settings for {projectTitle}
          </p>
        </div>
        <div className="flex items-center justify-center p-8">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <ProjectNavbarSync projectId={projectId} projectName={title} />
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">{t.settings.title}</h1>
        <p className="text-muted-foreground mt-1">
          {t.settings.projectSettings} {title}
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t.settings.projectDetails.title}</CardTitle>
          <CardDescription>{t.settings.projectDetails.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="settings-project-title">{t.home.projectTitle} *</Label>
            <Input
              id="settings-project-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.home.projectTitlePlaceholder}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-project-description">{t.home.projectDescription}</Label>
            <Textarea
              id="settings-project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.home.projectDescriptionPlaceholder}
              rows={4}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveProject} disabled={!hasProjectChanges || isSavingProject || !title.trim()}>
            {isSavingProject ? t.home.saving : t.home.save}
          </Button>
        </CardFooter>
      </Card>
      
      <GithubRepoSettings 
        projectId={projectId}
        currentRepoUrl={currentRepoUrl}
        currentSelectedFiles={currentSelectedFiles}
        hasConnection={hasConnection}
      />
    </div>
  )
}

