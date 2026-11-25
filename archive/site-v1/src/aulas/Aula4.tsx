import { LabVinhedo, casoVinhedo } from '../casos/Vinhedo'
import { LabSoja, casoSoja } from '../casos/Soja'
import { useMemo, useState } from 'react'
import { type Gray, type RGB, newGray, newRGB, histogram, rdylgn, median, kmeans, clamp, normalize } from '../lib/img'
import { BANDS, SOIL, STRAW, vegSpectrum, type BandName, type Bands, type FieldScene } from '../lib/synth'
import { ImgCanvas, Slider, Seg, Lab, Callout, Term, Code, Histogram, Legend } from '../ui'
import { field } from '../samples'
import type { Aula } from '../lesson'

/* ============ utilidades ============ */

function composite(b: Bands, ch: [BandName, BandName, BandName], gain: [number, number, number]): RGB {
  const { w, h } = b.Azul
  const o = newRGB(w, h)
  for (let i = 0; i < w * h; i++)
    for (let c = 0; c < 3; c++) o.data[i * 3 + c] = clamp(255 * Math.pow(Math.max(0, b[ch[c]].data[i] * gain[c]), 0.75))
  return o
}

type Indice = 'NDVI' | 'GNDVI' | 'NDRE' | 'SAVI'
const IDX_RANGE: Record<Indice, [number, number]> = { NDVI: [-0.2, 1], GNDVI: [-0.2, 1], NDRE: [-0.1, 0.6], SAVI: [-0.2, 0.9] }

function computeIndex(b: Bands, idx: Indice, L = 0.5): Gray {
  const { w, h } = b.Azul
  const o = newGray(w, h)
  for (let i = 0; i < w * h; i++) {
    const nir = b.NIR.data[i], red = b.Vermelho.data[i], g = b.Verde.data[i], re = b.RedEdge.data[i]
    o.data[i] =
      idx === 'NDVI' ? (nir - red) / (nir + red + 1e-6)
        : idx === 'GNDVI' ? (nir - g) / (nir + g + 1e-6)
          : idx === 'NDRE' ? (nir - re) / (nir + re + 1e-6)
            : ((nir - red) / (nir + red + L)) * (1 + L)
  }
  return o
}

const FORMULA: Record<Indice, string> = {
  NDVI: 'NDVI = (NIR − Vermelho) / (NIR + Vermelho)',
  GNDVI: 'GNDVI = (NIR − Verde) / (NIR + Verde)',
  NDRE: 'NDRE = (NIR − RedEdge) / (NIR + RedEdge)',
  SAVI: 'SAVI = (1 + L) · (NIR − Vermelho) / (NIR + Vermelho + L)',
}

/* ============ gráfico de assinatura espectral ============ */

const REFS = [
  { name: 'solo (latossolo)', s: SOIL, color: '#b0603c' },
  { name: 'palha', s: STRAW, color: '#c9a227' },
  { name: 'planta vigorosa', s: vegSpectrum(1), color: '#2f8a2f' },
  { name: 'planta estressada', s: vegSpectrum(0.25), color: '#9aa84a' },
]

function SpectralPlot({ px }: { px: number[] | null }) {
  const W = 340, H = 190, L = 36, B = 30, T = 10
  const nm = BANDS.map((b) => b.nm)
  const x = (v: number) => L + ((v - 450) / (870 - 450)) * (W - L - 10)
  const y = (r: number) => T + (1 - r / 0.6) * (H - T - B)
  const path = (s: number[]) => s.map((r, i) => `${i ? 'L' : 'M'}${x(nm[i])},${y(r)}`).join('')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="assinatura espectral" style={{ display: 'block' }}>
      <rect x={x(690)} y={T} width={x(730) - x(690)} height={H - T - B} fill="var(--soil-soft)" />
      <text x={x(710)} y={T + 10} fontSize={8} textAnchor="middle" fill="var(--soil)" fontFamily="var(--f-mono)">red edge</text>
      {[0, 0.2, 0.4, 0.6].map((t) => (
        <g key={t}>
          <line x1={L} x2={W - 10} y1={y(t)} y2={y(t)} stroke="var(--rule)" strokeDasharray={t ? '3 3' : undefined} />
          <text x={L - 4} y={y(t) + 3} fontSize={9} textAnchor="end" fill="var(--ink-faint)" fontFamily="var(--f-mono)">{t.toFixed(1)}</text>
        </g>
      ))}
      {BANDS.map((b) => (
        <text key={b.name} x={x(b.nm)} y={H - B + 13} fontSize={8.5} textAnchor="middle" fill="var(--ink-faint)" fontFamily="var(--f-mono)">
          {b.nm}
        </text>
      ))}
      <text x={(W + L) / 2} y={H - 3} fontSize={9} textAnchor="middle" fill="var(--ink-faint)" fontFamily="var(--f-mono)">comprimento de onda (nm) · eixo y: reflectância</text>
      {REFS.map((r) => (
        <path key={r.name} d={path(r.s)} fill="none" stroke={r.color} strokeWidth={1.6} strokeDasharray="5 3" opacity={0.8} />
      ))}
      {px && (
        <g>
          <path d={path(px)} fill="none" stroke="var(--ink)" strokeWidth={2.6} />
          {px.map((r, i) => (
            <circle key={i} cx={x(nm[i])} cy={y(r)} r={3.5} fill="var(--ink)" />
          ))}
        </g>
      )}
    </svg>
  )
}

