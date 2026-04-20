"use client"

import * as React from "react"
import TurndownService from "turndown"
import { gfm } from "turndown-plugin-gfm"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Toggle } from "@/components/ui/toggle"
import {
  Bold,
  Italic,
  Underline,
  Link2,
  List,
  ListOrdered,
  AlignLeft,
  AlignRight,
  AlignCenter,
  AlignJustify,
  Table2,
  Rows3,
  Rows2,
  Columns3,
  Columns2,
  Trash2,
  FileText,
  BetweenVerticalStart,
  BetweenHorizontalStart,
} from "lucide-react"
import { PREDEFINED_COLORS } from "./constants"
import {
  markdownToSanitizedRichEditorHtml,
  RICH_TEXT_PROSE_LINK_STYLES,
  stripAtxHeadingMarkdownInSelection,
} from "./rich-text-markdown-utils"

const RICH_TEXT_FONT_SIZES = ["12", "14", "16", "18", "20", "24"]
const RICH_TEXT_COLORS = [...PREDEFINED_COLORS.map((color) => color.value), "#ffffff", "#d1d5db", "#f59e0b", "#22c55e", "#0ea5e9", "#8b5cf6", "#ec4899"]

/** Relative to the editor base font size (inline `fontSize` on the contenteditable). */
const RICH_TEXT_VISUAL_HEADING_CLASSES =
  "[&_h1]:!text-[160%] [&_h1]:!font-semibold [&_h1]:!leading-snug [&_h1]:!mt-4 [&_h1]:!mb-2 " +
  "[&_h2]:!text-[142%] [&_h2]:!font-semibold [&_h2]:!leading-snug [&_h2]:!mt-3 [&_h2]:!mb-1.5 " +
  "[&_h3]:!text-[128%] [&_h3]:!font-medium [&_h3]:!leading-snug [&_h3]:!mt-3 [&_h3]:!mb-1 " +
  "[&_h4]:!text-[115%] [&_h4]:!font-medium [&_h4]:!leading-normal [&_h4]:!mt-2 [&_h4]:!mb-1"

type WysiwygToolbarState = {
  bold: boolean
  italic: boolean
  underline: boolean
  blockTag: "normal" | "h1" | "h2" | "h3" | "h4"
}

type TableSelectionState = {
  rowIndex: number
  colIndex: number
  rowCount: number
  colCount: number
}

type RowDeleteTarget = "current" | "above" | "below" | "top" | "bottom"
type ColDeleteTarget = "current" | "left" | "right" | "start" | "end"

const DEFAULT_WYSIWYG_TOOLBAR_STATE: WysiwygToolbarState = {
  bold: false,
  italic: false,
  underline: false,
  blockTag: "normal",
}

function parseFormatBlockTag(): "normal" | "h1" | "h2" | "h3" | "h4" {
  try {
    const raw = (document.queryCommandValue("formatBlock") || "").toLowerCase().replace(/[<>]/g, "").trim()
    if (raw === "h1" || raw === "h2" || raw === "h3" || raw === "h4") return raw
  } catch {
    // ignore
  }
  return "normal"
}

const RICH_TEXT_EMPTY_BLOCK_MD = "\n\n\u00a0\n\n"

const turndownService = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-" })
turndownService.use(gfm)

/** Nested `ul`/`ol` under `li` → raw HTML so hierarchy survives Markdown round-trip (GFM/Turndown flatten otherwise). */
turndownService.addRule("nestedListsAsHtml", {
  filter(node: Node): boolean {
    if (node.nodeType !== Node.ELEMENT_NODE) return false
    const el = node as HTMLElement
    if (el.nodeName !== "UL" && el.nodeName !== "OL") return false
    return el.parentElement?.nodeName === "LI"
  },
  replacement(_content: string, node: Node) {
    const el = node as HTMLElement
    return `\n\n${el.outerHTML.trim()}\n\n`
  },
})

function isEmptyRichTextBlockForTurndown(node: HTMLElement): boolean {
  const normalized = (node.textContent || "").replace(/\u00a0/g, " ").replace(/\u200b/g, "").trim()
  if (normalized !== "") return false
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) continue
    if (child.nodeType === Node.ELEMENT_NODE) {
      if ((child as Element).nodeName !== "BR") return false
    }
  }
  return true
}

turndownService.addRule("richTextEmptyBlock", {
  filter(node) {
    const name = node.nodeName
    if (name !== "P" && name !== "DIV") return false
    return isEmptyRichTextBlockForTurndown(node as HTMLElement)
  },
  replacement() {
    return RICH_TEXT_EMPTY_BLOCK_MD
  },
})

/** GFM table rules drop custom `data-*` on cells/rows; keep full HTML when static highlights are present. */
turndownService.addRule("preserveStaticTableHighlights", {
  filter(node) {
    if (node.nodeName !== "TABLE") return false
    const el = node as HTMLElement
    return !!el.querySelector("[data-static-row-highlight], [data-static-col-highlight]")
  },
  replacement(_content, node) {
    const el = node as HTMLElement
    return `\n\n${el.outerHTML.trim()}\n\n`
  },
})

export type RichTextColumn = "description" | "notes"

export type SourcesRichTextSession = {
  sourceId: string
  column: RichTextColumn
  initialValue: string
  initialMarkdownMode: boolean
}

export type SourcesRichTextFullscreenDialogProps = {
  session: SourcesRichTextSession | null
  onClose: () => void
  fontSize: string
  onFontSizeChange: (size: string) => void
  onSave: (markdown: string) => Promise<void>
}

function validateMarkdownBestEffort(content: string): string | null {
  const fenceMatches = content.match(/```/g)
  if (fenceMatches && fenceMatches.length % 2 !== 0) {
    const firstFenceIndex = content.indexOf("```")
    const line = content.slice(0, firstFenceIndex).split("\n").length
    return `Unclosed code block near line ${line}.`
  }

  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9-]*)[^>]*>/g
  const stack: Array<{ tag: string; index: number }> = []
  const selfClosing = new Set(["br", "hr", "img", "input", "meta", "link"])
  let match: RegExpExecArray | null

  while ((match = tagRegex.exec(content)) !== null) {
    const fullTag = match[0]
    const tagName = match[1].toLowerCase()
    const isClosing = fullTag.startsWith("</")
    const isSelfClosing = fullTag.endsWith("/>") || selfClosing.has(tagName)

    if (isSelfClosing) continue
    if (!isClosing) {
      stack.push({ tag: tagName, index: match.index })
      continue
    }

    const open = stack.pop()
    if (!open || open.tag !== tagName) {
      const line = content.slice(0, match.index).split("\n").length
      return `Mismatched HTML tag </${tagName}> near line ${line}.`
    }
  }

  if (stack.length > 0) {
    const lastOpen = stack[stack.length - 1]
    const line = content.slice(0, lastOpen.index).split("\n").length
    return `Unclosed HTML tag <${lastOpen.tag}> near line ${line}.`
  }

  return null
}

function insertAtSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  before: string,
  after: string = before
) {
  const selected = value.slice(selectionStart, selectionEnd)
  const replacement = `${before}${selected || "text"}${after}`
  const nextValue = value.slice(0, selectionStart) + replacement + value.slice(selectionEnd)
  const caretStart = selectionStart + before.length
  const caretEnd = caretStart + (selected || "text").length
  return { nextValue, caretStart, caretEnd }
}

function insertListMarkdownAtSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  marker: "-" | "1."
) {
  const before = value.slice(0, selectionStart)
  const after = value.slice(selectionEnd)
  const needsLineBreakBefore = before.length > 0 && !before.endsWith("\n\n")
  const prefix = needsLineBreakBefore ? "\n\n" : ""
  const selected = value.slice(selectionStart, selectionEnd).trim()
  const body = selected
  const insertion = `${prefix}${marker} ${body}`
  const nextValue = `${before}${insertion}${after}`
  const caretAfterMarkerSpace = before.length + prefix.length + marker.length + 1
  const caretStart = caretAfterMarkerSpace
  const caretEnd = caretAfterMarkerSpace + body.length
  return { nextValue, caretStart, caretEnd }
}

const MARKDOWN_LIST_LINE =
  /^(\s*)((?:[-*+])|(?:\d+\.))(\s+)(.*)$/

function adjustMarkdownListIndentAtCursor(
  value: string,
  pos: number,
  direction: "in" | "out"
): { nextValue: string; caretStart: number; caretEnd: number } | null {
  const lineStart = value.lastIndexOf("\n", pos - 1) + 1
  const nl = value.indexOf("\n", pos)
  const lineEnd = nl === -1 ? value.length : nl
  const line = value.slice(lineStart, lineEnd)
  const m = line.match(MARKDOWN_LIST_LINE)
  if (!m) return null
  const ws = m[1] ?? ""
  const marker = m[2] ?? ""
  const sp = m[3] ?? " "
  const rest = m[4] ?? ""
  let newWs = ws
  if (direction === "in") {
    newWs = `${ws}  `
  } else {
    if (ws.length >= 2) newWs = ws.slice(0, -2)
    else return null
  }
  const newLine = `${newWs}${marker}${sp}${rest}`
  const nextValue = `${value.slice(0, lineStart)}${newLine}${value.slice(lineEnd)}`
  const delta = newLine.length - line.length
  return { nextValue, caretStart: pos + delta, caretEnd: pos + delta }
}

const markdownToHtml = markdownToSanitizedRichEditorHtml

function ensureClickableAnchorsInEditable(root: HTMLElement) {
  root.querySelectorAll("a[href]").forEach((anchor) => {
    anchor.setAttribute("contenteditable", "false")
    if (!anchor.getAttribute("target")) {
      anchor.setAttribute("target", "_blank")
      anchor.setAttribute("rel", "noopener noreferrer")
    }
  })
}

const RICH_EDITOR_AFTER_TABLE_ATTR = "data-rich-editor-after-table"

function isOuterDocumentTable(table: HTMLTableElement) {
  return !table.parentElement?.closest("table")
}

/** Skip whitespace-only text nodes; return first "significant" sibling or null. */
function firstSignificantEditorSibling(node: ChildNode | null): ChildNode | null {
  let n = node
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = (n as Text).data.replace(/\u00a0/g, " ").replace(/\u200b/g, "").trim()
      if (t !== "") return n
      n = n.nextSibling
      continue
    }
    return n
  }
  return null
}

