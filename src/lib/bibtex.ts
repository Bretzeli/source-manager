// BibTeX parsing and serialization utilities

import { splitOutsideBraces } from "./authors"

export interface BibtexEntry {
  type: string
  key: string
  fields: Record<string, string>
}

/** An entry read from a BibTeX document, together with its original text. */
export interface ParsedBibtexEntry extends BibtexEntry {
  /** The entry as written in the document, from "@" to its closing delimiter. */
  raw: string
  /**
   * Whether `raw` reads back to the same entry on its own. It doesn't when a value references an
   * @string abbreviation defined elsewhere in the document, or when the entry is cut off.
   */
  standalone: boolean
  /** Whether other entries in the document inherit fields from this one via crossref. */
  crossrefParent: boolean
}

class BibtexSyntaxError extends Error {}

type Cursor = { text: string; i: number }

/** Month abbreviations that every BibTeX style predefines. */
const MONTH_MACROS = new Map([
  ["jan", "January"], ["feb", "February"], ["mar", "March"], ["apr", "April"],
  ["may", "May"], ["jun", "June"], ["jul", "July"], ["aug", "August"],
  ["sep", "September"], ["oct", "October"], ["nov", "November"], ["dec", "December"],
])

const ENTRY_TYPE = /[A-Za-z]+/y
const IDENTIFIER = /[^\s"#%'(),={}@]+/y
const KEY_IN_BRACES = /[^\s,}]*/y
const KEY_IN_PARENS = /[^\s,)]*/y

function readMatch(cur: Cursor, pattern: RegExp): string {
  pattern.lastIndex = cur.i
  const match = pattern.exec(cur.text)
  if (!match) return ""
  cur.i += match[0].length
  return match[0]
}

/** Skip whitespace and "%" line comments between tokens. */
function skipWhitespace(cur: Cursor) {
  const { text } = cur
  while (cur.i < text.length) {
    const c = text[cur.i]
    if (c === "%") {
      const newline = text.indexOf("\n", cur.i)
      cur.i = newline === -1 ? text.length : newline + 1
    } else if (/\s/.test(c)) {
      cur.i++
    } else {
      break
    }
  }
}

/** Read a {braced} or "quoted" value part; null when the input ends first. */
function readDelimited(cur: Cursor): string | null {
  const { text } = cur
  const quoted = text[cur.i] === '"'
  let value = ""
  let from = cur.i + 1
  let depth = 0
  for (let i = from; i < text.length; i++) {
    const c = text[i]
    if (c === "{") {
      depth++
    } else if (c === "}") {
      if (depth === 0) {
        if (quoted) throw new BibtexSyntaxError()
        cur.i = i + 1
        return value + text.slice(from, i)
      }
      depth--
    } else if (quoted && depth === 0 && c === "\\" && text[i + 1] === '"') {
      // Not valid BibTeX, but earlier versions of serializeBibtex escaped quotes this way.
      value += text.slice(from, i) + '"'
      from = i + 2
      i++
    } else if (quoted && depth === 0 && c === '"') {
      cur.i = i + 1
      return value + text.slice(from, i)
    }
  }
  return null
}

/**
 * Read a field value: braced, quoted, numeric or abbreviation parts joined with "#".
 * Returns null when the input ends before the value does.
 */
function readValue(cur: Cursor, macros: Map<string, string>): { text: string; usesMacros: boolean } | null {
  const { text } = cur
  let value = ""
  let usesMacros = false
  while (true) {
    skipWhitespace(cur)
    if (cur.i >= text.length) return null
    const c = text[cur.i]
    if (c === "{" || c === '"') {
      const part = readDelimited(cur)
      if (part === null) return null
      value += part
    } else {
      const token = readMatch(cur, IDENTIFIER)
      if (!token) throw new BibtexSyntaxError()
      const name = token.toLowerCase()
      if (/^\d+$/.test(token)) {
        value += token
      } else if (macros.has(name)) {
        value += macros.get(name)
        usesMacros = true
      } else if (MONTH_MACROS.has(name)) {
        value += MONTH_MACROS.get(name)
      } else {
        // An abbreviation defined outside this document (e.g. by a style): keep its name.
        value += token
        usesMacros = true
      }
    }
    skipWhitespace(cur)
    if (cur.i >= text.length) return null
    if (text[cur.i] !== "#") break
    cur.i++
  }
  return { text: value.replace(/\s+/g, " ").trim(), usesMacros }
}

