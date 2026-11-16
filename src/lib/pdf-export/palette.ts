import { appThemes, type AppThemeId } from "@/lib/theme-config"
import type { PdfMode } from "./config"
import { clamp, contrast, ensureContrast, mix, parseCssColor, toHex, type Oklch } from "./color"

/** The few theme tokens the document is derived from. */
export type ThemeTokens = {
  background?: string
  foreground?: string
  primary?: string
}

export type PdfPalette = {
  mode: PdfMode
  /** Page background. */
  paper: string
  /** Headings and the strongest text. */
  ink: string
  /** Running text. */
  body: string
  /** Metadata, labels. Still meets WCAG AA for small text. */
  muted: string
  /** Page numbers and other quiet furniture. */
  faint: string
  /** Hairlines. */
  rule: string
  /** The theme's color, used sparingly: keys, links, the overline, the citation bar. */
  accent: string
  /** Accent-tinted surface behind the citation. */
  accentWash: string
  /** Neutral surface behind code and BibTeX. */
  wash: string
}

const TOKEN_KEYS: Record<string, keyof ThemeTokens> = {
  "--background": "background",
  "--foreground": "foreground",
  "--primary": "primary",
}

type ModeTokens = Record<PdfMode, ThemeTokens>
type TokenTable = { base: ModeTokens; themes: Map<string, ModeTokens> }

/** Used when the stylesheet can't be read: mirrors the default theme in globals.css. */
const FALLBACK_TOKENS: ModeTokens = {
  light: { background: "oklch(1 0 0)", foreground: "oklch(0.145 0 0)", primary: "oklch(0.205 0 0)" },
  dark: { background: "oklch(0.145 0 0)", foreground: "oklch(0.985 0 0)", primary: "oklch(0.922 0 0)" },
}

/** Split a selector list on top-level commas (`:is(a, b)` stays intact). */
function splitSelectorList(selectorText: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ""
  for (const char of selectorText) {
    if (char === "(") depth += 1
    if (char === ")") depth -= 1
    if (char === "," && depth === 0) {
      parts.push(current.trim())
      current = ""
    } else {
      current += char
    }
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

const classPattern = (className: string) =>
  new RegExp(`\\.${className.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}(?![\\w-])`)

const DARK_CLASS = classPattern("dark")
const THEME_PATTERNS = appThemes.map((theme) => ({ id: theme.id, pattern: classPattern(`theme-${theme.id}`) }))

type DeclarationBlock = { style: CSSStyleDeclaration; chain: string[][] }

function collectBlocks(rules: CSSRuleList, chain: string[][], out: DeclarationBlock[]) {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      const next = [...chain, splitSelectorList(rule.selectorText)]
      out.push({ style: rule.style, chain: next })
      if (rule.cssRules?.length) collectBlocks(rule.cssRules, next, out)
    } else if (typeof CSSImportRule !== "undefined" && rule instanceof CSSImportRule) {
      try {
        if (rule.styleSheet) collectBlocks(rule.styleSheet.cssRules, chain, out)
      } catch {
        // Cross-origin stylesheet (e.g. web fonts): nothing for us there.
      }
    } else if ("cssRules" in rule && (rule as CSSGroupingRule).cssRules) {
      collectBlocks((rule as CSSGroupingRule).cssRules, chain, out)
    } else if ("style" in rule && (rule as CSSStyleRule).style) {
      // CSSNestedDeclarations: declarations that follow nested rules inside a style rule.
      out.push({ style: (rule as CSSStyleRule).style, chain })
    }
  }
}

function readTokens(style: CSSStyleDeclaration): ThemeTokens {
  const tokens: ThemeTokens = {}
  for (const [property, key] of Object.entries(TOKEN_KEYS)) {
    const value = style.getPropertyValue(property).trim()
    if (value) tokens[key] = value
  }
  return tokens
}

/**
 * Read every theme's light and dark tokens from the loaded stylesheets in one pass.
 * Handles both the nested form (`.theme-x { &:is(.dark *) { … } }`, dev) and the flattened
 * form (`.theme-x:is(.dark *) { … }`, production build).
 */
function readTokenTable(): TokenTable {
  const table: TokenTable = { base: { light: {}, dark: {} }, themes: new Map() }
  if (typeof document === "undefined") return table

  const blocks: DeclarationBlock[] = []
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      collectBlocks(sheet.cssRules, [], blocks)
    } catch {
      // Cross-origin stylesheet.
    }
  }

  for (const { style, chain } of blocks) {
    const tokens = readTokens(style)
    if (Object.keys(tokens).length === 0) continue
    const selectors = chain.flat()
    const isDark = selectors.some((selector) => DARK_CLASS.test(selector))
    const mode: PdfMode = isDark ? "dark" : "light"
    const themeIds = THEME_PATTERNS.filter(({ pattern }) => selectors.some((s) => pattern.test(s))).map((t) => t.id)

    if (themeIds.length > 0) {
      for (const id of themeIds) {
        const entry = table.themes.get(id) ?? { light: {}, dark: {} }
        entry[mode] = { ...entry[mode], ...tokens }
        table.themes.set(id, entry)
      }
    } else if (selectors.some((s) => /(^|[\s>+~(,])(:root|html)(?![\w-])/.test(s) || s === ".dark")) {
      table.base[mode] = { ...table.base[mode], ...tokens }
    }
  }
  return table
}