function hasMeaningfulRichEditorText(el: HTMLElement) {
  return (el.textContent || "").replace(/\u00a0/g, " ").replace(/\u200b/g, "").trim() !== ""
}

function needsTrailingParagraphAfterTable(table: HTMLTableElement) {
  const next = firstSignificantEditorSibling(table.nextSibling)
  if (!next) return true
  if (next.nodeType === Node.TEXT_NODE) return false
  const el = next as HTMLElement
  if (el.tagName === "TABLE") return true
  if (el.tagName === "BR") return true
  if (el.tagName === "P" || el.tagName === "DIV") {
    if (hasMeaningfulRichEditorText(el)) return false
    return false
  }
  return false
}

/**
 * Keeps a caret-friendly block after each top-level table (and between adjacent tables).
 * Empty synthetic paragraphs are stripped in `htmlToMarkdown` so saves stay clean.
 */
function ensureTrailingParagraphAfterOuterTables(root: HTMLElement) {
  const outerTables = () =>
    Array.from(root.querySelectorAll("table")).filter((t): t is HTMLTableElement => isOuterDocumentTable(t))

  for (const table of outerTables()) {
    const next = firstSignificantEditorSibling(table.nextSibling)
    if (next?.nodeType === Node.ELEMENT_NODE) {
      const el = next as HTMLElement
      if (el.tagName === "P" && el.getAttribute(RICH_EDITOR_AFTER_TABLE_ATTR) === "true") {
        if (!hasMeaningfulRichEditorText(el) && !el.querySelector("br")) {
          el.appendChild(document.createElement("br"))
        }
      }
    }
  }

  for (let guard = 0; guard < 24; guard += 1) {
    let inserted = false
    for (const table of outerTables()) {
      if (!needsTrailingParagraphAfterTable(table)) continue
      const p = document.createElement("p")
      p.setAttribute(RICH_EDITOR_AFTER_TABLE_ATTR, "true")
      p.appendChild(document.createElement("br"))
      table.parentNode?.insertBefore(p, table.nextSibling)
      inserted = true
    }
    if (!inserted) break
  }

  root.querySelectorAll(`p[${RICH_EDITOR_AFTER_TABLE_ATTR}]`).forEach((node) => {
    const el = node as HTMLElement
    if (hasMeaningfulRichEditorText(el)) el.removeAttribute(RICH_EDITOR_AFTER_TABLE_ATTR)
  })
}

function finalizeRichEditorVisualDom(root: HTMLDivElement): HTMLElement | null {
  ensureClickableAnchorsInEditable(root)
  const lastHoisted = hoistOrphanNestedListsIntoPreviousLi(root)
  ensureTrailingParagraphAfterOuterTables(root)
  return lastHoisted
}

/**
 * After hoisting an orphan nested list into the previous `li`, the selection often jumps to the end
 * of the parent item. Move the caret into the first line of the nested list when that happens.
 */
function restoreCaretAfterHoistedNestedList(editor: HTMLElement, hoistedList: HTMLElement) {
  if (!hoistedList.isConnected || !editor.contains(hoistedList)) return
  const firstLi = hoistedList.querySelector(":scope > li") as HTMLElement | null
  if (!firstLi) return

  const sel = window.getSelection()
  if (!sel) return
  if (sel.rangeCount > 0 && firstLi.contains(sel.getRangeAt(0).commonAncestorContainer)) return

  const text = (firstLi.textContent || "").replace(/\u00a0/g, " ").trim()
  const range = document.createRange()
  const onlyBr =
    firstLi.childNodes.length === 1 && firstLi.firstChild?.nodeName === "BR"

  if (text === "" || onlyBr) {
    if (!firstLi.firstChild) firstLi.appendChild(document.createElement("br"))
    range.setStart(firstLi, 0)
    range.collapse(true)
  } else {
    firstLi.normalize()
    const walker = document.createTreeWalker(firstLi, NodeFilter.SHOW_TEXT)
    let lastText: Text | null = null
    let n = walker.nextNode()
    while (n) {
      lastText = n as Text
      n = walker.nextNode()
    }
    if (lastText && lastText.length > 0) {
      range.setStart(lastText, lastText.length)
      range.collapse(true)
    } else {
      range.selectNodeContents(firstLi)
      range.collapse(false)
    }
  }
  sel.removeAllRanges()
  sel.addRange(range)
}

/**
 * Browsers often nest lists as `<ul><li>a</li><ul><li>b</li></ul></ul>` (invalid: `ul` as direct
 * child of `ul`). Turndown then emits two top-level list items and hierarchy is lost on save /
 * Markdown mode. Hoist orphan lists into the preceding `li` so structure matches what Turndown expects.
 */
function hoistOrphanNestedListsIntoPreviousLi(scope: ParentNode): HTMLElement | null {
  const doc = scope instanceof Document ? scope : scope.ownerDocument ?? document
  let lastHoisted: HTMLElement | null = null
  for (let guard = 0; guard < 200; guard += 1) {
    const orphan = scope.querySelector("ul > ul, ul > ol, ol > ul, ol > ol") as HTMLElement | null
    if (!orphan) break
    const host = orphan.parentElement
    if (!host) break
    const prev = orphan.previousElementSibling
    if (prev?.nodeName === "LI") {
      prev.appendChild(orphan)
    } else {
      const li = doc.createElement("li")
      host.insertBefore(li, orphan)
      li.appendChild(orphan)
    }
    lastHoisted = orphan
  }
  return lastHoisted
}

function normalizeOrphanNestedListsForTurndown(html: string): string {
  if (!/<\s*(?:ul|ol)\b/i.test(html)) return html
  try {
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html")
    const wrap = doc.body.firstElementChild as HTMLDivElement | null
    if (!wrap) return html
    hoistOrphanNestedListsIntoPreviousLi(wrap)
    return wrap.innerHTML
  } catch {
    return html
  }
}

function htmlToMarkdown(html: string) {
  let cleaned = html
  if (cleaned.includes(RICH_EDITOR_AFTER_TABLE_ATTR)) {
    try {
      const doc = new DOMParser().parseFromString(`<div>${cleaned}</div>`, "text/html")
      const wrap = doc.body.firstElementChild as HTMLDivElement | null
      if (wrap) {
        wrap.querySelectorAll(`p[${RICH_EDITOR_AFTER_TABLE_ATTR}]`).forEach((p) => {
          const el = p as HTMLElement
          const text = (el.textContent || "").replace(/\u00a0/g, " ").replace(/\u200b/g, "").trim()
          if (text === "" && !el.querySelector("img")) el.remove()
        })
        cleaned = wrap.innerHTML
      }
    } catch {
      // keep original
    }
  }
  cleaned = normalizeOrphanNestedListsForTurndown(cleaned)
  return turndownService.turndown(cleaned).trim()
}

function isCollapsedAtEditableRootStart(container: HTMLElement, r: Range) {
  if (!r.collapsed) return false
  return r.startContainer === container && r.startOffset === 0 && container.childNodes.length > 0
}

type InsertHtmlCaretPlacement = "after-last-node" | "first-li-start"

/**
 * Inserts HTML at a caret. Pass `preferredCaret` (e.g. last selection inside the editor) when the
 * toolbar/popover steals focus — live `getSelection()` is often wrong and can prepend at offset 0.
 */
function insertHtmlAtCursor(
  container: HTMLElement,
  html: string,
  preferredCaret: Range | null = null,
  caretPlacement: InsertHtmlCaretPlacement = "after-last-node"
) {
  const selection = window.getSelection()
  if (!selection) return

  const pickLiveRange = (): Range | null => {
    if (selection.rangeCount === 0) return null
    const live = selection.getRangeAt(0).cloneRange()
    if (!container.contains(live.commonAncestorContainer)) return null
    if (isCollapsedAtEditableRootStart(container, live)) return null
    return live
  }

  let range: Range | null = null
  if (preferredCaret) {
    try {
      if (container.contains(preferredCaret.commonAncestorContainer)) {
        range = preferredCaret.cloneRange()
      }
    } catch {
      range = null
    }
  }
  if (!range) range = pickLiveRange()
  if (!range) {
    range = document.createRange()
    range.selectNodeContents(container)
    range.collapse(false)
  }

  selection.removeAllRanges()
  selection.addRange(range.cloneRange())

  range.deleteContents()

  const wrapper = document.createElement("div")
  wrapper.innerHTML = html
  const fragment = document.createDocumentFragment()
  let node: ChildNode | null
  let lastNode: ChildNode | null = null

  while ((node = wrapper.firstChild)) {
    lastNode = fragment.appendChild(node)
  }

  range.insertNode(fragment)
  if (!lastNode) return

  if (caretPlacement === "first-li-start" && lastNode.nodeType === Node.ELEMENT_NODE) {
    const root = lastNode as HTMLElement
    const li =
      root.firstElementChild?.tagName === "LI"
        ? (root.firstElementChild as HTMLLIElement)
        : root.querySelector("li")
    if (li) {
      li.textContent = ""
      if (li.childNodes.length === 0) {
        li.appendChild(document.createElement("br"))
      }
      const newRange = document.createRange()
      newRange.setStart(li, 0)
      newRange.collapse(true)
      selection.removeAllRanges()
      selection.addRange(newRange)
      return
    }
  }

  const newRange = document.createRange()
  newRange.setStartAfter(lastNode)
  newRange.collapse(true)
  selection.removeAllRanges()
  selection.addRange(newRange)
}

type ActiveTableContext = {
  table: HTMLTableElement
  row: HTMLTableRowElement
  cell: HTMLTableCellElement
  rowIndex: number
  colIndex: number
  rowCount: number
  colCount: number
}

