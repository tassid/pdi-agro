// Detecção de objetos: caixas, IoU, NMS, métricas (P, R, AP, mAP), rastreamento
// e um gerador de cenas de pasto vistas de drone com a verdade de campo.
import { type RGB, newRGB, clamp, rng, smoothNoise } from './img'

/* ---------- caixas ---------- */

export type Box = { x0: number; y0: number; x1: number; y1: number }
export type Det = Box & { conf: number; cls: number; gt?: number } // gt: de qual objeto a caixa simulada nasceu (-1 = fundo)

export const area = (b: Box) => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0)

export function inter(a: Box, b: Box): Box | null {
  const x0 = Math.max(a.x0, b.x0), y0 = Math.max(a.y0, b.y0)
  const x1 = Math.min(a.x1, b.x1), y1 = Math.min(a.y1, b.y1)
  return x1 > x0 && y1 > y0 ? { x0, y0, x1, y1 } : null
}

export function iou(a: Box, b: Box): number {
  const i = inter(a, b)
  if (!i) return 0
  const ai = area(i)
  return ai / (area(a) + area(b) - ai)
}

/** formato YOLO: classe cx cy w h, tudo normalizado pelo tamanho da imagem */
export function toYolo(b: Box, W: number, H: number) {
  return { cx: (b.x0 + b.x1) / 2 / W, cy: (b.y0 + b.y1) / 2 / H, w: (b.x1 - b.x0) / W, h: (b.y1 - b.y0) / H }
}
export function fromYolo(cx: number, cy: number, w: number, h: number, W: number, H: number): Box {
  return { x0: (cx - w / 2) * W, y0: (cy - h / 2) * H, x1: (cx + w / 2) * W, y1: (cy + h / 2) * H }
}
export const yoloLine = (cls: number, b: Box, W: number, H: number) => {
  const y = toYolo(b, W, H)
  return `${cls} ${y.cx.toFixed(6)} ${y.cy.toFixed(6)} ${y.w.toFixed(6)} ${y.h.toFixed(6)}`
}

/* ---------- NMS ---------- */

export type NmsStep = { keep: number; suppressed: number[] } // índices em dets ordenadas

/** NMS guloso: ordena por confiança, guarda a melhor, apaga as que se sobrepõem acima do limiar.
 * Devolve as caixas mantidas e o passo a passo (para a animação). */
export function nms(dets: Det[], iouThr: number, classAware = true): { kept: Det[]; order: Det[]; steps: NmsStep[] } {
  const order = [...dets].sort((a, b) => b.conf - a.conf)
  const dead = new Uint8Array(order.length)
  const kept: Det[] = [], steps: NmsStep[] = []
  for (let i = 0; i < order.length; i++) {
    if (dead[i]) continue
    kept.push(order[i])
    const sup: number[] = []
    for (let j = i + 1; j < order.length; j++) {
      if (dead[j]) continue
      if (classAware && order[j].cls !== order[i].cls) continue
      if (iou(order[i], order[j]) > iouThr) {
        dead[j] = 1
        sup.push(j)
      }
    }
    steps.push({ keep: i, suppressed: sup })
  }
  return { kept, order, steps }
}

/* ---------- avaliação ---------- */

export type Match = { det: Det; tp: boolean; gt: number } // gt casado (-1 = falso positivo)

/** casa as detecções de UMA imagem com a verdade (guloso por confiança, cada objeto só uma vez) */
export function matchImage(dets: Det[], gts: Box[], iouThr: number): { matches: Match[]; fn: number[] } {
  const order = [...dets].sort((a, b) => b.conf - a.conf)
  const used = new Uint8Array(gts.length)
  const matches: Match[] = []
  for (const d of order) {
    let best = -1, bi = iouThr
    for (let g = 0; g < gts.length; g++) {
      if (used[g]) continue
      const v = iou(d, gts[g])
      if (v >= bi) {
        bi = v
        best = g
      }
    }
    if (best >= 0) used[best] = 1
    matches.push({ det: d, tp: best >= 0, gt: best })
  }
  const fn: number[] = []
  for (let g = 0; g < gts.length; g++) if (!used[g]) fn.push(g)
  return { matches, fn }
}

export type PR = { p: number[]; r: number[]; conf: number[]; ap: number; nGt: number }

/** curva precisão × revocação de um conjunto de imagens e AP (área sob o envelope de precisão,
 * amostrado em 101 pontos de revocação, como no COCO e no ultralytics) */
