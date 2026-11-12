import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Shuffle, Undo2, Trash2, Download, StepForward, RotateCcw, Copy } from 'lucide-react'
import { type RGB, newRGB, toImageData, CAT } from '../lib/img'
import { makePasto, simDetector, iou, inter, nms, matchImage, yoloLine, PW, type Box, type Det, type Fazenda, type Arranjo } from '../lib/yolo'
import { ImgCanvas, Seg, Slider, Lab, Callout, Term, Code, Caso } from '../ui'
import { memo } from '../samples'
import { COR, drawBox, Stat, Chave } from './detui'
import type { Aula } from '../lesson'

const FAZ_A: Fazenda = 'A · nelore em pasto verde'
export const pasto = (seed: number, faz: Fazenda = FAZ_A, arr: Arranjo = 'espalhado') => memo(`pasto${seed}-${faz}-${arr}`, () => makePasto(seed, faz, arr))

const NB7 = 'https://colab.research.google.com/github/tassid/pdi-agro/blob/main/notebooks/Aula7_YOLO_Deteccao.ipynb'

/* ============ Lab 7.1 · três perguntas, três saídas ============ */

function TresSaidas() {
  const [modo, setModo] = useState<'classificação' | 'detecção' | 'segmentação de instâncias'>('detecção')
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
  const resposta = modo === 'classificação' ? 'tem boi? sim' : modo === 'detecção' ? `onde? ${p.gts.length} caixas` : `quais pixels? ${p.gts.length} máscaras`
  return (
    <Lab n="7.1" title="Três perguntas para a mesma foto" desc="Um voo de drone sobre um piquete. A foto é a mesma; o que muda é a pergunta que a rede responde e, por isso, o formato da saída e o custo de rotular.">
      <div className="controls">
        <Seg value={modo} options={['classificação', 'detecção', 'segmentação de instâncias'] as const} onChange={setModo} label="tarefa" />
        <button className="btn ghost" type="button" onClick={() => setSeed((s) => s + 1)}>
          <Shuffle size={15} /> Outro piquete
        </button>
      </div>
      <div className="lab-cols two">
        <div className="panel">
          <ImgCanvas img={modo === 'segmentação de instâncias' ? seg : p.img} overlay={overlay} label="piquete visto de drone" />
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
                <td>segmentação</td>
                <td>{p.gts.length} contornos</td>
                <td>medir área, forma</td>
              </tr>
            </tbody>
          </table>
          <p className="note">Rotular uma caixa leva uns 7 segundos; um contorno leva bem mais. Para contar o rebanho, caixa resolve. Para estimar escore de condição corporal pela área do dorso, precisa do contorno.</p>
        </div>
      </div>
    </Lab>
  )
}

/* ============ Lab 7.2 · anotar como um rotulador ============ */

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
    <Lab n="7.2" title="Rotule o piquete" desc="Arraste para desenhar uma caixa em volta de cada animal, do focinho à anca. Depois ligue o gabarito e veja o IoU de cada caixa sua com a verdade de campo.">
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

/* ============ Lab 7.3 · IoU na mão ============ */

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
    <Lab n="7.3" title="Intersecção sobre união" desc="A caixa amarela é a verdade; a azul é o que o modelo previu. Desloque e mude o tamanho da previsão e veja quando ela deixa de contar como acerto.">
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

/* ============ Lab 7.4 · a grade do YOLO ============ */

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
      n="7.4"
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

