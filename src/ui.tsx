import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, ExternalLink, Upload, Shuffle, Lightbulb, Sprout, TriangleAlert, Presentation } from 'lucide-react'
import { type RGB, type Gray, toImageData, loadFile } from './lib/img'

/* ---------- canvas ---------- */

type CanvasProps = {
  img: RGB | Gray | null
  lut?: (v: number) => [number, number, number]
  scale?: number
  pixelated?: boolean
  overlay?: (ctx: CanvasRenderingContext2D, s: number) => void
  onPixel?: (x: number, y: number) => void
  onClickPixel?: (x: number, y: number) => void
  onDrag?: (x: number, y: number) => void
  label?: string
  maxWidth?: number
}

export function ImgCanvas({ img, lut, scale = 2, pixelated, overlay, onPixel, onClickPixel, onDrag, label, maxWidth }: CanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const down = useRef(false)
  useEffect(() => {
    const c = ref.current
    if (!c || !img) return
    const off = document.createElement('canvas')
    off.width = img.w
    off.height = img.h
    off.getContext('2d')!.putImageData(toImageData(img, lut), 0, 0)
    c.width = img.w * scale
    c.height = img.h * scale
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingEnabled = !pixelated
    ctx.drawImage(off, 0, 0, c.width, c.height)
    if (overlay) overlay(ctx, scale)
  }, [img, lut, scale, pixelated, overlay])
  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    if (!img) return null
    const x = Math.floor(((e.clientX - r.left) / r.width) * img.w)
    const y = Math.floor(((e.clientY - r.top) / r.height) * img.h)
    return [Math.max(0, Math.min(img.w - 1, x)), Math.max(0, Math.min(img.h - 1, y))] as const
  }
  const interactive = !!(onPixel || onClickPixel || onDrag)
  return (
    <canvas
      ref={ref}
      aria-label={label}
      role="img"
      className={`cv${pixelated ? ' px' : ''}${interactive ? ' hover' : ''}`}
      style={{ maxWidth: maxWidth ? `${maxWidth}px` : undefined, touchAction: onDrag ? 'none' : undefined }}
      onPointerMove={(e) => {
        const p = pos(e)
        if (!p) return
        onPixel?.(p[0], p[1])
        if (down.current) onDrag?.(p[0], p[1])
      }}
      onPointerDown={(e) => {
        const p = pos(e)
        if (!p) return
        down.current = true
        onClickPixel?.(p[0], p[1])
        onDrag?.(p[0], p[1])
        onPixel?.(p[0], p[1])
      }}
      onPointerUp={() => (down.current = false)}
      onPointerLeave={() => (down.current = false)}
    />
  )
}

/* ---------- controles ---------- */

export function Slider(p: { id: string; label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <div className="ctl">
      <label htmlFor={p.id}>
        {p.label} <output>{p.fmt ? p.fmt(p.value) : p.value}</output>
      </label>
      <input id={p.id} type="range" min={p.min} max={p.max} step={p.step ?? 1} value={p.value} onChange={(e) => p.onChange(+e.target.value)} />
    </div>
  )
}