export function prCurve(imgs: { dets: Det[]; gts: Box[] }[], iouThr: number): PR {
  const all: { conf: number; tp: boolean }[] = []
  let nGt = 0
  for (const im of imgs) {
    nGt += im.gts.length
    for (const m of matchImage(im.dets, im.gts, iouThr).matches) all.push({ conf: m.det.conf, tp: m.tp })
  }
  all.sort((a, b) => b.conf - a.conf)
  const p: number[] = [], r: number[] = [], conf: number[] = []
  let tp = 0, fp = 0
  for (const d of all) {
    if (d.tp) tp++
    else fp++
    p.push(tp / (tp + fp))
    r.push(nGt ? tp / nGt : 0)
    conf.push(d.conf)
  }
  // envelope: precisão máxima à direita
  const env = [...p]
  for (let i = env.length - 2; i >= 0; i--) env[i] = Math.max(env[i], env[i + 1])
  let ap = 0
  for (let k = 0; k <= 100; k++) {
    const rr = k / 100
    let v = 0
    for (let i = 0; i < r.length; i++)
      if (r[i] >= rr) {
        v = env[i]
        break
      }
    ap += v / 101
  }
  return { p, r, conf, ap, nGt }
}

export const IOU_COCO = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95]

export function opPoint(imgs: { dets: Det[]; gts: Box[] }[], iouThr: number, confThr: number) {
  let tp = 0, fp = 0, fn = 0, cont = 0, verd = 0, absErr = 0
  for (const im of imgs) {
    const ds = im.dets.filter((d) => d.conf >= confThr)
    const m = matchImage(ds, im.gts, iouThr)
    const t = m.matches.filter((x) => x.tp).length
    tp += t
    fp += ds.length - t
    fn += m.fn.length
    cont += ds.length
    verd += im.gts.length
    absErr += Math.abs(ds.length - im.gts.length)
  }
  const P = tp + fp ? tp / (tp + fp) : 1, R = tp + fn ? tp / (tp + fn) : 0
  return { tp, fp, fn, P, R, F1: P + R ? (2 * P * R) / (P + R) : 0, contados: cont, verdade: verd, erroMedio: absErr / Math.max(1, imgs.length) }
}

/* ---------- cena: pasto visto de drone ---------- */

export type Fazenda = 'A · nelore em pasto verde' | 'B · gado escuro, solo exposto e cupinzeiros'
export type Arranjo = 'espalhado' | 'aglomerado no cocho'
export type Animal = { x: number; y: number; a: number; b: number; ang: number; cor: [number, number, number]; escuro: boolean; bezerro: boolean; sombraArvore: boolean }
export type Pasto = { img: RGB; w: number; h: number; animais: Animal[]; gts: Box[]; inst: Int16Array; cupins: { x: number; y: number; r: number }[]; arvores: { x: number; y: number; r: number }[] }

export const PW = 360, PH = 240

function animalBox(a: Animal): Box {
  const ca = Math.cos(a.ang), sa = Math.sin(a.ang)
  // elipse do corpo + cabeça à frente (ponta em 1,35·a)
  const hx = Math.sqrt((a.a * 1.35 * ca) ** 2 + (a.b * sa) ** 2)
  const hy = Math.sqrt((a.a * 1.35 * sa) ** 2 + (a.b * ca) ** 2)
  return { x0: a.x - hx, y0: a.y - hy, x1: a.x + hx, y1: a.y + hy }
}

