// Figuras didáticas (SVG) do módulo YOLO. Desenhadas à mão para o site, sem imagens de terceiros.
import { type ReactNode } from 'react'

const AZ = '#131a9f', AZ2 = '#3940b3', AM = '#ffe000', VM = '#c62828', VD = '#228b22', CZ = '#666', TX = '#111'

export function Figura({ n, legenda, children, max = 760 }: { n: string; legenda: ReactNode; children: ReactNode; max?: number }) {
  return (
    <figure className="figura" style={{ margin: '1.4rem 0' }}>
      <div style={{ maxWidth: max, margin: '0 auto', overflowX: 'auto' }}>{children}</div>
      <figcaption style={{ fontSize: '0.88rem', color: 'var(--ink-soft)', marginTop: 8, textAlign: 'center' }}>
        <b>Figura {n}.</b> {legenda}
      </figcaption>
    </figure>
  )
}

const svgStyle = { width: '100%', display: 'block', fontFamily: 'Arial, Helvetica, sans-serif' } as const

function Seta({ x1, y1, x2, y2, cor = TX, w = 2 }: { x1: number; y1: number; x2: number; y2: number; cor?: string; w?: number }) {
  const a = Math.atan2(y2 - y1, x2 - x1), L = 8
  return (
    <g stroke={cor} fill={cor} strokeWidth={w}>
      <line x1={x1} y1={y1} x2={x2 - Math.cos(a) * 3} y2={y2 - Math.sin(a) * 3} />
      <polygon points={`${x2},${y2} ${x2 - L * Math.cos(a - 0.4)},${y2 - L * Math.sin(a - 0.4)} ${x2 - L * Math.cos(a + 0.4)},${y2 - L * Math.sin(a + 0.4)}`} stroke="none" />
    </g>
  )
}

function Caixa({ x, y, w, h, t, sub, fill = '#fff', cor = AZ, tc = TX, fs = 13 }: { x: number; y: number; w: number; h: number; t: string; sub?: string; fill?: string; cor?: string; tc?: string; fs?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={fill} stroke={cor} strokeWidth={2} rx={4} />
      <text x={x + w / 2} y={y + h / 2 + (sub ? -3 : 4)} fontSize={fs} fontWeight={700} textAnchor="middle" fill={tc}>
        {t}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + h / 2 + 13} fontSize={fs - 3} textAnchor="middle" fill={tc === TX ? CZ : tc}>
          {sub}
        </text>
      )}
    </g>
  )
}

/* ---------- uma folha estilizada, reaproveitada nas figuras ---------- */
function Folha({ x, y, s = 1, pustulas = true }: { x: number; y: number; s?: number; pustulas?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0,40 C10,5 50,-5 80,0 C70,30 40,50 0,40 Z" fill="#4c9a2a" stroke="#2d6a14" strokeWidth={1.5} />
      <path d="M0,40 C25,25 50,12 80,0" fill="none" stroke="#2d6a14" strokeWidth={1.2} />
      {pustulas &&
        [
          [30, 22],
          [44, 16],
          [52, 24],
          [36, 32],
          [60, 12],
          [24, 30],
        ].map(([a, b], k) => <circle key={k} cx={a} cy={b} r={3.2} fill="#d98c1a" stroke="#a65c00" strokeWidth={0.8} />)}
    </g>
  )
}

/* ============ Figura: as quatro tarefas ============ */

