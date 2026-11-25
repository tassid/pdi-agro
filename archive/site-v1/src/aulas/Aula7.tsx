import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Shuffle, Undo2, Trash2, Download, StepForward, RotateCcw, Copy } from 'lucide-react'
import { type RGB, newRGB, toImageData, CAT } from '../lib/img'
import { makePasto, simDetector, iou, inter, nms, matchImage, yoloLine, PW, type Box, type Det, type Fazenda, type Arranjo } from '../lib/yolo'
import { ImgCanvas, Seg, Slider, Lab, Callout, Term, Code, Caso } from '../ui'
import { memo } from '../samples'
import { COR, drawBox, Stat, Chave } from './detui'
import type { Aula } from '../lesson'
import { PerceptronLab } from './labsNeuro'
import { Figura, FigTarefas, FigPerceptron, FigLinhaTempo, FigMLPCNN, FigDoisEstagios, FigUNet, FigArquitetura, FigTarefasYolo } from './figuras'

const FAZ_A: Fazenda = 'A · nelore em pasto verde'
export const pasto = (seed: number, faz: Fazenda = FAZ_A, arr: Arranjo = 'espalhado') => memo(`pasto${seed}-${faz}-${arr}`, () => makePasto(seed, faz, arr))

const NB7 = 'https://colab.research.google.com/github/tassid/pdi-agro/blob/main/notebooks/Aula7_YOLO_Deteccao.ipynb'

/* ============ Lab 7.2 · três perguntas, três saídas ============ */

function TresSaidas() {
  const [modo, setModo] = useState<'classificação' | 'segmentação semântica' | 'detecção' | 'segmentação de instâncias'>('detecção')
  const [seed, setSeed] = useState(3)
  const p = pasto(seed)
  const seg = useMemo(() => {
    const o: RGB = newRGB(p.w, p.h)
    for (let i = 0; i < p.w * p.h; i++) {
      const k = p.inst[i]
      for (let c = 0; c < 3; c++) o.data[i * 3 + c] = k < 0 ? p.img.data[i * 3 + c] * 0.45 : CAT[k % CAT.length][c]
    }
    return o
  }, [p])
  const sem = useMemo(() => {
    const o: RGB = newRGB(p.w, p.h)
    for (let i = 0; i < p.w * p.h; i++) {
      const k = p.inst[i]
      const c3 = k < 0 ? [p.img.data[i * 3] * 0.45, p.img.data[i * 3 + 1] * 0.45, p.img.data[i * 3 + 2] * 0.45] : [255, 224, 0]
      for (let c = 0; c < 3; c++) o.data[i * 3 + c] = c3[c]
    }
    return o
  }, [p])
  const overlay = useCallback(
    (ctx: CanvasRenderingContext2D, s: number) => {
      if (modo === 'classificação') {
        ctx.fillStyle = 'rgba(19,26,159,0.88)'
        ctx.fillRect(0, 0, ctx.canvas.width, 34)
        ctx.fillStyle = '#fff'
        ctx.font = '600 16px Arial'
        ctx.fillText('classe da imagem: "pasto com bovinos" · confiança 0,97', 10, 22)
      }
      if (modo === 'detecção') p.gts.forEach((b) => drawBox(ctx, s, b, COR.verdade, { label: 'bovino', lw: 2 }))
    },
    [modo, p],
  )
  const resposta = modo === 'classificação' ? 'tem boi? sim' : modo === 'segmentação semântica' ? 'quais pixels são boi? 1 máscara' : modo === 'detecção' ? `onde? ${p.gts.length} caixas` : `quais pixels de cada um? ${p.gts.length} máscaras`
  return (
    <Lab n="7.2" title="Quatro perguntas para a mesma foto" desc="Um voo de drone sobre um piquete. A foto é a mesma; o que muda é a pergunta que a rede responde e, por isso, o formato da saída e o custo de rotular.">
      <div className="controls">
        <Seg value={modo} options={['classificação', 'segmentação semântica', 'detecção', 'segmentação de instâncias'] as const} onChange={setModo} label="tarefa" />
        <button className="btn ghost" type="button" onClick={() => setSeed((s) => s + 1)}>
          <Shuffle size={15} /> Outro piquete
        </button>
      </div>
      <div className="lab-cols two">
        <div className="panel">
          <ImgCanvas img={modo === 'segmentação de instâncias' ? seg : modo === 'segmentação semântica' ? sem : p.img} overlay={overlay} label="piquete visto de drone" />
        </div>
        <div className="panel">
          <div className="stats">
            <Stat v={resposta} l="o que a rede devolve" />
          </div>
          <table className="tbl wrap1" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>tarefa</th>
                <th>rótulo por imagem</th>
                <th>serve para</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>classificação</td>
                <td>1 palavra</td>
                <td>triagem</td>
              </tr>
              <tr>
                <td>detecção</td>
                <td>{p.gts.length} caixas</td>
                <td>contar, localizar</td>
              </tr>
              <tr>
                <td>seg. semântica</td>
                <td>1 máscara por classe</td>
                <td>área coberta, daninhas</td>
              </tr>
              <tr>
                <td>seg. de instâncias</td>
                <td>{p.gts.length} contornos</td>
                <td>medir cada animal</td>
              </tr>
            </tbody>
          </table>
          <p className="note">Rotular uma caixa leva uns 7 segundos; um contorno leva bem mais. Para contar o rebanho, caixa resolve. Para estimar escore de condição corporal pela área do dorso, precisa do contorno.</p>
        </div>
      </div>
    </Lab>
  )
}

/* ============ Lab 7.3 · anotar como um rotulador ============ */

type Fmt = 'YOLO (normalizado)' | 'xyxy em pixels' | 'COCO (x, y, larg, alt)'

