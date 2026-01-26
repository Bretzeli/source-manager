/**
 * PDF export utilities using jsPDF
 */

import { jsPDF } from "jspdf"
import type { Source } from "@/types/sources"
import { generateAPACitation } from "./apa-citation"
import { formatPublicationDate } from "./sources-utils"
import type { PDFExportConfig } from "@/components/pdf-export-dialog"

/**
 * Get column value for a source
 */
function getColumnValue(source: Source, column: string, citationCount?: number): string {
  switch (column) {
    case "abbreviation":
      return source.abbreviation || "-"
    case "title":
      return source.title || "-"
    case "authors":
      return source.authors || "-"
    case "publicationDate":
      return formatPublicationDate(source.publicationDate)
    case "description":
      return source.description || "-"
    case "notes":
      return source.notes || "-"
    case "links":
      return source.links || "-"
    case "bibtex":
      return source.bibtex || "-"
    case "tags":
      return source.tags.length > 0 ? source.tags.map(t => t.name).join(", ") : "-"
    case "apaCitation":
      return generateAPACitation(source)
    case "citationCount":
      return citationCount !== undefined ? citationCount.toString() : "0"
    default:
      return "-"
  }
}

/**
 * Sort sources according to config
 */
function sortSources(
  sources: Source[],
  config: PDFExportConfig,
  citationData: { sourceUsage: Record<string, number> } | null
): Source[] {
  const sorted = [...sources]

  switch (config.sortBy) {
    case "title-asc":
      sorted.sort((a, b) => (a.title || "").localeCompare(b.title || ""))
      break
    case "title-desc":
      sorted.sort((a, b) => (b.title || "").localeCompare(a.title || ""))
      break
    case "date":
      sorted.sort((a, b) => {
        const dateA = a.publicationDate || ""
        const dateB = b.publicationDate || ""
        return dateB.localeCompare(dateA) // Newest first
      })
      break
    case "abbreviation":
      sorted.sort((a, b) => (a.abbreviation || "").localeCompare(b.abbreviation || ""))
      break
    case "apa":
      sorted.sort((a, b) => {
        const apaA = generateAPACitation(a)
        const apaB = generateAPACitation(b)
        return apaA.localeCompare(apaB)
      })
      break
  }

  return sorted
}

/**
 * Calculate text height for a given text and width
 */
function getTextHeight(doc: jsPDF, text: string, maxWidth: number, fontSize: number): number {
  if (!text || text.trim() === "") return fontSize * 1.15
  const lines = doc.splitTextToSize(text, maxWidth)
  return lines.length * fontSize * 1.15 // Line height multiplier
}

/**
 * Check if we need a new page and add it if necessary
 */
function checkPageBreak(doc: jsPDF, currentY: number, requiredHeight: number, margin: number, pageHeight: number): number {
  if (currentY + requiredHeight > pageHeight - margin) {
    doc.addPage()
    return margin
  }
  return currentY
}

/**
 * Generate PDF from sources
 */
/**
 * Map font name to jsPDF supported font
 * jsPDF supports: "helvetica", "times", "courier"
 */
function mapFontToJSPDF(fontName: string): string {
  const lower = fontName.toLowerCase()
  if (lower.includes("times") || lower.includes("times new roman") || lower.includes("georgia")) {
    return "times"
  }
  if (lower.includes("courier")) {
    return "courier"
  }
  // Default to helvetica (covers Helvetica, Arial, Calibri, Verdana, etc.)
  return "helvetica"
}

