// Peças visuais compartilhadas pelas aulas de YOLO (7 e 8)
import { type Box } from '../lib/yolo'

export const COR = {
  verdade: '#ffe000',
  pred: '#131a9f',
  tp: '#1fae4b',
  fp: '#e0302a',
  fn: '#ff8a00',
  fraca: 'rgba(255,255,255,0.55)',
}

export function drawBox(ctx: CanvasRenderingContext2D, s: number, b: Box, cor: string, o: { dash?: number[]; lw?: number; label?: string; fill?: string; alpha?: number } = {}) {
  ctx.save()
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha
  const x = b.x0 * s, y = b.y0 * s, w = (b.x1 - b.x0) * s, h = (b.y1 - b.y0) * s
  if (o.fill) {
    ctx.fillStyle = o.fill
    ctx.fillRect(x, y, w, h)
  }
  ctx.strokeStyle = cor
  ctx.lineWidth = o.lw ?? 2
  ctx.setLineDash(o.dash ?? [])
  ctx.strokeRect(x, y, w, h)
  if (o.label) {
    ctx.setLineDash([])
    ctx.font = `600 ${Math.max(10, 5 * s)}px Arial, sans-serif`
    const tw = ctx.measureText(o.label).width + 6
    const th = Math.max(12, 6 * s)
    const ly = y - th < 0 ? y : y - th
    ctx.fillStyle = cor
    ctx.fillRect(x, ly, tw, th)
    ctx.fillStyle = cor === COR.verdade || cor === COR.fn ? '#111' : '#fff'
    ctx.fillText(o.label, x + 3, ly + th - 3)
  }
  ctx.restore()
}

/** curva precisão × revocação em SVG, com o ponto de operação marcado */
export function PRChart(p: {
  curves: { name: string; p: number[]; r: number[]; color: string }[]
  ponto?: { r: number; p: number; color: string }
  height?: number
}) {
  const W = 300, H = p.height ?? 210, m = { l: 34, r: 10, t: 10, b: 30 }
  const X = (r: number) => m.l + r * (W - m.l - m.r)
  const Y = (v: number) => H - m.b - v * (H - m.t - m.b)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 380, display: 'block' }} role="img" aria-label="curva precisão por revocação">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line x1={X(0)} x2={X(1)} y1={Y(t)} y2={Y(t)} stroke="var(--rule)" />
          <text x={m.l - 4} y={Y(t) + 3} fontSize="9" textAnchor="end" fill="var(--ink-faint)">
            {t.toFixed(2)}
          </text>
          <text x={X(t)} y={H - m.b + 12} fontSize="9" textAnchor="middle" fill="var(--ink-faint)">
            {t.toFixed(2)}
          </text>
        </g>
      ))}
      <text x={(X(0) + X(1)) / 2} y={H - 4} fontSize="10" textAnchor="middle" fill="var(--ink-soft)">
        revocação (dos bois que existem, quantos achei)
      </text>
      <text x={10} y={(Y(0) + Y(1)) / 2} fontSize="10" textAnchor="middle" fill="var(--ink-soft)" transform={`rotate(-90 10 ${(Y(0) + Y(1)) / 2})`}>
        precisão
      </text>
      {p.curves.map((c) => {
        const pts = c.r.map((r, i) => `${X(r).toFixed(1)},${Y(c.p[i]).toFixed(1)}`)
        return <polyline key={c.name} points={[`${X(0)},${Y(c.p[0] ?? 1)}`, ...pts].join(' ')} fill="none" stroke={c.color} strokeWidth={2} />
      })}
      {p.ponto && <circle cx={X(p.ponto.r)} cy={Y(p.ponto.p)} r={5} fill={p.ponto.color} stroke="#fff" strokeWidth={1.5} />}
    </svg>
  )
}

export function Stat({ v, l, cor }: { v: string; l: string; cor?: string }) {
  return (
    <div className="stat">
      <b style={cor ? { color: cor } : undefined}>{v}</b>
      <span>{l}</span>
    </div>
  )
}

export function Chave({ itens }: { itens: { cor: string; t: string; dash?: boolean }[] }) {
  return (
    <div className="legend" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: '0.78rem', color: 'var(--ink-soft)' }}>
      {itens.map((i) => (
        <span key={i.t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i style={{ width: 16, height: 10, border: `2px ${i.dash ? 'dashed' : 'solid'} ${i.cor}`, display: 'inline-block' }} />
          {i.t}
        </span>
      ))}
    </div>
  )
}
