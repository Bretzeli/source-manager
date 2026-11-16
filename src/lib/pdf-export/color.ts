/**
 * Small OKLCH toolkit for deriving document colors from the app's theme tokens.
 * Works on plain numbers so it runs the same in the browser and in Node.
 */

export type Oklch = { l: number; c: number; h: number }
type Rgb = { r: number; g: number; b: number } // gamma-encoded sRGB, 0..1

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const toGamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)

function rgbToOklch({ r, g, b }: Rgb): Oklch {
  return linearRgbToOklch({ r: toLinear(r), g: toLinear(g), b: toLinear(b) })
}

function linearRgbToOklch({ r: lr, g: lg, b: lb }: Rgb): Oklch {
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const c = Math.hypot(A, B)
  const h = c < 1e-4 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360
  return { l: L, c, h }
}

function oklchToLinearRgb({ l, c, h }: Oklch): Rgb {
  const rad = (h * Math.PI) / 180
  const A = c * Math.cos(rad)
  const B = c * Math.sin(rad)
  const l_ = (l + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m_ = (l - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s_ = (l - 0.0894841775 * A - 1.291485548 * B) ** 3
  return {
    r: 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    g: -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    b: -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  }
}

const inGamut = ({ r, g, b }: Rgb) => [r, g, b].every((v) => v >= -1e-4 && v <= 1 + 1e-4)

/** Map into sRGB by reducing chroma (keeps lightness and hue, which is what the eye tracks). */
function toSrgb(color: Oklch): Rgb {
  const l = clamp(color.l, 0, 1)
  let linear = oklchToLinearRgb({ ...color, l })
  if (!inGamut(linear)) {
    let lo = 0
    let hi = color.c
    for (let i = 0; i < 24; i += 1) {
      const mid = (lo + hi) / 2
      if (inGamut(oklchToLinearRgb({ l, c: mid, h: color.h }))) lo = mid
      else hi = mid
    }
    linear = oklchToLinearRgb({ l, c: lo, h: color.h })
  }
  return {
    r: clamp(toGamma(clamp(linear.r, 0, 1)), 0, 1),
    g: clamp(toGamma(clamp(linear.g, 0, 1)), 0, 1),
    b: clamp(toGamma(clamp(linear.b, 0, 1)), 0, 1),
  }
}

export function toHex(color: Oklch): string {
  const { r, g, b } = toSrgb(color)
  return `#${[r, g, b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("")}`
}

/** Parse a hex string produced by `toHex` (or any #rgb / #rrggbb). */
export function fromHex(hex: string): Oklch | null {
  return parseCssColor(hex)
}

function parseNumber(token: string | undefined, percentScale: number): number | null {
  if (!token || token === "none") return 0
  const value = Number.parseFloat(token)
  if (!Number.isFinite(value)) return null
  return token.endsWith("%") ? (value / 100) * percentScale : value
}

/** CIE Lab (D50, as in CSS `lab()`) → linear sRGB, following CSS Color 4. */
function labToLinearRgb(L: number, a: number, b: number): Rgb {
  const epsilon = 216 / 24389
  const kappa = 24389 / 27
  const fy = (L + 16) / 116
  const fx = fy + a / 500
  const fz = fy - b / 200
  const xr = fx ** 3 > epsilon ? fx ** 3 : (116 * fx - 16) / kappa
  const yr = L > kappa * epsilon ? fy ** 3 : L / kappa
  const zr = fz ** 3 > epsilon ? fz ** 3 : (116 * fz - 16) / kappa
  const [x50, y50, z50] = [xr * 0.9642956764295677, yr, zr * 0.8251046025104602]
  // Bradford D50 → D65, then XYZ → linear sRGB.
  const x = 0.955473421488075 * x50 - 0.02309845494876471 * y50 + 0.06325924320057072 * z50
  const y = -0.0283697093338637 * x50 + 1.0099953980813041 * y50 + 0.021041441191917323 * z50
  const z = 0.012314014864481998 * x50 - 0.020507649298898964 * y50 + 1.330365926242124 * z50
  return {
    r: 3.2409699419045226 * x - 1.537383177570094 * y - 0.4986107602930034 * z,
    g: -0.9692436362808796 * x + 1.8759675015077202 * y + 0.04155505740717559 * z,
    b: 0.05563007969699366 * x - 0.20397695888897652 * y + 1.0569715142428786 * z,
  }
}

let canvasContext: CanvasRenderingContext2D | null | undefined

/** Browser fallback for any other CSS color syntax (named colors, hsl(), lab(), …). */
function parseWithCanvas(value: string): Oklch | null {
  if (typeof document === "undefined") return null
  if (canvasContext === undefined) {
    const canvas = document.createElement("canvas")
    canvas.width = 1
    canvas.height = 1
    canvasContext = canvas.getContext("2d", { willReadFrequently: true })
  }
  const ctx = canvasContext
  if (!ctx || typeof CSS === "undefined" || !CSS.supports("color", value)) return null
  ctx.clearRect(0, 0, 1, 1)
  ctx.fillStyle = value
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
  if (a === 0) return null
  return rgbToOklch({ r: r / 255, g: g / 255, b: b / 255 })
}

/** Parse a CSS color into OKLCH. Alpha is ignored: callers only need the hue and weight of a color. */
export function parseCssColor(raw: string | null | undefined): Oklch | null {
  const value = (raw ?? "").trim().toLowerCase()
  if (!value) return null

  const hex = value.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/)
  if (hex) {
    const digits = hex[1].length <= 4 ? [...hex[1]].map((d) => d + d).join("") : hex[1]
    return rgbToOklch({
      r: Number.parseInt(digits.slice(0, 2), 16) / 255,
      g: Number.parseInt(digits.slice(2, 4), 16) / 255,
      b: Number.parseInt(digits.slice(4, 6), 16) / 255,
    })
  }

  // Production CSS ships theme colors as hex and lab(); the source uses oklch().
  const fn = value.match(/^(oklch|lab|rgba?)\(\s*([^)]*)\)$/)
  if (fn) {
    const parts = fn[2].split(/[\s,/]+/).filter(Boolean)
    if (fn[1] === "lab") {
      const L = parseNumber(parts[0], 100)
      const a = parseNumber(parts[1], 125)
      const b = parseNumber(parts[2], 125)
      if (L !== null && a !== null && b !== null) return linearRgbToOklch(labToLinearRgb(L, a, b))
    } else if (fn[1] === "oklch") {
      const l = parseNumber(parts[0], 1)
      const c = parseNumber(parts[1], 0.4)
      const h = parseNumber(parts[2]?.replace("deg", ""), 360)
      if (l !== null && c !== null && h !== null) return { l, c, h }
    } else {
      const [r, g, b] = parts.slice(0, 3).map((p) => parseNumber(p, 255))
      if (r !== null && g !== null && b !== null && r !== undefined && g !== undefined && b !== undefined) {
        return rgbToOklch({ r: r / 255, g: g / 255, b: b / 255 })
      }
    }
  }

  return parseWithCanvas(value)
}

