import { useEffect, useMemo, useState } from 'react'
import { Lab, Slider, Seg } from './ui'

type Box = number[] // x1 y1 x2 y2 (pixels)
type Dados = { iou: { w: number; h: number; gt: Box }; nms: { w: number; h: number; dets: number[][]; gt: Box[] } }

let cache: Promise<Dados> | null = null
function useDados() {
  const [d, setD] = useState<Dados | null>(null)
  useEffect(() => {
    cache ??= fetch('./fig/labs.json').then((r) => r.json())
    cache.then(setD)
  }, [])
  return d
}

export function iou(a: Box, b: Box) {
  const ix = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]))
  const iy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]))
  const inter = ix * iy
  const u = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
  return u > 0 ? inter / u : 0
}

function nms(dets: number[][], conf: number, thr: number) {
  const d = dets.filter((x) => x[4] >= conf).sort((a, b) => b[4] - a[4])
  const keep: number[][] = []
  for (const x of d) if (keep.every((k) => iou(k, x) < thr)) keep.push(x)
  return keep
}

const pct = (v: number) => `${(100 * v).toFixed(0)}%`

/* ---------- IoU numa foto real ---------- */

export function LabIoU() {
  const d = useDados()
  const [dx, setDx] = useState(25)
  const [dy, setDy] = useState(10)
  const [esc, setEsc] = useState(1.1)
  const [lim, setLim] = useState(0.5)
  if (!d) return <p>carregando…</p>
  const g = d.iou.gt
  const bw = g[2] - g[0], bh = g[3] - g[1]
  const cx = (g[0] + g[2]) / 2 + (dx / 100) * bw, cy = (g[1] + g[3]) / 2 + (dy / 100) * bh
  const p = [cx - (bw * esc) / 2, cy - (bh * esc) / 2, cx + (bw * esc) / 2, cy + (bh * esc) / 2]
  const v = iou(g, p)
  const ok = v >= lim
  return (
    <Lab n="1.3" title="Arraste a caixa prevista sobre um cacho real" desc="A caixa verde é a anotação do WGISD. Mexa na caixa prevista e veja quando ela deixa de contar como acerto.">
      <div className="lab-cols two">
        <svg viewBox={`0 0 ${d.iou.w} ${d.iou.h}`} className="lab-img">
          <image href="./fig/lab_iou.jpg" width={d.iou.w} height={d.iou.h} />
          <rect x={g[0]} y={g[1]} width={bw} height={bh} fill="rgba(0,230,118,.18)" stroke="#00e676" strokeWidth={6} />
          <rect x={p[0]} y={p[1]} width={p[2] - p[0]} height={p[3] - p[1]} fill="none" stroke={ok ? '#ffe000' : '#ff5252'} strokeWidth={6} strokeDasharray="18 10" />
        </svg>
        <div style={{ display: 'grid', gap: 10 }}>
          <Slider id="iou-dx" label="deslocamento horizontal" value={dx} min={-100} max={100} onChange={setDx} fmt={(x) => `${x}% da largura`} />
          <Slider id="iou-dy" label="deslocamento vertical" value={dy} min={-100} max={100} onChange={setDy} fmt={(x) => `${x}% da altura`} />
          <Slider id="iou-esc" label="tamanho da caixa prevista" value={esc} min={0.4} max={2} step={0.05} onChange={setEsc} fmt={(x) => `${x.toFixed(2)}×`} />
          <Slider id="iou-lim" label="limiar de IoU para acerto" value={lim} min={0.3} max={0.95} step={0.05} onChange={setLim} fmt={(x) => x.toFixed(2)} />
          <div className="stat big"><b style={{ color: ok ? 'var(--ok)' : 'var(--bad)' }}>IoU = {v.toFixed(3)}</b><span>{ok ? 'verdadeiro positivo (TP)' : 'falso positivo (FP) e o cacho vira falso negativo (FN)'}</span></div>
          <p className="fig-note">Tente: com o limiar em 0,5 um deslocamento de 25% ainda passa. No mAP50-95, a mesma caixa é avaliada até 0,95, onde quase nada passa.</p>
        </div>
      </div>
    </Lab>
  )
}