function getActiveTableContext(container: HTMLElement): ActiveTableContext | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  const anchorNode = range.commonAncestorContainer
  if (!container.contains(anchorNode)) return null
  const anchorEl = anchorNode.nodeType === Node.ELEMENT_NODE ? (anchorNode as Element) : anchorNode.parentElement
  const cell = anchorEl?.closest("td, th") as HTMLTableCellElement | null
  if (!cell) return null
  const row = cell.closest("tr") as HTMLTableRowElement | null
  const table = cell.closest("table") as HTMLTableElement | null
  if (!row || !table) return null

  const rowCount = table.rows.length
  const colCount = Math.max(...Array.from(table.rows).map((r) => r.cells.length), 1)
  const rowIndex = row.rowIndex
  const colIndex = cell.cellIndex
  if (rowIndex < 0 || colIndex < 0) return null

  return { table, row, cell, rowIndex, colIndex, rowCount, colCount }
}

/** Non-breaking space keeps cells non-empty for Turndown → GFM without `<br>` breaking table rows. */
const TABLE_CELL_NBSP = "\u00a0"

function ensureTableCellHasEditableText(cell: HTMLTableCellElement) {
  if (!cell.textContent?.replace(/\u00a0/g, " ").trim()) {
    cell.textContent = TABLE_CELL_NBSP
  }
}

function focusCell(cell: HTMLTableCellElement) {
  const selection = window.getSelection()
  if (!selection) return
  ensureTableCellHasEditableText(cell)
  const textNode = Array.from(cell.childNodes).find((n) => n.nodeType === Node.TEXT_NODE) as Text | undefined
  const range = document.createRange()
  if (textNode && textNode.length > 0) {
    range.setStart(textNode, Math.min(1, textNode.length))
    range.collapse(true)
  } else {
    range.selectNodeContents(cell)
    range.collapse(true)
  }
  selection.removeAllRanges()
  selection.addRange(range)
  cell.focus()
}

function resolveRowDeleteIndex(context: ActiveTableContext, target: RowDeleteTarget) {
  if (target === "current") return context.rowIndex
  if (target === "above") return context.rowIndex - 1
  if (target === "below") return context.rowIndex + 1
  if (target === "top") return 0
  return context.rowCount - 1
}

function resolveColumnDeleteIndex(context: ActiveTableContext, target: ColDeleteTarget) {
  if (target === "current") return context.colIndex
  if (target === "left") return context.colIndex - 1
  if (target === "right") return context.colIndex + 1
  if (target === "start") return 0
  return context.colCount - 1
}

type FullscreenRichEditorSelectionBridge =
  | { kind: "markdown"; start: number; end: number }
  | { kind: "plain"; start: number; end: number; plainDocumentLength: number }

function measurePlainTextOffsetBeforeCollapsedRange(root: HTMLElement, collapsed: Range): number {
  const pre = document.createRange()
  pre.selectNodeContents(root)
  pre.setEnd(collapsed.startContainer, collapsed.startOffset)
  return pre.toString().length
}

function getPlainTextOffsetsInRichEditorVisual(root: HTMLElement): { start: number; end: number } {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return { start: 0, end: 0 }
  const range = sel.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer)) return { start: 0, end: 0 }

  const startRange = range.cloneRange()
  startRange.collapse(true)
  const endRange = range.cloneRange()
  endRange.collapse(false)
  const start = measurePlainTextOffsetBeforeCollapsedRange(root, startRange)
  const end = measurePlainTextOffsetBeforeCollapsedRange(root, endRange)
  return { start, end: Math.max(end, start) }
}

function resolvePlainTextOffsetInRoot(root: HTMLElement, offset: number): { node: Node; offset: number } | null {
  let remaining = Math.max(0, offset)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let textNode: Node | null = walker.nextNode()
  while (textNode) {
    const len = textNode.textContent?.length ?? 0
    if (remaining <= len) {
      return { node: textNode, offset: remaining }
    }
    remaining -= len
    textNode = walker.nextNode()
  }
  return null
}

function setPlainTextCaretInRichEditorVisual(root: HTMLElement, start: number, end: number) {
  const sel = window.getSelection()
  root.focus()
  if (!sel) return

  const a = Math.min(start, end)
  const b = Math.max(start, end)
  const startPos = resolvePlainTextOffsetInRoot(root, a)
  const endPos = resolvePlainTextOffsetInRoot(root, b)

  if (!startPos || !endPos) {
    const r = document.createRange()
    r.selectNodeContents(root)
    r.collapse(true)
    sel.removeAllRanges()
    sel.addRange(r)
    return
  }

  const r = document.createRange()
  try {
    const sMax = startPos.node.textContent?.length ?? 0
    const eMax = endPos.node.textContent?.length ?? 0
    r.setStart(startPos.node, Math.min(startPos.offset, sMax))
    r.setEnd(endPos.node, Math.min(endPos.offset, eMax))
    sel.removeAllRanges()
    sel.addRange(r)
  } catch {
    // ignore invalid ranges
  }
}

function mapRelativeCaretOffset(fromLen: number, toLen: number, fromOffset: number): number {
  if (toLen <= 0) return 0
  if (fromLen <= 0) return 0
  const clamped = Math.max(0, Math.min(fromOffset, fromLen))
  return Math.min(toLen, Math.round((clamped / fromLen) * toLen))
}