/** Skip the body of an @comment or @preamble block up to its closing delimiter. */
function skipBody(cur: Cursor, close: string) {
  const { text } = cur
  let depth = 0
  for (; cur.i < text.length; cur.i++) {
    const c = text[cur.i]
    if (c === "{") {
      depth++
    } else if (c === "}") {
      if (depth === 0 && close === "}") break
      depth--
    } else if (c === ")" && depth === 0 && close === ")") {
      break
    }
  }
  cur.i++
}

/** Read one "@type{...}" block; the cursor starts right after the "@". */
function readBlock(
  cur: Cursor,
  macros: Map<string, string>,
): Omit<ParsedBibtexEntry, "raw" | "crossrefParent"> | null {
  const { text } = cur
  skipWhitespace(cur)
  const type = readMatch(cur, ENTRY_TYPE).toLowerCase()
  if (!type) throw new BibtexSyntaxError()
  skipWhitespace(cur)
  const open = text[cur.i]
  if (open !== "{" && open !== "(") throw new BibtexSyntaxError()
  const close = open === "{" ? "}" : ")"
  cur.i++

  if (type === "comment" || type === "preamble") {
    skipBody(cur, close)
    return null
  }

  if (type === "string") {
    skipWhitespace(cur)
    const name = readMatch(cur, IDENTIFIER)
    skipWhitespace(cur)
    if (!name || text[cur.i] !== "=") throw new BibtexSyntaxError()
    cur.i++
    const value = readValue(cur, macros)
    if (!value) throw new BibtexSyntaxError()
    macros.set(name.toLowerCase(), value.text)
    skipWhitespace(cur)
    if (text[cur.i] === close) cur.i++
    return null
  }

  skipWhitespace(cur)
  const key = readMatch(cur, close === "}" ? KEY_IN_BRACES : KEY_IN_PARENS)
  skipWhitespace(cur)
  // Only accept the key once something ends it, so a half-typed key isn't taken as complete.
  if (cur.i >= text.length) throw new BibtexSyntaxError()

  const fields = new Map<string, string>()
  let usesMacros = false
  let complete = false
  while (true) {
    skipWhitespace(cur)
    // The input ended, or the next entry starts because this one lacks its closing delimiter:
    // keep the fields read so far.
    if (cur.i >= text.length || text[cur.i] === "@") break
    if (text[cur.i] === close) {
      cur.i++
      complete = true
      break
    }
    if (text[cur.i] !== ",") throw new BibtexSyntaxError()
    cur.i++
    skipWhitespace(cur)
    if (cur.i >= text.length || text[cur.i] === "@") break
    if (text[cur.i] === close) {
      cur.i++
      complete = true
      break
    }
    const name = readMatch(cur, IDENTIFIER).toLowerCase()
    if (!name) throw new BibtexSyntaxError()
    skipWhitespace(cur)
    if (cur.i >= text.length) break
    if (text[cur.i] !== "=") throw new BibtexSyntaxError()
    cur.i++
    const value = readValue(cur, macros)
    if (!value) break
    if (!fields.has(name)) fields.set(name, value.text)
    usesMacros = usesMacros || value.usesMacros
  }

  return { type, key, fields: Object.fromEntries(fields), standalone: complete && !usesMacros }
}

/** Fields that describe the parent itself, so a crossref child never inherits them (as in biblatex). */
const NON_INHERITED_FIELDS = new Set([
  "crossref", "xref", "ids", "label", "shorthand", "sortkey", "options", "entryset", "related",
  "title", "subtitle", "titleaddon", "shorttitle", "sorttitle", "indextitle", "indexsorttitle",
])

const DATE_FIELDS = new Set(["date", "year", "month", "day"])

/** The child field that a parent's title fills, by parent type (biblatex's default mapping). */
const CONTAINER_TITLE_FIELDS: Record<string, string[] | undefined> = {
  book: ["booktitle"], collection: ["booktitle"], proceedings: ["booktitle"], reference: ["booktitle"],
  mvbook: ["maintitle"], mvcollection: ["maintitle"], mvproceedings: ["maintitle"], mvreference: ["maintitle"],
  periodical: ["journal", "journaltitle"],
}

/**
 * Give every entry with a crossref field the fields it lacks from the entry it references, as
 * BibTeX does. As in biblatex, the parent's title becomes the child's booktitle (maintitle for a
 * multi-volume work, journal for a @periodical), and chains of crossrefs are followed. A resolved
 * entry drops its crossref field, so it no longer depends on the parent.
 */
