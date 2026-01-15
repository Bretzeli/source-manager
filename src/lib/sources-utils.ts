/**
 * Utility functions for sources: CSV parsing, export, and formatting
 */

import type { Source, ImportSourceData } from "@/types/sources"

/**
 * Sanitize filename by removing invalid characters
 */
export function sanitizeFilename(name: string): string {
  let sanitized = name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/[\s.]+$/, "")
    .trim()

  if (!sanitized) {
    sanitized = "project"
  }

  return sanitized
}

/**
 * Format publication date to show only what was entered
 */
export function formatPublicationDate(date: string | null): string {
  if (!date) return "-"

  if (/^\d{4}$/.test(date)) {
    return date
  }

  if (/^\d{4}-\d{2}$/.test(date)) {
    return date
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split("-")
    if (day === "01") {
      if (month === "01") {
        return year
      }
      return `${year}-${month}`
    }
    return date
  }

  return date
}


/**
 * Parse CSV text into array of records
 */
export function parseCSV(csvText: string): Array<Record<string, string>> {
  if (!csvText.trim()) return []

  const rows: string[][] = []
  let currentRow: string[] = []
  let currentValue = ""
  let inQuotes = false

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i]
    const nextChar = csvText[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === "," && !inQuotes) {
      currentRow.push(currentValue.trim())
      currentValue = ""
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++
      }
      if (currentValue.trim() || currentRow.length > 0) {
        currentRow.push(currentValue.trim())
        if (currentRow.some((v) => v.length > 0)) {
          rows.push(currentRow)
        }
        currentRow = []
        currentValue = ""
      }
    } else {
      currentValue += char
    }
  }

  if (currentValue.trim() || currentRow.length > 0) {
    currentRow.push(currentValue.trim())
    if (currentRow.some((v) => v.length > 0)) {
      rows.push(currentRow)
    }
  }

  if (rows.length === 0) return []

  const headers = rows[0].map((h) => h.trim())
  const dataRows: Array<Record<string, string>> = []

  for (let i = 1; i < rows.length; i++) {
    const row: Record<string, string> = {}
    headers.forEach((header, index) => {
      let value = rows[i][index] || ""
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1).replace(/""/g, '"')
      }
      row[header] = value
    })
    dataRows.push(row)
  }

  return dataRows
}

/**
 * Convert sources to CSV format and trigger download
 */