export function FigTarefas() {
  const W = 760, H = 250, P = 180
  const cena = (ox: number, extra: ReactNode, titulo: string, sai: string) => (
    <g transform={`translate(${ox} 0)`}>
      <rect x={0} y={30} width={P} height={150} fill="#7aa14a" />
      <rect x={0} y={30} width={P} height={150} fill="url(#capim)" opacity={0.5} />
      {[
        [40, 70, 20],
        [110, 60, -15],
        [70, 140, 35],
        [140, 130, 0],
      ].map(([cx, cy, r], k) => (
        <g key={k} transform={`rotate(${r} ${cx} ${cy})`}>
          <ellipse cx={cx + 3} cy={cy + 3} rx={18} ry={8} fill="rgba(0,0,0,0.25)" />
          <ellipse cx={cx} cy={cy} rx={18} ry={8} fill="#ece7dc" />
          <ellipse cx={cx + 19} cy={cy} rx={5} ry={4.5} fill="#ddd6c8" />
        </g>
      ))}
      {extra}
      <text x={P / 2} y={18} fontSize={14} fontWeight={700} textAnchor="middle" fill={AZ}>
        {titulo}
      </text>
      <text x={P / 2} y={202} fontSize={12} textAnchor="middle" fill={TX}>
        {sai}
      </text>
    </g>
  )
  const caixas = [
    [40, 70, 20],
    [110, 60, -15],
    [70, 140, 35],
    [140, 130, 0],
  ].map(([cx, cy, r]) => {
    const a = (r * Math.PI) / 180
    const hx = Math.abs(24 * Math.cos(a)) + Math.abs(8 * Math.sin(a)), hy = Math.abs(24 * Math.sin(a)) + Math.abs(8 * Math.cos(a))
    return { cx: cx + 3, cy, hx, hy, r }
  })
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={svgStyle} role="img" aria-label="classificação, segmentação semântica, detecção e segmentação de instâncias na mesma foto">
      <defs>
        <pattern id="capim" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M0,8 L4,0 M4,8 L8,0" stroke="#5c8a30" strokeWidth={1} />
        </pattern>
      </defs>
      {cena(0, <rect x={0} y={30} width={P} height={26} fill={AZ} opacity={0.9} />, 'Classificação', '“há bovinos”: 1 rótulo por foto')}
      {cena(
        193,
        <g>
          <rect x={0} y={30} width={P} height={150} fill="rgba(0,0,0,0.45)" />
          {caixas.map((c, k) => (
            <ellipse key={k} cx={c.cx - 3} cy={c.cy} rx={21} ry={8.5} transform={`rotate(${c.r} ${c.cx - 3} ${c.cy})`} fill={AM} />
          ))}
        </g>,
        'Segmentação semântica',
        'cada pixel: bovino ou fundo',
      )}
      {cena(
        386,
        <g>
          {caixas.map((c, k) => (
            <rect key={k} x={c.cx - c.hx} y={c.cy - c.hy} width={2 * c.hx} height={2 * c.hy} fill="none" stroke={AM} strokeWidth={2.5} />
          ))}
        </g>,
        'Detecção',
        'onde e quantos: 4 caixas',
      )}
      {cena(
        579,
        <g>
          <rect x={0} y={30} width={P} height={150} fill="rgba(0,0,0,0.45)" />
          {caixas.map((c, k) => (
            <ellipse key={k} cx={c.cx - 3} cy={c.cy} rx={21} ry={8.5} transform={`rotate(${c.r} ${c.cx - 3} ${c.cy})`} fill={['#e6194b', '#3cb44b', '#4363d8', '#f58231'][k]} />
          ))}
        </g>,
        'Segmentação de instâncias',
        'cada boi com sua máscara',
      )}
      <text x={W / 2} y={H - 18} fontSize={13} fontWeight={700} textAnchor="middle" fill={TX}>
        mesma foto, quatro perguntas: “o quê?” · “o quê, em cada pixel?” · “o quê e onde?” · “o quê, onde e qual pixel de cada um?”
      </text>
      <text x={W / 2} y={H - 3} fontSize={11} textAnchor="middle" fill={CZ}>
        rotular fica mais caro da esquerda para a direita
      </text>
    </svg>
  )
}

/* ============ Figura: perceptron ============ */

export function FigPerceptron() {
  const W = 720, H = 285
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={svgStyle} role="img" aria-label="esquema do perceptron">
      <Folha x={10} y={80} s={1.1} />
      <text x={55} y={150} fontSize={11} textAnchor="middle" fill={CZ}>
        folha fotografada
      </text>
      <Seta x1={110} y1={100} x2={150} y2={100} />
      {[
        ['x₁', 'fração amarela', 60],
        ['x₂', 'índice de verde', 140],
        ['1', 'entrada do viés', 210],
      ].map(([t, s, y]) => (
        <g key={t as string}>
          <circle cx={190} cy={+y} r={22} fill="#fff" stroke={AZ} strokeWidth={2} />
          <text x={190} y={+y + 5} fontSize={15} fontWeight={700} textAnchor="middle" fill={AZ}>
            {t}
          </text>
          <text x={190} y={+y + 36} fontSize={10} textAnchor="middle" fill={CZ}>
            {s}
          </text>
          <Seta x1={212} y1={+y} x2={366} y2={130} cor={AZ2} />
        </g>
      ))}
      <text x={275} y={78} fontSize={14} fontWeight={700} fill={VM}>
        w₁
      </text>
      <text x={275} y={128} fontSize={14} fontWeight={700} fill={VM}>
        w₂
      </text>
      <text x={275} y={190} fontSize={14} fontWeight={700} fill={VM}>
        b
      </text>
      <circle cx={400} cy={130} r={34} fill={AM} stroke={AZ} strokeWidth={2.5} />
      <text x={400} y={140} fontSize={30} textAnchor="middle" fill={TX}>
        Σ
      </text>
      <text x={400} y={185} fontSize={11} textAnchor="middle" fill={CZ}>
        soma ponderada
      </text>
      <Seta x1={434} y1={130} x2={490} y2={130} />
      <rect x={490} y={98} width={80} height={64} fill="#fff" stroke={AZ} strokeWidth={2} rx={4} />
      <polyline points="500,150 530,150 530,110 560,110" fill="none" stroke={VM} strokeWidth={3} />
      <text x={530} y={185} fontSize={11} textAnchor="middle" fill={CZ}>
        degrau
      </text>
      <Seta x1={570} y1={130} x2={615} y2={130} />
      <text x={620} y={120} fontSize={14} fontWeight={700} fill={TX}>
        1 = ferrugem
      </text>
      <text x={620} y={142} fontSize={14} fontWeight={700} fill={TX}>
        0 = sadia
      </text>
      <text x={W / 2} y={H - 8} fontSize={13} textAnchor="middle" fill={TX}>
        saída = degrau(w₁·x₁ + w₂·x₂ + b) · aprender = ajustar w₁, w₂ e b: w ← w + η·(alvo − saída)·x
      </text>
    </svg>
  )
}

