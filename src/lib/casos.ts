// Geradores e algoritmos dos casos reais. Cada cena reproduz as condições descritas
// no trabalho original (câmera, altura, iluminação) para que o método do artigo possa
// ser rodado no navegador e comparado com um gabarito conhecido.

import { type RGB, type Gray, type Mask, newRGB, newGray, rng, smoothNoise, hsv2rgb, rgb2hsv, clamp, label, histogram, otsu, opening, closing, erode } from './img'

const paint = (w: number, h: number, f: (x: number, y: number) => [number, number, number]): RGB => {
  const o = newRGB(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = f(x, y), i = (y * w + x) * 3
      o.data[i] = clamp(c[0])
      o.data[i + 1] = clamp(c[1])
      o.data[i + 2] = clamp(c[2])
    }
  return o
}

function gauss(R: () => number) {
  const u = Math.max(1e-9, R()), v = R()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function addNoiseRGB(img: RGB, sigma: number, seed: number) {
  const R = rng(seed)
  for (let i = 0; i < img.data.length; i++) img.data[i] = clamp(img.data[i] + sigma * gauss(R))
}

/** reduz por média de blocos (simula sensor com menos pixels) e devolve no tamanho original */
function lowRes(img: RGB, f: number): RGB {
  const { w, h } = img
  const o = newRGB(w, h)
  for (let by = 0; by < h; by += f)
    for (let bx = 0; bx < w; bx += f) {
      const s = [0, 0, 0]
      let n = 0
      for (let y = by; y < Math.min(h, by + f); y++)
        for (let x = bx; x < Math.min(w, bx + f); x++) {
          const i = (y * w + x) * 3
          s[0] += img.data[i]
          s[1] += img.data[i + 1]
          s[2] += img.data[i + 2]
          n++
        }
      for (let y = by; y < Math.min(h, by + f); y++)
        for (let x = bx; x < Math.min(w, bx + f); x++) {
          const i = (y * w + x) * 3
          o.data[i] = s[0] / n
          o.data[i + 1] = s[1] / n
          o.data[i + 2] = s[2] / n
        }
    }
  return o
}

/* =====================================================================
   CASO 1 · Tomates na esteira (Noguti Júnior; Santos; Florian, 2023)
   ===================================================================== */

export type CorTomate = 'verde' | 'amarelo' | 'laranja' | 'vermelho'
export const CORES_TOMATE: CorTomate[] = ['vermelho', 'laranja', 'amarelo', 'verde']
export const COR_TOMATE_CSS: Record<CorTomate, string> = { vermelho: '#e0453a', laranja: '#f08a2a', amarelo: '#e9c93b', verde: '#5cbf4a' }

/** Tabela 1 do artigo: H em graus (0–360), S e V em 0–255 */
export const TABELA_ARTIGO: { cor: CorTomate; h: [number, number]; s: number; v: number }[] = [
  { cor: 'vermelho', h: [0, 10], s: 50, v: 50 },
  { cor: 'vermelho', h: [341, 360], s: 50, v: 50 },
  { cor: 'laranja', h: [11, 35], s: 50, v: 50 },
  { cor: 'amarelo', h: [36, 60], s: 50, v: 50 },
  { cor: 'verde', h: [61, 120], s: 50, v: 50 },
]

export type Camera = 'Full HD' | 'HD'
export type Luz = 'LED branca' | 'lâmpada amarela' | 'pouca luz'
export type Tomate = { x: number; y: number; r: number; cor: CorTomate; hue: number }

const HUES: { cor: CorTomate; h: number }[] = [
  { cor: 'verde', h: 97 }, { cor: 'verde', h: 84 },
  { cor: 'amarelo', h: 52 }, { cor: 'amarelo', h: 44 },
  { cor: 'laranja', h: 29 }, { cor: 'laranja', h: 21 },
  { cor: 'vermelho', h: 5 }, { cor: 'vermelho', h: 353 },
]

export function makeTomatoes(seed: number, camera: Camera, luz: Luz): { rgb: RGB; tomates: Tomate[] } {
  const w = 360, h = 240
  const R = rng(seed)
  const order = HUES.map((v, i) => ({ v, k: R() + i * 0 })).sort((a, b) => a.k - b.k).map((o) => o.v)
  const tomates: Tomate[] = order.map((o, i) => ({
    x: 50 + (i % 4) * 87 + (R() - 0.5) * 10,
    y: (i < 4 ? 66 : 172) + (R() - 0.5) * 10,
    r: 30 + R() * 5,
    cor: o.cor,
    hue: o.h,
  }))
  const gain = luz === 'LED branca' ? [1, 1, 1] : luz === 'lâmpada amarela' ? [1.1, 0.95, 0.62] : [0.5, 0.5, 0.5]
  const L = [-0.45, -0.55, 0.7]
  const rgb = paint(w, h, (x, y) => {
    // esteira cinza-clara com frisos
    const g = 196 + 10 * smoothNoise(x / 40, y / 40, seed + 3, 2) - (y % 24 < 2 ? 18 : 0) - 26 * Math.pow(Math.abs(x - 180) / 180, 2)
    let c: [number, number, number] = [g, g, g - 4]
    for (const t of tomates) {
      // sombra projetada na esteira
      const ds = Math.hypot(x - t.x - 6, y - t.y - 7) / t.r
      if (ds < 1.05) c = [c[0] * 0.72, c[1] * 0.72, c[2] * 0.72]
    }
    for (const t of tomates) {
      const dx = (x - t.x) / t.r, dy = (y - t.y) / t.r, d2 = dx * dx + dy * dy
      if (d2 > 1) continue
      const z = Math.sqrt(1 - d2)
      const dif = Math.max(0, -L[0] * -dx + -L[1] * -dy + L[2] * z)
      const shade = 0.32 + 0.68 * dif
      const n = smoothNoise(x / 6, y / 6, seed + 11, 2)
      let col = hsv2rgb(t.hue, 0.82 + 0.08 * n, (0.8 + 0.08 * n) * shade)
      // cálice verde no centro
      const ang = Math.atan2(dy, dx), rr = Math.sqrt(d2)
      if (rr < 0.26 * (0.55 + 0.45 * Math.abs(Math.cos(2.5 * ang)))) col = hsv2rgb(100, 0.7, 0.34)
      // brilho especular
      const spec = Math.pow(Math.max(0, -0.35 * dx - 0.45 * dy + 0.82 * z), 40)
      col = [col[0] + (255 - col[0]) * spec * 0.9, col[1] + (255 - col[1]) * spec * 0.9, col[2] + (255 - col[2]) * spec * 0.9]
      c = col
    }
    return [c[0] * gain[0], c[1] * gain[1], c[2] * gain[2]]
  })
  let out = rgb
  if (camera === 'HD') {
    out = lowRes(rgb, 3)
    for (let i = 0; i < out.data.length; i += 3) {
      // webcam barata: menos saturação e balanço de branco puxado pro azul
      const m = (out.data[i] + out.data[i + 1] + out.data[i + 2]) / 3
      out.data[i] = m + (out.data[i] - m) * 0.8
      out.data[i + 1] = m + (out.data[i + 1] - m) * 0.8
      out.data[i + 2] = m + (out.data[i + 2] - m) * 0.8 + 8
    }
    addNoiseRGB(out, 11, seed + 5)
  } else addNoiseRGB(out, 3, seed + 5)
  return { rgb: out, tomates }
}

export type ModoTabela = 'H em graus (como no artigo)' | 'tabela colada no OpenCV (H de 0 a 179)'

/** máscaras por cor usando a tabela do artigo */
export function tomatoMasks(img: RGB, modo: ModoTabela): Record<CorTomate, Mask> {
  const { w, h } = img
  const out = {} as Record<CorTomate, Mask>
  CORES_TOMATE.forEach((c) => (out[c] = { w, h, data: new Uint8Array(w * h) }))
  for (let i = 0; i < w * h; i++) {
    const [H, S, V] = rgb2hsv(img.data[i * 3], img.data[i * 3 + 1], img.data[i * 3 + 2])
    const hh = modo === 'H em graus (como no artigo)' ? H : Math.round(H / 2) // OpenCV guarda H/2
    const s = S * 255, v = V * 255
    for (const r of TABELA_ARTIGO) if (hh >= r.h[0] && hh <= r.h[1] && s >= r.s && v >= r.v) out[r.cor].data[i] = 1
  }
  CORES_TOMATE.forEach((c) => (out[c] = opening(out[c], 'disco', 1)))
  return out
}

export type DeteccaoTomate = { t: Tomate; objeto: boolean; cor: CorTomate | null; frac: Record<CorTomate, number> }

export function detectTomatoes(masks: Record<CorTomate, Mask>, tomates: Tomate[]): DeteccaoTomate[] {
  const w = masks.verde.w
  return tomates.map((t) => {
    const cnt = { verde: 0, amarelo: 0, laranja: 0, vermelho: 0 } as Record<CorTomate, number>
    let area = 0
    for (let y = Math.floor(t.y - t.r); y <= t.y + t.r; y++)
      for (let x = Math.floor(t.x - t.r); x <= t.x + t.r; x++) {
        if (x < 0 || y < 0 || x >= w || y >= masks.verde.h) continue
        if ((x - t.x) ** 2 + (y - t.y) ** 2 > t.r * t.r) continue
        area++
        CORES_TOMATE.forEach((c) => (cnt[c] += masks[c].data[y * w + x]))
      }
    const frac = { verde: cnt.verde / area, amarelo: cnt.amarelo / area, laranja: cnt.laranja / area, vermelho: cnt.vermelho / area }
    const best = CORES_TOMATE.reduce((a, b) => (frac[b] > frac[a] ? b : a))
    const tot = CORES_TOMATE.reduce((s, c) => s + frac[c], 0)
    const objeto = tot > 0.3
    return { t, objeto, cor: objeto ? best : null, frac }
  })
}

/** detecção sem gabarito (foto do aluno): cada mancha grande de uma cor vira um objeto */
export function detectBlobs(masks: Record<CorTomate, Mask>, minFrac = 0.004) {
  const w = masks.verde.w, h = masks.verde.h
  const out: { cor: CorTomate; x0: number; y0: number; x1: number; y1: number; cx: number; cy: number; area: number }[] = []
  CORES_TOMATE.forEach((c) => {
    label(masks[c]).blobs.filter((b) => b.area > minFrac * w * h).forEach((b) => out.push({ cor: c, x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, cx: b.cx, cy: b.cy, area: b.area }))
  })
  return out
}

/* =====================================================================
   CASO 2 · Aves de corte no aviário (Berlanda, 2015 · TCC UTFPR Medianeira)
   ===================================================================== */

export type Ave = { x: number; y: number; a: number; b: number; ang: number }
export type Aviario = { img: RGB; fundo: RGB; fundoOutro: RGB; aves: Ave[]; regioes: Regiao[] }
export type Regiao = { id: number; x0: number; y0: number; x1: number; y1: number; area: number; verdade: number }

const AW = 360, AH = 240
/** escala aparente pela perspectiva da câmera a 1,80 m e 45°: longe (topo) fica menor */
export const escalaAve = (y: number) => 0.5 + 0.55 * (y / AH)
const COMEDOUROS = [
  { x: 110, y: 150 },
  { x: 250, y: 110 },
]

function floorColor(x: number, y: number, seed: number, dx = 0, dy = 0, extra = false): [number, number, number] {
  const n = smoothNoise(x / 3, y / 3, seed, 3), m = smoothNoise(x / 25, y / 25, seed + 2, 2)
  let c: [number, number, number] = [128 + 30 * n + 20 * m, 106 + 26 * n + 16 * m, 80 + 20 * n + 10 * m] // maravalha
  for (const f of COMEDOUROS) {
    const s = escalaAve(f.y)
    const d = Math.hypot((x - f.x - dx) / s, ((y - f.y - dy) / s) * 1.5)
    if (d < 17) c = d < 9 ? [70, 40, 28] : [205, 95, 40] // prato do comedouro tubular
    if (Math.abs(x - f.x - dx) < 2.5 * s && y < f.y + dy && y > f.y + dy - 60 * s) c = [175, 175, 170] // tubo
  }
  if (extra) {
    // objetos que só aparecem no vídeo usado como modelo (como o tonel do TCC)
    if (Math.hypot(x - 320, (y - 200) * 1.2) < 22) c = [60, 70, 150]
  }
  return c
}

/** clarão da câmera infravermelha: centro estourado, bordas escuras */
const iluminacao = (x: number, y: number) => 0.45 + 1.0 * Math.exp(-((x - 185) ** 2 + (y - 125) ** 2) / (2 * 95 * 95))

export function makeAviario(seed: number, n: number): Aviario {
  const R = rng(seed)
  const aves: Ave[] = []
  for (let k = 0; k < n; k++) {
    let x: number, y: number
    if (R() < 0.55) {
      const f = COMEDOUROS[k % 2]
      x = f.x + gauss(R) * 34
      y = f.y + gauss(R) * 24
    } else {
      x = 12 + R() * (AW - 24)
      y = 12 + R() * (AH - 24)
    }
    x = Math.max(6, Math.min(AW - 6, x))
    y = Math.max(6, Math.min(AH - 6, y))
    const s = escalaAve(y)
    aves.push({ x, y, a: 11.5 * s, b: 8 * s, ang: R() * Math.PI })
  }
  aves.sort((p, q) => p.y - q.y)
  const bucket: Ave[][] = Array.from({ length: Math.ceil(AW / 20) }, () => [])
  aves.forEach((a) => {
    for (let bx = Math.floor((a.x - 14) / 20); bx <= Math.floor((a.x + 14) / 20); bx++) if (bucket[bx]) bucket[bx].push(a)
  })
  const img = paint(AW, AH, (x, y) => {
    let c = floorColor(x, y, seed)
    const list = bucket[Math.floor(x / 20)] || []
    for (const a of list) {
      const dx = x - a.x, dy = y - a.y
      const u = dx * Math.cos(a.ang) + dy * Math.sin(a.ang), v = -dx * Math.sin(a.ang) + dy * Math.cos(a.ang)
      const d = (u / a.a) ** 2 + (v / a.b) ** 2
      const head = ((u - a.a * 0.95) / (a.b * 0.55)) ** 2 + (v / (a.b * 0.55)) ** 2
      if (d < 1 || head < 1) {
        const sh = 0.78 + 0.22 * Math.sqrt(Math.max(0, 1 - d)) - (Math.abs(v) < 0.6 && u < 0 ? 0.08 : 0) // dorso e asa
        c = head < 1 && d >= 1 ? [215, 200, 185] : [232 * sh, 226 * sh, 212 * sh]
      }
    }
    const g = iluminacao(x, y)
    return [c[0] * g, c[1] * g, c[2] * g]
  })
  addNoiseRGB(img, 5, seed + 1)
  const fundo = paint(AW, AH, (x, y) => {
    const c = floorColor(x, y, seed)
    const g = iluminacao(x, y)
    return [c[0] * g, c[1] * g, c[2] * g]
  })
  const fundoOutro = paint(AW, AH, (x, y) => {
    const c = floorColor(x, y, seed + 9, 7, -5, true)
    const g = iluminacao(x, y)
    return [c[0] * g, c[1] * g, c[2] * g]
  })
  // 6 retângulos fixos, como a janela "Estático" do TCC
  const regioes: Regiao[] = []
  const cols = [8, 124, 240, 352], rows = [30, 128, 232]
  let id = 1
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 3; c++) {
      const reg = { id: id++, x0: cols[c], y0: rows[r], x1: cols[c + 1], y1: rows[r + 1], area: 0, verdade: 0 }
      const yc = (reg.y0 + reg.y1) / 2, s = escalaAve(yc)
      reg.area = Math.round(Math.PI * 11.5 * 8 * s * s * 0.95)
      reg.verdade = aves.filter((a) => a.x >= reg.x0 && a.x < reg.x1 && a.y >= reg.y0 && a.y < reg.y1).length
      regioes.push(reg)
    }
  return { img, fundo, fundoOutro, aves, regioes }
}

