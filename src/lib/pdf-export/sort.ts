import type { Source } from "@/types/sources"
import { parseAuthorNames } from "@/lib/apa-citation"
import type { PdfSortKey } from "./config"

const text = (value: string | null | undefined) => value?.trim() ?? ""

/** Sort for the document. Empty values go last; ties fall back to the title. */
export function sortSourcesForPdf(sources: Source[], sortBy: PdfSortKey, locale: string): Source[] {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: "base" })
  const compareText = (a: string, b: string) => {
    if (!a || !b) return a ? -1 : b ? 1 : 0
    return collator.compare(a, b)
  }
  const firstAuthor = (source: Source) => {
    const [first] = parseAuthorNames(source.authors)
    return first ? `${first.family} ${first.given.join(" ")}` : ""
  }
  const compareDate = (a: Source, b: Source) => {
    const da = text(a.publicationDate)
    const db = text(b.publicationDate)
    if (!da || !db) return compareText(da, db)
    return sortBy === "newest" ? db.localeCompare(da) : da.localeCompare(db)
  }

  const keyed = sources.map((source) => ({ source, author: sortBy === "authors" ? firstAuthor(source) : "" }))
  keyed.sort((a, b) => {
    let result = 0
    if (sortBy === "abbreviation") result = compareText(text(a.source.abbreviation), text(b.source.abbreviation))
    else if (sortBy === "authors") result = compareText(a.author, b.author)
    else if (sortBy === "newest" || sortBy === "oldest") result = compareDate(a.source, b.source)
    return result || compareText(text(a.source.title), text(b.source.title))
  })
  return keyed.map(({ source }) => source)
}
