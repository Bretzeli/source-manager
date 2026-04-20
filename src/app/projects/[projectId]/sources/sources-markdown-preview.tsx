"use client"

import * as React from "react"
import {
  markdownToSanitizedRichEditorHtml,
  RICH_TEXT_MARKDOWN_PREVIEW_LIST_STYLES,
  RICH_TEXT_MARKDOWN_PREVIEW_TABLE_STYLES,
  RICH_TEXT_PROSE_LINK_STYLES,
} from "./rich-text-markdown-utils"

export const SourcesMarkdownPreview = React.memo(function SourcesMarkdownPreview({
  markdown,
  fontSizePx,
}: {
  markdown: string | null | undefined
  fontSizePx: string
}) {
  if (!markdown) return <span>-</span>
  const html = markdownToSanitizedRichEditorHtml(markdown)
  if (!html.trim()) return <span>-</span>
  return (
    <div
      className={`min-w-0 text-sm break-words prose prose-sm max-w-none dark:prose-invert ${RICH_TEXT_PROSE_LINK_STYLES} ${RICH_TEXT_MARKDOWN_PREVIEW_LIST_STYLES} ${RICH_TEXT_MARKDOWN_PREVIEW_TABLE_STYLES}`}
      style={{ fontSize: `${fontSizePx}px` }}
      // Same `marked` pipeline as the fullscreen rich editor so lists (including nested HTML blocks) match.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
})
