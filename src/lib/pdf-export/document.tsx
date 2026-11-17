import { Fragment, type ReactNode } from "react"
import { Document, Link, Page, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer"
import type { Style } from "@react-pdf/types"
import type { Source } from "@/types/sources"
import { generateApaReference } from "@/lib/apa-citation"
import { breakable, preserveIndentation } from "./breakable"
import type { PdfDocumentStrings, PdfExportConfig } from "./config"
import { FONT } from "./fonts"
import { KEY_SIZE, MARGIN_BOTTOM, MARGIN_TOP, MARGIN_X, QR_SIZE, QR_TILE_PADDING, SIZE, keyColumnWidth } from "./metrics"
import { displayUrl, formatLongDate, formatPublicationDate, linkifyLines, plainParagraphs } from "./format"
import { tagChipColors, type PdfPalette } from "./palette"
import { createQrCode } from "./qr"
import { RichText } from "./rich-text"

export type SourcesDocumentProps = {
  /** Sources in final order. */
  sources: Source[]
  config: PdfExportConfig
  palette: PdfPalette
  project: { title: string; description: string | null; url: string }
  strings: PdfDocumentStrings
  locale: string
  generatedAt: Date
}

const t = StyleSheet.create({
  page: {
    paddingTop: MARGIN_TOP,
    paddingBottom: MARGIN_BOTTOM,
    paddingHorizontal: MARGIN_X,
    fontFamily: [...FONT.serif],
  },
  overline: {
    fontFamily: [...FONT.sans],
    fontWeight: 600,
    fontSize: SIZE.overline,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: [...FONT.display],
    fontWeight: 400,
    fontSize: SIZE.title,
    lineHeight: 1.12,
    letterSpacing: -0.3,
    marginTop: 14,
  },
  lede: {
    fontSize: SIZE.lede,
    lineHeight: 1.5,
    marginTop: 12,
    maxWidth: 410,
  },
  metaRow: { flexDirection: "row", flexWrap: "wrap", columnGap: 34, rowGap: 10, marginTop: 24 },
  metaLabel: {
    fontFamily: [...FONT.sans],
    fontWeight: 500,
    fontSize: SIZE.metaLabel,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  metaValue: { fontFamily: [...FONT.sans], fontSize: SIZE.metaValue, marginTop: 3.5 },
  masthead: { marginBottom: 6 },
  mastheadRule: { height: 0.8, marginTop: 26 },
  entry: { paddingTop: 17, paddingBottom: 17 },
  head: { flexDirection: "row" },
  key: {
    fontFamily: [...FONT.mono],
    fontWeight: 500,
    fontSize: KEY_SIZE,
    lineHeight: 1.3,
    // Sits on the title's first baseline.
    paddingTop: (SIZE.entryTitle - KEY_SIZE) * 0.82,
    paddingRight: 12,
  },
  entryTitle: { fontWeight: 600, fontSize: SIZE.entryTitle, lineHeight: 1.3 },
  byline: { fontFamily: [...FONT.sans], fontSize: SIZE.byline, lineHeight: 1.45, marginTop: 2.5 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 3.5, marginTop: 7 },
  chip: {
    fontFamily: [...FONT.sans],
    fontWeight: 500,
    fontSize: SIZE.chip,
    letterSpacing: 0.15,
    paddingHorizontal: 5,
    paddingTop: 1.7,
    paddingBottom: 1.4,
    borderRadius: 6,
  },
  section: { marginTop: 11 },
  label: {
    fontFamily: [...FONT.sans],
    fontWeight: 600,
    fontSize: SIZE.label,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  link: { fontFamily: [...FONT.sans], fontSize: SIZE.link, lineHeight: 1.55, textDecoration: "none" },
  citation: {
    marginTop: 12,
    borderLeftWidth: 1.4,
    paddingVertical: 7,
    paddingLeft: 10,
    paddingRight: 12,
  },
  citationText: { fontSize: SIZE.citation, lineHeight: 1.5 },
  bibtex: {
    fontFamily: [...FONT.mono],
    fontSize: SIZE.bibtex,
    lineHeight: 1.55,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 2.5,
  },
  footer: {
    position: "absolute",
    left: MARGIN_X,
    right: MARGIN_X,
    bottom: 36,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontFamily: [...FONT.sans], fontSize: SIZE.footer, letterSpacing: 0.3 },
  colophon: { marginTop: 34 },
  colophonBar: { width: 18, height: 1.2, marginBottom: 10 },
  colophonRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  colophonText: { fontFamily: [...FONT.sans], fontSize: 7.6, lineHeight: 1.6 },
})

/** View props react-pdf supports at runtime but doesn't type on View. */
const bookmarkProps = (title: string) => ({ bookmark: { title, fit: true } }) as object

const textLength = (value: string | null | undefined) => value?.trim().length ?? 0

/** Rough height (pt) of an entry, to keep short entries in one piece across page breaks. */
function estimateHeight(source: Source, fields: Set<string>, includeCitation: boolean): number {
  const lines = (chars: number, perLine: number) => Math.ceil(chars / perLine)
  const paragraphs = (value: string | null) => (value?.match(/\n/g)?.length ?? 0) + 1
  let height = 46
  if (fields.has("tags") && source.tags.length) height += 18
  if (fields.has("description") && source.description) {
    height += 8 + (lines(textLength(source.description), 82) + paragraphs(source.description)) * 14
  }
  if (fields.has("notes") && source.notes) height += 26 + (lines(textLength(source.notes), 86) + paragraphs(source.notes)) * 13.5
  if (fields.has("links") && source.links) height += 26 + paragraphs(source.links) * 12.5
  if (includeCitation) height += 52
  if (fields.has("bibtex") && source.bibtex) height += 40 + paragraphs(source.bibtex) * 10.7
  return height
}

function Masthead({ sources, config, palette, project, strings, locale, generatedAt }: SourcesDocumentProps) {
  const description = config.includeProjectDescription ? project.description?.trim() : ""
  const meta: Array<{ label: string; value: string }> = []
  if (config.includeAuthor && config.authorName.trim()) meta.push({ label: strings.preparedBy, value: config.authorName.trim() })
  if (config.includeDownloadDate) meta.push({ label: strings.date, value: formatLongDate(generatedAt, locale) })
  meta.push({ label: strings.count, value: new Intl.NumberFormat(locale).format(sources.length) })

  return (
    <View style={t.masthead}>
      {config.overline.trim() ? <Text style={[t.overline, { color: palette.accent }]}>{config.overline.trim()}</Text> : null}
      {config.includeProjectTitle && project.title.trim() ? (
        <Text style={[t.title, { color: palette.ink }]}>{project.title.trim()}</Text>
      ) : null}
      {description
        ? plainParagraphs(description).map((paragraph, index) => (
            <Text key={index} style={[t.lede, { color: palette.body }, index > 0 ? { marginTop: 6 } : {}]}>
              {paragraph}
            </Text>
          ))
        : null}
      <View style={t.metaRow}>
        {meta.map((item) => (
          <View key={item.label}>
            <Text style={[t.metaLabel, { color: palette.muted }]}>{item.label}</Text>
            <Text style={[t.metaValue, { color: palette.ink }]}>{item.value}</Text>
          </View>
        ))}
      </View>
      <View style={[t.mastheadRule, { backgroundColor: palette.ink }]} />
    </View>
  )
}

function SectionLabel({ children, palette }: { children: ReactNode; palette: PdfPalette }) {
  return <Text style={[t.label, { color: palette.muted }]}>{children}</Text>
}

function Entry({
  source,
  index,
  first,
  keyWidth,
  keyMode,
  props,
}: {
  source: Source
  index: number
  first: boolean
  keyWidth: number
  keyMode: "abbreviation" | "number"
  props: SourcesDocumentProps
}) {
  const { config, palette, strings, locale } = props
  const fields = new Set<string>(config.fields)
  const title = source.title?.trim()
  const authors = fields.has("authors") ? source.authors?.trim() : ""
  const date = fields.has("publicationDate") ? formatPublicationDate(source.publicationDate, locale) : null
  const key =
    keyMode === "abbreviation"
      ? source.abbreviation?.trim() ?? ""
      : String(index + 1).padStart(Math.max(2, String(props.sources.length).length), "0")
  const tags = fields.has("tags") ? source.tags : []
  const description = fields.has("description") ? source.description?.trim() : ""
  const notes = fields.has("notes") ? source.notes?.trim() : ""
  const links = fields.has("links") && source.links?.trim() ? linkifyLines(source.links) : []
  const bibtex = fields.has("bibtex") ? source.bibtex?.trim() : ""
  const citation = config.includeApaCitation ? generateApaReference(source, config.language) : []

  const keepTogether = estimateHeight(source, fields, config.includeApaCitation) < 300
  const bookmark = [source.abbreviation?.trim(), title || strings.untitled].filter(Boolean).join("  ·  ")

  const bodyStyle: Style = { paddingLeft: keyWidth }
  const hasBody = description || notes || links.length > 0 || citation.length > 0 || bibtex

  return (
    <View
      style={[t.entry, first ? { paddingTop: 22 } : { borderTopWidth: 0.6, borderTopColor: palette.rule }]}
      wrap={!keepTogether}
    >
      <View style={t.head} wrap={false} minPresenceAhead={hasBody ? 36 : 0} {...bookmarkProps(bookmark)}>
        <Text style={[t.key, { width: keyWidth, color: keyMode === "abbreviation" ? palette.accent : palette.faint }]}>
          {key}
        </Text>
        <View style={{ flex: 1 }}>
          {fields.has("title") ? (
            title ? (
              <Text style={[t.entryTitle, { color: palette.ink }]}>{title}</Text>
            ) : (
              <Text style={[t.entryTitle, { color: palette.faint, fontStyle: "italic", fontWeight: 400 }]}>{strings.untitled}</Text>
            )
          ) : null}
          {authors || date ? (
            <Text style={[t.byline, { color: palette.muted }, fields.has("title") ? {} : { marginTop: 0 }]}>
              {authors ? <Text style={{ color: palette.body }}>{authors}</Text> : null}
              {authors && date ? "   ·   " : null}
              {date}
            </Text>
          ) : null}
          {tags.length > 0 ? (
            <View style={t.chips}>
              {tags.map((tag) => {
                const colors = tagChipColors(tag.color, palette)
                return (
                  <Text key={tag.id} style={[t.chip, { backgroundColor: colors.background, color: colors.text }]}>
                    {tag.name}
                  </Text>
                )
              })}
            </View>
          ) : null}
        </View>
      </View>

      {description ? (
        <View style={[bodyStyle, { marginTop: 9 }]}>
          <RichText markdown={description} palette={palette} size={SIZE.body} color={palette.body} />
        </View>
      ) : null}

      {notes ? (
        <View style={[bodyStyle, t.section]}>
          <SectionLabel palette={palette}>{strings.notes}</SectionLabel>
          <RichText markdown={notes} palette={palette} size={SIZE.notes} color={palette.body} />
        </View>
      ) : null}

      {links.length > 0 ? (
        <View style={[bodyStyle, t.section]}>
          <SectionLabel palette={palette}>{strings.links}</SectionLabel>
          {links.map((parts, lineIndex) => (
            <Text key={lineIndex} style={[t.link, { color: palette.body }]}>
              {parts.map((part, partIndex) =>
                part.href ? (
                  <Link key={partIndex} src={part.href} style={{ color: palette.accent, textDecoration: "none" }}>
                    {breakable(part.text)}
                  </Link>
                ) : (
                  <Fragment key={partIndex}>{breakable(part.text)}</Fragment>
                ),
              )}
            </Text>
          ))}
        </View>
      ) : null}

      {citation.length > 0 ? (
        <View style={bodyStyle} wrap={false}>
          <View style={[t.citation, { backgroundColor: palette.accentWash, borderLeftColor: palette.accent }]}>
            <Text style={[t.label, { color: palette.accent }]}>{strings.citeAs}</Text>
            <Text style={[t.citationText, { color: palette.body }]}>
              {citation.map((segment, segmentIndex) =>
                segment.italic ? (
                  <Text key={segmentIndex} style={{ fontStyle: "italic" }}>
                    {breakable(segment.text)}
                  </Text>
                ) : (
                  <Text key={segmentIndex}>{breakable(segment.text)}</Text>
                ),
              )}
            </Text>
          </View>
        </View>
      ) : null}

      {bibtex ? (
        <View style={[bodyStyle, t.section]}>
          <SectionLabel palette={palette}>{strings.bibtex}</SectionLabel>
          <Text style={[t.bibtex, { backgroundColor: palette.wash, color: palette.body }]}>{breakable(preserveIndentation(bibtex))}</Text>
        </View>
      ) : null}
    </View>
  )
}

/** A QR code for the project link. On dark paper it sits on a light tile: inverted codes don't scan everywhere. */
function QrMark({ url, palette }: { url: string; palette: PdfPalette }) {
  const qr = createQrCode(url)
  const dark = palette.mode === "dark"
  const size = QR_SIZE - (dark ? QR_TILE_PADDING * 2 : 0)
  return (
    <Link src={url} style={{ textDecoration: "none" }}>
      <View style={dark ? { backgroundColor: palette.ink, padding: QR_TILE_PADDING, borderRadius: 3 } : {}}>
        <Svg width={size} height={size} viewBox={`0 0 ${qr.size} ${qr.size}`}>
          <Path d={qr.path} fill={dark ? palette.paper : palette.ink} />
        </Svg>
      </View>
    </Link>
  )
}

/** Where the data comes from, with a link (and optionally a QR code) back to the project. */
function Colophon({ config, palette, project, strings }: SourcesDocumentProps) {
  return (
    <View style={t.colophon} wrap={false}>
      <View style={[t.colophonBar, { backgroundColor: palette.accent }]} />
      <View style={t.colophonRow}>
        {config.includeQrCode ? <QrMark url={project.url} palette={palette} /> : null}
        <View style={{ flex: 1 }}>
          <Text style={[t.colophonText, { color: palette.muted }]}>{strings.exportedFrom}</Text>
          <Link src={project.url} style={[t.colophonText, { color: palette.accent, textDecoration: "none" }]}>
            {breakable(displayUrl(project.url))}
          </Link>
        </View>
      </View>
    </View>
  )
}

export function SourcesDocument(props: SourcesDocumentProps) {
  const { sources, config, palette, project, strings, locale } = props
  const showKeys = config.fields.includes("abbreviation")
  const keyMode = showKeys ? "abbreviation" : "number"
  const keyWidth = keyColumnWidth(
    sources.map((source) => source.abbreviation),
    showKeys,
    sources.length,
  )
  const runningTitle = config.includeProjectTitle ? project.title.trim() : ""

  return (
    <Document
      title={project.title.trim() || config.overline.trim() || strings.overline}
      author={config.includeAuthor && config.authorName.trim() ? config.authorName.trim() : undefined}
      subject={config.overline.trim() || strings.overline}
      creator="Source Manager"
      producer="Source Manager"
      language={locale}
      creationDate={props.generatedAt}
    >
      <Page size="A4" style={[t.page, { backgroundColor: palette.paper, color: palette.body }]}>
        <View style={t.footer} fixed>
          {/* Dynamic texts don't inherit the family from their parent, so it's set explicitly. */}
          <Text
            style={[t.footerText, { color: palette.faint, maxWidth: 360 }]}
            render={({ pageNumber }) => (pageNumber > 1 ? runningTitle : "")}
          />
          <Text
            style={[t.footerText, { color: palette.faint }]}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>

        <Masthead {...props} />

        {sources.map((source, index) => (
          <Entry
            key={source.id}
            source={source}
            index={index}
            first={index === 0}
            keyWidth={keyWidth}
            keyMode={keyMode}
            props={props}
          />
        ))}

        {config.includeSourceManagerNote ? <Colophon {...props} /> : null}
      </Page>
    </Document>
  )
}