/* ---------- NMS e limiar de confiança ---------- */

export function LabNMS() {
  const d = useDados()
  const [conf, setConf] = useState(0.25)
  const [thr, setThr] = useState(0.5)
  const [cru, setCru] = useState<'depois do NMS' | 'saída bruta'>('depois do NMS')
  const r = useMemo(() => {
    if (!d) return null
    const k = nms(d.nms.dets, conf, thr)
    const usado = new Set<number>()
    let tp = 0
    for (const x of k) {
      let best = -1, bv = 0
      d.nms.gt.forEach((g, j) => { const v = iou(g, x); if (v > bv && !usado.has(j)) { bv = v; best = j } })
      if (best >= 0 && bv >= 0.5) { usado.add(best); tp++ }
    }
    return { k, tp, fp: k.length - tp, fn: d.nms.gt.length - tp }
  }, [d, conf, thr])
  if (!d || !r) return <p>carregando…</p>
  const mostrar = cru === 'saída bruta' ? d.nms.dets : r.k
  const P = r.tp / Math.max(1, r.tp + r.fp), R = r.tp / d.nms.gt.length
  return (
    <Lab n="1.3b" title="Limiar de confiança e NMS numa foto de vinhedo" desc="As caixas vêm de um detector simulado sobre os cachos reais anotados. Ache os limiares que equilibram precisão e revocação.">
      <svg viewBox={`0 0 ${d.nms.w} ${d.nms.h}`} className="lab-img">
        <image href="./fig/lab_nms.jpg" width={d.nms.w} height={d.nms.h} />
        {mostrar.map((x, i) => (
          <rect key={i} x={x[0]} y={x[1]} width={x[2] - x[0]} height={x[3] - x[1]} fill="none" stroke={x[4] >= conf ? '#ffe000' : '#ff8a80'} strokeWidth={cru === 'saída bruta' ? 1.2 : 2.5} />
        ))}
      </svg>
      <div className="lab-cols">
        <Seg value={cru} options={['depois do NMS', 'saída bruta'] as const} onChange={setCru} label="mostrar" />
        <Slider id="nms-conf" label="conf (confiança mínima)" value={conf} min={0.05} max={0.9} step={0.05} onChange={setConf} fmt={(x) => x.toFixed(2)} />
        <Slider id="nms-iou" label="iou do NMS" value={thr} min={0.1} max={0.95} step={0.05} onChange={setThr} fmt={(x) => x.toFixed(2)} />
      </div>
      <div className="caso-nums">
        <div className="stat"><b>{d.nms.gt.length}</b><span>cachos anotados</span></div>
        <div className="stat"><b>{r.k.length}</b><span>caixas mantidas</span></div>
        <div className="stat"><b>{r.tp} / {r.fp} / {r.fn}</b><span>TP / FP / FN</span></div>
        <div className="stat"><b>{pct(P)} · {pct(R)}</b><span>precisão · revocação</span></div>
      </div>
    </Lab>
  )
}

/* ---------- conversor de formatos ---------- */

