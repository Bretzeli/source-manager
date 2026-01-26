/**
 * Cookie-based preferences management for sources page
 */

import type { ColumnKey, SourcePreferences } from "@/types/sources"

/**
 * Get cookie value by name
 */
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(";").shift() || null
  return null
}

/**
 * Set cookie with expiration
 */
function setCookie(name: string, value: string, days = 365) {
  if (typeof document === "undefined") return
  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`
}

/**
 * Load saved preferences from cookies
 */
export function loadPreferences(projectId: string): Partial<SourcePreferences> {
  const prefix = `sources_prefs_${projectId}_`
  const columnVisibility = getCookie(`${prefix}columnVisibility`)
  const columnOrder = getCookie(`${prefix}columnOrder`)
  const columnWidths = getCookie(`${prefix}columnWidths`)
  const tagFilter = getCookie(`${prefix}tagFilter`)
  const yearFromFilter = getCookie(`${prefix}yearFromFilter`)
  const yearToFilter = getCookie(`${prefix}yearToFilter`)
  const authorFilter = getCookie(`${prefix}authorFilter`)
  const pageSize = getCookie(`${prefix}pageSize`)
  const autoResizeTextarea = getCookie(`${prefix}autoResizeTextarea`)

  return {
    columnVisibility: columnVisibility ? JSON.parse(columnVisibility) : undefined,
    columnOrder: columnOrder ? JSON.parse(columnOrder) : undefined,
    columnWidths: columnWidths ? JSON.parse(columnWidths) : undefined,
    tagFilter: tagFilter || undefined,
    yearFromFilter: yearFromFilter || undefined,
    yearToFilter: yearToFilter || undefined,
    authorFilter: authorFilter || undefined,
    pageSize: pageSize ? (pageSize === "all" ? "all" : parseInt(pageSize)) : undefined,
    autoResizeTextarea: autoResizeTextarea ? autoResizeTextarea === "true" : undefined,
  }
}

/**
 * Save preferences to cookies
 */
export function savePreferences(
  projectId: string,
  prefs: {
    columnVisibility?: Record<ColumnKey, boolean>
    columnOrder?: ColumnKey[]
    columnWidths?: Record<ColumnKey, number>
    tagFilter?: string
    yearFromFilter?: string
    yearToFilter?: string
    authorFilter?: string
    pageSize?: number | "all"
    autoResizeTextarea?: boolean
  }
) {
  const prefix = `sources_prefs_${projectId}_`
  if (prefs.columnVisibility) setCookie(`${prefix}columnVisibility`, JSON.stringify(prefs.columnVisibility))
  if (prefs.columnOrder) setCookie(`${prefix}columnOrder`, JSON.stringify(prefs.columnOrder))
  if (prefs.columnWidths) setCookie(`${prefix}columnWidths`, JSON.stringify(prefs.columnWidths))
  if (prefs.tagFilter !== undefined) setCookie(`${prefix}tagFilter`, prefs.tagFilter)
  if (prefs.yearFromFilter !== undefined) setCookie(`${prefix}yearFromFilter`, prefs.yearFromFilter)
  if (prefs.yearToFilter !== undefined) setCookie(`${prefix}yearToFilter`, prefs.yearToFilter)
  if (prefs.authorFilter !== undefined) setCookie(`${prefix}authorFilter`, prefs.authorFilter)
  if (prefs.pageSize !== undefined) setCookie(`${prefix}pageSize`, prefs.pageSize.toString())
  if (prefs.autoResizeTextarea !== undefined) setCookie(`${prefix}autoResizeTextarea`, prefs.autoResizeTextarea.toString())
}

