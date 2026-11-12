// Labs de redes: perceptron (Aula 7) e ajuste de hiperparâmetros (Aula 8)
import { useMemo, useState, type ReactElement } from 'react'
import { StepForward, FastForward, RotateCcw, Shuffle } from 'lucide-react'
import { Seg, Slider, Lab } from '../ui'
import { Stat } from './detui'
import {
  dadosPerceptron,
  novoPerceptron,
  passoPerceptron,
  saidaPerceptron,
  dadosProdutividade,
  treinarMLP,
  paradaAntecipada,
  avaliarConfig,
  curvaReal,
  MLP,
  type Conjunto,
} from '../lib/neuro'
import { rng } from '../lib/img'

const AZUL = '#131a9f', AMAR = '#e0a800', VERM = '#c62828', VERDE = '#228b22'

/* ============ Perceptron ============ */

export function PerceptronLab() {
  const [conj, setConj] = useState<Conjunto>('AND')
  const [eta, setEta] = useState(0.2)
  const [seed, setSeed] = useState(3)
  const pts = useMemo(() => dadosPerceptron(conj), [conj])
  const [s, setS] = useState(() => novoPerceptron(3))
  const reiniciar = (sd = seed) => setS(novoPerceptron(sd))
  const passo = (n: number) =>
    setS((x) => {
      let y = x
      for (let k = 0; k < n; k++) y = passoPerceptron(y, pts, eta)
      return y
    })
  const folhas = conj.startsWith('folhas')
  const [x0, x1] = folhas ? [0, 1] : [-0.4, 1.4]
  const W = 320, H = 320
  const X = (v: number) => ((v - x0) / (x1 - x0)) * W
  const Y = (v: number) => H - ((v - x0) / (x1 - x0)) * H
  const cel = 16
  const fundo: ReactElement[] = []
  for (let i = 0; i < W / cel; i++)
    for (let j = 0; j < H / cel; j++) {
      const vx = x0 + ((i + 0.5) * cel * (x1 - x0)) / W, vy = x0 + ((H - (j + 0.5) * cel) * (x1 - x0)) / H
      fundo.push(<rect key={`${i}-${j}`} x={i * cel} y={j * cel} width={cel} height={cel} fill={saidaPerceptron(s, vx, vy) ? 'rgba(198,40,40,0.13)' : 'rgba(19,26,159,0.10)'} />)
    }
  // reta w1 x + w2 y + b = 0
  let linha: ReactElement | null = null
  if (Math.abs(s.w2) > 1e-6) {
    const ya = -(s.w1 * x0 + s.b) / s.w2, yb = -(s.w1 * x1 + s.b) / s.w2
    linha = <line x1={X(x0)} y1={Y(ya)} x2={X(x1)} y2={Y(yb)} stroke="#111" strokeWidth={2.5} />
  } else if (Math.abs(s.w1) > 1e-6) {
    const xv = -s.b / s.w1
    linha = <line x1={X(xv)} y1={0} x2={X(xv)} y2={H} stroke="#111" strokeWidth={2.5} />
  }
  const acertos = pts.filter((p) => saidaPerceptron(s, p.x, p.y) === p.c).length
  const nomes = folhas ? ['sadia', 'ferrugem'] : ['0', '1']
  const conv = s.errosEpoca.length > 0 && s.errosEpoca[s.errosEpoca.length - 1] === 0
  return (
    <Lab
      n="7.1"
      title="Um perceptron aprendendo"
      desc="Duas entradas, dois pesos e um viés. A cada exemplo errado, a regra de Rosenblatt empurra a reta na direção certa. Dê passos um a um, ou épocas inteiras, e veja quando a reta para de mexer."
    >
      <div className="controls">
        <Seg value={conj} options={['AND', 'OR', 'XOR', 'folhas: sadia × ferrugem'] as const} onChange={(v) => { setConj(v); reiniciar() }} label="dados" />
        <Slider id="pc-eta" label="taxa de aprendizado η" value={eta} min={0.02} max={1} step={0.02} onChange={setEta} fmt={(x) => x.toFixed(2)} />
      </div>
      <div className="controls">
        <button className="btn" type="button" onClick={() => passo(1)}>
          <StepForward size={15} /> 1 exemplo
        </button>
        <button className="btn" type="button" onClick={() => passo(pts.length)}>
          <FastForward size={15} /> 1 época
        </button>
        <button className="btn ghost" type="button" onClick={() => passo(pts.length * 20)}>
          20 épocas
        </button>
        <button className="btn ghost" type="button" onClick={() => reiniciar()}>
          <RotateCcw size={15} /> Reiniciar pesos
        </button>
        <button className="btn ghost" type="button" onClick={() => { setSeed(seed + 1); reiniciar(seed + 1) }}>
          <Shuffle size={15} /> Outros pesos iniciais
        </button>
      </div>
      <div className="lab-cols two">
        <div className="panel">
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 380, display: 'block', border: '1px solid var(--rule)' }} role="img" aria-label="pontos e reta de decisão do perceptron">
            {fundo}
            {linha}
            {pts.map((p, k) => {
              const atual = s.ultimo?.k === k
              return (
                <g key={k}>
                  {p.c ? (
                    <rect x={X(p.x) - 7} y={Y(p.y) - 7} width={14} height={14} fill={VERM} stroke={atual ? '#111' : '#fff'} strokeWidth={atual ? 3 : 1.5} />
                  ) : (
                    <circle cx={X(p.x)} cy={Y(p.y)} r={7.5} fill={AZUL} stroke={atual ? '#111' : '#fff'} strokeWidth={atual ? 3 : 1.5} />
                  )}
                  {!folhas && (
                    <text x={X(p.x) + 11} y={Y(p.y) - 9} fontSize="12" fill="#111">
                      ({p.x},{p.y}) → {p.c}
                    </text>
                  )}
                </g>
              )
            })}
            {folhas && (
              <>
                <text x={W - 6} y={H - 6} fontSize="11" textAnchor="end" fill="#333">
                  fração de pixels amarelos →
                </text>
                <text x={8} y={14} fontSize="11" fill="#333">
                  ↑ índice de verde
                </text>
              </>
            )}
          </svg>
          <p className="fig-note">
            ● classe {nomes[0]} · ■ classe {nomes[1]} · área azul: o perceptron diz {nomes[0]} · área vermelha: diz {nomes[1]}
          </p>
        </div>
        <div className="panel">
          <div className="readout" style={{ fontSize: '0.86rem', lineHeight: 1.7 }}>
            saída = degrau( {s.w1.toFixed(2)}·x₁ + {s.w2.toFixed(2)}·x₂ + {s.b.toFixed(2)} )
            <br />
            {s.ultimo
              ? s.ultimo.corrigiu
                ? `último exemplo errado (previu ${s.ultimo.previsto}): pesos corrigidos com η·(alvo − saída)·x`
                : `último exemplo certo (previu ${s.ultimo.previsto}): nada muda`
              : 'dê o primeiro passo'}
          </div>
          <div className="stats" style={{ marginTop: 8 }}>
            <Stat v={`${s.epoca}`} l="épocas completas" />
            <Stat v={`${acertos}/${pts.length}`} l="exemplos certos agora" cor={acertos === pts.length ? 'var(--ok)' : 'var(--bad)'} />
            <Stat v={conv ? 'convergiu' : s.epoca > 15 ? 'não converge' : 'treinando'} l="situação" cor={conv ? 'var(--ok)' : s.epoca > 15 ? 'var(--bad)' : undefined} />
          </div>
          <div className="panel-t" style={{ marginTop: 8 }}>
            <span>erros por época</span>
          </div>
          <svg viewBox="0 0 300 60" style={{ width: '100%', maxWidth: 380 }} role="img" aria-label="erros por época">
            {s.errosEpoca.slice(-30).map((e, i) => (
              <rect key={i} x={i * 10} y={58 - (e / Math.max(1, pts.length)) * 56} width={8} height={(e / Math.max(1, pts.length)) * 56 + 1} fill={e ? VERM : VERDE} />
            ))}
          </svg>
          <p className="note">
            {conj === 'XOR'
              ? 'XOR não tem uma reta que separe os quadrados das bolinhas. O perceptron fica girando para sempre: foi esse o argumento de Minsky e Papert (1969). A saída é empilhar perceptrons em camadas (a MLP), e foi isso que virou a CNN e o YOLO.'
              : 'Quando existe uma reta que separa as classes, o perceptron sempre acha uma (teorema da convergência). Mas qual reta ele acha depende dos pesos iniciais e da ordem dos exemplos: troque os pesos iniciais e compare.'}
          </p>
        </div>
      </div>
    </Lab>
  )
}

