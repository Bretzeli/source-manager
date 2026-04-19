"use client"

import * as React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AutoResizeTextarea } from "@/components/auto-resize-textarea"
import { Expand, FileText, X } from "lucide-react"
import type { ColumnKey } from "@/types/sources"

const RICH_TEXT_PROSE_LINK_STYLES =
  "[&_a]:cursor-pointer [&_a]:text-primary [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-primary/45 [&_a]:transition-colors hover:[&_a]:decoration-primary hover:[&_a]:text-primary/90 [&_a]:break-all"

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

function normalizeMarkdownForListParsing(markdown: string) {
  return markdown.replace(/([^\n])\n((?:\s*)(?:[-*+]|\d+\.)\s+)/g, "$1\n\n$2")
}

type InlineSourceCellEditorProps = {
  column: ColumnKey
  initialValue: string
  cellDimensions: { width: number; height: number } | null
  autoResizeTextarea: boolean
  richTextFontSize: string
  markdownModeOnMount: boolean
  onOpenFullscreen: (draft: string, markdownMode: boolean) => void
  onCommit: (value: string) => void
  onCancel: () => void
  onClearCellDimensions: () => void
}

function renderMarkdownContent(value: string | null | undefined) {
  if (!value) return "-"
  return (
    <div className={`prose prose-sm max-w-none break-words dark:prose-invert ${RICH_TEXT_PROSE_LINK_STYLES}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
        {normalizeMarkdownForListParsing(value)}
      </ReactMarkdown>
    </div>
  )
}

function runInlineMarkdownCommand(command: string, textarea: HTMLTextAreaElement, value: string, setDraft: (v: string) => void) {
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
}

function handleInlineEditorKeyDown(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  draft: string,
  setDraft: (v: string) => void,
  setMarkdownMode: React.Dispatch<React.SetStateAction<boolean>>
) {
  const textarea = e.currentTarget

  if (e.ctrlKey && e.key.toLowerCase() === "b") {
    e.preventDefault()
    runInlineMarkdownCommand("bold", textarea, draft, setDraft)
    return
  }
  if (e.ctrlKey && e.key.toLowerCase() === "i") {
    e.preventDefault()
    runInlineMarkdownCommand("italic", textarea, draft, setDraft)
    return
  }
  if (e.ctrlKey && e.key.toLowerCase() === "u") {
    e.preventDefault()
    runInlineMarkdownCommand("underline", textarea, draft, setDraft)
    return
  }
  if (e.ctrlKey && e.altKey && ["1", "2", "3", "4"].includes(e.key)) {
    e.preventDefault()
    runInlineMarkdownCommand(`h${e.key}`, textarea, draft, setDraft)
    return
  }
  if (e.ctrlKey && e.key.toLowerCase() === "m") {
    e.preventDefault()
    setMarkdownMode((prev) => !prev)
    return
  }
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "l") {
    e.preventDefault()
    runInlineMarkdownCommand("align-left", textarea, draft, setDraft)
    return
  }
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "r") {
    e.preventDefault()
    runInlineMarkdownCommand("align-right", textarea, draft, setDraft)
    return
  }
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "e") {
    e.preventDefault()
    runInlineMarkdownCommand("align-center", textarea, draft, setDraft)
    return
  }
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "j") {
    e.preventDefault()
    runInlineMarkdownCommand("align-justify", textarea, draft, setDraft)
  }
}

export function InlineSourceCellEditor({
  column,
  initialValue,
  cellDimensions,
  autoResizeTextarea,
  richTextFontSize,
  markdownModeOnMount,
  onOpenFullscreen,
  onCommit,
  onCancel,
  onClearCellDimensions,
}: InlineSourceCellEditorProps) {
  const [draft, setDraft] = React.useState(initialValue)
  const [markdownMode, setMarkdownMode] = React.useState(markdownModeOnMount)

  React.useLayoutEffect(() => {
    setDraft(initialValue)
  }, [initialValue])

  const markdownWarning = React.useMemo(() => validateMarkdownBestEffort(draft), [draft])

  const tryTextareaBlurSave = (related: EventTarget | null, value: string) => {
    if (
      !related ||
      (!(related as HTMLElement).closest('button[title="Cancel"]') &&
        !(related as HTMLElement).closest('[data-rich-editor-control="true"]'))
    ) {
      onClearCellDimensions()
      onCommit(value)
    }
  }

  const richBlock =
    column === "bibtex" || column === "description" || column === "notes" || column === "links" ? (
      <div className="flex-1 space-y-2">
        {(column === "description" || column === "notes") && !markdownMode ? (
          <div
            className="border rounded-md px-3 py-2 min-h-[48px]"
            style={{ fontSize: `${richTextFontSize}px` }}
            onClick={() => setMarkdownMode(true)}
          >
            {renderMarkdownContent(draft)}
          </div>
        ) : (
          <AutoResizeTextarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => tryTextareaBlurSave(e.relatedTarget, e.currentTarget.value)}
            onKeyDown={(e) => {
              if (column === "description" || column === "notes") {
                handleInlineEditorKeyDown(e, draft, setDraft, setMarkdownMode)
              }
              if (e.key === "Enter" && !e.shiftKey && column !== "links") {
                e.preventDefault()
                onCommit(e.currentTarget.value)
              } else if (e.key === "Escape") {
                e.preventDefault()
                onClearCellDimensions()
                onCancel()
              }
            }}
            autoFocus
            autoResize={autoResizeTextarea}
            initialWidth={cellDimensions ? cellDimensions.width - 40 : undefined}
            initialHeight={cellDimensions?.height}
            className="flex-1"
            style={column === "description" || column === "notes" ? { fontSize: `${richTextFontSize}px` } : undefined}
          />
        )}
        {(column === "description" || column === "notes") && (
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              data-rich-editor-control="true"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setMarkdownMode((prev) => !prev)}
              title="Toggle Markdown Mode (Ctrl+M)"
            >
              <FileText className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              data-rich-editor-control="true"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onOpenFullscreen(draft, markdownMode)}
              title="Open editor mode"
            >
              <Expand className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        {(column === "description" || column === "notes") && markdownMode && markdownWarning ? (
          <div className="text-xs text-destructive">Markdown warning: {markdownWarning}</div>
        ) : null}
      </div>
    ) : (
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => {
          if (!e.relatedTarget || !(e.relatedTarget as HTMLElement).closest('button[title="Cancel"]')) {
            onCommit(e.currentTarget.value)
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            onCommit(e.currentTarget.value)
          } else if (e.key === "Escape") {
            onCancel()
          }
        }}
        autoFocus
        className="h-8"
      />
    )

  return (
    <div className="flex items-center gap-2">
      {richBlock}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive transition-colors"
        onMouseDown={(e) => {
          e.preventDefault()
        }}
        onClick={() => {
          onClearCellDimensions()
          onCancel()
        }}
        title="Cancel"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
