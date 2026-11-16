import type { ReactNode } from "react"
import { Link, Text, View } from "@react-pdf/renderer"
import type { Style } from "@react-pdf/types"
import { markdownToSanitizedRichEditorHtml } from "@/app/projects/[projectId]/sources/rich-text-markdown-utils"
import { breakable, preserveIndentation } from "./breakable"
import { FONT } from "./fonts"
import { legibleTextColor, softHighlight, type PdfPalette } from "./palette"

/**
 * Renders the rich-text fields (Markdown with the editor's inline HTML) as PDF primitives.
 * Uses the app's own Markdown → HTML pipeline so the document matches what the table shows.
 */

type TextOptions = {
  palette: PdfPalette
  /** Font size in pt. */
  size: number
  color: string
}

type InlineStyle = {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  code?: boolean
  color?: string
  highlight?: string
}

const BLOCK_TAGS = new Set([
  "P", "DIV", "SECTION", "ARTICLE", "HEADER", "FOOTER", "FIGURE", "H1", "H2", "H3", "H4", "H5", "H6",
  "UL", "OL", "LI", "BLOCKQUOTE", "PRE", "TABLE", "THEAD", "TBODY", "TFOOT", "TR", "HR", "DL", "DT", "DD",
])

const isElement = (node: Node): node is HTMLElement => node.nodeType === 1
const isBlock = (node: Node) => isElement(node) && BLOCK_TAGS.has(node.tagName)
const LINE_HEIGHT = 1.5
const BULLETS = ["•", "◦", "▪"]

class RichTextRenderer {
  private key = 0
  private lineStart = true

  constructor(private readonly options: TextOptions) {}

  private nextKey() {
    this.key += 1
    return this.key
  }

  private get baseText(): Style {
    return { fontFamily: [...FONT.serif], fontSize: this.options.size, lineHeight: LINE_HEIGHT, color: this.options.color }
  }

  /** Render a sequence of nodes, grouping inline runs into paragraphs. */
  blocks(nodes: ArrayLike<Node>, depth = 0): ReactNode[] {
    const out: ReactNode[] = []
    let inlineRun: Node[] = []
    const flush = () => {
      if (inlineRun.length > 0) {
        const paragraph = this.paragraph(inlineRun)
        if (paragraph) out.push(paragraph)
        inlineRun = []
      }
    }
    for (const node of Array.from(nodes)) {
      if (isBlock(node)) {
        flush()
        const block = this.block(node as HTMLElement, depth)
        if (block) out.push(block)
      } else {
        inlineRun.push(node)
      }
    }
    flush()
    return out
  }

  private stack(children: ReactNode[], gap = this.options.size * 0.55, style: Style = {}): ReactNode {
    if (children.length === 0) return null
    return (
      <View key={this.nextKey()} style={{ gap, ...style }}>
        {children}
      </View>
    )
  }

  private block(el: HTMLElement, depth: number): ReactNode {
    const { palette, size } = this.options
    switch (el.tagName) {
      case "H1":
      case "H2":
      case "H3":
      case "H4":
      case "H5":
      case "H6": {
        const scale = { H1: 1.22, H2: 1.12, H3: 1.05 }[el.tagName as "H1" | "H2" | "H3"] ?? 1
        return this.paragraph(Array.from(el.childNodes), {
          fontSize: size * scale,
          fontWeight: 600,
          color: palette.ink,
          lineHeight: 1.3,
          marginTop: size * 0.25,
        })
      }
      case "UL":
      case "OL":
        return this.list(el, depth)
      case "BLOCKQUOTE":
        return this.stack(this.blocks(el.childNodes, depth), undefined, {
          borderLeftWidth: 1.5,
          borderLeftColor: palette.rule,
          paddingLeft: size * 0.9,
        })
      case "PRE": {
        const code = preserveIndentation((el.textContent ?? "").replace(/\n+$/, ""))
        if (!code.trim()) return null
        return (
          <View key={this.nextKey()} style={{ backgroundColor: palette.wash, borderRadius: 2, paddingVertical: 6, paddingHorizontal: 8 }}>
            <Text style={{ fontFamily: [...FONT.mono], fontSize: size * 0.8, lineHeight: 1.5, color: this.options.color }}>{breakable(code)}</Text>
          </View>
        )
      }
      case "TABLE":
        return this.table(el)
      case "HR":
        return <View key={this.nextKey()} style={{ height: 0.6, backgroundColor: palette.rule, marginVertical: size * 0.3 }} />
      default: {
        const hasBlocks = Array.from(el.childNodes).some(isBlock)
        return hasBlocks ? this.stack(this.blocks(el.childNodes, depth)) : this.paragraph(Array.from(el.childNodes))
      }
    }
  }