/** gera a cena e a verdade de campo. Deterministico pela semente. */
export function makePasto(seed: number, fazenda: Fazenda, arranjo: Arranjo = 'espalhado', n = 16): Pasto {
  const R = rng(seed * 7919 + (fazenda[0] === 'B' ? 101 : 0) + (arranjo === 'espalhado' ? 0 : 53))
  const w = PW, h = PH
  const B = fazenda[0] === 'B'
  const arvores: Pasto['arvores'] = []
  const nArv = 1 + Math.floor(R() * 2)
  for (let k = 0; k < nArv; k++) arvores.push({ x: 30 + R() * (w - 60), y: 30 + R() * (h - 60), r: 20 + R() * 10 })
  const cupins: Pasto['cupins'] = []
  const nCup = B ? 9 + Math.floor(R() * 4) : 3 + Math.floor(R() * 2)
  const animais: Animal[] = []
  const cocho = { x: 70 + R() * (w - 140), y: 60 + R() * (h - 120) }
  const novo = (): Animal | null => {
    for (let t = 0; t < 400; t++) {
      const x = arranjo === 'espalhado' ? 14 + R() * (w - 28) : cocho.x + (R() - 0.5) * 70
      const y = arranjo === 'espalhado' ? 14 + R() * (h - 28) : cocho.y + (R() - 0.5) * 46
      if (x < 12 || y < 12 || x > w - 12 || y > h - 12) continue
      const bez = R() < 0.18
      const a = (bez ? 5.2 : 8) + R() * 1.2, b = (bez ? 2.6 : 3.6) + R() * 0.6
      const minD = arranjo === 'espalhado' ? 20 : 7.5
      if (animais.some((o) => Math.hypot(o.x - x, o.y - y) < minD)) continue
      const ang = arranjo === 'espalhado' ? R() * Math.PI * 2 : Math.atan2(cocho.y - y, cocho.x - x) + (R() - 0.5) * 0.6
      const escuro = B ? R() < 0.6 : R() < 0.06
      const cor: [number, number, number] = escuro ? (R() < 0.5 ? [58, 40, 30] : [44, 38, 36]) : [222 + R() * 18, 218 + R() * 16, 206 + R() * 16]
      const sombraArvore = arvores.some((ar) => Math.hypot(ar.x - x, ar.y - y) < ar.r * 0.85)
      return { x, y, a, b, ang, cor, escuro, bezerro: bez, sombraArvore }
    }
    return null
  }
  for (let k = 0; k < n; k++) {
    const an = novo()
    if (an) animais.push(an)
  }
  for (let k = 0; k < nCup; k++) {
    for (let t = 0; t < 200; t++) {
      const x = 10 + R() * (w - 20), y = 10 + R() * (h - 20)
      if (animais.some((o) => Math.hypot(o.x - x, o.y - y) < 14)) continue
      cupins.push({ x, y, r: 3.6 + R() * 1.6 })
      break
    }
  }
  const img = newRGB(w, h)
  const inst = new Int16Array(w * h).fill(-1)
  const sun = { dx: B ? 3.2 : 2.2, dy: B ? 2.4 : 1.6 } // sombra projetada
  const ns = seed + (B ? 500 : 0)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      // capim: verde com manchas secas; na fazenda B, solo vermelho aparecendo
      const n1 = smoothNoise(x / 40, y / 40, ns, 3), n2 = smoothNoise(x / 6, y / 6, ns + 9, 2)
      const seco = clamp((smoothNoise(x / 70, y / 70, ns + 3, 2) - (B ? 0.35 : 0.55)) * 3, 0, 1)
      let c: [number, number, number] = [
        78 + 40 * n1 + 18 * n2 + seco * 70,
        118 + 36 * n1 + 20 * n2 + seco * 30,
        52 + 18 * n1 + 8 * n2 + seco * 10,
      ]
      if (B) {
        const solo = clamp((smoothNoise(x / 30, y / 30, ns + 21, 3) - 0.6) * 5, 0, 1)
        c = [c[0] * (1 - solo) + 150 * solo, c[1] * (1 - solo) + 74 * solo, c[2] * (1 - solo) + 48 * solo]
      }
      // sombra de árvore e copa
      for (const ar of arvores) {
        const d = Math.hypot(x - ar.x - sun.dx * 4, y - ar.y - sun.dy * 4)
        if (d < ar.r) c = [c[0] * 0.55, c[1] * 0.58, c[2] * 0.6]
      }
      // cupinzeiros (o falso positivo clássico)
      for (const cp of cupins) {
        const ds = Math.hypot(x - cp.x - sun.dx, y - cp.y - sun.dy)
        if (ds < cp.r) c = [c[0] * 0.6, c[1] * 0.62, c[2] * 0.65]
        const d = Math.hypot(x - cp.x, y - cp.y)
        if (d < cp.r) {
          const sh = 1 - 0.35 * (d / cp.r) ** 2
          c = B ? [138 * sh, 98 * sh, 72 * sh] : [176 * sh, 160 * sh, 132 * sh]
        }
      }
      // animais: sombra primeiro, depois corpo e cabeça
      for (let k = 0; k < animais.length; k++) {
        const an = animais[k]
        const dx0 = x - an.x, dy0 = y - an.y
        if (Math.abs(dx0) > 16 || Math.abs(dy0) > 16) continue
        const ca = Math.cos(an.ang), sa = Math.sin(an.ang)
        const sx = dx0 - sun.dx, sy = dy0 - sun.dy
        const su = (sx * ca + sy * sa) / an.a, sv = (-sx * sa + sy * ca) / an.b
        if (su * su + sv * sv < 1) c = [c[0] * 0.55, c[1] * 0.57, c[2] * 0.6]
      }
      for (let k = 0; k < animais.length; k++) {
        const an = animais[k]
        const dx = x - an.x, dy = y - an.y
        if (Math.abs(dx) > 16 || Math.abs(dy) > 16) continue
        const ca = Math.cos(an.ang), sa = Math.sin(an.ang)
        const u = (dx * ca + dy * sa) / an.a, v = (-dx * sa + dy * ca) / an.b
        const r2 = u * u + v * v
        const hu = (dx * ca + dy * sa - an.a * 1.1) / (an.a * 0.3), hv = (-dx * sa + dy * ca) / (an.b * 0.55)
        const cabeca = hu * hu + hv * hv < 1
        if (r2 < 1 || cabeca) {
          const sh = cabeca ? 0.92 : 1 - 0.22 * r2 + (an.escuro ? 0 : 0.04)
          let cc: [number, number, number] = [an.cor[0] * sh, an.cor[1] * sh, an.cor[2] * sh]
          if (!an.escuro && !cabeca && u > -0.1 && u < 0.35 && Math.abs(v) < 0.45) cc = [cc[0] * 0.93, cc[1] * 0.92, cc[2] * 0.9] // cupim do nelore
          if (an.sombraArvore) cc = [cc[0] * 0.5, cc[1] * 0.52, cc[2] * 0.55]
          c = cc
          inst[i] = k
        }
      }
      // copa da árvore por cima de tudo (oclusão)
      for (const ar of arvores) {
        const d = Math.hypot(x - ar.x, y - ar.y)
        if (d < ar.r * 0.8) {
          const t = smoothNoise(x / 5, y / 5, ns + 40, 2)
          if (d < ar.r * 0.62 || t > 0.45) {
            c = [34 + 30 * t, 72 + 34 * t, 30 + 14 * t]
            inst[i] = -1
          }
        }
      }
      img.data[i * 3] = clamp(c[0] + (R() - 0.5) * 6)
      img.data[i * 3 + 1] = clamp(c[1] + (R() - 0.5) * 6)
      img.data[i * 3 + 2] = clamp(c[2] + (R() - 0.5) * 6)
    }
  const gts = animais.map(animalBox).map((b) => ({ x0: clamp(b.x0, 0, w), y0: clamp(b.y0, 0, h), x1: clamp(b.x1, 0, w), y1: clamp(b.y1, 0, h) }))
  return { img, w, h, animais, gts, inst, cupins, arvores }
}

