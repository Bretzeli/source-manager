"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { Moon, Sun, User, LogOut, LogIn, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useTranslations, type Locale } from "@/lib/i18n"
import { useSession, signOut } from "@/lib/auth-client"
import { useAuthModal } from "@/contexts/auth-modal-context"
import { getProject } from "@/app/actions/projects"
import { useEffect, useState } from "react"

interface NavbarProps {
  projectId?: string
  projectName?: string
}

export function Navbar({ projectId, projectName }: NavbarProps) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const { t, locale, setLocale } = useTranslations()
  const { data: session } = useSession()
  const { openModal } = useAuthModal()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Extract project ID from pathname if not provided
  const pathProjectId = pathname?.match(/\/projects\/([^\/]+)/)?.[1]
  const currentProjectId = projectId || pathProjectId
  const [fetchedProjectName, setFetchedProjectName] = useState<string | undefined>(projectName)

  // Fetch project name if we have a project ID but no name
  useEffect(() => {
    if (currentProjectId && !projectName && session?.user) {
      getProject(currentProjectId).then((project) => {
        if (project) {
          setFetchedProjectName(project.title)
        }
      })
    } else if (!currentProjectId) {
      setFetchedProjectName(undefined)
    }
  }, [currentProjectId, projectName, session?.user])

  const currentProjectName = projectName || fetchedProjectName
  const isProjectPage = currentProjectId !== undefined
  const isAuthenticated = !!session?.user

  const handleSignOut = async () => {
    await signOut()
    window.location.href = "/"
  }

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    }
    if (email) {
      return email[0].toUpperCase()
    }
    return "U"
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto max-w-7xl flex h-16 items-center px-4">
        <div className="flex h-full items-center justify-between relative w-full">
          {/* Left side - App Name and Breadcrumb */}
          <div className="flex items-center gap-4">
            {/* App Name */}
            <Link
              href="/"
              className="flex items-center gap-2 font-semibold text-lg hover:opacity-80 transition-opacity"
            >
              {t.appName}
            </Link>

            {/* Separator when on project page */}
            {isProjectPage && (
              <div className="h-6 w-px bg-border" />
            )}

            {/* Breadcrumb */}
            {isProjectPage && currentProjectName && (
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link href="/" className="text-muted-foreground hover:text-foreground">
                        {t.nav.projects}
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="font-medium">{currentProjectName}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            )}
          </div>

          {/* Center - Project Options (absolutely positioned) */}
          {isProjectPage && currentProjectId && (
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/projects/${currentProjectId}/sources`}>
                  {t.nav.sources}
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/projects/${currentProjectId}/citations`}>
                  {t.nav.citations}
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/projects/${currentProjectId}/settings`}>
                  {t.nav.settings}
                </Link>
              </Button>
            </div>
          )}

          {/* Right side controls */}
          <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          )}

          {/* Language Selector */}
          <Select value={locale} onValueChange={(value) => setLocale(value as Locale)}>
            <SelectTrigger className="w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">EN</SelectItem>
              <SelectItem value="de">DE</SelectItem>
            </SelectContent>
          </Select>

          {/* Profile Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={session?.user?.image || undefined} />
                  <AvatarFallback>
                    {getInitials(session?.user?.name, session?.user?.email)}
                  </AvatarFallback>
                </Avatar>
                <span className="sr-only">Open user menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {isAuthenticated ? (
                <>
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {session.user.name || "User"}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {session.user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/account/settings" className="flex items-center">
                      <Settings className="mr-2 h-4 w-4" />
                      {t.nav.accountSettings}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    {t.nav.logOut}
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => openModal("login", false)}>
                    <LogIn className="mr-2 h-4 w-4" />
                    {t.nav.logIn}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openModal("signup", false)}>
                    <User className="mr-2 h-4 w-4" />
                    {t.nav.signIn}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        </div>
      </div>
    </nav>
  )
}

