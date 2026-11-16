/**
 * APA 7 reference generation from source data.
 *
 * Uses the source's own fields and, when the source carries BibTeX, its entry type and
 * bibliographic fields (journal, volume, pages, publisher, DOI, …) for a complete reference.
 */

import type { Source } from "@/types/sources"
import { parseBibtex } from "./bibtex"

/** A run of reference text; APA italicizes the title of standalone works or the periodical. */
export type CitationSegment = { text: string; italic?: boolean }

export type PersonName = { family: string; given: string[]; organization?: boolean; etAl?: boolean }

const ET_AL = /(?:,\s*|\s+)(?:et\.?\s*al\.?|u\.\s?a\.|and others)\s*$/i

const NAME_PARTICLES = new Set([
  "van", "von", "der", "den", "de", "del", "della", "di", "da", "du", "le", "la", "ter", "ten", "zu", "zur", "dos", "das", "al", "bin", "ibn",
])

const ORGANIZATION_PATTERN =
  /(^|[\s(])(inc|ltd|llc|gmbh|ag|e\.\s?v\.?|university|universit[äy]|hochschule|institute?|organi[sz]ation|association|verband|society|gesellschaft|council|rat|ministry|ministerium|bundes\p{L}*|agency|amt|committee|ausschuss|foundation|stiftung|group|gruppe|office|department|commission|kommission|bank|network|consortium|corporation|company|team|project|projekt|centre|center|zentrum|parliament|parlament|union|government|regierung|senate|congress|court|gericht|nations|board|federal|national|european|europ\p{L}*|w3c|ieee|iso|oecd|unesco|nasa)(?=$|[\s),.])/iu

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length
const looksLikeGiven = (text: string) => wordCount(text) <= 3 && /^[\p{Lu}][\p{L}.'\-]*(?:\s+[\p{Lu}][\p{L}.'\-]*)*$/u.test(text)

/** "Doe, Jane" / "García Márquez, Gabriel" / "Doe, J." — but not "Jane Doe, John Smith". */
function isInvertedName(part: string): boolean {
  const segments = part.split(",").map((s) => s.trim())
  if (segments.length !== 2 || !segments[0] || !segments[1]) return false
  if (wordCount(segments[0]) >= 2 && wordCount(segments[1]) >= 2 && !/^\p{Lu}\.?(\s|$)/u.test(segments[1])) return false
  return wordCount(segments[0]) <= 3 && looksLikeGiven(segments[1])
}

/** "Doe, Jane, Smith, John" → pairs; "Jane Doe, John Smith" → names. */
function expandCommaList(part: string): string[] {
  const segments = part.split(",").map((s) => s.trim()).filter(Boolean)
  if (segments.length <= 1) return segments
  if (segments.every((segment) => wordCount(segment) >= 2 && !/^\p{Lu}\.?(\s|$)/u.test(segment.split(/\s+/).at(-1) ?? ""))) {
    return segments
  }
  if (segments.length % 2 === 0) {
    const pairs: string[] = []
    let pairable = true
    for (let i = 0; i < segments.length; i += 2) {
      if (wordCount(segments[i]) > 3 || !looksLikeGiven(segments[i + 1])) pairable = false
      pairs.push(`${segments[i]}, ${segments[i + 1]}`)
    }
    if (pairable) return pairs
  }
  return segments
}

function parseSingleName(raw: string): PersonName | null {
  const text = raw.replace(/^\{(.*)\}$/, "$1").trim()
  if (!text) return null
  if (raw.trim().startsWith("{") || ORGANIZATION_PATTERN.test(text) || wordCount(text) >= 5) {
    return { family: text, given: [], organization: true }
  }
  if (text.includes(",")) {
    const [family, ...rest] = text.split(",").map((s) => s.trim())
    return { family, given: rest.join(" ").split(/\s+/).filter(Boolean) }
  }
  const words = text.split(/\s+/)
  if (words.length === 1) return { family: words[0], given: [] }
  let familyStart = words.length - 1
  while (familyStart > 1 && NAME_PARTICLES.has(words[familyStart - 1].toLowerCase())) familyStart -= 1
  return { family: words.slice(familyStart).join(" "), given: words.slice(0, familyStart) }
}

/** Parse the free-form authors field ("Doe, Jane; Smith, John", "Jane Doe and John Smith", …). */
export function parseAuthorNames(raw: string | null | undefined): PersonName[] {
  const normalized = (raw ?? "").replace(/\s+/g, " ").trim()
  const etAl = ET_AL.test(normalized)
  const text = normalized.replace(ET_AL, "").trim()
  if (!text) return []
  let names: string[]
  if (text.includes(";")) {
    names = text.split(";")
  } else if (/\s(?:and|und|&)\s/i.test(text)) {
    names = text.split(/\s+(?:and|und|&)\s+/i).flatMap((part) => {
      const cleaned = part.replace(/,\s*$/, "").trim()
      // "Doe, Jane" stays one name inside an and-list (BibTeX style).
      return isInvertedName(cleaned) ? [cleaned] : expandCommaList(cleaned)
    })
  } else {
    names = expandCommaList(text)
  }
  const parsed = names.map(parseSingleName).filter((name): name is PersonName => name !== null)
  return etAl ? [...parsed, { family: "et al.", given: [], etAl: true }] : parsed
}

function initials(given: string[]): string {
  return given
    .map((name) =>
      name
        .split("-")
        .map((part) => {
          const letter = part.replace(/[^\p{L}]/gu, "").charAt(0)
          return letter ? `${letter.toUpperCase()}.` : ""
        })
        .filter(Boolean)
        .join("-"),
    )
    .filter(Boolean)
    .join(" ")
}

