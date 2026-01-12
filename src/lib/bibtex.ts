// BibTeX parsing and serialization utilities

export interface BibtexEntry {
  type: string
  key: string
  fields: Record<string, string>
}

/**
 * Parse a BibTeX string into structured data
 */
export function parseBibtex(bibtex: string): BibtexEntry | null {
  if (!bibtex || !bibtex.trim()) return null

  // Remove comments and normalize whitespace
  let cleaned = bibtex
    .replace(/%.*$/gm, "") // Remove comments
    .replace(/\s+/g, " ")
    .trim()

  // Match entry type and key: @type{key,
  const entryMatch = cleaned.match(/@(\w+)\s*\{\s*([^,\s]+)\s*,/)
  if (!entryMatch) return null

  const type = entryMatch[1].toLowerCase()
  const key = entryMatch[2]

  // Extract fields
  const fields: Record<string, string> = {}
  
  // Match field patterns: field = "value" or field = {value}
  const fieldRegex = /(\w+)\s*=\s*["{]([^"}]+)["}]/g
  let fieldMatch
  
  while ((fieldMatch = fieldRegex.exec(cleaned)) !== null) {
    const fieldName = fieldMatch[1].toLowerCase()
    let fieldValue = fieldMatch[2].trim()
    
    // Remove braces and quotes
    fieldValue = fieldValue.replace(/^["{]+|["}]+$/g, "")
    
    fields[fieldName] = fieldValue
  }

  return { type, key, fields }
}

/**
 * Convert structured data to BibTeX format
 */
export function serializeBibtex(entry: BibtexEntry): string {
  const { type, key, fields } = entry
  
  let bibtex = `@${type}{${key},\n`
  
  const fieldEntries = Object.entries(fields)
  fieldEntries.forEach(([name, value], index) => {
    // Escape special characters in value
    const escapedValue = value.replace(/"/g, '\\"')
    bibtex += `  ${name} = "${escapedValue}"`
    if (index < fieldEntries.length - 1) {
      bibtex += ","
    }
    bibtex += "\n"
  })
  
  bibtex += "}"
  
  return bibtex
}

/**
 * Extract common fields from BibTeX entry to source fields
 */
export function bibtexToSourceFields(bibtexEntry: BibtexEntry): {
  title?: string
  authors?: string
  publicationDate?: string
  abbreviation?: string
} {
  const fields = bibtexEntry.fields
  
  // Map common BibTeX fields to source fields
  const title = fields.title || fields.booktitle || ""
  // Convert BibTeX "and" separator to semicolon for UI display
  const authors = (fields.author || fields.editor || "").replace(/\s+and\s+/gi, "; ")
  
  // Extract year from date field
  let publicationDate: string | undefined
  if (fields.year) {
    publicationDate = fields.year
    if (fields.month) {
      // Try to create a date string (YYYY-MM format)
      const monthMap: Record<string, string> = {
        jan: "01", feb: "02", mar: "03", apr: "04",
        may: "05", jun: "06", jul: "07", aug: "08",
        sep: "09", oct: "10", nov: "11", dec: "12"
      }
      const month = monthMap[fields.month.toLowerCase()] || fields.month.padStart(2, "0")
      publicationDate = `${fields.year}-${month}`
    }
  } else if (fields.date) {
    // Try to parse date field
    const dateMatch = fields.date.match(/(\d{4})/)
    if (dateMatch) {
      publicationDate = dateMatch[1]
    }
  }
  
  const abbreviation = bibtexEntry.key || ""
  
  return {
    title: title || undefined,
    authors: authors || undefined,
    publicationDate: publicationDate || undefined,
    abbreviation: abbreviation || undefined,
  }
}

/**
 * Convert source fields to BibTeX entry
 */
export function sourceFieldsToBibtex(data: {
  abbreviation: string
  title: string
  authors?: string | null
  publicationDate?: string | null
  description?: string | null
  notes?: string | null
  links?: string | null
}): BibtexEntry {
  const fields: Record<string, string> = {}
  
  if (data.title) fields.title = data.title
  // Convert semicolon-separated authors to BibTeX "and" format
  if (data.authors) {
    fields.author = data.authors.split(";").map(a => a.trim()).filter(a => a).join(" and ")
  }
  if (data.publicationDate) {
    // Extract year from date
    const yearMatch = data.publicationDate.match(/(\d{4})/)
    if (yearMatch) {
      fields.year = yearMatch[1]
    }
  }
  if (data.description) fields.note = data.description
  if (data.links) fields.url = data.links
  
  return {
    type: "article", // Default type
    key: data.abbreviation || "source", // Use "source" as fallback if no abbreviation
    fields,
  }
}

/**
 * Check if two BibTeX entries are equivalent (for syncing)
 */
export function bibtexFieldsMatch(
  bibtex1: BibtexEntry | null,
  bibtex2: BibtexEntry | null,
  sourceFields: {
    title?: string
    authors?: string
    publicationDate?: string
  }
): boolean {
  if (!bibtex1 || !bibtex2) return false
  
  // Compare key fields
  const bib1Title = bibtex1.fields.title || ""
  const bib2Title = bibtex2.fields.title || ""
  const sourceTitle = sourceFields.title || ""
  
  const bib1Authors = bibtex1.fields.author || ""
  const bib2Authors = bibtex2.fields.author || ""
  const sourceAuthors = sourceFields.authors || ""
  
  // Check if BibTeX matches source fields
  const titleMatches = 
    bib1Title.toLowerCase().trim() === sourceTitle.toLowerCase().trim() &&
    bib2Title.toLowerCase().trim() === sourceTitle.toLowerCase().trim()
  
  const authorsMatch =
    bib1Authors.toLowerCase().trim() === sourceAuthors.toLowerCase().trim() &&
    bib2Authors.toLowerCase().trim() === sourceAuthors.toLowerCase().trim()
  
  return titleMatches && authorsMatch
}