function Anotador() {
  const [seed, setSeed] = useState(5)
  const p = pasto(seed)
  const [boxes, setBoxes] = useState<Box[]>([])
  const [drag, setDrag] = useState<Box | null>(null)
  const [gab, setGab] = useState(false)
  const [fmt, setFmt] = useState<Fmt>('YOLO (normalizado)')
  const ref = useRef<HTMLCanvasElement>(null)
  const S = 2
  useEffect(() => setBoxes([]), [seed])
  const melhor = (b: Box) => p.gts.reduce((m, g) => Math.max(m, iou(b, g)), 0)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const off = document.createElement('canvas')
    off.width = p.w
    off.height = p.h
    off.getContext('2d')!.putImageData(toImageData(p.img), 0, 0)
    c.width = p.w * S
    c.height = p.h * S
    const ctx = c.getContext('2d')!
    ctx.drawImage(off, 0, 0, c.width, c.height)
    if (gab) p.gts.forEach((g) => drawBox(ctx, S, g, COR.verdade, { dash: [4, 3], lw: 1.5 }))
    boxes.forEach((b, i) => {
      const v = melhor(b)
      drawBox(ctx, S, b, gab ? (v >= 0.5 ? COR.tp : COR.fp) : COR.pred, { label: gab ? `${i + 1} · IoU ${v.toFixed(2)}` : `${i + 1}` })
    })
    if (drag) drawBox(ctx, S, drag, '#fff', { dash: [5, 3] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, boxes, drag, gab])
  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * p.w, ((e.clientY - r.top) / r.height) * p.h] as const
  }
  const start = useRef<readonly [number, number] | null>(null)
  const linhas = boxes.map((b) => {
    if (fmt === 'YOLO (normalizado)') return yoloLine(0, b, p.w, p.h)
    if (fmt === 'xyxy em pixels') return `${b.x0.toFixed(0)} ${b.y0.toFixed(0)} ${b.x1.toFixed(0)} ${b.y1.toFixed(0)} bovino`
    return `{"category_id": 1, "bbox": [${b.x0.toFixed(0)}, ${b.y0.toFixed(0)}, ${(b.x1 - b.x0).toFixed(0)}, ${(b.y1 - b.y0).toFixed(0)}]}`
  })
  const ious = boxes.map(melhor)
  const achados = p.gts.filter((g) => boxes.some((b) => iou(b, g) >= 0.5)).length
  const [copiado, setCopiado] = useState(false)
  const copiar = () => {
    navigator.clipboard
      ?.writeText(boxes.map((b) => yoloLine(0, b, p.w, p.h)).join('\n') + '\n')
      .then(() => {
        setCopiado(true)
        setTimeout(() => setCopiado(false), 1500)
      })
      .catch(() => undefined)
  }
  const baixar = () => {
    const blob = new Blob([boxes.map((b) => yoloLine(0, b, p.w, p.h)).join('\n') + '\n'], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `piquete_${seed}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <Lab n="7.3" title="Rotule o piquete" desc="Arraste para desenhar uma caixa em volta de cada animal, do focinho à anca. Depois ligue o gabarito e veja o IoU de cada caixa sua com a verdade de campo.">
      <div className="controls">
        <Seg value={fmt} options={['YOLO (normalizado)', 'xyxy em pixels', 'COCO (x, y, larg, alt)'] as const} onChange={setFmt} label="formato do rótulo" />
        <button className="btn" type="button" onClick={() => setGab((g) => !g)}>
          {gab ? 'Esconder gabarito' : 'Mostrar gabarito'}
        </button>
        <button className="btn ghost" type="button" onClick={() => setBoxes((b) => b.slice(0, -1))} disabled={!boxes.length}>
          <Undo2 size={15} /> Desfazer
        </button>
        <button className="btn ghost" type="button" onClick={() => setBoxes([])} disabled={!boxes.length}>
          <Trash2 size={15} /> Limpar
        </button>
        <button className="btn ghost" type="button" onClick={() => setSeed((s) => s + 1)}>
          <Shuffle size={15} /> Outro piquete
        </button>
      </div>
      <div className="lab-cols two">
        <div className="panel">
          <canvas
            ref={ref}
            className="cv hover"
            role="img"
            aria-label="piquete para rotular"
            style={{ touchAction: 'none' }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              start.current = pos(e)
            }}
            onPointerMove={(e) => {
              if (!start.current) return
              const [x, y] = pos(e), [a, b] = start.current
              setDrag({ x0: Math.min(a, x), y0: Math.min(b, y), x1: Math.max(a, x), y1: Math.max(b, y) })
            }}
            onPointerUp={() => {
              if (drag && drag.x1 - drag.x0 > 3 && drag.y1 - drag.y0 > 3) setBoxes((bs) => [...bs, drag])
              setDrag(null)
              start.current = null
            }}
          />
          {gab && <Chave itens={[{ cor: COR.verdade, t: 'verdade de campo', dash: true }, { cor: COR.tp, t: 'sua caixa, IoU ≥ 0,5' }, { cor: COR.fp, t: 'sua caixa, IoU < 0,5' }]} />}
        </div>
        <div className="panel">
          <div className="stats">
            <Stat v={`${boxes.length}`} l="caixas desenhadas" />
            <Stat v={gab ? `${achados}/${p.gts.length}` : '?'} l="animais com caixa boa" />
            <Stat v={gab && ious.length ? (ious.reduce((a, b) => a + b, 0) / ious.length).toFixed(2) : '?'} l="IoU médio" />
          </div>
          <div className="panel-t" style={{ marginTop: 8 }}>
            <span>piquete_{seed}.txt</span>
            <span>imagem {p.w}×{p.h}</span>
          </div>
          <div className="readout" style={{ minHeight: 120, whiteSpace: 'pre' }}>
            {linhas.length ? linhas.join('\n') : 'desenhe uma caixa para ver a linha do rótulo'}
          </div>
          <div className="controls">
            <button className="btn ghost" type="button" onClick={copiar} disabled={!boxes.length}>
              <Copy size={15} /> {copiado ? 'Copiado' : 'Copiar linhas YOLO'}
            </button>
            <button className="btn ghost" type="button" onClick={baixar} disabled={!boxes.length}>
              <Download size={15} /> Baixar .txt
            </button>
          </div>
          <p className="note">
            No formato YOLO cada linha é <code>classe cx cy w h</code>, com o centro e o tamanho divididos pela largura e altura da imagem. Por isso o mesmo arquivo serve se a foto for redimensionada.
          </p>
        </div>
      </div>
    </Lab>
  )
}

/* ============ Lab 7.4 · IoU na mão ============ */

function IoULab() {
  const [obj, setObj] = useState<'boi adulto (40×20 px)' | 'bezerro (16×8 px)'>('boi adulto (40×20 px)')
  const [dx, setDx] = useState(4), [dy, setDy] = useState(2), [esc, setEsc] = useState(1)
  const [bw, bh] = obj.startsWith('boi') ? [40, 20] : [16, 8]
  const cx = 60, cy = 40
  const gt: Box = { x0: cx - bw / 2, y0: cy - bh / 2, x1: cx + bw / 2, y1: cy + bh / 2 }
  const pw = bw * esc, ph = bh * esc
  const pr: Box = { x0: cx + dx - pw / 2, y0: cy + dy - ph / 2, x1: cx + dx + pw / 2, y1: cy + dy + ph / 2 }
  const it = inter(gt, pr)
  const ai = it ? (it.x1 - it.x0) * (it.y1 - it.y0) : 0
  const ag = bw * bh, ap = pw * ph
  const v = iou(gt, pr)
  const S = 4
  const R = (b: Box, p: Record<string, string | number>) => <rect x={b.x0 * S} y={b.y0 * S} width={(b.x1 - b.x0) * S} height={(b.y1 - b.y0) * S} {...p} />
  return (
    <Lab n="7.4" title="Intersecção sobre união" desc="A caixa amarela é a verdade; a azul é o que o modelo previu. Desloque e mude o tamanho da previsão e veja quando ela deixa de contar como acerto.">
      <div className="controls">
        <Seg value={obj} options={['boi adulto (40×20 px)', 'bezerro (16×8 px)'] as const} onChange={setObj} label="objeto" />
        <Slider id="iou-dx" label="erro em x" value={dx} min={-20} max={20} onChange={setDx} fmt={(x) => `${x} px`} />
        <Slider id="iou-dy" label="erro em y" value={dy} min={-12} max={12} onChange={setDy} fmt={(x) => `${x} px`} />
        <Slider id="iou-s" label="tamanho previsto" value={esc} min={0.5} max={1.6} step={0.05} onChange={setEsc} fmt={(x) => `${Math.round(x * 100)}%`} />
      </div>
      <div className="lab-cols two">
        <div className="panel">
          <svg viewBox={`0 0 ${120 * S} ${80 * S}`} style={{ width: '100%', background: '#5f8a3c', display: 'block' }} role="img" aria-label="caixa verdadeira e prevista">
            {R(gt, { fill: 'rgba(255,224,0,0.18)', stroke: COR.verdade, strokeWidth: 3 })}
            {R(pr, { fill: 'rgba(19,26,159,0.18)', stroke: '#9fb0ff', strokeWidth: 3 })}
            {it && R(it, { fill: 'rgba(255,255,255,0.55)', stroke: 'none' })}
          </svg>
          <Chave itens={[{ cor: COR.verdade, t: 'verdade' }, { cor: '#9fb0ff', t: 'previsão' }, { cor: '#fff', t: 'intersecção' }]} />
        </div>
        <div className="panel">
          <div className="readout" style={{ fontSize: '0.86rem', lineHeight: 1.6 }}>
            intersecção = {ai.toFixed(0)} px²
            <br />
            união = {ag.toFixed(0)} + {ap.toFixed(0)} − {ai.toFixed(0)} = {(ag + ap - ai).toFixed(0)} px²
            <br />
            IoU = {ai.toFixed(0)} / {(ag + ap - ai).toFixed(0)} = <b>{v.toFixed(3)}</b>
          </div>
          <div className="stats" style={{ marginTop: 8 }}>
            <Stat v={v >= 0.5 ? 'acerto' : 'erro'} l="com limiar 0,50 (mAP50)" cor={v >= 0.5 ? 'var(--ok)' : 'var(--bad)'} />
            <Stat v={v >= 0.75 ? 'acerto' : 'erro'} l="com limiar 0,75" cor={v >= 0.75 ? 'var(--ok)' : 'var(--bad)'} />
          </div>
          <p className="note">
            Faça o teste: deixe 4 px de erro em x e troque de boi para bezerro. O mesmo deslize que quase não pesa no boi derruba o bezerro. Objeto pequeno é o calcanhar de Aquiles da detecção por drone.
          </p>
        </div>
      </div>
    </Lab>
  )
}

/* ============ Lab 7.5 · a grade do YOLO ============ */

type Cabeca = 'P3 · passo 8' | 'P4 · passo 16' | 'P5 · passo 32'

function Grade() {
  const [cab, setCab] = useState<Cabeca>('P4 · passo 16')
  const [imgsz, setImgsz] = useState<'320' | '640' | '1280'>('640')
  const [arr, setArr] = useState<Arranjo>('aglomerado no cocho')
  const [hov, setHov] = useState<number>(-1)
  const p = pasto(11, FAZ_A, arr)
  const stride = +cab.split('passo ')[1]
  const f = +imgsz / PW // pixels do modelo por pixel da foto
  const cel = stride / f // tamanho da célula em pixels da foto
  const centros = p.gts.map((b) => [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2] as const)
  const celula = (x: number, y: number) => `${Math.floor(x / cel)},${Math.floor(y / cel)}`
  const cont = new Map<string, number>()
  centros.forEach(([x, y]) => cont.set(celula(x, y), (cont.get(celula(x, y)) ?? 0) + 1))
  const disputa = [...cont.values()].filter((v) => v > 1).reduce((a, v) => a + v, 0)
  const larg = p.gts.map((b) => (b.x1 - b.x0) * f).sort((a, b) => a - b)
  const medLarg = larg[Math.floor(larg.length / 2)]
  const overlay = useCallback(
    (ctx: CanvasRenderingContext2D, s: number) => {
      ctx.save()
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = 1
      for (let x = 0; x <= p.w; x += cel) {
        ctx.beginPath()
        ctx.moveTo(x * s, 0)
        ctx.lineTo(x * s, p.h * s)
        ctx.stroke()
      }
      for (let y = 0; y <= p.h; y += cel) {
        ctx.beginPath()
        ctx.moveTo(0, y * s)
        ctx.lineTo(p.w * s, y * s)
        ctx.stroke()
      }
      cont.forEach((n, k) => {
        const [i, j] = k.split(',').map(Number)
        ctx.fillStyle = n > 1 ? 'rgba(224,48,42,0.45)' : 'rgba(255,224,0,0.35)'
        ctx.fillRect(i * cel * s, j * cel * s, cel * s, cel * s)
      })
      centros.forEach(([x, y]) => {
        ctx.fillStyle = '#ffe000'
        ctx.beginPath()
        ctx.arc(x * s, y * s, 2.5, 0, Math.PI * 2)
        ctx.fill()
      })
      if (hov >= 0) {
        const b = p.gts[hov]
        const [x, y] = centros[hov]
        const px = (Math.floor(x / cel) + 0.5) * cel, py = (Math.floor(y / cel) + 0.5) * cel
        drawBox(ctx, s, b, COR.verdade, { lw: 2 })
        ctx.strokeStyle = '#fff'
        ctx.fillStyle = '#fff'
        ctx.lineWidth = 2
        const seta = (tx: number, ty: number, t: string) => {
          ctx.beginPath()
          ctx.moveTo(px * s, py * s)
          ctx.lineTo(tx * s, ty * s)
          ctx.stroke()
          ctx.font = '600 11px Arial'
          ctx.fillText(t, tx * s + (tx < px ? -12 : tx > px ? 3 : -3), ty * s + (ty < py ? -3 : ty > py ? 11 : 4))
        }
        seta(b.x0, py, 'l')
        seta(b.x1, py, 'r')
        seta(px, b.y0, 't')
        seta(px, b.y1, 'b')
        ctx.beginPath()
        ctx.arc(px * s, py * s, 4, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p, cel, hov],
  )
  return (
    <Lab
      n="7.5"
      title="A grade que o YOLO enxerga"
      desc="A foto entra redimensionada para imgsz × imgsz. Cada cabeça de detecção olha uma grade: um ponto a cada 8, 16 ou 32 pixels do modelo. Passe o mouse num animal para ver o ponto da grade que o prevê e as quatro distâncias que ele aprende."
    >
      <div className="controls">
        <Seg value={cab} options={['P3 · passo 8', 'P4 · passo 16', 'P5 · passo 32'] as const} onChange={setCab} label="cabeça" />
        <Seg value={imgsz} options={['320', '640', '1280'] as const} onChange={setImgsz} label="imgsz" />
        <Seg value={arr} options={['espalhado', 'aglomerado no cocho'] as const} onChange={setArr} label="rebanho" />
      </div>
      <div className="lab-cols two">
        <div className="panel">
          <ImgCanvas
            img={p.img}
            overlay={overlay}
            onPixel={(x, y) => setHov(p.gts.findIndex((b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1))}
            label="piquete com a grade do modelo"
          />
          <Chave itens={[{ cor: '#ffe000', t: 'célula com 1 centro' }, { cor: '#e0302a', t: 'célula disputada (2 ou mais centros)' }]} />
        </div>
        <div className="panel">
          <div className="stats">
            <Stat v={`${Math.round(+imgsz / stride)}×${Math.round(+imgsz / stride)}`} l="tamanho da grade" />
            <Stat v={`${medLarg.toFixed(0)} px`} l="largura típica de um boi no modelo" />
            <Stat v={(medLarg / stride).toFixed(1)} l="células que um boi atravessa" />
            <Stat v={`${disputa}`} l="animais em célula disputada" cor={disputa ? 'var(--bad)' : 'var(--ok)'} />
          </div>
          <p className="note">
            Uma célula muito grande para o objeto mistura vários animais no mesmo ponto; uma muito pequena vê só um pedaço do boi. Por isso o YOLO tem três cabeças: P3 cuida dos pequenos (bezerro, ave), P5 dos grandes,
            e o treino decide qual cabeça responde por qual animal.
          </p>
        </div>
      </div>
    </Lab>
  )
}

/* ============ Lab 7.6 · NMS passo a passo ============ */

type Vista = 'saída bruta' | 'acima da confiança' | 'depois do NMS'

function NmsLab() {
  const [seed, setSeed] = useState(2)
  const [arr, setArr] = useState<Arranjo>('espalhado')
  const [conf, setConf] = useState(0.25)
  const [thr, setThr] = useState(0.7)
  const [vista, setVista] = useState<Vista>('depois do NMS')
  const [passo, setPasso] = useState<number | null>(null)
  const p = pasto(seed, FAZ_A, arr)
  const brutas = useMemo(() => simDetector(p, seed), [p, seed])
  const acima = useMemo(() => brutas.filter((d) => d.conf >= conf), [brutas, conf])
  const r = useMemo(() => nms(acima, thr), [acima, thr])
  useEffect(() => setPasso(null), [seed, arr, conf, thr])
  const finais = passo === null ? r.kept : r.steps.slice(0, passo + 1).map((s) => r.order[s.keep])
  const m = useMemo(() => matchImage(r.kept, p.gts, 0.5), [r.kept, p.gts])
  const dup = m.matches.filter((x) => !x.tp && (x.det.gt ?? -1) >= 0).length
  const alarme = m.matches.filter((x) => !x.tp && (x.det.gt ?? -1) < 0).length
  const vivos = useMemo(() => {
    if (passo === null) return null
    const dead = new Set<number>()
    r.steps.slice(0, passo + 1).forEach((s) => s.suppressed.forEach((j) => dead.add(j)))
    return dead
  }, [passo, r])
  const overlay = useCallback(
    (ctx: CanvasRenderingContext2D, s: number) => {
      if (passo !== null) {
        const st = r.steps[passo]
        r.order.forEach((d, j) => {
          if (j > st.keep && !vivos!.has(j)) drawBox(ctx, s, d, COR.fraca, { lw: 1 })
        })
        r.steps.slice(0, passo).forEach((x) => drawBox(ctx, s, r.order[x.keep], COR.tp, { lw: 2 }))
        st.suppressed.forEach((j) => drawBox(ctx, s, r.order[j], COR.fp, { dash: [4, 3], lw: 2 }))
        drawBox(ctx, s, r.order[st.keep], '#fff', { lw: 3, label: r.order[st.keep].conf.toFixed(2) })
        return
      }
      const lista: Det[] = vista === 'saída bruta' ? brutas : vista === 'acima da confiança' ? acima : r.kept
      lista.forEach((d) => drawBox(ctx, s, d, vista === 'depois do NMS' ? COR.pred : `rgba(159,176,255,${0.25 + 0.75 * d.conf})`, { lw: vista === 'depois do NMS' ? 2 : 1, label: vista === 'depois do NMS' ? d.conf.toFixed(2) : undefined }))
    },
    [vista, brutas, acima, r, passo, vivos],
  )
  return (
    <Lab
      n="7.6"
      title="De muitas caixas para uma por animal"
      desc="A cabeça do YOLO cospe uma caixa candidata em cada ponto da grade. O pós-processamento corta pela confiança e depois aplica a supressão de não máximos (NMS). As candidatas aqui são simuladas a partir da verdade, imitando a saída bruta de um modelo treinado; o corte e o NMS são calculados de verdade."
    >
      <div className="controls">
        <Seg value={vista} options={['saída bruta', 'acima da confiança', 'depois do NMS'] as const} onChange={(v) => { setVista(v); setPasso(null) }} label="ver" />
        <Seg value={arr} options={['espalhado', 'aglomerado no cocho'] as const} onChange={setArr} label="rebanho" />
        <button className="btn ghost" type="button" onClick={() => setSeed((s) => s + 1)}>
          <Shuffle size={15} /> Outro piquete
        </button>
      </div>
      <div className="controls">
        <Slider id="nms-conf" label="conf (limiar de confiança)" value={conf} min={0.05} max={0.9} step={0.05} onChange={setConf} fmt={(x) => x.toFixed(2)} />
        <Slider id="nms-iou" label="iou (limiar do NMS)" value={thr} min={0.2} max={0.95} step={0.05} onChange={setThr} fmt={(x) => x.toFixed(2)} />
        <button className="btn" type="button" onClick={() => setPasso((q) => (q === null ? 0 : Math.min(r.steps.length - 1, q + 1)))}>
          <StepForward size={15} /> {passo === null ? 'NMS passo a passo' : `passo ${passo + 1} de ${r.steps.length}`}
        </button>
        {passo !== null && (
          <button className="btn ghost" type="button" onClick={() => setPasso(null)}>
            <RotateCcw size={15} /> Sair do passo a passo
          </button>
        )}
      </div>
      <div className="lab-cols two">
        <div className="panel">
          <ImgCanvas img={p.img} overlay={overlay} label="caixas sobre o piquete" />
          {passo !== null && (
            <Chave itens={[{ cor: '#fff', t: 'maior confiança que sobrou: fica' }, { cor: COR.fp, t: `apagadas agora (IoU > ${thr.toFixed(2)})`, dash: true }, { cor: COR.tp, t: 'já mantidas' }]} />
          )}
        </div>
        <div className="panel">
          <div className="stats">
            <Stat v={`${brutas.length}`} l="candidatas" />
            <Stat v={`${acima.length}`} l={`com conf ≥ ${conf.toFixed(2)}`} />
            <Stat v={`${finais.length}`} l={passo === null ? 'depois do NMS' : 'mantidas até agora'} />
            <Stat v={`${p.gts.length}`} l="animais de verdade" />
          </div>
          <div className="stats" style={{ marginTop: 8 }}>
            <Stat v={`${dup}`} l="caixas duplicadas no mesmo boi" cor={dup ? 'var(--bad)' : 'var(--ok)'} />
            <Stat v={`${alarme}`} l="alarmes falsos (cupinzeiro, capim)" cor={alarme ? 'var(--bad)' : 'var(--ok)'} />
            <Stat v={`${m.fn.length}`} l="animais sem caixa" cor={m.fn.length ? 'var(--bad)' : 'var(--ok)'} />
          </div>
          <p className="note">
            Teste no rebanho aglomerado: com <code>iou</code> baixo (0,3) o NMS apaga o boi vizinho, que também é verdadeiro. Com <code>iou</code> alto (0,9) sobram duplicatas e a contagem infla. Com <code>conf</code> alto
            somem os animais na sombra da árvore. Não existe valor mágico: depende do rebanho.
          </p>
        </div>
      </div>
    </Lab>
  )
}

/* ============ conteúdo ============ */

const CODE_INFER = `# Aula 7 · usar um YOLO pronto (pesos do COCO) e contar objetos
# !pip install -U ultralytics
from ultralytics import YOLO

modelo = YOLO("yolo26n.pt")                  # n = nano; também há s, m, l, x
res = modelo.predict("minha_foto.jpg", conf=0.25, imgsz=640)[0]

print(res.names)                              # as 80 classes do COCO: 'cow', 'sheep', 'horse', 'bird'...
for caixa in res.boxes:
    x0, y0, x1, y1 = caixa.xyxy[0].tolist()   # pixels da foto original
    cx, cy, w, h  = caixa.xywhn[0].tolist()   # o mesmo, no formato do rótulo YOLO
    print(res.names[int(caixa.cls)], round(float(caixa.conf), 2), [round(v) for v in (x0, y0, x1, y1)])

vacas = sum(res.names[int(c)] == "cow" for c in res.boxes.cls)
print("vacas contadas:", vacas)
res.save("minha_foto_detectada.jpg")`

const CODE_PERC = `# o perceptron de Rosenblatt em 15 linhas
import numpy as np

def treinar_perceptron(X, y, eta=0.2, epocas=20):
    w, b = np.zeros(X.shape[1]), 0.0
    for e in range(epocas):
        erros = 0
        for xi, alvo in zip(X, y):
            saida = int(xi @ w + b >= 0)          # degrau
            w += eta * (alvo - saida) * xi         # regra de Rosenblatt
            b += eta * (alvo - saida)
            erros += int(alvo != saida)
        print(f"época {e + 1}: {erros} erros, w = {w.round(2)}, b = {b:.2f}")
        if erros == 0: break
    return w, b

X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]])
treinar_perceptron(X, np.array([0, 0, 0, 1]))   # AND: converge
treinar_perceptron(X, np.array([0, 1, 1, 0]))   # XOR: nunca chega a 0 erros