  private paragraph(nodes: Node[], style: Style = {}): ReactNode {
    this.lineStart = true
    const children = this.inlines(nodes, {})
    const text = nodes.map((n) => n.textContent ?? "").join("")
    if (children.length === 0 || !text.replace(/ /g, " ").trim()) {
      // A paragraph holding only a non-breaking space is the editor's explicit blank line.
      return / /.test(text) ? <View key={this.nextKey()} style={{ height: this.options.size * 0.4 }} /> : null
    }
    return (
      <Text key={this.nextKey()} style={{ ...this.baseText, ...style }}>
        {children}
      </Text>
    )
  }

  private emitText(raw: string, style: InlineStyle): ReactNode[] {
    let text = raw.replace(/[ \t\r\n\f]+/g, " ")
    if (this.lineStart) text = text.replace(/^ +/, "")
    if (!text) return []
    this.lineStart = false
    return [this.styled(breakable(text), style)]
  }

  private styled(content: ReactNode[], style: InlineStyle): ReactNode {
    const css: Style = {}
    if (style.bold) css.fontWeight = 600
    if (style.italic) css.fontStyle = "italic"
    const decorations = [style.underline && "underline", style.strike && "line-through"].filter(Boolean)
    if (decorations.length) css.textDecoration = decorations.join(" ") as Style["textDecoration"]
    if (style.code) {
      css.fontFamily = [...FONT.mono]
      css.fontSize = this.options.size * 0.86
    }
    if (style.color) css.color = style.color
    if (style.highlight) css.backgroundColor = style.highlight
    if (Object.keys(css).length === 0) return content.length === 1 ? content[0] : <Text key={this.nextKey()}>{content}</Text>
    return (
      <Text key={this.nextKey()} style={css}>
        {content}
      </Text>
    )
  }

  private inlines(nodes: ArrayLike<Node>, style: InlineStyle): ReactNode[] {
    const out: ReactNode[] = []
    for (const node of Array.from(nodes)) {
      if (node.nodeType === 3) {
        out.push(...this.emitText(node.textContent ?? "", style))
        continue
      }
      if (!isElement(node)) continue
      const children = node.childNodes
      switch (node.tagName) {
        case "BR":
          out.push("\n")
          this.lineStart = true
          break
        case "STRONG":
        case "B":
          out.push(...this.inlines(children, { ...style, bold: true }))
          break
        case "EM":
        case "I":
        case "CITE":
          out.push(...this.inlines(children, { ...style, italic: true }))
          break
        case "U":
        case "INS":
          out.push(...this.inlines(children, { ...style, underline: true }))
          break
        case "S":
        case "DEL":
        case "STRIKE":
          out.push(...this.inlines(children, { ...style, strike: true }))
          break
        case "CODE":
        case "KBD":
        case "SAMP":
          out.push(...this.inlines(children, { ...style, code: true }))
          break
        case "MARK":
          out.push(...this.inlines(children, { ...style, highlight: softHighlight("#facc15", this.options.palette) ?? undefined }))
          break
        case "A": {
          const href = node.getAttribute("href") ?? ""
          const content = this.inlines(children, { ...style, color: this.options.palette.accent })
          if (/^(https?:|mailto:)/i.test(href)) {
            out.push(
              <Link key={this.nextKey()} src={href} style={{ color: this.options.palette.accent, textDecoration: "none" }}>
                {content}
              </Link>,
            )
          } else {
            out.push(...content)
          }
          break
        }
        case "SPAN":
        case "FONT": {
          const color = node.style.color || node.getAttribute("color")
          const background = node.style.backgroundColor
          out.push(
            ...this.inlines(children, {
              ...style,
              color: (color && legibleTextColor(color, this.options.palette)) || style.color,
              highlight: (background && softHighlight(background, this.options.palette)) || style.highlight,
            }),
          )
          break
        }
        case "INPUT":
          if (node.getAttribute("type") === "checkbox") {
            out.push(node.hasAttribute("checked") ? "☑ " : "☐ ")
            this.lineStart = false
          }
          break
        case "IMG": {
          const alt = node.getAttribute("alt")
          if (alt) out.push(...this.emitText(`[${alt}]`, { ...style, italic: true }))
          break
        }
        default:
          out.push(...this.inlines(children, style))
      }
    }
    return out
  }

