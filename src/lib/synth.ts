// Imagens sintéticas do agro, geradas por código.
// Assim o site funciona offline e cada aluno pode "sortear" um talhão, uma folha ou uma bandeja de sementes diferente.

import { type RGB, type Gray, type Mask, newRGB, newGray, rng, smoothNoise, clamp, hsv2rgb } from './img'

/* ================= reflectância e bandas ================= */

export type BandName = 'Azul' | 'Verde' | 'Vermelho' | 'RedEdge' | 'NIR'
export const BANDS: { name: BandName; nm: number }[] = [
  { name: 'Azul', nm: 475 },
  { name: 'Verde', nm: 560 },
  { name: 'Vermelho', nm: 668 },
  { name: 'RedEdge', nm: 717 },
  { name: 'NIR', nm: 842 },
]
export type Bands = Record<BandName, Gray> // reflectância 0..1

/** reflectância de dossel em função do vigor v (0 = estressado, 1 = máximo) */
export function vegSpectrum(v: number, weed = false): number[] {
  const q = 1 - v
  const s = [0.03 + 0.02 * q, 0.07 + 0.05 * q, 0.03 + 0.09 * Math.pow(q, 2.2), 0.22 + 0.1 * q, 0.28 + 0.26 * v]
  if (weed) {
    s[1] += 0.03
    s[4] -= 0.05
    s[3] += 0.03
  }
  return s
}
export const SOIL = [0.06, 0.09, 0.16, 0.2, 0.25] // latossolo vermelho (a "terra roxa" do oeste do PR)
export const STRAW = [0.18, 0.24, 0.3, 0.34, 0.38] // palhada do plantio direto

/** converte reflectância para um valor de pixel de exibição */
export const toDisplay = (r: number) => clamp(255 * Math.pow(Math.max(0, r * 2.6), 0.75))

/* ================= talhão visto de cima ================= */

export type FieldOpts = {
  cobertura?: number // 0.4 = plantas jovens, 1.3 = dossel fechado
  daninhas?: number // quantidade de plantas daninhas
  estresse?: number // 0..1: intensidade da mancha de estresse hídrico
  palha?: number // 0..1: quantidade de palhada
  angulo?: number // inclinação das linhas de plantio (graus)
  espacamento?: number // distância entre linhas, em pixels
  passo?: number // distância média entre plantas na linha, em pixels
}

export type FieldScene = { w: number; h: number; rgb: RGB; bands: Bands; classe: Uint8Array; vigor: Float32Array }
// classe: 0 solo, 1 palha, 2 cultura, 3 daninha