function resolveCrossrefs(entries: ParsedBibtexEntry[]): ParsedBibtexEntry[] {
  const byKey = new Map<string, ParsedBibtexEntry>()
  for (const entry of entries) {
    const key = entry.key.toLowerCase()
    if (!byKey.has(key)) byKey.set(key, entry)
  }
  const parents = new Set<ParsedBibtexEntry>()
  const resolved = new Map<ParsedBibtexEntry, Record<string, string>>()

  const resolve = (entry: ParsedBibtexEntry, visiting: Set<ParsedBibtexEntry>): Record<string, string> => {
    const done = resolved.get(entry)
    if (done) return done
    let fields = entry.fields
    const parent = byKey.get((entry.fields.crossref ?? "").trim().toLowerCase())
    if (parent && parent !== entry && !visiting.has(parent)) {
      visiting.add(entry)
      const parentFields = resolve(parent, visiting)
      const merged = new Map(Object.entries(entry.fields))
      merged.delete("crossref")
      // The direct parent's title comes first, so it wins over titles inherited from further up.
      const container = CONTAINER_TITLE_FIELDS[parent.type]
      if (container && parentFields.title && !container.some((name) => merged.has(name))) {
        merged.set(container[0], parentFields.title)
      }
      // The date is inherited as a whole: a child with its own year keeps the parent's month out.
      const hasOwnDate = merged.has("date") || merged.has("year")
      for (const [name, value] of Object.entries(parentFields)) {
        if (merged.has(name) || NON_INHERITED_FIELDS.has(name)) continue
        if (hasOwnDate && DATE_FIELDS.has(name)) continue
        merged.set(name, value)
      }
      fields = Object.fromEntries(merged)
      parents.add(parent)
    }
    resolved.set(entry, fields)
    return fields
  }

  for (const entry of entries) resolve(entry, new Set())
  return entries.map((entry) => {
    const fields = resolved.get(entry) ?? entry.fields
    return {
      ...entry,
      fields,
      standalone: entry.standalone && fields === entry.fields,
      crossrefParent: parents.has(entry),
    }
  })
}

/**
 * Parse every entry of a BibTeX document, such as a .bib file.
 *
 * Follows BibTeX's rules: text outside entries is ignored, @comment and @preamble blocks are
 * skipped, values may be braced, quoted, numeric or @string abbreviations joined with "#", and
 * entries inherit missing fields through crossref. A malformed entry is skipped without
 * affecting the entries after it. Field values keep their inner braces and LaTeX markup; see
 * `latexToText` for display text.
 */
export function parseBibtexEntries(text: string): ParsedBibtexEntry[] {
  const entries: ParsedBibtexEntry[] = []
  const macros = new Map<string, string>()
  let from = 0
  while (true) {
    const start = text.indexOf("@", from)
    if (start === -1) break
    const cur: Cursor = { text, i: start + 1 }
    try {
      const entry = readBlock(cur, macros)
      if (entry) entries.push({ ...entry, raw: text.slice(start, cur.i).trim(), crossrefParent: false })
      from = cur.i
    } catch (error) {
      if (!(error instanceof BibtexSyntaxError)) throw error
      from = start + 1
    }
  }
  return resolveCrossrefs(entries)
}

/**
 * Parse a BibTeX string into structured data (its first entry)
 */
export function parseBibtex(bibtex: string): BibtexEntry | null {
  if (!bibtex || !bibtex.trim()) return null
  const [entry] = parseBibtexEntries(bibtex)
  return entry ? { type: entry.type, key: entry.key, fields: entry.fields } : null
}

/** Braces are BibTeX's preferred delimiter and need no escaping as long as they balance. */
function formatBibtexValue(value: string): string {
  let depth = 0
  for (const c of value) {
    if (c === "{") depth++
    else if (c === "}" && --depth < 0) break
  }
  if (depth === 0) return `{${value}}`
  return `"${value.replace(/"/g, '\\"')}"`
}

/**
 * Convert structured data to BibTeX format
 */
export function serializeBibtex(entry: BibtexEntry): string {
  const { type, key, fields } = entry

  let bibtex = `@${type}{${key},\n`

  const fieldEntries = Object.entries(fields)
  fieldEntries.forEach(([name, value], index) => {
    bibtex += `  ${name} = ${formatBibtexValue(value)}`
    if (index < fieldEntries.length - 1) {
      bibtex += ","
    }
    bibtex += "\n"
  })

  bibtex += "}"

  return bibtex
}

/** Combining marks for LaTeX accent commands. */
const ACCENT_MARKS: Record<string, string> = {
  "`": "̀", "'": "́", "^": "̂", "~": "̃", "=": "̄", u: "̆",
  ".": "̇", '"': "̈", r: "̊", H: "̋", v: "̌", d: "̣",
  c: "̧", k: "̨", b: "̱",
}

