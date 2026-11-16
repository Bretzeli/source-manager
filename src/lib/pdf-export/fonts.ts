import { Font } from "@react-pdf/renderer"

/**
 * Typefaces (all SIL Open Font License, files and licenses in /public/pdf/fonts):
 *  - Source Serif 4: reading text (SmText optical size) and the title (Display optical size)
 *  - Inter: labels, metadata, links
 *  - JetBrains Mono: keys and BibTeX
 *
 * Stacks fall back per character, so a glyph missing from one face is taken from the next.
 */
export const FONT = {
  serif: ["Serif", "Sans", "Mono"],
  display: ["SerifDisplay", "Serif", "Sans", "Mono"],
  sans: ["Sans", "Serif", "Mono"],
  mono: ["Mono", "Sans", "Serif"],
} as const

type Face = { file: string; fontWeight: 400 | 500 | 600 | 700; fontStyle?: "italic" }

// Faces without a dedicated italic map italic to the upright file: react-pdf throws on a
// style it can't resolve, and Markdown can put any span in italics.
const FAMILIES: Record<string, Face[]> = {
  Serif: [
    { file: "SourceSerif4SmText-Regular.ttf", fontWeight: 400 },
    { file: "SourceSerif4SmText-It.ttf", fontWeight: 400, fontStyle: "italic" },
    { file: "SourceSerif4SmText-Semibold.ttf", fontWeight: 600 },
    { file: "SourceSerif4SmText-SemiboldIt.ttf", fontWeight: 600, fontStyle: "italic" },
  ],
  SerifDisplay: [
    { file: "SourceSerif4Display-Regular.ttf", fontWeight: 400 },
    { file: "SourceSerif4Display-Semibold.ttf", fontWeight: 600 },
    { file: "SourceSerif4Display-Regular.ttf", fontWeight: 400, fontStyle: "italic" },
    { file: "SourceSerif4Display-Semibold.ttf", fontWeight: 600, fontStyle: "italic" },
  ],
  Sans: [
    { file: "Inter-Regular.ttf", fontWeight: 400 },
    { file: "Inter-Medium.ttf", fontWeight: 500 },
    { file: "Inter-SemiBold.ttf", fontWeight: 600 },
    { file: "Inter-Regular.ttf", fontWeight: 400, fontStyle: "italic" },
    { file: "Inter-Medium.ttf", fontWeight: 500, fontStyle: "italic" },
    { file: "Inter-SemiBold.ttf", fontWeight: 600, fontStyle: "italic" },
  ],
  Mono: [
    { file: "JetBrainsMono-Regular.ttf", fontWeight: 400 },
    { file: "JetBrainsMono-Medium.ttf", fontWeight: 500 },
    { file: "JetBrainsMono-Regular.ttf", fontWeight: 400, fontStyle: "italic" },
    { file: "JetBrainsMono-Medium.ttf", fontWeight: 500, fontStyle: "italic" },
  ],
}

/**
 * Words are not hyphenated: the text is ragged-right and may be in any language, and English
 * patterns would mangle German compounds. Only absurdly long words get the built-in fallback.
 * Long URLs and identifiers get silent break points in `breakable()` instead.
 */
function hyphenationCallback(word: string, builtin?: (word: string) => string[]): string[] {
  if (word.length > 36 && builtin && /^\p{L}+$/u.test(word)) return builtin(word)
  return [word]
}

/**
 * Register and load the document fonts. `baseUrl` points at /pdf/fonts (a URL in the browser).
 *
 * Run before every render, for two react-pdf quirks:
 *  - Loaded fonts keep state from the previous document's subsetting, which garbles text in the
 *    next one. Clearing the store gives each document fresh instances (files come from the cache).
 *  - Layout only preloads the faces named directly in a node's style, so a face reached through
 *    inheritance (an italic span inside a Sans label) may not be loaded. Every face is loaded here.
 */
export async function preparePdfFonts(baseUrl: string): Promise<void> {
  Font.clear()
  const base = baseUrl.replace(/\/$/, "")

  // react-pdf appends "Helvetica" to every font stack as the last resort and resolves it even when
  // every text names its own family. The built-in Helvetica only has Latin-1, so a character no
  // face covers would be drawn as a wrong letter; aliasing it to Inter shows a plain box instead.
  Font.register({
    family: "Helvetica",
    fonts: [
      { src: `${base}/Inter-Regular.ttf`, fontWeight: 400 },
      { src: `${base}/Inter-SemiBold.ttf`, fontWeight: 700 },
      { src: `${base}/Inter-Regular.ttf`, fontWeight: 400, fontStyle: "italic" },
      { src: `${base}/Inter-SemiBold.ttf`, fontWeight: 700, fontStyle: "italic" },
    ],
  })
  for (const [family, faces] of Object.entries(FAMILIES)) {
    Font.register({
      family,
      fonts: faces.map(({ file, ...face }) => ({ src: `${base}/${file}`, ...face })),
    })
  }

  Font.registerHyphenationCallback(hyphenationCallback)
  // Emoji are drawn as images; if one can't be fetched, react-pdf falls back to the font glyph.
  Font.registerEmojiSource({ format: "png", url: "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/" })

  // The last-resort family is used in whatever weight and style the text has (e.g. for the
  // placeholder character of an emoji image), so all of its faces are loaded too.
  const helvetica = [400, 700].flatMap((fontWeight) =>
    (["normal", "italic"] as const).map((fontStyle) => Font.load({ fontFamily: "Helvetica", fontWeight, fontStyle })),
  )
  await Promise.all([
    ...helvetica,
    ...Object.entries(FAMILIES).flatMap(([fontFamily, faces]) =>
      faces.map(({ fontWeight, fontStyle }) => Font.load({ fontFamily, fontWeight, fontStyle: fontStyle ?? "normal" })),
    ),
  ])
}