function formatName(name: PersonName): string {
  if (name.organization || name.given.length === 0) return name.family
  return `${name.family}, ${initials(name.given)}`
}

export function formatApaAuthors(names: PersonName[]): string {
  if (names.at(-1)?.etAl) {
    const listed = formatApaAuthors(names.slice(0, -1))
    return listed ? `${listed.replace(/, & /, ", ")}, et al.` : ""
  }
  const formatted = names.map(formatName)
  if (formatted.length === 0) return ""
  if (formatted.length === 1) return formatted[0]
  if (formatted.length > 20) {
    return `${formatted.slice(0, 19).join(", ")}, . . . ${formatted[formatted.length - 1]}`
  }
  return `${formatted.slice(0, -1).join(", ")}, & ${formatted[formatted.length - 1]}`
}

function cleanBibtexValue(value: string | undefined): string {
  return (value ?? "")
    .replace(/\\([&%$#_])/g, "$1")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

const withPeriod = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`)
const pageRange = (pages: string) => pages.replace(/\s*-{1,2}\s*/g, "–")

function findDoi(source: Source, fields: Record<string, string>): string | null {
  const candidates = [fields.doi, source.links, source.bibtex].filter(Boolean).join(" ")
  const match = candidates.match(/\b(10\.\d{4,9}\/[^\s"<>{}]+[^\s"<>{}.,;)])/)
  return match ? `https://doi.org/${match[1]}` : null
}

function findUrl(source: Source, fields: Record<string, string>): string | null {
  if (fields.url) return cleanBibtexValue(fields.url)
  const match = source.links?.match(/https?:\/\/[^\s<>"]+[^\s<>".,;)]/)
  return match ? match[0] : null
}

function extractYear(source: Source, fields: Record<string, string>): string {
  const year = source.publicationDate?.match(/^(\d{4})/)?.[1] ?? fields.year?.match(/\d{4}/)?.[0]
  return year ?? "n.d."
}

function editionLabel(edition: string): string {
  const n = Number.parseInt(edition, 10)
  if (!Number.isFinite(n) || String(n) !== edition.trim()) return edition
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"
  return `${n}${suffix}`
}

/** Build an APA 7 reference as styled segments. */
export function generateApaReference(source: Source): CitationSegment[] {
  const entry = source.bibtex ? parseBibtex(source.bibtex) : null
  const fields: Record<string, string> = {}
  for (const [key, value] of Object.entries(entry?.fields ?? {})) fields[key] = cleanBibtexValue(value)
  const type = entry?.type ?? "misc"

  const authors = formatApaAuthors(parseAuthorNames(source.authors || fields.author))
  const year = extractYear(source, fields)
  const title = (source.title || fields.title || "").trim().replace(/\.$/, "")
  const link = findDoi(source, fields) ?? findUrl(source, fields)

  const out: CitationSegment[] = []
  const push = (text: string, italic = false) => {
    if (text) out.push(italic ? { text, italic } : { text })
  }

  // Parts of a larger whole keep a roman title; the container (journal, proceedings) is italic.
  const isPart = ["article", "inproceedings", "incollection", "inbook", "conference"].includes(type)
  const isThesis = type === "phdthesis" || type === "mastersthesis"

  let titleSuffix = ""
  if (!isPart) {
    if (fields.edition) titleSuffix = ` (${editionLabel(fields.edition)} ed.)`
    if ((type === "techreport" || type === "report") && fields.number) titleSuffix = ` (Report No. ${fields.number})`
    if (isThesis) {
      const kind = type === "phdthesis" ? "Doctoral dissertation" : "Master's thesis"
      titleSuffix = ` [${kind}${fields.school ? `, ${fields.school}` : ""}]`
    }
  }

  const pushTitle = () => {
    if (!title) return
    if (isPart) {
      push(`${withPeriod(title)} `)
      return
    }
    push(title, true)
    push(titleSuffix ? `${titleSuffix}. ` : /[.!?]$/.test(title) ? " " : ". ")
  }

  if (authors) {
    push(`${withPeriod(authors)} (${year}). `)
    pushTitle()
  } else {
    // No author: the title moves into the author position.
    pushTitle()
    push(`(${year}). `)
  }

  const container = fields.journal || fields.journaltitle || fields.booktitle || ""
  const publisher = fields.publisher || fields.institution || fields.organization || ""

  if (type === "article") {
    if (container) {
      push(container, true)
      if (fields.volume) {
        push(", ")
        push(fields.volume, true)
      }
      if (fields.number || fields.issue) push(`(${fields.number || fields.issue})`)
      if (fields.pages) push(`, ${pageRange(fields.pages)}`)
      push(". ")
    }
  } else if (isPart) {
    if (container) {
      push("In ")
      push(container, true)
      if (fields.pages) push(` (pp. ${pageRange(fields.pages)})`)
      push(". ")
    }
    if (publisher) push(`${withPeriod(publisher)} `)
  } else if (!isThesis) {
    if (publisher) push(`${withPeriod(publisher)} `)
    else if (fields.howpublished && !/^\\?url/i.test(fields.howpublished)) push(`${withPeriod(fields.howpublished)} `)
  }

  if (link) push(link)

  const last = out[out.length - 1]
  if (last) last.text = last.text.replace(/\s+$/, "")
  return out
}

/** Plain-text APA reference. */
export function generateAPACitation(source: Source): string {
  return generateApaReference(source)
    .map((segment) => segment.text)
    .join("")
}