export function SourcesRichTextFullscreenDialog({
  session,
  onClose,
  fontSize,
  onFontSizeChange,
  onSave,
}: SourcesRichTextFullscreenDialogProps) {
  const open = session !== null

  const [draft, setDraft] = React.useState(() => session?.initialValue ?? "")
  const [markdownMode, setMarkdownMode] = React.useState(() => session?.initialMarkdownMode ?? false)
  const [tableRows, setTableRows] = React.useState("2")
  const [tableCols, setTableCols] = React.useState("2")
  const [insertTableOpen, setInsertTableOpen] = React.useState(false)
  const [tableOptionsOpen, setTableOptionsOpen] = React.useState(false)
  const [rowInsertOpen, setRowInsertOpen] = React.useState(false)
  const [rowDeleteOpen, setRowDeleteOpen] = React.useState(false)
  const [columnInsertOpen, setColumnInsertOpen] = React.useState(false)
  const [columnDeleteOpen, setColumnDeleteOpen] = React.useState(false)
  const [tableSelectionState, setTableSelectionState] = React.useState<TableSelectionState | null>(null)
  const [textColorOpen, setTextColorOpen] = React.useState(false)
  const [highlightColorOpen, setHighlightColorOpen] = React.useState(false)
  const [richTextLinkDialogOpen, setRichTextLinkDialogOpen] = React.useState(false)
  const [richTextLinkText, setRichTextLinkText] = React.useState("")
  const [richTextLinkUrl, setRichTextLinkUrl] = React.useState("")
  const [wysiwygToolbarState, setWysiwygToolbarState] = React.useState<WysiwygToolbarState>(DEFAULT_WYSIWYG_TOOLBAR_STATE)

  const richTextLinkRangeRef = React.useRef<Range | null>(null)
  const richEditorTextareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const richEditorVisualRef = React.useRef<HTMLDivElement | null>(null)
  /** Last caret inside the WYSIWYG editor (toolbar / popovers steal focus from contenteditable). */
  const richEditorVisualSavedRangeRef = React.useRef<Range | null>(null)
  const activeTableContextRef = React.useRef<ActiveTableContext | null>(null)
  const fullscreenRichEditorSelectionBridgeRef = React.useRef<FullscreenRichEditorSelectionBridge | null>(null)
  const previousRichTextEditorOpenRef = React.useRef(false)
  const previousRichTextMarkdownModeRef = React.useRef(false)

  const compileError = React.useMemo(
    () => (markdownMode ? validateMarkdownBestEffort(draft) : null),
    [markdownMode, draft]
  )

  const updateActiveTableSelection = React.useCallback(() => {
    const visual = richEditorVisualRef.current
    if (!visual || markdownMode) {
      activeTableContextRef.current = null
      setTableSelectionState(null)
      return
    }
    const context = getActiveTableContext(visual)
    if (!context) {
      activeTableContextRef.current = null
      setTableSelectionState(null)
      return
    }
    activeTableContextRef.current = context
    setTableSelectionState({
      rowIndex: context.rowIndex,
      colIndex: context.colIndex,
      rowCount: context.rowCount,
      colCount: context.colCount,
    })
  }, [markdownMode])

  const clearTablePreview = React.useCallback(() => {
    const visual = richEditorVisualRef.current
    if (!visual) return
    visual.querySelectorAll("[data-table-preview]").forEach((node) => {
      node.removeAttribute("data-table-preview")
    })
  }, [])

  /** Only clear delete/table previews (nested insert popovers render in a portal; parent mouseleave must not strip insert highlights). */
  const clearDangerTablePreview = React.useCallback(() => {
    const visual = richEditorVisualRef.current
    if (!visual) return
    visual.querySelectorAll("[data-table-preview]").forEach((node) => {
      if (node.getAttribute("data-table-preview") === "danger") {
        node.removeAttribute("data-table-preview")
      }
    })
  }, [])

  const previewTableRow = React.useCallback(
    (targetRowIndex: number) => {
      clearTablePreview()
      const context = activeTableContextRef.current
      if (!context) return
      const row = context.table.rows[targetRowIndex]
      if (!row) return
      Array.from(row.cells).forEach((cell) => {
        cell.setAttribute("data-table-preview", "danger")
      })
    },
    [clearTablePreview]
  )

  const previewTableColumn = React.useCallback(
    (targetColIndex: number) => {
      clearTablePreview()
      const context = activeTableContextRef.current
      if (!context) return
      Array.from(context.table.rows).forEach((row) => {
        const cell = row.cells[targetColIndex]
        if (cell) cell.setAttribute("data-table-preview", "danger")
      })
    },
    [clearTablePreview]
  )

  const previewTableDelete = React.useCallback(() => {
    clearTablePreview()
    const context = activeTableContextRef.current
    if (!context) return
    context.table.setAttribute("data-table-preview", "danger")
  }, [clearTablePreview])

  const previewInsertAnchorRow = React.useCallback(() => {
    clearTablePreview()
    const context = activeTableContextRef.current
    if (!context) return
    const row = context.table.rows[context.rowIndex]
    if (!row) return
    Array.from(row.cells).forEach((cell) => {
      cell.setAttribute("data-table-preview", "insert-row")
    })
  }, [clearTablePreview])

  const previewInsertAnchorColumn = React.useCallback(() => {
    clearTablePreview()
    const context = activeTableContextRef.current
    if (!context) return
    Array.from(context.table.rows).forEach((row) => {
      const cell = row.cells[context.colIndex]
      if (cell) cell.setAttribute("data-table-preview", "insert-col")
    })
  }, [clearTablePreview])

  React.useEffect(() => {
    if (!rowInsertOpen || markdownMode) return undefined
    previewInsertAnchorRow()
    return () => {
      const visual = richEditorVisualRef.current
      if (!visual) return
      visual.querySelectorAll("[data-table-preview='insert-row']").forEach((node) => {
        node.removeAttribute("data-table-preview")
      })
    }
  }, [rowInsertOpen, markdownMode, tableSelectionState?.rowIndex, tableSelectionState?.colIndex, previewInsertAnchorRow])

  React.useEffect(() => {
    if (!columnInsertOpen || markdownMode) return undefined
    previewInsertAnchorColumn()
    return () => {
      const visual = richEditorVisualRef.current
      if (!visual) return
      visual.querySelectorAll("[data-table-preview='insert-col']").forEach((node) => {
        node.removeAttribute("data-table-preview")
      })
    }
  }, [columnInsertOpen, markdownMode, tableSelectionState?.rowIndex, tableSelectionState?.colIndex, previewInsertAnchorColumn])

  /** Radix Dialog mounts the portal after layout; seed WYSIWYG HTML when the node appears. */
  const assignRichEditorVisualRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      richEditorVisualRef.current = node
      if (!node || !open || markdownMode) return
      const html = markdownToHtml(draft)
      if (!html.trim()) return
      if (!node.textContent?.trim()) {
        node.innerHTML = html
        finalizeRichEditorVisualDom(node)
      }
    },
    [open, markdownMode, draft]
  )

  const flushRichEditorToolbarState = React.useCallback(() => {
    const visual = richEditorVisualRef.current
    if (!visual || markdownMode) return
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    if (!sel.anchorNode || !visual.contains(sel.anchorNode)) return

    let bold = false
    let italic = false
    let underline = false
    try {
      bold = document.queryCommandState("bold")
      italic = document.queryCommandState("italic")
      underline = document.queryCommandState("underline")
    } catch {
      return
    }
    const blockTag = parseFormatBlockTag()
    setWysiwygToolbarState((prev) => {
      if (prev.bold === bold && prev.italic === italic && prev.underline === underline && prev.blockTag === blockTag) {
        return prev
      }
      return { bold, italic, underline, blockTag }
    })
  }, [markdownMode])

  const toggleStaticRowHighlightAtCaret = React.useCallback(
    (next: boolean) => {
      const visual = richEditorVisualRef.current
      if (!visual || markdownMode) return
      visual.focus()
      const context = getActiveTableContext(visual)
      if (!context) return
      const row = context.row
      if (next) row.setAttribute("data-static-row-highlight", "true")
      else row.removeAttribute("data-static-row-highlight")
      finalizeRichEditorVisualDom(visual)
      setDraft(htmlToMarkdown(visual.innerHTML))
      flushRichEditorToolbarState()
      updateActiveTableSelection()
    },
    [markdownMode, flushRichEditorToolbarState, updateActiveTableSelection]
  )

  const toggleStaticColumnHighlightAtCaret = React.useCallback(
    (next: boolean) => {
      const visual = richEditorVisualRef.current
      if (!visual || markdownMode) return
      visual.focus()
      const context = getActiveTableContext(visual)
      if (!context) return
      const { table, colIndex } = context
      Array.from(table.rows).forEach((row) => {
        const cell = row.cells[colIndex]
        if (!cell) return
        if (next) cell.setAttribute("data-static-col-highlight", "true")
        else cell.removeAttribute("data-static-col-highlight")
      })
      finalizeRichEditorVisualDom(visual)
      setDraft(htmlToMarkdown(visual.innerHTML))
      flushRichEditorToolbarState()
      updateActiveTableSelection()
    },
    [markdownMode, flushRichEditorToolbarState, updateActiveTableSelection]
  )

  React.useEffect(() => {
    if (markdownMode) setWysiwygToolbarState(DEFAULT_WYSIWYG_TOOLBAR_STATE)
  }, [markdownMode])

  React.useEffect(() => {
    if (!open || markdownMode) return

    let rafPending = false
    let rafId = 0

    const schedule = () => {
      if (rafPending) return
      rafPending = true
      rafId = requestAnimationFrame(() => {
        rafPending = false
        flushRichEditorToolbarState()
        updateActiveTableSelection()
        const vis = richEditorVisualRef.current
        const sel = window.getSelection()
        if (vis && sel && sel.rangeCount > 0) {
          const r = sel.getRangeAt(0)
          if (vis.contains(r.commonAncestorContainer)) {
            try {
              richEditorVisualSavedRangeRef.current = r.cloneRange()
            } catch {
              richEditorVisualSavedRangeRef.current = null
            }
          }
        }
      })
    }

    document.addEventListener("selectionchange", schedule)
    schedule()

    return () => {
      cancelAnimationFrame(rafId)
      document.removeEventListener("selectionchange", schedule)
    }
  }, [open, markdownMode, flushRichEditorToolbarState, updateActiveTableSelection])

  const openRichTextLinkDialog = React.useCallback(() => {
    const visual = richEditorVisualRef.current
    const selection = window.getSelection()
    richTextLinkRangeRef.current = null
    let selected = ""

    if (visual && selection && selection.rangeCount > 0) {
      const currentRange = selection.getRangeAt(0)
      if (visual.contains(currentRange.commonAncestorContainer)) {
        richTextLinkRangeRef.current = currentRange.cloneRange()
        selected = selection.toString()
      }
    }

    setRichTextLinkText(selected)
    setRichTextLinkUrl("")
    setRichTextLinkDialogOpen(true)
  }, [])

  const applyRichTextLink = React.useCallback(() => {
    const rawUrl = richTextLinkUrl.trim()
    if (!rawUrl) return

    let href = rawUrl
    if (!/^https?:\/\//i.test(href) && !/^mailto:/i.test(href)) {
      href = `https://${href.replace(/^\/+/, "")}`
    }

    const displayText = richTextLinkText.trim() || rawUrl
    const visual = richEditorVisualRef.current
    if (!visual) return

    let saved: Range | null = null
    const live = richTextLinkRangeRef.current
    if (live) {
      try {
        saved = live.cloneRange()
      } catch {
        saved = null
      }
    }

    visual.focus()
    const sel = window.getSelection()

    if (sel && saved) {
      try {
        if (!visual.contains(saved.commonAncestorContainer)) throw new Error("stale")
        sel.removeAllRanges()
        sel.addRange(saved)
      } catch {
        sel.removeAllRanges()
        const fallback = document.createRange()
        fallback.selectNodeContents(visual)
        fallback.collapse(false)
        sel.addRange(fallback)
      }
    } else if (sel) {
      sel.removeAllRanges()
      const fallback = document.createRange()
      fallback.selectNodeContents(visual)
      fallback.collapse(false)
      sel.addRange(fallback)
    }

    if (!sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)

    range.deleteContents()
    const a = document.createElement("a")
    a.href = href
    a.textContent = displayText
    a.setAttribute("contenteditable", "false")
    a.target = "_blank"
    a.rel = "noopener noreferrer"
    range.insertNode(a)

    const caret = document.createRange()
    caret.setStartAfter(a)
    caret.collapse(true)
    sel.removeAllRanges()
    sel.addRange(caret)

    finalizeRichEditorVisualDom(visual)
    setDraft(htmlToMarkdown(visual.innerHTML))
    flushRichEditorToolbarState()
    setRichTextLinkDialogOpen(false)
    richTextLinkRangeRef.current = null
  }, [richTextLinkText, richTextLinkUrl, flushRichEditorToolbarState])

  React.useEffect(() => {
    if (!richTextLinkDialogOpen) return
    const id = requestAnimationFrame(() => {
      document.getElementById("rich-text-link-url")?.focus()
    })
    return () => cancelAnimationFrame(id)
  }, [richTextLinkDialogOpen])

  React.useEffect(() => {
    if (!open) {
      setRichTextLinkDialogOpen(false)
      richTextLinkRangeRef.current = null
      setInsertTableOpen(false)
      setTableOptionsOpen(false)
      setRowInsertOpen(false)
      setRowDeleteOpen(false)
      setColumnInsertOpen(false)
      setColumnDeleteOpen(false)
      setTableSelectionState(null)
      activeTableContextRef.current = null
      richEditorVisualSavedRangeRef.current = null
      clearTablePreview()
    }
  }, [open, clearTablePreview])

  React.useEffect(() => {
    if (markdownMode) {
      setInsertTableOpen(false)
      setTableOptionsOpen(false)
      setRowInsertOpen(false)
      setRowDeleteOpen(false)
      setColumnInsertOpen(false)
      setColumnDeleteOpen(false)
      setTableSelectionState(null)
      activeTableContextRef.current = null
      richEditorVisualSavedRangeRef.current = null
      clearTablePreview()
    }
  }, [markdownMode, clearTablePreview])

  React.useEffect(() => {
    if (!tableOptionsOpen) {
      setRowInsertOpen(false)
      setRowDeleteOpen(false)
      setColumnInsertOpen(false)
      setColumnDeleteOpen(false)
      clearTablePreview()
    }
  }, [tableOptionsOpen, clearTablePreview])

  const runEditorCommand = React.useCallback(
    (command: string) => {
      if (!markdownMode) {
        const visual = richEditorVisualRef.current
        if (!visual) return
        visual.focus()

        const selection = window.getSelection()
        if (selection && selection.rangeCount > 0) {
          const currentRange = selection.getRangeAt(0)
          if (!visual.contains(currentRange.commonAncestorContainer)) {
            const endRange = document.createRange()
            endRange.selectNodeContents(visual)
            endRange.collapse(false)
            selection.removeAllRanges()
            selection.addRange(endRange)
          }
        }

        switch (command) {
          case "bold":
            document.execCommand("bold")
            break
          case "italic":
            document.execCommand("italic")
            break
          case "underline":
            document.execCommand("underline")
            break
          case "formatNormal":
            document.execCommand("formatBlock", false, "p")
            break
          case "h1":
            document.execCommand("formatBlock", false, "h1")
            break
          case "h2":
            document.execCommand("formatBlock", false, "h2")
            break
          case "h3":
            document.execCommand("formatBlock", false, "h3")
            break
          case "h4":
            document.execCommand("formatBlock", false, "h4")
            break
          case "bullet": {
            let savedCaret: Range | null = null
            try {
              savedCaret = richEditorVisualSavedRangeRef.current?.cloneRange() ?? null
            } catch {
              savedCaret = null
            }
            insertHtmlAtCursor(
              visual,
              '<ul style="list-style-type:disc;"><li></li></ul>',
              savedCaret,
              "first-li-start"
            )
            break
          }
          case "numbered": {
            let savedCaret: Range | null = null
            try {
              savedCaret = richEditorVisualSavedRangeRef.current?.cloneRange() ?? null
            } catch {
              savedCaret = null
            }
            insertHtmlAtCursor(
              visual,
              '<ol style="list-style-type:decimal;"><li></li></ol>',
              savedCaret,
              "first-li-start"
            )
            break
          }
          case "align-left":
            document.execCommand("justifyLeft")
            break
          case "align-right":
            document.execCommand("justifyRight")
            break
          case "align-center":
            document.execCommand("justifyCenter")
            break
          case "align-justify":
            document.execCommand("justifyFull")
            break
          default:
            break
        }
        finalizeRichEditorVisualDom(visual)
        setDraft(htmlToMarkdown(visual.innerHTML))
        flushRichEditorToolbarState()
        updateActiveTableSelection()
        return
      }

      const textarea = richEditorTextareaRef.current
      const value = draft
      if (!textarea) return
      const start = textarea.selectionStart
      const end = textarea.selectionEnd

      let result: { nextValue: string; caretStart: number; caretEnd: number } | null = null
      switch (command) {
        case "bold":
          result = insertAtSelection(value, start, end, "**", "**")
          break
        case "italic":
          result = insertAtSelection(value, start, end, "*", "*")
          break
        case "underline":
          result = insertAtSelection(value, start, end, "<u>", "</u>")
          break
        case "h1":
        case "h2":
        case "h3":
        case "h4": {
          const level = command.replace("h", "")
          result = insertAtSelection(value, start, end, `${"#".repeat(Number(level))} `, "")
          break
        }
        case "formatNormal": {
          const stripped = stripAtxHeadingMarkdownInSelection(value, start, end)
          if (stripped.nextValue !== value) {
            result = {
              nextValue: stripped.nextValue,
              caretStart: Math.min(stripped.caretStart, stripped.caretEnd),
              caretEnd: Math.max(stripped.caretStart, stripped.caretEnd),
            }
          }
          break
        }
        case "link":
          result = insertAtSelection(value, start, end, "[", "](https://example.com)")
          break
        case "bullet":
          result = insertListMarkdownAtSelection(value, start, end, "-")
          break
        case "numbered":
          result = insertListMarkdownAtSelection(value, start, end, "1.")
          break
        case "align-left":
          result = insertAtSelection(value, start, end, '<div style="text-align:left">', "</div>")
          break
        case "align-right":
          result = insertAtSelection(value, start, end, '<div style="text-align:right">', "</div>")
          break
        case "align-center":
          result = insertAtSelection(value, start, end, '<div style="text-align:center">', "</div>")
          break
        case "align-justify":
          result = insertAtSelection(value, start, end, '<div style="text-align:justify">', "</div>")
          break
        default:
          break
      }

      if (!result) return
      setDraft(result.nextValue)
      requestAnimationFrame(() => {
        textarea.focus()
        textarea.setSelectionRange(result.caretStart, result.caretEnd)
      })
    },
    [markdownMode, draft, flushRichEditorToolbarState, updateActiveTableSelection]
  )

  const toggleRichTextMode = React.useCallback(() => {
    if (markdownMode) {
      const ta = richEditorTextareaRef.current
      if (ta && open) {
        fullscreenRichEditorSelectionBridgeRef.current = {
          kind: "markdown",
          start: ta.selectionStart,
          end: ta.selectionEnd,
        }
      }
      setMarkdownMode(false)
      return
    }

    const visual = richEditorVisualRef.current
    if (visual) {
      if (open) {
        const plainDocumentLength = visual.innerText.length
        const { start, end } = getPlainTextOffsetsInRichEditorVisual(visual)
        setDraft(htmlToMarkdown(visual.innerHTML))
        fullscreenRichEditorSelectionBridgeRef.current = {
          kind: "plain",
          start,
          end,
          plainDocumentLength,
        }
      } else {
        setDraft(htmlToMarkdown(visual.innerHTML))
      }
    }
    setMarkdownMode(true)
  }, [markdownMode, open])

  const handleEditorKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (markdownMode && e.key === "Tab") {
        const textarea = richEditorTextareaRef.current
        if (textarea && textarea.selectionStart === textarea.selectionEnd) {
          const adjusted = adjustMarkdownListIndentAtCursor(
            draft,
            textarea.selectionStart,
            e.shiftKey ? "out" : "in"
          )
          if (adjusted) {
            e.preventDefault()
            setDraft(adjusted.nextValue)
            requestAnimationFrame(() => {
              textarea.focus()
              textarea.setSelectionRange(adjusted.caretStart, adjusted.caretEnd)
            })
            return
          }
        }
      }

      if (!markdownMode && e.key === "Tab" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const visual = richEditorVisualRef.current
        if (visual && !getActiveTableContext(visual)) {
          const sel = window.getSelection()
          const anchor = sel?.anchorNode
          const anchorEl =
            anchor?.nodeType === Node.ELEMENT_NODE ? (anchor as Element) : anchor?.parentElement ?? null
          if (anchorEl?.closest("li")) {
            e.preventDefault()
            visual.focus()
            document.execCommand(e.shiftKey ? "outdent" : "indent", false)
            flushRichEditorToolbarState()
            updateActiveTableSelection()
            return
          }
        }
      }

      if (markdownMode && e.key === "Enter") {
        const textarea = richEditorTextareaRef.current
        if (textarea) {
          const start = textarea.selectionStart
          const lineStart = draft.lastIndexOf("\n", start - 1) + 1
          const line = draft.slice(lineStart, start)
          const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+/)
          if (listMatch) {
            e.preventDefault()
            const indent = listMatch[1] ?? ""
            const marker = /^\d+\.$/.test(listMatch[2]) ? `${Number.parseInt(listMatch[2], 10) + 1}.` : listMatch[2]
            const insertion = `\n${indent}${marker} `
            const next = draft.slice(0, start) + insertion + draft.slice(start)
            setDraft(next)
            requestAnimationFrame(() => {
              textarea.setSelectionRange(start + insertion.length, start + insertion.length)
            })
            return
          }
        }
      }

      if (e.ctrlKey && e.key.toLowerCase() === "b") {
        e.preventDefault()
        runEditorCommand("bold")
        return
      }
      if (e.ctrlKey && e.key.toLowerCase() === "i") {
        e.preventDefault()
        runEditorCommand("italic")
        return
      }
      if (e.ctrlKey && e.key.toLowerCase() === "u") {
        e.preventDefault()
        runEditorCommand("underline")
        return
      }
      if (e.ctrlKey && e.shiftKey && (e.code === "Digit8" || e.key === "*")) {
        e.preventDefault()
        runEditorCommand("bullet")
        return
      }
      if (e.ctrlKey && e.shiftKey && (e.code === "Digit9" || e.key === "(")) {
        e.preventDefault()
        runEditorCommand("numbered")
        return
      }
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault()
        if (!markdownMode) openRichTextLinkDialog()
        else void runEditorCommand("link")
        return
      }
      if (e.ctrlKey && e.altKey && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault()
        runEditorCommand(`h${e.key}`)
        return
      }
      if (e.ctrlKey && e.altKey && (e.key === "0" || e.code === "Numpad0")) {
        e.preventDefault()
        runEditorCommand("formatNormal")
        return
      }
      if (e.ctrlKey && e.key.toLowerCase() === "m") {
        e.preventDefault()
        toggleRichTextMode()
        return
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault()
        runEditorCommand("align-left")
        return
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "r") {
        e.preventDefault()
        runEditorCommand("align-right")
        return
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "e") {
        e.preventDefault()
        runEditorCommand("align-center")
        return
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "j") {
        e.preventDefault()
        runEditorCommand("align-justify")
      }
    },
    [markdownMode, draft, runEditorCommand, toggleRichTextMode, openRichTextLinkDialog, flushRichEditorToolbarState, updateActiveTableSelection]
  )

  const addTableMarkdown = React.useCallback(() => {
    if (!markdownMode && richEditorVisualRef.current) {
      const visual = richEditorVisualRef.current
      visual.focus()
      const rows = Math.max(1, Number(tableRows) || 1)
      const cols = Math.max(1, Number(tableCols) || 1)
      const html = [
        "<table>",
        "<thead><tr>",
        ...Array.from({ length: cols }, (_, i) => `<th>Column ${i + 1}</th>`),
        "</tr></thead>",
        "<tbody>",
        ...Array.from(
          { length: rows },
          () => `<tr>${Array.from({ length: cols }, () => `<td>${TABLE_CELL_NBSP}</td>`).join("")}</tr>`
        ),
        "</tbody>",
        "</table>",
      ].join("")
      let savedCaret: Range | null = null
      try {
        savedCaret = richEditorVisualSavedRangeRef.current?.cloneRange() ?? null
      } catch {
        savedCaret = null
      }
      insertHtmlAtCursor(visual, html, savedCaret)
      finalizeRichEditorVisualDom(visual)
      setDraft(htmlToMarkdown(visual.innerHTML))
      flushRichEditorToolbarState()
      updateActiveTableSelection()
      setInsertTableOpen(false)
      return
    }

    const rows = Math.max(1, Number(tableRows) || 1)
    const cols = Math.max(1, Number(tableCols) || 1)
    const header = `| ${Array.from({ length: cols }, (_, i) => `Column ${i + 1}`).join(" | ")} |`
    const sep = `| ${Array.from({ length: cols }, () => "---").join(" | ")} |`
    const rowTemplate = `| ${Array.from({ length: cols }, () => " ").join(" | ")} |`
    const tableMarkdown = [header, sep, ...Array.from({ length: rows }, () => rowTemplate)].join("\n")
    setDraft((prev) => `${prev}${prev.endsWith("\n") || !prev ? "" : "\n"}${tableMarkdown}\n`)
    setInsertTableOpen(false)
  }, [markdownMode, tableRows, tableCols, flushRichEditorToolbarState, updateActiveTableSelection])

  const applyVisualTableMutation = React.useCallback(
    (mutator: (context: ActiveTableContext) => HTMLTableCellElement | null) => {
      const visual = richEditorVisualRef.current
      if (!visual || markdownMode) return
      visual.focus()
      const context = getActiveTableContext(visual)
      if (!context) return
      const focusTarget = mutator(context)
      if (focusTarget) focusCell(focusTarget)
      finalizeRichEditorVisualDom(visual)
      setDraft(htmlToMarkdown(visual.innerHTML))
      flushRichEditorToolbarState()
      updateActiveTableSelection()
    },
    [markdownMode, flushRichEditorToolbarState, updateActiveTableSelection]
  )

  const insertTableRow = React.useCallback(
    (position: "above" | "below" | "top" | "bottom") => {
      applyVisualTableMutation((context) => {
        const insertIndex =
          position === "above"
            ? context.rowIndex
            : position === "below"
              ? context.rowIndex + 1
              : position === "top"
                ? 0
                : context.table.rows.length

        const newRow = context.table.insertRow(insertIndex)
        for (let i = 0; i < context.colCount; i += 1) {
          const cell = document.createElement("td")
          cell.appendChild(document.createTextNode(TABLE_CELL_NBSP))
          newRow.appendChild(cell)
        }
        return (newRow.cells[Math.min(context.colIndex, newRow.cells.length - 1)] as HTMLTableCellElement | null) ?? null
      })
      setTableOptionsOpen(false)
      setRowInsertOpen(false)
      clearTablePreview()
    },
    [applyVisualTableMutation, clearTablePreview]
  )

  const insertTableColumn = React.useCallback(
    (position: "left" | "right" | "start" | "end") => {
      applyVisualTableMutation((context) => {
        const insertIndex =
          position === "left"
            ? context.colIndex
            : position === "right"
              ? context.colIndex + 1
              : position === "start"
                ? 0
                : context.colCount

        let focusedCell: HTMLTableCellElement | null = null
        Array.from(context.table.rows).forEach((row, rowIndex) => {
          const tagName = row.parentElement?.tagName === "THEAD" ? "th" : "td"
          const cell = document.createElement(tagName)
          cell.appendChild(document.createTextNode(TABLE_CELL_NBSP))
          if (insertIndex >= row.cells.length) row.appendChild(cell)
          else row.insertBefore(cell, row.cells[insertIndex])
          if (rowIndex === context.rowIndex) focusedCell = cell as HTMLTableCellElement
        })
        return focusedCell
      })
      setTableOptionsOpen(false)
      setColumnInsertOpen(false)
      clearTablePreview()
    },
    [applyVisualTableMutation, clearTablePreview]
  )

  const deleteTableRow = React.useCallback((target: RowDeleteTarget) => {
    applyVisualTableMutation((context) => {
      const targetRowIndex = resolveRowDeleteIndex(context, target)
      if (targetRowIndex < 0 || targetRowIndex >= context.rowCount) return context.cell
      if (context.table.rows.length <= 1) {
        context.table.remove()
        return null
      }
      const fallbackIndex = Math.max(0, targetRowIndex - 1)
      context.table.deleteRow(targetRowIndex)
      const fallbackRow = context.table.rows[Math.min(fallbackIndex, context.table.rows.length - 1)]
      if (!fallbackRow) return null
      return (fallbackRow.cells[Math.min(context.colIndex, fallbackRow.cells.length - 1)] as HTMLTableCellElement | null) ?? null
    })
    setTableOptionsOpen(false)
    setRowDeleteOpen(false)
    clearTablePreview()
  }, [applyVisualTableMutation, clearTablePreview])

  const deleteTableColumn = React.useCallback((target: ColDeleteTarget) => {
    applyVisualTableMutation((context) => {
      const targetColIndex = resolveColumnDeleteIndex(context, target)
      if (targetColIndex < 0 || targetColIndex >= context.colCount) return context.cell
      if (context.colCount <= 1) {
        context.table.remove()
        return null
      }
      Array.from(context.table.rows).forEach((row) => {
        if (row.cells[targetColIndex]) row.deleteCell(targetColIndex)
      })
      const fallbackRow = context.table.rows[Math.min(context.rowIndex, context.table.rows.length - 1)]
      if (!fallbackRow) return null
      const fallbackCol = Math.max(0, targetColIndex - 1)
      return (fallbackRow.cells[Math.min(fallbackCol, fallbackRow.cells.length - 1)] as HTMLTableCellElement | null) ?? null
    })
    setTableOptionsOpen(false)
    setColumnDeleteOpen(false)
    clearTablePreview()
  }, [applyVisualTableMutation, clearTablePreview])

  const deleteCurrentTable = React.useCallback(() => {
    applyVisualTableMutation((context) => {
      context.table.remove()
      return null
    })
    setTableOptionsOpen(false)
    clearTablePreview()
  }, [applyVisualTableMutation, clearTablePreview])

  const applyColor = React.useCallback(
    (mode: "color" | "highlight", color: string) => {
      if (!markdownMode) {
        const visual = richEditorVisualRef.current
        if (!visual) return
        visual.focus()
        if (mode === "color") {
          document.execCommand("foreColor", false, color)
        } else {
          document.execCommand("hiliteColor", false, color)
        }
        finalizeRichEditorVisualDom(visual)
        setDraft(htmlToMarkdown(visual.innerHTML))
        flushRichEditorToolbarState()
        return
      }

      const textarea = richEditorTextareaRef.current
      if (!textarea) return
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const styleKey = mode === "color" ? "color" : "background-color"
      setDraft((value) => {
        const result = insertAtSelection(value, start, end, `<span style="${styleKey}:${color}">`, "</span>")
        requestAnimationFrame(() => {
          textarea.focus()
          textarea.setSelectionRange(result.caretStart, result.caretEnd)
        })
        return result.nextValue
      })
    },
    [markdownMode, flushRichEditorToolbarState]
  )

  const applyTextType = React.useCallback(
    (type: "normal" | "h1" | "h2" | "h3" | "h4") => {
      if (type === "normal") {
        runEditorCommand("formatNormal")
        return
      }
      runEditorCommand(type)
    },
    [runEditorCommand]
  )

  const save = React.useCallback(() => {
    if (!session) return
    void onSave(draft).then(() => onClose())
  }, [session, draft, onSave, onClose])

  React.useLayoutEffect(() => {
    let raf1 = 0
    let raf2 = 0
    let cancelled = false

    if (!open) {
      previousRichTextEditorOpenRef.current = false
      previousRichTextMarkdownModeRef.current = markdownMode
      fullscreenRichEditorSelectionBridgeRef.current = null
      return
    }

    const prevMarkdownMode = previousRichTextMarkdownModeRef.current
    const justOpened = !previousRichTextEditorOpenRef.current
    const switchedToTextMode = !markdownMode && prevMarkdownMode

    const applyVisualFromMarkdownAndRestoreCaret = () => {
      const el = richEditorVisualRef.current
      if (!el || cancelled) return false
      el.innerHTML = markdownToHtml(draft)
      finalizeRichEditorVisualDom(el)
      const bridge = fullscreenRichEditorSelectionBridgeRef.current
      if (bridge?.kind === "markdown") {
        const mdLen = draft.length
        const plainLen = el.innerText.length
        const s = mapRelativeCaretOffset(mdLen, plainLen, bridge.start)
        const e = mapRelativeCaretOffset(mdLen, plainLen, bridge.end)
        setPlainTextCaretInRichEditorVisual(el, s, e)
        fullscreenRichEditorSelectionBridgeRef.current = null
      }
      updateActiveTableSelection()
      return true
    }

    if (markdownMode) {
      previousRichTextEditorOpenRef.current = true
    } else if (justOpened || switchedToTextMode) {
      if (applyVisualFromMarkdownAndRestoreCaret()) {
        previousRichTextEditorOpenRef.current = true
      } else {
        raf1 = requestAnimationFrame(() => {
          if (cancelled) return
          if (applyVisualFromMarkdownAndRestoreCaret()) {
            previousRichTextEditorOpenRef.current = true
            return
          }
          raf2 = requestAnimationFrame(() => {
            if (cancelled) return
            applyVisualFromMarkdownAndRestoreCaret()
            previousRichTextEditorOpenRef.current = true
          })
        })
      }
    } else {
      previousRichTextEditorOpenRef.current = true
    }

    previousRichTextMarkdownModeRef.current = markdownMode

    return () => {
      cancelled = true
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [open, markdownMode, draft, updateActiveTableSelection])

  React.useLayoutEffect(() => {
    if (!open || !markdownMode) return
    const bridge = fullscreenRichEditorSelectionBridgeRef.current
    if (!bridge || bridge.kind !== "plain") return
    const ta = richEditorTextareaRef.current
    if (!ta) return
    const md = draft
    const mdLen = md.length
    const fromLen = bridge.plainDocumentLength
    const s = mapRelativeCaretOffset(fromLen, mdLen, bridge.start)
    const e = mapRelativeCaretOffset(fromLen, mdLen, bridge.end)
    ta.focus()
    ta.setSelectionRange(Math.min(s, e), Math.max(s, e))
    fullscreenRichEditorSelectionBridgeRef.current = null
  }, [open, markdownMode, draft])

  const currentRowStaticHighlighted = React.useMemo(() => {
    if (markdownMode || !tableSelectionState) return false
    const visual = richEditorVisualRef.current
    if (!visual) return false
    const ctx = getActiveTableContext(visual)
    if (!ctx) return false
    return ctx.row.hasAttribute("data-static-row-highlight")
  }, [markdownMode, tableSelectionState])

  const currentColumnStaticHighlighted = React.useMemo(() => {
    if (markdownMode || !tableSelectionState) return false
    const visual = richEditorVisualRef.current
    if (!visual) return false
    const ctx = getActiveTableContext(visual)
    if (!ctx) return false
    return ctx.cell.hasAttribute("data-static-col-highlight")
  }, [markdownMode, tableSelectionState])

  const column = session?.column ?? "description"

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose()
        }}
      >
        <DialogContent className="!max-w-[98vw] !w-[98vw] max-h-[96vh] overflow-hidden !flex !flex-col">
          <DialogHeader>
            <DialogTitle>Edit {column === "description" ? "Description" : "Notes"}</DialogTitle>
            <DialogDescription>
              Full editor mode for markdown content. Ctrl+M toggles markdown mode.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2 items-center border rounded-md p-2">
            <Popover open={textColorOpen} onOpenChange={setTextColorOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" data-rich-editor-control="true">
                  Text Color
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52">
                <div className="grid grid-cols-6 gap-2">
                  {RICH_TEXT_COLORS.map((color) => (
                    <button
                      key={`text-${color}`}
                      type="button"
                      className="w-6 h-6 rounded border"
                      style={{ backgroundColor: color }}
                      onClick={() => {
                        applyColor("color", color)
                        setTextColorOpen(false)
                      }}
                      data-rich-editor-control="true"
                      title={color}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Popover open={highlightColorOpen} onOpenChange={setHighlightColorOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" data-rich-editor-control="true">
                  Highlight
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52">
                <div className="grid grid-cols-6 gap-2">
                  {RICH_TEXT_COLORS.map((color) => (
                    <button
                      key={`highlight-${color}`}
                      type="button"
                      className="w-6 h-6 rounded border"
                      style={{ backgroundColor: color }}
                      onClick={() => {
                        applyColor("highlight", color)
                        setHighlightColorOpen(false)
                      }}
                      data-rich-editor-control="true"
                      title={color}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Select value={fontSize} onValueChange={onFontSizeChange}>
              <SelectTrigger className="w-[100px] h-9" data-rich-editor-control="true">
                <SelectValue placeholder="Size" />
              </SelectTrigger>
              <SelectContent>
                {RICH_TEXT_FONT_SIZES.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size}px
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              key={markdownMode ? "rich-text-type-md" : "rich-text-type-wysiwyg"}
              {...(markdownMode
                ? ({ defaultValue: "normal" } as const)
                : { value: wysiwygToolbarState.blockTag })}
              onValueChange={(value) => applyTextType(value as "normal" | "h1" | "h2" | "h3" | "h4")}
            >
              <SelectTrigger className="w-[130px] h-9" data-rich-editor-control="true">
                <SelectValue placeholder="Text type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal" title="Ctrl+Alt+0">
                  Normal
                </SelectItem>
                <SelectItem value="h1" title="Ctrl+Alt+1">
                  Headline 1
                </SelectItem>
                <SelectItem value="h2" title="Ctrl+Alt+2">
                  Headline 2
                </SelectItem>
                <SelectItem value="h3" title="Ctrl+Alt+3">
                  Headline 3
                </SelectItem>
                <SelectItem value="h4" title="Ctrl+Alt+4">
                  Headline 4
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              type="button"
              variant={!markdownMode && wysiwygToolbarState.bold ? "secondary" : "outline"}
              aria-pressed={!markdownMode && wysiwygToolbarState.bold}
              title="Bold (Ctrl+B)"
              onMouseDown={(e) => {
                if (!markdownMode) e.preventDefault()
              }}
              onClick={() => runEditorCommand("bold")}
              data-rich-editor-control="true"
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              type="button"
              variant={!markdownMode && wysiwygToolbarState.italic ? "secondary" : "outline"}
              aria-pressed={!markdownMode && wysiwygToolbarState.italic}
              title="Italic (Ctrl+I)"
              onMouseDown={(e) => {
                if (!markdownMode) e.preventDefault()
              }}
              onClick={() => runEditorCommand("italic")}
              data-rich-editor-control="true"
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              type="button"
              variant={!markdownMode && wysiwygToolbarState.underline ? "secondary" : "outline"}
              aria-pressed={!markdownMode && wysiwygToolbarState.underline}
              title="Underline (Ctrl+U)"
              onMouseDown={(e) => {
                if (!markdownMode) e.preventDefault()
              }}
              onClick={() => runEditorCommand("underline")}
              data-rich-editor-control="true"
            >
              <Underline className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              title="Insert link (Ctrl+K)"
              onMouseDown={(e) => {
                if (!markdownMode) e.preventDefault()
              }}
              onClick={() => {
                if (!markdownMode) openRichTextLinkDialog()
                else void runEditorCommand("link")
              }}
              data-rich-editor-control="true"
            >
              <Link2 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              title="Bullet list (Ctrl+Shift+8)"
              onMouseDown={(e) => {
                if (!markdownMode) e.preventDefault()
              }}
              onClick={() => runEditorCommand("bullet")}
              data-rich-editor-control="true"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              title="Numbered list (Ctrl+Shift+9)"
              onMouseDown={(e) => {
                if (!markdownMode) e.preventDefault()
              }}
              onClick={() => runEditorCommand("numbered")}
              data-rich-editor-control="true"
            >
              <ListOrdered className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              title="Align left (Ctrl+Shift+L)"
              onMouseDown={(e) => {
                if (!markdownMode) e.preventDefault()
              }}
              onClick={() => runEditorCommand("align-left")}
              data-rich-editor-control="true"
            >
              <AlignLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              title="Align right (Ctrl+Shift+R)"
              onMouseDown={(e) => {
                if (!markdownMode) e.preventDefault()
              }}
              onClick={() => runEditorCommand("align-right")}
              data-rich-editor-control="true"
            >
              <AlignRight className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              title="Align center (Ctrl+Shift+E)"
              onMouseDown={(e) => {
                if (!markdownMode) e.preventDefault()
              }}
              onClick={() => runEditorCommand("align-center")}
              data-rich-editor-control="true"
            >
              <AlignCenter className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              title="Justify (Ctrl+Shift+J)"
              onMouseDown={(e) => {
                if (!markdownMode) e.preventDefault()
              }}
              onClick={() => runEditorCommand("align-justify")}
              data-rich-editor-control="true"
            >
              <AlignJustify className="h-4 w-4" />
            </Button>
            <Popover open={insertTableOpen} onOpenChange={setInsertTableOpen}>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  data-rich-editor-control="true"
                  onMouseDown={(e) => {
                    if (!markdownMode) e.preventDefault()
                  }}
                >
                  <Table2 className="h-4 w-4 mr-1" />
                  Insert table
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <div className="space-y-3">
                  <div className="text-sm font-medium">Table size</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="table-rows">Rows</Label>
                      <Input
                        id="table-rows"
                        value={tableRows}
                        onChange={(e) => setTableRows(e.target.value)}
                        className="h-8"
                        data-rich-editor-control="true"
                        inputMode="numeric"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="table-cols">Columns</Label>
                      <Input
                        id="table-cols"
                        value={tableCols}
                        onChange={(e) => setTableCols(e.target.value)}
                        className="h-8"
                        data-rich-editor-control="true"
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={addTableMarkdown}
                      data-rich-editor-control="true"
                      onMouseDown={(e) => {
                        if (!markdownMode) e.preventDefault()
                      }}
                    >
                      Insert
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            {!markdownMode && tableSelectionState ? (
              <Popover open={tableOptionsOpen} onOpenChange={setTableOptionsOpen}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline" data-rich-editor-control="true">
                    Table options
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[430px]">
                  <div className="space-y-3 text-sm" onMouseLeave={clearDangerTablePreview}>
                    <div className="text-muted-foreground">
                      Cell: row {tableSelectionState.rowIndex + 1}/{tableSelectionState.rowCount}, column {tableSelectionState.colIndex + 1}/
                      {tableSelectionState.colCount}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Toggle
                        size="sm"
                        variant="outline"
                        pressed={currentRowStaticHighlighted}
                        onPressedChange={toggleStaticRowHighlightAtCaret}
                        data-rich-editor-control="true"
                        onMouseDown={(e) => {
                          if (!markdownMode) e.preventDefault()
                        }}
                        aria-label="Highlight row"
                        title="Pin background on this row, including the header (survives markdown mode and save). Click again to remove."
                      >
                        <BetweenVerticalStart className="h-4 w-4" />
                        Highlight row
                      </Toggle>
                      <Toggle
                        size="sm"
                        variant="outline"
                        pressed={currentColumnStaticHighlighted}
                        onPressedChange={toggleStaticColumnHighlightAtCaret}
                        data-rich-editor-control="true"
                        onMouseDown={(e) => {
                          if (!markdownMode) e.preventDefault()
                        }}
                        aria-label="Highlight column"
                        title="Pin header-style background on this column (stays when you move the caret). Click again to remove."
                      >
                        <BetweenHorizontalStart className="h-4 w-4" />
                        Highlight column
                      </Toggle>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Popover open={rowInsertOpen} onOpenChange={setRowInsertOpen}>
                        <PopoverTrigger asChild>
                          <Button size="sm" variant="secondary" data-rich-editor-control="true">
                            <Rows3 className="h-4 w-4 mr-1" />
                            Row insert
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64">
                          <div className="grid gap-1">
                            <Button size="sm" variant="ghost" className="justify-start" onClick={() => insertTableRow("below")} data-rich-editor-control="true">Under current row</Button>
                            <Button size="sm" variant="ghost" className="justify-start" onClick={() => insertTableRow("above")} data-rich-editor-control="true">Above current row</Button>
                            <Button size="sm" variant="ghost" className="justify-start" onClick={() => insertTableRow("bottom")} data-rich-editor-control="true">At bottom</Button>
                            <Button size="sm" variant="ghost" className="justify-start" onClick={() => insertTableRow("top")} data-rich-editor-control="true">At top</Button>
                          </div>
                        </PopoverContent>
                      </Popover>

                      <Popover open={rowDeleteOpen} onOpenChange={setRowDeleteOpen}>
                        <PopoverTrigger asChild>
                          <Button size="sm" variant="secondary" data-rich-editor-control="true">
                            <Rows2 className="h-4 w-4 mr-1" />
                            Row deletion
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64">
                          <div className="grid gap-1" onMouseLeave={clearTablePreview}>
                            <Button size="sm" variant="ghost" className="justify-start text-destructive hover:text-destructive" onMouseEnter={() => previewTableRow(tableSelectionState.rowIndex)} onClick={() => deleteTableRow("current")} data-rich-editor-control="true">Delete current row</Button>
                            <Button size="sm" variant="ghost" className="justify-start text-destructive hover:text-destructive" disabled={tableSelectionState.rowIndex <= 0} onMouseEnter={() => previewTableRow(tableSelectionState.rowIndex - 1)} onClick={() => deleteTableRow("above")} data-rich-editor-control="true">Delete row above</Button>
                            <Button size="sm" variant="ghost" className="justify-start text-destructive hover:text-destructive" disabled={tableSelectionState.rowIndex >= tableSelectionState.rowCount - 1} onMouseEnter={() => previewTableRow(tableSelectionState.rowIndex + 1)} onClick={() => deleteTableRow("below")} data-rich-editor-control="true">Delete row below</Button>
                            <Button size="sm" variant="ghost" className="justify-start text-destructive hover:text-destructive" onMouseEnter={() => previewTableRow(0)} onClick={() => deleteTableRow("top")} data-rich-editor-control="true">Delete top row</Button>
                            <Button size="sm" variant="ghost" className="justify-start text-destructive hover:text-destructive" onMouseEnter={() => previewTableRow(tableSelectionState.rowCount - 1)} onClick={() => deleteTableRow("bottom")} data-rich-editor-control="true">Delete bottom row</Button>
                          </div>
                        </PopoverContent>
                      </Popover>

                      <Popover open={columnInsertOpen} onOpenChange={setColumnInsertOpen}>
                        <PopoverTrigger asChild>
                          <Button size="sm" variant="secondary" data-rich-editor-control="true">
                            <Columns3 className="h-4 w-4 mr-1" />
                            Column insert
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64">
                          <div className="grid gap-1">
                            <Button size="sm" variant="ghost" className="justify-start" onClick={() => insertTableColumn("right")} data-rich-editor-control="true">Right of current column</Button>
                            <Button size="sm" variant="ghost" className="justify-start" onClick={() => insertTableColumn("left")} data-rich-editor-control="true">Left of current column</Button>
                            <Button size="sm" variant="ghost" className="justify-start" onClick={() => insertTableColumn("end")} data-rich-editor-control="true">At right edge</Button>
                            <Button size="sm" variant="ghost" className="justify-start" onClick={() => insertTableColumn("start")} data-rich-editor-control="true">At left edge</Button>
                          </div>
                        </PopoverContent>
                      </Popover>

                      <Popover open={columnDeleteOpen} onOpenChange={setColumnDeleteOpen}>
                        <PopoverTrigger asChild>
                          <Button size="sm" variant="secondary" data-rich-editor-control="true">
                            <Columns2 className="h-4 w-4 mr-1" />
                            Column deletion
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64">
                          <div className="grid gap-1" onMouseLeave={clearTablePreview}>
                            <Button size="sm" variant="ghost" className="justify-start text-destructive hover:text-destructive" onMouseEnter={() => previewTableColumn(tableSelectionState.colIndex)} onClick={() => deleteTableColumn("current")} data-rich-editor-control="true">Delete current column</Button>
                            <Button size="sm" variant="ghost" className="justify-start text-destructive hover:text-destructive" disabled={tableSelectionState.colIndex <= 0} onMouseEnter={() => previewTableColumn(tableSelectionState.colIndex - 1)} onClick={() => deleteTableColumn("left")} data-rich-editor-control="true">Delete column left</Button>
                            <Button size="sm" variant="ghost" className="justify-start text-destructive hover:text-destructive" disabled={tableSelectionState.colIndex >= tableSelectionState.colCount - 1} onMouseEnter={() => previewTableColumn(tableSelectionState.colIndex + 1)} onClick={() => deleteTableColumn("right")} data-rich-editor-control="true">Delete column right</Button>
                            <Button size="sm" variant="ghost" className="justify-start text-destructive hover:text-destructive" onMouseEnter={() => previewTableColumn(0)} onClick={() => deleteTableColumn("start")} data-rich-editor-control="true">Delete first column</Button>
                            <Button size="sm" variant="ghost" className="justify-start text-destructive hover:text-destructive" onMouseEnter={() => previewTableColumn(tableSelectionState.colCount - 1)} onClick={() => deleteTableColumn("end")} data-rich-editor-control="true">Delete last column</Button>
                          </div>
                        </PopoverContent>
                      </Popover>

                      <Button
                        size="sm"
                        variant="destructive"
                        onMouseEnter={previewTableDelete}
                        onMouseLeave={clearTablePreview}
                        onClick={deleteCurrentTable}
                        data-rich-editor-control="true"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Table deletion
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            ) : null}
            <Button size="sm" variant={markdownMode ? "default" : "outline"} onClick={toggleRichTextMode} data-rich-editor-control="true">
              <FileText className="h-4 w-4 mr-1" />
              Markdown
            </Button>
          </div>
          <div className="py-2">
            <div className="flex flex-col">
              <Label className="mb-2">{markdownMode ? "Markdown Source" : "Text Mode"}</Label>
              {markdownMode ? (
                <Textarea
                  ref={richEditorTextareaRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => handleEditorKeyDown(e)}
                  className="font-mono resize-y min-h-[45vh] h-[62vh] max-h-[72vh] focus-visible:border-border focus-visible:ring-1 focus-visible:ring-muted-foreground/20 focus-visible:ring-offset-0"
                  style={{ fontSize: `${fontSize}px`, lineHeight: 1.5 }}
                />
              ) : (
                <div
                  ref={assignRichEditorVisualRef}
                  contentEditable
                  className={`border rounded-md p-3 overflow-auto resize-y min-h-[45vh] h-[62vh] max-h-[72vh] prose prose-sm max-w-none dark:prose-invert ${RICH_TEXT_VISUAL_HEADING_CLASSES} ${RICH_TEXT_PROSE_LINK_STYLES} [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_li>ul]:mt-1 [&_li>ol]:mt-1 [&_ul_ul]:ml-6 [&_ol_ol]:ml-6 [&_ul_ol]:ml-6 [&_ol_ul]:ml-6 [&_table]:w-full [&_table]:border-collapse [&_thead]:bg-transparent [&_th]:border [&_th]:border-border [&_th]:!px-3 [&_th]:!py-3 [&_th]:!min-h-[3rem] [&_th]:text-left [&_th]:font-semibold [&_th]:align-middle [&_th]:leading-normal [&_td]:border [&_td]:border-border [&_td]:!px-3 [&_td]:!py-3 [&_td]:!min-h-[3rem] [&_td]:align-middle [&_td]:leading-normal [&_td]:box-border [&_th]:box-border [&_tbody_tr]:!min-h-[3rem] [&_td[data-table-preview='danger']]:bg-red-500/25 [&_th[data-table-preview='danger']]:bg-red-500/25 [&_table[data-table-preview='danger']_td]:bg-red-500/25 [&_table[data-table-preview='danger']_th]:bg-red-500/25 [&_td[data-table-preview='insert-row']]:bg-blue-500/25 [&_th[data-table-preview='insert-row']]:bg-blue-500/25 [&_td[data-table-preview='insert-col']]:bg-blue-500/25 [&_th[data-table-preview='insert-col']]:bg-blue-500/25 [&_tr[data-static-row-highlight]_td]:!bg-muted/40 [&_tr[data-static-row-highlight]_th]:!bg-muted/40 [&_td[data-static-col-highlight]]:!bg-muted/40 [&_th[data-static-col-highlight]]:!bg-muted/40 outline-none focus:border-muted-foreground/20 focus:ring-1 focus:ring-muted-foreground/12 focus:ring-offset-0`}
                  style={{ fontSize: `${fontSize}px`, lineHeight: 1.5 }}
                  onPointerUp={(e) => {
                    const el = e.currentTarget as HTMLDivElement
                    const sel = window.getSelection()
                    if (!sel || sel.rangeCount === 0) return
                    const r = sel.getRangeAt(0)
                    if (!el.contains(r.commonAncestorContainer)) return
                    try {
                      richEditorVisualSavedRangeRef.current = r.cloneRange()
                    } catch {
                      richEditorVisualSavedRangeRef.current = null
                    }
                  }}
                  onInput={(e) => {
                    const el = e.currentTarget as HTMLDivElement
                    const lastHoisted = finalizeRichEditorVisualDom(el)
                    setDraft(htmlToMarkdown(el.innerHTML))
                    flushRichEditorToolbarState()
                    updateActiveTableSelection()
                    if (lastHoisted) {
                      queueMicrotask(() => {
                        requestAnimationFrame(() => {
                          requestAnimationFrame(() => {
                            restoreCaretAfterHoistedNestedList(el, lastHoisted)
                          })
                        })
                      })
                    }
                  }}
                  onKeyDown={(e) => handleEditorKeyDown(e as unknown as React.KeyboardEvent<HTMLTextAreaElement>)}
                />
              )}
            </div>
          </div>
          {markdownMode && compileError ? (
            <div className="text-sm text-destructive border border-destructive/30 rounded-md px-3 py-2">Markdown warning: {compileError}</div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={richTextLinkDialogOpen}
        onOpenChange={(next) => {
          setRichTextLinkDialogOpen(next)
          if (!next) richTextLinkRangeRef.current = null
        }}
      >
        <DialogContent className="z-[100] sm:max-w-md" overlayClassName="z-[100]">
          <DialogHeader>
            <DialogTitle>Insert link</DialogTitle>
            <DialogDescription>
              Enter the text to show and the URL. If you had text selected in the editor, link text starts from that selection and can be edited.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4 py-2"
            onSubmit={(e) => {
              e.preventDefault()
              applyRichTextLink()
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="rich-text-link-text">Link text</Label>
              <Input
                id="rich-text-link-text"
                value={richTextLinkText}
                onChange={(e) => setRichTextLinkText(e.target.value)}
                placeholder="Visible label"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rich-text-link-url">URL</Label>
              <Input
                id="rich-text-link-url"
                inputMode="url"
                value={richTextLinkUrl}
                onChange={(e) => setRichTextLinkUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRichTextLinkDialogOpen(false)
                  richTextLinkRangeRef.current = null
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!richTextLinkUrl.trim()}>
                Insert link
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
