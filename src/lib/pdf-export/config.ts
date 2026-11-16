import type { ColumnKey } from "@/types/sources"
import { COLUMN_ORDER } from "@/types/sources"
import type { AppThemeId } from "@/lib/theme-config"

export type PdfSortKey = "abbreviation" | "title" | "authors" | "newest" | "oldest"
export type PdfMode = "light" | "dark"

export const PDF_SORT_KEYS: PdfSortKey[] = ["abbreviation", "title", "authors", "newest", "oldest"]

export type PdfExportConfig = {
  /** Source fields printed for every entry, always in canonical column order. */
  fields: ColumnKey[]
  includeApaCitation: boolean
  sortBy: PdfSortKey
  /** Export only the sources matching the table's current search and filters. */
  keepFilters: boolean
  mode: PdfMode
  themeId: AppThemeId
  includeProjectTitle: boolean
  includeProjectDescription: boolean
  includeDownloadDate: boolean
  includeAuthor: boolean
  authorName: string
  /** Credit Source Manager as the data's origin and link back to the project. */
  includeSourceManagerNote: boolean
}

export const DEFAULT_PDF_FIELDS: ColumnKey[] = COLUMN_ORDER.filter((column) => column !== "bibtex")

export function createDefaultPdfConfig(current: {
  mode: PdfMode
  themeId: AppThemeId
  authorName: string
}): PdfExportConfig {
  return {
    fields: DEFAULT_PDF_FIELDS,
    includeApaCitation: false,
    sortBy: "abbreviation",
    keepFilters: false,
    mode: current.mode,
    themeId: current.themeId,
    includeProjectTitle: true,
    includeProjectDescription: false,
    includeDownloadDate: false,
    includeAuthor: false,
    authorName: current.authorName,
    includeSourceManagerNote: false,
  }
}

/** Labels printed inside the document, in the UI language. */
export type PdfDocumentStrings = {
  overline: string
  preparedBy: string
  date: string
  count: string
  notes: string
  links: string
  bibtex: string
  citeAs: string
  untitled: string
  exportedFrom: string
}
