import { secaoAviario } from '../casos/Aviario'
import { useMemo, useState } from 'react'
import {
  type RGB, type Gray, type Mask, type PointOp, type SE, newRGB, toGray, pointLUT, applyLUT, histogram, convolve, median, addNoise, KERNELS,
  rgbIndex, normalize, otsu, threshold, erode, dilate, opening, closing, maskToGray, label, rng, INDEX_RANGE, plane,
} from '../lib/img'
import { ImgCanvas, Slider, Seg, SourcePicker, Lab, Callout, Term, Code, Histogram, CurvePlot } from '../ui'
import { field, leaf, useSource } from '../samples'
import type { Aula } from '../lesson'

/* ============ Lab 2.1 · transformações de intensidade ============ */

function fimDeTarde(img: RGB): RGB {
  const o = newRGB(img.w, img.h)
  for (let i = 0; i < img.data.length; i++) o.data[i] = 22 + img.data[i] * 0.34 * (i % 3 === 2 ? 0.8 : 1)
  return o
}

function Intensidade() {
  const src = useSource('folha')
  const [escuro, setEscuro] = useState(true)
  const [op, setOp] = useState<PointOp>('equalização')
  const [gamma, setGamma] = useState(0.5)
  const [lo, setLo] = useState(20)
  const [hi, setHi] = useState(110)
  const base = useMemo(() => (escuro ? fimDeTarde(src.img) : src.img), [src.img, escuro])
  const g = useMemo(() => toGray(base), [base])
  const lut = useMemo(() => pointLUT(op, g, gamma, lo, hi), [op, g, gamma, lo, hi])
  const out = useMemo(() => {
    // aplica a curva no brilho (cinza) e escala os 3 canais juntos, para não distorcer a matiz
    const o = newRGB(base.w, base.h)
    for (let i = 0; i < g.data.length; i++) {
      const v = g.data[i]
      const s = lut[Math.max(0, Math.min(255, Math.round(v)))]
      if (op === 'negativo') {
        for (let c = 0; c < 3; c++) o.data[i * 3 + c] = 255 - base.data[i * 3 + c]
        continue
      }
      const f = s / Math.max(v, 1)
      for (let c = 0; c < 3; c++) o.data[i * 3 + c] = Math.min(255, base.data[i * 3 + c] * f)
    }
    return o
  }, [base, lut, g, op])
  const h0 = useMemo(() => histogram(g, 64), [g])
  const h1 = useMemo(() => histogram(applyLUT(g, lut), 64), [g, lut])
  return (
    <Lab n="2.1" title="Salvando a foto tirada no fim de tarde" desc="A foto chegou escura e sem contraste. Escolha uma transformação s = T(r) e compare os histogramas antes e depois.">
      <SourcePicker {...src.pickerProps} />
      <div className="controls">
        <Seg value={escuro ? 'foto escura' : 'foto original'} options={['foto escura', 'foto original'] as const} onChange={(v) => setEscuro(v === 'foto escura')} label="entrada" />
        <Seg value={op} options={['identidade', 'negativo', 'log', 'gamma', 'alargamento', 'equalização'] as const} onChange={setOp} label="transformação T(r)" />
      </div>
      {op === 'gamma' && (
        <div className="controls">
          <Slider id="gm" label="γ (gama)" value={gamma} min={0.2} max={3} step={0.05} onChange={setGamma} fmt={(v) => v.toFixed(2)} />
        </div>
      )}
      {op === 'alargamento' && (
        <div className="controls">
          <Slider id="lo" label="r mínimo" value={lo} min={0} max={200} onChange={(v) => setLo(Math.min(v, hi - 5))} />
          <Slider id="hi" label="r máximo" value={hi} min={20} max={255} onChange={(v) => setHi(Math.max(v, lo + 5))} />
        </div>
      )}
      <div className="lab-cols">
        <div className="panel">
          <div className="panel-t">
            <span>antes</span>
          </div>
          <ImgCanvas img={base} label="imagem antes" />
          <Histogram data={h0} color="var(--ink-faint)" height={80} />
        </div>
        <div className="panel">
          <div className="panel-t">
            <span>depois · {op}</span>
          </div>
          <ImgCanvas img={out} label="imagem depois" />
          <Histogram data={h1} color="var(--leaf)" height={80} />
        </div>
        <div className="panel" style={{ justifyItems: 'center' }}>
          <div className="panel-t" style={{ width: '100%' }}>
            <span>a curva T(r)</span>
          </div>
          <CurvePlot lut={lut} />
          <p className="note">
            {op === 'equalização'
              ? 'A curva da equalização é o histograma acumulado. Onde há muitos pixels, ela sobe rápido e "espalha" esses tons.'
              : op === 'gamma'
                ? 'γ < 1 levanta os tons escuros. γ > 1 escurece. É a mesma conta que a tela do seu celular faz.'
                : op === 'log'
                  ? 'O log expande os escuros e comprime os claros. Útil quando a informação está toda na sombra.'
                  : op === 'alargamento'
                    ? 'Tudo abaixo de r mínimo vira preto, tudo acima de r máximo vira branco, e o meio é esticado.'
                    : op === 'negativo'
                      ? 's = 255 − r. Parece bobo, mas ajuda a enxergar detalhe claro em fundo escuro.'
                      : 'A diagonal: s = r. Nada muda.'}
          </p>
        </div>
      </div>
    </Lab>
  )
}