export function Seg<T extends string>(p: { value: T; options: readonly T[]; onChange: (v: T) => void; label?: string }) {
  return (
    <div className="ctl" style={{ maxWidth: 'none', flex: '0 1 auto', minWidth: 0 }}>
      {p.label && <label>{p.label}</label>}
      <div className="seg" role="group" aria-label={p.label}>
        {p.options.map((o) => (
          <button key={o} type="button" aria-pressed={o === p.value} onClick={() => p.onChange(o)}>
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}

/** escolhe uma imagem de exemplo, sorteia outra ou carrega uma foto do aluno */
export function SourcePicker(p: {
  samples: readonly string[]
  value: string
  onChange: (v: string) => void
  onShuffle?: () => void
  onUpload?: (img: RGB) => void
}) {
  const [err, setErr] = useState('')
  return (
    <div className="controls" style={{ alignItems: 'center' }}>
      <div className="seg" role="group" aria-label="imagem">
        {p.samples.map((s) => (
          <button key={s} type="button" aria-pressed={s === p.value} onClick={() => p.onChange(s)}>
            {s}
          </button>
        ))}
      </div>
      {p.onShuffle && (
        <button type="button" className="btn ghost" onClick={p.onShuffle}>
          <Shuffle size={15} /> Sortear outra
        </button>
      )}
      {p.onUpload && (
        <span className="btn ghost upload">
          <Upload size={15} /> Usar minha foto
          <input
            type="file"
            accept="image/*"
            aria-label="Carregar uma foto"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              try {
                setErr('')
                p.onUpload!(await loadFile(f))
                p.onChange('minha foto')
              } catch (x) {
                setErr((x as Error).message)
              }
            }}
          />
        </span>
      )}
      {err && <span className="err">{err}</span>}
    </div>
  )
}

/* ---------- blocos de texto ---------- */

export function Lab(p: { n: string; title: string; desc?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="lab" aria-label={`Laboratório ${p.n}`}>
      <div className="lab-head">
        <span className="lab-tag">Lab {p.n}</span>
        <h3>{p.title}</h3>
        {p.desc && <p>{p.desc}</p>}
      </div>
      <div className="lab-body">{p.children}</div>
    </section>
  )
}

const CALLOUT = {
  analogia: { t: 'Analogia pra guardar', icon: <Lightbulb size={16} /> },
  campo: { t: 'Na lavoura', icon: <Sprout size={16} /> },
  pegadinha: { t: 'Pegadinha clássica', icon: <TriangleAlert size={16} /> },
  prof: { t: 'Nota pra quem dá a aula', icon: <Presentation size={16} /> },
}

export function Callout(p: { kind: keyof typeof CALLOUT; title?: string; children: React.ReactNode }) {
  const c = CALLOUT[p.kind]
  return (
    <div className={`callout ${p.kind}`}>
      <div className="callout-t">
        {c.icon} {p.title ?? c.t}
      </div>
      <div style={{ display: 'grid', gap: 8 }}>{p.children}</div>
    </div>
  )
}

export function Term(p: { def: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="term">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} onBlur={() => setOpen(false)}>
        {p.children}
      </button>
      {open && <span className="term-pop" role="tooltip">{p.def}</span>}
    </span>
  )
}

/* ---------- código Python ---------- */

function highlight(code: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const re = /(#[^\n]*)|("[^"\n]*"|'[^'\n]*')|\b(import|from|as|def|return|for|in|if|else|elif|print|with|lambda|True|False|None|and|or|not)\b/g
  let last = 0, m: RegExpExecArray | null, k = 0
  while ((m = re.exec(code))) {
    if (m.index > last) out.push(code.slice(last, m.index))
    out.push(<span key={k++} className={m[1] ? 'c' : m[2] ? 's' : 'k'}>{m[0]}</span>)
    last = m.index + m[0].length
  }
  out.push(code.slice(last))
  return out
}

export function Code({ code, title = 'Python · Google Colab' }: { code: string; title?: string }) {
  const [ok, setOk] = useState(false)
  const pre = useRef<HTMLPreElement>(null)
  const nodes = useMemo(() => highlight(code.trim()), [code])
  return (
    <div className="code">
      <div className="code-head">
        <span>{title}</span>
        <div className="acts">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard
                ?.writeText(code.trim())
                .then(() => {
                  setOk(true)
                  setTimeout(() => setOk(false), 1600)
                })
                .catch(() => {
                  const s = window.getSelection()
                  const r = document.createRange()
                  if (pre.current && s) {
                    r.selectNodeContents(pre.current)
                    s.removeAllRanges()
                    s.addRange(r)
                  }
                })
            }}
          >
            {ok ? <Check size={12} /> : <Copy size={12} />} {ok ? 'Copiado' : 'Copiar'}
          </button>
          <a href="https://colab.research.google.com/#create=true" target="_blank" rel="noreferrer">
            <ExternalLink size={12} /> Abrir Colab
          </a>
        </div>
      </div>
      <pre ref={pre}>{nodes}</pre>
    </div>
  )
}

/* ---------- quiz ---------- */

export type Q = { p: string; o: string[]; a: number; e: string }

export function Quiz({ qs }: { qs: Q[] }) {
  const [ans, setAns] = useState<(number | null)[]>(() => qs.map(() => null))
  const done = ans.filter((a) => a !== null).length
  const right = ans.filter((a, i) => a === qs[i].a).length
  return (
    <div className="quiz">
      {qs.map((q, i) => (
        <div className="q" key={i}>
          <div className="q-p">
            {i + 1}. {q.p}
          </div>
          <div className="q-opts">
            {q.o.map((o, j) => {
              const chosen = ans[i] === j
              const cls = ans[i] === null ? '' : j === q.a ? 'right' : chosen ? 'wrong' : ''
              return (
                <button key={j} type="button" className={cls} disabled={ans[i] !== null} onClick={() => setAns((a) => a.map((v, k) => (k === i ? j : v)))}>
                  {String.fromCharCode(97 + j)}) {o}
                </button>
              )
            })}
          </div>
          {ans[i] !== null && (
            <div className="q-fb">
              <b>{ans[i] === q.a ? 'Isso!' : 'Quase.'}</b> {q.e}
            </div>
          )}
        </div>
      ))}
      <div className="score">
        {done === qs.length ? `Você acertou ${right} de ${qs.length}.` : `${done} de ${qs.length} respondidas.`}{' '}
        {done > 0 && (
          <button type="button" className="btn ghost" style={{ marginLeft: 8 }} onClick={() => setAns(qs.map(() => null))}>
            Refazer
          </button>
        )}
      </div>
    </div>
  )
}

