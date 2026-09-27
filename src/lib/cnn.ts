// Uma CNN minúscula, escrita à mão, que treina no navegador.
// Arquitetura: entrada 16×16×3 → conv 3×3 (F filtros) → ReLU → max-pool 2×2 → densa → softmax (2 classes).
// Otimizador: Adam. Tudo em Float32Array, sem bibliotecas.

import { type RGB, rng } from './img'

export const N = 16

export type Net = {
  F: number
  W: Float32Array // F × 3 × 3 × 3
  b: Float32Array // F
  Wd: Float32Array // 2 × (F·8·8)
  bd: Float32Array // 2
  adam: { m: Float32Array[]; v: Float32Array[]; t: number }
}

const P = N / 2

export function newNet(F = 6, seed = 1): Net {
  const R = rng(seed)
  const g = () => (R() + R() + R() - 1.5) * 0.8
  const W = new Float32Array(F * 27).map(() => g() * Math.sqrt(2 / 27))
  const Wd = new Float32Array(2 * F * P * P).map(() => g() * Math.sqrt(1 / (F * P * P)))
  const params = [W, new Float32Array(F), Wd, new Float32Array(2)]
  return {
    F, W, b: params[1], Wd, bd: params[3],
    adam: { m: params.map((p) => new Float32Array(p.length)), v: params.map((p) => new Float32Array(p.length)), t: 0 },
  }
}

/** RGB 16×16 → tensor [c][y][x] normalizado */
export function toInput(img: RGB): Float32Array {
  const x = new Float32Array(3 * N * N)
  for (let i = 0; i < N * N; i++) for (let c = 0; c < 3; c++) x[c * N * N + i] = img.data[i * 3 + c] / 255 - 0.5
  return x
}

/** reduz um recorte 32×32 para 16×16 pela média de blocos 2×2 */
export function down2(img: RGB): RGB {
  const w = img.w / 2, h = img.h / 2
  const o = { w, h, data: new Float32Array(w * h * 3) }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let c = 0; c < 3; c++) {
        const a = (yy: number, xx: number) => img.data[(yy * img.w + xx) * 3 + c]
        o.data[(y * w + x) * 3 + c] = (a(2 * y, 2 * x) + a(2 * y + 1, 2 * x) + a(2 * y, 2 * x + 1) + a(2 * y + 1, 2 * x + 1)) / 4
      }
  return o
}

type Cache = { x: Float32Array; conv: Float32Array; pool: Float32Array; arg: Int32Array; prob: number[] }

export function forward(net: Net, x: Float32Array): Cache {
  const { F, W, b, Wd, bd } = net
  const conv = new Float32Array(F * N * N)
  for (let f = 0; f < F; f++)
    for (let y = 0; y < N; y++)
      for (let xx = 0; xx < N; xx++) {
        let s = b[f]
        for (let c = 0; c < 3; c++)
          for (let ky = 0; ky < 3; ky++) {
            const yy = y + ky - 1
            if (yy < 0 || yy >= N) continue
            for (let kx = 0; kx < 3; kx++) {
              const xs = xx + kx - 1
              if (xs < 0 || xs >= N) continue
              s += W[f * 27 + c * 9 + ky * 3 + kx] * x[c * N * N + yy * N + xs]
            }
          }
        conv[f * N * N + y * N + xx] = s > 0 ? s : 0 // ReLU
      }
  const pool = new Float32Array(F * P * P)
  const arg = new Int32Array(F * P * P)
  for (let f = 0; f < F; f++)
    for (let y = 0; y < P; y++)
      for (let xx = 0; xx < P; xx++) {
        let best = -Infinity, bi = 0
        for (let dy = 0; dy < 2; dy++)
          for (let dx = 0; dx < 2; dx++) {
            const i = f * N * N + (2 * y + dy) * N + 2 * xx + dx
            if (conv[i] > best) {
              best = conv[i]
              bi = i
            }
          }
        pool[f * P * P + y * P + xx] = best
        arg[f * P * P + y * P + xx] = bi
      }
  const D = F * P * P
  const z = [bd[0], bd[1]]
  for (let k = 0; k < 2; k++) for (let i = 0; i < D; i++) z[k] += Wd[k * D + i] * pool[i]
  const m = Math.max(z[0], z[1])
  const e0 = Math.exp(z[0] - m), e1 = Math.exp(z[1] - m)
  return { x, conv, pool, arg, prob: [e0 / (e0 + e1), e1 / (e0 + e1)] }
}

