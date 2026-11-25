// Biblioteca mínima de processamento de imagens, escrita do zero para as aulas.
// Tudo roda no navegador, sem dependências. Os nomes seguem Gonzalez & Woods.

export type RGB = { w: number; h: number; data: Float32Array } // 3 canais, 0..255, intercalados
export type Gray = { w: number; h: number; data: Float32Array } // 1 canal
export type Mask = { w: number; h: number; data: Uint8Array } // 0 ou 1

export const clamp = (v: number, a = 0, b = 255) => (v < a ? a : v > b ? b : v)

export function newRGB(w: number, h: number): RGB {
  return { w, h, data: new Float32Array(w * h * 3) }
}
export function newGray(w: number, h: number): Gray {
  return { w, h, data: new Float32Array(w * h) }
}

/* ---------- aleatoriedade reproduzível e ruído suave ---------- */

export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash2(x: number, y: number, s: number) {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** ruído de valor suave (0..1) com algumas oitavas */
export function smoothNoise(x: number, y: number, seed: number, octaves = 3) {
  let amp = 1, freq = 1, sum = 0, norm = 0
  for (let o = 0; o < octaves; o++) {
    const xf = x * freq, yf = y * freq
    const x0 = Math.floor(xf), y0 = Math.floor(yf)
    const tx = xf - x0, ty = yf - y0
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty)
    const s = seed + o * 17
    const a = hash2(x0, y0, s), b = hash2(x0 + 1, y0, s)
    const c = hash2(x0, y0 + 1, s), d = hash2(x0 + 1, y0 + 1, s)
    sum += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy)
    norm += amp
    amp *= 0.5
    freq *= 2
  }
  return sum / norm
}

/* ---------- conversões para desenhar ---------- */

export function toImageData(img: RGB | Gray, lut?: (v: number) => [number, number, number]): ImageData {
  const { w, h, data } = img
  const out = new ImageData(w, h)
  const o = out.data
  const isRGB = data.length === w * h * 3
  for (let i = 0; i < w * h; i++) {
    if (isRGB) {
      o[i * 4] = data[i * 3]
      o[i * 4 + 1] = data[i * 3 + 1]
      o[i * 4 + 2] = data[i * 3 + 2]
    } else if (lut) {
      const [r, g, b] = lut(data[i])
      o[i * 4] = r
      o[i * 4 + 1] = g
      o[i * 4 + 2] = b
    } else {
      const v = data[i]
      o[i * 4] = o[i * 4 + 1] = o[i * 4 + 2] = v
    }
    o[i * 4 + 3] = 255
  }
  return out
}

export function maskToGray(m: Mask): Gray {
  const g = newGray(m.w, m.h)
  for (let i = 0; i < m.data.length; i++) g.data[i] = m.data[i] ? 255 : 0
  return g
}

export function fromImageData(id: ImageData): RGB {
  const img = newRGB(id.width, id.height)
  for (let i = 0; i < id.width * id.height; i++) {
    img.data[i * 3] = id.data[i * 4]
    img.data[i * 3 + 1] = id.data[i * 4 + 1]
    img.data[i * 3 + 2] = id.data[i * 4 + 2]
  }
  return img
}

/** carrega um arquivo de imagem do usuário, reduzido para caber em maxW x maxH */
export function loadFile(file: File, maxW = 360, maxH = 260): Promise<RGB> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file)
    const im = new Image()
    im.onload = () => {
      const s = Math.min(maxW / im.width, maxH / im.height, 1)
      const w = Math.max(8, Math.round(im.width * s)), h = Math.max(8, Math.round(im.height * s))
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')!
      ctx.drawImage(im, 0, 0, w, h)
      URL.revokeObjectURL(url)
      res(fromImageData(ctx.getImageData(0, 0, w, h)))
    }
    im.onerror = () => rej(new Error('Não consegui abrir essa imagem. Tente um JPG ou PNG.'))
    im.src = url
  })
}

/* ---------- canais e espaços de cor ---------- */

export function toGray(img: RGB): Gray {
  const g = newGray(img.w, img.h)
  const d = img.data
  for (let i = 0; i < g.data.length; i++) g.data[i] = 0.299 * d[i * 3] + 0.587 * d[i * 3 + 1] + 0.114 * d[i * 3 + 2]
  return g
}