// Private-use stand-ins for literal characters that the markup steps would otherwise remove.
const LITERAL = { "{": "", "}": "", $: "", "~": "", "\\": "" }
const FROM_LITERAL = new Map(Object.entries(LITERAL).map(([char, stand]) => [stand, char]))

const TEXT_SYMBOLS = new Map([
  ["ss", "ß"], ["ae", "æ"], ["AE", "Æ"], ["oe", "œ"], ["OE", "Œ"], ["aa", "å"], ["AA", "Å"],
  ["o", "ø"], ["O", "Ø"], ["l", "ł"], ["L", "Ł"], ["i", "ı"], ["j", "ȷ"], ["relax", ""],
  ["textendash", "–"], ["textemdash", "—"], ["dots", "…"], ["ldots", "…"], ["textellipsis", "…"],
  ["textquoteleft", "‘"], ["textquoteright", "’"], ["textquotedblleft", "“"], ["textquotedblright", "”"],
  ["guillemotleft", "«"], ["guillemotright", "»"], ["S", "§"], ["P", "¶"], ["pounds", "£"],
  ["euro", "€"], ["texteuro", "€"], ["textdegree", "°"], ["textregistered", "®"],
  ["texttrademark", "™"], ["textcopyright", "©"], ["copyright", "©"], ["textunderscore", "_"],
  ["textasciitilde", LITERAL["~"]], ["textbackslash", LITERAL["\\"]],
])

function accented(mark: string, base: string): string {
  const letter = base === "\\i" ? "i" : base === "\\j" ? "j" : base
  return (letter + ACCENT_MARKS[mark]).normalize("NFC")
}

/**
 * Turn a BibTeX field value into plain text: resolves accents ({\"u} → ü), special letters
 * (\ss → ß), escaped characters and dashes, and drops braces, math delimiters and formatting
 * commands (\emph{x} → x).
 */