export type PreAve = 'inRange direto' | 'multiplicar por 0,7 + inRange' | 'subtração de fundo + inRange'
export type ContaAve = 'pixels ÷ área da ave' | 'contornos' | 'erosão + contornos'

export function grayOf(img: RGB): Gray {
  const g = newGray(img.w, img.h)
  for (let i = 0; i < g.data.length; i++) g.data[i] = 0.299 * img.data[i * 3] + 0.587 * img.data[i * 3 + 1] + 0.114 * img.data[i * 3 + 2]
  return g
}

export function aveMask(img: RGB, fundo: RGB, pre: PreAve, lo: number, largura = 50): { base: Gray; mask: Mask } {
  const g = grayOf(img)
  const base = newGray(img.w, img.h)
  if (pre === 'subtração de fundo + inRange') {
    const f = grayOf(fundo)
    for (let i = 0; i < g.data.length; i++) base.data[i] = clamp(g.data[i] - f.data[i])
  } else if (pre === 'multiplicar por 0,7 + inRange') for (let i = 0; i < g.data.length; i++) base.data[i] = g.data[i] * 0.7
  else base.data.set(g.data)
  const hi = pre === 'subtração de fundo + inRange' ? 255 : lo + largura
  const mask: Mask = { w: img.w, h: img.h, data: new Uint8Array(img.w * img.h) }
  for (let i = 0; i < g.data.length; i++) mask.data[i] = base.data[i] >= lo && base.data[i] <= hi ? 1 : 0
  return { base, mask: opening(mask, 'disco', 1) }
}

