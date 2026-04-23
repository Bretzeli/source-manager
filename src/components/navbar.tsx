"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { Moon, Sun, User, LogOut, LogIn, Settings, Menu, Palette, Check, Pin, PinOff, RotateCcw } from "lucide-react"
import { avatarImageProps } from "@/lib/external-avatar-url"
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { useTranslations, type Locale } from "@/lib/i18n"
import { useSession, signOut } from "@/lib/auth-client"
import { useAuthModal } from "@/contexts/auth-modal-context"
import { getProject } from "@/app/actions/projects"
import { useEffect, useMemo, useRef, useState } from "react"
import { useProjectContext } from "@/contexts/project-context"
import { useActiveTheme } from "@/components/active-theme-provider"
import { appThemes } from "@/lib/theme-config"

interface NavbarProps {
  projectId?: string
  projectName?: string
}

export function Navbar({ projectId, projectName }: NavbarProps) {
  const pathname = usePathname()
  const { theme, resolvedTheme, setTheme } = useTheme()
  const { t, locale, setLocale } = useTranslations()
  const {
    activeTheme,
    setActiveTheme,
    themeRadius,
    setThemeRadius,
    resetThemeRadius,
    isRadiusPinned,
    setIsRadiusPinned,
    themeFontSans,
    setThemeFontSans,
    resetThemeFontSans,
    isFontPinned,
    setIsFontPinned,
    availableThemeFonts,
    availableThemeRadii,
  } = useActiveTheme()
  const { data: session } = useSession()
  const { openModal } = useAuthModal()
  const { projectId: contextProjectId, projectName: contextProjectName } = useProjectContext()
  const [mounted, setMounted] = useState(false)
  const [showCompactProjectNav, setShowCompactProjectNav] = useState(false)
  const [fontSearch, setFontSearch] = useState("")
  const [isFontSelectOpen, setIsFontSelectOpen] = useState(false)
  const navContentRef = useRef<HTMLDivElement | null>(null)
  const leftSectionRef = useRef<HTMLDivElement | null>(null)
  const centerNavRef = useRef<HTMLDivElement | null>(null)
  const rightSectionRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Extract project ID from pathname if not provided
  const pathProjectId = pathname?.match(/\/projects\/([^\/]+)/)?.[1]
  const currentProjectId = projectId || contextProjectId || pathProjectId
  const [fetchedProjectName, setFetchedProjectName] = useState<string | undefined>(projectName)

  // Fetch project name if we have a project ID but no name
  useEffect(() => {
    if (projectName) {
      setFetchedProjectName(projectName)
      return
    }
    if (contextProjectId === currentProjectId && contextProjectName) {
      setFetchedProjectName(contextProjectName)
      return
    }
    if (currentProjectId && session?.user) {
      getProject(currentProjectId).then((project) => {
        if (project) {
          setFetchedProjectName(project.title)
        }
      })
    } else if (!currentProjectId) {
      setFetchedProjectName(undefined)
    }
  }, [currentProjectId, projectName, session?.user, contextProjectId, contextProjectName])

  const currentProjectName = projectName || (contextProjectId === currentProjectId ? contextProjectName : undefined) || fetchedProjectName
  const isProjectPage = currentProjectId !== undefined
  const isAuthenticated = !!session?.user
  const projectNavItems = currentProjectId
    ? [
        { href: `/projects/${currentProjectId}/sources`, label: t.nav.sources },
        { href: `/projects/${currentProjectId}/citations`, label: t.nav.citations },
        { href: `/projects/${currentProjectId}/settings`, label: t.nav.settings },
      ]
    : []

  const getFontLabel = (fontValue: string) => {
    return fontValue.split(",")[0]?.replace(/^["']|["']$/g, "") || fontValue
  }

  const fontOptions = (() => {
    const optionsByKey = new Map<string, { key: string; label: string; value: string }>()

    availableThemeFonts.forEach((fontStack) => {
      const label = getFontLabel(fontStack)
      const key = label.toLowerCase()
      if (!optionsByKey.has(key)) {
        optionsByKey.set(key, { key, label, value: fontStack })
      }
    })

    const currentLabel = getFontLabel(themeFontSans)
    const currentKey = currentLabel.toLowerCase()
    if (themeFontSans.trim()) {
      optionsByKey.set(currentKey, {
        key: currentKey,
        label: currentLabel,
        value: themeFontSans,
      })
    }

    return Array.from(optionsByKey.values()).sort((a, b) =>
      a.label.localeCompare(b.label),
    )
  })()

  const filteredFontOptions = useMemo(() => {
    const search = fontSearch.trim().toLowerCase()
    if (!search) return fontOptions
    return fontOptions.filter((fontOption) =>
      fontOption.label.toLowerCase().includes(search),
    )
  }, [fontOptions, fontSearch])

  const selectedFontOptionKey = getFontLabel(themeFontSans).toLowerCase()

  const radiusSliderValues = useMemo(() => {
    return Array.from(
      new Set(
        availableThemeRadii
          .map((radiusValue) => Number.parseFloat(radiusValue))
          .filter((radiusValue) => Number.isFinite(radiusValue)),
      ),
    ).sort((a, b) => a - b)
  }, [availableThemeRadii])

  const currentRadiusValue = useMemo(() => {
    const parsed = Number.parseFloat(themeRadius)
    if (Number.isFinite(parsed)) return parsed
    return radiusSliderValues[0] ?? 0.5
  }, [themeRadius, radiusSliderValues])

  const formatRadiusValue = (radiusValue: number) => {
    return `${Number.parseFloat(radiusValue.toFixed(3))}rem`
  }

  useEffect(() => {
    if (!isProjectPage || !currentProjectId) {
      setShowCompactProjectNav(false)
      return
    }

    const updateNavMode = () => {
      const navContent = navContentRef.current
      const leftSection = leftSectionRef.current
      const centerNav = centerNavRef.current
      const rightSection = rightSectionRef.current
      if (!navContent || !leftSection || !centerNav || !rightSection) return

      const navRect = navContent.getBoundingClientRect()
      const leftRect = leftSection.getBoundingClientRect()
      const centerRect = centerNav.getBoundingClientRect()
      const rightRect = rightSection.getBoundingClientRect()

      // Keep a small buffer so controls never visually touch each other.
      const spacingBuffer = 12
      const projectedCenterLeft = navRect.width / 2 - centerRect.width / 2
      const projectedCenterRight = navRect.width / 2 + centerRect.width / 2
      const leftOccupied = leftRect.right - navRect.left
      const rightOccupiedStart = rightRect.left - navRect.left
      const shouldUseCompact =
        projectedCenterLeft < leftOccupied + spacingBuffer ||
        projectedCenterRight > rightOccupiedStart - spacingBuffer

      setShowCompactProjectNav(shouldUseCompact)
    }

    updateNavMode()

    const observer = new ResizeObserver(updateNavMode)
    if (navContentRef.current) observer.observe(navContentRef.current)
    if (leftSectionRef.current) observer.observe(leftSectionRef.current)
    if (centerNavRef.current) observer.observe(centerNavRef.current)
    if (rightSectionRef.current) observer.observe(rightSectionRef.current)
    window.addEventListener("resize", updateNavMode)

    return () => {
      observer.disconnect()
      window.removeEventListener("resize", updateNavMode)
    }
  }, [isProjectPage, currentProjectId, currentProjectName, pathname, projectNavItems])

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
        <div ref={navContentRef} className="flex h-full items-center justify-between relative w-full">
          {/* Left side - App Name and Breadcrumb */}
          <div ref={leftSectionRef} className="flex min-w-0 items-center gap-4">
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

            {/* Compact Project Navigation */}
            {isProjectPage && currentProjectId && showCompactProjectNav && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Open project navigation">
                    <Menu className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {projectNavItems.map((item) => {
                    const isActive = pathname?.startsWith(item.href)
                    return (
                      <DropdownMenuItem key={item.href} asChild>
                        <Link href={item.href} className={isActive ? "font-medium" : ""}>
                          {item.label}
                        </Link>
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Center - Project Options (absolutely positioned) */}
          {isProjectPage && currentProjectId && (
            <div
              ref={centerNavRef}
              className={`absolute left-1/2 -translate-x-1/2 items-center gap-2 ${
                showCompactProjectNav ? "invisible pointer-events-none flex" : "flex"
              }`}
            >
              {projectNavItems.map((item) => {
                const isActive = pathname?.startsWith(item.href)
                return (
                  <Button key={item.href} variant={isActive ? "secondary" : "ghost"} size="sm" asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </Button>
                )
              })}
            </div>
          )}

          {/* Right side controls */}
          <div ref={rightSectionRef} className="flex items-center gap-2">
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
                  <AvatarImage {...avatarImageProps(session?.user?.image ?? null)} />
                  <AvatarFallback>
                    {getInitials(session?.user?.name, session?.user?.email)}
                  </AvatarFallback>
                </Avatar>
                <span className="sr-only">Open user menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
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
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Palette className="mr-2 h-4 w-4" />
                      {t.nav.themes}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-[min(70vh,32rem)] w-64 overflow-y-auto p-2">
                      {[...appThemes]
                        .sort((a, b) => {
                          if (a.id === "default") return -1
                          if (b.id === "default") return 1
                          return a.label.localeCompare(b.label)
                        })
                        .map((themeOption) => {
                        const isSelected = activeTheme === themeOption.id
                        const isDefaultThemeOption = themeOption.id === "default"
                        const themeOptionClassName = isDefaultThemeOption
                          ? "mb-1 rounded-lg border border-zinc-300 bg-zinc-50 p-0 text-zinc-900 shadow-sm last:mb-0 focus:bg-transparent focus:text-current data-[highlighted]:bg-transparent data-[highlighted]:text-current dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                          : `theme-${themeOption.id} mb-1 rounded-lg border border-border bg-card p-0 text-card-foreground shadow-sm last:mb-0 focus:bg-transparent focus:text-current data-[highlighted]:bg-transparent data-[highlighted]:text-current`
                        const swatchBackground = isDefaultThemeOption
                          ? resolvedTheme === "dark"
                            ? "linear-gradient(to right, oklch(0.922 0 0) 0 50%, oklch(0.269 0 0) 50% 100%)"
                            : "linear-gradient(to right, oklch(0.205 0 0) 0 50%, oklch(0.97 0 0) 50% 100%)"
                          : "linear-gradient(to right, var(--primary) 0 50%, var(--accent) 50% 100%)"
                        return (
                          <DropdownMenuItem
                            key={themeOption.id}
                            className={themeOptionClassName}
                            onSelect={(event) => {
                              event.preventDefault()
                              setActiveTheme(themeOption.id)
                            }}
                          >
                            <span
                              className="flex w-full items-center gap-2 rounded-[inherit] border border-transparent px-3 py-2 font-sans text-sm transition-colors data-[highlighted]:border-border data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                              style={
                                isDefaultThemeOption
                                  ? { fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif" }
                                  : undefined
                              }
                            >
                              <span
                                className="h-3.5 w-3.5 shrink-0 rounded-full"
                                style={{
                                  background: swatchBackground,
                                }}
                                aria-hidden="true"
                              />
                              <span className="truncate">{themeOption.label}</span>
                              <Check
                                className={`ml-auto h-4 w-4 shrink-0 ${
                                  isSelected ? "opacity-100" : "opacity-0"
                                }`}
                              />
                            </span>
                          </DropdownMenuItem>
                        )
                      })}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <div className="space-y-1.5 px-2 pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Radius
                      </p>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(event) => {
                            event.preventDefault()
                            resetThemeRadius()
                          }}
                          aria-label="Reset radius to theme default"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(event) => {
                            event.preventDefault()
                            setIsRadiusPinned(!isRadiusPinned)
                          }}
                          aria-label={isRadiusPinned ? "Unpin radius from theme" : "Pin radius to keep it while switching themes"}
                        >
                          {isRadiusPinned ? (
                            <Pin className="h-3.5 w-3.5" />
                          ) : (
                            <PinOff className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="rounded-md border px-3 py-2">
                      <div className="mb-2 text-xs text-muted-foreground">{formatRadiusValue(currentRadiusValue)}</div>
                      <Slider
                        value={[currentRadiusValue]}
                        min={radiusSliderValues[0] ?? 0.35}
                        max={radiusSliderValues[radiusSliderValues.length - 1] ?? 2}
                        step={0.025}
                        onValueChange={(value) => {
                          const radiusValue = value[0]
                          if (!Number.isFinite(radiusValue)) return
                          setThemeRadius(formatRadiusValue(radiusValue))
                        }}
                      />
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <div className="space-y-1.5 px-2 pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Font
                      </p>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(event) => {
                            event.preventDefault()
                            resetThemeFontSans()
                            setFontSearch("")
                          }}
                          aria-label="Reset font to theme default"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(event) => {
                            event.preventDefault()
                            setIsFontPinned(!isFontPinned)
                          }}
                          aria-label={isFontPinned ? "Unpin font from theme" : "Pin font to keep it while switching themes"}
                        >
                          {isFontPinned ? (
                            <Pin className="h-3.5 w-3.5" />
                          ) : (
                            <PinOff className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <Select
                      value={selectedFontOptionKey}
                      onValueChange={(selectedKey) => {
                        const selectedOption = fontOptions.find(
                          (fontOption) => fontOption.key === selectedKey,
                        )
                        if (!selectedOption) return
                        setThemeFontSans(selectedOption.value)
                      }}
                      open={isFontSelectOpen}
                      onOpenChange={(open) => {
                        setIsFontSelectOpen(open)
                        if (!open) {
                          setFontSearch("")
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 w-full">
                        <SelectValue placeholder={getFontLabel(themeFontSans)} />
                      </SelectTrigger>
                      <SelectContent
                        className="max-h-72"
                        position="popper"
                        side="bottom"
                        align="start"
                        sideOffset={6}
                        avoidCollisions={false}
                      >
                        <div className="sticky top-0 z-10 bg-popover p-2 pb-1">
                          <Input
                            value={fontSearch}
                            onChange={(event) => setFontSearch(event.target.value)}
                            onKeyDown={(event) => event.stopPropagation()}
                            placeholder="Search fonts..."
                            className="h-8 text-xs"
                            autoFocus
                          />
                        </div>
                        {filteredFontOptions.map((fontOption) => (
                          <SelectItem
                            key={fontOption.key}
                            value={fontOption.key}
                            style={{ fontFamily: fontOption.value }}
                          >
                            {fontOption.label}
                          </SelectItem>
                        ))}
                        {filteredFontOptions.length === 0 && (
                          <div className="px-2 py-2 text-xs text-muted-foreground">
                            No fonts found.
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
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

