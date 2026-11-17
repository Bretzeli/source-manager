/**
 * Saving the finished PDF.
 *
 * Where the File System Access API exists (Chromium browsers), the user picks the location first
 * and we write the file ourselves, so we know exactly when it has been saved. Elsewhere the file is
 * handed to the browser as a download, whose completion a page cannot observe.
 */

type SavePickerOptions = {
  suggestedName?: string
  types?: Array<{ description?: string; accept: Record<string, string[]> }>
}
type WindowWithSavePicker = Window & {
  showSaveFilePicker?: (options?: SavePickerOptions) => Promise<FileSystemFileHandle>
}

export type SaveTarget =
  /** A file the user picked, already open for writing; saving to it can be confirmed. */
  | { kind: "file"; handle: FileSystemFileHandle; writable: FileSystemWritableFileStream }
  /** A regular browser download; it can't be confirmed. */
  | { kind: "download" }
  /** The user dismissed the save dialog. */
  | { kind: "cancelled" }

/** Set once the browser refused to write a picked file, so later exports skip the save dialog. */
const PICKER_UNUSABLE_KEY = "source-manager-pdf-save-picker-unusable"

function pickerUnusable(): boolean {
  try {
    return sessionStorage.getItem(PICKER_UNUSABLE_KEY) === "1"
  } catch {
    return false
  }
}

function markPickerUnusable() {
  try {
    sessionStorage.setItem(PICKER_UNUSABLE_KEY, "1")
  } catch {
    // Storage unavailable: we'll just try the picker again next time.
  }
}

/**
 * Ask where to save and open that file for writing.
 *
 * Call this before any other `await` in the click handler, and keep the returned stream open
 * while the document is typeset: Chrome only lets a page write to a picked file right after the
 * user chose it. Asking for the stream seconds later (after typesetting) is refused, leaving the
 * empty file the save dialog already created.
 */
export async function chooseSaveTarget(fileName: string): Promise<SaveTarget> {
  const showSaveFilePicker = (window as WindowWithSavePicker).showSaveFilePicker
  if (typeof showSaveFilePicker !== "function" || pickerUnusable()) return { kind: "download" }

  let handle: FileSystemFileHandle
  try {
    handle = await showSaveFilePicker.call(window, {
      suggestedName: fileName,
      types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }],
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return { kind: "cancelled" }
    // Not allowed here (e.g. inside a cross-origin frame): fall back to a download.
    return { kind: "download" }
  }

  try {
    const writable = await handle.createWritable()
    return { kind: "file", handle, writable }
  } catch (error) {
    console.warn("Writing to the chosen file was refused; downloading instead.", error)
    markPickerUnusable()
    // Best effort: don't leave the empty placeholder the save dialog created.
    await (handle as FileSystemFileHandle & { remove?: () => Promise<void> }).remove?.().catch(() => {})
    return { kind: "download" }
  }
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.style.display = "none"
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Give the browser a moment to start the download before releasing the blob.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Save the PDF. Resolves `true` once the file is known to be written, `false` if handed to the browser. */
export async function saveBlob(target: Exclude<SaveTarget, { kind: "cancelled" }>, blob: Blob, fileName: string): Promise<boolean> {
  if (target.kind === "file") {
    await target.writable.write(blob)
    await target.writable.close()
    return true
  }
  triggerDownload(blob, fileName)
  return false
}

/** Give up on a save target without writing (e.g. typesetting failed); leaves the file untouched. */
export async function discardSaveTarget(target: SaveTarget): Promise<void> {
  if (target.kind === "file") await target.writable.abort().catch(() => {})
}