/* ============ Lab 7.5 · NMS passo a passo ============ */

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
      n="7.5"
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
  ementa: ['Classificar, detectar, segmentar', 'Rótulo no formato YOLO', 'IoU', 'Grade, passos e cabeças', 'Sem âncora (v8 em diante)', 'NMS e YOLO26 sem NMS', 'Inferência com ultralytics'],
  labs: ['Três perguntas', 'Rotule o piquete', 'IoU na mão', 'A grade do YOLO', 'NMS passo a passo'],
  cor: ['#131a9f', '#ffe000', '#1fae4b', '#e0302a'],
  objetivos: [
    'Diferenciar classificação, detecção e segmentação pela saída e pelo custo de rotular.',
    'Escrever e ler rótulos no formato YOLO e converter para xyxy e COCO.',
    'Calcular IoU à mão e explicar por que objetos pequenos são mais difíceis.',
    'Descrever a arquitetura do YOLO (espinha, pescoço, cabeças em três escalas) e o que cada ponto da grade prevê.',
    'Explicar o NMS, escolher conf e iou conscientemente e saber o que muda no YOLO26.',
    'Rodar um YOLO pré-treinado no Colab, ler a saída e contar objetos.',
  ],
  roteiro: [
    { t: 'Gancho: quem conta o rebanho?', min: 10, tipo: 'gancho' },
    { t: 'Três tarefas + Lab 7.1', min: 15, tipo: 'conceito' },
    { t: 'Rotular: Lab 7.2', min: 25, tipo: 'lab' },
    { t: 'IoU: Lab 7.3', min: 20, tipo: 'conceito' },
    { t: 'Intervalo', min: 15, tipo: 'pausa' },
    { t: 'Por dentro do YOLO + Lab 7.4', min: 25, tipo: 'conceito' },
    { t: 'NMS: Lab 7.5', min: 25, tipo: 'lab' },
    { t: 'Caso real: gado no Piauí', min: 15, tipo: 'conceito' },
    { t: 'Colab: YOLO pronto', min: 20, tipo: 'lab' },
    { t: 'Fechamento + quiz', min: 10, tipo: 'fecho' },
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
              Abra com a pergunta: "quantos bois tem nesse piquete?" e projete o Lab 7.1 sem as caixas. Dê 30 segundos, colete os chutes no quadro. Vai dar diferença de 2 ou 3 entre a turma. Depois ligue a detecção.
              Pergunte: e se fossem 3 mil cabeças em 400 hectares, toda semana?
            </p>
          </Callout>
        </div>
      ),
    },
    {
      id: 'a7-tarefas',
      titulo: 'Classificar, detectar, segmentar',
      min: 15,
      body: (
        <div className="prose">
          <p>
            As três tarefas usam a mesma espinha convolucional da Aula 6. O que muda é a <b>cabeça</b> no fim da rede e o que se rotula. Na classificação, uma palavra por foto. Na detecção, uma caixa por objeto. Na
            segmentação de instâncias, um contorno por objeto. A família YOLO do ultralytics faz as três (e ainda pose e caixas giradas, a OBB), trocando só o sufixo do arquivo de pesos: <code>yolo26n.pt</code>,{' '}
            <code>yolo26n-seg.pt</code>, <code>yolo26n-cls.pt</code>.
          </p>
          <TresSaidas />
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
      min: 25,
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
          <Callout kind="prof" title="Nota pra quem dá a aula · dinâmica de 15 min">
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
      min: 20,
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
            Antes do YOLO, detectores como o Faster R-CNN trabalhavam em <b>dois estágios</b>: primeiro propunham regiões que talvez tivessem objeto, depois classificavam cada região. O YOLO original (Redmon et al.,
            2016) trocou isso por <b>um único passe</b>: a rede divide a imagem numa grade e cada célula prevê caixas e classes de uma vez. Perde um pouco de precisão, ganha muita velocidade.
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
        </div>
      ),
    },
    {
      id: 'a7-nms',
      titulo: 'A faxina no fim: confiança e NMS',
      min: 25,
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
      min: 15,
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
      min: 20,
      body: (
        <div className="prose">
          <p>
            O <a href={NB7} target="_blank" rel="noreferrer">notebook da Aula 7</a> faz três coisas: (1) roda o <code>yolo26n.pt</code> numa foto de vocês e conta as vacas; (2) implementa IoU e NMS à mão e confere com
            a torchvision; (3) roda o mesmo modelo num piquete visto de cima. Nos nossos testes ele não achou nenhuma vaca: chamou os bois de pipa (<i>kite</i>) e de pássaro (<i>bird</i>).
          </p>
          <Code code={CODE_INFER} title="Python · ultralytics" />
          <Code code={CODE_NMS} title="Python · numpy + torchvision" />
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
      min: 10,
      body: (
        <div className="prose">
          <ol>
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
          Rotule 3 piquetes no Lab 7.2 e baixe os .txt. Escreva em 5 linhas a sua regra de rotulagem (cabeça entra? sombra entra? animal cortado pela borda entra?).
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