# o mesmo com scikit-learn, e a MLP resolvendo o XOR
from sklearn.linear_model import Perceptron
from sklearn.neural_network import MLPClassifier
print(Perceptron().fit(X, [0, 1, 1, 0]).score(X, [0, 1, 1, 0]))                                          # no máximo 0,75
print(MLPClassifier((4,), activation="tanh", solver="lbfgs", random_state=1).fit(X, [0, 1, 1, 0]).score(X, [0, 1, 1, 0]))  # 1,0`

const CODE_NMS = `# IoU e NMS escritos à mão, para comparar com o que o ultralytics faz por dentro
import numpy as np

def iou(a, b):                        # caixas no formato x0, y0, x1, y1
    ix0, iy0 = max(a[0], b[0]), max(a[1], b[1])
    ix1, iy1 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, ix1 - ix0) * max(0, iy1 - iy0)
    area = lambda c: (c[2] - c[0]) * (c[3] - c[1])
    return inter / (area(a) + area(b) - inter)

def nms(caixas, notas, limiar=0.7):
    ordem = list(np.argsort(notas)[::-1])        # da maior confiança para a menor
    manter = []
    while ordem:
        i = ordem.pop(0)
        manter.append(i)
        ordem = [j for j in ordem if iou(caixas[i], caixas[j]) <= limiar]
    return manter

# confira com a versão da torchvision
import torch, torchvision
cx = torch.tensor(caixas, dtype=torch.float32); nt = torch.tensor(notas)
print(sorted(nms(caixas, notas)), sorted(torchvision.ops.nms(cx, nt, 0.7).tolist()))`

