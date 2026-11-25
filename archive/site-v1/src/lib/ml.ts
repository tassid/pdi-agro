// Reconhecimento de padrões clássico: extração de características + classificadores simples.

import { type RGB, rgb2hsv, rng } from './img'
import { makePatch, type Doenca } from './synth'

/* ---------- descritores de um recorte de folha ---------- */

export const FEATURES = [
  { id: 'matiz', nome: 'Matiz média (H)', unid: '°' },
  { id: 'sat', nome: 'Saturação média (S)', unid: '' },
  { id: 'brilho', nome: 'Brilho médio (V)', unid: '' },
  { id: 'lesao', nome: '% de pixels marrons', unid: '%' },
  { id: 'contraste', nome: 'Contraste GLCM', unid: '' },
  { id: 'desvio', nome: 'Desvio-padrão do cinza', unid: '' },
] as const
export type FeatureId = (typeof FEATURES)[number]['id']

export function extract(img: RGB): Record<FeatureId, number> {
  const n = img.w * img.h
  let sh = 0, ss = 0, sv = 0, brown = 0, sg = 0, sgg = 0
  const q = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const r = img.data[i * 3], g = img.data[i * 3 + 1], b = img.data[i * 3 + 2]
    const [h, s, v] = rgb2hsv(r, g, b)
    sh += h
    ss += s
    sv += v
    if (h > 8 && h < 42 && v < 0.62 && s > 0.3) brown++
    const gray = 0.299 * r + 0.587 * g + 0.114 * b
    sg += gray
    sgg += gray * gray
    q[i] = Math.min(15, Math.floor(gray / 16))
  }
  // matriz de co-ocorrência (deslocamento horizontal de 1 pixel), 16 níveis
  let contraste = 0, pares = 0
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w - 1; x++) {
      const a = q[y * img.w + x], b = q[y * img.w + x + 1]
      contraste += (a - b) * (a - b)
      pares++
    }
  const mg = sg / n
  return {
    matiz: sh / n,
    sat: ss / n,
    brilho: sv / n,
    lesao: (100 * brown) / n,
    contraste: contraste / pares,
    desvio: Math.sqrt(Math.max(0, sgg / n - mg * mg)),
  }
}

/* ---------- conjunto de dados sintético com "efeito fazenda" ---------- */

export const CLASSES_ML: Doenca[] = ['sadia', 'ferrugem', 'clorose']
export type Sample = { img: RGB; y: number; fazenda: number; folha: number; f: Record<FeatureId, number> }

export const FAZENDAS = [
  { nome: 'Fazenda A (celular, sol)', brilho: 1.12, tom: [1.04, 1.02, 0.9] as [number, number, number] },
  { nome: 'Fazenda B (câmera, nublado)', brilho: 0.86, tom: [0.94, 1.0, 1.1] as [number, number, number] },
  { nome: 'Fazenda C (celular, fim de tarde)', brilho: 0.98, tom: [1.14, 0.98, 0.82] as [number, number, number] },
  { nome: 'Fazenda D (drone baixo)', brilho: 1.0, tom: [0.98, 1.06, 1.0] as [number, number, number] },
]

export function makeDataset(seed = 5, folhasPorClasse = 8, fotosPorFolha = 3, efeito = 1): Sample[] {
  const R = rng(seed)
  const out: Sample[] = []
  let folhaId = 0
  FAZENDAS.forEach((fz, fi) => {
    CLASSES_ML.forEach((c, ci) => {
      for (let k = 0; k < folhasPorClasse; k++) {
        folhaId++
        const sev = 0.25 + 0.6 * R()
        const leafSeed = Math.floor(R() * 1e6)
        for (let p = 0; p < fotosPorFolha; p++) {
          const br = 1 + (fz.brilho - 1) * efeito + (R() - 0.5) * 0.05
          const tom = fz.tom.map((t) => 1 + (t - 1) * efeito) as [number, number, number]
          // fotos da mesma folha: mesma semente de lesões, pequena variação de enquadramento
          const img = makePatch(32, leafSeed + p * 3, { doenca: c, severidade: sev, brilho: br, tom })
          out.push({ img, y: ci, fazenda: fi, folha: folhaId, f: extract(img) })
        }
      }
    })
  })
  return out
}

/* ---------- classificadores ---------- */

export type Clf = 'k-NN' | 'Mínima distância' | 'Naive Bayes'

type Model = (x: number[]) => number