/** Interpolate in OKLab, `t` = share of `to`. */
export function mix(from: Oklch, to: Oklch, t: number): Oklch {
  const toLab = ({ l, c, h }: Oklch) => {
    const rad = (h * Math.PI) / 180
    return [l, c * Math.cos(rad), c * Math.sin(rad)]
  }
  const [l1, a1, b1] = toLab(from)
  const [l2, a2, b2] = toLab(to)
  const l = l1 + (l2 - l1) * t
  const A = a1 + (a2 - a1) * t
  const B = b1 + (b2 - b1) * t
  const c = Math.hypot(A, B)
  return { l, c, h: c < 1e-4 ? from.h : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 }
}

function relativeLuminance(color: Oklch): number {
  const { r, g, b } = toSrgb(color)
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

/** WCAG 2 contrast ratio. */
export function contrast(a: Oklch, b: Oklch): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/**
 * Move a color's lightness away from `background` until it reaches `ratio`.
 * Hue and chroma stay, so a color keeps its identity while staying legible.
 */
export function ensureContrast(color: Oklch, background: Oklch, ratio: number): Oklch {
  if (contrast(color, background) >= ratio) return color
  const darken = background.l > 0.5
  let current = color
  for (let i = 0; i < 60 && contrast(current, background) < ratio; i += 1) {
    const l = clamp(current.l + (darken ? -0.01 : 0.01), 0, 1)
    if (l === current.l) break
    current = { ...current, l }
  }
  return current
}

export const withLightness = (color: Oklch, l: number): Oklch => ({ ...color, l })
export const withChroma = (color: Oklch, c: number): Oklch => ({ ...color, c })
export { clamp }