export function exportToCSV(sources: Source[], projectName: string, sourcesWord: string) {
  const headers = ["abbreviation", "title", "authors", "publicationDate", "description", "notes", "links", "bibtex", "topics"]
  const rows = sources.map((source) => {
    const topicsStr = source.topics
      .map((t) => {
        if (t.abbreviation) {
          return `${t.name} (${t.abbreviation})`
        }
        return t.name
      })
      .join("; ")
    return [
      source.abbreviation || "",
      source.title || "",
      source.authors || "",
      source.publicationDate || "",
      source.description || "",
      source.notes || "",
      source.links || "",
      source.bibtex || "",
      topicsStr,
    ]
  })

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row
        .map((cell) => {
          const str = String(cell || "")
          if (str.includes(",") || str.includes("\n") || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`
          }
          return str
        })
        .join(",")
    ),
  ].join("\n")

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  const sanitizedProjectName = sanitizeFilename(projectName)
  const dateStr = new Date().toISOString().split("T")[0]
  link.setAttribute("download", `${sanitizedProjectName}_${sourcesWord}_${dateStr}.csv`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Convert sources to JSON format and trigger download
 */
export function exportToJSON(sources: Source[], projectName: string, sourcesWord: string) {
  const jsonData = sources.map((source) => {
    const topics = source.topics.map((t) => ({
      name: t.name,
      abbreviation: t.abbreviation || null,
      color: t.color,
    }))
    return {
      abbreviation: source.abbreviation,
      title: source.title,
      authors: source.authors,
      publicationDate: source.publicationDate,
      description: source.description,
      notes: source.notes,
      links: source.links,
      bibtex: source.bibtex,
      topics,
    }
  })

  const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: "application/json" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  const sanitizedProjectName = sanitizeFilename(projectName)
  const dateStr = new Date().toISOString().split("T")[0]
  link.setAttribute("download", `${sanitizedProjectName}_${sourcesWord}_${dateStr}.json`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Parse Miro CSV format into import format
 */
function parseMiroCSV(csvText: string): Array<Record<string, string>> {
  if (!csvText.trim()) return []

  const rows: string[][] = []
  let currentRow: string[] = []
  let currentValue = ""
  let inQuotes = false

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i]
    const nextChar = csvText[i + 1]
    const charCode = char.charCodeAt(0)

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote inside quoted field
        currentValue += '"'
        i++
      } else {
        // Toggle quote state
        inQuotes = !inQuotes
      }
    } else if (char === "," && !inQuotes) {
      // Field separator - preserve value as-is (including newlines)
      currentRow.push(currentValue)
      currentValue = ""
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      // Row separator (only when not in quotes)
      if (char === "\r" && nextChar === "\n") {
        i++ // Skip \r\n
      }
      // Finish current field and row
      if (currentValue || currentRow.length > 0) {
        currentRow.push(currentValue)
        if (currentRow.some((v) => v.length > 0)) {
          rows.push(currentRow)
        }
        currentRow = []
        currentValue = ""
      }
    } else {
      // Add character to current value (including newlines when in quotes)
      // Also handle special Unicode characters that might represent line breaks
      // (like zero-width space, line separator, paragraph separator, etc.)
      if (inQuotes && (
        charCode === 0x2028 || // Line Separator
        charCode === 0x2029 || // Paragraph Separator
        charCode === 0x0085    // Next Line
      )) {
        // Convert special line break characters to standard newline
        currentValue += "\n"
      } else {
        currentValue += char
      }
    }
  }

  // Add last field and row if any
  if (currentValue || currentRow.length > 0) {
    currentRow.push(currentValue)
    if (currentRow.some((v) => v.length > 0)) {
      rows.push(currentRow)
    }
  }

  if (rows.length === 0) return []

  // Skip first row if it's "Quellen" or header row
  let headerStartIndex = 0
  if (rows[0] && (rows[0][0]?.toLowerCase() === "quellen" || rows[0][0]?.toLowerCase() === "id")) {
    headerStartIndex = 1
  }

  const headers = rows[headerStartIndex]?.map((h) => h.trim().replace(/^"|"$/g, "")) || []
  const dataRows: Array<Record<string, string>> = []

  for (let i = headerStartIndex + 1; i < rows.length; i++) {
    const row: Record<string, string> = {}
    headers.forEach((header, index) => {
      let value = rows[i][index] || ""
      // Remove surrounding quotes if present, but preserve newlines
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1).replace(/""/g, '"')
      }
      // Handle literal \n strings (if CSV has escaped newlines as text)
      // Convert literal \n to actual newlines
      value = value.replace(/\\n/g, '\n').replace(/\\r\\n/g, '\n').replace(/\\r/g, '\n')
      // Also handle Unicode line break characters
      value = value.replace(/\u2028/g, '\n') // Line Separator
      value = value.replace(/\u2029/g, '\n') // Paragraph Separator
      value = value.replace(/\u0085/g, '\n') // Next Line
      row[header] = value
    })
    dataRows.push(row)
  }

  return dataRows
}

/**
 * Convert author string to semicolon-separated format if possible
 */
function normalizeAuthors(authorStr: string | null | undefined): string | null {
  if (!authorStr || !authorStr.trim()) return null

  const trimmed = authorStr.trim()
  
  // Try different separators
  // Common patterns: comma, semicolon, "and", newline
  let authors: string[] = []
  
  // Check for semicolon (already in correct format)
  if (trimmed.includes(";")) {
    authors = trimmed.split(";").map(a => a.trim()).filter(a => a)
  }
  // Check for comma
  else if (trimmed.includes(",")) {
    authors = trimmed.split(",").map(a => a.trim()).filter(a => a)
  }
  // Check for "and"
  else if (trimmed.toLowerCase().includes(" and ")) {
    authors = trimmed.split(/\s+and\s+/i).map(a => a.trim()).filter(a => a)
  }
  // Check for newline
  else if (trimmed.includes("\n")) {
    authors = trimmed.split("\n").map(a => a.trim()).filter(a => a)
  }
  // Otherwise keep as is
  else {
    return trimmed
  }

  // Return semicolon-separated format
  return authors.length > 0 ? authors.join("; ") : trimmed
}

/**
 * Extract URLs from text and make them clickable while preserving newlines
 */
export function extractLinksFromText(text: string | null): string | null {
  if (!text) return null
  return text // Keep as-is, rendering will handle clickable links
}

/**
 * Parse imported file (CSV, JSON, or Miro CSV) into import format
 */
export function parseImportFile(
  text: string,
  fileName: string,
  importType: "csv" | "json" | "miro-csv" = "csv"
): ImportSourceData[] {
  type ParsedRow = Record<string, unknown> & {
    abbreviation?: string
    title?: string
    authors?: string
    publicationDate?: string
    description?: string
    notes?: string
    links?: string
    bibtex?: string
    topics?: string | Array<string | { name?: string; color?: string; abbreviation?: string }>
    // Miro CSV fields
    ID?: string
    Titel?: string
    Beschreibung?: string
    Themengebiet?: string
    Autor?: string
    Jahr?: string
    "Weitere Notizen"?: string
    Link?: string
  }

  let parsedData: ParsedRow[] = []

  if (importType === "miro-csv") {
    parsedData = parseMiroCSV(text) as ParsedRow[]
  } else if (fileName.endsWith(".csv") || importType === "csv") {
    parsedData = parseCSV(text) as ParsedRow[]
  } else if (fileName.endsWith(".json") || importType === "json") {
    parsedData = JSON.parse(text) as ParsedRow[]
  } else {
    throw new Error("Invalid file format")
  }

  return parsedData.map((row: ParsedRow) => {
    let topics: string[] = []
    const topicColors: Record<string, string> = {}
    const topicAbbreviations: Record<string, string> = {}

    // Handle Miro CSV format
    if (importType === "miro-csv") {
      // Map Miro CSV fields to standard fields
      const abbreviation = row.ID || row.abbreviation || null
      const title = row.Titel || row.title || ""
      const description = row.Beschreibung || row.description || null
      const notes = row["Weitere Notizen"] || row.notes || null
      const authors = normalizeAuthors(row.Autor || row.authors || null)
      const publicationDate = row.Jahr || row.publicationDate || null
      // Links: keep as free text, preserve newlines
      const links = row.Link || row.links || null
      
      // Handle topics (Themengebiet)
      const themengebiet = row.Themengebiet || ""
      if (themengebiet && typeof themengebiet === "string") {
        const topicNames = themengebiet.split(";").map(t => t.trim()).filter(t => t)
        topics = topicNames
      }

      return {
        abbreviation: abbreviation ? String(abbreviation) : null,
        title: title ? String(title) : "",
        authors: authors,
        publicationDate: publicationDate ? String(publicationDate) : null,
        description: description ? String(description) : null,
        notes: notes ? String(notes) : null,
        links: links ? String(links) : null,
        bibtex: null, // Will be generated from other fields
        topicNames: topics,
        topicColors,
        topicAbbreviations,
      }
    }

    // Handle standard CSV/JSON format
    if (row.topics) {
      if (typeof row.topics === "string") {
        topics = row.topics
          .split(";")
          .map((t: string) => {
            const trimmed = t.trim()
            if (!trimmed) return null
            const match = trimmed.match(/^(.+?)\s*\((.+?)\)$/)
            if (match) {
              const name = match[1].trim()
              const abbrev = match[2].trim()
              topicAbbreviations[name] = abbrev
              return name
            }
            return trimmed
          })
          .filter((t: string | null): t is string => t !== null)
      } else if (Array.isArray(row.topics)) {
        topics = row.topics
          .map((t: string | { name?: string; color?: string; abbreviation?: string }) => {
            if (typeof t === "string") {
              return t
            } else if (t.name) {
              if (t.color) {
                topicColors[t.name] = t.color
              }
              if (t.abbreviation) {
                topicAbbreviations[t.name] = t.abbreviation
              }
              return t.name
            }
            return null
          })
          .filter((t: string | null): t is string => t !== null)
      }
    }

    return {
      abbreviation: row.abbreviation || null,
      title: row.title || "",
      authors: normalizeAuthors(row.authors || null),
      publicationDate: row.publicationDate || null,
      description: row.description || null,
      notes: row.notes || null,
      links: row.links || null,
      bibtex: row.bibtex || null,
      topicNames: topics,
      topicColors,
      topicAbbreviations,
    }
  })
}