/* ============ Figura: do perceptron ao YOLO ============ */

export function FigLinhaTempo() {
  const W = 760, H = 190
  const marcos: [string, string, string][] = [
    ['1943', 'McCulloch e Pitts', 'neurônio lógico'],
    ['1958', 'Rosenblatt', 'perceptron aprende'],
    ['1969', 'Minsky e Papert', 'o XOR trava'],
    ['1986', 'Rumelhart et al.', 'retropropagação na MLP'],
    ['1998', 'LeCun', 'CNN (LeNet)'],
    ['2012', 'Krizhevsky et al.', 'AlexNet na GPU'],
    ['2014', 'Girshick et al.', 'R-CNN detecta'],
    ['2016', 'Redmon et al.', 'YOLO: um olhar'],
    ['2026', 'Ultralytics', 'YOLO26 sem NMS'],
  ]
  const x = (i: number) => 70 + i * ((W - 140) / (marcos.length - 1))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={svgStyle} role="img" aria-label="linha do tempo do perceptron ao YOLO">
      <line x1={30} y1={60} x2={W - 30} y2={60} stroke={AZ} strokeWidth={3} />
      {marcos.map(([a, q, o], i) => (
        <g key={a}>
          <circle cx={x(i)} cy={60} r={i === 1 || i === 7 ? 9 : 6} fill={i === 1 || i === 7 ? AM : '#fff'} stroke={AZ} strokeWidth={2.5} />
          <text x={x(i)} y={40} fontSize={13} fontWeight={700} textAnchor="middle" fill={AZ}>
            {a}
          </text>
          <line x1={x(i)} y1={68} x2={x(i)} y2={i % 2 ? 112 : 78} stroke={AZ} strokeWidth={1} />
          <text x={x(i)} y={i % 2 ? 126 : 92} fontSize={10.5} fontWeight={700} textAnchor="middle" fill={TX}>
            {q}
          </text>
          <text x={x(i)} y={i % 2 ? 141 : 107} fontSize={10.5} textAnchor="middle" fill={CZ}>
            {o}
          </text>
        </g>
      ))}
      <text x={W / 2} y={H - 10} fontSize={12} textAnchor="middle" fill={TX}>
        o YOLO ainda é, lá dentro, milhões de perceptrons empilhados, com funções de ativação suaves no lugar do degrau
      </text>
    </svg>
  )
}

/* ============ Figura: MLP e CNN ============ */

export function FigMLPCNN() {
  const W = 760, H = 230
  const cam = [3, 5, 5, 2]
  const nx = (l: number) => 40 + l * 85, ny = (l: number, k: number) => 115 + (k - (cam[l] - 1) / 2) * 32
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={svgStyle} role="img" aria-label="MLP e CNN">
      {cam.map((n, l) =>
        Array.from({ length: n }, (_, k) =>
          l < cam.length - 1
            ? Array.from({ length: cam[l + 1] }, (_, j) => <line key={`${l}${k}${j}`} x1={nx(l)} y1={ny(l, k)} x2={nx(l + 1)} y2={ny(l + 1, j)} stroke="#bbb" strokeWidth={1} />)
            : null,
        ),
      )}
      {cam.map((n, l) => Array.from({ length: n }, (_, k) => <circle key={`c${l}${k}`} cx={nx(l)} cy={ny(l, k)} r={11} fill={l === 0 ? '#fff' : l === cam.length - 1 ? AM : '#dfe2ff'} stroke={AZ} strokeWidth={2} />))}
      <text x={170} y={22} fontSize={14} fontWeight={700} textAnchor="middle" fill={AZ}>
        MLP: perceptrons em camadas
      </text>
      <text x={170} y={212} fontSize={11} textAnchor="middle" fill={CZ}>
        resolve o XOR; mas cada neurônio vê todos os pixels
      </text>
      <line x1={355} y1={20} x2={355} y2={210} stroke="var(--rule)" strokeWidth={2} />
      {/* CNN */}
      <g>
        <rect x={380} y={60} width={90} height={90} fill="#7aa14a" stroke={AZ} strokeWidth={2} />
        <Folha x={385} y={85} s={1} />
        <rect x={392} y={72} width={26} height={26} fill="none" stroke={AM} strokeWidth={3} />
        <text x={425} y={170} fontSize={11} textAnchor="middle" fill={CZ}>
          filtro 3×3 desliza
        </text>
        {[0, 1, 2].map((k) => (
          <rect key={k} x={500 + k * 8} y={66 + k * 8} width={70} height={70} fill={['#dfe2ff', '#c8ccff', '#b0b6ff'][k]} stroke={AZ} strokeWidth={1.5} />
        ))}
        <text x={545} y={170} fontSize={11} textAnchor="middle" fill={CZ}>
          mapas de bordas e manchas
        </text>
        {[0, 1, 2, 3, 4].map((k) => (
          <rect key={k} x={610 + k * 6} y={86 + k * 6} width={36} height={36} fill={['#b0b6ff', '#9aa1ff', '#848cff', '#6f78ff', '#5a63f5'][k]} stroke={AZ} strokeWidth={1.2} />
        ))}
        <text x={650} y={170} fontSize={11} textAnchor="middle" fill={CZ}>
          mapas de “pústula”, “boi”
        </text>
        <Seta x1={472} y1={105} x2={498} y2={105} />
        <Seta x1={590} y1={105} x2={608} y2={105} />
        <Seta x1={676} y1={115} x2={705} y2={115} />
        <text x={712} y={112} fontSize={12} fontWeight={700} fill={TX}>
          classe
        </text>
        <text x={712} y={127} fontSize={12} fontWeight={700} fill={TX}>
          ou caixa
        </text>
        <text x={560} y={22} fontSize={14} fontWeight={700} textAnchor="middle" fill={AZ}>
          CNN: o mesmo filtro em toda a imagem
        </text>
        <text x={560} y={212} fontSize={11} textAnchor="middle" fill={CZ}>
          poucos pesos, enxerga padrões locais em qualquer posição (Aula 6)
        </text>
      </g>
    </svg>
  )
}