export function LabConversor() {
  const [W, setW] = useState(2048)
  const [H, setH] = useState(1365)
  const [b, setB] = useState([479, 365, 866, 638])
  const set = (i: number) => (e: React.ChangeEvent<HTMLInputElement>) => setB(b.map((v, j) => (j === i ? +e.target.value : v)))
  const [x1, y1, x2, y2] = b
  const yolo = [(x1 + x2) / 2 / W, (y1 + y2) / 2 / H, (x2 - x1) / W, (y2 - y1) / H]
  const invalido = x2 <= x1 || y2 <= y1 || x1 < 0 || y1 < 0 || x2 > W || y2 > H
  return (
    <Lab n="1.2" title="Conversor xyxy → COCO → YOLO" desc="Os valores iniciais são de um cacho de Cabernet Franc do WGISD (figura acima). Troque e confira a conta no caderno.">
      <div className="lab-cols">
        <label className="ctl">largura da imagem<input type="number" value={W} onChange={(e) => setW(+e.target.value)} /></label>
        <label className="ctl">altura da imagem<input type="number" value={H} onChange={(e) => setH(+e.target.value)} /></label>
        {['x1', 'y1', 'x2', 'y2'].map((n, i) => (
          <label key={n} className="ctl">{n} (px)<input type="number" value={b[i]} onChange={set(i)} /></label>
        ))}
      </div>
      <pre className="saida">
{`COCO  [x, y, w, h]      = [${x1}, ${y1}, ${x2 - x1}, ${y2 - y1}]
YOLO  cls xc yc w h      = 0 ${yolo.map((v) => v.toFixed(6)).join(' ')}
${invalido ? '⚠ caixa inválida: x2 ≤ x1, y2 ≤ y1 ou fora da imagem. O validador do Lab 1.5 tem que pegar isso.' : '✓ caixa válida: todos os valores YOLO entre 0 e 1'}`}
      </pre>
    </Lab>
  )
}

/* ---------- perceptron passo a passo ---------- */

const PORTAS = { AND: [0, 0, 0, 1], OR: [0, 1, 1, 1], XOR: [0, 1, 1, 0] }
const X = [[0, 0], [0, 1], [1, 0], [1, 1]]

export function LabPerceptron() {
  const [porta, setPorta] = useState<keyof typeof PORTAS>('AND')
  const [w, setW] = useState([0, 0, 0]) // w1 w2 b
  const [passo, setPasso] = useState(0)
  const [log, setLog] = useState<string[]>([])
  const eta = 0.2
  const y = PORTAS[porta]
  const reset = (p = porta) => { setPorta(p); setW([0, 0, 0]); setPasso(0); setLog([]) }
  const step = () => {
    const i = passo % 4
    const z = w[0] * X[i][0] + w[1] * X[i][1] + w[2]
    const pr = z > 0 ? 1 : 0
    const e = y[i] - pr
    const nw = [w[0] + eta * e * X[i][0], w[1] + eta * e * X[i][1], w[2] + eta * e]
    setLog([`época ${Math.floor(passo / 4) + 1}, x=(${X[i]}) y=${y[i]} ŷ=${pr} erro=${e} → w=(${nw[0].toFixed(1)}, ${nw[1].toFixed(1)}) b=${nw[2].toFixed(1)}`, ...log].slice(0, 6))
    setW(nw)
    setPasso(passo + 1)
  }
  const erros = X.filter((x, i) => (w[0] * x[0] + w[1] * x[1] + w[2] > 0 ? 1 : 0) !== y[i]).length
  // reta w1 x + w2 y + b = 0 no quadro [-0.5, 1.5]
  const S = (v: number) => 30 + (v + 0.5) * 120
  let linha = null
  if (Math.abs(w[1]) > 1e-9) {
    const ya = (-w[2] - w[0] * -0.5) / w[1], yb = (-w[2] - w[0] * 1.5) / w[1]
    linha = <line x1={S(-0.5)} y1={S(1 - ya)} x2={S(1.5)} y2={S(1 - yb)} stroke="#131a9f" strokeWidth={3} />
  } else if (Math.abs(w[0]) > 1e-9) {
    const xa = -w[2] / w[0]
    linha = <line x1={S(xa)} y1={S(-0.5)} x2={S(xa)} y2={S(1.5)} stroke="#131a9f" strokeWidth={3} />
  }
  return (
    <Lab n="2.2" title="Treine um perceptron à mão" desc="Cada clique aplica a regra w ← w + η·(y − ŷ)·x em um exemplo. No XOR, a reta nunca para de mexer.">
      <div className="lab-cols two">
        <svg viewBox="0 0 300 300" className="lab-img" style={{ maxWidth: 320, background: '#fff' }}>
          <rect x={30} y={30} width={240} height={240} fill="#f7f7fb" stroke="#ddd" />
          {linha}
          {X.map((x, i) => (
            <circle key={i} cx={S(x[0])} cy={S(1 - x[1])} r={14} fill={y[i] ? '#131a9f' : '#fff'} stroke="#111" strokeWidth={2} />
          ))}
          <text x={150} y={295} textAnchor="middle" fontSize={13}>x₁</text>
          <text x={10} y={150} fontSize={13}>x₂</text>
        </svg>
        <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
          <Seg value={porta} options={['AND', 'OR', 'XOR'] as const} onChange={(p) => reset(p)} label="porta lógica" />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={step}>1 passo</button>
            <button className="btn" onClick={() => { for (let k = 0; k < 4; k++) setTimeout(() => document.getElementById('perc-step')?.click(), k * 120) }}>1 época</button>
            <button className="btn ghost" onClick={() => reset()}>zerar</button>
            <button id="perc-step" hidden onClick={step} />
          </div>
          <div className="stat"><b>{erros === 0 && passo > 0 ? 'separou!' : `${erros} erro(s)`}</b><span>w = ({w[0].toFixed(1)}, {w[1].toFixed(1)}) · b = {w[2].toFixed(1)} · η = {eta}</span></div>
          <pre className="saida small">{log.join('\n') || 'clique em "1 passo"'}</pre>
        </div>
      </div>
    </Lab>
  )
}