export function standardize(X: number[][]): { mu: number[]; sd: number[] } {
  const d = X[0].length
  const mu = new Array(d).fill(0), sd = new Array(d).fill(0)
  for (const x of X) for (let j = 0; j < d; j++) mu[j] += x[j] / X.length
  for (const x of X) for (let j = 0; j < d; j++) sd[j] += (x[j] - mu[j]) ** 2 / X.length
  return { mu, sd: sd.map((v) => Math.sqrt(v) || 1) }
}

export function train(clf: Clf, X: number[][], y: number[], nC: number, k = 5): Model {
  const { mu, sd } = standardize(X)
  const Z = X.map((x) => x.map((v, j) => (v - mu[j]) / sd[j]))
  const z = (x: number[]) => x.map((v, j) => (v - mu[j]) / sd[j])
  if (clf === 'k-NN') {
    return (x) => {
      const q = z(x)
      const ds = Z.map((p, i) => [p.reduce((s, v, j) => s + (v - q[j]) ** 2, 0), y[i]])
      ds.sort((a, b) => a[0] - b[0])
      const votes = new Array(nC).fill(0)
      for (let i = 0; i < Math.min(k, ds.length); i++) votes[ds[i][1]] += 1 / (1e-6 + Math.sqrt(ds[i][0]))
      return votes.indexOf(Math.max(...votes))
    }
  }
  const d = X[0].length
  const means = Array.from({ length: nC }, () => new Array(d).fill(0))
  const vars = Array.from({ length: nC }, () => new Array(d).fill(0))
  const cnt = new Array(nC).fill(0)
  Z.forEach((p, i) => {
    cnt[y[i]]++
    p.forEach((v, j) => (means[y[i]][j] += v))
  })
  means.forEach((m, c) => m.forEach((_, j) => (m[j] /= cnt[c] || 1)))
  Z.forEach((p, i) => p.forEach((v, j) => (vars[y[i]][j] += (v - means[y[i]][j]) ** 2)))
  vars.forEach((m, c) => m.forEach((_, j) => (m[j] = m[j] / (cnt[c] || 1) + 1e-3)))
  if (clf === 'Mínima distância') {
    return (x) => {
      const q = z(x)
      let best = 0, bd = Infinity
      means.forEach((m, c) => {
        const dd = m.reduce((s, v, j) => s + (v - q[j]) ** 2, 0)
        if (dd < bd) {
          bd = dd
          best = c
        }
      })
      return best
    }
  }
  const prior = cnt.map((c) => Math.log((c + 1) / (Z.length + nC)))
  return (x) => {
    const q = z(x)
    let best = 0, bl = -Infinity
    for (let c = 0; c < nC; c++) {
      let l = prior[c]
      for (let j = 0; j < d; j++) l += -0.5 * Math.log(2 * Math.PI * vars[c][j]) - (q[j] - means[c][j]) ** 2 / (2 * vars[c][j])
      if (l > bl) {
        bl = l
        best = c
      }
    }
    return best
  }
}

export type CVResult = { acc: number; conf: number[][]; porDobra: number[] }

/** validação cruzada: 'aleatória' (k-fold embaralhado) ou 'por fazenda' (deixa uma fazenda inteira de fora) */
export function crossValidate(
  data: Sample[], feats: FeatureId[], clf: Clf, nC: number, modo: 'aleatória' | 'por fazenda', k = 5, seed = 3,
): CVResult {
  const X = data.map((s) => feats.map((f) => s.f[f]))
  const y = data.map((s) => s.y)
  let fold: number[]
  if (modo === 'por fazenda') fold = data.map((s) => s.fazenda)
  else {
    const R = rng(seed)
    const idx = data.map((_, i) => i).sort(() => R() - 0.5)
    fold = new Array(data.length)
    idx.forEach((i, r) => (fold[i] = r % 4))
  }
  const nF = Math.max(...fold) + 1
  const conf = Array.from({ length: nC }, () => new Array(nC).fill(0))
  const porDobra: number[] = []
  let ok = 0
  for (let f = 0; f < nF; f++) {
    const tr = fold.map((v, i) => (v !== f ? i : -1)).filter((i) => i >= 0)
    const te = fold.map((v, i) => (v === f ? i : -1)).filter((i) => i >= 0)
    const m = train(clf, tr.map((i) => X[i]), tr.map((i) => y[i]), nC, k)
    let okF = 0
    for (const i of te) {
      const p = m(X[i])
      conf[y[i]][p]++
      if (p === y[i]) {
        ok++
        okF++
      }
    }
    porDobra.push(okF / (te.length || 1))
  }
  return { acc: ok / data.length, conf, porDobra }
}