/* ============ Figura: dois estágios × um estágio ============ */

export function FigDoisEstagios() {
  const W = 760, H = 270
  const foto = (x: number, y: number, props: ReactNode) => (
    <g transform={`translate(${x} ${y})`}>
      <rect width={110} height={80} fill="#7aa14a" stroke={TX} strokeWidth={1} />
      {[
        [30, 30],
        [75, 50],
      ].map(([cx, cy], k) => (
        <ellipse key={k} cx={cx} cy={cy} rx={14} ry={6.5} fill="#ece7dc" />
      ))}
      {props}
    </g>
  )
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={svgStyle} role="img" aria-label="detector de dois estágios comparado ao YOLO">
      <text x={10} y={20} fontSize={14} fontWeight={700} fill={AZ}>
        Dois estágios (R-CNN, Fast e Faster R-CNN)
      </text>
      {foto(
        10,
        35,
        <g fill="none" strokeWidth={1.2}>
          {[
            [10, 10, 40, 30],
            [55, 35, 45, 30],
            [20, 22, 30, 18],
            [5, 45, 50, 30],
            [60, 5, 40, 30],
            [62, 40, 30, 22],
            [40, 15, 40, 40],
          ].map(([a, b, c, d], k) => (
            <rect key={k} x={a} y={b} width={c} height={d} stroke={k < 2 ? AM : '#fff'} />
          ))}
        </g>,
      )}
      <text x={65} y={130} fontSize={10.5} textAnchor="middle" fill={CZ}>
        1. propõe ~2.000 regiões
      </text>
      <Seta x1={125} y1={75} x2={165} y2={75} />
      {[0, 1, 2, 3].map((k) => (
        <rect key={k} x={170 + k * 6} y={50 + k * 6} width={40} height={30} fill="#7aa14a" stroke={TX} strokeWidth={1} />
      ))}
      <text x={200} y={130} fontSize={10.5} textAnchor="middle" fill={CZ}>
        2. recorta cada uma
      </text>
      <Seta x1={235} y1={75} x2={275} y2={75} />
      <Caixa x={280} y={50} w={100} h={50} t="CNN" sub="classifica a região" />
      <Seta x1={382} y1={75} x2={420} y2={75} />
      <Caixa x={425} y={50} w={110} h={50} t="ajusta a caixa" sub="+ NMS" />
      <text x={600} y={68} fontSize={12} fill={TX}>
        preciso, mas lento:
      </text>
      <text x={600} y={84} fontSize={12} fill={TX}>
        muitas passadas pela rede
      </text>
      <line x1={10} y1={150} x2={W - 10} y2={150} stroke="var(--rule)" strokeWidth={2} />
      <text x={10} y={172} fontSize={14} fontWeight={700} fill={VM}>
        Um estágio (YOLO, SSD, RetinaNet)
      </text>
      {foto(
        10,
        182,
        <g stroke="#fff" strokeWidth={0.8} opacity={0.8}>
          {[1, 2, 3, 4].map((k) => (
            <line key={`v${k}`} x1={k * 22} y1={0} x2={k * 22} y2={80} />
          ))}
          {[1, 2, 3].map((k) => (
            <line key={`h${k}`} x1={0} y1={k * 20} x2={110} y2={k * 20} />
          ))}
        </g>,
      )}
      <Seta x1={125} y1={222} x2={165} y2={222} />
      <Caixa x={170} y={197} w={130} h={50} t="uma CNN" sub="uma passada só" fill={AM} />
      <Seta x1={302} y1={222} x2={340} y2={222} />
      {foto(
        345,
        182,
        <g fill="none" stroke={AM} strokeWidth={2.5}>
          <rect x={14} y={21} width={34} height={18} />
          <rect x={59} y={41} width={34} height={18} />
        </g>,
      )}
      <text x={600} y={210} fontSize={12} fill={TX}>
        rápido o bastante para vídeo;
      </text>
      <text x={600} y={226} fontSize={12} fill={TX}>
        sofre mais com objeto pequeno
      </text>
      <text x={600} y={242} fontSize={12} fill={TX}>
        e com objetos grudados
      </text>
    </svg>
  )
}

