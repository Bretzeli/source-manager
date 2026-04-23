"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  ACTIVE_THEME_COOKIE,
  ACTIVE_THEME_STORAGE_KEY,
  appThemes,
  DEFAULT_ACTIVE_THEME,
  type AppThemeId,
} from "@/lib/theme-config"

type ActiveThemeContextValue = {
  activeTheme: AppThemeId
  setActiveTheme: (theme: AppThemeId) => void
}

const ActiveThemeContext = createContext<ActiveThemeContextValue | undefined>(
  undefined,
)

function isValidTheme(theme: string | null | undefined): theme is AppThemeId {
  if (!theme) return false
  return appThemes.some((item) => item.id === theme)
}

function setThemeCookie(theme: AppThemeId) {
  document.cookie = `${ACTIVE_THEME_COOKIE}=${theme}; path=/; max-age=31536000; SameSite=Lax`
}

function applyThemeClass(theme: AppThemeId) {
  const targets = [document.documentElement, document.body]
  targets.forEach((target) => {
    const themeClasses = Array.from(target.classList).filter((className) =>
      className.startsWith("theme-"),
    )
    themeClasses.forEach((className) => target.classList.remove(className))
    target.classList.add(`theme-${theme}`)
  })
}

export function ActiveThemeProvider({
  children,
  initialTheme,
}: {
  children: ReactNode
  initialTheme?: string
}) {
  const [activeTheme, setActiveThemeState] = useState<AppThemeId>(() => {
    if (isValidTheme(initialTheme)) return initialTheme
    if (typeof window === "undefined") return DEFAULT_ACTIVE_THEME
    const storedTheme = localStorage.getItem(ACTIVE_THEME_STORAGE_KEY)
    if (isValidTheme(storedTheme)) return storedTheme
    return DEFAULT_ACTIVE_THEME
  })

  const setActiveTheme = useCallback((theme: AppThemeId) => {
    setActiveThemeState(theme)
  }, [])

  useEffect(() => {
    applyThemeClass(activeTheme)
    localStorage.setItem(ACTIVE_THEME_STORAGE_KEY, activeTheme)
    setThemeCookie(activeTheme)
  }, [activeTheme])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== ACTIVE_THEME_STORAGE_KEY) return
      if (!isValidTheme(event.newValue)) return
      setActiveThemeState(event.newValue)
    }

    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const value = useMemo(
    () => ({
      activeTheme,
      setActiveTheme,
    }),
    [activeTheme, setActiveTheme],
  )

  return (
    <ActiveThemeContext.Provider value={value}>
      {children}
    </ActiveThemeContext.Provider>
  )
}

export function useActiveTheme() {
  const context = useContext(ActiveThemeContext)
  if (!context) {
    throw new Error("useActiveTheme must be used within ActiveThemeProvider")
  }
  return context
}