  private list(el: HTMLElement, depth: number): ReactNode {
    const { palette, size } = this.options
    const ordered = el.tagName === "OL"
    const start = Number.parseInt(el.getAttribute("start") ?? "1", 10) || 1
    const items = Array.from(el.children).filter((child) => child.tagName === "LI") as HTMLElement[]
    if (items.length === 0) return null
    const markerWidth = ordered ? size * (0.62 * String(start + items.length - 1).length + 0.9) : size * 1.05

    return (
      <View key={this.nextKey()} style={{ gap: size * 0.3 }}>
        {items.map((item, index) => {
          const checkbox = item.querySelector(":scope > input[type=checkbox], :scope > p > input[type=checkbox]")
          const marker = checkbox
            ? checkbox.hasAttribute("checked") ? "☑" : "☐"
            : ordered ? `${start + index}.` : BULLETS[depth % BULLETS.length]
          checkbox?.remove()
          const content = this.blocks(item.childNodes, depth + 1)
          return (
            <View key={this.nextKey()} style={{ flexDirection: "row" }}>
              <Text style={{ ...this.baseText, width: markerWidth, color: palette.muted, textAlign: ordered ? "right" : "left", paddingRight: ordered ? size * 0.35 : 0 }}>
                {marker}
              </Text>
              <View style={{ flex: 1, gap: size * 0.3 }}>{content}</View>
            </View>
          )
        })}
      </View>
    )
  }

  private table(el: HTMLElement): ReactNode {
    const { palette, size } = this.options
    const rows = Array.from(el.querySelectorAll("tr"))
    if (rows.length === 0) return null
    const cellText: Style = { ...this.baseText, fontSize: size * 0.88, lineHeight: 1.4 }
    return (
      <View key={this.nextKey()} style={{ borderTopWidth: 0.6, borderLeftWidth: 0.6, borderColor: palette.rule }}>
        {rows.map((row) => (
          <View key={this.nextKey()} style={{ flexDirection: "row" }} wrap={false}>
            {Array.from(row.children).map((cell) => {
              const header = cell.tagName === "TH"
              this.lineStart = true
              return (
                <View
                  key={this.nextKey()}
                  style={{
                    flex: 1,
                    borderRightWidth: 0.6,
                    borderBottomWidth: 0.6,
                    borderColor: palette.rule,
                    paddingVertical: 3,
                    paddingHorizontal: 5,
                    backgroundColor: header ? palette.wash : undefined,
                  }}
                >
                  <Text style={{ ...cellText, fontWeight: header ? 600 : 400 }}>{this.inlines(cell.childNodes, {})}</Text>
                </View>
              )
            })}
          </View>
        ))}
      </View>
    )
  }
}

/** Rich text (description, notes) as a stack of paragraphs, lists, tables, … */
export function RichText({ markdown, ...options }: TextOptions & { markdown: string }) {
  const html = markdownToSanitizedRichEditorHtml(markdown)
  const body = new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${html}</body></html>`, "text/html").body
  const renderer = new RichTextRenderer(options)
  const blocks = renderer.blocks(body.childNodes)
  if (blocks.length === 0) return null
  return <View style={{ gap: options.size * 0.55 }}>{blocks}</View>
}
