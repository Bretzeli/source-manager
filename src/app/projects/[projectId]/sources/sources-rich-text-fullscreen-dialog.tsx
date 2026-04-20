"use client"

import * as React from "react"
import { marked } from "marked"
import TurndownService from "turndown"
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
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Link2,
  List,
  ListOrdered,
  AlignLeft,
  AlignRight,
  AlignCenter,
  AlignJustify,
  Table2,
  Minus,
  PlusCircle,
  FileText,
} from "lucide-react"
import { PREDEFINED_COLORS } from "./constants"
import { prepareRichTextMarkdownForRender, RICH_TEXT_PROSE_LINK_STYLES } from "./rich-text-markdown-utils"

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
  const selected = value.slice(selectionStart, selectionEnd).trim()
  const insertion = `${needsLineBreakBefore ? "\n\n" : ""}${marker} ${selected || "item"}`
  const nextValue = `${before}${insertion}${after}`
  const caretPos = before.length + insertion.length
  return { nextValue, caretStart: caretPos, caretEnd: caretPos }
}

function markdownToHtml(markdown: string) {
  return marked.parse(prepareRichTextMarkdownForRender(markdown), { breaks: true, gfm: true }) as string
}

function ensureClickableAnchorsInEditable(root: HTMLElement) {
  root.querySelectorAll("a[href]").forEach((anchor) => {
    anchor.setAttribute("contenteditable", "false")
    if (!anchor.getAttribute("target")) {
      anchor.setAttribute("target", "_blank")
      anchor.setAttribute("rel", "noopener noreferrer")
    }
  })
}

function htmlToMarkdown(html: string) {
  return turndownService.turndown(html).trim()
}