export function channel(img: RGB, c: 0 | 1 | 2): Gray {
  const g = newGray(img.w, img.h)
  for (let i = 0; i < g.data.length; i++) g.data[i] = img.data[i * 3 + c]
  return g
}

export function onlyChannel(img: RGB, c: 0 | 1 | 2): RGB {
  const o = newRGB(img.w, img.h)
  for (let i = 0; i < img.w * img.h; i++) o.data[i * 3 + c] = img.data[i * 3 + c]
  return o
}

/** RGB (0..255) -> HSV com H em graus (0..360), S e V em 0..1 */
export function rgb2hsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
  let h = 0
  if (d > 1e-6) {
    if (mx === r) h = 60 * (((g - b) / d) % 6)
    else if (mx === g) h = 60 * ((b - r) / d + 2)
    else h = 60 * ((r - g) / d + 4)
  }
  if (h < 0) h += 360
  return [h, mx === 0 ? 0 : d / mx, mx]
}

export function hsv2rgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c
  let r = 0, g = 0, b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]
}

/** RGB (sRGB, D65) -> CIE L*a*b* */
export function rgb2lab(r: number, g: number, b: number): [number, number, number] {
  const lin = (u: number) => {
    u /= 255
    return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4)
  }
  const R = lin(r), G = lin(g), B = lin(b)
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)
  const fx = f(X), fy = f(Y), fz = f(Z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

export type ColorPlane = 'R' | 'G' | 'B' | 'Cinza' | 'H' | 'S' | 'V' | 'L*' | 'a*' | 'b*'

/** extrai um plano de cor já escalado para 0..255 (para exibir) */
export function plane(img: RGB, p: ColorPlane): Gray {
  if (p === 'R') return channel(img, 0)
  if (p === 'G') return channel(img, 1)
  if (p === 'B') return channel(img, 2)
  if (p === 'Cinza') return toGray(img)
  const g = newGray(img.w, img.h)
  const d = img.data
  for (let i = 0; i < g.data.length; i++) {
    const r = d[i * 3], gg = d[i * 3 + 1], b = d[i * 3 + 2]
    if (p === 'H' || p === 'S' || p === 'V') {
      const [h, s, v] = rgb2hsv(r, gg, b)
      g.data[i] = p === 'H' ? (h / 360) * 255 : p === 'S' ? s * 255 : v * 255
    } else {
      const [L, A, B] = rgb2lab(r, gg, b)
      g.data[i] = p === 'L*' ? L * 2.55 : clamp(128 + (p === 'a*' ? A : B) * 1.6)
    }
  }
  return g
}

/* ---------- histogramas e limiarização ---------- */

export function histogram(g: Gray, bins = 256, lo = 0, hi = 255): number[] {
  const h = new Array(bins).fill(0)
  const span = hi - lo || 1
  for (const v of g.data) {
    const b = Math.floor(((v - lo) / span) * (bins - 1) + 0.5)
    if (b >= 0 && b < bins) h[b]++
  }
  return h
}

/** Otsu (1979): escolhe o limiar que maximiza a variância entre classes */
export function otsu(hist: number[]): number {
  const total = hist.reduce((a, b) => a + b, 0)
  let sumAll = 0
  for (let i = 0; i < hist.length; i++) sumAll += i * hist[i]
  let wB = 0, sumB = 0, best = 0, bestT = 0
  for (let t = 0; t < hist.length; t++) {
    wB += hist[t]
    if (!wB) continue
    const wF = total - wB
    if (!wF) break
    sumB += t * hist[t]
    const mB = sumB / wB, mF = (sumAll - sumB) / wF
    const between = wB * wF * (mB - mF) ** 2
    if (between > best) {
      best = between
      bestT = t
    }
  }
  return bestT
}

export function threshold(g: Gray, t: number, above = true): Mask {
  const m: Mask = { w: g.w, h: g.h, data: new Uint8Array(g.w * g.h) }
  for (let i = 0; i < g.data.length; i++) m.data[i] = (above ? g.data[i] > t : g.data[i] <= t) ? 1 : 0
  return m
}

/** reescala linearmente qualquer imagem para 0..255 (para enxergar índices) */
export function normalize(g: Gray, lo?: number, hi?: number): Gray {
  let a = lo ?? Infinity, b = hi ?? -Infinity
  if (lo === undefined || hi === undefined)
    for (const v of g.data) {
      if (lo === undefined && v < a) a = v
      if (hi === undefined && v > b) b = v
    }
  const o = newGray(g.w, g.h)
  const s = b - a || 1
  for (let i = 0; i < g.data.length; i++) o.data[i] = clamp(((g.data[i] - a) / s) * 255)
  return o
}

/* ---------- índices de vegetação em RGB ---------- */

export type RgbIndex = 'ExG' | 'ExGR' | 'VARI' | 'GLI'

/** retorna o índice cru (sem reescala) */
export function rgbIndex(img: RGB, idx: RgbIndex): Gray {
  const g = newGray(img.w, img.h)
  const d = img.data
  for (let i = 0; i < g.data.length; i++) {
    const R = d[i * 3], G = d[i * 3 + 1], B = d[i * 3 + 2]
    const s = R + G + B || 1
    const r = R / s, gg = G / s, b = B / s
    let v = 0
    if (idx === 'ExG') v = 2 * gg - r - b
    else if (idx === 'ExGR') v = 2 * gg - r - b - (1.4 * r - gg)
    else if (idx === 'VARI') v = clamp((G - R) / (G + R - B || 1), -1, 1)
    else v = (2 * G - R - B) / (2 * G + R + B || 1)
    g.data[i] = v
  }
  return g
}

export const INDEX_RANGE: Record<RgbIndex, [number, number]> = {
  ExG: [-0.3, 0.8],
  ExGR: [-1.0, 0.6],
  VARI: [-0.6, 0.6],
  GLI: [-0.3, 0.5],
}

/* ---------- amostragem e quantização ---------- */

export function quantize(img: RGB, bits: number): RGB {
  const levels = 2 ** bits
  const step = 256 / levels
  const o = newRGB(img.w, img.h)
  for (let i = 0; i < img.data.length; i++) {
    const q = Math.min(levels - 1, Math.floor(img.data[i] / step))
    o.data[i] = levels === 1 ? 0 : (q / (levels - 1)) * 255
  }
  return o
}

/** reduz a resolução por média em blocos e amplia de volta por vizinho mais próximo */
export function pixelate(img: RGB, block: number): RGB {
  const o = newRGB(img.w, img.h)
  if (block <= 1) {
    o.data.set(img.data)
    return o
  }
  for (let by = 0; by < img.h; by += block)
    for (let bx = 0; bx < img.w; bx += block) {
      const acc = [0, 0, 0]
      let n = 0
      for (let y = by; y < Math.min(by + block, img.h); y++)
        for (let x = bx; x < Math.min(bx + block, img.w); x++) {
          const k = (y * img.w + x) * 3
          acc[0] += img.data[k]
          acc[1] += img.data[k + 1]
          acc[2] += img.data[k + 2]
          n++
        }
      for (let y = by; y < Math.min(by + block, img.h); y++)
        for (let x = bx; x < Math.min(bx + block, img.w); x++) {
          const k = (y * img.w + x) * 3
          o.data[k] = acc[0] / n
          o.data[k + 1] = acc[1] / n
          o.data[k + 2] = acc[2] / n
        }
    }
  return o
}

/* ---------- transformações de intensidade (G&W cap. 3) ---------- */

export type PointOp = 'identidade' | 'negativo' | 'log' | 'gamma' | 'alargamento' | 'equalização'

export function pointLUT(op: PointOp, g: Gray, gamma = 1, lo = 50, hi = 200): number[] {
  const lut = new Array(256).fill(0)
  if (op === 'equalização') {
    const h = histogram(g)
    const n = g.data.length
    let c = 0
    for (let i = 0; i < 256; i++) {
      c += h[i]
      lut[i] = Math.round((255 * c) / n)
    }
    return lut
  }
  const cLog = 255 / Math.log(256)
  for (let r = 0; r < 256; r++) {
    let s = r
    if (op === 'negativo') s = 255 - r
    else if (op === 'log') s = cLog * Math.log(1 + r)
    else if (op === 'gamma') s = 255 * Math.pow(r / 255, gamma)
    else if (op === 'alargamento') s = ((r - lo) / Math.max(1, hi - lo)) * 255
    lut[r] = clamp(s)
  }
  return lut
}

export function applyLUT(g: Gray, lut: number[]): Gray {
  const o = newGray(g.w, g.h)
  for (let i = 0; i < g.data.length; i++) o.data[i] = lut[clamp(Math.round(g.data[i]))]
  return o
}

/* ---------- filtragem espacial ---------- */

export function convolve(g: Gray, k: number[][]): Gray {
  const kh = k.length, kw = k[0].length, oy = kh >> 1, ox = kw >> 1
  const o = newGray(g.w, g.h)
  const { w, h, data } = g
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0
      for (let j = 0; j < kh; j++) {
        const yy = Math.min(h - 1, Math.max(0, y + j - oy))
        for (let i = 0; i < kw; i++) {
          const xx = Math.min(w - 1, Math.max(0, x + i - ox))
          s += k[j][i] * data[yy * w + xx]
        }
      }
      o.data[y * w + x] = s
    }
  return o
}

