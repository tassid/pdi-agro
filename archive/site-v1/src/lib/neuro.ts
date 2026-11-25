// Perceptron de Rosenblatt, uma MLP pequena treinada com Adam e as ferramentas de
// ajuste de hiperparâmetros (parada antecipada, busca em grade e busca aleatória).
import { rng } from './img'

/* ---------- perceptron ---------- */

export type Ponto = { x: number; y: number; c: 0 | 1 }
export type Conjunto = 'AND' | 'OR' | 'XOR' | 'folhas: sadia × ferrugem'

export function dadosPerceptron(qual: Conjunto, seed = 1): Ponto[] {
  const R = rng(seed)
  if (qual === 'folhas: sadia × ferrugem') {
    // x: fração de pixels amarelo-alaranjados (pústulas), y: índice de verde (ExG normalizado)
    const pts: Ponto[] = []
    for (let k = 0; k < 14; k++) pts.push({ x: 0.05 + R() * 0.3, y: 0.55 + R() * 0.38, c: 0 })
    for (let k = 0; k < 14; k++) pts.push({ x: 0.45 + R() * 0.45, y: 0.12 + R() * 0.45, c: 1 })
    return pts
  }
  const t: Record<string, (a: number, b: number) => 0 | 1> = {
    AND: (a, b) => (a && b ? 1 : 0),
    OR: (a, b) => (a || b ? 1 : 0),
    XOR: (a, b) => (a !== b ? 1 : 0),
  }
  return [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ].map(([a, b]) => ({ x: a, y: b, c: t[qual](a, b) }))
}

export type EstadoPerceptron = { w1: number; w2: number; b: number; epoca: number; i: number; erros: number; errosEpoca: number[]; ultimo?: { k: number; previsto: 0 | 1; corrigiu: boolean } }

export const novoPerceptron = (seed = 3): EstadoPerceptron => {
  const R = rng(seed)
  return { w1: R() - 0.5, w2: R() - 0.5, b: R() - 0.5, epoca: 0, i: 0, erros: 0, errosEpoca: [] }
}

export const saidaPerceptron = (s: { w1: number; w2: number; b: number }, x: number, y: number): 0 | 1 => (s.w1 * x + s.w2 * y + s.b >= 0 ? 1 : 0)

/** um passo da regra de Rosenblatt: w ← w + η (alvo − saída) x */
export function passoPerceptron(s: EstadoPerceptron, pts: Ponto[], eta: number): EstadoPerceptron {
  const p = pts[s.i]
  const prev = saidaPerceptron(s, p.x, p.y)
  const e = p.c - prev
  const n = { ...s, w1: s.w1 + eta * e * p.x, w2: s.w2 + eta * e * p.y, b: s.b + eta * e, erros: s.erros + (e !== 0 ? 1 : 0), ultimo: { k: s.i, previsto: prev, corrigiu: e !== 0 } }
  n.i = s.i + 1
  if (n.i >= pts.length) {
    n.errosEpoca = [...s.errosEpoca, n.erros]
    n.erros = 0
    n.i = 0
    n.epoca = s.epoca + 1
  }
  return n
}

/* ---------- MLP 1 → H → 1 (tanh) com Adam ---------- */

export type Amostra = { x: number; y: number }

/** produtividade da soja (sc/ha) a partir do NDVI médio do talhão: curva que satura + ruído de campo */
export const curvaReal = (ndvi: number) => 18 + 52 / (1 + Math.exp(-11 * (ndvi - 0.55)))
export function dadosProdutividade(seed = 7, nTreino = 14, nVal = 40) {
  const R = rng(seed)
  const g = () => {
    let s = 0
    for (let k = 0; k < 6; k++) s += R()
    return (s - 3) / 0.707
  }
  const amostra = (n: number) => Array.from({ length: n }, () => {
    const x = 0.25 + R() * 0.65
    return { x, y: curvaReal(x) + g() * 5 }
  })
  return { treino: amostra(nTreino), val: amostra(nVal) }
}

// normalização fixa para a rede trabalhar perto de 0
const nx = (x: number) => (x - 0.575) / 0.19
const ny = (y: number) => (y - 45) / 18
const dny = (v: number) => v * 18 + 45

export type Historico = { treino: number[]; val: number[]; pesos: Float64Array[] }

