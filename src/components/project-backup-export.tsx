"use client"

import { useState, useTransition } from "react"
import { Download } from "lucide-react"
import { toast } from "sonner"
import { exportProjectBackup } from "@/app/actions/project-backup"
import { useTranslations } from "@/lib/i18n"
import type { ProjectBackup } from "@/lib/project-backup"
import { sanitizeFilename } from "@/lib/sources-utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"

function downloadBackup(backup: ProjectBackup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${sanitizeFilename(backup.project.title)}_backup_${backup.exportedAt.slice(0, 10)}.json`
  link.style.display = "none"
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Give the browser a moment to start the download before releasing the blob.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

interface ProjectBackupExportProps {
  projectId: string
  hasGithubRepo: boolean
}

export function ProjectBackupExport({ projectId, hasGithubRepo }: ProjectBackupExportProps) {
  const { t } = useTranslations()
  const tb = t.settings.backup
  const [includeGithub, setIncludeGithub] = useState(false)
  const [isExporting, startExport] = useTransition()

  const handleExport = () => {
    startExport(async () => {
      try {
        const backup = await exportProjectBackup(projectId, { includeGithub: includeGithub && hasGithubRepo })
        downloadBackup(backup)
        toast.success(tb.exported)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t.errors.generic)
      }
    })
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>{tb.title}</CardTitle>
        <CardDescription>{tb.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-start justify-between gap-6">
          <Label htmlFor="backup-include-github" className="flex flex-col items-start gap-1 leading-snug">
            <span>{tb.includeGithub}</span>
            <span className="text-muted-foreground text-xs font-normal">
              {hasGithubRepo ? tb.includeGithubHint : tb.noGithubRepo}
            </span>
          </Label>
          <Switch
            id="backup-include-github"
            checked={includeGithub && hasGithubRepo}
            disabled={!hasGithubRepo || isExporting}
            onCheckedChange={setIncludeGithub}
            className="mt-0.5"
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleExport} disabled={isExporting}>
          {isExporting ? <Spinner className="mr-2 h-4 w-4" /> : <Download className="mr-2 h-4 w-4" />}
          {isExporting ? tb.exporting : tb.export}
        </Button>
      </CardFooter>
    </Card>
  )
}
