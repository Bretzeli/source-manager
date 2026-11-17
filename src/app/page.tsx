"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "@/lib/auth-client"
import { useAuthModal } from "@/contexts/auth-modal-context"
import { useTranslations } from "@/lib/i18n"
import { getProjects, createProject } from "@/app/actions/projects"
import { importProjectBackup } from "@/lib/project-backup-import"
import { parseProjectBackup, uniqueProjectTitle, type ProjectBackup } from "@/lib/project-backup"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Plus, FolderOpen, MoreVertical, Trash2, Pencil, Upload } from "lucide-react"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { deleteProject, updateProjectData } from "@/app/actions/projects"

export default function Home() {
  const { data: session, isPending: sessionPending } = useSession()
  const { openModal } = useAuthModal()
  const { t, locale } = useTranslations()
  const router = useRouter()
  const [projects, setProjects] = useState<Array<{
    id: string
    title: string
    description: string | null
    createdAt: Date
    lastEditedAt: Date
  }>>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<{
    id: string
    title: string
    description: string
  } | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const backupFileInputRef = useRef<HTMLInputElement>(null)
  const [pendingBackup, setPendingBackup] = useState<ProjectBackup | null>(null)
  const [importing, setImporting] = useState(false)

  const loadProjects = async () => {
    try {
      setLoading(true)
      const data = await getProjects()
      setProjects(data)
    } catch (error) {
      toast.error(t.errors.generic)
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!sessionPending) {
      if (session?.user) {
        loadProjects()
      } else {
        setLoading(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, sessionPending])

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    if (params.get("signIn") !== "1") return
    openModal("login", false)
    params.delete("signIn")
    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`
    window.history.replaceState({}, "", next)
  }, [openModal])

  useEffect(() => {
    if (!importing) return
    // An import runs in several requests; leaving midway would leave a partly imported project.
    const warnBeforeLeaving = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warnBeforeLeaving)
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving)
  }, [importing])

  const handleCreateProject = async (formData: FormData) => {
    try {
      setCreating(true)
      const project = await createProject(formData)
      toast.success(t.home.projectCreated)
      setCreateDialogOpen(false)
      await loadProjects()
      // Navigate to the new project
      window.location.href = `/projects/${project.id}/sources`
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.errors.generic)
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteClick = (projectId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setProjectToDelete(projectId)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return
    
    try {
      setDeleting(true)
      await deleteProject(projectToDelete)
      toast.success(t.home.projectDeleted)
      setDeleteDialogOpen(false)
      setProjectToDelete(null)
      await loadProjects()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.errors.generic)
    } finally {
      setDeleting(false)
    }
  }

  const handleEditClick = (
    project: { id: string; title: string; description: string | null },
    e: React.MouseEvent
  ) => {
    e.preventDefault()
    e.stopPropagation()
    setEditingProject({
      id: project.id,
      title: project.title,
      description: project.description ?? "",
    })
    setEditDialogOpen(true)
  }

  const handleUpdateProject = async (formData: FormData) => {
    if (!editingProject) return

    try {
      setSavingEdit(true)
      const title = String(formData.get("title") ?? "")
      const description = String(formData.get("description") ?? "")
      await updateProjectData(editingProject.id, title, description)
      await loadProjects()
      setEditDialogOpen(false)
      setEditingProject(null)
      toast.success(t.home.projectUpdated)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.errors.generic)
    } finally {
      setSavingEdit(false)
    }
  }

  const handleBackupFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Reset so picking the same file again still triggers a change.
    e.target.value = ""
    if (!file) return

    let text: string
    try {
      text = await file.text()
    } catch (error) {
      console.error(error)
      toast.error(t.errors.generic)
      return
    }

    const result = parseProjectBackup(text)
    if (!result.ok) {
      toast.error(t.home.backupImport.errors[result.error])
      return
    }
    setPendingBackup(result.backup)
  }

  const handleImportConfirm = async () => {
    if (!pendingBackup) return

    try {
      setImporting(true)
      const project = await importProjectBackup(pendingBackup)
      toast.success(t.home.backupImport.imported.replace("{title}", project.title))
      setPendingBackup(null)
      router.push(`/projects/${project.id}/sources`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.errors.generic)
    } finally {
      setImporting(false)
    }
  }

  const importTitle = pendingBackup
    ? uniqueProjectTitle(pendingBackup.project.title, projects.map((project) => project.title))
    : null

  if (sessionPending || loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] text-center">
          <div className="max-w-md space-y-4">
            <h1 className="text-3xl font-semibold tracking-tight">
              {t.home.loginPrompt}
            </h1>
            <p className="text-muted-foreground">
              {t.home.loginPrompt}
            </p>
            <Button onClick={() => openModal("login", false)} size="lg" className="mt-4">
              {t.nav.logIn}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t.home.title}</h1>
          <p className="text-muted-foreground mt-1">
            {projects.length === 0
              ? t.home.noProjects
              : `${projects.length} ${projects.length === 1 ? t.home.projectCount : t.home.projectCountPlural}`}
          </p>
        </div>
        <Button variant="outline" onClick={() => backupFileInputRef.current?.click()}>
          <Upload className="mr-2 h-4 w-4" />
          {t.home.backupImport.button}
        </Button>
        <input
          ref={backupFileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleBackupFileChange}
        />
      </div>
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <FolderOpen className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-semibold mb-2">No projects yet</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            {t.home.noProjects}
          </p>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t.home.createProject}
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Create New Project Card */}
            <Card 
              className="h-full transition-all hover:shadow-md hover:border-primary/50 cursor-pointer border-dashed flex items-center justify-center"
              onClick={() => setCreateDialogOpen(true)}
            >
              <CardHeader className="w-full">
                <div className="flex flex-col items-center justify-center gap-3 text-center">
                  <div className="rounded-full bg-primary/10 p-3">
                    <Plus className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-base">
                    {t.home.createCard}
                  </CardTitle>
                </div>
              </CardHeader>
            </Card>
            
            {projects.map((project) => (
              <Card 
                key={project.id} 
                className="h-full transition-all hover:shadow-md hover:border-primary/50 relative group"
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <Link 
                      href={`/projects/${project.id}/sources`} 
                      className="flex-1 cursor-pointer"
                    >
                      <CardTitle className="line-clamp-2">{project.title}</CardTitle>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                          }}
                        >
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Project options</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={(e) => handleEditClick(project, e)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          {t.home.edit}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => handleDeleteClick(project.id, e)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t.home.delete}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {project.description && (
                    <Link 
                      href={`/projects/${project.id}/sources`} 
                      className="cursor-pointer"
                    >
                      <CardDescription className="max-h-24 overflow-y-auto whitespace-pre-wrap text-sm font-medium text-foreground/80 pr-1">
                        {project.description}
                      </CardDescription>
                    </Link>
                  )}
                </CardHeader>
                <CardContent>
                  <Link 
                    href={`/projects/${project.id}/sources`} 
                    className="cursor-pointer block"
                  >
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div>
                        {t.home.lastEdited}: {new Date(project.lastEditedAt).toLocaleDateString()}
                      </div>
                      <div>
                        {t.home.created}: {new Date(project.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t.home.deleteProject}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t.home.deleteConfirm}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>{t.home.cancel}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      {t.home.deleting}
                    </>
                  ) : (
                    t.home.delete
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
      
      {/* Create Project Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <form action={handleCreateProject}>
            <DialogHeader>
              <DialogTitle>{t.home.createDialogTitle}</DialogTitle>
              <DialogDescription>
                {t.home.createDialogDescription}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">{t.home.projectTitle} *</Label>
                <Input
                  id="title"
                  name="title"
                  placeholder={t.home.projectTitlePlaceholder}
                  required
                  autoFocus
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">{t.home.projectDescription}</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder={t.home.projectDescriptionPlaceholder}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                disabled={creating}
              >
                {t.home.cancel}
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    {t.home.creating}
                  </>
                ) : (
                  t.home.createProject
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open)
          if (!open) setEditingProject(null)
        }}
      >
        <DialogContent>
          <form action={handleUpdateProject}>
            <DialogHeader>
              <DialogTitle>{t.home.editDialogTitle}</DialogTitle>
              <DialogDescription>{t.home.editDialogDescription}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-title">{t.home.projectTitle} *</Label>
                <Input
                  id="edit-title"
                  name="title"
                  placeholder={t.home.projectTitlePlaceholder}
                  defaultValue={editingProject?.title ?? ""}
                  required
                  autoFocus
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-description">{t.home.projectDescription}</Label>
                <Textarea
                  id="edit-description"
                  name="description"
                  placeholder={t.home.projectDescriptionPlaceholder}
                  defaultValue={editingProject?.description ?? ""}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditDialogOpen(false)
                  setEditingProject(null)
                }}
                disabled={savingEdit}
              >
                {t.home.cancel}
              </Button>
              <Button type="submit" disabled={savingEdit}>
                {savingEdit ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    {t.home.saving}
                  </>
                ) : (
                  t.home.save
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingBackup !== null}
        onOpenChange={(open) => {
          if (!open && !importing) setPendingBackup(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.home.backupImport.dialogTitle}</DialogTitle>
            <DialogDescription>{t.home.backupImport.dialogDescription}</DialogDescription>
          </DialogHeader>
          {pendingBackup && (
            <div className="grid gap-4 py-2">
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                <dt className="text-muted-foreground">{t.home.backupImport.projectName}</dt>
                <dd className="font-medium break-words">{pendingBackup.project.title}</dd>
                <dt className="text-muted-foreground">{t.home.backupImport.description}</dt>
                <dd className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words">
                  {pendingBackup.project.description || (
                    <span className="text-muted-foreground italic">{t.home.backupImport.noDescription}</span>
                  )}
                </dd>
                <dt className="text-muted-foreground">{t.home.backupImport.backupCreated}</dt>
                <dd>{new Date(pendingBackup.exportedAt).toLocaleString(locale)}</dd>
                <dt className="text-muted-foreground">{t.home.backupImport.sources}</dt>
                <dd>{pendingBackup.sources.length}</dd>
                <dt className="text-muted-foreground">{t.home.backupImport.tags}</dt>
                <dd>{pendingBackup.tags.length}</dd>
                {pendingBackup.project.github && (
                  <>
                    <dt className="text-muted-foreground">{t.home.backupImport.githubRepo}</dt>
                    <dd className="break-all">{pendingBackup.project.github.repoUrl}</dd>
                  </>
                )}
              </dl>
              {importTitle !== pendingBackup.project.title && (
                <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
                  {t.home.backupImport.renamed.replace("{title}", importTitle ?? "")}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingBackup(null)} disabled={importing}>
              {t.home.cancel}
            </Button>
            <Button type="button" onClick={handleImportConfirm} disabled={importing}>
              {importing ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  {t.home.backupImport.importing}
                </>
              ) : (
                t.home.backupImport.confirm
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