/* ---------- detector simulado ----------
 * Não é uma rede de verdade: imita a SAÍDA BRUTA de um YOLO treinado na fazenda A
 * (várias caixas por animal, confiança menor sob a copa, confusão com cupinzeiro,
 * dificuldade com gado escuro que o modelo nunca viu). NMS e métricas são calculados de verdade. */
export function simDetector(p: Pasto, seed: number): Det[] {
  const R = rng(seed * 31 + 7)
  const g = () => {
    // normal aproximada
    let s = 0
    for (let k = 0; k < 4; k++) s += R()
    return (s - 2) / 0.577
  }
  const dets: Det[] = []
  p.animais.forEach((an, k) => {
    const gt = p.gts[k]
    const bw = gt.x1 - gt.x0, bh = gt.y1 - gt.y0
    let vis = 0.95
    if (an.sombraArvore) vis = 0.45
    if (an.escuro) vis = Math.min(vis, 0.3)
    if (an.bezerro) vis *= 0.85
    const vizinhos = p.animais.filter((o, j) => j !== k && Math.hypot(o.x - an.x, o.y - an.y) < 13).length
    vis *= 1 - 0.08 * Math.min(3, vizinhos)
    // erro sistemático do modelo para este animal (a caixa "central") e candidatas vizinhas em volta dela
    const ccx = (gt.x0 + gt.x1) / 2 + g() * 0.06 * bw, ccy = (gt.y0 + gt.y1) / 2 + g() * 0.06 * bh
    const cw = bw * (1 + g() * 0.08), ch = bh * (1 + g() * 0.08)
    const nCand = 3 + Math.floor(R() * 4)
    for (let c = 0; c < nCand; c++) {
      const j = c === 0 ? 0 : 0.02 + 0.012 * c
      const cx = ccx + g() * j * bw, cy = ccy + g() * j * bh
      const sw = cw * (1 + g() * j), sh = ch * (1 + g() * j)
      const conf = clamp(vis * (c === 0 ? 0.95 : 0.8 - 0.12 * c) + g() * 0.05, 0.01, 0.99)
      dets.push({ x0: cx - sw / 2, y0: cy - sh / 2, x1: cx + sw / 2, y1: cy + sh / 2, conf, cls: 0, gt: k })
    }
  })
  // cupinzeiro: parece um bovino pequeno visto de cima
  for (const cp of p.cupins) {
    const k = 1 + Math.floor(R() * 2)
    for (let c = 0; c < k; c++) {
      const s = cp.r * (2.2 + R() * 0.8)
      const cx = cp.x + g() * 1.2, cy = cp.y + g() * 1.2
      dets.push({ x0: cx - s / 2, y0: cy - s / 2.4, x1: cx + s / 2, y1: cy + s / 2.4, conf: clamp((p.cupins.length > 6 ? 0.3 : 0.16) + R() * 0.3 - c * 0.12, 0.01, 0.99), cls: 0, gt: -1 })
    }
  }
  // ruído de fundo com confiança baixa
  for (let k = 0; k < 18; k++) {
    const s = 8 + R() * 14
    const cx = R() * p.w, cy = R() * p.h
    dets.push({ x0: cx - s / 2, y0: cy - s / 3, x1: cx + s / 2, y1: cy + s / 3, conf: 0.01 + R() * R() * 0.24, cls: 0, gt: -1 })
  }
  return dets
}