/* ============ Figura: U-Net ============ */

export function FigUNet() {
  const W = 760, H = 260
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={svgStyle} role="img" aria-label="arquitetura U-Net">
      <rect x={10} y={60} width={70} height={70} fill="#7aa14a" stroke={TX} />
      <Folha x={13} y={75} s={0.8} />
      <text x={45} y={150} fontSize={11} textAnchor="middle" fill={CZ}>
        foto
      </text>
      {[0, 1, 2, 3].map((k) => (
        <g key={k}>
          <rect x={100 + k * 70} y={40 + k * 30} width={18 + k * 6} height={130 - k * 30} fill="#dfe2ff" stroke={AZ} strokeWidth={1.5} />
          <rect x={560 - k * 70 + 60} y={40 + k * 30} width={18 + k * 6} height={130 - k * 30} fill="#fff4b3" stroke={AZ} strokeWidth={1.5} />
          {k < 3 && <Seta x1={120 + k * 70 + k * 6} y1={110 + k * 15} x2={168 + k * 70} y2={110 + k * 15 + 15} cor={VM} />}
          {k < 3 && <Seta x1={620 - k * 70 - 50} y1={110 + k * 15 + 15} x2={620 - k * 70 - 4} y2={110 + k * 15} cor={VD} />}
          {k < 3 && <line x1={122 + k * 76} y1={50 + k * 30} x2={616 - k * 70} y2={50 + k * 30} stroke={CZ} strokeDasharray="5 4" strokeWidth={1.5} />}
        </g>
      ))}
      <rect x={350} y={140} width={46} height={40} fill="#c8ccff" stroke={AZ} strokeWidth={1.5} />
      <text x={373} y={198} fontSize={11} textAnchor="middle" fill={CZ}>
        gargalo
      </text>
      <Seta x1={340} y1={148} x2={350} y2={155} cor={VM} />
      <Seta x1={396} y1={155} x2={410} y2={148} cor={VD} />
      <rect x={680} y={60} width={70} height={70} fill="rgba(0,0,0,0.6)" stroke={TX} />
      <g transform="translate(683 75) scale(0.8)">
        <path d="M0,40 C10,5 50,-5 80,0 C70,30 40,50 0,40 Z" fill="#3cb44b" />
        {[
          [30, 22],
          [44, 16],
          [52, 24],
          [36, 32],
        ].map(([a, b], k) => (
          <circle key={k} cx={a} cy={b} r={3.5} fill={AM} />
        ))}
      </g>
      <text x={715} y={150} fontSize={11} textAnchor="middle" fill={CZ}>
        máscara por pixel
      </text>
      <text x={200} y={225} fontSize={12} textAnchor="middle" fill={VM} fontWeight={700}>
        codificador: reduz e entende “o quê”
      </text>
      <text x={560} y={225} fontSize={12} textAnchor="middle" fill={VD} fontWeight={700}>
        decodificador: amplia e devolve “onde”
      </text>
      <text x={W / 2} y={250} fontSize={11.5} textAnchor="middle" fill={TX}>
        as ligações tracejadas copiam os detalhes finos de cada nível para o lado da saída: é o “U” (Ronneberger et al., 2015)
      </text>
      <text x={W / 2} y={20} fontSize={12} textAnchor="middle" fill={CZ}>
        o pescoço do YOLO usa a mesma ideia de juntar escalas finas e grossas
      </text>
    </svg>
  )
}

/* ============ Figura: arquitetura do YOLO ============ */