/* ============ curvas em SVG ============ */

function Curvas({ treino, val, melhor, parou, ate, ymax }: { treino: number[]; val: number[]; melhor: number; parou: number; ate: number; ymax: number }) {
  const W = 340, H = 210, m = { l: 38, r: 10, t: 10, b: 30 }
  const n = treino.length
  const X = (e: number) => m.l + (e / (n - 1)) * (W - m.l - m.r)
  const Y = (v: number) => H - m.b - (Math.min(v, ymax) / ymax) * (H - m.t - m.b)
  const pl = (d: number[]) => d.map((v, e) => `${X(e).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')
  const ticks = [0, ymax / 4, ymax / 2, (3 * ymax) / 4, ymax]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 420, display: 'block' }} role="img" aria-label="perda de treino e de validação por época">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={m.l} x2={W - m.r} y1={Y(t)} y2={Y(t)} stroke="var(--rule)" />
          <text x={m.l - 4} y={Y(t) + 3} fontSize="9" textAnchor="end" fill="var(--ink-faint)">
            {t.toFixed(0)}
          </text>
        </g>
      ))}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <text key={f} x={X(f * (n - 1))} y={H - m.b + 12} fontSize="9" textAnchor="middle" fill="var(--ink-faint)">
          {Math.round(f * (n - 1))}
        </text>
      ))}
      <text x={(m.l + W) / 2} y={H - 3} fontSize="10" textAnchor="middle" fill="var(--ink-soft)">
        época
      </text>
      <rect x={X(parou)} y={m.t} width={Math.max(0, X(n - 1) - X(parou))} height={H - m.t - m.b} fill="rgba(0,0,0,0.05)" />
      <polyline points={pl(treino)} fill="none" stroke={AZUL} strokeWidth={2} />
      <polyline points={pl(val)} fill="none" stroke={VERM} strokeWidth={2} />
      <line x1={X(melhor)} x2={X(melhor)} y1={m.t} y2={H - m.b} stroke={VERDE} strokeWidth={2} strokeDasharray="4 3" />
      <line x1={X(parou)} x2={X(parou)} y1={m.t} y2={H - m.b} stroke="#111" strokeWidth={1.5} />
      <text x={X(parou) + 3} y={m.t + 10} fontSize="9" fill="#111">
        parou
      </text>
      <text x={X(melhor) + 3} y={m.t + 22} fontSize="9" fill={VERDE}>
        best.pt
      </text>
      <line x1={X(ate)} x2={X(ate)} y1={m.t} y2={H - m.b} stroke={AMAR} strokeWidth={2} />
    </svg>
  )
}

function Ajuste({ net, d }: { net: MLP; d: ReturnType<typeof dadosProdutividade> }) {
  const W = 340, H = 210, m = { l: 38, r: 10, t: 10, b: 30 }
  const X = (x: number) => m.l + ((x - 0.2) / 0.75) * (W - m.l - m.r)
  const Y = (y: number) => H - m.b - ((Math.max(5, Math.min(85, y)) - 5) / 80) * (H - m.t - m.b)
  const xs = Array.from({ length: 120 }, (_, i) => 0.22 + (i / 119) * 0.71)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 420, display: 'block' }} role="img" aria-label="curva aprendida pela rede">
      {[10, 30, 50, 70].map((t) => (
        <g key={t}>
          <line x1={m.l} x2={W - m.r} y1={Y(t)} y2={Y(t)} stroke="var(--rule)" />
          <text x={m.l - 4} y={Y(t) + 3} fontSize="9" textAnchor="end" fill="var(--ink-faint)">
            {t}
          </text>
        </g>
      ))}
      {[0.3, 0.5, 0.7, 0.9].map((t) => (
        <text key={t} x={X(t)} y={H - m.b + 12} fontSize="9" textAnchor="middle" fill="var(--ink-faint)">
          {t.toFixed(1)}
        </text>
      ))}
      <text x={(m.l + W) / 2} y={H - 3} fontSize="10" textAnchor="middle" fill="var(--ink-soft)">
        NDVI médio do talhão
      </text>
      <text x={9} y={(H - m.b) / 2} fontSize="10" textAnchor="middle" fill="var(--ink-soft)" transform={`rotate(-90 9 ${(H - m.b) / 2})`}>
        sc/ha
      </text>
      <polyline points={xs.map((x) => `${X(x)},${Y(curvaReal(x))}`).join(' ')} fill="none" stroke="#999" strokeWidth={1.5} strokeDasharray="5 4" />
      {d.val.map((p, i) => (
        <circle key={`v${i}`} cx={X(p.x)} cy={Y(p.y)} r={3} fill="none" stroke={VERM} strokeWidth={1.2} />
      ))}
      {d.treino.map((p, i) => (
        <circle key={`t${i}`} cx={X(p.x)} cy={Y(p.y)} r={4} fill={AZUL} />
      ))}
      <polyline points={xs.map((x) => `${X(x)},${Y(net.prever(x))}`).join(' ')} fill="none" stroke={AMAR} strokeWidth={2.5} />
    </svg>
  )
}

/* ============ Parada antecipada ============ */

export function ParadaLab() {
  const [Hn, setHn] = useState<'4' | '16' | '32' | '64'>('32')
  const [lr, setLr] = useState<'0,001' | '0,003' | '0,01'>('0,001')
  const [pac, setPac] = useState(50)
  const [seed, setSeed] = useState(7)
  const d = useMemo(() => dadosProdutividade(seed), [seed])
  const lrv = +lr.replace(',', '.')
  const EP = 800
  const h = useMemo(() => treinarMLP(d, +Hn, lrv, EP, 1, 10), [d, Hn, lrv])
  const pa = paradaAntecipada(h.val, pac)
  const [ate, setAte] = useState<number | null>(null)
  const ep = ate ?? pa.melhor
  const net = useMemo(() => {
    const n = new MLP(+Hn, 1)
    n.carrega(h.pesos[Math.min(h.pesos.length - 1, Math.round(ep / 10))])
    return n
  }, [h, Hn, ep])
  const ymax = Math.max(60, Math.ceil(Math.max(...h.val.slice(5)) / 20) * 20)
  return (
    <Lab
      n="8.3"
      title="Parar na hora certa"
      desc="Uma rede pequena aprende a produtividade da soja a partir do NDVI do voo, com só 14 talhões de treino. A rede tem neurônios de sobra, então em algum momento ela começa a decorar o ruído. A validação percebe; o treino, não. O treino roda de verdade aqui."
    >
      <div className="controls">
        <Seg value={Hn} options={['4', '16', '32', '64'] as const} onChange={(v) => { setHn(v); setAte(null) }} label="neurônios ocultos" />
        <Seg value={lr} options={['0,001', '0,003', '0,01'] as const} onChange={(v) => { setLr(v); setAte(null) }} label="taxa de aprendizado" />
        <button className="btn ghost" type="button" onClick={() => { setSeed(seed + 1); setAte(null) }}>
          <Shuffle size={15} /> Outros talhões
        </button>
      </div>
      <div className="controls">
        <Slider id="pa-pac" label="paciência (patience)" value={pac} min={5} max={300} step={5} onChange={setPac} fmt={(x) => `${x} épocas`} />
        <Slider id="pa-ate" label="ver a rede na época" value={ep} min={0} max={EP - 1} step={10} onChange={setAte} />
      </div>
      <div className="lab-cols two">
        <div className="panel">
          <Curvas treino={h.treino} val={h.val} melhor={pa.melhor} parou={pa.parou} ate={ep} ymax={ymax} />
          <p className="fig-note">azul: erro no treino · vermelho: erro na validação, em (sc/ha)² · verde tracejado: melhor época, a que vira o best.pt · área cinza: épocas que a parada antecipada economizou · amarelo: época mostrada ao lado</p>
        </div>
        <div className="panel">
          <Ajuste net={net} d={d} />
          <p className="fig-note">● talhões de treino · ○ talhões de validação · tracejado cinza: a relação verdadeira · amarelo: o que a rede aprendeu na época {ep}</p>
          <div className="stats">
            <Stat v={`${pa.melhor}`} l="melhor época" cor="var(--ok)" />
            <Stat v={`${pa.parou}`} l={`parou (de ${EP})`} />
            <Stat v={h.val[pa.melhor].toFixed(0)} l="erro de validação na melhor" />
            <Stat v={h.val[EP - 1].toFixed(0)} l="erro se treinasse até o fim" cor="var(--bad)" />
          </div>
        </div>
      </div>
    </Lab>
  )
}

/* ============ Busca em grade × aleatória ============ */

const GRADE_H = [2, 4, 8, 16, 32, 64]
const GRADE_LR = [0.001, 0.003, 0.01, 0.03, 0.1]

export function BuscaLab() {
  const [modo, setModo] = useState<'grade' | 'aleatória'>('grade')
  const [n, setN] = useState(12)
  const [seed, setSeed] = useState(1)
  const d = useMemo(() => dadosProdutividade(7), [])
  const grade = useMemo(() => GRADE_H.map((H) => GRADE_LR.map((lr) => avaliarConfig(d, H, lr).val)), [d])
  const alea = useMemo(() => {
    const R = rng(100 + seed)
    return Array.from({ length: n }, () => {
      const lh = Math.log2(2) + R() * (Math.log2(64) - Math.log2(2))
      const H = Math.max(2, Math.round(2 ** lh))
      const llr = Math.log10(0.001) + R() * 2
      const lr = 10 ** llr
      return { H, lr, lh, llr, val: avaliarConfig(d, H, lr).val }
    })
  }, [d, n, seed])
  const plano = grade.flat()
  const vmin = Math.min(...plano, ...alea.map((a) => a.val)), vmax = Math.min(150, Math.max(...plano))
  const cor = (v: number) => {
    const t = Math.min(1, Math.max(0, (v - vmin) / (vmax - vmin)))
    return `hsl(${130 - 130 * t} 55% ${88 - 40 * (1 - t)}%)`
  }
  let best = { i: 0, j: 0 }
  grade.forEach((row, i) => row.forEach((v, j) => (v < grade[best.i][best.j] ? (best = { i, j }) : 0)))
  const bestA = alea.reduce((a, b) => (b.val < a.val ? b : a), alea[0])
  const W = 340, Hh = 260, m = { l: 52, r: 8, t: 8, b: 36 }
  const cw = (W - m.l - m.r) / GRADE_LR.length, ch = (Hh - m.t - m.b) / GRADE_H.length
  const px = (llr: number) => m.l + ((llr - Math.log10(0.001) + 0.5 * (2 / (GRADE_LR.length - 1))) / (2 + 2 / (GRADE_LR.length - 1))) * (W - m.l - m.r)
  const py = (lh: number) => m.t + (1 - (lh - 1 + 0.5) / (Math.log2(64) - 1 + 1)) * (Hh - m.t - m.b)
  return (
    <Lab
      n="8.4"
      title="Grade ou sorteio?"
      desc="Duas escolhas da mesma rede do Lab 8.3: quantos neurônios e qual taxa de aprendizado. Cada quadrado é um treino completo, com parada antecipada, e a cor é o erro de validação. Todos os treinos rodam de verdade aqui."
    >
      <div className="controls">
        <Seg value={modo} options={['grade', 'aleatória'] as const} onChange={setModo} label="busca" />
        {modo === 'aleatória' && (
          <>
            <Slider id="bs-n" label="orçamento (treinos)" value={n} min={4} max={30} onChange={setN} />
            <button className="btn ghost" type="button" onClick={() => setSeed(seed + 1)}>
              <Shuffle size={15} /> Sortear de novo
            </button>
          </>
        )}
      </div>
      <div className="lab-cols two">
        <div className="panel">
          <svg viewBox={`0 0 ${W} ${Hh}`} style={{ width: '100%', maxWidth: 420, display: 'block' }} role="img" aria-label="mapa do erro de validação por hiperparâmetro">
            {grade.map((row, i) =>
              row.map((v, j) => (
                <g key={`${i}-${j}`} opacity={modo === 'grade' ? 1 : 0.35}>
                  <rect x={m.l + j * cw} y={m.t + (GRADE_H.length - 1 - i) * ch} width={cw - 2} height={ch - 2} fill={cor(v)} stroke={modo === 'grade' && i === best.i && j === best.j ? '#111' : 'none'} strokeWidth={3} />
                  {modo === 'grade' && (
                    <text x={m.l + j * cw + cw / 2 - 1} y={m.t + (GRADE_H.length - 1 - i) * ch + ch / 2 + 4} fontSize="10" textAnchor="middle" fill="#111">
                      {v.toFixed(0)}
                    </text>
                  )}
                </g>
              )),
            )}
            {GRADE_H.map((H, i) => (
              <text key={H} x={m.l - 6} y={m.t + (GRADE_H.length - 1 - i) * ch + ch / 2 + 4} fontSize="10" textAnchor="end" fill="var(--ink-soft)">
                {H}
              </text>
            ))}
            {GRADE_LR.map((lr, j) => (
              <text key={lr} x={m.l + j * cw + cw / 2} y={Hh - m.b + 13} fontSize="10" textAnchor="middle" fill="var(--ink-soft)">
                {lr}
              </text>
            ))}
            <text x={(m.l + W) / 2} y={Hh - 4} fontSize="10" textAnchor="middle" fill="var(--ink-soft)">
              taxa de aprendizado (escala log)
            </text>
            <text x={11} y={(Hh - m.b) / 2} fontSize="10" textAnchor="middle" fill="var(--ink-soft)" transform={`rotate(-90 11 ${(Hh - m.b) / 2})`}>
              neurônios ocultos
            </text>
            {modo === 'aleatória' &&
              alea.map((a, k) => (
                <circle key={k} cx={px(a.llr)} cy={py(a.lh)} r={a === bestA ? 7 : 5} fill={cor(a.val)} stroke="#111" strokeWidth={a === bestA ? 3 : 1.2} />
              ))}
          </svg>
          <p className="fig-note">verde: erro baixo · vermelho: erro alto · contorno preto: a melhor configuração encontrada</p>
        </div>
        <div className="panel">
          <div className="stats">
            {modo === 'grade' ? (
              <>
                <Stat v={`${GRADE_H.length * GRADE_LR.length}`} l="treinos" />
                <Stat v={`${GRADE_H[best.i]} · ${GRADE_LR[best.j]}`} l="melhor: neurônios · taxa" />
                <Stat v={grade[best.i][best.j].toFixed(1)} l="erro de validação" cor="var(--ok)" />
              </>
            ) : (
              <>
                <Stat v={`${n}`} l="treinos" />
                <Stat v={`${bestA.H} · ${bestA.lr.toFixed(4)}`} l="melhor: neurônios · taxa" />
                <Stat v={bestA.val.toFixed(1)} l="erro de validação" cor="var(--ok)" />
              </>
            )}
          </div>
          <p className="note">
            A grade testa todas as combinações: 6 × 5 = 30 treinos aqui, e cresce rápido demais (com 4 hiperparâmetros de 5 valores, são 625). A busca aleatória sorteia combinações dentro das mesmas faixas e, com
            o mesmo orçamento, experimenta mais valores diferentes de cada hiperparâmetro. Quando só um ou dois hiperparâmetros importam de verdade, ela costuma chegar perto do melhor com bem menos treinos.
          </p>
          <p className="note">
            <b>Pegadinha:</b> escolher o hiperparâmetro olhando a validação "gasta" a validação. O número que vai para o artigo tem que vir de um teste que não participou de nenhuma escolha.
          </p>
        </div>
      </div>
    </Lab>
  )
}
