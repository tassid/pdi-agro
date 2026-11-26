import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Shuffle, Play, Pause, RotateCcw } from 'lucide-react'
import { type RGB, newRGB, rng } from '../lib/img'
import { simDetector, nms, prCurve, opPoint, matchImage, fromYolo, trackStep, IOU_COCO, type Box, type Fazenda, type Track } from '../lib/yolo'
import { ImgCanvas, Seg, Slider, Lab, Callout, Term, Code, Caso, LineChart, Legend } from '../ui'
import { memo } from '../samples'
import { COR, drawBox, Stat, Chave, PRChart } from './detui'
import { pasto } from './Aula7'
import type { Aula } from '../lesson'
import { ParadaLab, BuscaLab } from './labsNeuro'
import { Figura, FigCVAT, FigTelaCVAT, FigLacoTreino, FigTarefasYolo } from './figuras'

const NB8 = 'https://colab.research.google.com/github/tassid/pdi-agro/blob/main/notebooks/Aula8_YOLO_Treino_Avaliacao.ipynb'
const FAZ_A: Fazenda = 'A · nelore em pasto verde'
const FAZ_B: Fazenda = 'B · gado escuro, solo exposto e cupinzeiros'

/* ============ Lab 8.1 · o doutor do rótulo ============ */

const EXEMPLO = `0 0.512 0.430 0.081 0.072
0 0.233 0.611 0.079 0.065
1 0.700 0.300 0.080 0.070
0 188 142 30 25
0 0.95 0.50 0.20 0.10
0 0.410 0.820 0.075 0.061 0.4
0 0.233 0.611 0.079 0.065`

type Diag = { linha: number; txt: string; ok: boolean; msg: string; box?: Box }

function diagnosticar(txt: string, nCls: number, W: number, H: number): Diag[] {
  const vistos = new Set<string>()
  return txt
    .split('\n')
    .map((l, i) => ({ l: l.trim(), i }))
    .filter((x) => x.l)
    .map(({ l, i }) => {
      const v = l.split(/\s+/).map(Number)
      const d = (ok: boolean, msg: string, box?: Box): Diag => ({ linha: i + 1, txt: l, ok, msg, box })
      if (v.some((x) => Number.isNaN(x))) return d(false, 'tem texto onde deveria ter número (nome da classe em vez do índice?)')
      if (v.length !== 5) {
        if (v.length > 5 && (v.length - 1) % 2 === 0) return d(false, `${v.length - 1} coordenadas: parece polígono de segmentação, não caixa de detecção`)
        return d(false, `${v.length} valores; a linha de detecção tem exatamente 5 (classe cx cy w h)`)
      }
      const [c, cx, cy, w, h] = v
      if (!Number.isInteger(c) || c < 0 || c >= nCls) return d(false, `classe ${c} não existe: o data.yaml tem ${nCls} classe(s), índices de 0 a ${nCls - 1}`)
      if ([cx, cy, w, h].some((x) => x > 1)) return d(false, 'valores maiores que 1: coordenadas em pixels, faltou dividir pela largura e altura da imagem')
      if (w <= 0 || h <= 0) return d(false, 'largura ou altura zero ou negativa')
      const b = fromYolo(cx, cy, w, h, W, H)
      if (b.x0 < -0.5 || b.y0 < -0.5 || b.x1 > W + 0.5 || b.y1 > H + 0.5) return d(false, 'a caixa sai da imagem (cx ± w/2 passa de 0 ou de 1): exportou xyxy como se fosse cx cy?', b)
      const k = v.join(' ')
      if (vistos.has(k)) return d(false, 'linha duplicada: o mesmo objeto vai pesar duas vezes no treino', b)
      vistos.add(k)
      return d(true, 'ok', b)
    })
}

