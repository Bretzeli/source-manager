/**
 * Generate APA-style citation from source data
 */

import type { Source } from "@/types/sources"

/**
 * Format author names for APA citation
 * Handles various formats: "Last, First", "First Last", "Last, First Middle", etc.
 */
function formatAuthorForAPA(authorString: string | null): string {
  if (!authorString) return ""
  
  // Split by common separators (semicolon, comma, and)
  const authors = authorString
    .split(/[;,]| and /i)
    .map(a => a.trim())
    .filter(a => a.length > 0)
  
  if (authors.length === 0) return ""
  
  const formattedAuthors = authors.map(author => {
    // Check if already in "Last, First" format
    if (author.includes(",")) {
      const parts = author.split(",").map(p => p.trim())
      if (parts.length >= 2) {
        const lastName = parts[0]
        const firstNames = parts.slice(1).join(" ")
        return `${lastName}, ${firstNames.charAt(0).toUpperCase()}.`
      }
    }
    
    // Try to parse "First Last" format
    const words = author.trim().split(/\s+/)
    if (words.length >= 2) {
      const lastName = words[words.length - 1]
      const firstNames = words.slice(0, -1).join(" ")
      const initials = firstNames
        .split(/\s+/)
        .map(n => n.charAt(0).toUpperCase() + ".")
        .join(" ")
      return `${lastName}, ${initials}`
    }
    
    // Fallback: return as is
    return author
  })
  
  if (formattedAuthors.length === 1) {
    return formattedAuthors[0]
  } else if (formattedAuthors.length === 2) {
    return `${formattedAuthors[0]} & ${formattedAuthors[1]}`
  } else {
    return `${formattedAuthors.slice(0, -1).join(", ")}, & ${formattedAuthors[formattedAuthors.length - 1]}`
  }
}

/**
 * Extract year from publication date
 */
function extractYear(dateString: string | null): string {
  if (!dateString) return "n.d."
  const yearMatch = dateString.match(/^(\d{4})/)
  return yearMatch ? yearMatch[1] : "n.d."
}

/**
 * Generate APA-style citation for a source
 */
export function generateAPACitation(source: Source): string {
  const authors = formatAuthorForAPA(source.authors)
  const year = extractYear(source.publicationDate)
  
  let citation = ""
  
  if (authors) {
    citation += `${authors} `
  }
  
  citation += `(${year}). `
  
  if (source.title) {
    citation += source.title
  }
  
  // Add period if title doesn't end with punctuation
  if (citation && !/[.!?]$/.test(citation.trim())) {
    citation += "."
  }
  
  return citation.trim()
}