/* ============ Lab 4.1 ============ */

const CLASSE_NOME = ['solo', 'palha', 'cultura', 'planta daninha']
type Vista = 'cor verdadeira' | 'falsa-cor NIR' | BandName

function Assinatura() {
  const [seed, setSeed] = useState(21)
  const sc: FieldScene = field(seed, 0.95, 24, 0.45)
  const [vista, setVista] = useState<Vista>('cor verdadeira')
  const [p, setP] = useState<[number, number]>([120, 120])
  const img = useMemo(() => {
    if (vista === 'cor verdadeira') return sc.rgb
    if (vista === 'falsa-cor NIR') return composite(sc.bands, ['NIR', 'Vermelho', 'Verde'], [1.4, 2.6, 2.6])
    return normalize(sc.bands[vista], 0, 0.6)
  }, [sc, vista])
  const i = p[1] * sc.w + p[0]
  const px = BANDS.map((b) => sc.bands[b.name].data[i])
  const overlay = useMemo(
    () => (ctx: CanvasRenderingContext2D, s: number) => {
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc((p[0] + 0.5) * s, (p[1] + 0.5) * s, 7, 0, 7)
      ctx.stroke()
    },
    [p],
  )
  return (
    <Lab n="4.1" title="Assinatura espectral pixel a pixel" desc="Este talhão tem uma mancha de estresse hídrico leve. Procure por ela na cor verdadeira, depois troque para a falsa-cor ou para a banda NIR. Clique nos pixels para ver a curva de reflectância.">
      <div className="controls">
        <Seg value={vista} options={['cor verdadeira', 'falsa-cor NIR', 'Azul', 'Verde', 'Vermelho', 'RedEdge', 'NIR'] as const} onChange={setVista} label="visualização" />
        <button type="button" className="btn ghost" onClick={() => setSeed((s) => s + 1)}>
          Outro talhão
        </button>
      </div>
      <div className="lab-cols two">
        <div className="panel">
          <div className="panel-t">
            <span>{vista}</span>
            <span>{vista === 'falsa-cor NIR' ? 'R=NIR · G=Verm. · B=Verde' : typeof vista === 'string' && BANDS.some((b) => b.name === vista) ? `${BANDS.find((b) => b.name === vista)!.nm} nm` : ''}</span>
          </div>
          <ImgCanvas img={img} overlay={overlay} onClickPixel={(x, y) => setP([x, y])} label={`talhão em ${vista}`} />
        </div>
        <div className="panel">
          <div className="panel-t">
            <span>pixel ({p[0]}, {p[1]}) · gabarito: {CLASSE_NOME[sc.classe[i]]}</span>
            <span>vigor {sc.vigor[i].toFixed(2)}</span>
          </div>
          <SpectralPlot px={px} />
          <Legend items={[...REFS.map((r) => ({ name: r.name, color: r.color })), { name: 'pixel clicado', color: 'var(--ink)' }]} />
        </div>
      </div>
    </Lab>
  )
}

/* ============ Lab 4.2 ============ */