let tokenTableCache: TokenTable | null = null

export function getThemeTokens(themeId: AppThemeId, mode: PdfMode): ThemeTokens {
  if (!tokenTableCache) tokenTableCache = readTokenTable()
  const { base, themes } = tokenTableCache
  const theme = themes.get(themeId)
  // Same cascade as the app: base light → base dark → theme light → theme dark.
  const tokens: ThemeTokens = {
    ...FALLBACK_TOKENS[mode],
    ...base.light,
    ...(mode === "dark" ? base.dark : {}),
    ...theme?.light,
    ...(mode === "dark" ? theme?.dark : {}),
  }
  // A theme that only defines light colors must not leak them into dark mode.
  if (mode === "dark" && theme && !theme.dark.background) {
    return { ...tokens, ...FALLBACK_TOKENS.dark, ...base.dark, primary: theme.dark.primary ?? tokens.primary }
  }
  return tokens
}

const WHITE: Oklch = { l: 1, c: 0, h: 0 }

/**
 * Turn a theme into a document palette. The theme sets the hue and character; lightness and
 * chroma are clamped so every theme still reads as a calm, well-printed document.
 */
export function derivePalette(tokens: ThemeTokens, mode: PdfMode): PdfPalette {
  const fallback = FALLBACK_TOKENS[mode]
  const background = parseCssColor(tokens.background) ?? parseCssColor(fallback.background)!
  const foreground = parseCssColor(tokens.foreground) ?? parseCssColor(fallback.foreground)!
  const primary = parseCssColor(tokens.primary) ?? foreground

  const light = mode === "light"

  // Light documents stay on white paper: a tinted full-bleed page prints badly.
  const paper: Oklch = light
    ? WHITE
    : { l: clamp(background.l, 0.17, 0.24), c: Math.min(background.c, 0.02), h: background.h }

  const ink = ensureContrast(
    light
      ? { l: clamp(foreground.l, 0.17, 0.25), c: Math.min(foreground.c, 0.02), h: foreground.h }
      : { l: clamp(foreground.l, 0.9, 0.95), c: Math.min(foreground.c, 0.02), h: foreground.h },
    paper,
    11,
  )

  // Achromatic primaries (e.g. the default theme) give a quiet graphite accent.
  const accentBase: Oklch = light
    ? { l: clamp(primary.l, 0.38, 0.56), c: Math.min(primary.c, 0.16), h: primary.h }
    : { l: clamp(primary.l, 0.72, 0.84), c: Math.min(primary.c, 0.13), h: primary.h }
  const accent = ensureContrast(accentBase, paper, 4.8)

  return {
    mode,
    paper: toHex(paper),
    ink: toHex(ink),
    body: toHex(mix(ink, paper, light ? 0.1 : 0.12)),
    muted: toHex(ensureContrast(mix(ink, paper, 0.44), paper, 4.6)),
    faint: toHex(ensureContrast(mix(ink, paper, 0.56), paper, 3.1)),
    rule: toHex(mix(ink, paper, light ? 0.86 : 0.82)),
    accent: toHex(accent),
    accentWash: toHex(mix(paper, accent, light ? 0.06 : 0.09)),
    wash: toHex(mix(paper, ink, light ? 0.035 : 0.055)),
  }
}

const paletteCache = new Map<string, PdfPalette>()

export function getPdfPalette(themeId: AppThemeId, mode: PdfMode): PdfPalette {
  const key = `${themeId}:${mode}`
  let palette = paletteCache.get(key)
  if (!palette) {
    palette = derivePalette(getThemeTokens(themeId, mode), mode)
    paletteCache.set(key, palette)
  }
  return palette
}

/** Background and text color for a tag chip: a soft wash of the tag color with legible text. */
export function tagChipColors(tagColor: string, palette: PdfPalette): { background: string; text: string } {
  const paper = parseCssColor(palette.paper)!
  const base = parseCssColor(tagColor) ?? parseCssColor(palette.accent)!
  const light = palette.mode === "light"
  const background = mix(paper, base, light ? 0.14 : 0.24)
  const text = ensureContrast(
    light ? { ...base, l: Math.min(base.l, 0.5) } : { ...base, l: Math.max(base.l, 0.82) },
    background,
    4.6,
  )
  return { background: toHex(background), text: toHex(text) }
}

/** A text color chosen in the rich-text editor, nudged until it reads on this paper. */
export function legibleTextColor(cssColor: string, palette: PdfPalette): string | null {
  const color = parseCssColor(cssColor)
  if (!color) return null
  const paper = parseCssColor(palette.paper)!
  return toHex(contrast(color, paper) >= 3.5 ? color : ensureContrast(color, paper, 3.5))
}

/** A highlight from the rich-text editor, softened so the text on top stays readable. */
export function softHighlight(cssColor: string, palette: PdfPalette): string | null {
  const color = parseCssColor(cssColor)
  if (!color) return null
  const paper = parseCssColor(palette.paper)!
  return toHex(mix(paper, color, palette.mode === "light" ? 0.42 : 0.36))
}
