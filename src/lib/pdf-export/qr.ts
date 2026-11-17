import qrcode from "qrcode-generator"

export type QrCode = {
  /** Modules per side. */
  size: number
  /** All dark modules as one SVG path in module units (one fill, so no seams between modules). */
  path: string
}

/** A QR code for `text` (error correction M), as vector data for both the PDF and the preview. */
export function createQrCode(text: string): QrCode {
  const qr = qrcode(0, "M")
  qr.addData(text)
  qr.make()
  const size = qr.getModuleCount()
  let path = ""
  for (let row = 0; row < size; row += 1) {
    let col = 0
    while (col < size) {
      if (!qr.isDark(row, col)) {
        col += 1
        continue
      }
      const start = col
      while (col < size && qr.isDark(row, col)) col += 1
      path += `M${start} ${row}h${col - start}v1h-${col - start}z`
    }
  }
  return { size, path }
}
