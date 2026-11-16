import type { ReactNode } from "react"
import { Text } from "@react-pdf/renderer"

/**
 * Line-break opportunities inside long tokens (URLs, DOIs, identifiers).
 *
 * react-pdf only breaks at spaces, and every break inside a word gets a hyphen, which is wrong
 * for a URL. So after separators we insert a real space set at a vanishing size: the line breaker
 * sees an ordinary break opportunity, the reader sees nothing, and link targets stay exact.
 */

const MIN_TOKEN_LENGTH = 18
const CHUNK = 16
const BREAK_AFTER = /(?<=[/\\?&=#_.:@~+|,;-])/
const HIDDEN_SPACE_STYLE = { fontSize: 0.1, letterSpacing: 0 }

const isTokenLike = (word: string) => /[/\\._:@?=&#~+|-]/.test(word) || /\d/.test(word) || word.length > 34

function splitToken(word: string): string[] {
  return word
    .split(BREAK_AFTER)
    .flatMap((piece) => {
      if (piece.length <= CHUNK) return [piece]
      const chunks: string[] = []
      for (let i = 0; i < piece.length; i += CHUNK) chunks.push(piece.slice(i, i + CHUNK))
      return chunks
    })
    .filter(Boolean)
}

// Symbols outside the bundled faces, mapped to drawn equivalents that are covered.
const GLYPH_SUBSTITUTES: Record<string, string> = { "✔": "✓", "✘": "✗", "✕": "✗", "☒": "☑", "✦": "◆", "✱": "*", "☛": "→", "☞": "→" }
const SUBSTITUTE_PATTERN = new RegExp(`[${Object.keys(GLYPH_SUBSTITUTES).join("")}]`, "gu")

/** `text` as children for a react-pdf <Text>, with silent break points inside long tokens. */
export function breakable(raw: string): ReactNode[] {
  const text = raw.replace(SUBSTITUTE_PATTERN, (char) => GLYPH_SUBSTITUTES[char] ?? char)
  if (text.length < MIN_TOKEN_LENGTH) return [text]
  const out: ReactNode[] = []
  let buffer = ""
  for (const part of text.split(/(\s+)/)) {
    if (part.length < MIN_TOKEN_LENGTH || !isTokenLike(part)) {
      buffer += part
      continue
    }
    const pieces = splitToken(part)
    pieces.forEach((piece, index) => {
      buffer += piece
      if (index < pieces.length - 1) {
        out.push(buffer)
        buffer = ""
        out.push(
          <Text key={`b${out.length}`} style={HIDDEN_SPACE_STYLE}>
            {" "}
          </Text>,
        )
      }
    })
  }
  if (buffer) out.push(buffer)
  return out
}

/** Keep indentation in preformatted text: react-pdf drops spaces at the start of a line. */
export function preserveIndentation(text: string): string {
  return text
    .replace(/\t/g, "  ")
    .split("\n")
    .map((line) => line.replace(/^ +/, (spaces) => " ".repeat(spaces.length)))
    .join("\n")
}
