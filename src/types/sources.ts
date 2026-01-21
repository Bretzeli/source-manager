/**
 * Type definitions for sources and related entities
 */

export type Source = {
  id: string
  projectId: string
  abbreviation: string | null
  title: string
  description: string | null
  authors: string | null
  publicationDate: string | null
  notes: string | null
  links: string | null
  bibtex: string | null
  tags: Array<{
    id: string
    abbreviation: string | null
    name: string
    color: string
  }>
}

export type Tag = {
  id: string
  projectId: string
  abbreviation: string | null
  name: string
  description: string | null
  notes: string | null
  color: string
}

export type ColumnKey = "abbreviation" | "title" | "authors" | "publicationDate" | "tags" | "description" | "notes" | "links" | "bibtex"

export const COLUMN_ORDER: ColumnKey[] = ["abbreviation", "title", "authors", "publicationDate", "tags", "description", "notes", "links", "bibtex"]

export type SourcePreferences = {
  columnVisibility: Record<ColumnKey, boolean>
  columnOrder: ColumnKey[]
  columnWidths?: Record<ColumnKey, number>
  tagFilter: string
  yearFromFilter: string
  yearToFilter: string
  authorFilter: string
  pageSize: number | "all"
}

export type ImportSourceData = {
  abbreviation?: string | null
  title: string
  description?: string | null
  authors?: string | null
  publicationDate?: string | null
  notes?: string | null
  links?: string | null
  bibtex?: string | null
  tagNames?: string[]
  tagColors?: Record<string, string>
  tagAbbreviations?: Record<string, string>
}