function DoutorRotulo() {
  const [txt, setTxt] = useState(EXEMPLO)
  const [classes, setClasses] = useState('bovino')
  const p = pasto(5)
  const nomes = classes.split(',').map((s) => s.trim()).filter(Boolean)
  const diag = useMemo(() => diagnosticar(txt, nomes.length, p.w, p.h), [txt, nomes.length, p.w, p.h])
  const overlay = useCallback(
    (ctx: CanvasRenderingContext2D, s: number) => {
      diag.forEach((d) => d.box && drawBox(ctx, s, d.box, d.ok ? COR.tp : COR.fp, { label: `L${d.linha}`, dash: d.ok ? undefined : [4, 3] }))
    },
    [diag],
  )
  const yaml = `# data.yaml
path: /content/pasto        # pasta raiz do banco
train: images/train
val: images/val
test: images/test           # opcional

names:
${nomes.map((n, i) => `  ${i}: ${n}`).join('\n')}`
  const arvore = `pasto/
├── data.yaml
├── images/
│   ├── train/  voo01_0001.jpg  voo01_0002.jpg ...
│   ├── val/    voo07_0001.jpg ...
│   └── test/   voo09_0001.jpg ...
└── labels/
    ├── train/  voo01_0001.txt  voo01_0002.txt ...
    ├── val/    voo07_0001.txt ...
    └── test/   voo09_0001.txt ...`
  const ruins = diag.filter((d) => !d.ok).length
  return (
    <Lab n="8.1" title="O doutor do rótulo" desc="Cole aqui as linhas de um .txt de rótulo (ou edite o exemplo, que tem cinco problemas clássicos). O doutor confere cada linha contra o data.yaml e desenha as caixas válidas na foto, como você deve fazer antes de qualquer treino.">
      <div className="controls">
        <div className="ctl" style={{ maxWidth: 'none', flex: '1 1 260px' }}>
          <label htmlFor="dr-classes">nomes das classes no data.yaml (separados por vírgula)</label>
          <input id="dr-classes" type="text" value={classes} onChange={(e) => setClasses(e.target.value)} style={{ width: '100%', padding: '4px 6px', fontFamily: 'var(--f-mono)' }} />
        </div>
        <button className="btn ghost" type="button" onClick={() => setTxt(EXEMPLO)}>
          <RotateCcw size={15} /> Voltar ao exemplo
        </button>
      </div>
      <div className="lab-cols two">
        <div className="panel">
          <div className="panel-t">
            <span>voo01_0005.txt</span>
            <span>{ruins ? `${ruins} problema(s)` : 'tudo certo'}</span>
          </div>
          <textarea value={txt} onChange={(e) => setTxt(e.target.value)} rows={8} spellCheck={false} aria-label="linhas do rótulo" style={{ width: '100%', fontFamily: 'var(--f-mono)', fontSize: '0.82rem', padding: 6 }} />
          <div className="readout" style={{ whiteSpace: 'normal', display: 'grid', gap: 4 }}>
            {diag.map((d) => (
              <div key={d.linha} style={{ color: d.ok ? 'var(--ok)' : 'var(--bad)' }}>
                L{d.linha}: {d.msg}
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <ImgCanvas img={p.img} overlay={overlay} label="rótulos desenhados de volta na foto" />
          <Chave itens={[{ cor: COR.tp, t: 'linha válida' }, { cor: COR.fp, t: 'linha com problema', dash: true }]} />
          <div className="lab-cols two" style={{ marginTop: 6 }}>
            <div className="readout" style={{ whiteSpace: 'pre', fontSize: '0.72rem' }}>{yaml}</div>
            <div className="readout" style={{ whiteSpace: 'pre', fontSize: '0.72rem' }}>{arvore}</div>
          </div>
        </div>
      </div>
    </Lab>
  )
}

/* ============ Lab 8.2 · pequeno demais para a grade ============ */

type Objeto = 'boi adulto (2,2 × 0,7 m)' | 'bezerro (1,2 × 0,45 m)' | 'planta de soja em V2 (15 cm)' | 'lagarta na folha (3 cm)'
const OBJ: Record<Objeto, [number, number]> = {
  'boi adulto (2,2 × 0,7 m)': [2.2, 0.7],
  'bezerro (1,2 × 0,45 m)': [1.2, 0.45],
  'planta de soja em V2 (15 cm)': [0.15, 0.15],
  'lagarta na folha (3 cm)': [0.03, 0.006],
}
// câmera 1" de 20 MP (13,2 mm de sensor, 8,8 mm de focal, 5472 px de largura), comum em drones agrícolas
const gsdCm = (alt: number) => (alt * 100 * 13.2) / (8.8 * 5472)

function objImg(wpx: number, hpx: number): RGB {
  const N = 48
  const o = newRGB(N, N)
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const i = y * N + x
      // cobertura aproximada do pixel (supersampling 4×4)
      let c = 0
      for (let a = 0; a < 4; a++)
        for (let b = 0; b < 4; b++) {
          const uu = (x + (a + 0.5) / 4 - N / 2) / Math.max(0.25, wpx / 2), vv = (y + (b + 0.5) / 4 - N / 2) / Math.max(0.25, hpx / 2)
          if (uu * uu + vv * vv <= 1) c++
        }
      const t = c / 16
      o.data[i * 3] = 92 * (1 - t) + 226 * t
      o.data[i * 3 + 1] = 132 * (1 - t) + 220 * t
      o.data[i * 3 + 2] = 60 * (1 - t) + 206 * t
    }
  return o
}

function PequenoDemais() {
  const [alt, setAlt] = useState(60)
  const [obj, setObj] = useState<Objeto>('bezerro (1,2 × 0,45 m)')
  const [imgsz, setImgsz] = useState<'640' | '1280'>('640')
  const [fatia, setFatia] = useState<'foto inteira reduzida' | 'fatias de imgsz (SAHI)'>('foto inteira reduzida')
  const gsd = gsdCm(alt)
  const [mw, mh] = OBJ[obj]
  const wOrig = (mw * 100) / gsd, hOrig = (mh * 100) / gsd
  const f = fatia === 'foto inteira reduzida' ? +imgsz / 5472 : 1
  const wm = wOrig * f, hm = hOrig * f
  const fatias = Math.ceil(5472 / (+imgsz * 0.8)) * Math.ceil(3648 / (+imgsz * 0.8))
  const veredito = Math.max(wm, hm) < 8 ? { t: 'menor que uma célula da P3: o YOLO praticamente não enxerga', c: 'var(--bad)' } : Math.max(wm, hm) < 16 ? { t: 'no limite: detecta, mas com IoU instável', c: 'var(--grain)' } : { t: 'tamanho confortável para o detector', c: 'var(--ok)' }
  const img = useMemo(() => objImg(Math.min(46, wm), Math.min(46, hm)), [wm, hm])
  const grid = useCallback((ctx: CanvasRenderingContext2D, s: number) => {
    ctx.strokeStyle = 'rgba(255,224,0,0.8)'
    ctx.lineWidth = 1
    for (let k = 0; k <= 48; k += 8) {
      ctx.beginPath()
      ctx.moveTo(k * s, 0)
      ctx.lineTo(k * s, 48 * s)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, k * s)
      ctx.lineTo(48 * s, k * s)
      ctx.stroke()
    }
  }, [])
  return (
    <Lab n="8.2" title="Pequeno demais para a grade" desc="Uma foto de drone tem 5472 × 3648 pixels. O YOLO, por padrão, reduz tudo para 640 pixels de largura antes de olhar. Escolha a altura de voo e o objeto e veja quantos pixels sobram dele dentro do modelo.">
      <div className="controls">
        <Slider id="pd-alt" label="altura de voo" value={alt} min={20} max={120} step={5} onChange={setAlt} fmt={(x) => `${x} m`} />
        <Seg value={obj} options={Object.keys(OBJ) as Objeto[]} onChange={setObj} label="objeto" />
      </div>
      <div className="controls">
        <Seg value={imgsz} options={['640', '1280'] as const} onChange={setImgsz} label="imgsz" />
        <Seg value={fatia} options={['foto inteira reduzida', 'fatias de imgsz (SAHI)'] as const} onChange={setFatia} label="estratégia" />
      </div>
      <div className="lab-cols two">
        <div className="panel">
          <div className="panel-t">
            <span>o objeto como o modelo vê, em pixels do modelo</span>
            <span>grade amarela = passo 8 (P3)</span>
          </div>
          <ImgCanvas img={img} overlay={grid} scale={6} pixelated label="objeto em pixels do modelo" maxWidth={300} />
        </div>
        <div className="panel">
          <div className="stats">
            <Stat v={`${gsd.toFixed(2)} cm`} l="GSD (tamanho de 1 pixel no chão)" />
            <Stat v={`${wOrig.toFixed(0)}×${hOrig.toFixed(0)} px`} l="na foto original" />
            <Stat v={`${wm.toFixed(1)}×${hm.toFixed(1)} px`} l="dentro do modelo" cor={veredito.c} />
          </div>
          {fatia === 'fatias de imgsz (SAHI)' && (
            <div className="stats" style={{ marginTop: 8 }}>
              <Stat v={`${fatias}`} l={`fatias de ${imgsz} px com 20% de sobreposição`} />
              <Stat v={`${fatias}×`} l="mais tempo de inferência por foto" />
            </div>
          )}
          <p className="note" style={{ color: veredito.c }}>
            <b>{veredito.t}</b>
          </p>
          <p className="note">
            Três saídas, todas com custo: voar mais baixo (mais fotos, mais bateria), aumentar o imgsz (mais memória de GPU, treino mais lento) ou fatiar a foto e rodar o detector em cada pedaço (mais tempo de
            inferência, e caixas cortadas na emenda das fatias para juntar depois).
          </p>
        </div>
      </div>
    </Lab>
  )
}

/* ============ Lab 8.5 · medindo um detector ============ */

const N_TESTE = 12
function conjunto(faz: Fazenda) {
  return memo(`teste-${faz}`, () =>
    Array.from({ length: N_TESTE }, (_, k) => {
      const p = pasto(200 + k, faz, k % 4 === 3 ? 'aglomerado no cocho' : 'espalhado')
      const brutas = simDetector(p, 900 + k + (faz === FAZ_B ? 50 : 0))
      const dets = nms(brutas.filter((d) => d.conf >= 0.001), 0.7).kept
      return { p, dets, gts: p.gts }
    }),
  )
}

function Medidor() {
  const [faz, setFaz] = useState<Fazenda>(FAZ_A)
  const [conf, setConf] = useState(0.25)
  const [thr, setThr] = useState<'0,50' | '0,75'>('0,50')
  const [k, setK] = useState(0)
  const set = conjunto(faz)
  const setA = conjunto(FAZ_A)
  const t = thr === '0,50' ? 0.5 : 0.75
  const pr = useMemo(() => prCurve(set, t), [set, t])
  const prA = useMemo(() => prCurve(setA, t), [setA, t])
  const ap50 = useMemo(() => prCurve(set, 0.5).ap, [set])
  const map = useMemo(() => IOU_COCO.reduce((a, u) => a + prCurve(set, u).ap, 0) / IOU_COCO.length, [set])
  const op = useMemo(() => opPoint(set, t, conf), [set, t, conf])
  const confs = useMemo(() => Array.from({ length: 19 }, (_, i) => 0.05 + i * 0.05), [])
  const f1 = useMemo(() => confs.map((c) => opPoint(set, t, c)), [set, t, confs])
  const im = set[k]
  const m = useMemo(() => matchImage(im.dets.filter((d) => d.conf >= conf), im.gts, t), [im, conf, t])
  const overlay = useCallback(
    (ctx: CanvasRenderingContext2D, s: number) => {
      m.fn.forEach((g) => drawBox(ctx, s, im.gts[g], COR.fn, { dash: [4, 3], lw: 2 }))
      m.matches.forEach((x) => drawBox(ctx, s, x.det, x.tp ? COR.tp : COR.fp, { lw: 2 }))
    },
    [m, im],
  )
  return (
    <Lab
      n="8.5"
      title="Medindo um detector"
      desc="Doze fotos de teste com a verdade de campo. As detecções imitam um modelo treinado só na fazenda A (simuladas, como no Lab 7.6); todas as métricas são calculadas aqui, do mesmo jeito que o model.val() calcula. Mova o limiar de confiança e troque a fazenda de teste."
    >
      <div className="controls">
        <Seg value={faz} options={[FAZ_A, FAZ_B] as const} onChange={setFaz} label="conjunto de teste" />
        <Seg value={thr} options={['0,50', '0,75'] as const} onChange={setThr} label="IoU para contar acerto" />
      </div>
      <div className="controls">
        <Slider id="md-conf" label="conf (ponto de operação)" value={conf} min={0.05} max={0.95} step={0.05} onChange={setConf} fmt={(x) => x.toFixed(2)} />
        <Slider id="md-k" label="foto de teste" value={k} min={0} max={N_TESTE - 1} onChange={setK} fmt={(x) => `${x + 1} de ${N_TESTE}`} />
      </div>
      <div className="lab-cols two">
        <div className="panel">
          <ImgCanvas img={im.p.img} overlay={overlay} label="detecções de uma foto de teste" />
          <Chave itens={[{ cor: COR.tp, t: 'verdadeiro positivo' }, { cor: COR.fp, t: 'falso positivo' }, { cor: COR.fn, t: 'animal perdido (falso negativo)', dash: true }]} />
          <div className="stats" style={{ marginTop: 6 }}>
            <Stat v={`${op.contados} / ${op.verdade}`} l="contados / existentes, nas 12 fotos" cor={Math.abs(op.contados - op.verdade) / op.verdade > 0.1 ? 'var(--bad)' : 'var(--ok)'} />
            <Stat v={op.erroMedio.toFixed(1)} l="erro médio de contagem por foto (animais)" />
          </div>
        </div>
        <div className="panel">
          <PRChart
            curves={[
              ...(faz === FAZ_B ? [{ name: 'A', p: prA.p, r: prA.r, color: '#9fb0ff' }] : []),
              { name: 'atual', p: pr.p, r: pr.r, color: faz === FAZ_A ? '#131a9f' : '#e0302a' },
            ]}
            ponto={{ r: op.R, p: op.P, color: '#ffb000' }}
          />
          {faz === FAZ_B && <Legend items={[{ name: 'fazenda A (onde treinou)', color: '#9fb0ff' }, { name: 'fazenda B', color: '#e0302a' }]} />}
          <div className="stats">
            <Stat v={op.P.toFixed(2)} l="precisão P" />
            <Stat v={op.R.toFixed(2)} l="revocação R" />
            <Stat v={op.F1.toFixed(2)} l="F1" />
          </div>
          <div className="stats" style={{ marginTop: 6 }}>
            <Stat v={ap50.toFixed(3)} l="mAP50" />
            <Stat v={map.toFixed(3)} l="mAP50-95" />
            <Stat v={`${op.tp}/${op.fp}/${op.fn}`} l="VP / FP / FN" />
          </div>
        </div>
      </div>
      <div className="panel" style={{ marginTop: 10 }}>
        <div className="panel-t">
          <span>F1, P e R conforme o limiar de confiança (0,05 a 0,95)</span>
        </div>
        <LineChart
          series={[
            { name: 'F1', data: f1.map((x) => x.F1), color: 'var(--ok)' },
            { name: 'P', data: f1.map((x) => x.P), color: '#131a9f' },
            { name: 'R', data: f1.map((x) => x.R), color: '#e0302a' },
          ]}
          ymin={0}
          ymax={1}
          height={150}
          xlabel="conf"
        />
        <Legend items={[{ name: 'F1', color: 'var(--ok)' }, { name: 'precisão', color: '#131a9f' }, { name: 'revocação', color: '#e0302a' }]} />
      </div>
    </Lab>
  )
}

/* ============ Lab 8.6 · contagem no brete com rastreamento ============ */

const BW = 360, BH = 150, LINHA = 180
type Boi = { t0: number; v: number; y: number; a: number; b: number; cor: string }
type Quadro = { bois: { x: number; y: number; a: number; b: number; cor: string }[]; dets: Box[]; tracks: Track[]; cruzaram: number; ids: number; verdade: number }

function simularBrete(seed: number, falha: number, maxAge: number, trave: boolean): Quadro[] {
  const R = rng(seed)
  const bois: Boi[] = []
  let t = 0
  for (let k = 0; k < 14; k++) {
    t += 10 + R() * 26 * (R() < 0.25 ? 0.4 : 1)
    bois.push({ t0: t, v: 1.6 + R() * 0.8, y: 75 + (R() - 0.5) * 16, a: 16 + R() * 3, b: 7.5 + R() * 1.5, cor: R() < 0.7 ? '#e8e2d4' : '#5a4030' })
  }
  const fim = Math.ceil(bois[bois.length - 1].t0 + (BW + 60) / 1.6)
  const out: Quadro[] = []
  let tracks: Track[] = []
  const nextId = { v: 1 }
  const contados = new Set<number>()
  for (let f = 0; f < fim; f++) {
    const vis = bois.map((b) => ({ x: -30 + (f - b.t0) * b.v, y: b.y, a: b.a, b: b.b, cor: b.cor })).filter((b) => b.x > -30 && b.x < BW + 30)
    const dets: Box[] = []
    for (const b of vis) {
      if (b.x < 0 || b.x > BW) continue
      if (trave && Math.abs(b.x - LINHA) < 14) continue // a trave da porteira cobre o animal
      if (R() < falha) continue
      const j = () => (R() - 0.5) * 2
      dets.push({ x0: b.x - b.a * 1.2 + j(), y0: b.y - b.b + j(), x1: b.x + b.a * 1.2 + j(), y1: b.y + b.b + j() })
    }
    tracks = trackStep(tracks, dets, 0.2, maxAge, nextId)
    for (const tr of tracks) {
      const h = tr.hist
      if (h.length >= 2 && !contados.has(tr.id) && h[h.length - 2].x < LINHA && h[h.length - 1].x >= LINHA) contados.add(tr.id)
    }
    const verdade = bois.filter((b) => -30 + (f - b.t0) * b.v >= LINHA).length
    out.push({ bois: vis, dets, tracks: tracks.filter((x) => x.age === 0), cruzaram: contados.size, ids: nextId.v - 1, verdade })
  }
  return out
}

function Brete() {
  const [seed, setSeed] = useState(4)
  const [falha, setFalha] = useState(0.1)
  const [maxAge, setMaxAge] = useState(0)
  const [trave, setTrave] = useState<'com trave sobre a linha' | 'sem trave'>('com trave sobre a linha')
  const qs = useMemo(() => simularBrete(seed, falha, maxAge, trave === 'com trave sobre a linha'), [seed, falha, maxAge, trave])
  const [f, setF] = useState(0)
  const [play, setPlay] = useState(false)
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => setF((x) => Math.min(x, qs.length - 1)), [qs])
  useEffect(() => {
    if (!play) return
    const id = setInterval(() => setF((x) => (x + 1 >= qs.length ? (setPlay(false), x) : x + 1)), 40)
    return () => clearInterval(id)
  }, [play, qs.length])
  const q = qs[Math.min(f, qs.length - 1)]
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const s = 2
    c.width = BW * s
    c.height = BH * s
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#8a7a62'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.fillStyle = '#6b5d49'
    ctx.fillRect(0, 0, c.width, 40 * s)
    ctx.fillRect(0, 110 * s, c.width, 40 * s)
    ctx.strokeStyle = '#3d3122'
    ctx.lineWidth = 4
    ;[40, 110].forEach((y) => {
      ctx.beginPath()
      ctx.moveTo(0, y * s)
      ctx.lineTo(c.width, y * s)
      ctx.stroke()
    })
    for (const b of q.bois) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.beginPath()
      ctx.ellipse((b.x + 3) * s, (b.y + 3) * s, b.a * s, b.b * s, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = b.cor
      ctx.beginPath()
      ctx.ellipse(b.x * s, b.y * s, b.a * s, b.b * s, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse((b.x + b.a * 1.05) * s, b.y * s, b.a * 0.3 * s, b.b * 0.55 * s, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    if (trave === 'com trave sobre a linha') {
      ctx.fillStyle = '#4a3a26'
      ctx.fillRect((LINHA - 14) * s, 30 * s, 28 * s, 90 * s)
    }
    ctx.strokeStyle = '#ffe000'
    ctx.setLineDash([8, 6])
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(LINHA * s, 30 * s)
    ctx.lineTo(LINHA * s, 120 * s)
    ctx.stroke()
    ctx.setLineDash([])
    for (const tr of q.tracks) {
      const cor = `hsl(${(tr.id * 67) % 360} 85% 55%)`
      ctx.strokeStyle = cor
      ctx.lineWidth = 2
      ctx.beginPath()
      tr.hist.forEach((p, i) => (i ? ctx.lineTo(p.x * s, p.y * s) : ctx.moveTo(p.x * s, p.y * s)))
      ctx.stroke()
      drawBox(ctx, s, tr.box, cor, { label: `id ${tr.id}` })
    }
  }, [q, trave])
  const final = qs[qs.length - 1]
  return (
    <Lab
      n="8.6"
      title="Contar bois passando no brete"
      desc="Câmera de cima, no corredor do curral. O detector perde alguns quadros (sujeira, poeira, a trave da porteira). O rastreador liga as caixas de um quadro ao outro e dá um número a cada animal; a contagem é feita quando a trilha cruza a linha amarela. O rastreador e a contagem rodam de verdade aqui."
    >
      <div className="controls">
        <button className="btn" type="button" onClick={() => (f >= qs.length - 1 ? (setF(0), setPlay(true)) : setPlay((p) => !p))}>
          {play ? <Pause size={15} /> : <Play size={15} />} {play ? 'Pausar' : 'Rodar'}
        </button>
        <button className="btn ghost" type="button" onClick={() => { setPlay(false); setF(0) }}>
          <RotateCcw size={15} /> Início
        </button>
        <button className="btn ghost" type="button" onClick={() => { setSeed((x) => x + 1); setF(0) }}>
          <Shuffle size={15} /> Outro lote
        </button>
        <Seg value={trave} options={['com trave sobre a linha', 'sem trave'] as const} onChange={setTrave} label="curral" />
      </div>
      <div className="controls">
        <Slider id="br-falha" label="falha do detector por quadro" value={falha} min={0} max={0.5} step={0.05} onChange={setFalha} fmt={(x) => `${Math.round(x * 100)}%`} />
        <Slider id="br-age" label="memória do rastreador (quadros)" value={maxAge} min={0} max={30} onChange={setMaxAge} />
        <Slider id="br-f" label="quadro" value={f} min={0} max={qs.length - 1} onChange={(v) => { setPlay(false); setF(v) }} />
      </div>
      <div className="lab-cols two">
        <div className="panel">
          <canvas ref={ref} className="cv" role="img" aria-label="corredor do curral visto de cima" />
        </div>
        <div className="panel">
          <div className="stats">
            <Stat v={`${q.verdade}`} l="bois que já passaram (verdade)" />
            <Stat v={`${q.cruzaram}`} l="contados ao cruzar a linha" cor={q.cruzaram === q.verdade ? 'var(--ok)' : 'var(--bad)'} />
            <Stat v={`${q.ids}`} l="números (ids) criados até agora" />
          </div>
          <div className="readout" style={{ marginTop: 8 }}>
            no fim do lote: {final.verdade} bois · contagem pela linha {final.cruzaram} · ids criados {final.ids}
          </div>
          <p className="note">
            Com memória zero, cada quadro perdido quebra a trilha: o animal ganha um número novo do outro lado da trave e não é contado (nasceu depois da linha). Contar ids inflaria a contagem. Aumente a memória e veja o
            rastreador "segurar" o animal atrás da trave, prevendo onde ele vai reaparecer. É isso que o <code>track_buffer</code> do ByteTrack controla.
          </p>
        </div>
      </div>
    </Lab>
  )
}

/* ============ conteúdo ============ */

const CODE_CVAT = `# o CVAT exporta tudo como "train"; aqui separamos por voo (o nome da tarefa vai no nome do arquivo)
import zipfile, shutil, glob, os
zipfile.ZipFile("cvat_export.zip").extractall("cvat")
VAL, TESTE = {"voo07", "voo08"}, {"voo09", "voo10"}
for img in glob.glob("cvat/images/train/*.jpg"):
    voo = os.path.basename(img).split("_")[0]
    destino = "val" if voo in VAL else "test" if voo in TESTE else "train"
    for pasta, ext in [("images", ".jpg"), ("labels", ".txt")]:
        orig = img.replace("images", pasta).replace(".jpg", ext)
        if os.path.exists(orig):
            os.makedirs(f"pasto/{pasta}/{destino}", exist_ok=True)
            shutil.copy(orig, f"pasto/{pasta}/{destino}/")
print(open("cvat/data.yaml").read())   # confira os nomes das classes antes de escrever o seu data.yaml`

const CODE_BUSCA = `# grade pequena: 2 tamanhos de imagem x 2 taxas de aprendizado, poucas épocas cada
import itertools
resultados = []
for imgsz, lr0 in itertools.product([480, 640], [0.01, 0.002]):
    m = YOLO("yolo26n.pt")
    m.train(data="pasto/data.yaml", epochs=20, imgsz=imgsz, lr0=lr0, optimizer="SGD",
            patience=5, name=f"grade_{imgsz}_{lr0}", plots=False, verbose=False)
    v = YOLO(f"{m.trainer.save_dir}/weights/best.pt").val(data="pasto/data.yaml", split="val")
    resultados.append((imgsz, lr0, v.box.map))         # mAP50-95 na VALIDAÇÃO
print(sorted(resultados, key=lambda t: -t[2]))

# ou deixe o ultralytics procurar sozinho (algoritmo genético, muitas rodadas: só com GPU e tempo)
# YOLO("yolo26n.pt").tune(data="pasto/data.yaml", epochs=10, iterations=30, plots=False)`

const CODE_SEGCLS = `# segmentação: rótulo = classe + polígono normalizado (x1 y1 x2 y2 ... xn yn)
seg = YOLO("yolo26n-seg.pt")
seg.train(data="pasto_seg/data.yaml", epochs=40, imgsz=640)
r = seg.predict("piquete.jpg")[0]
areas_px = [m.sum().item() for m in r.masks.data]      # área de cada animal, em pixels da máscara

# classificação: sem .txt, uma pasta por classe
#   recortes/train/bovino/*.jpg   recortes/train/cupinzeiro/*.jpg   recortes/val/...
cls = YOLO("yolo26n-cls.pt")
cls.train(data="recortes", epochs=20, imgsz=96)
print(cls.predict("recorte.jpg")[0].probs.top1)`

const CODE_TREINO = `# Aula 8 · treinar um YOLO no seu banco (no Colab, com GPU)
from ultralytics import YOLO

modelo = YOLO("yolo26n.pt")            # parte dos pesos do COCO: transfer learning
modelo.train(
    data="pasto/data.yaml",
    epochs=40, imgsz=640, batch=16,
    patience=15,                       # para cedo se o mAP de validação não melhorar
    fliplr=0.5, flipud=0.5,            # visto de cima, de ponta-cabeça também é boi
    mosaic=1.0,                        # aumento de dados feito na hora, a cada época
    name="pasto_n",
)
pasta = modelo.trainer.save_dir        # o ultralytics avisa no fim onde salvou
# lá dentro: results.csv, results.png, PR_curve.png, confusion_matrix.png, weights/best.pt`

const CODE_VAL = `# avaliar em teste, separado por fazenda (domínio)
melhor = YOLO(f"{pasta}/weights/best.pt")
for nome, yaml in [("fazenda A", "pasto/teste_A.yaml"), ("fazenda B", "pasto/teste_B.yaml")]:
    m = melhor.val(data=yaml, split="test", conf=0.001, iou=0.7, plots=False)
    print(nome, "mAP50 =", round(m.box.map50, 3), " mAP50-95 =", round(m.box.map, 3),
          " P =", round(m.box.mp, 3), " R =", round(m.box.mr, 3))

# erro de contagem: o que interessa ao produtor
import glob, numpy as np
erros = []
for img in sorted(glob.glob("pasto/images/test_B/*.jpg")):
    n_pred = len(melhor.predict(img, conf=0.35, verbose=False)[0].boxes)
    n_real = sum(1 for _ in open(img.replace("images", "labels").replace(".jpg", ".txt")))
    erros.append(n_pred - n_real)
print("erro médio absoluto de contagem:", np.mean(np.abs(erros)), "animais por foto")`

const CODE_CAMPO = `# do notebook para o curral
melhor = YOLO(f"{pasta}/weights/best.pt")

# 1) contar animais passando numa linha, num vídeo, com rastreamento
from ultralytics import solutions
contador = solutions.ObjectCounter(model=f"{pasta}/weights/best.pt",
                                   region=[(640, 0), (640, 720)])   # linha vertical no meio
# para cada quadro: resultado = contador(quadro); resultado.in_count, resultado.out_count
# ou, só o rastreio: melhor.track("brete.mp4", tracker="bytetrack.yaml", persist=True)

# 2) foto de drone grande: fatiar com SAHI
# !pip install sahi
from sahi import AutoDetectionModel
from sahi.predict import get_sliced_prediction
det = AutoDetectionModel.from_pretrained(model_type="ultralytics",   # em versões antigas do sahi: "yolov8"
                                         model_path=f"{pasta}/weights/best.pt", confidence_threshold=0.35)
r = get_sliced_prediction("ortomosaico.jpg", det, slice_height=640, slice_width=640,
                          overlap_height_ratio=0.2, overlap_width_ratio=0.2)
print(len(r.object_prediction_list), "animais")

# 3) exportar para rodar fora do Python
melhor.export(format="onnx")      # computador, servidor
melhor.export(format="tflite")    # celular, Raspberry Pi`

export const aula8: Aula = {
  id: 'aula8',
  n: 8,
  trilha: 'yolo',
  duracao: 180,
  titulo: 'Treinar, medir e levar pro campo',
  ideia: 'Treinar um YOLO são quatro linhas de código. O trabalho de verdade está antes (o banco e o split) e depois (as métricas certas, o teste em outra fazenda e a contagem no mundo real).',
  ementa: ['Rotular no CVAT', 'Banco e data.yaml', 'Split por grupo', 'GSD, imgsz e fatias', 'Treino com transfer learning', 'Parada antecipada', 'Grid e random search', 'P, R, PR, mAP50, mAP50-95', 'Mudança de domínio', 'Rastreamento e contagem', 'Exportar'],
  labs: ['O doutor do rótulo', 'Pequeno demais', 'Parar na hora certa', 'Grade ou sorteio?', 'Medindo um detector', 'Contar no brete'],
  cor: ['#131a9f', '#e0302a', '#ff8a00', '#1fae4b'],
  objetivos: [
    'Rotular imagens e vídeos no CVAT (projeto, tarefa, retângulo, polígono, track) e exportar no formato Ultralytics YOLO.',
    'Usar a parada antecipada (patience) e comparar busca em grade e busca aleatória de hiperparâmetros, sem gastar o conjunto de teste.',
    'Montar um banco no formato YOLO (pastas, .txt, data.yaml) e validar os rótulos antes do treino.',
    'Separar treino, validação e teste por voo ou fazenda, e explicar o vazamento de frames vizinhos.',
    'Relacionar GSD, imgsz e tamanho do objeto e escolher entre voar mais baixo, aumentar imgsz ou fatiar.',
    'Treinar um yolo26n no Colab e ler results.csv, curva PR e matriz de confusão.',
    'Calcular e interpretar P, R, F1, mAP50 e mAP50-95, e o erro de contagem que importa ao produtor.',
    'Testar o modelo em outro domínio e contar animais em vídeo com rastreamento.',
  ],
  roteiro: [
    { t: 'Gancho: o modelo de 95% que falhou', min: 10, tipo: 'gancho' },
    { t: 'Rotular no CVAT', min: 20, tipo: 'lab' },
    { t: 'Banco e split: Lab 8.1', min: 15, tipo: 'conceito' },
    { t: 'Objeto pequeno: Lab 8.2', min: 15, tipo: 'lab' },
    { t: 'Colab: treinar o yolo26n', min: 20, tipo: 'lab' },
    { t: 'Intervalo (o treino roda)', min: 15, tipo: 'pausa' },
    { t: 'Early stopping e busca: Labs 8.3 e 8.4', min: 25, tipo: 'conceito' },
    { t: 'Métricas: Lab 8.5', min: 20, tipo: 'conceito' },
    { t: 'Caso real: espigas de trigo pelo mundo', min: 10, tipo: 'conceito' },
    { t: 'Rastrear e contar: Lab 8.6', min: 15, tipo: 'lab' },
    { t: 'Colab: fazenda B, segmentar, exportar', min: 10, tipo: 'lab' },
    { t: 'Fechamento + quiz', min: 5, tipo: 'fecho' },
  ],
  secoes: [
    {
      id: 'a8-gancho',
      titulo: 'O modelo de 95% que falhou na fazenda do vizinho',
      min: 10,
      body: (
        <div className="prose">
          <p>
            Cena comum: alguém treina um detector com fotos de uma fazenda, separa 20% das fotos ao acaso para teste e comemora um mAP50 de 0,95. Leva para a fazenda do vizinho, com gado de outra raça, outro capim e o
            voo feito à tarde, e a contagem erra por 30%.
          </p>
          <p>
            Ninguém errou o código. O erro estava no <b>banco</b> (só uma fazenda) e no <b>teste</b> (fotos do mesmo voo dos dois lados). É a validação por grupo da Aula 5 e o atalho da Aula 6, agora com caixas. Hoje
            vamos treinar um YOLO de verdade e medir do jeito certo.
          </p>
          <Callout kind="prof" title="Nota pra quem dá a aula">
            <p>
              Comece já pelo Colab: peça para todos abrirem o <a href={NB8} target="_blank" rel="noreferrer">notebook da Aula 8</a> com GPU e rodarem as células de instalação e de geração do banco enquanto você fala do
              gancho. O treino vai rodar durante o intervalo.
            </p>
          </Callout>
        </div>
      ),
    },
    {
      id: 'a8-cvat',
      titulo: 'Rotular no CVAT',
      min: 20,
      body: (
        <div className="prose">
          <p>
            Todo detector começa com alguém desenhando caixas. O <b>CVAT</b> (Computer Vision Annotation Tool) é gratuito, de código aberto e roda no navegador: dá para usar a versão hospedada em{' '}
            <a href="https://app.cvat.ai" target="_blank" rel="noreferrer">app.cvat.ai</a> ou instalar no servidor do laboratório com Docker, o que importa quando as fotos não podem sair da fazenda. Ele rotula
            caixas, polígonos, pontos e caixas giradas, em fotos e em vídeo, e exporta direto no formato do ultralytics.
          </p>
          <Figura n="8.1" legenda="O caminho no CVAT: do projeto com os rótulos até o .zip pronto para treinar.">
            <FigCVAT />
          </Figura>
          <h3>Passo a passo</h3>
          <ol>
            <li>
              <b>Crie um projeto</b> e defina os rótulos uma vez só, na ordem que vai virar o índice da classe: <code>bovino</code> (0), <code>cupinzeiro</code> (1) se quiser ensinar o modelo a separar os dois.
              Escolha o tipo de forma: retângulo para detecção, polígono para segmentação.
            </li>
            <li>
              <b>Crie uma tarefa por voo</b> (ou por dia, por fazenda) dentro do projeto e suba as fotos ou o vídeo. Uma tarefa por voo facilita o split por grupo depois, e permite dividir o trabalho entre rotuladores.
            </li>
            <li>
              <b>Anote.</b> Escolha o retângulo, clique nos dois cantos opostos do animal, confira o rótulo. Para o próximo, <kbd>N</kbd> desenha de novo com a mesma forma. <kbd>F</kbd> e <kbd>D</kbd> passam para a
              próxima e para a anterior imagem. Salve com <kbd>Ctrl+S</kbd> com frequência.
            </li>
            <li>
              <b>Em vídeo, use track.</b> Desenhe a caixa no primeiro quadro como <i>track</i>, avance uns 10 quadros, ajuste a caixa; o CVAT interpola as posições entre os quadros-chave. Rotular um vídeo de brete fica
              10 vezes mais rápido.
            </li>
            <li>
              <b>Revise.</b> Outra pessoa abre a tarefa no modo de revisão e marca problemas. É aqui que aparecem as caixas frouxas e os animais esquecidos que derrubam o mAP50-95.
            </li>
            <li>
              <b>Exporte</b> em <i>Exportar conjunto de dados</i>, escolhendo o formato <b>Ultralytics YOLO Detection</b> (há também Segmentation, Pose e Oriented Bounding Boxes). Sai um .zip com o{' '}
              <code>data.yaml</code>, a pasta <code>images/</code> e a pasta <code>labels/</code>, um .txt por imagem.
            </li>
          </ol>
          <h3>Uma ferramenta, três tarefas</h3>
          <p>O mesmo projeto do CVAT serve para classificar, segmentar e detectar. O que muda é a forma que você desenha e o formato que escolhe na exportação:</p>
          <div className="tbl-wrap">
            <table className="tbl wrap1">
              <thead>
                <tr>
                  <th>tarefa</th>
                  <th>no CVAT, desenhe</th>
                  <th>exporte como</th>
                  <th>vira</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>classificação</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>uma <b>tag</b> na imagem inteira (sadia, ferrugem)</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>Ultralytics YOLO Classification</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>uma pasta por classe, sem .txt</td>
                </tr>
                <tr>
                  <td>detecção</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}><b>retângulos</b> (ou tracks, em vídeo)</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>Ultralytics YOLO Detection</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>
                    <code>classe cx cy w h</code>
                  </td>
                </tr>
                <tr>
                  <td>segmentação</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}><b>polígonos</b> ou máscaras com pincel</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>Ultralytics YOLO Segmentation</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>
                    <code>classe x1 y1 ... xn yn</code>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Rotule pensando na tarefa mais rica que você pode precisar: de um polígono dá para tirar a caixa (é o menor retângulo que o contém) e a classe da foto; do retângulo não dá para voltar ao polígono. Por outro
            lado, um polígono leva umas cinco vezes mais tempo para desenhar. No CVAT, as ferramentas de IA (como o SAM) sugerem o contorno com um clique e você só corrige.
          </p>
          <Figura n="8.2" legenda="Esquema da tela de anotação: ferramentas à esquerda, imagem no centro, lista de objetos e atalhos à direita.">
            <FigTelaCVAT />
          </Figura>
          <Callout kind="pegadinha" title="O export não faz o seu split">
            <p>
              O CVAT coloca tudo no subconjunto que você definiu (por padrão, <code>train</code>). Separar treino, validação e teste é com você, por voo ou por fazenda, antes de treinar. Abra o <code>data.yaml</code>{' '}
              exportado, confira os nomes das classes e aponte <code>val</code> para os voos que separou. Depois, passe tudo pelo doutor do rótulo do Lab 8.1.
            </p>
          </Callout>
          <Code code={CODE_CVAT} title="Python · do .zip do CVAT para um banco com split por voo" />
          <Callout kind="prof" title="Nota pra quem dá a aula · 15 min">
            <p>
              Antes da aula, crie um projeto no app.cvat.ai com uma tarefa de 20 fotos (podem ser os piquetes do notebook) e convide a turma. Em duplas, cada um rotula 5 fotos; depois um revisa o do outro. Exportem e
              abram o .zip juntos. Se não houver internet boa, use o Lab 7.3, que faz o mesmo papel em escala menor.
            </p>
          </Callout>
          <p className="note">
            Alternativas: Label Studio (também aberto), Roboflow (na nuvem, com cota gratuita e exportação direta para YOLO) e a própria plataforma do ultralytics. O formato do .txt é o mesmo em todas.
          </p>
        </div>
      ),
    },
    {
      id: 'a8-banco',
      titulo: 'O banco vem antes do modelo',
      min: 15,
      body: (
        <div className="prose">
          <p>
            O ultralytics espera duas pastas irmãs, <code>images</code> e <code>labels</code>, com os mesmos nomes de arquivo, e um <code>data.yaml</code> dizendo onde estão os conjuntos e quais são as classes. Uma imagem
            sem nenhum animal entra com um .txt vazio (ou sem .txt): ela ensina o modelo a não ver boi em cupinzeiro.
          </p>
          <DoutorRotulo />
          <p>Três regras que separam um banco bom de um banco que engana:</p>
          <ol>
            <li>
              <b>Regra de rotulagem escrita</b> antes de começar (o que entra na caixa, o que fazer com animal cortado pela borda ou sob a árvore). Dois rotuladores, mesma regra.
            </li>
            <li>
              <b>Split por grupo</b>: treino, validação e teste separados por voo, por dia ou por fazenda, nunca foto a foto. Frames vizinhos de um vídeo são quase a mesma imagem; se um fica no treino e o outro no teste, o
              teste vira decoreba.
            </li>
            <li>
              <b>Aumento de dados depois do split</b>, e de preferência na hora do treino (o ultralytics já faz: mosaico, espelhamento, mudança de cor). Aumentar antes de separar coloca a mesma foto girada nos dois lados.
            </li>
          </ol>
          <Callout kind="campo">
            <p>
              Quantas imagens? Para uma classe só e um cenário parecido com o do teste, algumas centenas de imagens com alguns milhares de caixas já dão um detector útil partindo dos pesos do COCO. Para generalizar entre
              fazendas, importa mais ter <b>muitas fazendas</b> do que muitas fotos da mesma.
            </p>
          </Callout>
        </div>
      ),
    },
    {
      id: 'a8-pequeno',
      titulo: 'Objeto pequeno, foto grande',
      min: 15,
      body: (
        <div className="prose">
          <p>
            Na Aula 4 a gente calculou o GSD do drone: quantos centímetros do chão cabem num pixel. Em detecção esse número decide tudo, porque o YOLO não olha a foto original. Ele <b>redimensiona</b> a foto para{' '}
            <code>imgsz</code> (640 por padrão) e só então procura objetos. Uma foto de 5472 pixels de largura encolhe mais de 8 vezes.
          </p>
          <PequenoDemais />
          <Callout kind="pegadinha">
            <p>
              Treinou com fatias de 640 recortadas da foto original e na hora de usar passou a foto inteira para o <code>predict</code>? O modelo vê bois 8 vezes menores do que aprendeu. O tamanho do objeto, em pixels do
              modelo, tem que ser parecido no treino e no uso.
            </p>
          </Callout>
        </div>
      ),
    },
    {
      id: 'a8-treino',
      titulo: 'Treinar: quatro linhas e muita paciência',
      min: 20,
      body: (
        <div className="prose">
          <p>
            O notebook gera um banco de piquetes sintéticos parecido com o dos labs, com <b>10 voos na fazenda A</b> e <b>3 voos na fazenda B</b>, já separados por voo. Treinamos só com a fazenda A, partindo do{' '}
            <code>yolo26n.pt</code>. Numa T4 do Colab, 40 épocas levam uns 5 a 10 minutos.
          </p>
          <Code code={CODE_TREINO} title="Python · ultralytics" />
          <p>Enquanto treina, leia o <code>results.csv</code> que vai sendo escrito:</p>
          <ul>
            <li>
              <code>box_loss</code>: o quanto as caixas erram de posição e tamanho (perda de IoU). <code>cls_loss</code>: o quanto erram a classe e a confiança.
            </li>
            <li>Se a perda de treino cai e a de validação sobe, é sobreajuste: o modelo está decorando os voos de treino.</li>
            <li>
              <code>metrics/mAP50(B)</code> e <code>metrics/mAP50-95(B)</code> na validação: o <code>best.pt</code> é a época com o melhor valor combinado.
            </li>
          </ul>
          <Callout kind="analogia">
            <p>
              Transfer learning é contratar um peão que já sabe lidar com gado em outro estado. Ele não precisa aprender o que é boi, só o jeito do seu pasto. Treinar do zero é ensinar alguém que nunca viu um animal.
            </p>
          </Callout>
        </div>
      ),
    },
    {
      id: 'a8-pausa',
      titulo: 'Intervalo',
      min: 15,
      body: (
        <div className="prose">
          <p>Quinze minutos. Deixe o Colab aberto: o treino continua. Na volta, a primeira coisa é abrir o <code>results.png</code> na pasta que o ultralytics indicou no fim do treino.</p>
        </div>
      ),
    },
    {
      id: 'a8-hiper',
      titulo: 'Até quando treinar e com quais hiperparâmetros',
      min: 25,
      body: (
        <div className="prose">
          <p>
            Na volta do intervalo, abra o <code>results.png</code> do seu treino. Vão aparecer duas perguntas que todo projeto de ML enfrenta: <b>até que época treinar</b> e <b>com quais hiperparâmetros</b> (taxa de
            aprendizado, tamanho da imagem, tamanho do modelo, aumento de dados). Os pesos a rede aprende sozinha; os hiperparâmetros somos nós que escolhemos, olhando a validação.
          </p>
          <Figura n="8.3" legenda="O laço de treino: a cada época, mede na validação, guarda o melhor e decide se para. A busca de hiperparâmetros repete o laço inteiro.">
            <FigLacoTreino />
          </Figura>
          <h3>Parada antecipada (early stopping)</h3>
          <p>
            Com épocas demais, a rede começa a decorar os exemplos de treino, inclusive o ruído: a perda de treino continua caindo, mas a de validação para de cair e sobe. A <b>parada antecipada</b> acompanha a
            validação e para o treino quando ela fica um número de épocas sem melhorar, a <b>paciência</b>. Os pesos que valem são os da melhor época, não os da última. Na prática, é a forma de regularização mais usada
            em redes profundas, porque é de graça: só exige separar a validação.
          </p>
          <ParadaLab />
          <p>
            No ultralytics, isso é o argumento <code>patience</code> (padrão 100 épocas) e o arquivo <code>best.pt</code>, que é sempre o da melhor época de validação; o <code>last.pt</code> é o da última.
          </p>
          <h3>Busca em grade (grid search) e busca aleatória (random search)</h3>
          <p>
            Para escolher hiperparâmetros, a <b>busca em grade</b> define alguns valores para cada um e treina todas as combinações. É simples e fácil de explicar no artigo, mas cresce como produto: 4 hiperparâmetros com
            5 valores cada são 625 treinos. A <b>busca aleatória</b> sorteia combinações dentro das mesmas faixas, com o orçamento que você tiver. Como em geral só um ou dois hiperparâmetros importam muito, ela
            experimenta mais valores diferentes deles e costuma achar algo tão bom quanto a grade com bem menos treinos (Bergstra e Bengio, 2012).
          </p>
          <BuscaLab />
          <p>
            Dá para juntar as duas ideias: treine todas as configurações por poucas épocas, descarte a metade pior, continue as que sobraram e repita (a ideia do <i>successive halving</i> e do Hyperband). Taxa de
            aprendizado se busca em escala logarítmica (0,001, 0,003, 0,01...), nunca em passos iguais.
          </p>
          <Code code={CODE_BUSCA} title="Python · grade pequena com ultralytics e o tuner embutido" />
          <Callout kind="pegadinha">
            <p>
              Toda escolha feita olhando a validação, inclusive a época do best.pt e o conf ideal, “gasta” a validação. Por isso existem três conjuntos: treino para os pesos, validação para as escolhas e teste, tocado uma
              vez no fim, para o número do artigo.
            </p>
          </Callout>
          <Callout kind="campo">
            <p>
              Para um YOLO com algumas centenas de fotos, a ordem de ganho costuma ser: mais fotos e de mais fazendas &gt; rótulos consistentes &gt; imgsz certo para o tamanho do objeto &gt; tamanho do modelo (n, s,
              m) &gt; o resto dos hiperparâmetros. Não gaste a GPU do Colab numa grade de 50 treinos antes de olhar os rótulos.
            </p>
          </Callout>
        </div>
      ),
    },
    {
      id: 'a8-metricas',
      titulo: 'Precisão, revocação e mAP',
      min: 20,
      body: (
        <div className="prose">
          <p>Com as detecções casadas à verdade pelo IoU (Aula 7), cada caixa vira verdadeiro positivo (VP) ou falso positivo (FP), e cada animal sem caixa vira falso negativo (FN). Daí:</p>
          <ul>
            <li>
              <b>Precisão</b> P = VP / (VP + FP): das caixas que o modelo desenhou, quantas eram boi.
            </li>
            <li>
              <b>Revocação</b> R = VP / (VP + FN): dos bois que existiam, quantos o modelo achou.
            </li>
            <li>
              <b>Curva PR</b>: P e R para todos os limiares de confiança. Baixar o <code>conf</code> anda para a direita (mais revocação) e para baixo (menos precisão).
            </li>
            <li>
              <b>AP</b>: a área sob a curva PR, de 0 a 1. O <Term def="mean Average Precision: média do AP de todas as classes. Com uma classe só, mAP = AP.">mAP</Term>50 usa IoU 0,5 para contar acerto; o mAP50-95
              é a média do AP com IoU de 0,50 a 0,95 (passo 0,05), e cobra caixas bem ajustadas.
            </li>
          </ul>
          <Medidor />
          <Callout kind="prof" title="Nota pra quem dá a aula · 3 perguntas para a turma">
            <p>
              (1) Por que o mAP não depende do slider de confiança e o P, R e a contagem dependem? (2) Na fazenda B, o que caiu mais, a precisão ou a revocação, e por quê (olhe as cores)? (3) Para o produtor, que conta o
              rebanho uma vez por mês, qual número da tela importa mais?
            </p>
          </Callout>
          <Callout kind="pegadinha">
            <p>
              mAP alto não garante contagem certa: um modelo pode ter ótimo mAP e errar a contagem se o <code>conf</code> estiver mal escolhido. E contagem certa pode esconder erros que se cancelam (três bois perdidos e três
              cupinzeiros contados). Reporte as duas coisas.
            </p>
          </Callout>
        </div>
      ),
    },
    {
      id: 'a8-caso',
      titulo: 'Caso real: espigas de trigo pelo mundo',
      min: 10,
      body: (
        <div className="prose">
          <Caso
            tipo="artigo e banco público"
            titulo="Global Wheat Head Detection (GWHD) dataset"
            autores="David, E. et al. (9 instituições de 7 países)"
            onde="Plant Phenomics, 2020"
            link="https://arxiv.org/abs/2005.02162"
            resumo={
              <p>
                Um banco de fotos de trigo no campo com cada espiga marcada por uma caixa, montado justamente para medir se o detector <b>generaliza</b>. Na divisão usada pelo ultralytics, o treino tem fotos da Europa e do
                Canadá, e o teste tem fotos da Austrália, do Japão e da China: outras variedades, outros estádios, outra luz.
              </p>
            }
            pipeline={[
              'Fotos RGB de alta resolução tiradas por câmeras em campo, em vários países',
              'Rotulagem com regras comuns para todas as instituições',
              'Divisão por região: treinar num grupo de países e testar em outros',
              'Competição pública que mostrou a queda dos modelos fora do domínio de treino',
              'No ultralytics: data="GlobalWheat2020.yaml", baixado automaticamente',
            ]}
            numeros={[
              { v: '4.700', l: 'imagens' },
              { v: '190 mil', l: 'espigas rotuladas' },
              { v: '7', l: 'países' },
              { v: 'por região', l: 'divisão treino × teste' },
            ]}
            discutir={[
              'Por que separar o teste por país e não ao acaso? Que pergunta cada divisão responde?',
              'Espigas sobrepostas e borradas pelo vento: o que isso faz com o NMS e com o mAP50-95?',
              'Se vocês fossem montar um "GWHD da soja" no Paraná, de onde viriam as fotos de teste?',
            ]}
          />
          <p className="note">Para quem tiver GPU e tempo: o notebook traz a célula para treinar no GWHD (o banco tem alguns gigabytes, então não rode em sala).</p>
        </div>
      ),
    },
    {
      id: 'a8-campo',
      titulo: 'Do notebook para o curral',
      min: 15,
      body: (
        <div className="prose">
          <p>
            Para contar animais em vídeo, detectar quadro a quadro não basta: o mesmo boi aparece em 80 quadros. É preciso <b>rastrear</b>, ou seja, dar um número a cada animal e segui-lo. Os rastreadores do ultralytics
            (ByteTrack e BoT-SORT) fazem isso prevendo para onde cada animal vai (filtro de Kalman) e casando a previsão com as novas caixas pelo IoU.
          </p>
          <Brete />
          <Code code={CODE_CAMPO} title="Python · ultralytics, SAHI, exportação" />
          <h3>E se a pergunta pedir máscara ou só uma classe?</h3>
          <p>
            Tudo o que fizemos vale para as outras tarefas do YOLO (Figura 7.8). Para segmentar, rotule polígonos no CVAT e exporte como <i>Ultralytics YOLO Segmentation</i>; para classificar, separe as fotos em uma
            pasta por classe. O notebook gera os dois bancos a partir dos mesmos piquetes e treina um <code>yolo26n-seg</code> e um <code>yolo26n-cls</code>.
          </p>
          <Figura n="8.4" legenda="O mesmo fluxo serve para segmentar, classificar, pose e caixas giradas: muda o arquivo de pesos e o rótulo.">
            <FigTarefasYolo />
          </Figura>
          <Code code={CODE_SEGCLS} title="Python · segmentar e classificar com o mesmo ultralytics" />
          <Callout kind="campo">
            <p>
              Onde o modelo vai rodar decide a versão: o <code>yolo26n</code> (nano) roda em CPU de celular e em placas como Raspberry Pi; o <code>yolo26m</code> ou maior pede GPU. No brete, latência de alguns quadros
              por segundo basta; no pulverizador que aplica só onde há daninha, a decisão tem que sair antes do bico passar.
            </p>
          </Callout>
        </div>
      ),
    },
    {
      id: 'a8-colab',
      titulo: 'Mão na massa: a fazenda B',
      min: 10,
      body: (
        <div className="prose">
          <p>
            Volte ao <a href={NB8} target="_blank" rel="noreferrer">notebook</a>: avalie o <code>best.pt</code> no teste da fazenda A e nos voos da fazenda B. Anote mAP50, mAP50-95 e o erro de contagem dos dois. Depois
            rode a célula opcional que coloca dois voos da fazenda B no treino e compare. Quase sempre, um pouco de dado do domínio novo vale mais que muitas épocas a mais.
          </p>
          <Code code={CODE_VAL} title="Python · ultralytics" />
        </div>
      ),
    },
    {
      id: 'a8-fecho',
      titulo: 'Pra levar pra casa',
      min: 5,
      body: (
        <div className="prose">
          <ol>
            <li>Valide os rótulos desenhando de volta. Um formato trocado não dá erro, dá mAP zero.</li>
            <li>Split por voo, dia ou fazenda. Aumento de dados só no treino.</li>
            <li>GSD e imgsz decidem se o objeto existe para o modelo. Abaixo de 8 pixels, ele some.</li>
            <li>mAP50 mede achar; mAP50-95 mede achar e ajustar a caixa. Para o produtor, reporte também o erro de contagem.</li>
            <li>O teste que importa é em outra fazenda. Para contar em vídeo, rastreie e conte na linha.</li>
          </ol>
        </div>
      ),
    },
  ],
  quiz: [
    {
      p: 'No CVAT, você criou uma tarefa por voo e exportou em Ultralytics YOLO Detection. O que ainda falta antes de treinar?',
      o: ['Nada, o export já separa treino e validação por voo', 'Separar treino, validação e teste por voo e conferir as classes no data.yaml', 'Converter para COCO', 'Redimensionar as fotos para 640'],
      a: 1,
      e: 'O export põe tudo num subconjunto só. O split por grupo e a conferência do data.yaml (e dos rótulos desenhados de volta) são seus.',
    },
    {
      p: 'Com patience=50, a validação foi melhor na época 120 e o treino parou na 170. Qual peso você usa?',
      o: ['last.pt, da época 170', 'best.pt, da época 120', 'A média dos dois', 'Treina de novo até 300'],
      a: 1,
      e: 'O best.pt guarda a melhor época de validação. As 50 épocas seguintes só confirmaram que não ia melhorar.',
    },
    {
      p: 'Você tem orçamento para 9 treinos e 3 hiperparâmetros, mas suspeita que só a taxa de aprendizado importa. Qual busca tende a ir melhor?',
      o: ['Grade 3 × 3 × 1', 'Aleatória com 9 sorteios', 'Grade só nos dois que não importam', 'Tanto faz'],
      a: 1,
      e: 'A grade testaria só 3 valores de taxa; a busca aleatória testa 9 valores diferentes dela com o mesmo orçamento.',
    },
    {
      p: 'Um banco tem 30 vídeos de drone e 3 mil frames. Qual divisão dá a estimativa mais honesta do desempenho em campo?',
      o: ['Sortear 20% dos frames para teste', 'Separar 6 vídeos inteiros para teste', 'Usar os mesmos frames com aumento de dados para teste', 'Testar no conjunto de treino com conf mais alto'],
      a: 1,
      e: 'Frames de um mesmo vídeo são quase idênticos. Separar por vídeo (ou por voo, fazenda) impede que o teste veja cópias do treino.',
    },
    {
      p: 'Drone a 100 m com GSD de 2,7 cm/px, foto de 5472 px reduzida para imgsz 640. Um bezerro de 1,2 m fica com quantos pixels de comprimento no modelo?',
      o: ['Uns 44 px', 'Uns 5 px', 'Uns 120 px', 'Uns 640 px'],
      a: 1,
      e: '1,2 m / 0,027 m ≈ 44 px na foto original. Reduzindo 5472 → 640 (fator ≈ 0,117), sobram uns 5 px: menor que uma célula da P3.',
    },
    {
      p: 'O modelo tem mAP50 = 0,92 e mAP50-95 = 0,48. O que isso diz?',
      o: ['Ele quase não acha os animais', 'Ele acha os animais, mas as caixas ficam frouxas', 'Ele tem muitos falsos positivos', 'O banco está mal rotulado com certeza'],
      a: 1,
      e: 'Acha bem com IoU 0,5, mas o AP cai quando se exige IoU de 0,75 a 0,95: as caixas não encaixam bem. Pode ser rótulo inconsistente, mas não necessariamente.',
    },
    {
      p: 'Na fazenda B do Lab 8.5, por que a revocação cai mais que a precisão?',
      o: ['Porque há menos bois', 'Porque o modelo nunca viu gado escuro e deixa de achar esses animais', 'Porque o IoU muda de definição', 'Porque o NMS está desligado'],
      a: 1,
      e: 'O gado escuro sobre solo exposto é fora do domínio de treino: o modelo dá confiança baixa e esses animais viram falsos negativos. Os cupinzeiros a mais também derrubam um pouco a precisão.',
    },
    {
      p: 'Contando bois no brete por número de ids criados pelo rastreador, a contagem fica acima da real. O motivo mais provável é:',
      o: ['O detector acha bois demais', 'As trilhas quebram quando o detector falha e o mesmo animal ganha um id novo', 'O vídeo tem quadros demais', 'O YOLO26 não tem NMS'],
      a: 1,
      e: 'Cada quebra de trilha cria um id novo para o mesmo animal. Por isso conta-se o cruzamento de uma linha, e aumenta-se a memória do rastreador (track_buffer).',
    },
  ],
  desafios: [
    {
      nivel: 'Aquecimento',
      txt: <>No notebook, mude imgsz de 640 para 320 e treine de novo. Compare mAP50, mAP50-95 e o erro de contagem nos bezerros. Explique com o Lab 8.2.</>,
    },
    {
      nivel: 'Médio',
      txt: <>Rotule 50 fotos reais (do seu celular, de um aviário, de um pomar, de uma bandeja de sementes) no CVAT ou no Roboflow, treine um yolo26n e reporte mAP50, mAP50-95 e erro de contagem com split por dia de coleta.</>,
    },
    {
      nivel: 'Desafio',
      txt: (
        <>
          Retome a contagem de frangos da Aula 2 (Berlanda, 2015) e a ferramenta de densidade de aves de Algeri et al. (2018, nas Leituras da casa). Proponha, por escrito, como substituir a receita por um YOLO: que
          rótulo, que split, que métrica e que limite de erro tornaria o sistema útil para o avicultor.
        </>
      ),
    },
  ],
  leitura: [
    <>
      CVAT: <a href="https://docs.cvat.ai/docs/dataset_management/formats/format-yolo-ultralytics/" target="_blank" rel="noreferrer">formato Ultralytics YOLO</a> (detecção, segmentação, pose, OBB e o data.yaml exportado) e o
      quickstart do projeto à exportação. Tutorial da Roboflow sobre o CVAT, com o fluxo completo.
    </>,
    <>
      Ultralytics: <a href="https://docs.ultralytics.com/tasks/" target="_blank" rel="noreferrer">tarefas</a> (detectar, segmentar, classificar, pose, OBB) e a{' '}
      <a href="https://docs.ultralytics.com/platform/integrations/cvat" target="_blank" rel="noreferrer">integração com o CVAT</a>.
    </>,
    <>Cornell CS4780, notas de <i>Model Selection</i> (grid search, random search e early stopping). Cornell CS6787 (2026), ajuste de hiperparâmetros, com o descarte da metade pior a cada rodada.</>,
    <>Buffalo, Prof. Srihari, slides sobre early stopping, com curvas de aprendizado e a comparação com a regularização L2. LMU Munique (I2ML), grid search contra random search.</>,
    <>BERGSTRA, J.; BENGIO, Y. Random search for hyper-parameter optimization. JMLR, 2012.</>,
    <>DAVID, E. et al. Global Wheat Head Detection (GWHD) dataset: a large and diverse dataset of high resolution RGB labelled images to develop and benchmark wheat head detection methods. Plant Phenomics, 2020.</>,
    <>
      Documentação do ultralytics: <a href="https://docs.ultralytics.com/modes/train/" target="_blank" rel="noreferrer">treino</a>, <a href="https://docs.ultralytics.com/guides/yolo-performance-metrics/" target="_blank" rel="noreferrer">métricas</a>,{' '}
      <a href="https://docs.ultralytics.com/modes/track/" target="_blank" rel="noreferrer">rastreamento</a> e <a href="https://docs.ultralytics.com/datasets/detect/globalwheat2020/" target="_blank" rel="noreferrer">GlobalWheat2020</a>.
    </>,
    <>ZHANG, Y. et al. ByteTrack: multi-object tracking by associating every detection box. ECCV, 2022.</>,
    <>AKYON, F. C.; ALTINUC, S. O.; TEMIZEL, A. Slicing Aided Hyper Inference and fine-tuning for small object detection (SAHI). ICIP, 2022.</>,
    <>Aula 5 deste site (validação por grupo) e Aula 6 (aprendizado por atalho): os dois conceitos voltam aqui com caixas.</>,
  ],
}

