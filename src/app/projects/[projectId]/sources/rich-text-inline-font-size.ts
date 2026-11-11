/**
 * Inline font sizes for the WYSIWYG editor (`<span style="font-size:23px">`), applied by direct DOM edits:
 * `execCommand("fontSize")` only knows the legacy 1–7 scale.
 *
 * Every selected text node is first lifted out of any sized ancestor (those spans are split around it), then wrapped
 * in a single sized span. Sizes therefore never nest, and stale spans don't pile up across repeated changes.
 *
 * Line spacing needs no extra work: the editor and previews use unitless `line-height`, which each span scales by its
 * own font size, so a line grows to fit its largest text.
 */

const TEXT_NODE = 3
const ELEMENT_NODE = 1

/** Zero-width space: placeholder text for a collapsed caret, so the next typed text lands in the sized span. Stripped on save. */
export const RICH_TEXT_CARET_PLACEHOLDER = "​"

/** Inline formatting is never split across these. */
const BLOCK_TAGS = new Set([
  "P", "DIV", "LI", "UL", "OL", "TD", "TH", "TR", "THEAD", "TBODY", "TFOOT", "TABLE",
  "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "PRE",
])

export type RichTextPoint = { node: Node; offset: number }
export type RichTextSelectionBounds = { start: RichTextPoint; end: RichTextPoint }

/** A boundary that stays valid while text nodes are split: before / after a node, or at the end of an element. */
type StableBoundary = { before: Node } | { after: Node } | { endOf: Node }

function isText(node: Node): node is Text {
  return node.nodeType === TEXT_NODE
}

function isBlockBoundary(el: Element, root: Element) {
  return el === root || BLOCK_TAGS.has(el.nodeName)
}

function hasMeaningfulContent(el: Element) {
  return (el.textContent ?? "").length > 0 || Boolean(el.querySelector("br, img"))
}

/** Index path from `root` to `node`, or null when `node` is outside `root`. */
function pathFromRoot(root: Node, node: Node): number[] | null {
  const path: number[] = []
  let current: Node | null = node
  while (current && current !== root) {
    const parent: Node | null = current.parentNode
    if (!parent) return null
    path.unshift(Array.prototype.indexOf.call(parent.childNodes, current))
    current = parent
  }
  return current === root ? path : null
}

/** Document-order comparison of index paths; an ancestor (prefix) sorts before its descendants. */
function comparePaths(a: number[], b: number[]) {
  const shared = Math.min(a.length, b.length)
  for (let i = 0; i < shared; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i]
  }
  return a.length - b.length
}

function boundaryPath(root: Node, boundary: StableBoundary): number[] | null {
  if ("endOf" in boundary) {
    const path = pathFromRoot(root, boundary.endOf)
    return path && [...path, boundary.endOf.childNodes.length]
  }
  const node = "before" in boundary ? boundary.before : boundary.after
  const path = pathFromRoot(root, node)
  if (!path) return null
  if ("after" in boundary) path[path.length - 1] += 1
  return path
}

function elementPointToBoundary(container: Node, offset: number): StableBoundary {
  const child = container.childNodes[offset]
  return child ? { before: child } : { endOf: container }
}

/** Split text nodes at the selection edges, so the selection covers whole text nodes only. */
function toStableBoundaries(bounds: RichTextSelectionBounds): { start: StableBoundary; end: StableBoundary } {
  let start: StableBoundary
  let { node: endNode, offset: endOffset } = bounds.end

  const { node: startNode, offset: startOffset } = bounds.start
  if (isText(startNode)) {
    if (startOffset <= 0) start = { before: startNode }
    else if (startOffset >= startNode.length) start = { after: startNode }
    else {
      const rest = startNode.splitText(startOffset)
      start = { before: rest }
      if (endNode === startNode) {
        endNode = rest
        endOffset -= startOffset
      }
    }
  } else {
    start = elementPointToBoundary(startNode, startOffset)
  }

  let end: StableBoundary
  if (isText(endNode)) {
    if (endOffset <= 0) end = { before: endNode }
    else {
      if (endOffset < endNode.length) endNode.splitText(endOffset)
      end = { after: endNode }
    }
  } else {
    end = elementPointToBoundary(endNode, endOffset)
  }
  return { start, end }
}

function collectTextNodes(node: Node, out: Text[]) {
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (isText(child)) out.push(child)
    else if (child.nodeType === ELEMENT_NODE) collectTextNodes(child, out)
  }
}

/** Text nodes inside the selection, in document order (whitespace that only lays out markup is skipped). */
function splitSelectedTextNodes(root: Element, bounds: RichTextSelectionBounds): Text[] {
  const { start, end } = toStableBoundaries(bounds)
  const startPath = boundaryPath(root, start)
  const endPath = boundaryPath(root, end)
  if (!startPath || !endPath) return []

  const all: Text[] = []
  collectTextNodes(root, all)
  return all.filter((text) => {
    if (text.data.length === 0 || /^[ \t\r\n]*\n[ \t\r\n]*$/.test(text.data)) return false
    const path = pathFromRoot(root, text)
    return path !== null && comparePaths(startPath, path) <= 0 && comparePaths(path, endPath) < 0
  })
}

/** Move everything in `ancestor` before `node` into a shallow clone of `ancestor` placed right before it. */
function splitOffBefore(ancestor: Element, node: Node) {
  let carried: Node | null = null
  let current = node
  while (current !== ancestor) {
    const parent = current.parentNode as Element
    const clone = parent.cloneNode(false) as Element
    while (parent.firstChild && parent.firstChild !== current) clone.appendChild(parent.firstChild)
    if (carried) clone.appendChild(carried)
    carried = hasMeaningfulContent(clone) ? clone : null
    current = parent
  }
  if (carried) ancestor.parentNode?.insertBefore(carried, ancestor)
}