export function generatePDF(
  sources: Source[],
  config: PDFExportConfig,
  projectTitle: string,
  projectDescription: string | null,
  citationData: { sourceUsage: Record<string, number> } | null
): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  })

  // Map font to jsPDF supported font
  const pdfFont = mapFontToJSPDF(config.font)
  doc.setFont(pdfFont)
  doc.setFontSize(config.fontSize)

  // Page dimensions
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - 2 * margin
  let yPos = margin

  // Add header information
  if (config.includeProjectTitle) {
    doc.setFontSize(config.fontSize + 4)
    doc.setFont(pdfFont, "bold")
    doc.text(projectTitle, margin, yPos)
    yPos += 8
    doc.setFontSize(config.fontSize)
    doc.setFont(pdfFont, "normal")
  }

  if (config.includeProjectDescription && projectDescription) {
    const descLines = doc.splitTextToSize(projectDescription, contentWidth)
    doc.text(descLines, margin, yPos)
    yPos += descLines.length * config.fontSize * 1.15 + 3
  }

  if (config.includeAuthor && config.authorName) {
    doc.text(`Author: ${config.authorName}`, margin, yPos)
    yPos += config.fontSize * 1.15 + 2
  }

  if (config.includeDownloadDate) {
    const date = new Date().toLocaleDateString()
    doc.text(`Downloaded: ${date}`, margin, yPos)
    yPos += config.fontSize * 1.15 + 2
  }

  if (config.includeSourceManagerNote) {
    doc.text("Downloaded via Source Manager", margin, yPos)
    yPos += config.fontSize * 1.15 + 2
  }

  // Add spacing after header
  yPos += 3

  // Sort sources
  const sortedSources = sortSources(sources, config, citationData)

  // Get column headers
  const columns: string[] = []
  if (config.includedColumns.has("abbreviation")) columns.push("abbreviation")
  if (config.includedColumns.has("title")) columns.push("title")
  if (config.includedColumns.has("authors")) columns.push("authors")
  if (config.includedColumns.has("publicationDate")) columns.push("publicationDate")
  if (config.includedColumns.has("tags")) columns.push("tags")
  if (config.includedColumns.has("description")) columns.push("description")
  if (config.includedColumns.has("notes")) columns.push("notes")
  if (config.includedColumns.has("links")) columns.push("links")
  if (config.includedColumns.has("bibtex")) columns.push("bibtex")
  if (config.includeAPACitation) columns.push("apaCitation")
  if (config.includeCitationCount) columns.push("citationCount")

  if (config.format === "tabular") {
    // Tabular format
    const columnWidth = contentWidth / columns.length
    let startY = yPos

    // Draw header
    doc.setFont(pdfFont, "bold")
    columns.forEach((col, index) => {
      const xPos = margin + index * columnWidth
      const headerText = col === "publicationDate"
        ? "Publication Date"
        : col === "apaCitation"
        ? "APA Citation"
        : col === "citationCount"
        ? "Citations"
        : col.charAt(0).toUpperCase() + col.slice(1)
      doc.text(headerText, xPos, startY)
    })
    startY += 6
    doc.setFont(pdfFont, "normal")

    // Draw rows
    sortedSources.forEach((source) => {
      const citationCount = citationData?.sourceUsage[source.id] || 0

      // Calculate max height needed for this row
      let maxRowHeight = 0
      columns.forEach((col) => {
        const value = getColumnValue(source, col, citationCount)
        const cellHeight = getTextHeight(doc, value || "-", columnWidth - 2, config.fontSize)
        maxRowHeight = Math.max(maxRowHeight, cellHeight)
      })

      // Check if we need a new page before drawing
      startY = checkPageBreak(doc, startY, maxRowHeight + 2, margin, pageHeight)

      // Draw each cell
      columns.forEach((col, index) => {
        const xPos = margin + index * columnWidth
        const value = getColumnValue(source, col, citationCount)
        const lines = doc.splitTextToSize(value || "-", columnWidth - 2)
        doc.text(lines, xPos, startY)
      })

      startY += maxRowHeight + 2
    })
  } else {
    // List format
    sortedSources.forEach((source, sourceIndex) => {
      const citationCount = citationData?.sourceUsage[source.id] || 0

      // Calculate total height needed for this source
      let sourceHeight = 0
      if (sourceIndex > 0 && !config.newSourceForEachPage) {
        sourceHeight += 3 // Separator spacing
      }
      columns.forEach((col) => {
        const value = getColumnValue(source, col, citationCount)
        const labelWidth = 25
        const valueWidth = contentWidth - labelWidth
        const labelHeight = config.fontSize * 1.15
        const valueHeight = getTextHeight(doc, value || "-", valueWidth, config.fontSize)
        sourceHeight += Math.max(labelHeight, valueHeight) + 1.5 // Reduced spacing
      })

      // Check if we need a new page
      if (config.newSourceForEachPage && sourceIndex > 0) {
        doc.addPage()
        yPos = margin
      } else {
        // Check if source fits on current page
        if (yPos + sourceHeight > pageHeight - margin) {
          doc.addPage()
          yPos = margin
        }
      }

      // Add source separator (except for first source)
      if (sourceIndex > 0 && !config.newSourceForEachPage) {
        yPos += 2
        doc.setLineWidth(0.5)
        doc.line(margin, yPos, pageWidth - margin, yPos)
        yPos += 2
      }

      // Add each column
      columns.forEach((col) => {
        const label = col === "publicationDate"
          ? "Publication Date"
          : col === "apaCitation"
          ? "APA Citation"
          : col === "citationCount"
          ? "Citations"
          : col.charAt(0).toUpperCase() + col.slice(1)
        const value = getColumnValue(source, col, citationCount)

        const labelWidth = 25
        const valueWidth = contentWidth - labelWidth
        // Skip empty fields (but show "-" for empty values)
        const displayValue = value === "-" ? "-" : (value || "-")
        const valueLines = doc.splitTextToSize(displayValue, valueWidth)

        // Check if this field fits on current page, if not start new page
        const fieldHeight = Math.max(
          config.fontSize * 1.15,
          valueLines.length * config.fontSize * 1.15
        )
        
        if (yPos + fieldHeight > pageHeight - margin) {
          doc.addPage()
          yPos = margin
        }

        // Calculate label width to ensure proper spacing
        doc.setFont(pdfFont, "bold")
        const labelText = `${label}:`
        const labelWidthActual = doc.getTextWidth(labelText)
        const labelSpacing = Math.max(labelWidthActual + 3, labelWidth) // At least 3mm spacing after label
        
        doc.text(labelText, margin, yPos)
        doc.setFont(pdfFont, "normal")

        // Handle multi-line values with proper page breaks
        let currentY = yPos
        const valueStartX = margin + labelSpacing
        const valueWidth = contentWidth - labelSpacing
        
        // Recalculate value lines with correct width
        const valueLinesRecalc = doc.splitTextToSize(displayValue, valueWidth)
        
        valueLinesRecalc.forEach((line: string, lineIndex: number) => {
          const lineHeight = config.fontSize * 1.15
          
          // Check if line fits on current page
          if (currentY + lineHeight > pageHeight - margin) {
            doc.addPage()
            currentY = margin
            // Redraw label on new page if this is the first line
            if (lineIndex === 0) {
              doc.setFont(pdfFont, "bold")
              doc.text(labelText, margin, currentY)
              doc.setFont(pdfFont, "normal")
            }
          }
          
          doc.text(line, valueStartX, currentY)
          currentY += lineHeight
        })
        
        yPos = currentY + 1.5 // Reduced spacing between fields
      })
    })
  }

  return doc
}

/**
 * Download PDF
 */
export function downloadPDF(
  sources: Source[],
  config: PDFExportConfig,
  projectTitle: string,
  projectDescription: string | null,
  citationData: { sourceUsage: Record<string, number> } | null
): void {
  const doc = generatePDF(sources, config, projectTitle, projectDescription, citationData)
  const sanitizedTitle = projectTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase()
  const dateStr = new Date().toISOString().split("T")[0]
  doc.save(`${sanitizedTitle}_sources_${dateStr}.pdf`)
}