export function contarAves(mask: Mask, regioes: Regiao[], metodo: ContaAve): number[] {
  if (metodo === 'pixels ÷ área da ave')
    return regioes.map((r) => {
      let s = 0
      for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) s += mask.data[y * mask.w + x]
      return Math.round(s / r.area)
    })
  const m = metodo === 'erosão + contornos' ? erode(mask, 'disco', 2) : mask
  const { blobs } = label(m)
  return regioes.map((r) => blobs.filter((b) => b.area >= (metodo === 'erosão + contornos' ? 0.12 : 0.3) * r.area && b.cx >= r.x0 && b.cx < r.x1 && b.cy >= r.y0 && b.cy < r.y1).length)
}

/* =====================================================================
   CASO 3 · Linha de soja vista do drone (Souza et al., 2022)
   ===================================================================== */

/** DJI Phantom 3 Pro: sensor 1/2,3" (6,17 mm), lente 3,61 mm, 4000 px de largura */
export const gsdPhantom3 = (alturaM: number) => (alturaM * 100 * 0.617) / (0.361 * 4000) // cm/px

export type Estadio = 'VC' | 'V2' | 'V4'
export type Velocidade = 4 | 6 | 8
export type SojaOpts = { seed: number; velocidade: Velocidade; estadio: Estadio; altura: number; palha: boolean; nuvem: boolean }
export type SojaCena = { img: RGB; gsd: number; plantas: number[]; w: number; h: number; comprimento: number }