function insertHtmlAtCursor(container: HTMLElement, html: string) {
  const selection = window.getSelection()
  if (!selection) return

  if (selection.rangeCount === 0 || !container.contains(selection.getRangeAt(0).commonAncestorContainer)) {
    const range = document.createRange()
    range.selectNodeContents(container)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  const range = selection.getRangeAt(0)
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
  if (lastNode) {
    const newRange = document.createRange()
    newRange.setStartAfter(lastNode)
    newRange.collapse(true)
    selection.removeAllRanges()
    selection.addRange(newRange)
  }
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
  const [textColorOpen, setTextColorOpen] = React.useState(false)
  const [highlightColorOpen, setHighlightColorOpen] = React.useState(false)
  const [richTextLinkDialogOpen, setRichTextLinkDialogOpen] = React.useState(false)
  const [richTextLinkText, setRichTextLinkText] = React.useState("")
  const [richTextLinkUrl, setRichTextLinkUrl] = React.useState("")
  const [wysiwygToolbarState, setWysiwygToolbarState] = React.useState<WysiwygToolbarState>(DEFAULT_WYSIWYG_TOOLBAR_STATE)

  const richTextLinkRangeRef = React.useRef<Range | null>(null)
  const richEditorTextareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const richEditorVisualRef = React.useRef<HTMLDivElement | null>(null)
  const fullscreenRichEditorSelectionBridgeRef = React.useRef<FullscreenRichEditorSelectionBridge | null>(null)
  const previousRichTextEditorOpenRef = React.useRef(false)
  const previousRichTextMarkdownModeRef = React.useRef(false)

  const compileError = React.useMemo(
    () => (markdownMode ? validateMarkdownBestEffort(draft) : null),
    [markdownMode, draft]
  )

  /** Radix Dialog mounts the portal after layout; seed WYSIWYG HTML when the node appears. */
  const assignRichEditorVisualRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      richEditorVisualRef.current = node
      if (!node || !open || markdownMode) return
      const html = markdownToHtml(draft)
      if (!html.trim()) return
      if (!node.textContent?.trim()) {
        node.innerHTML = html
        ensureClickableAnchorsInEditable(node)
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
      })
    }

    document.addEventListener("selectionchange", schedule)
    schedule()

    return () => {
      cancelAnimationFrame(rafId)
      document.removeEventListener("selectionchange", schedule)
    }
  }, [open, markdownMode, flushRichEditorToolbarState])

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

    ensureClickableAnchorsInEditable(visual)
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
    }
  }, [open])

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
            insertHtmlAtCursor(visual, '<ul style="list-style-type:disc; margin-left:1.25rem;"><li>item</li></ul>')
            break
          }
          case "numbered": {
            insertHtmlAtCursor(visual, '<ol style="list-style-type:decimal; margin-left:1.25rem;"><li>item</li></ol>')
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
        ensureClickableAnchorsInEditable(visual)
        setDraft(htmlToMarkdown(visual.innerHTML))
        flushRichEditorToolbarState()
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
    [markdownMode, draft, flushRichEditorToolbarState]
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
      if (e.ctrlKey && e.altKey && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault()
        runEditorCommand(`h${e.key}`)
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
    [markdownMode, draft, runEditorCommand, toggleRichTextMode]
  )

  const addTableMarkdown = React.useCallback(() => {
    if (!markdownMode && richEditorVisualRef.current) {
      richEditorVisualRef.current.focus()
      const rows = Math.max(1, Number(tableRows) || 1)
      const cols = Math.max(1, Number(tableCols) || 1)
      const html = [
        "<table>",
        "<thead><tr>",
        ...Array.from({ length: cols }, (_, i) => `<th>Column ${i + 1}</th>`),
        "</tr></thead>",
        "<tbody>",
        ...Array.from({ length: rows }, () => `<tr>${Array.from({ length: cols }, () => "<td><br /></td>").join("")}</tr>`),
        "</tbody>",
        "</table>",
      ].join("")
      document.execCommand("insertHTML", false, html)
      ensureClickableAnchorsInEditable(richEditorVisualRef.current)
      setDraft(htmlToMarkdown(richEditorVisualRef.current.innerHTML))
      flushRichEditorToolbarState()
      return
    }

    const rows = Math.max(1, Number(tableRows) || 1)
    const cols = Math.max(1, Number(tableCols) || 1)
    const header = `| ${Array.from({ length: cols }, (_, i) => `Column ${i + 1}`).join(" | ")} |`
    const sep = `| ${Array.from({ length: cols }, () => "---").join(" | ")} |`
    const rowTemplate = `| ${Array.from({ length: cols }, () => " ").join(" | ")} |`
    const tableMarkdown = [header, sep, ...Array.from({ length: rows }, () => rowTemplate)].join("\n")
    setDraft((prev) => `${prev}${prev.endsWith("\n") || !prev ? "" : "\n"}${tableMarkdown}\n`)
  }, [markdownMode, tableRows, tableCols, flushRichEditorToolbarState])

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
        ensureClickableAnchorsInEditable(visual)
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
        if (!markdownMode) runEditorCommand("formatNormal")
        return
      }
      runEditorCommand(type)
    },
    [runEditorCommand, markdownMode]
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
      ensureClickableAnchorsInEditable(el)
      const bridge = fullscreenRichEditorSelectionBridgeRef.current
      if (bridge?.kind === "markdown") {
        const mdLen = draft.length
        const plainLen = el.innerText.length
        const s = mapRelativeCaretOffset(mdLen, plainLen, bridge.start)
        const e = mapRelativeCaretOffset(mdLen, plainLen, bridge.end)
        setPlainTextCaretInRichEditorVisual(el, s, e)
        fullscreenRichEditorSelectionBridgeRef.current = null
      }
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
  }, [open, markdownMode, draft])

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
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="h1">Headline 1</SelectItem>
                <SelectItem value="h2">Headline 2</SelectItem>
                <SelectItem value="h3">Headline 3</SelectItem>
                <SelectItem value="h4">Headline 4</SelectItem>
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
              type="button"
              variant={!markdownMode && wysiwygToolbarState.blockTag === "h1" ? "secondary" : "outline"}
              aria-pressed={!markdownMode && wysiwygToolbarState.blockTag === "h1"}
              title="Heading 1 (Ctrl+Alt+1)"
              onMouseDown={(e) => {
                if (!markdownMode) e.preventDefault()
              }}
              onClick={() => runEditorCommand("h1")}
              data-rich-editor-control="true"
            >
              <Heading1 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              type="button"
              variant={!markdownMode && wysiwygToolbarState.blockTag === "h2" ? "secondary" : "outline"}
              aria-pressed={!markdownMode && wysiwygToolbarState.blockTag === "h2"}
              title="Heading 2 (Ctrl+Alt+2)"
              onMouseDown={(e) => {
                if (!markdownMode) e.preventDefault()
              }}
              onClick={() => runEditorCommand("h2")}
              data-rich-editor-control="true"
            >
              <Heading2 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              type="button"
              variant={!markdownMode && wysiwygToolbarState.blockTag === "h3" ? "secondary" : "outline"}
              aria-pressed={!markdownMode && wysiwygToolbarState.blockTag === "h3"}
              title="Heading 3 (Ctrl+Alt+3)"
              onMouseDown={(e) => {
                if (!markdownMode) e.preventDefault()
              }}
              onClick={() => runEditorCommand("h3")}
              data-rich-editor-control="true"
            >
              <Heading3 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              type="button"
              variant={!markdownMode && wysiwygToolbarState.blockTag === "h4" ? "secondary" : "outline"}
              aria-pressed={!markdownMode && wysiwygToolbarState.blockTag === "h4"}
              title="Heading 4 (Ctrl+Alt+4)"
              onMouseDown={(e) => {
                if (!markdownMode) e.preventDefault()
              }}
              onClick={() => runEditorCommand("h4")}
              data-rich-editor-control="true"
            >
              <Heading4 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              title="Insert link"
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
            <Button size="sm" variant="outline" onClick={() => runEditorCommand("bullet")} data-rich-editor-control="true">
              <List className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => runEditorCommand("numbered")} data-rich-editor-control="true">
              <ListOrdered className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => runEditorCommand("align-left")} data-rich-editor-control="true">
              <AlignLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => runEditorCommand("align-right")} data-rich-editor-control="true">
              <AlignRight className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => runEditorCommand("align-center")} data-rich-editor-control="true">
              <AlignCenter className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => runEditorCommand("align-justify")} data-rich-editor-control="true">
              <AlignJustify className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1 border rounded-md px-2 py-1">
              <Table2 className="h-4 w-4 text-muted-foreground" />
              <Input
                value={tableRows}
                onChange={(e) => setTableRows(e.target.value)}
                className="h-8 w-12 px-1"
                data-rich-editor-control="true"
                title="Rows"
              />
              <Input
                value={tableCols}
                onChange={(e) => setTableCols(e.target.value)}
                className="h-8 w-12 px-1"
                data-rich-editor-control="true"
                title="Columns"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setTableRows((prev) => String(Math.max(1, Number(prev || "1") - 1)))}
                data-rich-editor-control="true"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setTableRows((prev) => String(Number(prev || "1") + 1))}
                data-rich-editor-control="true"
              >
                <PlusCircle className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="outline" onClick={addTableMarkdown} data-rich-editor-control="true">
                Insert
              </Button>
            </div>
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
                  className="font-mono resize-y min-h-[45vh] h-[62vh] max-h-[72vh]"
                  style={{ fontSize: `${fontSize}px`, lineHeight: 1.5 }}
                />
              ) : (
                <div
                  ref={assignRichEditorVisualRef}
                  contentEditable
                  className={`border rounded-md p-3 overflow-auto resize-y min-h-[45vh] h-[62vh] max-h-[72vh] prose prose-sm max-w-none dark:prose-invert ${RICH_TEXT_VISUAL_HEADING_CLASSES} ${RICH_TEXT_PROSE_LINK_STYLES} [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_table]:w-full [&_table]:border-collapse [&_table]:table-fixed [&_thead]:bg-muted/40 [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_td]:align-top [&_td]:min-h-[2rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
                  style={{ fontSize: `${fontSize}px`, lineHeight: 1.5 }}
                  onInput={(e) => {
                    const el = e.currentTarget as HTMLDivElement
                    ensureClickableAnchorsInEditable(el)
                    setDraft(htmlToMarkdown(el.innerHTML))
                    flushRichEditorToolbarState()
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