export function FigArquitetura() {
  const W = 760, H = 300
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={svgStyle} role="img" aria-label="espinha, pescoço e cabeças do YOLO">
      <rect x={10} y={95} width={90} height={90} fill="#7aa14a" stroke={TX} />
      {[
        [30, 120],
        [70, 150],
        [50, 165],
      ].map(([a, b], k) => (
        <ellipse key={k} cx={a} cy={b} rx={11} ry={5} fill="#ece7dc" />
      ))}
      <text x={55} y={205} fontSize={11} textAnchor="middle" fill={CZ}>
        640 × 640 × 3
      </text>
      <Seta x1={100} y1={140} x2={125} y2={140} />
      {/* espinha */}
      <rect x={125} y={30} width={210} height={240} fill="#f3f4ff" stroke={AZ} strokeWidth={1.5} rx={6} />
      <text x={230} y={50} fontSize={14} fontWeight={700} textAnchor="middle" fill={AZ}>
        espinha (backbone)
      </text>
      {[
        [140, 70, 150, '320'],
        [180, 85, 120, '160'],
        [215, 100, 90, '80 · P3'],
        [250, 112, 66, '40 · P4'],
        [285, 122, 46, '20 · P5'],
      ].map(([x, y, h, t], k) => (
        <g key={k}>
          <rect x={+x} y={+y} width={24} height={+h} fill={['#dfe2ff', '#c8ccff', '#b0b6ff', '#8f97ff', '#6f78ff'][k]} stroke={AZ} />
          <text x={+x + 12} y={+y + +h + 14} fontSize={9.5} textAnchor="middle" fill={TX}>
            {t}
          </text>
        </g>
      ))}
      {/* pescoço */}
      <rect x={360} y={30} width={180} height={240} fill="#fffbe0" stroke={AZ} strokeWidth={1.5} rx={6} />
      <text x={450} y={50} fontSize={14} fontWeight={700} textAnchor="middle" fill={AZ}>
        pescoço (neck)
      </text>
      {[
        [80, 'P3'],
        [150, 'P4'],
        [215, 'P5'],
      ].map(([y, t], k) => (
        <g key={k}>
          <rect x={420} y={+y} width={60} height={34} fill="#fff4b3" stroke={AZ} />
          <text x={450} y={+y + 22} fontSize={12} fontWeight={700} textAnchor="middle" fill={TX}>
            {t}
          </text>
        </g>
      ))}
      <Seta x1={450} y1={117} x2={450} y2={147} cor={VM} />
      <Seta x1={450} y1={186} x2={450} y2={212} cor={VM} />
      <Seta x1={470} y1={212} x2={470} y2={186} cor={VD} />
      <Seta x1={470} y1={147} x2={470} y2={117} cor={VD} />
      <text x={450} y={262} fontSize={10} textAnchor="middle" fill={CZ}>
        mistura as escalas para cima e para baixo
      </text>
      <Seta x1={311} y1={140} x2={418} y2={97} cor={CZ} w={1.5} />
      <Seta x1={311} y1={150} x2={418} y2={167} cor={CZ} w={1.5} />
      <Seta x1={311} y1={160} x2={418} y2={232} cor={CZ} w={1.5} />
      {/* cabeças */}
      {[
        [80, '80×80', 'bezerro, ave, inseto'],
        [150, '40×40', 'boi'],
        [215, '20×20', 'boi colado na câmera'],
      ].map(([y, g, o], k) => (
        <g key={k}>
          <Seta x1={482} y1={+y + 17} x2={565} y2={+y + 17} />
          <rect x={565} y={+y} width={80} height={34} fill={AM} stroke={AZ} strokeWidth={1.5} />
          <text x={605} y={+y + 15} fontSize={11} fontWeight={700} textAnchor="middle" fill={TX}>
            cabeça
          </text>
          <text x={605} y={+y + 28} fontSize={10} textAnchor="middle" fill={TX}>
            {g}
          </text>
          <text x={652} y={+y + 21} fontSize={10.5} fill={CZ}>
            {o}
          </text>
        </g>
      ))}
      <text x={W - 10} y={292} fontSize={11.5} textAnchor="end" fill={TX}>
        cada ponto das grades prevê: notas de cada classe + distâncias l, t, r, b até as bordas da caixa
      </text>
    </svg>
  )
}

/* ============ Figura: as tarefas do YOLO ============ */

export function FigTarefasYolo() {
  const W = 760, H = 210, P = 140
  const tile = (i: number, titulo: string, sufixo: string, extra: ReactNode) => (
    <g transform={`translate(${10 + i * 150} 30)`}>
      <rect width={P} height={110} fill="#7aa14a" />
      <g transform="rotate(-12 70 55)">
        <ellipse cx={73} cy={58} rx={34} ry={14} fill="rgba(0,0,0,0.25)" />
        <ellipse cx={70} cy={55} rx={34} ry={14} fill="#ece7dc" />
        <ellipse cx={106} cy={55} rx={9} ry={8} fill="#ddd6c8" />
      </g>
      {extra}
      <text x={P / 2} y={-10} fontSize={13} fontWeight={700} textAnchor="middle" fill={AZ}>
        {titulo}
      </text>
      <text x={P / 2} y={130} fontSize={11} textAnchor="middle" fill={TX} fontFamily="Courier New, monospace">
        {sufixo}
      </text>
    </g>
  )
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={svgStyle} role="img" aria-label="as cinco tarefas do YOLO">
      {tile(0, 'detectar', 'yolo26n.pt', <rect x={26} y={26} width={98} height={56} fill="none" stroke={AM} strokeWidth={3} />)}
      {tile(1, 'segmentar', 'yolo26n-seg.pt', <g transform="rotate(-12 70 55)"><ellipse cx={72} cy={55} rx={45} ry={15} fill="rgba(255,224,0,0.55)" stroke={AM} strokeWidth={2} /></g>)}
      {tile(2, 'classificar', 'yolo26n-cls.pt', <rect x={0} y={0} width={P} height={22} fill={AZ} />)}
      {tile(
        3,
        'pose (pontos)',
        'yolo26n-pose.pt',
        <g fill={VM}>
          {[
            [112, 46],
            [92, 50],
            [70, 55],
            [46, 62],
            [32, 64],
          ].map(([a, b], k) => (
            <circle key={k} cx={a} cy={b} r={4} />
          ))}
          <polyline points="112,46 92,50 70,55 46,62 32,64" fill="none" stroke={VM} strokeWidth={2} />
        </g>,
      )}
      {tile(4, 'caixa girada (OBB)', 'yolo26n-obb.pt', <g transform="rotate(-12 70 55)"><rect x={30} y={38} width={88} height={34} fill="none" stroke={AM} strokeWidth={3} /></g>)}
      <text x={W / 2} y={190} fontSize={12} textAnchor="middle" fill={TX}>
        a mesma biblioteca e a mesma API: muda o arquivo de pesos e o formato do rótulo · a OBB serve bem para gado, máquinas e linhas de plantio vistos de cima
      </text>
    </svg>
  )
}