const LARG = 150, ALT = 40 // cm de linha mostrados

export function makeSoja(o: SojaOpts): SojaCena {
  const R = rng(o.seed * 31 + o.velocidade)
  // semeadora: 16 sementes/m (6,25 cm), irregularidade cresce com a velocidade
  const cv = { 4: 0.18, 6: 0.3, 8: 0.42 }[o.velocidade]
  const pDupla = { 4: 0.04, 6: 0.08, 8: 0.12 }[o.velocidade]
  const sementes: number[] = []
  let x = -10
  while (x < LARG + 10) {
    x += Math.max(0.6, 6.25 * (1 + cv * gauss(R)))
    sementes.push(x)
    if (R() < pDupla) sementes.push(x + 0.6 + R() * 2)
  }
  const plantas = sementes.filter(() => R() < 0.8).sort((a, b) => a - b) // germinação de 80%
  const raio = { VC: 2.2, V2: 4.2, V4: 7.5 }[o.estadio]
  const nFol = { VC: 2, V2: 5, V4: 12 }[o.estadio]
  type Fol = { x: number; y: number; L: number; W: number; ang: number; v: number }
  const fols: Fol[] = []
  plantas.forEach((px) => {
    const py = ALT / 2 + gauss(R) * 0.6
    for (let k = 0; k < nFol; k++) {
      const a = (k / nFol) * Math.PI * 2 + R() * 0.8
      const d = raio * (o.estadio === 'VC' ? 0.28 + 0.08 * R() : 0.35 + 0.35 * R())
      const L = raio * (o.estadio === 'VC' ? 0.45 : 0.5)
      fols.push({ x: px + Math.cos(a) * d, y: py + Math.sin(a) * d, L, W: L * 0.55, ang: a, v: 0.42 + 0.14 * R() })
    }
  })
  type Pal = { x: number; y: number; L: number; ang: number }
  const pals: Pal[] = []
  if (o.palha) for (let k = 0; k < 420; k++) pals.push({ x: R() * (LARG + 10) - 5, y: R() * ALT, L: 2 + R() * 4, ang: R() * Math.PI })
  const B = 3
  const bf: Fol[][] = Array.from({ length: Math.ceil((LARG + 30) / B) }, () => [])
  fols.forEach((f) => {
    for (let b = Math.floor((f.x - f.L + 10) / B); b <= Math.floor((f.x + f.L + 10) / B); b++) if (bf[b]) bf[b].push(f)
  })
  const bp: Pal[][] = Array.from({ length: Math.ceil((LARG + 30) / B) }, () => [])
  pals.forEach((p) => {
    for (let b = Math.floor((p.x - p.L + 10) / B); b <= Math.floor((p.x + p.L + 10) / B); b++) if (bp[b]) bp[b].push(p)
  })
  const colorAt = (cx: number, cy: number): [number, number, number] => {
    const n = smoothNoise(cx * 1.5, cy * 1.5, o.seed + 3, 2)
    let c: [number, number, number] = [92 + 22 * n, 70 + 16 * n, 54 + 12 * n] // solo
    for (const p of bp[Math.floor((cx + 10) / B)] || []) {
      const dx = cx - p.x, dy = cy - p.y
      const u = dx * Math.cos(p.ang) + dy * Math.sin(p.ang), v = -dx * Math.sin(p.ang) + dy * Math.cos(p.ang)
      if (Math.abs(u) < p.L / 2 && Math.abs(v) < 0.18) c = [178, 164, 126] // palha de aveia-preta
    }
    for (const f of bf[Math.floor((cx + 10) / B)] || []) {
      const dx = cx - f.x, dy = cy - f.y
      const u = dx * Math.cos(f.ang) + dy * Math.sin(f.ang), v = -dx * Math.sin(f.ang) + dy * Math.cos(f.ang)
      if ((u / f.L) ** 2 + (v / f.W) ** 2 < 1) c = hsv2rgb(98, 0.6, f.v)
    }
    return c
  }
  const gsd = gsdPhantom3(o.altura)
  const w = Math.max(8, Math.round(LARG / gsd)), h = Math.max(4, Math.round(ALT / gsd))
  const ss = 3
  const img = paint(w, h, (px, py) => {
    const s = [0, 0, 0]
    for (let j = 0; j < ss; j++)
      for (let i = 0; i < ss; i++) {
        const c = colorAt((px + (i + 0.5) / ss) * gsd, (py + (j + 0.5) / ss) * gsd)
        s[0] += c[0]
        s[1] += c[1]
        s[2] += c[2]
      }
    const k = o.nuvem ? 0.62 : 1
    return [(s[0] / ss / ss) * k, (s[1] / ss / ss) * k, (s[2] / ss / ss) * k]
  })
  addNoiseRGB(img, o.nuvem ? 7 : 4, o.seed + 8)
  return { img, gsd, plantas: plantas.filter((p) => p >= 0 && p <= LARG), w, h, comprimento: LARG }
}

export type CanalSoja = 'G (como no artigo)' | 'ExG'
export type Kurachi = 'duplo' | 'aceitável' | 'falha'
export const kurachi = (d: number): Kurachi => (d < 3.1 ? 'duplo' : d > 9.4 ? 'falha' : 'aceitável')
export const KURACHI_CSS: Record<Kurachi, string> = { duplo: '#4f8fe0', aceitável: '#5cbf4a', falha: '#e0453a' }

