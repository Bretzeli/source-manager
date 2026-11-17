"use client"

import { useMemo, type CSSProperties } from "react"
import type { Source } from "@/types/sources"
import { generateAPACitation } from "@/lib/apa-citation"
import { stripBraces } from "@/lib/authors"
import type { PdfDocumentStrings, PdfExportConfig } from "@/lib/pdf-export/config"
import { formatLongDate, formatPublicationDate } from "@/lib/pdf-export/format"
import { KEY_SIZE, MARGIN_TOP, MARGIN_X, PAGE, QR_SIZE, QR_TILE_PADDING, SIZE, keyColumnWidth } from "@/lib/pdf-export/metrics"
import { getPdfPalette, tagChipColors } from "@/lib/pdf-export/palette"
import { createQrCode } from "@/lib/pdf-export/qr"

const SERIF = '"Source Serif 4", Georgia, serif'
const SANS = '"Inter", system-ui, sans-serif'
const MONO = '"JetBrains Mono", ui-monospace, monospace'

/** Enough entries to fill the first page; anything beyond is clipped anyway. */
const PREVIEW_ENTRIES = 6

function plainText(markdown: string | null | undefined): string {
  return (markdown ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_`~|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

const PAGE_FRAME =
  "relative overflow-hidden rounded-[2px] shadow-[0_1px_2px_rgba(0,0,0,0.08),0_8px_24px_-6px_rgba(0,0,0,0.18)] ring-1 ring-black/5 dark:ring-white/10"

const clamp = (lines: number): CSSProperties => ({
  display: "-webkit-box",
  WebkitLineClamp: lines,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
})

const label = (color: string): CSSProperties => ({
  fontFamily: SANS,
  fontWeight: 600,
  fontSize: SIZE.label,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  color,
  marginBottom: 4,
})

/**
 * A faithful, scaled-down first page: same palette, metrics and order as the PDF, laid out
 * in HTML with the same typefaces so changes to the options show up instantly.
 */
export function PdfExportPreview({
  sources,
  config,
  projectTitle,
  projectDescription,
  strings,
  locale,
  width,
}: {
  /** Sources in final order. */
  sources: Source[]
  config: PdfExportConfig
  projectTitle: string
  projectDescription: string | null
  strings: PdfDocumentStrings
  locale: string
  width: number
}) {
  const palette = useMemo(() => getPdfPalette(config.themeId, config.mode), [config.themeId, config.mode])
  const scale = width / PAGE.width
  const fields = new Set<string>(config.fields)
  const showKeys = fields.has("abbreviation")
  const keyWidth = keyColumnWidth(
    sources.map((source) => source.abbreviation),
    showKeys,
    sources.length,
  )

  const meta: Array<[string, string]> = []
  if (config.includeAuthor && config.authorName.trim()) meta.push([strings.preparedBy, config.authorName.trim()])
  if (config.includeDownloadDate) meta.push([strings.date, formatLongDate(new Date(), locale)])
  meta.push([strings.count, new Intl.NumberFormat(locale).format(sources.length)])

  return (
    <div
      className={PAGE_FRAME}
      style={{ width, height: PAGE.height * scale }}
      aria-hidden
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: PAGE.width,
          height: PAGE.height,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
          background: palette.paper,
          color: palette.body,
          padding: `${MARGIN_TOP}px ${MARGIN_X}px 0`,
          fontFamily: SERIF,
          transition: "background-color 200ms ease, color 200ms ease",
        }}
      >
        {config.overline.trim() ? (
          <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: SIZE.overline, letterSpacing: 1.6, textTransform: "uppercase", color: palette.accent }}>
            {config.overline.trim()}
          </div>
        ) : null}
        {config.includeProjectTitle && projectTitle.trim() ? (
          <div style={{ fontSize: SIZE.title, lineHeight: 1.12, letterSpacing: -0.3, marginTop: 14, color: palette.ink, ...clamp(2) }}>
            {projectTitle.trim()}
          </div>
        ) : null}
        {config.includeProjectDescription && projectDescription?.trim() ? (
          <div style={{ fontSize: SIZE.lede, lineHeight: 1.5, marginTop: 12, maxWidth: 410, ...clamp(3) }}>{projectDescription.trim()}</div>
        ) : null}
        <div style={{ display: "flex", flexWrap: "wrap", columnGap: 34, rowGap: 10, marginTop: 24 }}>
          {meta.map(([key, value]) => (
            <div key={key}>
              <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: SIZE.metaLabel, letterSpacing: 1.1, textTransform: "uppercase", color: palette.muted }}>
                {key}
              </div>
              <div style={{ fontFamily: SANS, fontSize: SIZE.metaValue, marginTop: 3.5, color: palette.ink }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ height: 0.8, marginTop: 26, marginBottom: 6, background: palette.ink }} />

        {sources.slice(0, PREVIEW_ENTRIES).map((source, index) => {
          const key = showKeys ? source.abbreviation?.trim() ?? "" : String(index + 1).padStart(Math.max(2, String(sources.length).length), "0")
          const authors = fields.has("authors") ? stripBraces(source.authors ?? "").trim() : ""
          const date = fields.has("publicationDate") ? formatPublicationDate(source.publicationDate, locale) : null
          const description = fields.has("description") ? plainText(source.description) : ""
          const notes = fields.has("notes") ? plainText(source.notes) : ""
          const link = fields.has("links") ? source.links?.split(/\r?\n/).find((line) => line.trim())?.trim() : ""
          const bibtex = fields.has("bibtex") ? source.bibtex?.trim() : ""
          return (
            <div
              key={source.id}
              style={{
                padding: index === 0 ? "22px 0 17px" : "17px 0",
                borderTop: index === 0 ? undefined : `0.6px solid ${palette.rule}`,
              }}
            >
              <div style={{ display: "flex" }}>
                <div
                  style={{
                    width: keyWidth,
                    flexShrink: 0,
                    paddingTop: (SIZE.entryTitle - KEY_SIZE) * 0.82,
                    paddingRight: 12,
                    fontFamily: MONO,
                    fontWeight: 500,
                    fontSize: KEY_SIZE,
                    lineHeight: 1.3,
                    color: showKeys ? palette.accent : palette.faint,
                    overflowWrap: "anywhere",
                  }}
                >
                  {key}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {fields.has("title") ? (
                    <div style={{ fontWeight: 600, fontSize: SIZE.entryTitle, lineHeight: 1.3, color: source.title?.trim() ? palette.ink : palette.faint }}>
                      {source.title?.trim() || strings.untitled}
                    </div>
                  ) : null}
                  {authors || date ? (
                    <div style={{ fontFamily: SANS, fontSize: SIZE.byline, lineHeight: 1.45, marginTop: 2.5, color: palette.muted, ...clamp(2) }}>
                      {authors ? <span style={{ color: palette.body }}>{authors}</span> : null}
                      {authors && date ? "   ·   " : null}
                      {date}
                    </div>
                  ) : null}
                  {fields.has("tags") && source.tags.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3.5, marginTop: 7 }}>
                      {source.tags.map((tag) => {
                        const colors = tagChipColors(tag.color, palette)
                        return (
                          <span
                            key={tag.id}
                            style={{
                              fontFamily: SANS,
                              fontWeight: 500,
                              fontSize: SIZE.chip,
                              letterSpacing: 0.15,
                              padding: "1.7px 5px 1.4px",
                              borderRadius: 6,
                              background: colors.background,
                              color: colors.text,
                            }}
                          >
                            {tag.name}
                          </span>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
              <div style={{ paddingLeft: keyWidth }}>
                {description ? <div style={{ marginTop: 9, fontSize: SIZE.body, lineHeight: 1.5, ...clamp(4) }}>{description}</div> : null}
                {notes ? (
                  <div style={{ marginTop: 11 }}>
                    <div style={label(palette.muted)}>{strings.notes}</div>
                    <div style={{ fontSize: SIZE.notes, lineHeight: 1.5, ...clamp(3) }}>{notes}</div>
                  </div>
                ) : null}
                {link ? (
                  <div style={{ marginTop: 11 }}>
                    <div style={label(palette.muted)}>{strings.links}</div>
                    <div style={{ fontFamily: SANS, fontSize: SIZE.link, color: palette.accent, ...clamp(1) }}>{link}</div>
                  </div>
                ) : null}
                {config.includeApaCitation ? (
                  <div
                    style={{
                      marginTop: 12,
                      padding: "7px 12px 7px 10px",
                      borderLeft: `1.4px solid ${palette.accent}`,
                      background: palette.accentWash,
                    }}
                  >
                    <div style={label(palette.accent)}>{strings.citeAs}</div>
                    <div style={{ fontSize: SIZE.citation, lineHeight: 1.5, ...clamp(3) }}>{generateAPACitation(source, config.language)}</div>
                  </div>
                ) : null}
                {bibtex ? (
                  <div style={{ marginTop: 11 }}>
                    <div style={label(palette.muted)}>{strings.bibtex}</div>
                    <div
                      style={{
                        fontFamily: MONO,
                        fontSize: SIZE.bibtex,
                        lineHeight: 1.55,
                        padding: "8px 10px",
                        borderRadius: 2.5,
                        background: palette.wash,
                        whiteSpace: "pre-wrap",
                        ...clamp(6),
                      }}
                    >
                      {bibtex}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** The end of the last page: the Source Manager note with its link and optional QR code. */
export function PdfColophonPreview({
  config,
  projectUrl,
  strings,
  width,
}: {
  config: PdfExportConfig
  projectUrl: string
  strings: PdfDocumentStrings
  width: number
}) {
  const palette = useMemo(() => getPdfPalette(config.themeId, config.mode), [config.themeId, config.mode])
  const qr = useMemo(() => (config.includeQrCode ? createQrCode(projectUrl) : null), [config.includeQrCode, projectUrl])
  const scale = width / PAGE.width
  const dark = palette.mode === "dark"
  const sliceHeight = (config.includeQrCode ? QR_SIZE : 26) + 64

  return (
    <div className={PAGE_FRAME} style={{ width, height: sliceHeight * scale }} aria-hidden>
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: PAGE.width,
          height: sliceHeight,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
          background: palette.paper,
          padding: `30px ${MARGIN_X}px 0`,
          fontFamily: SANS,
          fontSize: 7.6,
          lineHeight: 1.6,
        }}
      >
        <div style={{ width: 18, height: 1.2, marginBottom: 10, background: palette.accent }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {qr ? (
            <div style={dark ? { background: palette.ink, padding: QR_TILE_PADDING, borderRadius: 3, lineHeight: 0 } : { lineHeight: 0 }}>
              <svg
                width={QR_SIZE - (dark ? QR_TILE_PADDING * 2 : 0)}
                height={QR_SIZE - (dark ? QR_TILE_PADDING * 2 : 0)}
                viewBox={`0 0 ${qr.size} ${qr.size}`}
                shapeRendering="crispEdges"
              >
                <path d={qr.path} fill={dark ? palette.paper : palette.ink} />
              </svg>
            </div>
          ) : null}
          <div style={{ minWidth: 0 }}>
            <div style={{ color: palette.muted }}>{strings.exportedFrom}</div>
            <div style={{ color: palette.accent, overflowWrap: "anywhere" }}>{projectUrl.replace(/^https?:\/\//, "")}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