/* ---------- rastreamento simples por IoU (para contar animais passando no brete) ---------- */

export type Track = { id: number; box: Box; vx: number; vy: number; age: number; hits: number; hist: { x: number; y: number }[] }

const shift = (b: Box, dx: number, dy: number): Box => ({ x0: b.x0 + dx, y0: b.y0 + dy, x1: b.x1 + dx, y1: b.y1 + dy })
const cen = (b: Box) => ({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 })

/** um passo de um rastreador simples: prevê cada trilha com velocidade constante (o papel do filtro de Kalman
 * no ByteTrack/SORT), casa com as detecções pelo maior IoU e mantém trilhas sem par por até maxAge quadros */
export function trackStep(tracks: Track[], dets: Box[], iouThr: number, maxAge: number, nextId: { v: number }): Track[] {
  const pred = tracks.map((t) => shift(t.box, t.vx * (t.age + 1), t.vy * (t.age + 1)))
  const pares: { t: number; d: number; v: number }[] = []
  pred.forEach((pb, ti) =>
    dets.forEach((d, di) => {
      const v = iou(pb, d)
      if (v >= iouThr) pares.push({ t: ti, d: di, v })
    }),
  )
  pares.sort((a, b) => b.v - a.v)
  const tUsed = new Uint8Array(tracks.length), dUsed = new Uint8Array(dets.length)
  const out: Track[] = []
  for (const p of pares) {
    if (tUsed[p.t] || dUsed[p.d]) continue
    tUsed[p.t] = 1
    dUsed[p.d] = 1
    const t = tracks[p.t], d = dets[p.d]
    const c0 = cen(t.box), c1 = cen(d), k = t.age + 1
    const vx = t.hits > 1 ? 0.6 * t.vx + 0.4 * ((c1.x - c0.x) / k) : (c1.x - c0.x) / k
    const vy = t.hits > 1 ? 0.6 * t.vy + 0.4 * ((c1.y - c0.y) / k) : (c1.y - c0.y) / k
    out.push({ ...t, box: d, vx, vy, age: 0, hits: t.hits + 1, hist: [...t.hist.slice(-40), c1] })
  }
  tracks.forEach((t, ti) => {
    if (!tUsed[ti] && t.age + 1 <= maxAge) out.push({ ...t, age: t.age + 1 })
  })
  dets.forEach((d, di) => {
    if (!dUsed[di]) out.push({ id: nextId.v++, box: d, vx: 0, vy: 0, age: 0, hits: 1, hist: [cen(d)] })
  })
  return out
}
