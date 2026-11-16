/**
 * Page geometry and type sizes (pt), shared by the PDF and the dialog's preview so the two
 * can't drift apart. A4 with generous margins; the text column is set to a comfortable measure.
 */
export const PAGE = { width: 595.28, height: 841.89 }
export const MARGIN_X = 64
export const MARGIN_TOP = 62
export const MARGIN_BOTTOM = 76
export const KEY_SIZE = 7.4
/** JetBrains Mono advance width per em. */
export const MONO_ADVANCE = 0.6

export const SIZE = {
  overline: 7,
  title: 30,
  lede: 11.5,
  metaLabel: 6.3,
  metaValue: 9,
  entryTitle: 11.6,
  byline: 8,
  chip: 6.5,
  body: 9.4,
  notes: 9,
  label: 6.1,
  link: 8,
  citation: 8.8,
  bibtex: 6.9,
  footer: 7,
}

/** Width of the key column: sized to the longest key so the text column lines up throughout. */
export function keyColumnWidth(keys: Array<string | null | undefined>, showKeys: boolean, count: number): number {
  const longest = showKeys
    ? Math.max(0, ...keys.map((key) => [...(key?.trim() ?? "")].length))
    : Math.max(2, String(count).length)
  return Math.min(116, Math.max(showKeys ? 50 : 32, longest * KEY_SIZE * MONO_ADVANCE + 14))
}