export function median(g: Gray, r = 1): Gray {
  const o = newGray(g.w, g.h)
  const { w, h, data } = g
  const buf: number[] = []
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      buf.length = 0
      for (let j = -r; j <= r; j++)
        for (let i = -r; i <= r; i++) {
          const yy = Math.min(h - 1, Math.max(0, y + j)), xx = Math.min(w - 1, Math.max(0, x + i))
          buf.push(data[yy * w + xx])
        }
      buf.sort((a, b) => a - b)
      o.data[y * w + x] = buf[buf.length >> 1]
    }
  return o
}

export function addNoise(g: Gray, kind: 'nenhum' | 'sal e pimenta' | 'gaussiano', amount: number, seed = 7): Gray {
  const o = newGray(g.w, g.h)
  o.data.set(g.data)
  if (kind === 'nenhum') return o
  const R = rng(seed)
  for (let i = 0; i < o.data.length; i++) {
    if (kind === 'sal e pimenta') {
      const u = R()
      if (u < amount / 2) o.data[i] = 0
      else if (u < amount) o.data[i] = 255
    } else {
      const n = Math.sqrt(-2 * Math.log(R() + 1e-9)) * Math.cos(2 * Math.PI * R())
      o.data[i] = clamp(o.data[i] + n * amount * 120)
    }
  }
  return o
}

