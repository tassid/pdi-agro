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
    <Lab n="1.3" title="IoU entre uma previsão e uma anotação do WGISD" desc="A caixa verde corresponde à anotação original. Os controles deslocam e redimensionam a caixa prevista; observe a variação do IoU e a classificação como TP ou FP.">
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
          <p className="fig-note">Com limiar 0,5, deslocamentos moderados ainda produzem correspondência; no mAP50-95, a mesma previsão é avaliada também em limiares de até 0,95.</p>
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
    <Lab n="1.3b" title="Limiar de confiança e NMS" desc="Previsões simuladas a partir das anotações de uma imagem do WGISD. Analise o efeito dos dois limiares sobre precisão e revocação.">
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
    <Lab n="1.2" title="Conversor xyxy → COCO → YOLO" desc="Valores iniciais correspondentes à caixa da Figura 11. Altere os valores para verificar as conversões calculadas manualmente.">
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
    <Lab n="2.2" title="Treinamento passo a passo do perceptron" desc="Cada passo aplica a regra w ← w + η·(y − ŷ)·x a um exemplo. Para o XOR, a fronteira não se estabiliza.">
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
    <Lab n="1.5" title="Partição aleatória e partição por grupo" desc="Simulação com 30 imagens de 5 variedades e 2 sessões de coleta por variedade (A e B). Imagens da mesma sessão são dependentes; sua presença em treino e teste caracteriza vazamento.">
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

/* ---------- GSD e tamanho do objeto em pixels ---------- */

export function LabGSD() {
  const [alt, setAlt] = useState(40)
  const [focal, setFocal] = useState(8.8)
  const [pix, setPix] = useState(2.4)
  const [largImg, setLargImg] = useState(5472)
  const [obj, setObj] = useState(15)
  const [imgsz, setImgsz] = useState(640)
  const gsd = (alt * pix) / focal / 10 // cm/px  (alt m, pix µm, focal mm → (m·µm/mm) = mm → /10 = cm)
  const px = obj / gsd
  const pxRede = px * (imgsz / largImg)
  const cor = pxRede < 8 ? 'var(--bad)' : pxRede < 16 ? '#b8860b' : 'var(--ok)'
  return (
    <Lab n="1.3c" title="Cálculo do GSD e da resolução efetiva do objeto" desc="Valores iniciais de um sensor de 1 polegada com 20 MP. Analise o efeito da altura de voo e de imgsz sobre o número de pixels do objeto na entrada da rede.">
      <div className="lab-cols">
        <Slider id="g-alt" label="altura de voo" value={alt} min={5} max={120} onChange={setAlt} fmt={(v) => `${v} m`} />
        <Slider id="g-foc" label="distância focal" value={focal} min={4} max={35} step={0.1} onChange={setFocal} fmt={(v) => `${v.toFixed(1)} mm`} />
        <Slider id="g-pix" label="tamanho do pixel do sensor" value={pix} min={0.8} max={6} step={0.1} onChange={setPix} fmt={(v) => `${v.toFixed(1)} µm`} />
        <Slider id="g-larg" label="largura da foto" value={largImg} min={1000} max={8000} step={4} onChange={setLargImg} fmt={(v) => `${v} px`} />
        <Slider id="g-obj" label="tamanho do objeto" value={obj} min={1} max={200} onChange={setObj} fmt={(v) => `${v} cm`} />
        <Slider id="g-imgsz" label="imgsz no treino" value={imgsz} min={320} max={1920} step={32} onChange={setImgsz} fmt={(v) => `${v} px`} />
      </div>
      <div className="caso-nums">
        <div className="stat"><b>{gsd.toFixed(2)} cm/px</b><span>GSD = altura × pixel ÷ focal</span></div>
        <div className="stat"><b>{px.toFixed(0)} px</b><span>objeto na foto original</span></div>
        <div className="stat"><b style={{ color: cor }}>{pxRede.toFixed(1)} px</b><span>objeto depois de reduzir para imgsz</span></div>
        <div className="stat"><b>{((largImg * gsd) / 100).toFixed(1)} m</b><span>largura coberta no chão</span></div>
      </div>
      <p className="fig-note">Quanto menor o número de pixels por objeto, menor a informação disponível ao detector. As alternativas incluem reduzir a altura de voo, aumentar imgsz ou realizar inferência por fatias (AKYON; ALTINUC; TEMIZEL, 2022).</p>
    </Lab>
  )
}

/* ---------- métricas a partir de TP, FP, FN ---------- */