/* ============ Figura: fluxo do CVAT ============ */

export function FigCVAT() {
  const W = 760, H = 230
  const passos: [string, string, string][] = [
    ['1', 'Projeto', 'rótulos: bovino, cupinzeiro'],
    ['2', 'Tarefa', 'sobe fotos ou vídeo'],
    ['3', 'Anotar', 'retângulo, polígono, track'],
    ['4', 'Revisar', 'segundo par de olhos'],
    ['5', 'Exportar', 'Ultralytics YOLO'],
    ['6', 'Treinar', 'data.yaml + split'],
  ]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={svgStyle} role="img" aria-label="fluxo do CVAT do projeto ao treino">
      {passos.map(([n, t, s], i) => {
        const x = 10 + i * 125
        return (
          <g key={n}>
            <rect x={x} y={40} width={110} height={90} fill={i === 4 ? AM : '#fff'} stroke={AZ} strokeWidth={2} rx={6} />
            <circle cx={x + 18} cy={58} r={12} fill={AZ} />
            <text x={x + 18} y={63} fontSize={13} fontWeight={700} textAnchor="middle" fill="#fff">
              {n}
            </text>
            <text x={x + 55} y={92} fontSize={14} fontWeight={700} textAnchor="middle" fill={TX}>
              {t}
            </text>
            <text x={x + 55} y={112} fontSize={9.5} textAnchor="middle" fill={CZ}>
              {s}
            </text>
            {i < passos.length - 1 && <Seta x1={x + 110} y1={85} x2={x + 125} y2={85} />}
          </g>
        )
      })}
      <text x={10} y={25} fontSize={13} fontWeight={700} fill={AZ}>
        CVAT (gratuito, roda no navegador em app.cvat.ai ou instalado no seu servidor)
      </text>
      <rect x={385} y={150} width={365} height={70} fill="#f3f4ff" stroke={AZ} strokeWidth={1.5} rx={4} />
      <text x={395} y={170} fontSize={11.5} fontWeight={700} fill={TX} fontFamily="Courier New, monospace">
        export.zip
      </text>
      <text x={395} y={186} fontSize={11} fill={TX} fontFamily="Courier New, monospace">
        ├── data.yaml (path, train, names)
      </text>
      <text x={395} y={200} fontSize={11} fill={TX} fontFamily="Courier New, monospace">
        ├── images/train/ voo01_0001.jpg ...
      </text>
      <text x={395} y={214} fontSize={11} fill={TX} fontFamily="Courier New, monospace">
        └── labels/train/ voo01_0001.txt ...
      </text>
      <Seta x1={565} y1={132} x2={565} y2={148} />
      <text x={10} y={170} fontSize={11.5} fill={TX}>
        No passo 3, para vídeo, o modo track interpola a caixa
      </text>
      <text x={10} y={186} fontSize={11.5} fill={TX}>
        entre quadros-chave: rotula 1 a cada 10 quadros e corrige.
      </text>
      <text x={10} y={210} fontSize={11.5} fill={VM} fontWeight={700}>
        O CVAT exporta tudo em “train”: o split por voo é você quem faz.
      </text>
    </svg>
  )
}

/* ============ Figura: tela de anotação (esquema) ============ */