export const KERNELS: Record<string, { k: number[][]; nota: string }> = {
  'Média 3×3': { k: [[1, 1, 1], [1, 1, 1], [1, 1, 1]].map((r) => r.map((v) => v / 9)), nota: 'Suaviza: cada pixel vira a média dos 9 vizinhos. Tira ruído, mas borra as bordas das folhas.' },
  'Gaussiano 3×3': { k: [[1, 2, 1], [2, 4, 2], [1, 2, 1]].map((r) => r.map((v) => v / 16)), nota: 'Também suaviza, mas dá mais peso ao centro. Borra menos que a média.' },
  'Sobel x': { k: [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], nota: 'Derivada na horizontal: acende onde a intensidade muda da esquerda para a direita (bordas verticais, como as linhas de plantio).' },
  'Sobel y': { k: [[-1, -2, -1], [0, 0, 0], [1, 2, 1]], nota: 'Derivada na vertical: acende em bordas horizontais.' },
  Laplaciano: { k: [[0, 1, 0], [1, -4, 1], [0, 1, 0]], nota: 'Segunda derivada: responde a qualquer borda, em qualquer direção. Muito sensível a ruído.' },
  Realce: { k: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]], nota: 'Imagem original menos o Laplaciano: deixa bordas e nervuras mais nítidas.' },
  Identidade: { k: [[0, 0, 0], [0, 1, 0], [0, 0, 0]], nota: 'Não faz nada. Bom ponto de partida para você inventar o seu kernel.' },
}

export function sobelMag(g: Gray): Gray {
  const gx = convolve(g, KERNELS['Sobel x'].k), gy = convolve(g, KERNELS['Sobel y'].k)
  const o = newGray(g.w, g.h)
  for (let i = 0; i < o.data.length; i++) o.data[i] = Math.hypot(gx.data[i], gy.data[i])
  return o
}

/* ---------- morfologia matemática (G&W cap. 9) ---------- */

export type SE = 'quadrado' | 'disco' | 'cruz'

function seOffsets(shape: SE, r: number): [number, number][] {
  const o: [number, number][] = []
  for (let j = -r; j <= r; j++)
    for (let i = -r; i <= r; i++) {
      if (shape === 'disco' && i * i + j * j > r * r + 0.5) continue
      if (shape === 'cruz' && i !== 0 && j !== 0) continue
      o.push([i, j])
    }
  return o
}

