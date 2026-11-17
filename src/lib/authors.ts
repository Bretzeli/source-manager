/**
 * Helpers for the free-form authors field ("Doe, Jane; {World Health Organization}").
 *
 * Braces group text the way BibTeX does: "{Barnes and Noble}" is a single name, so separators
 * inside braces never split it, and a name wrapped in braces as a whole is an organization.
 * The braces stay in the stored field (so they survive editing and BibTeX export) and are
 * hidden wherever the field is shown to readers.
 */

/** Split text on a separator pattern, ignoring matches inside {braces}. */
export function splitOutsideBraces(text: string, separator: RegExp): string[] {
  const sticky = new RegExp(separator.source, separator.flags.replace(/[gy]/g, "") + "y")
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === "{") {
      depth++
    } else if (c === "}") {
      depth = Math.max(0, depth - 1)
    } else if (depth === 0) {
      sticky.lastIndex = i
      const match = sticky.exec(text)
      if (match && match[0].length > 0) {
        parts.push(text.slice(start, i))
        start = i + match[0].length
        i = start - 1
      }
    }
  }
  parts.push(text.slice(start))
  return parts
}

/** Whether the whole text is one brace group: "{Barnes and Noble}", but not "{A} and {B}". */
export function isBraceGroup(text: string): boolean {
  if (!text.startsWith("{") || !text.endsWith("}")) return false
  let depth = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") depth++
    else if (text[i] === "}" && --depth === 0 && i < text.length - 1) return false
  }
  return depth === 0
}

/** Remove grouping braces: "{Barnes and Noble}" → "Barnes and Noble". */
export function stripBraces(text: string): string {
  return text.replace(/[{}]/g, "")
}
