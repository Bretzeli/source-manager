import { pdf } from "@react-pdf/renderer"
import type { Source } from "@/types/sources"
import type { PdfDocumentStrings, PdfExportConfig } from "./config"
import { SourcesDocument } from "./document"
import { preparePdfFonts } from "./fonts"
import { getPdfPalette } from "./palette"
import { sortSourcesForPdf } from "./sort"

export type SourcesPdfRequest = {
  /** Sources to include, before sorting (all sources, or the filtered ones). */
  sources: Source[]
  config: PdfExportConfig
  project: { title: string; description: string | null; url: string }
  strings: PdfDocumentStrings
  locale: string
}

/** Typeset the sources as a PDF. */
export async function renderSourcesPdf(request: SourcesPdfRequest): Promise<Blob> {
  await preparePdfFonts(`${window.location.origin}/pdf/fonts`)

  const document = (
    <SourcesDocument
      sources={sortSourcesForPdf(request.sources, request.config.sortBy, request.locale)}
      config={request.config}
      palette={getPdfPalette(request.config.themeId, request.config.mode)}
      project={request.project}
      strings={request.strings}
      locale={request.locale}
      generatedAt={new Date()}
    />
  )
  return pdf(document).toBlob()
}