function Indices() {
  const [estadio, setEstadio] = useState<'início (solo exposto)' | 'dossel fechado'>('dossel fechado')
  const [idx, setIdx] = useState<Indice>('NDVI')
  const [L, setL] = useState(0.5)
  const sc = estadio === 'dossel fechado' ? field(33, 1.7, 10, 0.75) : field(33, 0.55, 30, 0.75)
  const ind = useMemo(() => computeIndex(sc.bands, idx, L), [sc, idx, L])
  const [lo, hi] = IDX_RANGE[idx]
  const view = useMemo(() => normalize(ind, lo, hi), [ind, lo, hi])
  const hist = useMemo(() => histogram(ind, 80, lo, hi), [ind, lo, hi])
  // separabilidade entre plantas estressadas e vigorosas (d′)
  const sep = useMemo(() => {
    const a: number[] = [], b: number[] = []
    for (let i = 0; i < ind.data.length; i++) {
      if (sc.classe[i] !== 2) continue
      if (sc.vigor[i] < 0.5) a.push(ind.data[i])
      else if (sc.vigor[i] > 0.75) b.push(ind.data[i])
    }
    const m = (x: number[]) => x.reduce((s, v) => s + v, 0) / (x.length || 1)
    const v = (x: number[], mu: number) => x.reduce((s, q) => s + (q - mu) ** 2, 0) / (x.length || 1)
    const ma = m(a), mb = m(b)
    return { ma, mb, d: (mb - ma) / Math.sqrt((v(a, ma) + v(b, mb)) / 2 || 1e-9) }
  }, [ind, sc])
  return (
    <Lab n="4.2" title="NDVI, NDRE e companhia" desc="Compare os índices nos dois estádios. O número d′ mede quão bem o índice separa plantas estressadas de vigorosas (quanto maior, melhor).">
      <div className="controls">
        <Seg value={estadio} options={['início (solo exposto)', 'dossel fechado'] as const} onChange={setEstadio} label="estádio" />
        <Seg value={idx} options={['NDVI', 'GNDVI', 'NDRE', 'SAVI'] as const} onChange={setIdx} label="índice" />
        {idx === 'SAVI' && <Slider id="L" label="L (fator de solo)" value={L} min={0} max={1} step={0.05} onChange={setL} fmt={(v) => v.toFixed(2)} />}
      </div>
      <div className="formula">{FORMULA[idx]}</div>
      <div className="lab-cols two">
        <div className="panel">
          <div className="panel-t">
            <span>mapa de {idx}</span>
            <span>
              {lo} → {hi}
            </span>
          </div>
          <ImgCanvas img={view} lut={(v) => rdylgn(v / 255)} label={`mapa de ${idx}`} />
          <div style={{ height: 10, borderRadius: 3, background: `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map((t) => `rgb(${rdylgn(t).map(Math.round).join(',')})`).join(',')})` }} />
        </div>
        <div className="panel">
          <div className="panel-t">
            <span>histograma de {idx}</span>
          </div>
          <Histogram data={hist} lo={lo} hi={hi} color="var(--leaf)" marks={[{ v: sep.ma, label: `estressada ${sep.ma.toFixed(2)}`, color: 'var(--soil)' }, { v: sep.mb, label: `vigorosa ${sep.mb.toFixed(2)}`, color: 'var(--leaf)' }]} />
          <div className="stats">
            <div className="stat">
              <b>{(sep.mb - sep.ma).toFixed(3)}</b>
              <span>diferença de médias</span>
            </div>
            <div className="stat">
              <b style={{ color: sep.d > 3 ? 'var(--ok)' : sep.d > 1.5 ? 'var(--grain)' : 'var(--bad)' }}>{sep.d.toFixed(1)}</b>
              <span>d′ (separabilidade)</span>
            </div>
          </div>
          <p className="note">
            {estadio === 'dossel fechado'
              ? 'Com o dossel fechado, o vermelho já foi quase todo absorvido e o NDVI encosta no teto. Compare o d′ do NDVI com o do NDRE.'
              : 'Com muito solo aparecendo, o fundo contamina o índice. Veja o SAVI com L = 0,5 e compare com o NDVI.'}
          </p>
        </div>
      </div>
    </Lab>
  )
}

/* ============ Lab 4.3 ============ */

const ZONE_COLORS = ['#c4452f', '#e98c4a', '#e8cf62', '#8cc265', '#2f8a4a']