/* ============ Lab 2.2 · convolução ============ */

function Convolucao() {
  const src = useSource('folha')
  const [noise, setNoise] = useState<'nenhum' | 'sal e pimenta' | 'gaussiano'>('sal e pimenta')
  const [amt, setAmt] = useState(0.06)
  const [preset, setPreset] = useState('Média 3×3')
  const [k, setK] = useState<number[][]>(KERNELS['Média 3×3'].k)
  const [useMed, setUseMed] = useState(false)
  const [p, setP] = useState<[number, number]>([180, 120])
  const g = useMemo(() => toGray(src.img), [src.img])
  const noisy = useMemo(() => addNoise(g, noise, amt), [g, noise, amt])
  const out = useMemo(() => (useMed ? median(noisy, 1) : convolve(noisy, k)), [noisy, k, useMed])
  const sum = k.flat().reduce((a, b) => a + b, 0)
  const derivative = !useMed && Math.abs(sum) < 1e-6
  const view: Gray = useMemo(() => {
    if (!derivative) return out
    const o = { ...out, data: new Float32Array(out.data.length) }
    let mx = 1
    for (const v of out.data) mx = Math.max(mx, Math.abs(v))
    for (let i = 0; i < o.data.length; i++) o.data[i] = Math.min(255, (Math.abs(out.data[i]) / mx) * 255 * 2)
    return o
  }, [out, derivative])
  const nb = [-1, 0, 1].map((j) =>
    [-1, 0, 1].map((i) => {
      const x = Math.min(g.w - 1, Math.max(0, p[0] + i)), y = Math.min(g.h - 1, Math.max(0, p[1] + j))
      return noisy.data[y * g.w + x]
    }),
  )
  const res = useMed ? [...nb.flat()].sort((a, b) => a - b)[4] : nb.flat().reduce((s, v, i) => s + v * k[Math.floor(i / 3)][i % 3], 0)
  const overlay = useMemo(
    () => (ctx: CanvasRenderingContext2D, s: number) => {
      ctx.strokeStyle = '#e2bb52'
      ctx.lineWidth = 2
      ctx.strokeRect((p[0] - 1) * s, (p[1] - 1) * s, 3 * s, 3 * s)
    },
    [p],
  )
  return (
    <Lab n="2.2" title="Convolução ao vivo" desc="Escolha um kernel pronto ou digite seus próprios pesos. Passe o mouse na imagem da esquerda para ver a conta que gera aquele pixel.">
      <SourcePicker {...src.pickerProps} />
      <div className="controls">
        <Seg value={noise} options={['nenhum', 'sal e pimenta', 'gaussiano'] as const} onChange={setNoise} label="ruído" />
        {noise !== 'nenhum' && <Slider id="amt" label="quantidade de ruído" value={amt} min={0.01} max={0.25} step={0.01} onChange={setAmt} fmt={(v) => v.toFixed(2)} />}
      </div>
      <div className="controls">
        <Seg
          value={useMed ? 'Mediana 3×3' : preset}
          options={[...Object.keys(KERNELS), 'Mediana 3×3']}
          onChange={(v) => {
            if (v === 'Mediana 3×3') setUseMed(true)
            else {
              setUseMed(false)
              setPreset(v)
              setK(KERNELS[v].k.map((r) => [...r]))
            }
          }}
          label="filtro"
        />
      </div>
      <div className="lab-cols">
        <div className="panel">
          <div className="panel-t">
            <span>entrada (com ruído)</span>
          </div>
          <ImgCanvas img={noisy} overlay={overlay} onPixel={(x, y) => setP([x, y])} label="imagem de entrada com ruído" />
        </div>
        <div className="panel">
          <div className="panel-t">
            <span>saída</span>
            <span>{derivative ? '|valor| reescalado' : ''}</span>
          </div>
          <ImgCanvas img={view} overlay={overlay} onPixel={(x, y) => setP([x, y])} label="imagem filtrada" />
        </div>
        <div className="panel">
          <div className="panel-t">
            <span>{useMed ? 'mediana dos 9 vizinhos' : 'kernel (editável)'}</span>
            {!useMed && <span>soma = {sum.toFixed(2)}</span>}
          </div>
          {!useMed && (
            <div className="kgrid">
              {k.map((row, j) =>
                row.map((v, i) => (
                  <input
                    key={`${j}${i}`}
                    id={`k${j}${i}`}
                    aria-label={`peso linha ${j + 1} coluna ${i + 1}`}
                    type="number"
                    step="0.1"
                    value={Number(v.toFixed(3))}
                    onChange={(e) => setK((kk) => kk.map((r, jj) => r.map((c, ii) => (jj === j && ii === i ? +e.target.value : c))))}
                  />
                )),
              )}
            </div>
          )}
          <div className="readout">
            {nb.map((row, j) => (
              <div key={j}>{row.map((v, i) => (useMed ? String(Math.round(v)).padStart(4) : `${String(Math.round(v)).padStart(3)}×${k[j][i].toFixed(2).padStart(5)}`)).join('  ')}</div>
            ))}
            <div style={{ marginTop: 4 }}>
              → pixel de saída = <b>{res.toFixed(1)}</b>
            </div>
          </div>
          <p className="note">{useMed ? 'A mediana ordena os 9 valores e pega o do meio. Um pixel 0 ou 255 isolado nunca chega ao meio da fila.' : KERNELS[preset]?.nota}</p>
        </div>
      </div>
    </Lab>
  )
}