export function makeField(w: number, h: number, seed: number, o: FieldOpts = {}): FieldScene {
  const cob = o.cobertura ?? 0.55
  const nWeeds = o.daninhas ?? 30
  const stress = o.estresse ?? 0.6
  const straw = o.palha ?? 0.5
  const ang = ((o.angulo ?? 8) * Math.PI) / 180
  const sp = o.espacamento ?? 24
  const R = rng(seed)

  const frac = new Float32Array(w * h) // fração de vegetação
  const isWeed = new Uint8Array(w * h)
  const vigor = new Float32Array(w * h)
  const classe = new Uint8Array(w * h)

  // campo de vigor: variação suave + mancha de estresse
  const sx = w * (0.25 + 0.5 * R()), sy = h * (0.3 + 0.4 * R()), sr = Math.min(w, h) * (0.22 + 0.1 * R())
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const base = 0.78 + 0.22 * smoothNoise(x / 60, y / 60, seed + 3, 2)
      const d2 = ((x - sx) ** 2 + (y - sy) ** 2) / (sr * sr)
      vigor[y * w + x] = clamp(base - stress * 0.75 * Math.exp(-d2), 0.05, 1)
    }

  const ca = Math.cos(ang), sa = Math.sin(ang)
  const stamp = (cx: number, cy: number, r: number, lobes: number, weed: boolean) => {
    const ph = R() * Math.PI * 2
    const x0 = Math.max(0, Math.floor(cx - r * 1.2)), x1 = Math.min(w - 1, Math.ceil(cx + r * 1.2))
    const y0 = Math.max(0, Math.floor(cy - r * 1.2)), y1 = Math.min(h - 1, Math.ceil(cy + r * 1.2))
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy
        const d = Math.hypot(dx, dy)
        const th = Math.atan2(dy, dx)
        const rr = r * (0.55 + 0.45 * Math.abs(Math.cos((lobes * th) / 2 + ph)))
        const f = clamp(rr - d + 0.5, 0, 1)
        const i = y * w + x
        if (f > frac[i]) {
          frac[i] = f
          isWeed[i] = weed ? 1 : 0
        }
      }
  }

  // linhas de plantio (girar coordenadas para acompanhar a inclinação)
  const diag = Math.hypot(w, h)
  for (let off = -diag; off < diag; off += sp) {
    const passo = o.passo ?? 11
    for (let t = -diag; t < diag; t += passo * (0.8 + R() * 0.4)) {
      const cx = w / 2 + ca * off - sa * t + (R() - 0.5) * 2.5
      const cy = h / 2 + sa * off + ca * t + (R() - 0.5) * 2.5
      if (cx < -20 || cy < -20 || cx > w + 20 || cy > h + 20) continue
      if (R() < 0.06) continue // falha de plantio
      const vi = vigor[Math.min(h - 1, Math.max(0, Math.round(cy))) * w + Math.min(w - 1, Math.max(0, Math.round(cx)))]
      const r = sp * 0.34 * cob * (0.55 + 0.6 * vi) * (0.85 + 0.3 * R())
      stamp(cx, cy, r, 3, false)
    }
  }
  // plantas daninhas, de preferência na entrelinha
  for (let k = 0; k < nWeeds; k++) {
    const off = (Math.floor(R() * (diag / sp)) - diag / sp / 2) * sp + sp / 2
    const t = (R() - 0.5) * diag
    const cx = w / 2 + ca * off - sa * t, cy = h / 2 + sa * off + ca * t
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue
    stamp(cx, cy, 2.5 + R() * 3.5, 7, true)
  }

  // palhada: riscos claros sobre o solo
  const strawMask = new Uint8Array(w * h)
  const nStraw = Math.floor(straw * w * h * 0.004)
  for (let k = 0; k < nStraw; k++) {
    let x = R() * w, y = R() * h
    const a = R() * Math.PI, L = 4 + R() * 10
    for (let s = 0; s < L; s++) {
      x += Math.cos(a)
      y += Math.sin(a)
      const xi = Math.round(x), yi = Math.round(y)
      if (xi >= 0 && yi >= 0 && xi < w && yi < h) strawMask[yi * w + xi] = 1
    }
  }

  const names = BANDS.map((b) => b.name)
  const bands = Object.fromEntries(names.map((n) => [n, newGray(w, h)])) as Bands
  const rgb = newRGB(w, h)
  const R2 = rng(seed + 99)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const tex = 0.85 + 0.3 * smoothNoise(x / 3, y / 3, seed + 11, 2)
      const moist = 0.85 + 0.25 * smoothNoise(x / 40, y / 40, seed + 5, 2)
      const bg = strawMask[i] ? STRAW : SOIL
      const leafTex = 0.88 + 0.24 * smoothNoise(x / 2, y / 2, seed + 21, 1)
      const veg = vegSpectrum(vigor[i], !!isWeed[i])
      const f = frac[i]
      const light = 0.93 + 0.1 * (x / w) // leve gradiente de iluminação
      for (let b = 0; b < 5; b++) {
        const soilV = bg[b] * (strawMask[i] ? 1 : moist) * tex
        const v = (f * veg[b] * leafTex + (1 - f) * soilV) * light
        bands[names[b]].data[i] = clamp(v + (R2() - 0.5) * 0.006, 0, 1)
      }
      classe[i] = f > 0.5 ? (isWeed[i] ? 3 : 2) : strawMask[i] ? 1 : 0
      rgb.data[i * 3] = toDisplay(bands.Vermelho.data[i])
      rgb.data[i * 3 + 1] = toDisplay(bands.Verde.data[i])
      rgb.data[i * 3 + 2] = toDisplay(bands.Azul.data[i])
    }
  return { w, h, rgb, bands, classe, vigor }
}

/* ================= folha de soja ================= */

export type Doenca = 'sadia' | 'ferrugem' | 'mancha-alvo' | 'clorose'
export const DOENCAS: Doenca[] = ['sadia', 'ferrugem', 'mancha-alvo', 'clorose']
export type Fundo = 'claro' | 'solo' | 'escuro'

export type LeafOpts = { doenca?: Doenca; severidade?: number; fundo?: Fundo; rot?: number }
export type Leaf = { rgb: RGB; folha: Mask; lesao: Mask }