function Zonas() {
  const [idx, setIdx] = useState<'NDVI' | 'NDRE'>('NDRE')
  const [k, setK] = useState(3)
  const [suav, setSuav] = useState(2)
  const [base, setBase] = useState(120)
  const [estr, setEstr] = useState<'compensar' | 'potencializar'>('compensar')
  const sc = field(52, 1.5, 6, 0.8)
  const ind = useMemo(() => computeIndex(sc.bands, idx), [sc, idx])
  const smooth = useMemo(() => {
    if (!suav) return ind
    const [lo, hi] = IDX_RANGE[idx]
    const n = normalize(ind, lo, hi)
    const m = median(n, suav)
    return { ...m, data: m.data.map((v) => lo + (v / 255) * (hi - lo)) }
  }, [ind, suav, idx])
  const zones = useMemo(() => {
    const sample: number[][] = []
    for (let i = 0; i < smooth.data.length; i += 7) sample.push([smooth.data[i]])
    const { centers } = kmeans(sample, k, 3)
    const order = centers.map((c, i) => [c[0], i]).sort((a, b) => a[0] - b[0])
    const rank = new Array(k)
    order.forEach(([, i], r) => (rank[i] = r))
    const lab = new Uint8Array(smooth.data.length)
    for (let i = 0; i < lab.length; i++) {
      let best = 0, bd = Infinity
      centers.forEach((c, j) => {
        const d = Math.abs(smooth.data[i] - c[0])
        if (d < bd) {
          bd = d
          best = j
        }
      })
      lab[i] = rank[best]
    }
    return { lab, means: order.map((o) => o[0]) }
  }, [smooth, k])
  const zoneImg = useMemo(() => {
    const o = newRGB(sc.w, sc.h)
    const cols = ZONE_COLORS.filter((_, i) => k === 5 || (k === 4 ? i !== 2 : k === 3 ? i % 2 === 0 : i === 0 || i === 4))
    for (let i = 0; i < zones.lab.length; i++) {
      const hex = cols[zones.lab[i]]
      o.data[i * 3] = parseInt(hex.slice(1, 3), 16)
      o.data[i * 3 + 1] = parseInt(hex.slice(3, 5), 16)
      o.data[i * 3 + 2] = parseInt(hex.slice(5, 7), 16)
    }
    return { img: o, cols }
  }, [zones, sc, k])
  const pxHa = 1 / 10000 // cada pixel = 1 m²
  const areas = Array.from({ length: k }, (_, z) => zones.lab.reduce((s, v) => s + (v === z ? 1 : 0), 0) * pxHa)
  const totalHa = areas.reduce((a, b) => a + b, 0)
  const dose = (z: number) => {
    const t = k === 1 ? 0 : z / (k - 1) - 0.5 // −0,5 (zona mais fraca) a +0,5 (mais forte)
    return Math.round(base + (estr === 'compensar' ? -1 : 1) * t * 80)
  }
  const totalVar = areas.reduce((s, a, z) => s + a * dose(z), 0)
  const totalUni = totalHa * base
  // quanto da área de estresse hídrico recebeu a maior dose?
  let estressada = 0, estressadaMaiorDose = 0
  const maxDoseZone = estr === 'compensar' ? 0 : k - 1
  for (let i = 0; i < zones.lab.length; i++)
    if (sc.vigor[i] < 0.5) {
      estressada++
      if (zones.lab[i] === maxDoseZone) estressadaMaiorDose++
    }
  return (
    <Lab n="4.3" title="Do mapa de índice à prescrição" desc="Agrupe o talhão em zonas de manejo com k-means sobre o índice e monte uma prescrição de nitrogênio em taxa variável para um milho em cobertura. Cada pixel aqui vale 1 m².">
      <div className="controls">
        <Seg value={idx} options={['NDVI', 'NDRE'] as const} onChange={setIdx} label="índice" />
        <Slider id="k" label="número de zonas (k)" value={k} min={2} max={5} onChange={setK} />
        <Slider id="suav" label="suavização (mediana, raio)" value={suav} min={0} max={3} onChange={setSuav} fmt={(v) => (v ? `${v} px` : 'nenhuma')} />
      </div>
      <div className="lab-cols two">
        <div className="panel">
          <div className="panel-t">
            <span>zonas de manejo</span>
            <span>{totalHa.toFixed(2)} ha</span>
          </div>
          <ImgCanvas img={zoneImg.img} label="mapa de zonas de manejo" />
        </div>
        <div className="panel">
          <div className="controls">
            <Slider id="base" label="dose média de N" value={base} min={60} max={200} step={10} onChange={setBase} fmt={(v) => `${v} kg/ha`} />
            <Seg value={estr} options={['compensar', 'potencializar'] as const} onChange={setEstr} label="estratégia" />
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>zona</th>
                  <th>{idx} médio</th>
                  <th>área (ha)</th>
                  <th>dose N (kg/ha)</th>
                  <th>N total (kg)</th>
                </tr>
              </thead>
              <tbody>
                {areas.map((a, z) => (
                  <tr key={z}>
                    <td>
                      <i style={{ display: 'inline-block', width: 10, height: 10, background: zoneImg.cols[z], borderRadius: 2, marginRight: 6 }} />
                      {z === 0 ? 'baixo vigor' : z === k - 1 ? 'alto vigor' : `intermediária ${z}`}
                    </td>
                    <td>{zones.means[z].toFixed(3)}</td>
                    <td>{a.toFixed(2)}</td>
                    <td>{dose(z)}</td>
                    <td>{(a * dose(z)).toFixed(0)}</td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <b>taxa variável</b>
                  </td>
                  <td />
                  <td>{totalHa.toFixed(2)}</td>
                  <td />
                  <td>
                    <b>{totalVar.toFixed(0)}</b>
                  </td>
                </tr>
                <tr>
                  <td>taxa fixa ({base} kg/ha)</td>
                  <td />
                  <td />
                  <td />
                  <td>{totalUni.toFixed(0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="note" style={{ color: estressadaMaiorDose / (estressada || 1) > 0.5 ? 'var(--bad)' : undefined }}>
            {((100 * estressadaMaiorDose) / (estressada || 1)).toFixed(0)}% da área com estresse <b>hídrico</b> recebeu a maior dose de N. Pense se isso faz sentido antes de ler a próxima seção.
          </p>
        </div>
      </div>
    </Lab>
  )
}

/* ============ conteúdo ============ */

const CODE_4 = `# Aula 4 · NDVI de uma cena Sentinel-2 (nível L2A) e zonas de manejo
import numpy as np, rasterio
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
from scipy import ndimage as ndi

def refletancia(caminho):
    with rasterio.open(caminho) as r:
        dn = r.read(1).astype("float32")
    # desde 2022 (baseline 04.00) o L2A tem deslocamento de -1000 nos números digitais
    return np.clip((dn - 1000) / 10000, 0, 1)

red = refletancia("T21JYM_B04_10m.jp2")    # vermelho
nir = refletancia("T21JYM_B08_10m.jp2")    # infravermelho próximo
ndvi = (nir - red) / (nir + red + 1e-6)

# zonas de manejo: suaviza e agrupa em 3 classes
suave = ndi.median_filter(ndvi, size=5)
km = KMeans(n_clusters=3, n_init=10, random_state=0).fit(suave.reshape(-1, 1))
ordem = np.argsort(km.cluster_centers_.ravel())          # zona 0 = menor NDVI
zonas = np.argsort(ordem)[km.labels_].reshape(ndvi.shape)

fig, ax = plt.subplots(1, 2, figsize=(12, 5))
ax[0].imshow(ndvi, cmap="RdYlGn", vmin=-0.2, vmax=1); ax[0].set_title("NDVI")
ax[1].imshow(zonas, cmap="RdYlGn"); ax[1].set_title("zonas de manejo")
plt.show()`

const CODE_GEE = `# Série temporal de NDVI no Google Earth Engine (sem baixar nenhuma imagem)
import ee
ee.Authenticate(); ee.Initialize(project="seu-projeto-no-gcp")

ponto = ee.Geometry.Point([-54.09, -25.29]).buffer(300)    # arredores de Medianeira-PR
col = (ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
         .filterBounds(ponto)
         .filterDate("2025-10-01", "2026-03-31")
         .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20)))

def ndvi_medio(img):
    v = img.normalizedDifference(["B8", "B4"]).reduceRegion(ee.Reducer.mean(), ponto, 10)
    return ee.Feature(None, {"data": img.date().format("YYYY-MM-dd"), "ndvi": v.get("nd")})

serie = ee.FeatureCollection(col.map(ndvi_medio)).getInfo()
for f in serie["features"]:
    print(f["properties"]["data"], round(f["properties"]["ndvi"] or 0, 3))`

export const aula4: Aula = {
  id: 'aula4',
  n: 4,
  trilha: 'mest',
  titulo: 'Enxergar além do verde',
  ideia: 'A planta estressada "apaga" no infravermelho antes de amarelar no visível. Índices espectrais são só razões entre bandas, mas transformam essa diferença num mapa de decisão.',
  ementa: ['Assinatura espectral', 'Bandas e reflectância', 'NDVI, NDRE, SAVI', 'Zonas de manejo', 'Taxa variável'],
  labs: ['Assinatura espectral', 'Índices e saturação', 'Zonas e prescrição', 'Caso real: vinhedo', 'Caso real: soja com drone'],
  cor: ['#c4452f', '#e8cf62', '#8cc265', '#2f8a4a'],
  objetivos: [
    'Explicar a forma da assinatura espectral da vegetação (absorção no vermelho, platô no NIR, red edge) e o que muda sob estresse.',
    'Calcular e interpretar NDVI, GNDVI, NDRE e SAVI, reconhecendo a saturação do NDVI em dossel fechado.',
    'Delinear zonas de manejo com k-means e montar uma prescrição de taxa variável.',
    'Criticar uma prescrição à luz da causa agronômica da variabilidade.',
    'Avaliar, em dois trabalhos reais, como a resolução do sensor e a mistura de alvos no pixel limitam o NDVI e a contagem de plantas.',
  ],
  roteiro: [
    { t: 'Gancho: a mancha invisível', min: 4, tipo: 'gancho' },
    { t: 'Física da reflectância + Lab 4.1', min: 12, tipo: 'lab' },
    { t: 'Índices', min: 6, tipo: 'conceito' },
    { t: 'Lab 4.2', min: 7, tipo: 'lab' },
    { t: 'Zonas de manejo + Lab 4.3', min: 11, tipo: 'lab' },
    { t: 'Casos reais: vinhedo e soja + Labs 4.4 e 4.5', min: 13, tipo: 'lab' },
    { t: 'Discussão + quiz', min: 7, tipo: 'fecho' },
  ],
  secoes: [
    {
      id: 'a4-gancho',
      titulo: 'A mancha que o olho não vê',
      min: 4,
      body: (
        <div className="prose">
          <p>
            Abra o Lab 4.1 na cor verdadeira e peça para a turma apontar onde está o problema no talhão. Quase ninguém acha. Troque para a banda NIR: a mancha aparece na hora. A planta sob estresse
            hídrico leve ainda está verde, mas a estrutura interna da folha já mudou, e é essa estrutura que reflete o infravermelho próximo.
          </p>
          <p>
            A aula de hoje é sobre ganhar olhos que a gente não tem. E sobre um cuidado importante: um mapa bonito não garante uma decisão certa.
          </p>
        </div>
      ),
    },
    {
      id: 'a4-reflect',
      titulo: 'Por que a planta brilha no infravermelho',
      min: 12,
      body: (
        <div className="prose">
          <p>
            Câmeras multiespectrais e satélites medem a{' '}
            <Term def="Fração da energia incidente que a superfície reflete, de 0 a 1, numa faixa de comprimento de onda. Diferente do número digital (DN) cru do sensor, a reflectância é comparável entre datas e sensores depois da calibração.">reflectância</Term>{' '}
            em bandas estreitas. A curva de reflectância ao longo do espectro é a <b>assinatura espectral</b>. Para a vegetação, ela tem três trechos marcantes:
          </p>
          <ol>
            <li>
              <b>Azul e vermelho baixos</b>: a clorofila absorve essa luz para a fotossíntese. Há um pequeno pico no verde, por isso vemos a folha verde.
            </li>
            <li>
              <b>Red edge</b> (≈ 690–730 nm): subida abrupta. A posição e a inclinação dessa rampa acompanham o teor de clorofila.
            </li>
            <li>
              <b>Platô alto no NIR</b> (≈ 750–900 nm): a luz é espalhada pelas interfaces entre células e espaços de ar do mesófilo. Folha desidratada ou senescente espalha menos.
            </li>
          </ol>
          <Callout kind="analogia">
            <p>
              A clorofila é a "tinta" da folha e aparece no visível. O mesófilo é a "estrutura" da folha e aparece no NIR. No começo do estresse, a estrutura já mudou mas a tinta ainda não desbotou.
            </p>
          </Callout>
          <Assinatura />
          <Callout kind="campo">
            <p>
              Fontes gratuitas e acessíveis: Sentinel-2 (10 m no vermelho e NIR, 20 m no red edge, revisita de cerca de 5 dias), Landsat 8 e 9 (30 m) e o CBERS-4A, satélite sino-brasileiro com imagens
              distribuídas pelo INPE. Para GSD centimétrico, drones com câmeras multiespectrais e painel de calibração.
            </p>
          </Callout>
        </div>
      ),
    },
    {
      id: 'a4-indices',
      titulo: 'Índices de vegetação',
      min: 13,
      body: (
        <div className="prose">
          <p>
            Um índice espectral é uma conta simples entre bandas que realça um contraste da assinatura. O mais famoso é o NDVI (Rouse et al., 1974), uma diferença normalizada entre NIR e vermelho. A
            normalização tem um motivo prático: se a iluminação cai pela metade, numerador e denominador caem juntos e o índice quase não muda.
          </p>
          <ul>
            <li>
              <b>NDVI</b> vai de −1 a 1. Solo fica perto de 0,1–0,3, vegetação densa passa de 0,8.
            </li>
            <li>
              <b>GNDVI</b> (Gitelson et al., 1996) troca o vermelho pelo verde e é mais sensível à clorofila em dossel denso.
            </li>
            <li>
              <b>NDRE</b> usa o red edge no lugar do vermelho. Não satura tão cedo, então continua diferenciando plantas quando o NDVI já "bateu no teto".
            </li>
            <li>
              <b>SAVI</b> (Huete, 1988) inclui o fator L para reduzir a influência do solo quando a cobertura é baixa. L = 0,5 é o valor mais usado.
            </li>
          </ul>
          <Indices />
          <Callout kind="pegadinha">
            <p>
              <b>Saturação.</b> Em dossel fechado, quase todo o vermelho já é absorvido. Mais biomassa quase não reduz o vermelho, então o NDVI para de subir. Por isso NDRE e GNDVI aparecem tanto em
              milho e cana depois do fechamento.
            </p>
            <p>
              <b>Número digital não é reflectância.</b> Comparar NDVI de dois voos sem calibração radiométrica (painel de referência ou sensor de irradiância) é comparar réguas diferentes.
            </p>
          </Callout>
        </div>
      ),
    },
    {
      id: 'a4-zonas',
      titulo: 'Zonas de manejo e taxa variável',
      min: 11,
      body: (
        <div className="prose">
          <p>
            Um mapa de índice pixel a pixel é detalhado demais para a máquina. Uma aplicadora não troca de dose a cada metro. A saída é agrupar o talhão em poucas <b>zonas de manejo</b>, regiões com
            comportamento parecido, e dar uma dose para cada uma. O caminho mais comum é suavizar o mapa (para tirar o "sal e pimenta" de zonas minúsculas) e aplicar k-means sobre o índice, sozinho ou
            junto com outras camadas (produtividade de safras anteriores, condutividade elétrica do solo, altimetria).
          </p>
          <Zonas />
          <Callout kind="pegadinha" title="A pergunta que separa quem sabe de quem só roda código">
            <p>
              A zona de baixo vigor deste talhão foi causada por <b>falta de água</b>, não por falta de nitrogênio. Na estratégia "compensar", ela recebe a maior dose. O índice não diz o porquê da
              diferença, só que ela existe. Colocar mais N onde a planta não tem água para usá-lo é gastar insumo sem retorno.
            </p>
            <p>
              Antes de prescrever, alguém precisa ir a campo (amostragem dirigida por zona) e entender a causa. Imagem aponta onde olhar. Não substitui o agrônomo.
            </p>
          </Callout>
          <Callout kind="prof">
            <p>
              Divida a turma em "compensar" e "potencializar" e peça dois minutos de defesa para cada lado. Não existe resposta universal: depende da causa da baixa produtividade e do preço do insumo.
              Quem cursou Agricultura de Precisão no PPGTCA pode comparar com o delineamento de zonas feito no AgDataBox.
            </p>
          </Callout>
        </div>
      ),
    },
    {
      id: 'a4-casos',
      titulo: 'Casos reais: do satélite ao drone',
      min: 13,
      body: (
        <div className="prose">
          <p>
            Dois trabalhos brasileiros mostram os dois extremos da resolução. Um usa satélite de 10 m para comparar parcelas de videira e macieira no Rio Grande do Sul. O outro voa um drone a 10 m
            para medir centímetros entre plantas de soja. Nos dois, o tamanho do pixel decide o que dá para responder.
          </p>
          {casoVinhedo}
          <LabVinhedo />
          <Callout kind="pegadinha" title="O pixel misturado">
            <p>
              Num pixel de 10 m cabem quatro linhas de videira e as entrelinhas. O NDVI é calculado sobre a <b>mistura</b> das reflectâncias. Com a entrelinha gramada e verde, o pixel parece
              vigoroso mesmo sobre uma parcela fraca, e a ordem entre as parcelas se embaralha. Por isso a data da imagem e o manejo da entrelinha importam tanto quanto o índice.
            </p>
          </Callout>
          {casoSoja}
          <LabSoja />
          <Callout kind="campo" title="O que o artigo da soja ensina">
            <p>
              Em V4 a folhagem de plantas vizinhas se toca e os grupos se fundem: poucas distâncias longas, lidas como falha. O algoritmo não "errou a conta", a imagem não tinha a resposta. Desça o
              voo e volte ao estádio VC no lab: a contagem melhora. É a pergunta da Aula 1 de novo: qual GSD a pergunta agronômica exige?
            </p>
          </Callout>
        </div>
      ),
    },
    {
      id: 'a4-fecho',
      titulo: 'Pra levar pra casa',
      min: 7,
      body: (
        <div className="prose">
          <ol>
            <li>Vegetação absorve vermelho (clorofila) e espalha NIR (mesófilo). O estresse aparece no NIR e no red edge antes de aparecer no visível.</li>
            <li>Índices são razões normalizadas entre bandas. NDVI satura em dossel fechado; NDRE e GNDVI ajudam. SAVI corrige o solo em cobertura baixa.</li>
            <li>Zonas de manejo resumem o mapa em decisões. O mapa mostra onde está a diferença, e o campo diz por que ela existe.</li>
          </ol>
          <Code code={CODE_4} title="Python · rasterio + scikit-learn" />
          <Code code={CODE_GEE} title="Python · Google Earth Engine" />
        </div>
      ),
    },
  ],
  quiz: [
    { p: 'Por que a vegetação sadia reflete tanto no infravermelho próximo?', o: ['Porque a clorofila reflete o NIR', 'Pelo espalhamento da luz na estrutura interna da folha (mesófilo)', 'Porque o NIR é absorvido pela água', 'Porque o sensor é mais sensível no NIR'], a: 1, e: 'A clorofila atua no visível. O platô do NIR vem do espalhamento nas interfaces entre células e espaços de ar do mesófilo.' },
    { p: 'NIR = 0,50 e vermelho = 0,05. Quanto vale o NDVI?', o: ['0,45', '0,82', '0,91', '10'], a: 1, e: '(0,50 − 0,05)/(0,50 + 0,05) = 0,45/0,55 ≈ 0,82.' },
    { p: 'Milho com dossel fechado: o NDVI está quase igual no talhão todo. O que tentar?', o: ['Equalizar o histograma do NDVI', 'Usar NDRE ou GNDVI', 'Aumentar o GSD', 'Usar só a banda azul'], a: 1, e: 'O NDVI satura com alta biomassa. Índices com red edge ou verde continuam sensíveis por mais tempo.' },
    { p: 'Para que serve o fator L do SAVI?', o: ['Corrigir nuvens', 'Reduzir a influência do solo quando a cobertura vegetal é baixa', 'Converter DN em reflectância', 'Aumentar a resolução espacial'], a: 1, e: 'Huete (1988) propôs L para diminuir o efeito do brilho do solo no índice em áreas com pouca cobertura.' },
    { p: 'A zona de menor NDRE sofreu déficit hídrico. Qual conclusão é mais defensável?', o: ['Aplicar a maior dose de N nela', 'Aplicar a menor dose de N nela', 'Investigar a causa em campo antes de decidir a dose', 'Ignorar a zona'], a: 2, e: 'O índice mostra a diferença, não a causa. Se o limitante é água, mais N não resolve. A prescrição depende do diagnóstico.' },
  ],
  desafios: [
    { nivel: 'aquecimento', txt: <>Monte uma tabela com os valores de NDVI e NDRE esperados para solo, palha, planta vigorosa e planta estressada usando as curvas de referência do Lab 4.1.</> },
    { nivel: 'mão na massa', txt: <>No Earth Engine, extraia a série temporal de NDVI de um talhão da região na última safra de soja. Identifique no gráfico a emergência, o fechamento do dossel e a senescência.</> },
    { nivel: 'investigação', txt: <>Delineie zonas com k = 2 a 6 no mesmo talhão e calcule a redução de variância dentro das zonas para cada k. A partir de qual k o ganho deixa de compensar a complexidade operacional?</> },
  ],
  leitura: [
    <>JENSEN, J. R. <i>Sensoriamento remoto do ambiente: uma perspectiva em recursos terrestres</i>. São José dos Campos: Parêntese, 2009. Capítulo sobre sensoriamento remoto da vegetação.</>,
    <>MOLIN, J. P.; AMARAL, L. R.; COLAÇO, A. F. <i>Agricultura de precisão</i>. São Paulo: Oficina de Textos, 2015.</>,
    <>ROUSE, J. W. et al. Monitoring vegetation systems in the Great Plains with ERTS. In: <i>Third ERTS Symposium</i>, NASA, 1974.</>,
    <>HUETE, A. R. A soil-adjusted vegetation index (SAVI). <i>Remote Sensing of Environment</i>, v. 25, n. 3, p. 295–309, 1988.</>,
    <>GITELSON, A. A.; KAUFMAN, Y. J.; MERZLYAK, M. N. Use of a green channel in remote sensing of global vegetation from EOS-MODIS. <i>Remote Sensing of Environment</i>, v. 58, n. 3, p. 289–298, 1996.</>,
    <>GONZALEZ, R. C.; WOODS, R. E. <i>Processamento digital de imagens</i>. 3. ed. Pearson, 2010. Cap. 6 (imagens coloridas e em pseudocores).</>,
    <>HOFF, R.; FARIAS, A. R.; DUCATI, J. R.; TONIOLO, G. R. Aplicação de processamento digital de imagens orbitais e SIG para apoio à agricultura de precisão nas culturas da videira e macieira no Rio Grande do Sul. In: <i>Agricultura de precisão: um novo olhar</i>. Embrapa, 2011. p. 273–276.</>,
    <>SOUZA, F. L. P. et al. Machine learning e processamento digital de imagens UAV: uma abordagem para estimar distribuição longitudinal de plantas de soja. <i>Energia na Agricultura</i>, v. 37, n. 3, p. 1–11, 2022.</>,
  ],
}