/** gradientes de uma amostra; opcionalmente devolve o gradiente em relação à entrada (mapa de saliência) */
function backward(net: Net, c: Cache, y: number, grads: Float32Array[] | null, wantInput = false, target?: number) {
  const { F, W, Wd } = net
  const D = F * P * P
  const dz = target === undefined ? [c.prob[0] - (y === 0 ? 1 : 0), c.prob[1] - (y === 1 ? 1 : 0)] : [target === 0 ? 1 : 0, target === 1 ? 1 : 0]
  const dpool = new Float32Array(D)
  for (let k = 0; k < 2; k++) {
    if (grads) grads[3][k] += dz[k]
    for (let i = 0; i < D; i++) {
      if (grads) grads[2][k * D + i] += dz[k] * c.pool[i]
      dpool[i] += dz[k] * Wd[k * D + i]
    }
  }
  const dconv = new Float32Array(F * N * N)
  for (let i = 0; i < D; i++) if (c.conv[c.arg[i]] > 0) dconv[c.arg[i]] += dpool[i]
  const dx = wantInput ? new Float32Array(3 * N * N) : null
  for (let f = 0; f < F; f++)
    for (let y0 = 0; y0 < N; y0++)
      for (let x0 = 0; x0 < N; x0++) {
        const g = dconv[f * N * N + y0 * N + x0]
        if (!g) continue
        if (grads) grads[1][f] += g
        for (let ch = 0; ch < 3; ch++)
          for (let ky = 0; ky < 3; ky++) {
            const yy = y0 + ky - 1
            if (yy < 0 || yy >= N) continue
            for (let kx = 0; kx < 3; kx++) {
              const xs = x0 + kx - 1
              if (xs < 0 || xs >= N) continue
              const wi = f * 27 + ch * 9 + ky * 3 + kx, xi = ch * N * N + yy * N + xs
              if (grads) grads[0][wi] += g * c.x[xi]
              if (dx) dx[xi] += g * W[wi]
            }
          }
      }
  return dx
}

/** uma época de treino com mini-lotes; retorna a perda média */
export function trainEpoch(net: Net, X: Float32Array[], Y: number[], lr = 0.01, batch = 16, seed = 0): number {
  const R = rng(seed + net.adam.t)
  const idx = X.map((_, i) => i).sort(() => R() - 0.5)
  const params = [net.W, net.b, net.Wd, net.bd]
  let loss = 0
  for (let s = 0; s < idx.length; s += batch) {
    const grads = params.map((p) => new Float32Array(p.length))
    const bIdx = idx.slice(s, s + batch)
    for (const i of bIdx) {
      const c = forward(net, X[i])
      loss += -Math.log(Math.max(1e-7, c.prob[Y[i]]))
      backward(net, c, Y[i], grads)
    }
    net.adam.t++
    const t = net.adam.t, b1 = 0.9, b2 = 0.999
    params.forEach((p, k) => {
      const m = net.adam.m[k], v = net.adam.v[k], g = grads[k]
      for (let i = 0; i < p.length; i++) {
        const gi = g[i] / bIdx.length
        m[i] = b1 * m[i] + (1 - b1) * gi
        v[i] = b2 * v[i] + (1 - b2) * gi * gi
        p[i] -= (lr * (m[i] / (1 - b1 ** t))) / (Math.sqrt(v[i] / (1 - b2 ** t)) + 1e-8)
      }
    })
  }
  return loss / X.length
}

export function predict(net: Net, x: Float32Array): number[] {
  return forward(net, x).prob
}

/** saliência: |∂P(classe)/∂entrada| somado nos 3 canais (16×16) */
export function saliency(net: Net, x: Float32Array, cls: number): Float32Array {
  const c = forward(net, x)
  const dx = backward(net, c, cls, null, true, cls)!
  const s = new Float32Array(N * N)
  for (let i = 0; i < N * N; i++) s[i] = Math.abs(dx[i]) + Math.abs(dx[N * N + i]) + Math.abs(dx[2 * N * N + i])
  return s
}

export function accuracy(net: Net, X: Float32Array[], Y: number[]): number {
  let ok = 0
  X.forEach((x, i) => {
    const p = predict(net, x)
    if ((p[1] > p[0] ? 1 : 0) === Y[i]) ok++
  })
  return ok / (X.length || 1)
}