export function sojaPipeline(c: SojaCena, canal: CanalSoja) {
  const { img, gsd } = c
  const g = newGray(img.w, img.h)
  for (let i = 0; i < g.data.length; i++) {
    const r = img.data[i * 3], gg = img.data[i * 3 + 1], b = img.data[i * 3 + 2]
    g.data[i] = canal === 'ExG' ? clamp(128 + (2 * gg - r - b)) : gg
  }
  const t = otsu(histogram(g))
  const m: Mask = { w: img.w, h: img.h, data: new Uint8Array(img.w * img.h) }
  for (let i = 0; i < m.data.length; i++) m.data[i] = g.data[i] > t ? 1 : 0
  const aberta = img.w > 60 ? opening(m, 'disco', 1) : m
  // fechamento de ~1 cm junta as partes de uma mesma planta (cotilédones, folíolos)
  const mask = closing(aberta, 'disco', Math.max(1, Math.min(3, Math.round(1 / gsd))))
  const minA = 1.2 / (gsd * gsd)
  const grupos = label(mask).blobs.filter((b) => b.area >= Math.max(2, minA)).sort((a, b) => a.cx - b.cx)
  const dist = grupos.slice(1).map((b, i) => (b.cx - grupos[i].cx) * gsd)
  const real = c.plantas.slice(1).map((p, i) => p - c.plantas[i])
  const pct = (arr: number[]) => {
    const o = { duplo: 0, aceitável: 0, falha: 0 } as Record<Kurachi, number>
    arr.forEach((d) => o[kurachi(d)]++)
    const n = arr.length || 1
    return { duplo: (100 * o.duplo) / n, aceitável: (100 * o.aceitável) / n, falha: (100 * o.falha) / n }
  }
  return { gray: g, t, mask, grupos, dist, real, pctEst: pct(dist), pctReal: pct(real) }
}

/* =====================================================================
   CASO 4 · NDVI em vinhedos e pomares (Hoff et al., 2011 · Embrapa Uva e Vinho)
   ===================================================================== */

export type Resolucao = 'ALOS multiespectral · 10 m' | 'ALOS fusionada · 2,5 m' | 'drone · 0,5 m'
export const RES_M: Record<Resolucao, number> = { 'ALOS multiespectral · 10 m': 10, 'ALOS fusionada · 2,5 m': 2.5, 'drone · 0,5 m': 0.5 }
export type Epoca = 'outubro (brotação)' | 'fevereiro (pré-colheita)'
export type Entrelinha = 'solo exposto' | 'gramada' | 'grama seca'

export type Parcela = { id: string; x0: number; y0: number; x1: number; y1: number; vigor: number; horizontal: boolean }
export type Vinhedo = { w: number; h: number; R: Float32Array; N: Float32Array; G: Float32Array; B: Float32Array; parcela: Int8Array; vigorPx: Float32Array; parcelas: Parcela[] }

const VW = 480, VH = 320 // pixels de 0,5 m → 240 × 160 m

export function makeVinhedo(seed: number, epoca: Epoca, entre: Entrelinha): Vinhedo {
  const Rn = rng(seed)
  const base = [0.88, 0.58, 0.74, 0.42, 0.93, 0.66]
  const parcelas: Parcela[] = []
  let k = 0
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 3; c++) {
      parcelas.push({ id: `P${k + 1}`, x0: 8 + c * 156, y0: 10 + r * 154, x1: 8 + c * 156 + 146, y1: 10 + r * 154 + 144, vigor: base[k] + (Rn() - 0.5) * 0.06, horizontal: (r + c) % 2 === 0 })
      k++
    }
  const n = VW * VH
  const v: Vinhedo = { w: VW, h: VH, R: new Float32Array(n), N: new Float32Array(n), G: new Float32Array(n), B: new Float32Array(n), parcela: new Int8Array(n).fill(-1), vigorPx: new Float32Array(n), parcelas }
  const dossel = epoca === 'outubro (brotação)' ? 0.35 : 1.0 // largura do dossel (m) numa entrelinha de 2,5 m
  const ent = entre === 'solo exposto' ? [0.16, 0.25, 0.12, 0.09] : entre === 'gramada' ? [0.05, 0.4, 0.1, 0.04] : [0.13, 0.27, 0.12, 0.08]
  const ss = 4
  for (let y = 0; y < VH; y++)
    for (let x = 0; x < VW; x++) {
      const i = y * VW + x
      const p = parcelas.findIndex((q) => x >= q.x0 && x < q.x1 && y >= q.y0 && y < q.y1)
      if (p < 0) {
        const road = [0.21, 0.27, 0.18, 0.15]
        v.R[i] = road[0]
        v.N[i] = road[1]
        v.G[i] = road[2]
        v.B[i] = road[3]
        continue
      }
      const q = parcelas[p]
      v.parcela[i] = p
      // vigor dentro da parcela: gradiente + mancha de menor vigor (baixada úmida, solo raso)
      const vg = clamp(q.vigor + 0.22 * (smoothNoise(x / 60, y / 60, seed + p, 2) - 0.5) - (p === 2 ? 0.3 * Math.exp(-((x - 380) ** 2 + (y - 60) ** 2) / 900) : 0), 0.1, 1)
      v.vigorPx[i] = vg
      const can = [0.03 + 0.09 * (1 - vg), 0.18 + 0.34 * vg, 0.06 + 0.05 * (1 - vg), 0.03]
      let cov = 0
      for (let j = 0; j < ss; j++)
        for (let l = 0; l < ss; l++) {
          const u = (q.horizontal ? y + (j + 0.5) / ss : x + (l + 0.5) / ss) * 0.5 // metros
          const d = Math.abs((u % 2.5) - 1.25)
          if (d < dossel / 2) cov++
        }
      const f = cov / (ss * ss)
      v.R[i] = f * can[0] + (1 - f) * ent[0]
      v.N[i] = f * can[1] + (1 - f) * ent[1]
      v.G[i] = f * can[2] + (1 - f) * ent[2]
      v.B[i] = f * can[3] + (1 - f) * ent[3]
    }
  return v
}

