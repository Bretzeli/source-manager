"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSession } from "@/lib/auth-client"
import { useAuthModal } from "@/contexts/auth-modal-context"
import { useTranslations } from "@/lib/i18n"
import { getProjects, createProject } from "@/app/actions/projects"
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
import { Plus, FolderOpen, MoreVertical, Trash2 } from "lucide-react"
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
import { deleteProject } from "@/app/actions/projects"

export default function Home() {
  const { data: session, isPending: sessionPending } = useSession()
  const { openModal } = useAuthModal()
  const { t } = useTranslations()
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
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">{t.home.title}</h1>
        <p className="text-muted-foreground mt-1">
          {projects.length === 0
            ? t.home.noProjects
            : `${projects.length} ${projects.length === 1 ? t.home.projectCount : t.home.projectCountPlural}`}
        </p>
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
                      <CardDescription className="line-clamp-3 text-sm font-medium text-foreground/80">
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
    </div>
  )
}
