/** Primary-colored links — aligned with `render-links` and shadcn primary token. */
export const RICH_TEXT_PROSE_LINK_STYLES =
  "[&_a]:cursor-pointer [&_a]:text-primary [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-primary/45 [&_a]:transition-colors hover:[&_a]:decoration-primary hover:[&_a]:text-primary/90 [&_a]:break-all"

export function normalizeMarkdownForListParsing(markdown: string) {
  return markdown.replace(/([^\n])\n((?:\s*)(?:[-*+]|\d+\.)\s+)/g, "$1\n\n$2")
}