function morph(m: Mask, shape: SE, r: number, erode: boolean): Mask {
  const off = seOffsets(shape, r)
  const { w, h } = m
  const o: Mask = { w, h, data: new Uint8Array(w * h) }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = erode ? 1 : 0
      for (const [i, j] of off) {
        const xx = x + i, yy = y + j
        const inside = xx >= 0 && yy >= 0 && xx < w && yy < h
        const p = inside ? m.data[yy * w + xx] : 0
        if (erode && !p) {
          v = 0
          break
        }
        if (!erode && p) {
          v = 1
          break
        }
      }
      o.data[y * w + x] = v
    }
  return o
}

export const erode = (m: Mask, s: SE, r: number) => morph(m, s, r, true)
export const dilate = (m: Mask, s: SE, r: number) => morph(m, s, r, false)
export const opening = (m: Mask, s: SE, r: number) => dilate(erode(m, s, r), s, r)
export const closing = (m: Mask, s: SE, r: number) => erode(dilate(m, s, r), s, r)

export function fillHoles(m: Mask): Mask {
  // preenche o fundo a partir das bordas; o que sobrar de fundo é buraco
  const { w, h } = m
  const seen = new Uint8Array(w * h)
  const st: number[] = []
  for (let x = 0; x < w; x++) st.push(x, (h - 1) * w + x)
  for (let y = 0; y < h; y++) st.push(y * w, y * w + w - 1)
  while (st.length) {
    const p = st.pop()!
    if (seen[p] || m.data[p]) continue
    seen[p] = 1
    const x = p % w, y = (p / w) | 0
    if (x > 0) st.push(p - 1)
    if (x < w - 1) st.push(p + 1)
    if (y > 0) st.push(p - w)
    if (y < h - 1) st.push(p + w)
  }
  const o: Mask = { w, h, data: new Uint8Array(w * h) }
  for (let i = 0; i < w * h; i++) o.data[i] = m.data[i] || !seen[i] ? 1 : 0
  return o
}

/* ---------- rotulação e descritores (G&W caps. 10 e 11) ---------- */

export type Blob = {
  id: number
  area: number
  perimetro: number
  circularidade: number
  alongamento: number
  cx: number
  cy: number
  x0: number
  y0: number
  x1: number
  y1: number
  cor: [number, number, number]
}

export function label(m: Mask, img?: RGB): { labels: Int32Array; blobs: Blob[] } {
  const { w, h } = m
  const labels = new Int32Array(w * h)
  const blobs: Blob[] = []
  let next = 0
  const st: number[] = []
  for (let p0 = 0; p0 < w * h; p0++) {
    if (!m.data[p0] || labels[p0]) continue
    next++
    let area = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, edges = 0
    let x0 = w, y0 = h, x1 = 0, y1 = 0
    const cor: [number, number, number] = [0, 0, 0]
    st.push(p0)
    labels[p0] = next
    while (st.length) {
      const p = st.pop()!
      const x = p % w, y = (p / w) | 0
      area++
      sx += x
      sy += y
      sxx += x * x
      syy += y * y
      sxy += x * y
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      if (img) {
        cor[0] += img.data[p * 3]
        cor[1] += img.data[p * 3 + 1]
        cor[2] += img.data[p * 3 + 2]
      }
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]
      for (const q of nb) {
        if (q < 0 || !m.data[q]) {
          edges++
          continue
        }
        if (!labels[q]) {
          labels[q] = next
          st.push(q)
        }
      }
    }
    // perímetro por contagem de arestas, corrigido por pi/4 (aproximação de Crofton)
    const perimetro = (edges * Math.PI) / 4
    const cx = sx / area, cy = sy / area
    const mxx = sxx / area - cx * cx, myy = syy / area - cy * cy, mxy = sxy / area - cx * cy
    const tr = mxx + myy, det = mxx * myy - mxy * mxy
    const l1 = tr / 2 + Math.sqrt(Math.max(0, (tr * tr) / 4 - det))
    const l2 = tr / 2 - Math.sqrt(Math.max(0, (tr * tr) / 4 - det))
    blobs.push({
      id: next,
      area,
      perimetro,
      circularidade: Math.min(1, (4 * Math.PI * area) / (perimetro * perimetro || 1)),
      alongamento: Math.sqrt(l1 / Math.max(l2, 1e-6)),
      cx,
      cy,
      x0,
      y0,
      x1,
      y1,
      cor: img ? [cor[0] / area, cor[1] / area, cor[2] / area] : [0, 0, 0],
    })
  }
  return { labels, blobs }
}