export function LabMetricas() {
  const [tp, setTp] = useState(80)
  const [fp, setFp] = useState(15)
  const [fn, setFn] = useState(20)
  const P = tp / Math.max(1, tp + fp), R = tp / Math.max(1, tp + fn), F1 = (2 * P * R) / Math.max(1e-9, P + R)
  return (
    <Lab n="2.4" title="Precisão, revocação, F1 e erro de contagem" desc="Varie TP, FP e FN e observe a resposta de cada métrica.">
      <div className="lab-cols">
        <Slider id="m-tp" label="TP (cachos achados)" value={tp} min={0} max={150} onChange={setTp} />
        <Slider id="m-fp" label="FP (caixas em folha, sombra, repetidas)" value={fp} min={0} max={150} onChange={setFp} />
        <Slider id="m-fn" label="FN (cachos sem caixa)" value={fn} min={0} max={150} onChange={setFn} />
      </div>
      <div className="caso-nums">
        <div className="stat"><b>{pct(P)}</b><span>precisão = TP / (TP + FP)</span></div>
        <div className="stat"><b>{pct(R)}</b><span>revocação = TP / (TP + FN)</span></div>
        <div className="stat"><b>{pct(F1)}</b><span>F1 = 2PR / (P + R)</span></div>
        <div className="stat"><b>{tp + fp - (tp + fn) > 0 ? '+' : ''}{tp + fp - (tp + fn)}</b><span>erro de contagem (previstos − reais)</span></div>
      </div>
      <p className="fig-note">Quando FP = FN, o erro de contagem é nulo independentemente de precisão e revocação; a contagem correta, isoladamente, não caracteriza o desempenho do detector.</p>
    </Lab>
  )
}

/* ---------- convolução ao vivo numa foto real ---------- */

const KERNELS: Record<string, number[]> = {
  identidade: [0, 0, 0, 0, 1, 0, 0, 0, 0],
  'Sobel x': [-1, 0, 1, -2, 0, 2, -1, 0, 1],
  'Sobel y': [-1, -2, -1, 0, 0, 0, 1, 2, 1],
  Laplaciano: [0, 1, 0, 1, -4, 1, 0, 1, 0],
  média: [1, 1, 1, 1, 1, 1, 1, 1, 1].map((v) => v / 9),
  realce: [0, -1, 0, -1, 5, -1, 0, -1, 0],
}

export function LabConv() {
  const [k, setK] = useState<number[]>(KERNELS['Sobel x'])
  const [relu, setRelu] = useState<'ReLU' | 'valor absoluto'>('valor absoluto')
  const [src, setSrc] = useState<{ g: Float32Array; w: number; h: number } | null>(null)
  const [cnv, setCnv] = useState<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const im = new Image()
    im.src = './fig/lab_iou.jpg'
    im.onload = () => {
      const w = 360, h = Math.round((im.height / im.width) * 360)
      const c = document.createElement('canvas'); c.width = w; c.height = h
      const ctx = c.getContext('2d')!; ctx.drawImage(im, 0, 0, w, h)
      const d = ctx.getImageData(0, 0, w, h).data; const g = new Float32Array(w * h)
      for (let i = 0; i < w * h; i++) g[i] = 0.299 * d[4 * i] + 0.587 * d[4 * i + 1] + 0.114 * d[4 * i + 2]
      setSrc({ g, w, h })
    }
  }, [])
  useEffect(() => {
    if (!src || !cnv) return
    const { g, w, h } = src; const out = new Float32Array(w * h); let mx = 1
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      let s = 0
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) s += g[(y + j) * w + x + i] * k[(j + 1) * 3 + i + 1]
      s = relu === 'ReLU' ? Math.max(0, s) : Math.abs(s); out[y * w + x] = s; if (s > mx) mx = s
    }
    cnv.width = w; cnv.height = h
    const ctx = cnv.getContext('2d')!; const id = ctx.createImageData(w, h)
    const escala = k.reduce((a, b) => a + b, 0) > 0.5 ? 1 : 255 / mx
    for (let i = 0; i < w * h; i++) { const v = Math.min(255, out[i] * escala); id.data[4 * i] = id.data[4 * i + 1] = id.data[4 * i + 2] = v; id.data[4 * i + 3] = 255 }
    ctx.putImageData(id, 0, 0)
  }, [src, cnv, k, relu])
  return (
    <Lab n="2.2b" title="Convolução sobre uma imagem do WGISD" desc="Selecione um núcleo clássico ou defina os nove pesos. A operação corresponde à de um canal de uma camada convolucional, cujos pesos seriam aprendidos.">
      <div className="lab-cols two">
        <canvas ref={setCnv} className="lab-canvas" />
        <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {Object.keys(KERNELS).map((n) => <button key={n} className="btn ghost" onClick={() => setK(KERNELS[n])}>{n}</button>)}
          </div>
          <div className="conv-grid">
            {k.map((v, i) => (
              <input key={i} type="number" step={0.1} value={Number(v.toFixed(2))} onChange={(e) => setK(k.map((x, j) => (j === i ? +e.target.value : x)))} />
            ))}
          </div>
          <Seg value={relu} options={['valor absoluto', 'ReLU'] as const} onChange={setRelu} label="depois da soma" />
          <p className="fig-note">Com ReLU, apenas respostas positivas (transições em um sentido) são mantidas; camadas convolucionais usam muitos núcleos para representar diferentes orientações.</p>
        </div>
      </div>
    </Lab>
  )
}