/** reamostra para a resolução do sensor (mistura linear de reflectâncias) */
export function resample(v: Vinhedo, res: Resolucao) {
  const f = Math.round(RES_M[res] / 0.5)
  const w = Math.ceil(v.w / f), h = Math.ceil(v.h / f)
  const R = new Float32Array(w * h), N = new Float32Array(w * h), G = new Float32Array(w * h), B = new Float32Array(w * h)
  const par = new Int8Array(w * h).fill(-1)
  for (let by = 0; by < h; by++)
    for (let bx = 0; bx < w; bx++) {
      let r = 0, nn = 0, g = 0, b = 0, c = 0
      for (let y = by * f; y < Math.min(v.h, by * f + f); y++)
        for (let x = bx * f; x < Math.min(v.w, bx * f + f); x++) {
          const i = y * v.w + x
          r += v.R[i]
          nn += v.N[i]
          g += v.G[i]
          b += v.B[i]
          c++
        }
      const o = by * w + bx
      R[o] = r / c
      N[o] = nn / c
      G[o] = g / c
      B[o] = b / c
      const cx = Math.min(v.w - 1, bx * f + (f >> 1)), cy = Math.min(v.h - 1, by * f + (f >> 1))
      par[o] = v.parcela[cy * v.w + cx]
    }
  const ndvi = newGray(w, h)
  for (let i = 0; i < w * h; i++) ndvi.data[i] = (N[i] - R[i]) / (N[i] + R[i] + 1e-6)
  const rgb = newRGB(w, h)
  for (let i = 0; i < w * h; i++) {
    const t = (r: number) => clamp(255 * Math.pow(Math.max(0, r * 3.2), 0.8))
    rgb.data[i * 3] = t(R[i])
    rgb.data[i * 3 + 1] = t(G[i])
    rgb.data[i * 3 + 2] = t(B[i])
  }
  // estatística zonal por parcela (média e desvio do NDVI) e vigor real
  const stats = v.parcelas.map((p, k) => {
    const vals: number[] = []
    for (let i = 0; i < w * h; i++) if (par[i] === k) vals.push(ndvi.data[i])
    const m = vals.reduce((a, b) => a + b, 0) / (vals.length || 1)
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / (vals.length || 1))
    let vs = 0, vn = 0
    for (let i = 0; i < v.w * v.h; i++)
      if (v.parcela[i] === k) {
        vs += v.vigorPx[i]
        vn++
      }
    return { id: p.id, media: m, desvio: sd, n: vals.length, vigor: vs / vn }
  })
  const xs = stats.map((s) => s.vigor), ys = stats.map((s) => s.media)
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length
  let sxy = 0, sxx = 0, syy = 0
  xs.forEach((x, i) => {
    sxy += (x - mx) * (ys[i] - my)
    sxx += (x - mx) ** 2
    syy += (ys[i] - my) ** 2
  })
  const r = sxy / Math.sqrt(sxx * syy || 1)
  return { w, h, f, ndvi, rgb, stats, r, amplitude: Math.max(...ys) - Math.min(...ys) }
}

/* =====================================================================
   CASO 5 · Braquiária na entrelinha de citros (Carvalho; Carvalho, 2022 · Embrapa)
   ===================================================================== */

export type Voo = 'voo A · 10h, sol' | 'voo B · nublado' | 'voo C · 16h, sombra longa'
export const VOOS: Voo[] = ['voo A · 10h, sol', 'voo B · nublado', 'voo C · 16h, sombra longa']
export type Citros = { img: RGB; gram: Uint8Array; cobertura: number }

const CW = 300, CH = 200

export function makeCitros(seed: number, voo: Voo): Citros {
  const Rr = rng(seed)
  const sombra = voo === 'voo C · 16h, sombra longa' ? 52 : voo === 'voo A · 10h, sol' ? 22 : 0
  const luz = voo === 'voo B · nublado' ? [0.82, 0.85, 0.92] : voo === 'voo C · 16h, sombra longa' ? [1.05, 0.93, 0.78] : [1, 1, 1]
  const gram = new Uint8Array(CW * CH)
  // folhas largas espontâneas (trapoeraba, corda-de-viola…)
  const esp = Array.from({ length: 16 }, () => ({ x: Rr() * CW, y: 40 + Rr() * 120, r: 5 + Rr() * 7 }))
  const img = paint(CW, CH, (x, y) => {
    const i = y * CW + x
    const tt = smoothNoise(x / 38, y / 38, seed + 1, 3)
    const cov = smoothNoise(x / 22, y / 22, seed + 4, 3)
    let c: [number, number, number]
    let isG = false
    if (cov > 0.47) {
      // braquiária: lâminas finas e alongadas, verde-amarelada
      const blade = smoothNoise(x / 1.3, y / 5, seed + 7, 2)
      c = hsv2rgb(72 + 12 * tt, 0.5 + 0.15 * blade, 0.46 + 0.22 * blade)
      isG = true
    } else if (cov > 0.4 || tt > 0.62) {
      const f = smoothNoise(x / 1.6, y / 1.6, seed + 9, 2)
      c = [168 + 30 * f, 150 + 26 * f, 108 + 18 * f] // palhada
    } else {
      const s = smoothNoise(x / 2, y / 2, seed + 11, 3)
      c = [120 + 34 * s, 86 + 22 * s, 62 + 16 * s] // solo
    }
    for (const e of esp)
      if ((x - e.x) ** 2 + (y - e.y) ** 2 < e.r * e.r) {
        const f = smoothNoise(x / 4, y / 4, seed + 13, 1)
        c = hsv2rgb(118, 0.55, 0.4 + 0.12 * f)
        isG = false
      }
    // sombra da copa das laranjeiras nas bordas da entrelinha
    const bord = Math.min(y, CH - 1 - y) - (sombra ? sombra * (0.7 + 0.5 * smoothNoise(x / 30, 0, seed + 15, 2)) : -1)
    if (bord < 0) c = [c[0] * 0.38, c[1] * 0.42, c[2] * 0.5]
    gram[i] = isG ? 1 : 0
    return [c[0] * luz[0], c[1] * luz[1], c[2] * luz[2]]
  })
  addNoiseRGB(img, 4, seed + 17)
  let s = 0
  for (let i = 0; i < gram.length; i++) s += gram[i]
  return { img, gram, cobertura: (100 * s) / gram.length }
}

/** atributos por pixel, na linha dos "training features" do Trainable Weka Segmentation */
export const ATRIBUTOS = ['R', 'G', 'B', 'matiz', 'saturação', 'brilho', 'ExG', 'média 5×5', 'desvio 5×5'] as const
export function pixelFeatures(img: RGB): Float32Array[] {
  const { w, h } = img
  const n = w * h
  const F = ATRIBUTOS.map(() => new Float32Array(n))
  const gray = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const r = img.data[i * 3], g = img.data[i * 3 + 1], b = img.data[i * 3 + 2]
    const [H, S, V] = rgb2hsv(r, g, b)
    F[0][i] = r
    F[1][i] = g
    F[2][i] = b
    F[3][i] = H > 300 ? H - 360 : H
    F[4][i] = S * 255
    F[5][i] = V * 255
    F[6][i] = 2 * g - r - b
    gray[i] = 0.3 * r + 0.59 * g + 0.11 * b
  }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0, s2 = 0, c = 0
      for (let j = -2; j <= 2; j++)
        for (let k = -2; k <= 2; k++) {
          const yy = y + j, xx = x + k
          if (yy < 0 || xx < 0 || yy >= h || xx >= w) continue
          const v = gray[yy * w + xx]
          s += v
          s2 += v * v
          c++
        }
      const m = s / c
      F[7][y * w + x] = m
      F[8][y * w + x] = Math.sqrt(Math.max(0, s2 / c - m * m))
    }
  return F
}

