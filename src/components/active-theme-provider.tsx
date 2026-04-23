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
  ACTIVE_THEME_FONT_PINNED_STORAGE_KEY,
  ACTIVE_THEME_FONT_STORAGE_KEY,
  ACTIVE_THEME_RADIUS_PINNED_STORAGE_KEY,
  ACTIVE_THEME_RADIUS_STORAGE_KEY,
  ACTIVE_THEME_STORAGE_KEY,
  appThemes,
  DEFAULT_ACTIVE_THEME,
  type AppThemeId,
} from "@/lib/theme-config"

type ActiveThemeContextValue = {
  activeTheme: AppThemeId
  setActiveTheme: (theme: AppThemeId) => void
  themeRadius: string
  setThemeRadius: (radius: string) => void
  resetThemeRadius: () => void
  isRadiusPinned: boolean
  setIsRadiusPinned: (isPinned: boolean) => void
  themeFontSans: string
  setThemeFontSans: (font: string) => void
  resetThemeFontSans: () => void
  isFontPinned: boolean
  setIsFontPinned: (isPinned: boolean) => void
  availableThemeFonts: string[]
  availableThemeRadii: string[]
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

function readThemeDefaults(theme: AppThemeId) {
  const probe = document.createElement("div")
  probe.className = `theme-${theme}`
  probe.style.position = "absolute"
  probe.style.pointerEvents = "none"
  probe.style.opacity = "0"
  probe.style.height = "0"
  probe.style.overflow = "hidden"
  document.body.appendChild(probe)
  const computed = window.getComputedStyle(probe)
  const radius = computed.getPropertyValue("--radius").trim()
  const fontSans =
    computed.getPropertyValue("--theme-font-sans").trim() ||
    computed.getPropertyValue("--font-sans").trim()
  const fontSerif = computed.getPropertyValue("--font-serif").trim()
  const fontMono = computed.getPropertyValue("--font-mono").trim()
  document.body.removeChild(probe)

  return {
    radius,
    fontSans,
    fontSerif,
    fontMono,
  }
}

function applyThemeOverrides(radius: string, fontSans: string) {
  const targets = [document.documentElement, document.body]
  targets.forEach((target) => {
    target.style.setProperty("--radius", radius)
    target.style.setProperty("--theme-font-sans", fontSans)
    target.style.setProperty("--font-sans", fontSans)
  })
}

function clearThemeOverrides(options: { clearRadius?: boolean; clearFont?: boolean }) {
  const { clearRadius = false, clearFont = false } = options
  const targets = [document.documentElement, document.body]
  targets.forEach((target) => {
    if (clearRadius) {
      target.style.removeProperty("--radius")
    }
    if (clearFont) {
      target.style.removeProperty("--theme-font-sans")
      target.style.removeProperty("--font-sans")
    }
  })
}

function parseStoredBool(value: string | null): boolean {
  return value === "true"
}

function getPrimaryFontFamily(fontStack: string): string {
  const firstToken = fontStack.split(",")[0]?.trim() ?? fontStack.trim()
  return firstToken.replace(/^["']|["']$/g, "")
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

  const themeDefaults = useMemo(() => {
    if (typeof window === "undefined") {
      return {
        radius: "0.5rem",
        fontSans: "Inter, sans-serif",
        fontSerif: "serif",
        fontMono: "monospace",
      }
    }
    return readThemeDefaults(activeTheme)
  }, [activeTheme])

  const [themeRadius, setThemeRadiusState] = useState<string>(() => {
    if (typeof window === "undefined") return "0.5rem"
    return localStorage.getItem(ACTIVE_THEME_RADIUS_STORAGE_KEY)?.trim() || "0.5rem"
  })

  const [themeFontSans, setThemeFontSansState] = useState<string>(() => {
    if (typeof window === "undefined") return "Inter, sans-serif"
    return localStorage.getItem(ACTIVE_THEME_FONT_STORAGE_KEY)?.trim() || "Inter, sans-serif"
  })

  const [isRadiusPinned, setIsRadiusPinnedState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return parseStoredBool(localStorage.getItem(ACTIVE_THEME_RADIUS_PINNED_STORAGE_KEY))
  })

  const [isFontPinned, setIsFontPinnedState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return parseStoredBool(localStorage.getItem(ACTIVE_THEME_FONT_PINNED_STORAGE_KEY))
  })

  const setActiveTheme = useCallback(
    (theme: AppThemeId) => {
      setActiveThemeState(theme)
      if (typeof window === "undefined") return
      clearThemeOverrides({
        clearRadius: !isRadiusPinned,
        clearFont: !isFontPinned,
      })
      const defaults = readThemeDefaults(theme)
      if (!isRadiusPinned) {
        setThemeRadiusState(defaults.radius)
      }
      if (!isFontPinned) {
        setThemeFontSansState(defaults.fontSans)
      }
    },
    [isRadiusPinned, isFontPinned],
  )

  useEffect(() => {
    applyThemeClass(activeTheme)
    localStorage.setItem(ACTIVE_THEME_STORAGE_KEY, activeTheme)
    setThemeCookie(activeTheme)
  }, [activeTheme])

  useEffect(() => {
    applyThemeOverrides(themeRadius, themeFontSans)
    localStorage.setItem(ACTIVE_THEME_RADIUS_STORAGE_KEY, themeRadius)
    localStorage.setItem(ACTIVE_THEME_FONT_STORAGE_KEY, themeFontSans)
  }, [themeRadius, themeFontSans])

  useEffect(() => {
    localStorage.setItem(
      ACTIVE_THEME_RADIUS_PINNED_STORAGE_KEY,
      String(isRadiusPinned),
    )
  }, [isRadiusPinned])

  useEffect(() => {
    localStorage.setItem(
      ACTIVE_THEME_FONT_PINNED_STORAGE_KEY,
      String(isFontPinned),
    )
  }, [isFontPinned])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== ACTIVE_THEME_STORAGE_KEY) return
      if (!isValidTheme(event.newValue)) return
      setActiveThemeState(event.newValue)
    }

    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const setThemeRadius = useCallback((radius: string) => {
    setThemeRadiusState(radius)
  }, [])

  const resetThemeRadius = useCallback(() => {
    setThemeRadiusState(themeDefaults.radius)
  }, [themeDefaults.radius])

  const setThemeFontSans = useCallback((font: string) => {
    setThemeFontSansState(font)
  }, [])

  const resetThemeFontSans = useCallback(() => {
    setThemeFontSansState(themeDefaults.fontSans)
  }, [themeDefaults.fontSans])

  const setIsRadiusPinned = useCallback(
    (isPinned: boolean) => {
      setIsRadiusPinnedState(isPinned)
      if (!isPinned) {
        clearThemeOverrides({ clearRadius: true })
        setThemeRadiusState(readThemeDefaults(activeTheme).radius)
      }
    },
    [activeTheme],
  )

  const setIsFontPinned = useCallback(
    (isPinned: boolean) => {
      setIsFontPinnedState(isPinned)
      if (!isPinned) {
        clearThemeOverrides({ clearFont: true })
        setThemeFontSansState(readThemeDefaults(activeTheme).fontSans)
      }
    },
    [activeTheme],
  )

  const availableThemeFonts = useMemo(() => {
    if (typeof window === "undefined") return ["Inter, sans-serif"]
    const uniqueFontsByFamily = new Map<string, string>()
    appThemes.forEach((theme) => {
      const defaults = readThemeDefaults(theme.id)
      ;[defaults.fontSans, defaults.fontSerif, defaults.fontMono].forEach((fontStack) => {
        if (!fontStack) return
        const family = getPrimaryFontFamily(fontStack)
        const key = family.toLowerCase()
        if (!uniqueFontsByFamily.has(key)) {
          uniqueFontsByFamily.set(key, fontStack)
        }
      })
    })
    return Array.from(uniqueFontsByFamily.values()).sort((a, b) =>
      getPrimaryFontFamily(a).localeCompare(getPrimaryFontFamily(b)),
    )
  }, [])

  const availableThemeRadii = useMemo(() => {
    if (typeof window === "undefined") return ["0.5rem"]
    const uniqueRadii = new Set<string>()
    appThemes.forEach((theme) => {
      const defaults = readThemeDefaults(theme.id)
      if (defaults.radius) uniqueRadii.add(defaults.radius)
    })
    return Array.from(uniqueRadii).sort((a, b) => Number.parseFloat(a) - Number.parseFloat(b))
  }, [])

  const value = useMemo(
    () => ({
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
    }),
    [
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
    ],
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