export function FigTelaCVAT() {
  const W = 760, H = 330
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={svgStyle} role="img" aria-label="esquema da tela de anotação">
      <rect x={0} y={0} width={W} height={H} fill="#f6f6f6" stroke="#bbb" />
      <rect x={0} y={0} width={W} height={34} fill="#2b2b33" />
      <text x={12} y={22} fontSize={12} fill="#fff">
        Tarefa: piquete_voo01 · quadro 37 / 240
      </text>
      <text x={W - 12} y={22} fontSize={12} fill={AM} textAnchor="end">
        Salvar (Ctrl+S)
      </text>
      {/* barra de ferramentas */}
      <rect x={0} y={34} width={52} height={H - 34} fill="#e4e4ea" />
      {['▢', '⬠', '•', '⟋', '⤾'].map((t, k) => (
        <g key={k}>
          <rect x={8} y={46 + k * 46} width={36} height={36} fill={k === 0 ? AZ : '#fff'} stroke="#999" rx={4} />
          <text x={26} y={70 + k * 46} fontSize={18} textAnchor="middle" fill={k === 0 ? '#fff' : TX}>
            {t}
          </text>
        </g>
      ))}
      <text x={26} y={290} fontSize={9} textAnchor="middle" fill={CZ}>
        ferramentas
      </text>
      {/* imagem */}
      <rect x={62} y={44} width={480} height={270} fill="#7aa14a" />
      <rect x={62} y={44} width={480} height={270} fill="url(#capim2)" opacity={0.5} />
      <defs>
        <pattern id="capim2" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M0,10 L5,0 M5,10 L10,0" stroke="#5c8a30" strokeWidth={1} />
        </pattern>
      </defs>
      {[
        [150, 120, 15, true],
        [300, 200, -20, true],
        [420, 110, 40, false],
        [250, 90, 0, true],
      ].map(([cx, cy, r, feito], k) => (
        <g key={k}>
          <g transform={`rotate(${r} ${cx} ${cy})`}>
            <ellipse cx={+cx + 4} cy={+cy + 4} rx={30} ry={13} fill="rgba(0,0,0,0.25)" />
            <ellipse cx={+cx} cy={+cy} rx={30} ry={13} fill="#ece7dc" />
            <ellipse cx={+cx + 32} cy={+cy} rx={8} ry={7} fill="#ddd6c8" />
          </g>
          {feito ? (
            <g>
              <rect x={+cx - 36} y={+cy - 26} width={78} height={52} fill="rgba(255,224,0,0.15)" stroke={AM} strokeWidth={2.5} />
              <text x={+cx - 34} y={+cy - 30} fontSize={11} fontWeight={700} fill={AM}>
                bovino #{k + 1}
              </text>
            </g>
          ) : (
            <g>
              <rect x={+cx - 40} y={+cy - 40} width={64} height={52} fill="none" stroke="#fff" strokeDasharray="6 4" strokeWidth={2} />
              <text x={+cx - 40} y={+cy + 28} fontSize={11} fill="#fff">
                desenhando...
              </text>
            </g>
          )}
        </g>
      ))}
      <circle cx={500} cy={260} r={9} fill="#9a7d5e" />
      <text x={420} y={285} fontSize={10.5} fill="#fff">
        cupinzeiro: não é boi
      </text>
      {/* painel de objetos */}
      <rect x={552} y={44} width={200} height={270} fill="#fff" stroke="#bbb" />
      <text x={562} y={64} fontSize={12} fontWeight={700} fill={TX}>
        Objetos (3)
      </text>
      {[1, 2, 4].map((k, i) => (
        <g key={k}>
          <rect x={562} y={76 + i * 36} width={180} height={28} fill="#fffbe0" stroke={AM} />
          <text x={570} y={94 + i * 36} fontSize={11} fill={TX}>
            #{k} bovino · retângulo
          </text>
        </g>
      ))}
      <text x={562} y={210} fontSize={11} fontWeight={700} fill={TX}>
        Atalhos úteis
      </text>
      {['N: desenhar de novo', 'F / D: próximo / anterior', 'Ctrl+S: salvar', 'Delete: apagar objeto'].map((t, k) => (
        <text key={k} x={562} y={228 + k * 18} fontSize={10.5} fill={CZ}>
          {t}
        </text>
      ))}
    </svg>
  )
}

/* ============ Figura: o laço de treino ============ */

export function FigLacoTreino() {
  const W = 760, H = 210
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={svgStyle} role="img" aria-label="o laço de treino com validação, parada antecipada e busca de hiperparâmetros">
      <Caixa x={20} y={70} w={130} h={60} t="hiperparâmetros" sub="lr0, imgsz, epochs..." fill={AM} />
      <Seta x1={150} y1={100} x2={190} y2={100} />
      <Caixa x={190} y={70} w={120} h={60} t="treina 1 época" sub="banco de treino" />
      <Seta x1={310} y1={100} x2={350} y2={100} />
      <Caixa x={350} y={70} w={120} h={60} t="mede" sub="banco de validação" />
      <Seta x1={470} y1={100} x2={510} y2={100} />
      <Caixa x={510} y={70} w={110} h={60} t="melhorou?" sub="guarda best.pt" />
      <path d="M565,70 C565,20 250,20 250,68" fill="none" stroke={AZ2} strokeWidth={2} />
      <polygon points="250,70 245,60 255,60" fill={AZ2} />
      <text x={410} y={30} fontSize={11} textAnchor="middle" fill={AZ2}>
        sim, ou ainda dentro da paciência: próxima época
      </text>
      <Seta x1={620} y1={100} x2={650} y2={100} cor={VM} />
      <Caixa x={650} y={70} w={100} h={60} t="para" sub="early stopping" cor={VM} />
      <path d="M85,130 C85,190 700,190 700,132" fill="none" stroke={VD} strokeWidth={2} strokeDasharray="6 4" />
      <polygon points="85,132 80,142 90,142" fill={VD} />
      <text x={392} y={198} fontSize={11} textAnchor="middle" fill={VD}>
        busca de hiperparâmetros: repete o laço inteiro com outra configuração e fica com a de melhor validação
      </text>
    </svg>
  )
}