/* ---------- Random Forest binário, pequeno e didático ---------- */

type Node = { f: number; t: number; l: Node | null; r: Node | null; p: number }
export type Forest = Node[]

function gini(p: number) {
  return 2 * p * (1 - p)
}

function buildNode(F: Float32Array[], y: Uint8Array, idx: number[], depth: number, R: () => number, maxDepth: number): Node {
  let pos = 0
  for (const i of idx) pos += y[i]
  const p = pos / idx.length
  if (depth >= maxDepth || idx.length < 4 || p === 0 || p === 1) return { f: -1, t: 0, l: null, r: null, p }
  const nf = F.length, mtry = Math.max(1, Math.round(Math.sqrt(nf)))
  let best = { g: gini(p), f: -1, t: 0 }
  for (let k = 0; k < mtry; k++) {
    const f = Math.floor(R() * nf)
    let lo = Infinity, hi = -Infinity
    for (const i of idx) {
      const v = F[f][i]
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
    for (let c = 0; c < 8; c++) {
      const t = lo + R() * (hi - lo)
      let nl = 0, pl = 0, pr = 0
      for (const i of idx)
        if (F[f][i] <= t) {
          nl++
          pl += y[i]
        } else pr += y[i]
      const nr = idx.length - nl
      if (!nl || !nr) continue
      const g = (nl * gini(pl / nl) + nr * gini(pr / nr)) / idx.length
      if (g < best.g - 1e-9) best = { g, f, t }
    }
  }
  if (best.f < 0) return { f: -1, t: 0, l: null, r: null, p }
  const L: number[] = [], Rt: number[] = []
  for (const i of idx) (F[best.f][i] <= best.t ? L : Rt).push(i)
  return { f: best.f, t: best.t, p, l: buildNode(F, y, L, depth + 1, R, maxDepth), r: buildNode(F, y, Rt, depth + 1, R, maxDepth) }
}

export function trainForest(F: Float32Array[], y: Uint8Array, idx: number[], seed = 1, nTrees = 20, maxDepth = 10): Forest {
  const R = rng(seed)
  const out: Forest = []
  for (let t = 0; t < nTrees; t++) {
    const boot = idx.map(() => idx[Math.floor(R() * idx.length)])
    out.push(buildNode(F, y, boot, 0, R, maxDepth))
  }
  return out
}

export function predictForest(forest: Forest, F: Float32Array[], i: number): number {
  let s = 0
  for (const root of forest) {
    let n = root
    while (n.f >= 0) n = F[n.f][i] <= n.t ? n.l! : n.r!
    s += n.p
  }
  return s / forest.length
}

/* ---------- métricas da matriz de confusão ---------- */

export function metricas(vp: number, fn: number, fp: number, vn: number) {
  const n = vp + fn + fp + vn || 1
  const acc = (vp + vn) / n
  const prec = vp / (vp + fp || 1)
  const rec = vp / (vp + fn || 1)
  const f1 = (2 * prec * rec) / (prec + rec || 1)
  const pe = ((vp + fn) * (vp + fp) + (fp + vn) * (fn + vn)) / (n * n)
  const kappa = (acc - pe) / (1 - pe || 1)
  const mcc = (vp * vn - fp * fn) / Math.sqrt((vp + fp) * (vp + fn) * (vn + fp) * (vn + fn) || 1)
  return { acc, prec, rec, f1, kappa, mcc }
}

export function confusao(pred: ArrayLike<number>, truth: ArrayLike<number>, idx?: number[]) {
  let vp = 0, fn = 0, fp = 0, vn = 0
  const it = idx ?? Array.from({ length: truth.length }, (_, i) => i)
  for (const i of it) {
    const p = pred[i] ? 1 : 0, t = truth[i] ? 1 : 0
    if (t && p) vp++
    else if (t) fn++
    else if (p) fp++
    else vn++
  }
  return { vp, fn, fp, vn }
}

/* =====================================================================
   CASO 6 · Folhas de laranjeira e mapa de infestação (Schenatto, 2011 · TCC UTFPR Medianeira)
   ===================================================================== */

export type LuzFolha = 'duas fluorescentes (como no TCC)' | 'sol lateral, sem controle'

/** HLS no padrão do OpenCV: H 0–179, L 0–255, S 0–255 */
export function rgb2hls(r: number, g: number, b: number): [number, number, number] {
  const [H] = rgb2hsv(r, g, b)
  const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255
  const L = (mx + mn) / 2
  const S = mx === mn ? 0 : L < 0.5 ? (mx - mn) / (mx + mn) : (mx - mn) / (2 - mx - mn)
  return [H / 2, L * 255, S * 255]
}

export function makeLaranjeira(seed: number, sev: number, luz: LuzFolha): { rgb: RGB; folha: Mask; lesao: Mask; severidade: number } {
  const w = 360, h = 240
  const R = rng(seed)
  const rot = (R() - 0.5) * 0.6
  const cx = 180, cy = 120, L = 300, Wd = 132
  const les = Array.from({ length: Math.round(3 + sev * 40) }, () => ({ u: (R() * 1.7 - 0.85) * (L / 2), v: (R() * 1.6 - 0.8), r: 2.5 + R() * (3 + sev * 5) }))
  const folha: Mask = { w, h, data: new Uint8Array(w * h) }
  const lesao: Mask = { w, h, data: new Uint8Array(w * h) }
  const img = paint(w, h, (x, y) => {
    const i = y * w + x
    const dx = x - cx, dy = y - cy
    const U = dx * Math.cos(rot) + dy * Math.sin(rot), V = -dx * Math.sin(rot) + dy * Math.cos(rot)
    const un = U / (L / 2)
    // fundo claro e contrastante, como o ambiente de captura do TCC
    let c: [number, number, number] = [236, 236, 232]
    let lum = 1
    if (luz === 'sol lateral, sem controle') lum = 0.72 + 0.4 * (x / w) - 0.15 * (y / h)
    if (un > -1 && un < 1) {
      const hw = (Wd / 2) * Math.pow(1 - un * un, 0.62) * (1 - 0.12 * un)
      if (Math.abs(V) < hw) {
        folha.data[i] = 1
        const n = smoothNoise(x / 7, y / 7, seed + 3, 2)
        const vein = Math.abs(V) < 1.2 ? 0.12 : 0
        c = hsv2rgb(104 + 6 * n, 0.72, 0.36 + 0.08 * n + vein)
        // brilho da cutícula cerosa
        const g = Math.exp(-(((U + 40) / 70) ** 2 + ((V + hw * 0.3) / 18) ** 2))
        c = [c[0] + 70 * g, c[1] + 70 * g, c[2] + 70 * g]
        for (const l of les) {
          const d = Math.hypot(U - l.u, V - l.v * hw)
          if (d < l.r * 1.8 && d >= l.r) c = hsv2rgb(52, 0.7, 0.66) // halo amarelo
          if (d < l.r) {
            c = hsv2rgb(28, 0.62, 0.34 + 0.1 * smoothNoise(x / 2, y / 2, seed + 5, 1)) // lesão marrom
            lesao.data[i] = 1
          }
          if (d < l.r * 1.8) lesao.data[i] = 1
        }
      } else if (luz === 'sol lateral, sem controle' && Math.abs(V) < hw + 9 && V > 0) lum *= 0.62 // sombra da folha
    }
    return [c[0] * lum, c[1] * lum, c[2] * lum]
  })
  addNoiseRGB(img, 3, seed + 7)
  let a = 0, b = 0
  for (let i = 0; i < w * h; i++) {
    a += folha.data[i]
    b += lesao.data[i]
  }
  return { rgb: img, folha, lesao, severidade: (100 * b) / (a || 1) }
}

export function laranjeiraPipeline(img: RGB, tL: number, tH: number, morf: boolean) {
  const { w, h } = img
  const Lc = newGray(w, h), Hc = newGray(w, h)
  for (let i = 0; i < w * h; i++) {
    const [H, L] = rgb2hls(img.data[i * 3], img.data[i * 3 + 1], img.data[i * 3 + 2])
    Lc.data[i] = L
    Hc.data[i] = H
  }
  let folha: Mask = { w, h, data: new Uint8Array(w * h) }
  for (let i = 0; i < w * h; i++) folha.data[i] = Lc.data[i] < tL ? 1 : 0
  if (morf) folha = opening(folha, 'disco', 2)
  // a folha fica com buracos nas lesões claras: fecha-se pelo maior componente preenchido
  const lab = label(folha)
  const maior = lab.blobs.reduce((a, b) => (b.area > (a?.area ?? 0) ? b : a), lab.blobs[0])
  const soFolha: Mask = { w, h, data: new Uint8Array(w * h) }
  if (maior) {
    for (let y = maior.y0; y <= maior.y1; y++) {
      let first = -1, last = -1
      for (let x = maior.x0; x <= maior.x1; x++)
        if (lab.labels[y * w + x] === maior.id) {
          if (first < 0) first = x
          last = x
        }
      if (first >= 0) for (let x = first; x <= last; x++) soFolha.data[y * w + x] = 1
    }
  }
  let lesao: Mask = { w, h, data: new Uint8Array(w * h) }
  for (let i = 0; i < w * h; i++) lesao.data[i] = soFolha.data[i] && Hc.data[i] < tH ? 1 : 0
  if (morf) lesao = opening(lesao, 'disco', 1)
  let a = 0, b = 0
  for (let i = 0; i < w * h; i++) {
    a += soFolha.data[i]
    b += lesao.data[i]
  }
  const manchas = label(lesao).blobs.filter((x) => x.area > 6).length
  return { L: Lc, H: Hc, folha: soFolha, lesao, severidade: (100 * b) / (a || 1), manchas }
}

/* ---------- pomar de 1,49 ha com 36 pontos amostrais e interpolação ---------- */

export const POMAR = { w: 150, h: 100 } // metros (≈ 1,5 ha)
export type Ponto = { x: number; y: number; z: number }

/** infestação "verdadeira" no pomar: um foco que se espalha a partir de um canto */
export function infestacaoReal(x: number, y: number, seed: number) {
  const foco = 38 * Math.exp(-((x - 118) ** 2 + (y - 72) ** 2) / (2 * 30 * 30))
  const foco2 = 16 * Math.exp(-((x - 30) ** 2 + (y - 22) ** 2) / (2 * 18 * 18))
  return 3 + foco + foco2 + 6 * (smoothNoise(x / 25, y / 25, seed, 2) - 0.5)
}

export function amostrasPomar(seed: number): Ponto[] {
  const R = rng(seed)
  const pts: Ponto[] = []
  for (let j = 0; j < 6; j++)
    for (let i = 0; i < 6; i++) {
      const x = 12 + i * 25 + (R() - 0.5) * 8, y = 9 + j * 16.5 + (R() - 0.5) * 6
      // média de quatro folhas sorteadas na planta do ponto, como no TCC
      let z = 0
      for (let k = 0; k < 4; k++) z += Math.max(0, infestacaoReal(x, y, seed) * (0.6 + 0.8 * R()))
      pts.push({ x, y, z: z / 4 })
    }
  return pts
}

export type Interpolador = 'IDP (inverso da distância)' | 'MM (média móvel)'

export function interpolar(pts: Ponto[], metodo: Interpolador, p: number, raio: number, pixel: number) {
  const w = Math.ceil(POMAR.w / pixel), h = Math.ceil(POMAR.h / pixel)
  const g = newGray(w, h)
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const x = (i + 0.5) * pixel, y = (j + 0.5) * pixel
      let num = 0, den = 0
      for (const q of pts) {
        const d = Math.hypot(x - q.x, y - q.y)
        if (d > raio) continue
        if (d < 1e-6) {
          num = q.z
          den = 1
          break
        }
        const wgt = metodo === 'MM (média móvel)' ? 1 : 1 / Math.pow(d, p)
        num += wgt * q.z
        den += wgt
      }
      g.data[j * w + i] = den ? num / den : NaN
    }
  return { g, w, h }
}