export const aula7: Aula = {
  id: 'aula7',
  n: 7,
  trilha: 'yolo',
  duracao: 180,
  titulo: 'Onde está e quantos são',
  ideia: 'Detectar é classificar e localizar ao mesmo tempo. O YOLO faz isso num olhar só: uma grade de pontos, cada um chutando uma caixa, e uma faxina no fim.',
  ementa: ['Perceptron, MLP e CNN', 'Classificar, segmentar, detectar', 'U-Net e R-CNN', 'Rótulo no formato YOLO', 'IoU', 'Grade, passos e cabeças', 'Sem âncora (v8 em diante)', 'NMS e YOLO26 sem NMS', 'Inferência com ultralytics'],
  labs: ['Um perceptron aprendendo', 'Quatro perguntas', 'Rotule o piquete', 'IoU na mão', 'A grade do YOLO', 'NMS passo a passo'],
  cor: ['#131a9f', '#ffe000', '#1fae4b', '#e0302a'],
  objetivos: [
    'Explicar o perceptron (pesos, viés, degrau, regra de aprendizado), por que ele não resolve o XOR e como a MLP e a CNN resolvem.',
    'Diferenciar classificação, segmentação semântica, detecção e segmentação de instâncias pela saída e pelo custo de rotular.',
    'Comparar detectores de dois estágios (R-CNN) e de um estágio (YOLO), e reconhecer a U-Net como arquitetura de segmentação.',
    'Escrever e ler rótulos no formato YOLO e converter para xyxy e COCO.',
    'Calcular IoU à mão e explicar por que objetos pequenos são mais difíceis.',
    'Descrever a arquitetura do YOLO (espinha, pescoço, cabeças em três escalas) e o que cada ponto da grade prevê.',
    'Explicar o NMS, escolher conf e iou conscientemente e saber o que muda no YOLO26.',
    'Rodar um YOLO pré-treinado no Colab, ler a saída e contar objetos.',
  ],
  roteiro: [
    { t: 'Gancho: quem conta o rebanho?', min: 10, tipo: 'gancho' },
    { t: 'Do perceptron à CNN: Lab 7.1', min: 30, tipo: 'lab' },
    { t: 'Quatro tarefas, U-Net, R-CNN: Lab 7.2', min: 20, tipo: 'conceito' },
    { t: 'Rotular: Lab 7.3', min: 15, tipo: 'lab' },
    { t: 'IoU: Lab 7.4', min: 15, tipo: 'conceito' },
    { t: 'Intervalo', min: 15, tipo: 'pausa' },
    { t: 'Por dentro do YOLO: Lab 7.5', min: 25, tipo: 'conceito' },
    { t: 'NMS: Lab 7.6', min: 20, tipo: 'lab' },
    { t: 'Caso real: gado no Piauí', min: 10, tipo: 'conceito' },
    { t: 'Colab: perceptron e YOLO pronto', min: 15, tipo: 'lab' },
    { t: 'Fechamento + quiz', min: 5, tipo: 'fecho' },
  ],
  secoes: [
    {
      id: 'a7-gancho',
      titulo: 'Quem conta o rebanho?',
      min: 10,
      body: (
        <div className="prose">
          <p>
            Na Aula 2 contamos frangos no aviário com uma receita: subtrair o fundo, limiarizar, dividir os pixels brancos pela área de uma ave. Funcionou com uns 15% de erro, e quebrava sempre que a câmera, a luz ou o
            tamanho das aves mudavam. Na Aula 6 a rede aprendeu a dizer <i>se</i> a folha tinha ferrugem, mas não <i>onde</i> nem <i>quantas</i> pústulas.
          </p>
          <p>
            Hoje juntamos as duas coisas. Um <b>detector de objetos</b> devolve, para cada coisa que encontra, uma caixa, uma classe e uma confiança. Contar vira contar caixas. E a família mais usada no campo, por ser
            rápida o bastante para rodar num drone ou numa câmera de curral, é a <b>YOLO</b> (<i>You Only Look Once</i>).
          </p>
          <Callout kind="prof" title="Nota pra quem dá a aula · 10 min">
            <p>
              Abra com a pergunta: "quantos bois tem nesse piquete?" e projete o Lab 7.2 sem as caixas. Dê 30 segundos, colete os chutes no quadro. Vai dar diferença de 2 ou 3 entre a turma. Depois ligue a detecção.
              Pergunte: e se fossem 3 mil cabeças em 400 hectares, toda semana?
            </p>
          </Callout>
        </div>
      ),
    },
    {
      id: 'a7-perceptron',
      titulo: 'Do perceptron à CNN: de onde vem o YOLO',
      min: 30,
      body: (
        <div className="prose">
          <p>
            Antes de abrir o YOLO, vale descer até a peça mais simples de qualquer rede neural. Em 1943, McCulloch e Pitts propuseram um neurônio lógico: soma entradas e “dispara” se a soma passa de um limiar. Em 1958,
            Frank Rosenblatt deu a esse neurônio um jeito de <b>aprender</b> os pesos a partir de exemplos. Foi o <b>perceptron</b>.
          </p>
          <Figura n="7.1" legenda="Do neurônio de 1943 ao YOLO26: cada etapa resolveu um limite da anterior.">
            <FigLinhaTempo />
          </Figura>
          <p>
            Pense numa folha de soja fotografada. Medimos duas coisas na imagem (Aula 3): x₁, a fração de pixels amarelo-alaranjados (pústulas de ferrugem), e x₂, um índice de verde. O perceptron multiplica cada
            entrada por um <b>peso</b>, soma um <b>viés</b> e passa o resultado por uma função <b>degrau</b>: se a soma for maior ou igual a zero, responde 1 (ferrugem); senão, 0 (sadia).
          </p>
          <Figura n="7.2" legenda="O perceptron: entradas, pesos, soma ponderada e degrau. Aprender é só ajustar w₁, w₂ e b.">
            <FigPerceptron />
          </Figura>
          <p>Como ele aprende? Mostra um exemplo, compara a saída com o alvo e, se errou, corrige:</p>
          <p style={{ textAlign: 'center', fontFamily: 'var(--f-math)', fontSize: '1.1rem' }}>wᵢ ← wᵢ + η · (alvo − saída) · xᵢ &nbsp;&nbsp;&nbsp; b ← b + η · (alvo − saída)</p>
          <p>
            Se acertou, (alvo − saída) = 0 e nada muda. Se disse 0 e era 1, os pesos crescem na direção daquele exemplo; se disse 1 e era 0, diminuem. O η (eta) é a <b>taxa de aprendizado</b>: o tamanho do passo. Uma
            passada por todos os exemplos é uma <b>época</b>. Geometricamente, w₁·x₁ + w₂·x₂ + b = 0 é uma reta, e o perceptron vai girando e deslocando essa reta até separar as classes.
          </p>
          <PerceptronLab />
          <Callout kind="prof" title="Nota pra quem dá a aula · dinâmica de 10 min">
            <p>
              Faça o AND à mão no quadro, com a turma: pesos iniciais w₁ = w₂ = 0, b = 0, η = 1. Apresente os 4 exemplos em ordem e anote a tabela (x₁, x₂, alvo, soma, saída, erro, novos pesos). Em 3 ou 4 épocas
              converge. Depois tente o XOR no lab e deixe a turma descobrir que não há reta possível. É o melhor jeito de justificar as camadas ocultas.
            </p>
          </Callout>
          <h3>Por que o XOR derrubou o perceptron (e o que veio depois)</h3>
          <p>
            Em 1969, Minsky e Papert mostraram que um perceptron sozinho só aprende o que é <b>linearmente separável</b>. O XOR não é: nenhuma reta deixa (0,1) e (1,0) de um lado e (0,0) e (1,1) do outro. Isso esfriou
            a área por mais de uma década. A saída foi empilhar perceptrons em camadas, a <b>MLP</b> (perceptron multicamadas), trocar o degrau por funções suaves (sigmoide, tanh, ReLU) e treinar com{' '}
            <b>retropropagação do gradiente</b> (Rumelhart, Hinton e Williams, 1986). Com uma camada oculta, a MLP já resolve o XOR.
          </p>
          <Figura n="7.3" legenda="Esquerda: a MLP liga cada neurônio a todos os da camada anterior. Direita: a CNN da Aula 6 usa o mesmo filtro pequeno deslizando pela imagem inteira.">
            <FigMLPCNN />
          </Figura>
          <p>
            Para imagens, a MLP tem um problema: uma foto de 640 × 640 × 3 tem 1,2 milhão de entradas, e cada neurônio da primeira camada precisaria de 1,2 milhão de pesos. A <b>CNN</b> resolve com convolução: o mesmo
            filtro de 3 × 3 desliza pela imagem, com poucos pesos, e acha bordas, manchas e depois formas inteiras em qualquer posição. O YOLO é uma CNN dessas, com uma cabeça que, em vez de uma classe, devolve caixas.
          </p>
          <div className="tbl-wrap">
            <table className="tbl wrap1">
              <thead>
                <tr>
                  <th>modelo</th>
                  <th>o que aprende</th>
                  <th>limite</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>perceptron</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>uma reta (um plano) que separa duas classes</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>não resolve o XOR</td>
                </tr>
                <tr>
                  <td>MLP</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>fronteiras curvas, com camadas ocultas</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>pesos demais para imagens</td>
                </tr>
                <tr>
                  <td>CNN</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>filtros que viram detectores de padrões</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>sozinha, só diz “o quê”</td>
                </tr>
                <tr>
                  <td>YOLO</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>CNN + cabeças que dizem “o quê e onde”</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>objetos muito pequenos ou grudados</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Callout kind="analogia">
            <p>
              O perceptron é um peão que só sabe uma regra: “se a folha tem mais amarelo do que verde, é ferrugem”. A MLP é uma equipe de peões que combinam regras simples. A CNN é a equipe que, em vez de olhar a folha
              inteira de uma vez, passa uma lupa pequena por cada pedacinho dela.
            </p>
          </Callout>
        </div>
      ),
    },
    {
      id: 'a7-tarefas',
      titulo: 'Classificar, segmentar, detectar',
      min: 20,
      body: (
        <div className="prose">
          <p>
            Com a CNN em mãos, dá para fazer quatro perguntas diferentes à mesma foto. Todas usam a mesma espinha convolucional; o que muda é a <b>cabeça</b> no fim da rede e o que se rotula:
          </p>
          <ul>
            <li>
              <b>Classificação</b> responde “o quê?”: um rótulo por foto (“tem ferrugem”, “pasto com bovinos”).
            </li>
            <li>
              <b>Segmentação semântica</b> responde “o quê, em cada pixel?”: todo pixel recebe uma classe (bovino, capim, solo), mas dois bois encostados viram uma mancha só.
            </li>
            <li>
              <b>Detecção</b> responde “o quê e onde?”: uma caixa, uma classe e uma confiança por objeto. Dá para contar.
            </li>
            <li>
              <b>Segmentação de instâncias</b> junta as duas: cada objeto com a sua máscara. Dá para contar e medir.
            </li>
          </ul>
          <Figura n="7.4" legenda="As quatro tarefas na mesma foto de piquete. A rede e o rótulo ficam mais caros da esquerda para a direita.">
            <FigTarefas />
          </Figura>
          <TresSaidas />
          <h3>Como a rede devolve uma máscara: a U-Net</h3>
          <p>
            Para segmentar, a rede precisa devolver uma imagem do mesmo tamanho da entrada. A <b>U-Net</b> (Ronneberger, Fischer e Brox, 2015), criada para imagens de microscopia, faz isso com um codificador que vai
            reduzindo a imagem e entendendo “o quê”, e um decodificador que vai ampliando de volta e dizendo “onde”. As ligações entre os dois lados (o “U”) trazem os detalhes finos que se perderam na redução. É a
            arquitetura mais usada para segmentar folhas, lesões, daninhas e talhões.
          </p>
          <Figura n="7.5" legenda="U-Net: o codificador (azul) reduz, o decodificador (amarelo) amplia, e as ligações tracejadas copiam os detalhes de cada nível.">
            <FigUNet />
          </Figura>
          <h3>Como a rede devolve caixas: dois estágios ou um só</h3>
          <p>
            A primeira família de detectores com CNN trabalhava em <b>dois estágios</b>. O R-CNN (Girshick et al., 2014) propunha umas 2.000 regiões candidatas com um algoritmo clássico, recortava cada uma e passava pela
            CNN para classificar. O Fast R-CNN e o Faster R-CNN aceleraram isso, mas a ideia continuou: primeiro “onde pode ter algo”, depois “o que é”. O YOLO (Redmon et al., 2016) virou a mesa: <b>um estágio só</b>,
            a imagem inteira passa uma vez pela rede, e a grade de saída já devolve caixas e classes.
          </p>
          <Figura n="7.6" legenda="Em cima, o detector de dois estágios recorta e classifica cada região. Embaixo, o YOLO olha a imagem inteira uma vez.">
            <FigDoisEstagios />
          </Figura>
          <div className="tbl-wrap">
            <table className="tbl wrap1">
              <thead>
                <tr>
                  <th></th>
                  <th>dois estágios (Faster R-CNN)</th>
                  <th>um estágio (YOLO)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>como olha</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>região por região</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>a imagem inteira de uma vez, com o contexto em volta</td>
                </tr>
                <tr>
                  <td>velocidade</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>mais lento</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>tempo real, cabe em drone e câmera de curral</td>
                </tr>
                <tr>
                  <td>ponto fraco</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>custo e complexidade</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>objetos pequenos e muito juntos (as primeiras versões, sobretudo)</td>
                </tr>
                <tr>
                  <td>no agro</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>trabalhos de pesquisa com poucas imagens grandes</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>contagem em vídeo, máquinas, embarcados</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Callout kind="campo">
            <p>
              Contagem de gado, de frutos na planta, de plantas emergidas na linha, de ovos na bandeja, de insetos na armadilha adesiva: tudo isso é detecção. Área foliar lesionada e cobertura de daninhas pedem
              segmentação. "Esta folha está doente?" é classificação.
            </p>
          </Callout>
        </div>
      ),
    },
    {
      id: 'a7-rotulo',
      titulo: 'A caixa e o arquivo de rótulo',
      min: 15,
      body: (
        <div className="prose">
          <p>
            Uma caixa delimitadora é só quatro números, mas há três jeitos comuns de escrever esses números, e misturar os formatos é o erro número um de quem treina o primeiro detector:
          </p>
          <ul>
            <li>
              <b>xyxy</b>: canto superior esquerdo e canto inferior direito, em pixels. É o que o ultralytics devolve em <code>boxes.xyxy</code>.
            </li>
            <li>
              <b>COCO</b>: canto superior esquerdo, largura e altura, em pixels, dentro de um JSON único para o banco inteiro.
            </li>
            <li>
              <b>YOLO</b>: um <code>.txt</code> por imagem, uma linha por objeto, <code>classe cx cy w h</code> com centro e tamanho divididos pela largura e altura da imagem (valores entre 0 e 1). A classe é um
              número que começa em 0.
            </li>
          </ul>
          <Anotador />
          <Callout kind="prof" title="Nota pra quem dá a aula · dinâmica de 10 min">
            <p>
              Em duplas: cada um rotula o mesmo piquete sem conversar (use o botão "Outro piquete" até cair na mesma semente, ou projete e todos rotulam o piquete 5). Comparem as linhas do .txt. Onde a caixa de vocês
              discordou? Cabeça abaixada, rabo, sombra, animal cortado pela borda. Sem uma <b>regra de rotulagem escrita</b>, o modelo aprende a indecisão do rotulador.
            </p>
          </Callout>
          <Callout kind="pegadinha">
            <p>
              Ferramentas como CVAT, Label Studio e Roboflow exportam em vários formatos. Exportou em COCO e jogou no YOLO? O treino roda sem erro e o mAP fica perto de zero. Sempre desenhe meia dúzia de rótulos de volta
              na imagem antes de treinar (é o que o Lab 8.1 faz).
            </p>
          </Callout>
        </div>
      ),
    },
    {
      id: 'a7-iou',
      titulo: 'Quando uma caixa é acerto?',
      min: 15,
      body: (
        <div className="prose">
          <p>
            A previsão nunca coincide pixel a pixel com a verdade. A medida padrão de sobreposição é a <Term def="Intersection over Union: área da intersecção dividida pela área da união das duas caixas. Vai de 0 (sem sobreposição) a 1 (caixas idênticas).">IoU</Term>,
            o mesmo índice de Jaccard que aparece em segmentação:
          </p>
          <p style={{ textAlign: 'center', fontFamily: 'var(--f-math)', fontSize: '1.1rem' }}>IoU = área(A ∩ B) / área(A ∪ B)</p>
          <p>
            Uma detecção conta como verdadeiro positivo se a classe estiver certa e o IoU com algum objeto ainda não casado passar de um limiar, quase sempre 0,5. As métricas mais exigentes (mAP50-95) repetem a conta com
            limiares de 0,50 a 0,95.
          </p>
          <IoULab />
          <Callout kind="analogia">
            <p>
              IoU é como avaliar uma cerca que alguém construiu em volta de um piquete. Se a cerca nova deixa metade do piquete de fora, ou cerca o dobro da área, não serve, mesmo "estando no lugar certo".
            </p>
          </Callout>
        </div>
      ),
    },
    {
      id: 'a7-pausa',
      titulo: 'Intervalo',
      min: 15,
      body: (
        <div className="prose">
          <p>
            Quinze minutos. Para quem quiser adiantar: abra o <a href={NB7} target="_blank" rel="noreferrer">notebook da Aula 7 no Colab</a>, mude o ambiente para GPU (Ambiente de execução → Alterar o tipo → T4) e rode a
            primeira célula, que instala o ultralytics.
          </p>
        </div>
      ),
    },
    {
      id: 'a7-dentro',
      titulo: 'Por dentro do YOLO',
      min: 25,
      body: (
        <div className="prose">
          <p>
            Vimos na Figura 7.6 que o YOLO faz tudo num passe só: a rede divide a imagem numa grade e cada célula prevê caixas e classes de uma vez. No YOLO original (2016) era uma grade de 7 × 7 com duas caixas
            por célula; hoje são três grades de tamanhos diferentes. Vamos abrir a caixa-preta.
          </p>
          <p>Toda versão moderna tem três partes:</p>
          <ul>
            <li>
              <b>Espinha (backbone)</b>: uma CNN como a da Aula 6, que vai reduzindo a resolução e aumentando o número de canais. Sai com mapas a 1/8, 1/16 e 1/32 do tamanho da entrada.
            </li>
            <li>
              <b>Pescoço (neck)</b>: mistura os mapas de escalas diferentes (estrutura do tipo FPN/PAN), para que o mapa fino saiba o que o grosso viu e vice-versa.
            </li>
            <li>
              <b>Cabeças (head)</b>: uma por escala, chamadas P3, P4 e P5, com passo (stride) de 8, 16 e 32 pixels. Com imgsz 640, isso dá grades de 80×80, 40×40 e 20×20, ou 8.400 pontos candidatos no total.
            </li>
          </ul>
          <p>
            Cada ponto da grade prevê as notas de cada classe e uma caixa. Até a v5 a caixa era um ajuste sobre <b>âncoras</b> (caixas-modelo de tamanhos fixos, tiradas do banco). Da v8 em diante o YOLO é{' '}
            <b>sem âncora</b>: o ponto prevê direto as quatro distâncias até as bordas do objeto (esquerda, topo, direita, base: l, t, r, b). No treino, um <Term def="Task-Aligned Assigner: para cada objeto verdadeiro, escolhe os pontos da grade cuja previsão combina melhor nota de classe e IoU, e só esses aprendem aquele objeto.">atribuidor</Term>{' '}
            decide quais pontos aprendem cada animal.
          </p>
          <Figura n="7.7" legenda="As três partes do YOLO. A espinha reduz a imagem em cinco etapas; o pescoço mistura P3, P4 e P5; uma cabeça por escala prevê classes e caixas.">
            <FigArquitetura />
          </Figura>
          <Grade />
          <div className="tbl-wrap">
            <table className="tbl wrap1">
              <thead>
                <tr>
                  <th>versão</th>
                  <th>ano</th>
                  <th>o que mudou e importa pra gente</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>YOLO (v1)</td>
                  <td>2016</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>grade 7×7, um passe só</td>
                </tr>
                <tr>
                  <td>v2, v3</td>
                  <td>2017, 2018</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>âncoras e detecção em três escalas</td>
                </tr>
                <tr>
                  <td>v5 (ultralytics)</td>
                  <td>2020</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>PyTorch, fácil de treinar, mosaico como aumento de dados</td>
                </tr>
                <tr>
                  <td>v8</td>
                  <td>2023</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>sem âncora, cabeça desacoplada, mesma API para detectar, segmentar e classificar</td>
                </tr>
                <tr>
                  <td>v10</td>
                  <td>2024</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>treino com atribuição um para um, dispensando o NMS</td>
                </tr>
                <tr>
                  <td>YOLO11</td>
                  <td>2024</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>mais precisão com menos parâmetros</td>
                </tr>
                <tr>
                  <td>YOLO26</td>
                  <td>2026</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>inferência ponta a ponta sem NMS, sem DFL, otimizador MuSGD, pensado para rodar em hardware embarcado</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="note">As versões "vN" não são todas do mesmo grupo: v4, v7 e v9 vieram de outros autores. Para a sala, o que interessa é a linha do ultralytics (v5, v8, 11, 26), que é a que vocês vão usar.</p>
          <h3>Como o YOLO aprende: a função de perda</h3>
          <p>
            No perceptron, o erro era só (alvo − saída). No YOLO, cada ponto da grade escolhido pelo atribuidor gera três erros, somados com pesos (os hiperparâmetros <code>box</code>, <code>cls</code> e, até o YOLO11,{' '}
            <code>dfl</code>):
          </p>
          <ul>
            <li>
              <b>Perda de caixa</b>: quanto a caixa prevista se afasta da verdadeira, medida com uma variante do IoU (CIoU). É o <code>box_loss</code> do <code>results.csv</code>.
            </li>
            <li>
              <b>Perda de classe</b>: entropia cruzada binária entre as notas previstas e a classe certa. Pontos de fundo aprendem a dar nota baixa para tudo. É o <code>cls_loss</code>.
            </li>
            <li>
              <b>Perda de distribuição</b> (DFL, até o YOLO11): refina as distâncias l, t, r, b. O YOLO26 tirou essa parte para ficar mais leve e mais fácil de exportar.
            </li>
          </ul>
          <p>
            A retropropagação faz o mesmo papel da regra do perceptron, só que para milhões de pesos de uma vez: cada peso anda um pouquinho na direção que diminui a soma desses erros.
          </p>
          <h3>Um YOLO, cinco tarefas</h3>
          <p>
            A espinha e o pescoço são os mesmos; o que muda é a cabeça. Na <b>segmentação</b>, a cabeça prevê, além da caixa, alguns coeficientes que combinam um pequeno conjunto de “máscaras-protótipo” gerado a partir
            do mapa P3 (a ideia do YOLACT), e daí sai a máscara de cada objeto. Na <b>classificação</b>, a cabeça de caixas é trocada por uma camada que dá uma nota por classe para a foto inteira. Há ainda <b>pose</b>{' '}
            (pontos-chave, como as articulações de um animal) e <b>OBB</b> (caixas giradas).
          </p>
          <Figura n="7.8" legenda="A mesma família de modelos, cinco tarefas. Muda o arquivo de pesos e o formato do rótulo.">
            <FigTarefasYolo />
          </Figura>
          <div className="tbl-wrap">
            <table className="tbl wrap1">
              <thead>
                <tr>
                  <th>tarefa</th>
                  <th>pesos</th>
                  <th>uma linha do rótulo</th>
                  <th>no agro</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>detectar</td>
                  <td>
                    <code>yolo26n.pt</code>
                  </td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>
                    <code>0 cx cy w h</code>
                  </td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>contar gado, frutos, pragas na armadilha</td>
                </tr>
                <tr>
                  <td>segmentar</td>
                  <td>
                    <code>yolo26n-seg.pt</code>
                  </td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>
                    <code>0 x1 y1 x2 y2 ... xn yn</code> (polígono)
                  </td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>área de lesão, copa de árvore, daninhas</td>
                </tr>
                <tr>
                  <td>classificar</td>
                  <td>
                    <code>yolo26n-cls.pt</code>
                  </td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>sem .txt: uma pasta por classe</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>folha sadia ou doente, grão bom ou ardido</td>
                </tr>
                <tr>
                  <td>pose</td>
                  <td>
                    <code>yolo26n-pose.pt</code>
                  </td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>caixa + x y visível de cada ponto</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>postura e claudicação de vacas</td>
                </tr>
                <tr>
                  <td>caixa girada</td>
                  <td>
                    <code>yolo26n-obb.pt</code>
                  </td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>
                    <code>0 x1 y1 x2 y2 x3 y3 x4 y4</code>
                  </td>
                  <td style={{ textAlign: 'left', whiteSpace: 'normal' }}>gado e máquinas vistos de cima, linhas de plantio</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ),
    },
    {
      id: 'a7-nms',
      titulo: 'A faxina no fim: confiança e NMS',
      min: 20,
      body: (
        <div className="prose">
          <p>
            Com 8.400 pontos chutando caixas, o mesmo boi recebe várias caixas de pontos vizinhos. O pós-processamento clássico tem dois cortes, e são exatamente os dois argumentos que vocês passam no{' '}
            <code>predict</code>:
          </p>
          <ol>
            <li>
              <code>conf</code>: descarta caixas com confiança abaixo do limiar (padrão 0,25).
            </li>
            <li>
              <code>iou</code>: o <b>NMS</b> ordena as caixas pela confiança, guarda a melhor, apaga todas as que se sobrepõem a ela acima do limiar (padrão 0,7) e repete com as que sobraram.
            </li>
          </ol>
          <NmsLab />
          <Callout kind="campo" title="YOLO26 e o fim do NMS">
            <p>
              O NMS é sequencial, difícil de acelerar e esquisito de exportar para chip embarcado. O YOLOv10 e agora o YOLO26 são treinados para que só <b>um</b> ponto da grade responda por cada objeto, então a saída já
              vem limpa e o NMS some. Para vocês muda pouco no código; para quem vai pôr o modelo numa câmera de brete com processador fraco, muda bastante. O limiar de confiança continua existindo, e a escolha dele
              continua sendo de vocês.
            </p>
          </Callout>
        </div>
      ),
    },
    {
      id: 'a7-caso',
      titulo: 'Caso real: gado contado por drone no Piauí',
      min: 10,
      body: (
        <div className="prose">
          <Caso
            tipo="artigo"
            titulo="Automatic Cattle Detection and Counting System in Aerial Images Using Computer Vision Algorithms"
            autores="Leal, Jayson, Lira, Veloso, Oseas e Benjamin"
            onde="ENIAC 2024, SBC OpenLib"
            link="https://sol.sbc.org.br/index.php/eniac/article/download/33817/33608"
            resumo={
              <p>
                Vídeos de drone sobre um pasto em São João da Varjota (PI) viraram 120 imagens, rotuladas no Roboflow e ampliadas para 273 com aumento de dados. Um YOLOv9 pré-treinado no COCO foi ajustado no Colab e
                empacotado numa API que devolve a contagem. É praticamente o que vamos fazer na Aula 8.
              </p>
            }
            pipeline={[
              'Frames de vídeos de drone (Eachine Tyro129 com câmera RunCam)',
              'Rótulos no Roboflow: marcação automática e correção manual',
              'Aumento: espelhamento, rotação de 90°, recorte, rotação de ±15°, cisalhamento, saturação, tons de cinza',
              'YOLOv9 pré-treinado no COCO, 100 épocas, imgsz 640, no Colab',
              'API com FastAPI e Docker que devolve a contagem em JSON',
            ]}
            numeros={[
              { v: '120', l: 'imagens originais' },
              { v: '273', l: 'com aumento de dados' },
              { v: '88,5%', l: 'mAP' },
              { v: '90%', l: 'revocação' },
              { v: '95,6 ou 96,6%', l: 'precisão (o texto traz os dois)' },
            ]}
            discutir={[
              'O aumento de dados foi feito antes ou depois de separar treino e teste? Se uma imagem e a versão espelhada dela caem em lados diferentes, o teste vira cola.',
              'Os autores separaram frames do mesmo vídeo em conjuntos diferentes? Por que isso importa tanto em vídeo?',
              'O artigo diz "mAP" sem dizer o limiar de IoU. Que diferença faz ser mAP50 ou mAP50-95?',
              'Revocação de 90%: num rebanho de 500 cabeças, quantos animais ficariam de fora da contagem? Isso é aceitável para quê?',
            ]}
          />
          <Callout kind="prof" title="Nota pra quem dá a aula">
            <p>Leve o PDF aberto. As perguntas acima não são para "pegar" os autores: são exatamente as que a banca vai fazer no TCC de vocês. Ler um artigo procurando onde o teste pode ter vazado é uma habilidade.</p>
          </Callout>
        </div>
      ),
    },
    {
      id: 'a7-colab',
      titulo: 'Mão na massa: um YOLO pronto no Colab',
      min: 15,
      body: (
        <div className="prose">
          <p>
            O <a href={NB7} target="_blank" rel="noreferrer">notebook da Aula 7</a> começa com o perceptron do Lab 7.1 escrito à mão (AND converge, XOR não) e a MLP do scikit-learn resolvendo o XOR. Depois faz três coisas: (1) roda o <code>yolo26n.pt</code> numa foto de vocês e conta as vacas; (2) implementa IoU e NMS à mão e confere com
            a torchvision; (3) roda o mesmo modelo num piquete visto de cima. Nos nossos testes ele não achou nenhuma vaca: chamou os bois de pipa (<i>kite</i>) e de pássaro (<i>bird</i>).
          </p>
          <Code code={CODE_INFER} title="Python · ultralytics" />
          <Code code={CODE_NMS} title="Python · numpy + torchvision" />
          <Code code={CODE_PERC} title="Python · o perceptron do Lab 7.1, à mão e com scikit-learn" />
          <Callout kind="pegadinha" title="Por que o modelo do COCO não vê o boi de cima?">
            <p>
              O COCO tem a classe <i>cow</i>, mas quase todas as fotos são de lado, na altura dos olhos. Visto de drone, o boi é uma elipse clara com sombra, coisa que o modelo nunca viu. É o aprendizado por atalho da
              Aula 6 de novo: o modelo aprendeu "vaca de perfil com pernas", não "vaca". Por isso, na Aula 8, vamos treinar com imagens do nosso ponto de vista.
            </p>
          </Callout>
        </div>
      ),
    },
    {
      id: 'a7-fecho',
      titulo: 'Pra levar pra casa',
      min: 5,
      body: (
        <div className="prose">
          <ol>
            <li>Perceptron = pesos + viés + degrau, aprende corrigindo o erro. Sozinho, só separa com uma reta (não faz XOR); em camadas vira MLP, com convolução vira CNN.</li>
            <li>Classificação diz o quê; segmentação semântica, o quê em cada pixel; detecção, o quê e onde; instâncias, cada objeto com sua máscara (U-Net e YOLO-seg).</li>
            <li>Dois estágios (R-CNN) recortam e classificam regiões; um estágio (YOLO) olha a imagem inteira de uma vez.</li>
            <li>Detector = para cada objeto, uma caixa, uma classe e uma confiança. Contar vira contar caixas.</li>
            <li>Rótulo YOLO: um .txt por imagem, <code>classe cx cy w h</code> normalizados. Confira desenhando de volta.</li>
            <li>IoU decide se a caixa é acerto. Objeto pequeno sofre mais com o mesmo erro em pixels.</li>
            <li>YOLO = espinha + pescoço + três cabeças (passos 8, 16 e 32). Cada ponto da grade prevê classe e as distâncias l, t, r, b.</li>
            <li>conf e iou são decisões de projeto, não detalhes: mudam a contagem.</li>
          </ol>
        </div>
      ),
    },
  ],
  quiz: [
    {
      p: 'Um perceptron com w₁ = 1, w₂ = 1 e b = −1,5 (degrau em zero) implementa qual porta lógica?',
      o: ['OR', 'AND', 'XOR', 'NOT'],
      a: 1,
      e: 'Só (1,1) dá 1 + 1 − 1,5 = 0,5 ≥ 0. Os outros dão soma negativa. É o AND.',
    },
    {
      p: 'Por que um perceptron sozinho não aprende o XOR?',
      o: ['A taxa de aprendizado é pequena', 'Faltam épocas', 'Não existe uma reta que separe as duas classes do XOR', 'O degrau não é derivável'],
      a: 2,
      e: 'O perceptron só traça uma reta (um hiperplano). O XOR não é linearmente separável; é preciso uma camada oculta (MLP).',
    },
    {
      p: 'Você quer a área de cada lesão de ferrugem numa folha. Qual tarefa?',
      o: ['Classificação', 'Detecção', 'Segmentação (de instâncias)', 'Pose'],
      a: 2,
      e: 'Área pede pixels. Uma caixa superestima a área de uma lesão irregular; a máscara de cada lesão dá a medida.',
    },
    {
      p: 'Qual a principal diferença entre o Faster R-CNN e o YOLO?',
      o: ['O YOLO não usa CNN', 'O Faster R-CNN propõe regiões e depois classifica; o YOLO prevê caixas e classes numa única passada', 'O YOLO só classifica', 'O Faster R-CNN não precisa de rótulos'],
      a: 1,
      e: 'Dois estágios contra um. Um estágio é mais rápido e vê o contexto da imagem inteira.',
    },
    {
      p: 'A linha "0 0.5 0.5 0.2 0.1" num rótulo YOLO de uma foto 1000×600 descreve uma caixa de que tamanho em pixels?',
      o: ['200 × 60', '200 × 100', '0,2 × 0,1 pixel', '500 × 300'],
      a: 0,
      e: 'w e h são frações da largura e da altura: 0,2 × 1000 = 200 e 0,1 × 600 = 60. O centro fica em (500, 300).',
    },
    {
      p: 'Duas caixas de 40×20 px, uma deslocada 10 px para o lado. Qual é o IoU?',
      o: ['0,75', '0,60', '0,50', '0,25'],
      a: 1,
      e: 'Intersecção = 30 × 20 = 600. União = 800 + 800 − 600 = 1000. IoU = 0,6.',
    },
    {
      p: 'No rebanho aglomerado no cocho, o que acontece se você baixar o limiar iou do NMS para 0,3?',
      o: ['Aparecem mais caixas duplicadas', 'O NMS passa a apagar bois vizinhos verdadeiros e a contagem cai', 'Nada, o NMS só olha a confiança', 'Somem os falsos positivos do cupinzeiro'],
      a: 1,
      e: 'Com limiar baixo, qualquer sobreposição modesta basta para apagar uma caixa. Bois encostados se sobrepõem de verdade, e um deles some.',
    },
    {
      p: 'Com imgsz 640, qual cabeça do YOLO tem a grade mais fina e é a mais indicada para objetos pequenos?',
      o: ['P5, passo 32, grade 20×20', 'P4, passo 16, grade 40×40', 'P3, passo 8, grade 80×80', 'Todas iguais'],
      a: 2,
      e: 'Passo 8 significa um ponto a cada 8 pixels do modelo: 640/8 = 80 pontos por lado.',
    },
    {
      p: 'O que o YOLO26 tem de diferente na hora de usar o modelo?',
      o: ['Não precisa de rótulos', 'Dispensa o NMS na inferência porque cada objeto é previsto por um único ponto', 'Só funciona com imagens de satélite', 'Não tem limiar de confiança'],
      a: 1,
      e: 'Ele é treinado com atribuição um para um (como o YOLOv10), então a saída já vem sem duplicatas. O limiar de confiança continua.',
    },
  ],
  desafios: [
    {
      nivel: 'Aquecimento',
      txt: (
        <>
          Rotule 3 piquetes no Lab 7.3 e baixe os .txt. Escreva em 5 linhas a sua regra de rotulagem (cabeça entra? sombra entra? animal cortado pela borda entra?).
        </>
      ),
    },
    {
      nivel: 'Médio',
      txt: (
        <>
          No notebook, escreva uma função que converte um JSON no formato COCO para os .txt do YOLO. Teste desenhando as caixas convertidas de volta na imagem.
        </>
      ),
    },
    {
      nivel: 'Desafio',
      txt: (
        <>
          Rode o <code>yolo26n.pt</code> num vídeo seu (celular, pátio, estacionamento) com <code>conf</code> de 0,1, 0,25 e 0,5 e <code>iou</code> de 0,3, 0,5 e 0,7. Monte uma tabela 3×3 com a contagem média
          por frame e explique o padrão.
        </>
      ),
    },
  ],
  leitura: [
    <>
      Stanford CS231n, aula 9 (2024): <i>Object Detection and Image Segmentation</i>. A referência clássica, com classificação, segmentação semântica, detecção e instâncias lado a lado.{' '}
      <a href="https://cs231n.stanford.edu/" target="_blank" rel="noreferrer">cs231n.stanford.edu</a>
    </>,
    <>IIT Gandhinagar, ES 667, aula 9 (2026): da classificação às caixas, IoU e NMS, YOLO numa passada e U-Net, muito didática.</>,
    <>Universidade de Toronto, CSC420 (2025): separa bem “o quê”, “o quê e onde” e “rótulo por pixel”.</>,
    <>USP, PSI5886 (em português): R-CNN, Faster R-CNN e YOLO, com os prós e contras de cada um.</>,
    <>IIT Kharagpur, CS60010, <i>Detection and Segmentation</i>: 106 slides do R-CNN ao YOLO. Weizmann, DL4CV: tutorial de YOLO com a função de perda e o treino.</>,
    <>UFPR, Prof. David Menotti; UFPE, Prof. Aluizio Araújo; UFU, Prof. Marcelo Albertini (em português): perceptron, XOR, gradiente, MLP e retropropagação. Wisconsin, CS 540 (2025): o perceptron aprendendo AND e OR.</>,
    <>RONNEBERGER, O.; FISCHER, P.; BROX, T. U-Net: convolutional networks for biomedical image segmentation. MICCAI, 2015.</>,
    <>GIRSHICK, R. et al. Rich feature hierarchies for accurate object detection and semantic segmentation (R-CNN). CVPR, 2014.</>,
    <>REDMON, J.; DIVVALA, S.; GIRSHICK, R.; FARHADI, A. You Only Look Once: unified, real-time object detection. CVPR, 2016. O artigo que começou tudo, curto e legível.</>,
    <>LEAL, I. et al. Automatic cattle detection and counting system in aerial images using computer vision algorithms. ENIAC, 2024. O caso da aula.</>,
    <>
      Documentação do ultralytics: <a href="https://docs.ultralytics.com/tasks/detect/" target="_blank" rel="noreferrer">tarefa de detecção</a> e{' '}
      <a href="https://docs.ultralytics.com/datasets/detect/" target="_blank" rel="noreferrer">formato dos rótulos</a>.
    </>,
    <>SALVADORI (TCC UTFPR Ponta Grossa, 2020): HSV + componentes conexos contra RetinaNet para plantas de milho. Está nas Leituras da casa, na página inicial.</>,
    <>GONZALEZ e WOODS, cap. 12 (reconhecimento de objetos), para a base clássica.</>,
  ],
}
