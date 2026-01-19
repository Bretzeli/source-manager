"use client"

import { useTranslations } from "@/lib/i18n"
import { GithubRepoSettings } from "@/components/github-repo-settings"

interface SettingsPageClientProps {
  projectId: string
  projectTitle: string
  currentRepoUrl?: string
  currentSelectedFiles?: string[]
  hasConnection: boolean
}

export function SettingsPageClient({
  projectId,
  projectTitle,
  currentRepoUrl,
  currentSelectedFiles,
  hasConnection,
}: SettingsPageClientProps) {
  const { t } = useTranslations()

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">{t.settings.title}</h1>
        <p className="text-muted-foreground mt-1">
          {t.settings.projectSettings} {projectTitle}
        </p>
      </div>
      
      <GithubRepoSettings 
        projectId={projectId}
        currentRepoUrl={currentRepoUrl}
        currentSelectedFiles={currentSelectedFiles}
        hasConnection={hasConnection}
      />
    </div>
  )
}