function paintLeafTissue(
  x: number, y: number, u: number, v: number, L: number, seed: number,
): [number, number, number] {
  // u: posição ao longo da nervura (px), v: distância lateral (px, com sinal)
  const n = smoothNoise(x / 5, y / 5, seed, 2)
  let val = 0.42 + 0.12 * n
  const sat = 0.62 + 0.1 * smoothNoise(x / 9, y / 9, seed + 1, 1)
  const hue = 98 + 10 * smoothNoise(x / 20, y / 20, seed + 2, 1)
  // nervura central e laterais (mais claras)
  if (Math.abs(v) < 0.9) val += 0.16
  const spacing = Math.max(5, L / 9)
  const phase = (u - Math.abs(v) * 0.9) / spacing
  if (Math.abs(phase - Math.round(phase)) * spacing < 0.55) val += 0.08
  return hsv2rgb(hue, sat, val)
}

export function makeLeaf(w: number, h: number, seed: number, o: LeafOpts = {}): Leaf {
  const doenca = o.doenca ?? 'ferrugem'
  const sev = o.severidade ?? 0.5
  const fundo = o.fundo ?? 'claro'
  const R = rng(seed)
  const rot = o.rot ?? (R() - 0.5) * 0.5
  const L = Math.min(w * 0.88, h * 1.9), Wd = L * 0.46
  const cx = w / 2, cy = h / 2
  const cr = Math.cos(rot), sr = Math.sin(rot)
  const rgb = newRGB(w, h)
  const folha: Mask = { w, h, data: new Uint8Array(w * h) }
  const lesao: Mask = { w, h, data: new Uint8Array(w * h) }

  // lesões pré-sorteadas no sistema de coordenadas da folha (u,v normalizados)
  type Les = { u: number; v: number; r: number }
  const les: Les[] = []
  if (doenca === 'ferrugem') for (let k = 0; k < Math.round(sev * 260); k++) les.push({ u: R() * 2 - 1, v: R() * 2 - 1, r: 0.8 + R() * 1.4 })
  if (doenca === 'mancha-alvo') for (let k = 0; k < Math.round(2 + sev * 14); k++) les.push({ u: R() * 1.6 - 0.8, v: R() * 1.4 - 0.7, r: 3 + R() * (4 + sev * 5) })

  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const dx = x - cx, dy = y - cy
      const U = dx * cr + dy * sr, V = -dx * sr + dy * cr
      const un = U / (L / 2)
      let bgc: [number, number, number]
      if (fundo === 'claro') {
        const g = 226 + 14 * smoothNoise(x / 30, y / 30, seed + 40, 1) - 18 * Math.max(0, 1 - Math.hypot(dx, dy - 4) / (L * 0.55))
        bgc = [g, g - 2, g - 8]
      } else if (fundo === 'escuro') {
        const g = 38 + 12 * smoothNoise(x / 4, y / 4, seed + 41, 2)
        bgc = [g, g + 2, g + 8]
      } else {
        const t = 0.8 + 0.4 * smoothNoise(x / 3, y / 3, seed + 42, 3)
        bgc = [toDisplay(SOIL[2] * t), toDisplay(SOIL[1] * t), toDisplay(SOIL[0] * t)]
      }
      let out = bgc
      if (un > -1 && un < 1) {
        const hw = (Wd / 2) * Math.pow(Math.sin((Math.PI * (un + 1)) / 2), 0.75) * (1 - 0.22 * un)
        const edge = hw - Math.abs(V)
        if (edge > -0.5) {
          const a = clamp(edge + 0.5, 0, 1)
          let c = paintLeafTissue(x, y, U, V, L, seed + 7)
          if (a > 0.5) folha.data[i] = 1
          if (doenca === 'clorose') {
            // amarelecimento entre as nervuras
            const n = smoothNoise(x / 12, y / 12, seed + 9, 2)
            const spacing = Math.max(5, L / 9)
            const ph = (U - Math.abs(V) * 0.9) / spacing
            const nearVein = Math.abs(V) < 1.5 || Math.abs(ph - Math.round(ph)) * spacing < 1.4
            const amt = clamp((n - (1 - sev) * 0.75) * 3, 0, 1) * (nearVein ? 0.25 : 1)
            if (amt > 0.35 && a > 0.5) lesao.data[i] = 1
            const yel = hsv2rgb(52, 0.62, 0.72)
            c = [c[0] + (yel[0] - c[0]) * amt, c[1] + (yel[1] - c[1]) * amt, c[2] + (yel[2] - c[2]) * amt]
          }
          for (const l of les) {
            const lx = l.u * (L / 2), ly = l.v * hw
            const d = Math.hypot(U - lx, V - ly)
            if (doenca === 'ferrugem') {
              if (d < l.r) {
                c = [140 - 20 * (d / l.r), 92 - 15 * (d / l.r), 52]
                if (a > 0.5) lesao.data[i] = 1
              } else if (d < l.r + 1.2) {
                c = [c[0] * 0.75 + 190 * 0.25, c[1] * 0.75 + 170 * 0.25, c[2] * 0.8]
              }
            } else if (doenca === 'mancha-alvo') {
              if (d < l.r) {
                const ring = 0.5 + 0.5 * Math.cos((d / l.r) * Math.PI * 3)
                const br = 88 + 30 * ring
                c = [br, br * 0.68, br * 0.42]
                if (a > 0.5) lesao.data[i] = 1
              } else if (d < l.r * 1.45) {
                const t = 1 - (d - l.r) / (l.r * 0.45)
                c = [c[0] + (200 - c[0]) * t * 0.6, c[1] + (190 - c[1]) * t * 0.6, c[2] * (1 - 0.4 * t)]
              }
            }
          }
          out = [bgc[0] + (c[0] - bgc[0]) * a, bgc[1] + (c[1] - bgc[1]) * a, bgc[2] + (c[2] - bgc[2]) * a]
        }
      }
      rgb.data[i * 3] = clamp(out[0])
      rgb.data[i * 3 + 1] = clamp(out[1])
      rgb.data[i * 3 + 2] = clamp(out[2])
    }
  return { rgb, folha, lesao }
}