/** distância euclidiana aproximada até o fundo (chamfer 3-4) */
export function distanceTransform(m: Mask): Gray {
  const { w, h } = m
  const d = new Float32Array(w * h)
  const INF = 1e9
  for (let i = 0; i < w * h; i++) d[i] = m.data[i] ? INF : 0
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x])
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!d[i]) continue
      d[i] = Math.min(d[i], at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4)
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x
      if (!d[i]) continue
      d[i] = Math.min(d[i], at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4)
    }
  const o = newGray(w, h)
  for (let i = 0; i < w * h; i++) o.data[i] = d[i] / 3
  return o
}

/* ---------- agrupamento ---------- */

/** k-means em vetores de qualquer dimensão; retorna rótulos e centróides */
export function kmeans(X: number[][], k: number, seed = 1, iters = 25): { labels: Int32Array; centers: number[][] } {
  const R = rng(seed)
  const n = X.length, d = X[0].length
  // k-means++ simples
  const centers: number[][] = [X[Math.floor(R() * n)].slice()]
  const dist2 = (a: number[], b: number[]) => {
    let s = 0
    for (let j = 0; j < d; j++) s += (a[j] - b[j]) ** 2
    return s
  }
  while (centers.length < k) {
    const ds = X.map((x) => Math.min(...centers.map((c) => dist2(x, c))))
    const tot = ds.reduce((a, b) => a + b, 0)
    let u = R() * tot, i = 0
    while (i < n - 1 && (u -= ds[i]) > 0) i++
    centers.push(X[i].slice())
  }
  const labels = new Int32Array(n)
  for (let it = 0; it < iters; it++) {
    let changed = false
    for (let i = 0; i < n; i++) {
      let best = 0, bd = Infinity
      for (let c = 0; c < k; c++) {
        const dd = dist2(X[i], centers[c])
        if (dd < bd) {
          bd = dd
          best = c
        }
      }
      if (labels[i] !== best) changed = true
      labels[i] = best
    }
    const sums = centers.map(() => new Array(d).fill(0)), cnt = new Array(k).fill(0)
    for (let i = 0; i < n; i++) {
      cnt[labels[i]]++
      for (let j = 0; j < d; j++) sums[labels[i]][j] += X[i][j]
    }
    for (let c = 0; c < k; c++) if (cnt[c]) for (let j = 0; j < d; j++) centers[c][j] = sums[c][j] / cnt[c]
    if (!changed && it > 0) break
  }
  return { labels, centers }
}

/* ---------- mapas de cor ---------- */

function lerpStops(stops: [number, number, number][], t: number): [number, number, number] {
  t = Math.min(1, Math.max(0, t))
  const f = t * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(f)), u = f - i
  const a = stops[i], b = stops[i + 1]
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]
}

const RDYLGN: [number, number, number][] = [
  [165, 0, 38], [215, 48, 39], [244, 109, 67], [253, 174, 97], [254, 224, 139],
  [217, 239, 139], [166, 217, 106], [102, 189, 99], [26, 152, 80], [0, 104, 55],
]
const VIRIDIS: [number, number, number][] = [
  [68, 1, 84], [72, 40, 120], [62, 74, 137], [49, 104, 142], [38, 130, 142],
  [31, 158, 137], [53, 183, 121], [109, 205, 89], [180, 222, 44], [253, 231, 37],
]
export const rdylgn = (t: number) => lerpStops(RDYLGN, t)
export const viridis = (t: number) => lerpStops(VIRIDIS, t)
export const DIVERGE = (t: number) => lerpStops([[49, 54, 149], [116, 173, 209], [240, 240, 240], [244, 109, 67], [165, 0, 38]], t)

/** paleta categórica para rótulos */
export const CAT: [number, number, number][] = [
  [214, 96, 77], [67, 147, 195], [230, 171, 2], [102, 166, 30], [117, 112, 179],
  [231, 41, 138], [27, 158, 119], [166, 118, 29], [102, 102, 102], [31, 120, 180],
]
