"use client"

import * as React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import { normalizeMarkdownForListParsing, RICH_TEXT_PROSE_LINK_STYLES } from "./rich-text-markdown-utils"

export const SourcesMarkdownPreview = React.memo(function SourcesMarkdownPreview({
  markdown,
  fontSizePx,
}: {
  markdown: string | null | undefined
  fontSizePx: string
}) {
  if (!markdown) return <span>-</span>
  return (
    <div className={`text-sm break-words prose prose-sm max-w-none dark:prose-invert ${RICH_TEXT_PROSE_LINK_STYLES}`} style={{ fontSize: `${fontSizePx}px` }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
        {normalizeMarkdownForListParsing(markdown)}
      </ReactMarkdown>
    </div>
  )
})