/* ================= recorte de tecido foliar (para classificadores) ================= */

export type PatchOpts = {
  doenca: Doenca
  severidade: number
  brilho?: number // multiplicador de iluminação
  tom?: [number, number, number] // balanço de branco da câmera
  fundoCantos?: [number, number, number] | null // se definido, só o círculo central é folha
}

export function makePatch(n: number, seed: number, o: PatchOpts): RGB {
  const R = rng(seed)
  const img = newRGB(n, n)
  const les: { x: number; y: number; r: number }[] = []
  const s = n / 32
  if (o.doenca === 'ferrugem') for (let k = 0; k < Math.round(4 + o.severidade * 22); k++) les.push({ x: R() * n, y: R() * n, r: (0.7 + R() * 0.9) * s })
  if (o.doenca === 'mancha-alvo') for (let k = 0; k < 1 + Math.round(o.severidade * 2); k++) les.push({ x: n * (0.2 + 0.6 * R()), y: n * (0.2 + 0.6 * R()), r: (3 + R() * 4) * s })
  const ang = R() * Math.PI, ca = Math.cos(ang), sa = Math.sin(ang)
  const br = o.brilho ?? 1, tom = o.tom ?? [1, 1, 1]
  const off = R() * 1000
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const i = y * n + x
      const u = x * ca + y * sa, v = -x * sa + y * ca
      let c = paintLeafTissue(x + off, y + off, u, v - n / 2 + (R() - 0.5) * 0.2, n * 1.6, seed)
      if (o.doenca === 'clorose') {
        const t = clamp((smoothNoise((x + off) / (6 * s), (y + off) / (6 * s), seed, 2) - (1 - o.severidade) * 0.6) * 2.5, 0, 1)
        const yel = hsv2rgb(52, 0.62, 0.72)
        c = [c[0] + (yel[0] - c[0]) * t, c[1] + (yel[1] - c[1]) * t, c[2] + (yel[2] - c[2]) * t]
      }
      for (const l of les) {
        const d = Math.hypot(x - l.x, y - l.y)
        if (o.doenca === 'ferrugem' && d < l.r) c = [138, 90, 52]
        if (o.doenca === 'mancha-alvo') {
          if (d < l.r) {
            const ring = 0.5 + 0.5 * Math.cos((d / l.r) * Math.PI * 3)
            const b = 88 + 30 * ring
            c = [b, b * 0.68, b * 0.42]
          } else if (d < l.r * 1.4) c = [c[0] * 0.5 + 100, c[1] * 0.5 + 95, c[2] * 0.6]
        }
      }
      if (o.fundoCantos && Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) > n * 0.42) c = o.fundoCantos
      img.data[i * 3] = clamp(c[0] * br * tom[0] + (R() - 0.5) * 6)
      img.data[i * 3 + 1] = clamp(c[1] * br * tom[1] + (R() - 0.5) * 6)
      img.data[i * 3 + 2] = clamp(c[2] * br * tom[2] + (R() - 0.5) * 6)
    }
  return img
}

