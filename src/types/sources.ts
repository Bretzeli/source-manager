/**
 * Type definitions for sources and related entities
 */

export type Source = {
  id: string
  projectId: string
  abbreviation: string
  title: string
  description: string | null
  authors: string | null
  publicationDate: string | null
  notes: string | null
  links: string | null
  bibtex: string | null
  topics: Array<{
    id: string
    abbreviation: string
    name: string
    color: string
  }>
}

export type Topic = {
  id: string
  projectId: string
  abbreviation: string
  name: string
  description: string | null
  notes: string | null
  color: string
}

export type ColumnKey = "abbreviation" | "title" | "authors" | "publicationDate" | "topics" | "description" | "notes" | "links" | "bibtex"

export const COLUMN_ORDER: ColumnKey[] = ["abbreviation", "title", "authors", "publicationDate", "topics", "description", "notes", "links", "bibtex"]

export type SourcePreferences = {
  columnVisibility: Record<ColumnKey, boolean>
  columnOrder: ColumnKey[]
  topicFilter: string
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
  topicNames?: string[]
  topicColors?: Record<string, string>
  topicAbbreviations?: Record<string, string>
}