/* ---------- gráficos pequenos (SVG) ---------- */

export function Histogram(p: {
  data: number[]
  lo?: number
  hi?: number
  marks?: { v: number; label: string; color?: string }[]
  color?: string
  height?: number
  xlabel?: string
  second?: number[]
}) {
  const W = 320, H = p.height ?? 120, padB = 18
  const lo = p.lo ?? 0, hi = p.hi ?? 255
  const mx = Math.max(1, ...p.data, ...(p.second ?? []))
  const bw = W / p.data.length
  const x = (v: number) => ((v - lo) / (hi - lo)) * W
  const path = (d: number[]) => d.map((v, i) => `${i ? 'L' : 'M'}${(i + 0.5) * bw},${H - padB - (v / mx) * (H - padB - 6)}`).join('')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="histograma" style={{ display: 'block' }}>
      {p.data.map((v, i) => (
        <rect key={i} x={i * bw} y={H - padB - (v / mx) * (H - padB - 6)} width={Math.max(0.6, bw - 0.2)} height={(v / mx) * (H - padB - 6)} fill={p.color ?? 'var(--leaf)'} opacity={0.85} />
      ))}
      {p.second && <path d={path(p.second)} fill="none" stroke="var(--soil)" strokeWidth={1.5} />}
      <line x1={0} x2={W} y1={H - padB} y2={H - padB} stroke="var(--rule)" />
      {p.marks?.map((m, i) => (
        <g key={i}>
          <line x1={x(m.v)} x2={x(m.v)} y1={4} y2={H - padB} stroke={m.color ?? 'var(--soil)'} strokeWidth={2} strokeDasharray="4 3" />
          <text x={Math.min(W - 4, Math.max(4, x(m.v) + 4))} y={14 + i * 12} fontSize={10} fill={m.color ?? 'var(--soil)'} fontFamily="var(--f-mono)" textAnchor={x(m.v) > W - 80 ? 'end' : 'start'}>
            {m.label}
          </text>
        </g>
      ))}
      <text x={0} y={H - 4} fontSize={10} fill="var(--ink-faint)" fontFamily="var(--f-mono)">{fmtN(lo)}</text>
      <text x={W} y={H - 4} fontSize={10} fill="var(--ink-faint)" fontFamily="var(--f-mono)" textAnchor="end">{fmtN(hi)}</text>
      {p.xlabel && <text x={W / 2} y={H - 4} fontSize={10} fill="var(--ink-faint)" fontFamily="var(--f-mono)" textAnchor="middle">{p.xlabel}</text>}
    </svg>
  )
}

export const fmtN = (v: number) => (Math.abs(v) >= 10 || Number.isInteger(v) ? v.toFixed(0) : v.toFixed(2))

/** curva de transformação s = T(r) */
export function CurvePlot({ lut }: { lut: number[] }) {
  const S = 150
  const d = lut.map((v, i) => `${i ? 'L' : 'M'}${(i / 255) * S},${S - (v / 255) * S}`).join('')
  return (
    <svg viewBox={`-22 -6 ${S + 30} ${S + 30}`} width="100%" style={{ maxWidth: 200, display: 'block' }} role="img" aria-label="curva de transformação">
      <rect x={0} y={0} width={S} height={S} fill="var(--surface-2)" />
      <line x1={0} y1={S} x2={S} y2={0} stroke="var(--rule)" strokeDasharray="3 3" />
      <path d={d} fill="none" stroke="var(--leaf)" strokeWidth={2.5} />
      <text x={S / 2} y={S + 18} fontSize={10} textAnchor="middle" fill="var(--ink-faint)" fontFamily="var(--f-mono)">entrada r</text>
      <text x={-8} y={S / 2} fontSize={10} textAnchor="middle" fill="var(--ink-faint)" fontFamily="var(--f-mono)" transform={`rotate(-90 -8 ${S / 2})`}>saída s</text>
    </svg>
  )
}