/* ================= bandeja de sementes de soja ================= */

export type SeedType = 'inteira' | 'quebrada' | 'manchada'
export type SeedTruth = { x: number; y: number; tipo: SeedType }
export type SeedOpts = { n?: number; quebradas?: number; manchadas?: number; encostadas?: number }

export function makeSeeds(w: number, h: number, seed: number, o: SeedOpts = {}): { rgb: RGB; verdade: SeedTruth[] } {
  const R = rng(seed)
  const n = o.n ?? 40
  const pQ = o.quebradas ?? 0.15, pM = o.manchadas ?? 0.12
  const nTouch = o.encostadas ?? 3
  type S = { x: number; y: number; a: number; b: number; ang: number; tipo: SeedType; cut: number; cutAng: number }
  const seeds: S[] = []
  const mk = (x: number, y: number): S => {
    const u = R()
    const tipo: SeedType = u < pQ ? 'quebrada' : u < pQ + pM ? 'manchada' : 'inteira'
    return { x, y, a: 9.5 + R() * 1.5, b: 7.8 + R() * 1.0, ang: R() * Math.PI, tipo, cut: (R() - 0.3) * 3, cutAng: R() * Math.PI * 2 }
  }
  let tries = 0
  while (seeds.length < n && tries++ < 5000) {
    const x = 14 + R() * (w - 28), y = 14 + R() * (h - 28)
    if (seeds.every((s) => Math.hypot(s.x - x, s.y - y) > s.a + 13)) seeds.push(mk(x, y))
  }
  // algumas encostadas (o pesadelo da contagem por componentes conexos)
  for (let k = 0; k < nTouch && k < seeds.length; k++) {
    const s = seeds[k]
    const a = R() * Math.PI * 2
    const d = s.b + 8
    const x = s.x + Math.cos(a) * d, y = s.y + Math.sin(a) * d
    if (x < 12 || y < 12 || x > w - 12 || y > h - 12) continue
    if (seeds.every((t, j) => j === k || Math.hypot(t.x - x, t.y - y) > t.a + 12)) {
      const ns = mk(x, y)
      ns.tipo = 'inteira'
      seeds.push(ns)
    }
  }
  const rgb = newRGB(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const g = 34 + 10 * smoothNoise(x / 25, y / 25, seed, 2)
      let c: [number, number, number] = [g, g + 4, g + 12]
      for (const s of seeds) {
        const dx = x - s.x, dy = y - s.y
        if (Math.abs(dx) > 14 || Math.abs(dy) > 14) continue
        const ca = Math.cos(s.ang), sa = Math.sin(s.ang)
        const u = (dx * ca + dy * sa) / s.a, v = (-dx * sa + dy * ca) / s.b
        const r2 = u * u + v * v
        if (r2 > 1) continue
        let inside = true
        let cutFace = false
        if (s.tipo === 'quebrada') {
          const proj = dx * Math.cos(s.cutAng) + dy * Math.sin(s.cutAng)
          if (proj > s.cut) inside = false
          else if (proj > s.cut - 2) cutFace = true
        }
        if (!inside) continue
        const shade = 1 - 0.32 * r2 + 0.18 * Math.exp(-((u + 0.35) ** 2 + (v + 0.35) ** 2) * 6)
        c = [220 * shade, 192 * shade, 118 * shade]
        if (cutFace) c = [238, 214, 142]
        if (s.tipo === 'manchada') {
          const m = smoothNoise(x / 4, y / 4, seed + s.x, 2)
          if (m > 0.38) {
            const t = clamp((m - 0.38) * 4, 0, 1)
            c = [c[0] * (1 - t) + 176 * t * shade, c[1] * (1 - t) + 104 * t * shade, c[2] * (1 - t) + 168 * t * shade]
          }
        }
        // hilo
        if (Math.abs(u) < 0.28 && v > 0.62 && v < 0.9 && s.tipo !== 'quebrada') c = [96, 70, 48]
        break
      }
      rgb.data[i * 3] = clamp(c[0] + (R() - 0.5) * 5)
      rgb.data[i * 3 + 1] = clamp(c[1] + (R() - 0.5) * 5)
      rgb.data[i * 3 + 2] = clamp(c[2] + (R() - 0.5) * 5)
    }
  return { rgb, verdade: seeds.map((s) => ({ x: s.x, y: s.y, tipo: s.tipo })) }
}