export function latexToText(value: string): string {
  return value
    .replace(/\\\\/g, " ")
    .replace(/\\~\{\}/g, LITERAL["~"])
    .replace(/\\([{}$])/g, (_, c: "{" | "}" | "$") => LITERAL[c])
    .replace(
      /\\(["'`^~=.])\s*(?:\{\s*(\\[ij]|[A-Za-z])\s*\}|(\\[ij](?![A-Za-z])|[A-Za-z]))/g,
      (_, mark: string, braced?: string, bare?: string) => accented(mark, braced ?? bare ?? ""),
    )
    .replace(
      /\\([uvHckrdb])(?:\s*\{\s*(\\[ij]|[A-Za-z])\s*\}|\s+(\\[ij](?![A-Za-z])|[A-Za-z]))/g,
      (_, mark: string, braced?: string, bare?: string) => accented(mark, braced ?? bare ?? ""),
    )
    .replace(/\\([A-Za-z]+)\*?(\s*)(\{\}?)?/g, (_, name: string, space: string, group?: string) => {
      const symbol = TEXT_SYMBOLS.get(name)
      if (symbol !== undefined) return group === "{" ? symbol + group : symbol
      // A command applied to a group (\emph{x}, \url{x}) leaves the group's text.
      if (group === "{") return group
      // Other commands (\LaTeX, \LaTeX{}) keep their name.
      return group ? name : name + space
    })
    .replace(/~/g, " ")
    .replace(/\$/g, "")
    .replace(/[{}]/g, "")
    .replace(/\\([^A-Za-z])/g, (_, c: string) => (",;: ".includes(c) ? " " : "!-/".includes(c) ? "" : c))
    .replace(/---/g, "—")
    .replace(/--/g, "–")
    .replace(/``/g, "“")
    .replace(/''/g, "”")
    .replace(/[-]/g, (stand) => FROM_LITERAL.get(stand) ?? stand)
    .replace(/\s+/g, " ")
    .trim()
    .normalize("NFC")
}

/**
 * A BibTeX name as text for the authors field. Special characters are resolved ({\"u} → ü),
 * but grouping braces are kept: "{Barnes and Noble}" stays one name (see lib/authors.ts).
 */
function bibtexNameToText(name: string): string {
  // Mark top-level groups that don't start with a command as literal braces, which latexToText keeps.
  let marked = ""
  let depth = 0
  let grouping = false
  for (let i = 0; i < name.length; i++) {
    const c = name[i]
    if (c === "{") {
      if (depth++ === 0 && name[i + 1] !== "\\" && name[i + 1] !== "}") {
        grouping = true
        marked += LITERAL["{"]
        continue
      }
    } else if (c === "}" && depth > 0) {
      if (--depth === 0 && grouping) {
        grouping = false
        marked += LITERAL["}"]
        continue
      }
    }
    marked += c
  }
  return latexToText(marked)
}

const MONTH_NUMBERS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, "mär": 3, apr: 4, may: 5, mai: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, dez: 12,
}

/** "jan", "January", "Januar", "1", "01" → "01" */
function monthNumber(value: string | undefined): string | undefined {
  const cleaned = (value ?? "").replace(/[{}.~]/g, " ").trim().toLowerCase()
  if (!cleaned) return undefined
  const n = /^\d{1,2}$/.test(cleaned) ? Number(cleaned) : MONTH_NUMBERS[cleaned.slice(0, 3)]
  return n >= 1 && n <= 12 ? String(n).padStart(2, "0") : undefined
}

/** The publication date as yyyy, yyyy-mm or yyyy-mm-dd, from biblatex's date or year/month/day. */
function bibtexPublicationDate(fields: Record<string, string>): string | undefined {
  const date = fields.date?.replace(/[{}]/g, "").match(/^\s*(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/)
  if (date) return [date[1], date[2], date[3]].filter(Boolean).join("-")

  const year = fields.year?.match(/\d{4}/)?.[0]
  if (!year) return undefined
  const month = monthNumber(fields.month)
  if (!month) return year
  const day = Number(fields.day?.replace(/[{}]/g, "").trim())
  return Number.isInteger(day) && day >= 1 && day <= 31
    ? `${year}-${month}-${String(day).padStart(2, "0")}`
    : `${year}-${month}`
}

/** A URL from a BibTeX value, without \url{} or escapes. */
function cleanUrl(value: string): string {
  return value
    .replace(/\\url\s*\{([^}]*)\}/, "$1")
    .replace(/[{}]/g, "")
    .replace(/\\([_%&#~$])/g, "$1")
    .trim()
}

/** URL, DOI and arXiv links of an entry, one per line. */
function bibtexLinks(fields: Record<string, string>): string | undefined {
  const links: string[] = []
  // @misc entries for web pages often carry the URL in howpublished = {\url{...}}
  const url = cleanUrl(fields.url || fields.howpublished?.match(/\\url\s*\{[^}]*\}|https?:\/\/[^\s{}]+/)?.[0] || "")
  if (url) links.push(url)
  if (fields.doi) {
    const doi = cleanUrl(fields.doi).replace(/^doi:\s*/i, "")
    if (doi) links.push(/^https?:\/\//i.test(doi) ? doi : `https://doi.org/${doi}`)
  }
  const archive = (fields.archiveprefix || fields.eprinttype || "").toLowerCase()
  if (archive === "arxiv" && fields.eprint) {
    links.push(`https://arxiv.org/abs/${cleanUrl(fields.eprint)}`)
  }
  const unique = [...new Set(links)]
  return unique.length > 0 ? unique.join("\n") : undefined
}

/**
 * Extract source fields from a BibTeX entry
 */
export function bibtexToSourceFields(bibtexEntry: BibtexEntry): {
  title?: string
  authors?: string
  publicationDate?: string
  abbreviation?: string
  description?: string
  notes?: string
  links?: string
} {
  const fields = bibtexEntry.fields

  const title = latexToText(fields.title || fields.booktitle || "")
  // Authors are shown semicolon-separated in the UI; BibTeX's "others" means "et al."
  const authors = splitOutsideBraces(fields.author || fields.editor || "", /\s+and\s+/i)
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => (name.toLowerCase() === "others" ? "et al." : bibtexNameToText(name)))
    .filter(Boolean)
    .join("; ")
  // sourceFieldsToBibtex writes the description to "note", so read it back from there.
  const description = latexToText(fields.abstract || fields.note || "")
  const notes = latexToText(fields.annote || fields.annotation || "")

  return {
    title: title || undefined,
    authors: authors || undefined,
    publicationDate: bibtexPublicationDate(fields),
    abbreviation: bibtexEntry.key || undefined,
    description: description || undefined,
    notes: notes || undefined,
    links: bibtexLinks(fields),
  }
}

/**
 * Convert source fields to BibTeX entry
 */
export function sourceFieldsToBibtex(data: {
  abbreviation: string | null | undefined
  title: string
  authors?: string | null
  publicationDate?: string | null
  description?: string | null
  notes?: string | null
  links?: string | null
}): BibtexEntry {
  const fields: Record<string, string> = {}

  if (data.title) fields.title = data.title
  // Convert semicolon-separated authors to BibTeX "and" format; braced names stay one name
  if (data.authors) {
    fields.author = splitOutsideBraces(data.authors, /;/)
      .map((a) => a.trim())
      .filter(Boolean)
      .map((a) => (/^et\.?\s*al\.?$/i.test(a) ? "others" : a))
      .join(" and ")
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
