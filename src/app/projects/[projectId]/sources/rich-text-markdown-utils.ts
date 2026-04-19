/** Primary-colored links — aligned with `render-links` and shadcn primary token. */
export const RICH_TEXT_PROSE_LINK_STYLES =
  "[&_a]:cursor-pointer [&_a]:text-primary [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-primary/45 [&_a]:transition-colors hover:[&_a]:decoration-primary hover:[&_a]:text-primary/90 [&_a]:break-all"

export function normalizeMarkdownForListParsing(markdown: string) {
  return markdown.replace(/([^\n])\n((?:\s*)(?:[-*+]|\d+\.)\s+)/g, "$1\n\n$2")
}

function expandTripleNewlines(text: string): string {
  let s = text
  while (s.includes("\n\n\n")) {
    s = s.replace(/\n\n\n/g, "\n\n\u00a0\n\n")
  }
  return s
}

/**
 * CommonMark/Marked collapse extra blank lines between blocks. Turn each extra `\n` in a
 * `\n\n\n+` run into an explicit spacer paragraph (NBSP) so vertical gaps survive Markdown → HTML.
 * Skips fenced ``` code blocks.
 */
export function preserveMarkdownBlankLinesForParse(markdown: string): string {
  let out = ""
  let i = 0
  while (i < markdown.length) {
    const fence = markdown.indexOf("```", i)
    if (fence === -1) {
      out += expandTripleNewlines(markdown.slice(i))
      break
    }
    out += expandTripleNewlines(markdown.slice(i, fence))
    const end = markdown.indexOf("```", fence + 3)
    if (end === -1) {
      out += markdown.slice(fence)
      break
    }
    out += markdown.slice(fence, end + 3)
    i = end + 3
  }
  return out
}

/** List normalization + blank-line preservation for any Markdown → HTML / ReactMarkdown path. */
export function prepareRichTextMarkdownForRender(markdown: string): string {
  return preserveMarkdownBlankLinesForParse(normalizeMarkdownForListParsing(markdown))
}
