/** Locale-aware text formatting for the document. */

/** "2020" → "2020", "2020-05" → "May 2020", "2020-05-12" → "12 May 2020" (in the UI locale). */
export function formatPublicationDate(value: string | null | undefined, locale: string): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const match = trimmed.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/)
  if (!match) return trimmed
  const [, year, month, day] = match
  // The app stores year-only and month-only dates as YYYY-01-01 / YYYY-MM-01.
  const hasMonth = month && !(month === "01" && day === "01")
  const hasDay = hasMonth && day && day !== "01"
  if (!hasMonth) return year
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, hasDay ? Number(day) : 1))
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      ...(hasDay ? { day: "numeric" } : {}),
      timeZone: "UTC",
    }).format(date)
  } catch {
    return trimmed
  }
}

export function formatLongDate(date: Date, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

export type LinkPart = { text: string; href?: string }

const URL_PATTERN = /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+)/gi

/** Split free text into lines of plain and linked parts (same rules as the table's link rendering). */
export function linkifyLines(value: string): LinkPart[][] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts: LinkPart[] = []
      let last = 0
      for (const match of line.matchAll(URL_PATTERN)) {
        // Keep closing punctuation out of the link.
        const raw = match[0].replace(/[.,;:!?)\]]+$/, "")
        const index = match.index ?? 0
        if (index > last) parts.push({ text: line.slice(last, index) })
        parts.push({ text: raw, href: raw.startsWith("http") ? raw : `https://${raw}` })
        last = index + raw.length
      }
      if (last < line.length) parts.push({ text: line.slice(last) })
      return parts
    })
}

/** Paragraphs of a plain-text field (blank lines separate paragraphs; single newlines are kept). */
export function plainParagraphs(value: string): string[] {
  return value
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

/** A short, human URL for print: no protocol, no trailing slash. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "")
}
