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
  fileName: string
}

/** Typeset the sources as a PDF. */
export async function renderSourcesPdf(request: Omit<SourcesPdfRequest, "fileName">): Promise<Blob> {
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

/** Typeset the sources as a PDF and hand it to the browser as a download. */
export async function downloadSourcesPdf(request: SourcesPdfRequest): Promise<void> {
  const blob = await renderSourcesPdf(request)
  const url = URL.createObjectURL(blob)
  const link = window.document.createElement("a")
  link.href = url
  link.download = request.fileName
  link.style.display = "none"
  window.document.body.appendChild(link)
  link.click()
  link.remove()
  // Give the browser a moment to start the download before releasing the blob.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