/* ---------- vazamento entre treino e teste ---------- */

const FOTOS = ['CDY', 'CFR', 'CSV', 'SVB', 'SYH'].flatMap((v) => Array.from({ length: 6 }, (_, i) => ({ v, voo: `${v}-${i < 3 ? 'A' : 'B'}` })))

export function LabSplit() {
  const [modo, setModo] = useState<'aleatório' | 'por grupo'>('aleatório')
  const [seed, setSeed] = useState(1)
  const split = useMemo(() => {
    let s = seed * 9301 + 49297
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
    if (modo === 'aleatório') return FOTOS.map((f) => ({ ...f, set: rnd() < 0.7 ? 'treino' : rnd() < 0.5 ? 'val' : 'teste' }))
    const grupos = [...new Set(FOTOS.map((f) => f.voo))].sort(() => rnd() - 0.5)
    const papel: Record<string, string> = {}
    grupos.forEach((g, i) => (papel[g] = i < 7 ? 'treino' : i < 8 ? 'val' : 'teste'))
    return FOTOS.map((f) => ({ ...f, set: papel[f.voo] }))
  }, [modo, seed])
  const vaz = new Set(split.filter((f) => f.set === 'teste').map((f) => f.voo).filter((g) => split.some((o) => o.voo === g && o.set === 'treino'))).size
  return (
    <Lab n="1.5" title="Onde o vazamento aparece" desc="30 fotos, 5 variedades, 2 dias de coleta por variedade (A e B). Fotos do mesmo dia são quase iguais: se uma cai no treino e a vizinha no teste, a nota do teste mente.">
      <div className="lab-cols">
        <Seg value={modo} options={['aleatório', 'por grupo'] as const} onChange={setModo} label="como dividir" />
        <button className="btn" onClick={() => setSeed(seed + 1)}>sortear de novo</button>
      </div>
      <div className="split-grid">
        {split.map((f, i) => (
          <span key={i} className={`split-cell ${f.set}`} title={f.voo}>{f.voo}</span>
        ))}
      </div>
      <div className="stat big"><b style={{ color: vaz ? 'var(--bad)' : 'var(--ok)' }}>{vaz} grupo(s) com vazamento</b><span>grupos que aparecem ao mesmo tempo no treino e no teste</span></div>
    </Lab>
  )
}
