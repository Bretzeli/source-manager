const ATX_HEADING_PREFIX = /^(#{1,6}\s+)/

/**
 * Strip ATX heading markers (`#` … ` `) from the start of each logical line touched by the selection.
 * Caret positions are preserved relative to visible text (cursor inside a stripped prefix moves to line start).
 */
export function stripAtxHeadingMarkdownInSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number
): { nextValue: string; caretStart: number; caretEnd: number } {
  const selStart = Math.min(selectionStart, selectionEnd)
  const selEnd = Math.max(selectionStart, selectionEnd)

  const a = value.lastIndexOf("\n", selStart - 1) + 1

  let lastIdx = Math.max(selStart, selEnd > 0 ? selEnd - 1 : 0)
  if (lastIdx < value.length && value[lastIdx] === "\n" && lastIdx > 0) {
    lastIdx -= 1
  }

  const nlAfterLast = value.indexOf("\n", lastIdx)
  const b = nlAfterLast === -1 ? value.length : nlAfterLast

  const segment = value.slice(a, b)
  const lines = segment.split("\n")
  const newLines = lines.map((line) => line.replace(ATX_HEADING_PREFIX, ""))
  const newSegment = newLines.join("\n")
  const delta = segment.length - newSegment.length

  const mapCaret = (oldCaret: number): number => {
    if (oldCaret < a) return oldCaret
    if (oldCaret >= b) return oldCaret - delta

    const rel = oldCaret - a
    let srcPos = 0
    let dstPos = 0
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const m = line.match(ATX_HEADING_PREFIX)
      const headLen = m ? m[1].length : 0
      const stripped = newLines[i]
      const nlBetween = i < lines.length - 1 ? 1 : 0
      const oldLineLen = line.length
      if (rel <= srcPos + oldLineLen) {
        const local = rel - srcPos
        const newLocal = local < headLen ? 0 : local - headLen
        return a + dstPos + newLocal
      }
      srcPos += oldLineLen + nlBetween
      dstPos += stripped.length + nlBetween
    }
    return oldCaret - delta
  }

  const nextValue = value.slice(0, a) + newSegment + value.slice(b)
  return {
    nextValue,
    caretStart: mapCaret(selectionStart),
    caretEnd: mapCaret(selectionEnd),
  }
}

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