/** Move everything in `ancestor` after `node` into a shallow clone of `ancestor` placed right after it. */
function splitOffAfter(ancestor: Element, node: Node) {
  let carried: Node | null = null
  let current = node
  while (current !== ancestor) {
    const parent = current.parentNode as Element
    const clone = parent.cloneNode(false) as Element
    while (current.nextSibling) clone.appendChild(current.nextSibling)
    if (carried) clone.insertBefore(carried, clone.firstChild)
    carried = hasMeaningfulContent(clone) ? clone : null
    current = parent
  }
  if (carried) ancestor.parentNode?.insertBefore(carried, ancestor.nextSibling)
}

function hasOnlyEmptyStyle(el: Element) {
  if (el.attributes.length === 0) return true
  return el.attributes.length === 1 && el.hasAttribute("style") && !(el.getAttribute("style") ?? "").trim()
}

function unwrap(el: Element) {
  const parent = el.parentNode
  if (!parent) return
  while (el.firstChild) parent.insertBefore(el.firstChild, el)
  parent.removeChild(el)
}

/** Remove any font size that applies to `text` from inline ancestors, splitting them so their other text keeps it. */
function liftOutOfInlineFontSizes(root: Element, text: Text) {
  for (let el = text.parentElement; el && !isBlockBoundary(el, root); ) {
    const parent: HTMLElement | null = el.parentElement
    const sized = el as HTMLElement
    const isFont = el.nodeName === "FONT"
    if (sized.style?.fontSize || (isFont && el.hasAttribute("size"))) {
      splitOffBefore(el, text)
      splitOffAfter(el, text)
      sized.style.removeProperty("font-size")
      if (isFont) el.removeAttribute("size")
      if ((el.nodeName === "SPAN" || isFont) && hasOnlyEmptyStyle(el)) unwrap(el)
    }
    el = parent
  }
}

function wrapInFontSize(root: Element, text: Text, sizePx: number) {
  const parent = text.parentElement
  if (!parent) return
  const size = `${sizePx}px`
  // Reuse a span that holds nothing but this text (e.g. a color span) instead of nesting another one.
  if (parent !== root && parent.nodeName === "SPAN" && parent.childNodes.length === 1) {
    parent.style.setProperty("font-size", size)
    return
  }
  const span = (root.ownerDocument as Document).createElement("span")
  span.style.setProperty("font-size", size)
  parent.insertBefore(span, text)
  span.appendChild(text)
}

/** Unwrap attribute-less spans and merge adjacent spans with identical styles (keeps the saved markup short). */
function tidyInlineSpans(root: Element) {
  Array.from(root.querySelectorAll("span")).forEach((span) => {
    if (span !== root && hasOnlyEmptyStyle(span)) unwrap(span)
  })
  Array.from(root.querySelectorAll("span")).forEach((span) => {
    if (!root.contains(span)) return // merged into a previous span
    if (span.attributes.length !== 1 || !span.hasAttribute("style")) return
    let next = span.nextSibling
    while (
      next &&
      next.nodeType === ELEMENT_NODE &&
      next.nodeName === "SPAN" &&
      (next as Element).attributes.length === 1 &&
      (next as HTMLElement).style.cssText === span.style.cssText
    ) {
      while (next.firstChild) span.appendChild(next.firstChild)
      const merged = next
      next = next.nextSibling
      merged.parentNode?.removeChild(merged)
    }
  })
}

function insertAtPoint(point: RichTextPoint, node: Node) {
  const { node: container, offset } = point
  if (isText(container)) {
    const parent = container.parentNode
    if (!parent) return false
    if (offset <= 0) parent.insertBefore(node, container)
    else if (offset >= container.length) parent.insertBefore(node, container.nextSibling)
    else parent.insertBefore(node, container.splitText(offset))
    return true
  }
  container.insertBefore(node, container.childNodes[offset] ?? null)
  return true
}

/**
 * Set (`sizePx`) or clear (`null`, back to the surrounding default) the font size of the selected text in `root`.
 * A collapsed caret gets a sized placeholder span, so the next typed text uses the size.
 * Returns the selection to restore (covering the changed text), or null when nothing changed.
 */
export function applyInlineFontSize(
  root: HTMLElement,
  bounds: RichTextSelectionBounds,
  sizePx: number | null
): RichTextSelectionBounds | null {
  if (!pathFromRoot(root, bounds.start.node) || !pathFromRoot(root, bounds.end.node)) return null

  const collapsed = bounds.start.node === bounds.end.node && bounds.start.offset === bounds.end.offset
  let segments: Text[]
  if (collapsed) {
    const placeholder = (root.ownerDocument as Document).createTextNode(RICH_TEXT_CARET_PLACEHOLDER)
    if (!insertAtPoint(bounds.start, placeholder)) return null
    segments = [placeholder]
  } else {
    segments = splitSelectedTextNodes(root, bounds)
  }
  if (segments.length === 0) return null

  for (const text of segments) {
    liftOutOfInlineFontSizes(root, text)
    if (sizePx !== null) wrapInFontSize(root, text, sizePx)
  }
  tidyInlineSpans(root)

  const first = segments[0]
  const last = segments[segments.length - 1]
  return collapsed
    ? { start: { node: first, offset: first.length }, end: { node: first, offset: first.length } }
    : { start: { node: first, offset: 0 }, end: { node: last, offset: last.length } }
}