export function LineChart(p: { series: { name: string; data: number[]; color: string }[]; ymin?: number; ymax?: number; height?: number; xlabel?: string; ylabel?: string }) {
  const W = 340, H = p.height ?? 150, L = 34, B = 22, T = 8
  const all = p.series.flatMap((s) => s.data)
  const ymin = p.ymin ?? Math.min(0, ...all), ymax = p.ymax ?? Math.max(1e-6, ...all)
  const n = Math.max(2, ...p.series.map((s) => s.data.length))
  const x = (i: number) => L + (i / (n - 1)) * (W - L - 8)
  const y = (v: number) => T + (1 - (v - ymin) / (ymax - ymin || 1)) * (H - T - B)
  const ticks = [ymin, (ymin + ymax) / 2, ymax]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={p.ylabel ?? 'gráfico'} style={{ display: 'block' }}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={L} x2={W - 8} y1={y(t)} y2={y(t)} stroke="var(--rule)" strokeDasharray={i ? '3 3' : undefined} />
          <text x={L - 4} y={y(t) + 3} fontSize={9} textAnchor="end" fill="var(--ink-faint)" fontFamily="var(--f-mono)">{fmtN(t)}</text>
        </g>
      ))}
      {p.series.map((s) =>
        s.data.length ? (
          <g key={s.name}>
            <path d={s.data.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('')} fill="none" stroke={s.color} strokeWidth={2} />
            <circle cx={x(s.data.length - 1)} cy={y(s.data[s.data.length - 1])} r={3.5} fill={s.color} />
          </g>
        ) : null,
      )}
      {p.xlabel && <text x={(W + L) / 2} y={H - 4} fontSize={9} textAnchor="middle" fill="var(--ink-faint)" fontFamily="var(--f-mono)">{p.xlabel}</text>}
    </svg>
  )
}

export function Legend({ items }: { items: { name: string; color: string }[] }) {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontFamily: 'var(--f-mono)', fontSize: '0.74rem', color: 'var(--ink-soft)' }}>
      {items.map((it) => (
        <span key={it.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i style={{ width: 10, height: 10, borderRadius: 2, background: it.color, display: 'inline-block' }} /> {it.name}
        </span>
      ))}
    </div>
  )
}

export const rgbStr = (c: readonly number[]) => `rgb(${c.map((v) => Math.round(v)).join(',')})`

/* ---------- slide estilo Beamer ---------- */

export function Slide({ title, children, page, total }: { title: string; children: React.ReactNode; page?: number; total?: number }) {
  return (
    <div className="slide">
      <div className="slide-stripe" />
      <header className="slide-header">{title}</header>
      <div className="slide-content">{children}</div>
      <footer className="slide-footer">
        {page && total && <span>{page} / {total}</span>}
      </footer>
    </div>
  )
}

export function Theorem({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="theorem">
      {title && <h2>{title}</h2>}
      <div className="theorem-body">{children}</div>
    </section>
  )
}

export function Formula({ children }: { children: React.ReactNode }) {
  return <div className="slide-formula">{children}</div>
}

/* ---------- caso real (artigo, boletim ou TCC) ---------- */

export function Caso(p: {
  tipo: string
  titulo: string
  autores: string
  onde: string
  link?: string
  resumo: React.ReactNode
  pipeline: React.ReactNode[]
  numeros: { v: string; l: string }[]
  discutir?: React.ReactNode[]
}) {
  return (
    <article className="caso" aria-label={`Caso real: ${p.titulo}`}>
      <header className="caso-head">
        <span className="caso-tag">caso real · {p.tipo}</span>
        <h3>{p.titulo}</h3>
        <p className="caso-ref">
          {p.autores} · {p.onde}
          {p.link && (
            <>
              {' '}·{' '}
              <a href={p.link} target="_blank" rel="noreferrer">
                abrir <ExternalLink size={12} />
              </a>
            </>
          )}
        </p>
      </header>
      <div className="caso-body">
        <div className="caso-col">
          <div className="prose">{p.resumo}</div>
          <div className="caso-sub">o que o trabalho fez</div>
          <ol className="caso-pipe">
            {p.pipeline.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
        <div className="caso-col">
          <div className="caso-sub">números do trabalho</div>
          <div className="caso-nums">
            {p.numeros.map((n) => (
              <div key={n.l} className="stat">
                <b>{n.v}</b>
                <span>{n.l}</span>
              </div>
            ))}
          </div>
          {p.discutir && (
            <>
              <div className="caso-sub">pra discutir em sala</div>
              <ol className="caso-q">
                {p.discutir.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ol>
            </>
          )}
        </div>
      </div>
    </article>
  )
}