/* ============ Lab 2.3 · morfologia ============ */

type MorphOp = 'nenhuma' | 'erosão' | 'dilatação' | 'abertura' | 'fechamento' | 'gradiente'

function sujar(m: Mask, frac: number): Mask {
  const R = rng(4)
  const o = { ...m, data: m.data.slice() }
  for (let i = 0; i < o.data.length; i++) if (R() < frac) o.data[i] = o.data[i] ? 0 : 1
  return o
}

function Morfologia() {
  const [cena, setCena] = useState<'plantas na lavoura' | 'folha com lesões'>('plantas na lavoura')
  const [op, setOp] = useState<MorphOp>('abertura')
  const [se, setSe] = useState<SE>('disco')
  const [r, setR] = useState(1)
  const [ruido, setRuido] = useState(0.03)
  const base = useMemo<{ rgb: RGB; mask: Mask }>(() => {
    if (cena === 'plantas na lavoura') {
      const sc = field(11, 0.5, 30, 0.4)
      const [lo, hi] = INDEX_RANGE.ExG
      const v = normalize(rgbIndex(sc.rgb, 'ExG'), lo, hi)
      return { rgb: sc.rgb, mask: threshold(v, otsu(histogram(v))) }
    }
    const lf = leaf(5, 'mancha-alvo', 0.7, 'claro')
    const a = plane(lf.rgb, 'a*') // verde tem a* baixo
    return { rgb: lf.rgb, mask: threshold(a, 118, false) }
  }, [cena])
  const dirty = useMemo(() => sujar(base.mask, ruido), [base, ruido])
  const out = useMemo(() => {
    if (op === 'erosão') return erode(dirty, se, r)
    if (op === 'dilatação') return dilate(dirty, se, r)
    if (op === 'abertura') return opening(dirty, se, r)
    if (op === 'fechamento') return closing(dirty, se, r)
    if (op === 'gradiente') {
      const d = dilate(dirty, se, r), e = erode(dirty, se, r)
      return { ...d, data: d.data.map((v, i) => (v && !e.data[i] ? 1 : 0)) }
    }
    return dirty
  }, [dirty, op, se, r])
  const nIn = useMemo(() => label(dirty).blobs.length, [dirty])
  const nOut = useMemo(() => label(out).blobs.length, [out])
  const areaIn = dirty.data.reduce((a, b) => a + b, 0), areaOut = out.data.reduce((a, b) => a + b, 0)
  const seView = useMemo(() => {
    const n = 2 * r + 1
    const cells = []
    for (let j = -r; j <= r; j++)
      for (let i = -r; i <= r; i++) cells.push(se === 'quadrado' || (se === 'disco' && i * i + j * j <= r * r + 0.5) || (se === 'cruz' && (i === 0 || j === 0)))
    return { n, cells }
  }, [se, r])
  return (
    <Lab n="2.3" title="Carimbos morfológicos" desc="A máscara binária veio com ruído (pixels trocados ao acaso). Use o elemento estruturante para limpar e acompanhe quantos objetos sobram.">
      <div className="controls">
        <Seg value={cena} options={['plantas na lavoura', 'folha com lesões'] as const} onChange={setCena} label="cena" />
        <Slider id="ruido" label="ruído na máscara" value={ruido} min={0} max={0.12} step={0.01} onChange={setRuido} fmt={(v) => `${(v * 100).toFixed(0)}%`} />
      </div>
      <div className="controls">
        <Seg value={op} options={['nenhuma', 'erosão', 'dilatação', 'abertura', 'fechamento', 'gradiente'] as const} onChange={setOp} label="operação" />
        <Seg value={se} options={['quadrado', 'disco', 'cruz'] as const} onChange={setSe} label="elemento estruturante" />
        <Slider id="raio" label="raio" value={r} min={1} max={4} onChange={setR} fmt={(v) => `${v} (${2 * v + 1}×${2 * v + 1})`} />
      </div>
      <div className="lab-cols">
        <div className="panel">
          <div className="panel-t">
            <span>cena</span>
          </div>
          <ImgCanvas img={base.rgb} label="cena original" />
        </div>
        <div className="panel">
          <div className="panel-t">
            <span>máscara com ruído</span>
            <span>{nIn} objetos</span>
          </div>
          <ImgCanvas img={maskToGray(dirty)} label="máscara com ruído" />
        </div>
        <div className="panel">
          <div className="panel-t">
            <span>depois da {op}</span>
            <span>{nOut} objetos</span>
          </div>
          <ImgCanvas img={maskToGray(out)} label="máscara processada" />
        </div>
      </div>
      <div className="lab-cols">
        <div className="stats">
          <div className="stat">
            <b>{nIn} → {nOut}</b>
            <span>objetos conexos</span>
          </div>
          <div className="stat">
            <b>{((100 * areaOut) / (areaIn || 1)).toFixed(0)}%</b>
            <span>área branca que sobrou</span>
          </div>
          <div className="stat" style={{ display: 'grid', gap: 4 }}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${seView.n}, 10px)`, gap: 1 }}>
              {seView.cells.map((c, i) => (
                <i key={i} style={{ width: 10, height: 10, background: c ? 'var(--ink)' : 'var(--rule)', borderRadius: 1 }} />
              ))}
            </div>
            <span>o carimbo</span>
          </div>
        </div>
        <p className="note">
          {cena === 'plantas na lavoura'
            ? 'Objetivo: voltar para algo perto do número real de plantas. Abertura com disco de raio 1 remove os pontinhos soltos. Com raio 3 ou 4, as plantas pequenas somem junto.'
            : 'A lesão abriu buracos na máscara da folha. Fechamento com raio grande tapa os buracos e devolve a área foliar total, que é o denominador da severidade.'}
        </p>
      </div>
    </Lab>
  )
}

/* ============ conteúdo ============ */

const CODE_2 = `# Aula 2 · transformações, filtros e morfologia
import numpy as np
import matplotlib.pyplot as plt
from skimage import io, color, exposure, filters, morphology, util
from scipy import ndimage as ndi

img = io.imread("folha.jpg")[..., :3]
cinza = color.rgb2gray(img)                         # float entre 0 e 1

# 1) transformações de intensidade
eq    = exposure.equalize_hist(cinza)               # equalização global
clahe = exposure.equalize_adapthist(cinza)          # equalização local (CLAHE)
gama  = exposure.adjust_gamma(cinza, gamma=0.5)     # clareia os escuros

# 2) filtragem espacial
ruidosa = util.random_noise(cinza, mode="s&p", amount=0.06)
media   = ndi.uniform_filter(ruidosa, size=3)
mediana = ndi.median_filter(ruidosa, size=3)
sobel_x = ndi.convolve(cinza, np.array([[-1,0,1],[-2,0,2],[-1,0,1]]))

# 3) morfologia sobre uma máscara de planta (limiar em a*, verde = a* negativo)
a = color.rgb2lab(img)[..., 1]
mascara = a < -8
limpa   = morphology.binary_opening(mascara, morphology.disk(1))
sem_buraco = ndi.binary_fill_holes(morphology.binary_closing(limpa, morphology.disk(3)))

fig, ax = plt.subplots(2, 4, figsize=(16, 7))
for a_, im, t in zip(ax.ravel(),
    [cinza, eq, ruidosa, mediana, np.abs(sobel_x), mascara, limpa, sem_buraco],
    ["cinza", "equalizada", "sal e pimenta", "mediana 3x3", "|Sobel x|", "máscara", "abertura", "fechamento + preencher"]):
    a_.imshow(im, cmap="gray"); a_.set_title(t); a_.axis("off")
plt.tight_layout(); plt.show()`

export const aula2: Aula = {
  id: 'aula2',
  n: 2,
  trilha: 'grad',
  titulo: 'Receitas aplicadas em cada pixel',
  ideia: 'Toda transformação é uma receita repetida em cada pixel. Se a receita olha só o pixel, é operação de ponto. Se olha os vizinhos, é filtro. Se usa um carimbo, é morfologia.',
  ementa: ['Transformações de intensidade', 'Filtragem espacial', 'Convolução', 'Morfologia matemática'],
  labs: ['Foto no fim de tarde', 'Convolução ao vivo', 'Carimbos morfológicos', 'Caso real: aviário'],
  cor: ['#2d6a8a', '#6aa84f', '#e0bd4f', '#1b2417'],
  objetivos: [
    'Aplicar transformações de intensidade (negativo, log, gama, alargamento, equalização) e ler o efeito no histograma.',
    'Calcular à mão a saída de uma convolução 3×3 e prever o efeito de um kernel pelos seus pesos.',
    'Escolher entre filtro da média e da mediana conforme o tipo de ruído.',
    'Usar erosão, dilatação, abertura e fechamento para limpar máscaras de plantas e folhas.',
    'Reproduzir a contagem de aves de um TCC da UTFPR Medianeira e explicar por que a subtração de fundo venceu o limiar simples.',
  ],
  roteiro: [
    { t: 'Gancho: a foto escura', min: 4, tipo: 'gancho' },
    { t: 'Operações de ponto + Lab 2.1', min: 11, tipo: 'lab' },
    { t: 'Convolução', min: 6, tipo: 'conceito' },
    { t: 'Lab 2.2', min: 8, tipo: 'lab' },
    { t: 'Morfologia + Lab 2.3', min: 12, tipo: 'lab' },
    { t: 'Caso real: aviário + Lab 2.4', min: 12, tipo: 'lab' },
    { t: 'Fechamento + quiz', min: 7, tipo: 'fecho' },
  ],
  secoes: [
    {
      id: 'a2-gancho',
      titulo: 'A foto que chegou escura',
      min: 4,
      body: (
        <div className="prose">
          <p>
            Um técnico de campo mandou pelo WhatsApp a foto de uma folha suspeita de ferrugem, tirada às 18h. Está escura e sem contraste. Dá para salvar sem voltar à lavoura? Na maioria das vezes, sim,
            porque a informação continua lá, só está espremida em poucos níveis de cinza. Hoje a gente aprende três famílias de receitas para mexer nos pixels.
          </p>
        </div>
      ),
    },
    {
      id: 'a2-ponto',
      titulo: 'Operações de ponto: s = T(r)',
      min: 11,
      body: (
        <div className="prose">
          <p>
            A operação mais simples olha <b>só o próprio pixel</b>. Entra um nível <code>r</code>, sai um nível <code>s = T(r)</code>. Como os valores vão de 0 a 255, dá para pré-calcular a resposta para
            todos eles numa tabela de 256 posições, a{' '}
            <Term def="Look-Up Table: uma tabela com a resposta pronta para cada valor de entrada possível. Em vez de calcular a fórmula para cada um dos milhões de pixels, o programa só consulta a tabela.">LUT</Term>.
          </p>
          <Callout kind="analogia">
            <p>
              É a tabela de conversão de notas que o professor usa: tirou 4,5 no bruto, vira 6,0 depois da curva. A tabela é a mesma para a turma inteira. Ninguém recebe ajuste pela nota do colega do
              lado. Isso é uma operação de ponto.
            </p>
          </Callout>
          <p>
            A <b>equalização de histograma</b> é especial porque a própria imagem escolhe a curva: T(r) é o histograma acumulado normalizado. Onde há muitos pixels, a curva sobe rápido e esses tons ganham
            mais espaço na saída.
          </p>
          <Intensidade />
          <Callout kind="pegadinha">
            <p>
              Equalizar uma imagem antes de medir cor é trocar a régua no meio da medição. Serve para <b>ver</b> melhor, não para comparar a cor de duas folhas fotografadas em momentos diferentes.
            </p>
          </Callout>
        </div>
      ),
    },
    {
      id: 'a2-conv',
      titulo: 'Filtragem espacial e convolução',
      min: 14,
      body: (
        <div className="prose">
          <p>
            Agora a receita olha os <b>vizinhos</b>. Uma janelinha 3×3 de pesos, o <Term def="Também chamado de máscara, filtro ou núcleo. É a matriz pequena de pesos que desliza sobre a imagem.">kernel</Term>,
            desliza sobre a imagem. Em cada posição, multiplicamos cada peso pelo pixel embaixo dele e somamos. O resultado vira o pixel de saída.
          </p>
          <div className="formula">g(x, y) = Σᵢ Σⱼ w(i, j) · f(x + i, y + j)</div>
          <p>Três dicas para prever o efeito de um kernel só olhando os pesos:</p>
          <ul>
            <li>
              <b>Pesos todos positivos que somam 1</b>: suavização (média, gaussiano). Região uniforme continua igual.
            </li>
            <li>
              <b>Pesos que somam 0</b>: derivada. Região uniforme vira zero, e só as bordas acendem (Sobel, Laplaciano).
            </li>
            <li>
              <b>Soma 1 com centro grande e vizinhos negativos</b>: realce de nitidez.
            </li>
          </ul>
          <Convolucao />
          <Callout kind="campo">
            <p>
              O Sobel horizontal acende nas bordas das linhas de plantio. Combinado com a transformada de Hough, é o começo de muito algoritmo de detecção de linhas de cultura, usado para guiar
              máquinas e para achar daninhas na entrelinha (tudo verde fora da linha é suspeito).
            </p>
          </Callout>
          <Callout kind="prof">
            <p>
              Faça uma conta de convolução na lousa com uma grade 5×5 de números inventados antes de abrir o Lab 2.2. Depois peça para a turma conferir passando o mouse no pixel correspondente.
            </p>
          </Callout>
        </div>
      ),
    },
    {
      id: 'a2-morfo',
      titulo: 'Morfologia matemática',
      min: 12,
      body: (
        <div className="prose">
          <p>
            Morfologia trabalha com <b>forma</b>, em geral numa imagem binária (planta = 1, fundo = 0). A ferramenta é o{' '}
            <Term def="Um pequeno conjunto de pixels com forma definida (quadrado, disco, cruz) usado como sonda. Ele é centrado em cada pixel da imagem para decidir o resultado.">elemento estruturante</Term>,
            um carimbo que passamos por toda a imagem.
          </p>
          <ul>
            <li>
              <b>Erosão</b>: o pixel só continua branco se o carimbo <i>inteiro</i> couber dentro do objeto. Objetos encolhem e os pequenos somem.
            </li>
            <li>
              <b>Dilatação</b>: o pixel vira branco se o carimbo <i>encostar</i> em qualquer parte do objeto. Objetos engordam e buracos pequenos fecham.
            </li>
            <li>
              <b>Abertura</b> = erosão e depois dilatação. Remove sujeira menor que o carimbo e devolve o tamanho do que sobrou.
            </li>
            <li>
              <b>Fechamento</b> = dilatação e depois erosão. Tapa buracos e fendas menores que o carimbo.
            </li>
          </ul>
          <Callout kind="analogia">
            <p>
              Erosão é passar uma borracha redonda pelas bordas: tudo que é mais fino que a borracha desaparece. Dilatação é contornar o desenho com uma caneta grossa. Abertura é apagar e redesenhar: o que
              era fino demais para a borracha não volta.
            </p>
          </Callout>
          <Morfologia />
          <Callout kind="pegadinha">
            <p>
              A ordem importa. Abertura e fechamento com o mesmo carimbo dão resultados diferentes, e aplicar erosão três vezes com disco de raio 1 não é igual a uma erosão com disco de raio 3 (o formato
              acumulado vira um losango).
            </p>
          </Callout>
        </div>
      ),
    },
    secaoAviario,
    {
      id: 'a2-fecho',
      titulo: 'Pra levar pra casa',
      min: 7,
      body: (
        <div className="prose">
          <ol>
            <li>Operação de ponto olha só o pixel e pode virar uma tabela (LUT). Equalização é a curva escolhida pelo próprio histograma.</li>
            <li>Convolução olha a vizinhança. A soma dos pesos do kernel já diz se ele suaviza (soma 1) ou detecta borda (soma 0). Para sal e pimenta, a mediana ganha da média.</li>
            <li>Morfologia usa um carimbo: abertura limpa sujeira pequena, fechamento tapa buracos. O tamanho do carimbo é uma decisão sobre o tamanho do que você quer manter.</li>
          </ol>
          <Code code={CODE_2} />
        </div>
      ),
    },
  ],
  quiz: [
    { p: 'Para que serve a equalização de histograma?', o: ['Remover ruído sal e pimenta', 'Espalhar os níveis de intensidade e aumentar o contraste global', 'Detectar bordas', 'Converter RGB em HSV'], a: 1, e: 'Ela usa o histograma acumulado como curva T(r), redistribuindo os tons pela faixa toda.' },
    { p: 'Numa transformação gama s = 255·(r/255)^γ, o que um γ = 0,5 faz?', o: ['Escurece a imagem', 'Clareia principalmente os tons escuros', 'Inverte as cores', 'Não muda nada'], a: 1, e: 'Com γ < 1, valores pequenos sobem bastante. A imagem clareia, principalmente nas sombras.' },
    { p: 'Imagem com ruído sal e pimenta. Qual filtro 3×3 costuma funcionar melhor?', o: ['Média', 'Mediana', 'Laplaciano', 'Sobel'], a: 1, e: 'A mediana descarta os extremos (0 e 255). A média espalha o pixel ruim pelos vizinhos.' },
    { p: 'Os pesos de um kernel somam 0. O que acontece numa região de cor uniforme?', o: ['Fica branca', 'Fica igual', 'Vai para 0', 'Fica borrada'], a: 2, e: 'Se todos os pixels são iguais a c, a saída é c·(soma dos pesos) = 0. Só as bordas geram resposta.' },
    { p: 'Você quer remover pontinhos de palha na máscara sem mudar o tamanho das plantas. Qual operação?', o: ['Erosão', 'Dilatação', 'Abertura', 'Fechamento'], a: 2, e: 'Abertura (erosão seguida de dilatação) remove o que é menor que o carimbo e devolve o tamanho aproximado do que sobreviveu.' },
  ],
  desafios: [
    { nivel: 'aquecimento', txt: <>Monte no Lab 2.2 um kernel que detecte só bordas na diagonal (de cima-esquerda para baixo-direita). Quais pesos você usou? A soma dá quanto?</> },
    { nivel: 'mão na massa', txt: <>Implemente a erosão binária em NumPy puro, sem scikit-image, usando deslocamentos da matriz (<code>np.roll</code> ou fatiamento). Compare o resultado e o tempo com <code>morphology.binary_erosion</code>.</> },
    { nivel: 'investigação', txt: <>Numa foto de lavoura, calcule a cobertura verde antes e depois de uma abertura com disco de raio 1, 2 e 3. Faça um gráfico raio × cobertura e explique onde a limpeza começa a apagar planta de verdade.</> },
  ],
  leitura: [
    <>GONZALEZ, R. C.; WOODS, R. E. <i>Processamento digital de imagens</i>. 3. ed. Pearson, 2010. Cap. 3 (transformações de intensidade e filtragem espacial) e cap. 9 (processamento morfológico de imagens).</>,
    <>PEDRINI, H.; SCHWARTZ, W. R. <i>Análise de imagens digitais</i>. Thomson, 2008. Capítulos sobre realce, filtragem e morfologia matemática.</>,
    <>SOLOMON, C.; BRECKON, T. <i>Fundamentos de processamento digital de imagens</i>. LTC, 2013. Capítulos de realce e morfologia, com exemplos em Matlab fáceis de traduzir para Python.</>,
    <>BERLANDA, C. A. G. <i>Contagem de aves de corte em um aviário através do processamento digital de imagens</i>. Trabalho de Diplomação (Tecnologia em Análise e Desenvolvimento de Sistemas), UTFPR, Medianeira, 2015.</>,
  ],
}