export class MLP {
  H: number
  w1: Float64Array
  b1: Float64Array
  w2: Float64Array
  b2 = 0
  private m: Float64Array
  private v: Float64Array
  private t = 0
  constructor(H: number, seed = 1) {
    this.H = H
    const R = rng(seed)
    const g = () => (R() + R() + R() - 1.5) * 1.6
    this.w1 = Float64Array.from({ length: H }, () => g() * 1.5)
    this.b1 = Float64Array.from({ length: H }, () => g())
    this.w2 = Float64Array.from({ length: H }, () => g() / Math.sqrt(H))
    this.m = new Float64Array(3 * H + 1)
    this.v = new Float64Array(3 * H + 1)
  }
  prever(x: number) {
    const u = nx(x)
    let s = this.b2
    for (let j = 0; j < this.H; j++) s += this.w2[j] * Math.tanh(this.w1[j] * u + this.b1[j])
    return dny(s)
  }
  /** erro quadrático médio em (sc/ha)² */
  mse(d: Amostra[]) {
    let s = 0
    for (const p of d) s += (this.prever(p.x) - p.y) ** 2
    return s / d.length
  }
  /** uma época de gradiente em lote completo, otimizador Adam */
  epoca(d: Amostra[], lr: number) {
    const H = this.H
    const g = new Float64Array(3 * H + 1)
    for (const p of d) {
      const u = nx(p.x)
      const a = new Float64Array(H)
      let s = this.b2
      for (let j = 0; j < H; j++) {
        a[j] = Math.tanh(this.w1[j] * u + this.b1[j])
        s += this.w2[j] * a[j]
      }
      const e = (2 * (s - ny(p.y))) / d.length
      for (let j = 0; j < H; j++) {
        const da = e * this.w2[j] * (1 - a[j] * a[j])
        g[j] += da * u
        g[H + j] += da
        g[2 * H + j] += e * a[j]
      }
      g[3 * H] += e
    }
    this.t++
    const b1 = 0.9, b2 = 0.999
    const par = (k: number) => (k < H ? [this.w1, k] : k < 2 * H ? [this.b1, k - H] : k < 3 * H ? [this.w2, k - 2 * H] : null) as [Float64Array, number] | null
    for (let k = 0; k <= 3 * H; k++) {
      this.m[k] = b1 * this.m[k] + (1 - b1) * g[k]
      this.v[k] = b2 * this.v[k] + (1 - b2) * g[k] * g[k]
      const step = (lr * (this.m[k] / (1 - b1 ** this.t))) / (Math.sqrt(this.v[k] / (1 - b2 ** this.t)) + 1e-8)
      const pr = par(k)
      if (pr) pr[0][pr[1]] -= step
      else this.b2 -= step
    }
  }
  copia(): Float64Array {
    return Float64Array.from([...this.w1, ...this.b1, ...this.w2, this.b2])
  }
  carrega(p: Float64Array) {
    const H = this.H
    this.w1 = p.slice(0, H)
    this.b1 = p.slice(H, 2 * H)
    this.w2 = p.slice(2 * H, 3 * H)
    this.b2 = p[3 * H]
  }
}

/** treina e guarda a curva de treino e de validação; a cada `guardar` épocas salva os pesos para desenhar a curva ajustada */
export function treinarMLP(d: { treino: Amostra[]; val: Amostra[] }, H: number, lr: number, epocas: number, seed = 1, guardar = 10): Historico {
  const net = new MLP(H, seed)
  const h: Historico = { treino: [], val: [], pesos: [] }
  for (let e = 0; e < epocas; e++) {
    net.epoca(d.treino, lr)
    h.treino.push(net.mse(d.treino))
    h.val.push(net.mse(d.val))
    if (e % guardar === 0) h.pesos.push(net.copia())
  }
  return h
}

/** a regra do ultralytics (patience): para quando a validação fica `paciencia` épocas sem melhorar; devolve a melhor época */
export function paradaAntecipada(val: number[], paciencia: number) {
  let melhor = 0
  for (let e = 1; e < val.length; e++) {
    if (val[e] < val[melhor]) melhor = e
    if (e - melhor >= paciencia) return { parou: e, melhor }
  }
  return { parou: val.length - 1, melhor }
}

/** melhor erro de validação com parada antecipada, para a busca de hiperparâmetros */
export function avaliarConfig(d: { treino: Amostra[]; val: Amostra[] }, H: number, lr: number, epocas = 600, paciencia = 60, seed = 1) {
  const net = new MLP(H, seed)
  let melhor = Infinity, me = 0
  for (let e = 0; e < epocas; e++) {
    net.epoca(d.treino, lr)
    const v = net.mse(d.val)
    if (v < melhor) {
      melhor = v
      me = e
    }
    if (e - me >= paciencia) break
  }
  return { val: melhor, epoca: me }
}
