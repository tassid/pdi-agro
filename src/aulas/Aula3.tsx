import { secaoLaranjeira } from '../casos/Laranjeira'
import { useMemo, useState } from 'react'
import {
  type Gray, type Mask, type Blob, rgbIndex, normalize, histogram, otsu, threshold, INDEX_RANGE, plane, rdylgn, toGray, opening, fillHoles, label, maskToGray, newRGB, CAT, type RgbIndex,
} from '../lib/img'
import { makeSeeds, type SeedType } from '../lib/synth'
import { ImgCanvas, Slider, Seg, SourcePicker, Lab, Callout, Term, Code, Histogram, rgbStr } from '../ui'
import { field, memo, useSource } from '../samples'
import type { Aula } from '../lesson'

/* ============ Lab 3.1 · segmentação de vegetação ============ */

type Idx = RgbIndex | '−a*'

function indexView(img: ReturnType<typeof useSource>['img'], idx: Idx): { raw: Gray; view: Gray } {
  if (idx === '−a*') {
    const a = plane(img, 'a*')
    const inv = { ...a, data: a.data.map((v) => 255 - v) }
    return { raw: inv, view: inv }
  }
  const raw = rgbIndex(img, idx)
  const [lo, hi] = INDEX_RANGE[idx]
  return { raw, view: normalize(raw, lo, hi) }
}

function SegVegetacao() {
  const src = useSource('lavoura')
  const [idx, setIdx] = useState<Idx>('ExG')
  const [modo, setModo] = useState<'Otsu' | 'manual'>('Otsu')
  const [tMan, setTMan] = useState(120)
  const { view } = useMemo(() => indexView(src.img, idx), [src.img, idx])
  const hist = useMemo(() => histogram(view), [view])
  const tOtsu = useMemo(() => otsu(hist), [hist])
  const t = modo === 'Otsu' ? tOtsu : tMan
  const mask = useMemo(() => threshold(view, t), [view, t])
  const cover = (100 * mask.data.reduce((a, b) => a + b, 0)) / mask.data.length
  const truth = src.name === 'lavoura' ? field(src.seed).classe : null
  let iou: number | null = null
  if (truth) {
    let inter = 0, uni = 0
    for (let i = 0; i < mask.data.length; i++) {
      const g = truth[i] >= 2 ? 1 : 0
      if (g && mask.data[i]) inter++
      if (g || mask.data[i]) uni++
    }
    iou = inter / (uni || 1)
  }
  const tinted = useMemo(() => {
    const o = newRGB(src.img.w, src.img.h)
    for (let i = 0; i < mask.data.length; i++) {
      const m = mask.data[i]
      for (let c = 0; c < 3; c++) o.data[i * 3 + c] = m ? src.img.data[i * 3 + c] * 0.35 + [40, 230, 90][c] * 0.65 : src.img.data[i * 3 + c] * 0.45
    }
    return o
  }, [src.img, mask])
  const [lo, hi] = idx === '−a*' ? [0, 255] : INDEX_RANGE[idx]
  const tReal = lo + (t / 255) * (hi - lo)
  return (
    <Lab n="3.1" title="Separar planta de solo (e de palha)" desc="Escolha um índice de vegetação e um jeito de escolher o limiar. Nas imagens de exemplo, a gente sabe a resposta certa e mede o acerto pelo IoU.">
      <SourcePicker {...src.pickerProps} />
      <div className="controls">
        <Seg value={idx} options={['ExG', 'ExGR', 'VARI', 'GLI', '−a*'] as const} onChange={setIdx} label="índice" />
        <Seg value={modo} options={['Otsu', 'manual'] as const} onChange={setModo} label="limiar" />
        {modo === 'manual' && <Slider id="tman" label="limiar (escala 0–255)" value={tMan} min={0} max={255} onChange={setTMan} />}
      </div>
      <div className="lab-cols">
        <div className="panel">
          <div className="panel-t">
            <span>índice {idx}</span>
            <span>vermelho → verde</span>
          </div>
          <ImgCanvas img={view} lut={(v) => rdylgn(v / 255)} label={`mapa do índice ${idx}`} />
        </div>
        <div className="panel">
          <div className="panel-t">
            <span>máscara sobre a imagem</span>
          </div>
          <ImgCanvas img={tinted} label="máscara de vegetação sobreposta" />
        </div>
      </div>
      <div className="lab-cols">
        <div className="panel">
          <Histogram data={hist} marks={[{ v: t, label: `${modo}: ${tReal.toFixed(2)}` }]} color="var(--leaf)" xlabel={`${idx} reescalado`} />
        </div>
        <div className="stats" style={{ alignContent: 'start' }}>
          <div className="stat">
            <b>{cover.toFixed(1)}%</b>
            <span>cobertura verde</span>
          </div>
          <div className="stat">
            <b>{t}</b>
            <span>limiar (0–255)</span>
          </div>
          {iou !== null && (
            <div className="stat">
              <b style={{ color: iou > 0.8 ? 'var(--ok)' : iou > 0.6 ? 'var(--grain)' : 'var(--bad)' }}>{iou.toFixed(2)}</b>
              <span>IoU vs gabarito</span>
            </div>
          )}
        </div>
      </div>
    </Lab>
  )
}

/* ============ Lab 3.2 · contador de sementes ============ */

type Etapa = 'original' | 'cinza' | 'Otsu' | 'abertura + preencher' | 'rótulos'
type Classe = SeedType | 'grudadas'
const COR: Record<Classe, string> = { inteira: '#6ccf5a', quebrada: '#f2a33a', manchada: '#c86bd6', grudadas: '#5ab0f0' }

function ContadorSementes() {
  const [seed, setSeed] = useState(2)
  const [n, setN] = useState(40)
  const [etapa, setEtapa] = useState<Etapa>('rótulos')
  const [minFrac, setMinFrac] = useState(0.78)
  const [roxo, setRoxo] = useState(0.72)
  const data = memo(`seeds-${seed}-${n}`, () => makeSeeds(360, 240, seed, { n, encostadas: 3 }))
  const gray = useMemo(() => toGray(data.rgb), [data])
  const t = useMemo(() => otsu(histogram(gray)), [gray])
  const bin = useMemo(() => threshold(gray, t), [gray, t])
  const opened: Mask = useMemo(() => fillHoles(opening(bin, 'disco', 1)), [bin])
  const { labels, blobs } = useMemo(() => label(opened, data.rgb), [opened, data])
  const valid = blobs.filter((b) => b.area > 25)
  const med = useMemo(() => {
    const a = valid.map((b) => b.area).sort((x, y) => x - y)
    return a[Math.floor(a.length / 2)] || 1
  }, [valid])
  const classify = (b: Blob): { c: Classe; n: number } => {
    const idxRoxo = b.cor[2] / Math.max(1, b.cor[1])
    if (b.area > 1.6 * med) return { c: 'grudadas', n: Math.round(b.area / med) }
    if (idxRoxo > roxo) return { c: 'manchada', n: 1 }
    if (b.area < minFrac * med) return { c: 'quebrada', n: 1 }
    return { c: 'inteira', n: 1 }
  }
  const cls = valid.map((b) => ({ b, ...classify(b) }))
  const count = { inteira: 0, quebrada: 0, manchada: 0, grudadas: 0 } as Record<Classe, number>
  let total = 0
  cls.forEach((c) => {
    count[c.c] += c.c === 'grudadas' ? c.n : 1
    total += c.n
  })
  const truth = { inteira: 0, quebrada: 0, manchada: 0 } as Record<SeedType, number>
  data.verdade.forEach((s) => truth[s.tipo]++)
  const stageImg = useMemo(() => {
    if (etapa === 'original') return data.rgb
    if (etapa === 'cinza') return gray
    if (etapa === 'Otsu') return maskToGray(bin)
    if (etapa === 'abertura + preencher') return maskToGray(opened)
    const o = newRGB(data.rgb.w, data.rgb.h)
    for (let i = 0; i < labels.length; i++) {
      const l = labels[i]
      const c = l ? CAT[l % CAT.length] : [24, 28, 34]
      for (let k = 0; k < 3; k++) o.data[i * 3 + k] = c[k]
    }
    return o
  }, [etapa, data, gray, bin, opened, labels])
  const overlay = useMemo(
    () => (ctx: CanvasRenderingContext2D, s: number) => {
      if (etapa !== 'original' && etapa !== 'rótulos') return
      ctx.lineWidth = 2
      ctx.font = `600 ${9 * (s / 2)}px JetBrains Mono, monospace`
      cls.forEach(({ b, c, n: k }) => {
        ctx.strokeStyle = COR[c]
        ctx.strokeRect(b.x0 * s - 2, b.y0 * s - 2, (b.x1 - b.x0 + 1) * s + 4, (b.y1 - b.y0 + 1) * s + 4)
        if (c === 'grudadas') {
          ctx.fillStyle = COR[c]
          ctx.fillText(`×${k}`, b.x1 * s + 4, b.y0 * s + 8)
        }
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [etapa, cls.map((c) => c.c + c.b.id).join()],
  )
  return (
    <Lab
      n="3.2"
      title="Contador de sementes de soja"
      desc="Uma bandeja com sementes inteiras, quebradas e com mancha púrpura. Veja cada etapa do pipeline e ajuste as regras de decisão. O gabarito aparece embaixo para você conferir."
    >
      <div className="controls">
        <Seg value={etapa} options={['original', 'cinza', 'Otsu', 'abertura + preencher', 'rótulos'] as const} onChange={setEtapa} label="etapa do pipeline" />
        <Slider id="nsem" label="sementes na bandeja" value={n} min={15} max={60} step={5} onChange={setN} />
        <button type="button" className="btn ghost" onClick={() => setSeed((s) => s + 1)}>
          Nova bandeja
        </button>
      </div>
      <div className="lab-cols two">
        <div className="panel">
          <div className="panel-t">
            <span>{etapa}</span>
            <span>{etapa === 'Otsu' ? `limiar = ${t}` : `${valid.length} objetos`}</span>
          </div>
          <ImgCanvas img={stageImg} overlay={overlay} label={`etapa ${etapa}`} />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontFamily: 'var(--f-mono)', fontSize: '0.74rem' }}>
            {(Object.keys(COR) as Classe[]).map((k) => (
              <span key={k} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <i style={{ width: 12, height: 12, border: `2px solid ${COR[k]}`, borderRadius: 2, display: 'inline-block' }} /> {k}
              </span>
            ))}
          </div>
        </div>
        <div className="panel" style={{ gap: 12 }}>
          <div className="controls">
            <Slider id="minf" label="quebrada se área < x·mediana" value={minFrac} min={0.4} max={0.95} step={0.01} onChange={setMinFrac} fmt={(v) => v.toFixed(2)} />
            <Slider id="roxo" label="manchada se B/G >" value={roxo} min={0.55} max={1.0} step={0.01} onChange={setRoxo} fmt={(v) => v.toFixed(2)} />
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>classe</th>
                  <th>pipeline</th>
                  <th>gabarito</th>
                </tr>
              </thead>
              <tbody>
                {(['inteira', 'quebrada', 'manchada'] as SeedType[]).map((k) => (
                  <tr key={k}>
                    <td>
                      <i style={{ display: 'inline-block', width: 9, height: 9, background: COR[k], borderRadius: 2, marginRight: 6 }} />
                      {k}
                    </td>
                    <td>{count[k]}</td>
                    <td>{truth[k]}</td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <i style={{ display: 'inline-block', width: 9, height: 9, background: COR.grudadas, borderRadius: 2, marginRight: 6 }} />
                    grudadas (estimadas pela área)
                  </td>
                  <td>{count.grudadas}</td>
                  <td>·</td>
                </tr>
                <tr>
                  <td>
                    <b>total</b>
                  </td>
                  <td>
                    <b>{total}</b>
                  </td>
                  <td>
                    <b>{data.verdade.length}</b>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="note">Área mediana de uma semente: {med} px. Objetos com mais de 1,6× essa área são tratados como sementes encostadas, e o número estimado é área ÷ mediana.</p>
        </div>
      </div>
      <details>
        <summary style={{ cursor: 'pointer', fontFamily: 'var(--f-display)', fontWeight: 600 }}>Ver a tabela de descritores de cada objeto</summary>
        <div className="tbl-wrap" style={{ maxHeight: 280, overflowY: 'auto', marginTop: 8 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>id</th>
                <th>área (px)</th>
                <th>perímetro</th>
                <th>circularidade</th>
                <th>alongamento</th>
                <th>B/G</th>
                <th>cor média</th>
                <th>classe</th>
              </tr>
            </thead>
            <tbody>
              {cls.map(({ b, c }) => (
                <tr key={b.id}>
                  <td>{b.id}</td>
                  <td>{b.area}</td>
                  <td>{b.perimetro.toFixed(1)}</td>
                  <td>{b.circularidade.toFixed(2)}</td>
                  <td>{b.alongamento.toFixed(2)}</td>
                  <td>{(b.cor[2] / Math.max(1, b.cor[1])).toFixed(2)}</td>
                  <td>
                    <i style={{ display: 'inline-block', width: 22, height: 12, background: rgbStr(b.cor), borderRadius: 2 }} />
                  </td>
                  <td style={{ color: COR[c] }}>{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Lab>
  )
}

/* ============ conteúdo ============ */

const CODE_3 = `# Aula 3 · segmentação, rotulação e descritores
import numpy as np, pandas as pd
import matplotlib.pyplot as plt
from skimage import io, color, filters, measure, morphology, segmentation
from scipy import ndimage as ndi

# --- parte 1: cobertura verde com ExG + Otsu (Woebbecke et al., 1995) ---
img = io.imread("lavoura.jpg")[..., :3].astype(float)
soma = img.sum(axis=2) + 1e-6
r, g, b = (img[..., i] / soma for i in range(3))     # coordenadas cromáticas
exg = 2 * g - r - b
t = filters.threshold_otsu(exg)
planta = exg > t
print(f"cobertura verde: {100 * planta.mean():.1f}%  (limiar Otsu = {t:.3f})")

# --- parte 2: contar e descrever sementes numa bandeja escura ---
sem = io.imread("sementes.jpg")[..., :3]
cinza = color.rgb2gray(sem)
bin_ = cinza > filters.threshold_otsu(cinza)
bin_ = morphology.binary_opening(bin_, morphology.disk(1))
bin_ = morphology.remove_small_objects(bin_, min_size=25)
rot = measure.label(bin_, connectivity=2)            # 8-vizinhança

props = measure.regionprops_table(rot, intensity_image=sem,
          properties=["label", "area", "perimeter", "eccentricity", "intensity_mean"])
df = pd.DataFrame(props)
df["circularidade"] = 4 * np.pi * df.area / df.perimeter**2
df["B_sobre_G"] = df["intensity_mean-2"] / df["intensity_mean-1"]
mediana = df.area.median()
df["n_estimado"] = np.maximum(1, np.round(df.area / mediana)).astype(int)
print(df.round(2).head(10))
print("total estimado de sementes:", df.n_estimado.sum())

# --- desafio: separar sementes encostadas com distância + watershed ---
dist = ndi.distance_transform_edt(bin_)
picos = morphology.h_maxima(dist, 2)
marcadores = measure.label(picos)
separadas = segmentation.watershed(-dist, marcadores, mask=bin_)
print("depois do watershed:", separadas.max(), "objetos")`

export const aula3: Aula = {
  id: 'aula3',
  n: 3,
  trilha: 'grad',
  titulo: 'Segmentar, rotular, medir',
  ideia: 'Segmentar é decidir o que é objeto. Rotular é dar um número a cada objeto. Descrever é transformar cada objeto numa linha de tabela. Depois disso, é planilha.',
  ementa: ['Segmentação por limiar', 'Otsu', 'Índices de vegetação', 'Componentes conexos', 'Representação e descrição'],
  labs: ['Planta × solo × palha', 'Contador de sementes', 'Caso real: laranjeira', 'Mapa do pomar'],
  cor: ['#e0bd4f', '#c86bd6', '#6ccf5a', '#9a4a2c'],
  objetivos: [
    'Segmentar vegetação com índices de cor (ExG, ExGR, VARI) e limiar de Otsu, e medir o acerto com IoU.',
    'Explicar o critério de Otsu em termos de variância entre classes.',
    'Rotular componentes conexos e distinguir 4 e 8-vizinhança.',
    'Calcular descritores de região (área, perímetro, circularidade, alongamento, cor média) e usá-los em regras de decisão.',
    'Medir severidade de doença foliar pelo método de um TCC da UTFPR Medianeira e interpolar os pontos num mapa (IDP).',
  ],
  roteiro: [
    { t: 'Gancho: 400 sementes na mão', min: 4, tipo: 'gancho' },
    { t: 'Limiarização e Otsu', min: 7, tipo: 'conceito' },
    { t: 'Lab 3.1', min: 9, tipo: 'lab' },
    { t: 'Rotulação e descritores', min: 7, tipo: 'conceito' },
    { t: 'Lab 3.2', min: 13, tipo: 'lab' },
    { t: 'Caso real: laranjeira + Labs 3.3 e 3.4', min: 13, tipo: 'lab' },
    { t: 'Fechamento + quiz', min: 7, tipo: 'fecho' },
  ],
  secoes: [
    {
      id: 'a3-gancho',
      titulo: '400 sementes na mão',
      min: 4,
      body: (
        <div className="prose">
          <p>
            Nas Regras para Análise de Sementes do Ministério da Agricultura, o teste de germinação usa 400 sementes, em quatro repetições de 100. Em muito laboratório, alguém ainda conta e separa na
            pinça as quebradas e as manchadas. Hoje vamos montar um contador automático do zero, usando só o que aprendemos até agora e mais três ideias novas.
          </p>
          <Callout kind="prof">
            <p>
              Leve um punhado de feijão ou soja e uma cartolina preta. No fim da aula, fotografe a bandeja com o celular de um aluno e passe a foto pelo pipeline do Colab. Ver funcionar com semente de verdade
              é o que fixa.
            </p>
          </Callout>
        </div>
      ),
    },
    {
      id: 'a3-limiar',
      titulo: 'Limiarização e o critério de Otsu',
      min: 16,
      body: (
        <div className="prose">
          <p>
            A segmentação mais simples é um corte: pixels acima do limiar <code>T</code> são objeto, abaixo são fundo. A questão toda é <b>qual canal</b> cortar e <b>onde</b> cortar.
          </p>
          <h3>Qual canal: índices de vegetação em RGB</h3>
          <p>
            Para planta verde, o canal G sozinho engana (solo claro e palha também têm G alto). Os índices normalizam a cor pela soma dos canais, usando as coordenadas cromáticas{' '}
            <code>r = R/(R+G+B)</code>, <code>g</code> e <code>b</code>, e comparam o verde com os outros:
          </p>
          <div className="formula">
            ExG = 2g − r − b &nbsp;&nbsp;(Woebbecke et al., 1995)
            <br />
            ExGR = ExG − (1,4r − g) &nbsp;&nbsp;(Meyer; Neto, 2008)
            <br />
            VARI = (G − R) / (G + R − B) &nbsp;&nbsp;(Gitelson et al., 2002)
          </div>
          <h3>Onde cortar: Otsu</h3>
          <p>
            O método de Otsu (1979) testa todos os limiares possíveis e escolhe o que deixa as duas classes <b>mais diferentes entre si</b>, ou seja, o que maximiza a{' '}
            <Term def="σ²_B(T) = w₀(T)·w₁(T)·[μ₀(T) − μ₁(T)]². w são as proporções de pixels de cada lado do corte e μ as médias. Maximizar isso equivale a minimizar a variância dentro de cada classe.">
              variância entre classes
            </Term>
            . Funciona muito bem quando o histograma tem dois morros. Quando tem um morro só (quase tudo solo, ou dossel fechado), Otsu corta no lugar errado.
          </p>
          <Callout kind="analogia">
            <p>
              É como dividir uma turma em dois times pela altura: você procura o ponto de corte em que os dois times ficam mais diferentes entre si e mais parecidos por dentro.
            </p>
          </Callout>
          <SegVegetacao />
          <Callout kind="campo">
            <p>
              Cobertura verde medida por foto é usada para acompanhar estabelecimento de lavoura, comparar cultivares e estimar a fração de solo exposto. Palha de plantio direto é o grande vilão: é clara,
              tem textura parecida e engana o canal G. Compare ExG e ExGR nas imagens de exemplo e repare quem confunde mais palha com planta.
            </p>
          </Callout>
        </div>
      ),
    },
    {
      id: 'a3-rotulos',
      titulo: 'Rotulação e descritores',
      min: 20,
      body: (
        <div className="prose">
          <p>
            A máscara binária diz "aqui tem semente", mas não diz <b>quantas</b>. A rotulação de componentes conexos percorre a máscara e dá o mesmo número para pixels brancos que se tocam. O detalhe é o
            que conta como "tocar":
          </p>
          <ul>
            <li>
              <b>4-vizinhança</b>: só cima, baixo, esquerda e direita.
            </li>
            <li>
              <b>8-vizinhança</b>: inclui as diagonais. Dois pixels que se encostam só pela quina são um objeto só.
            </li>
          </ul>
          <p>Com cada objeto rotulado, viramos a imagem numa tabela. Cada linha é um objeto e cada coluna é um descritor (Gonzalez e Woods, cap. 11):</p>
          <ul>
            <li>
              <b>Área</b>: número de pixels.
            </li>
            <li>
              <b>Perímetro</b>: comprimento da borda.
            </li>
            <li>
              <b>Circularidade</b> = 4π·área / perímetro². Vale 1 para o círculo perfeito e cai para formas recortadas.
            </li>
            <li>
              <b>Alongamento</b>: razão entre o eixo maior e o menor da elipse equivalente (dos momentos de segunda ordem).
            </li>
            <li>
              <b>Cor média</b> dentro do objeto: aqui usamos B/G para achar a mancha púrpura.
            </li>
          </ul>
          <ContadorSementes />
          <Callout kind="pegadinha">
            <p>
              Sementes encostadas viram um objeto só, e a contagem erra para baixo. O truque de dividir a área pela área mediana resolve boa parte dos casos. A solução "de livro" é a transformada de
              distância seguida de watershed, que está no código abaixo como desafio.
            </p>
          </Callout>
          <Callout kind="campo">
            <p>
              A mancha púrpura da semente de soja é causada pelo fungo <i>Cercospora kikuchii</i>. Semente descolorida é critério de classificação de lote, e o mesmo pipeline serve para grãos de milho
              ardidos, feijão carunchado ou café com defeito. Muda a regra de cor, a lógica é igual.
            </p>
          </Callout>
        </div>
      ),
    },
    secaoLaranjeira,
    {
      id: 'a3-fecho',
      titulo: 'Pra levar pra casa',
      min: 7,
      body: (
        <div className="prose">
          <ol>
            <li>Segmentar bem é escolher o canal certo (índice de vegetação, a*, H) e o limiar certo (Otsu, quando o histograma é bimodal).</li>
            <li>Rotulação transforma a máscara em objetos. A vizinhança (4 ou 8) muda a contagem.</li>
            <li>Descritores transformam objetos em linhas de tabela. A partir daí, classificar é escrever regras, ou treinar um classificador, que é o assunto do mestrado.</li>
          </ol>
          <Code code={CODE_3} />
        </div>
      ),
    },
  ],
  quiz: [
    { p: 'O método de Otsu escolhe o limiar que:', o: ['Fica na média do histograma', 'Maximiza a variância entre as duas classes', 'Deixa 50% dos pixels de cada lado', 'Minimiza o número de objetos'], a: 1, e: 'Otsu maximiza σ²_B = w₀w₁(μ₀ − μ₁)², o que equivale a minimizar a variância dentro de cada classe.' },
    { p: 'Na fórmula ExG = 2g − r − b, o que são r, g e b?', o: ['Valores brutos de 0 a 255', 'Coordenadas cromáticas: cada canal dividido pela soma R+G+B', 'Canais do HSV', 'Canais do L*a*b*'], a: 1, e: 'Normalizar pela soma reduz o efeito do brilho: um pixel sombreado e um iluminado da mesma folha ficam parecidos.' },
    { p: 'Dois pixels brancos se tocam só pela diagonal. Com 8-vizinhança, eles são:', o: ['Dois objetos', 'O mesmo objeto', 'Depende do limiar', 'Fundo'], a: 1, e: 'A 8-vizinhança inclui as diagonais, então eles recebem o mesmo rótulo. Na 4-vizinhança seriam dois objetos.' },
    { p: 'A circularidade 4πA/P² de um círculo perfeito vale:', o: ['0', 'π', '1', '4'], a: 2, e: 'Para o círculo, A = πr² e P = 2πr, então 4π·πr²/(4π²r²) = 1. Semente quebrada tem circularidade menor.' },
    { p: 'Duas sementes encostadas viraram um objeto só. Qual técnica clássica separa as duas?', o: ['Equalização de histograma', 'Transformada de distância + watershed', 'Filtro da mediana', 'Conversão para HSV'], a: 1, e: 'A distância até o fundo tem dois picos (um por semente). O watershed "inunda" a partir desses picos e traça a divisa no vale entre eles.' },
  ],
  desafios: [
    { nivel: 'aquecimento', txt: <>Implemente Otsu em NumPy a partir do histograma (sem <code>threshold_otsu</code>) e confira se o limiar bate com o do scikit-image.</> },
    { nivel: 'mão na massa', txt: <>Rode o pipeline de sementes numa foto real (feijão ou soja em cartolina preta). Conte à mão e calcule o erro percentual da contagem com e sem a correção pela área mediana.</> },
    { nivel: 'investigação', txt: <>Adicione o watershed ao pipeline e compare três contagens (rótulos, área mediana e watershed) em bandejas com 20, 40 e 60 sementes. Em que densidade cada método começa a falhar?</> },
  ],
  leitura: [
    <>GONZALEZ, R. C.; WOODS, R. E. <i>Processamento digital de imagens</i>. 3. ed. Pearson, 2010. Cap. 10 (segmentação: limiarização, Otsu, watershed) e cap. 11 (representação e descrição).</>,
    <>PEDRINI, H.; SCHWARTZ, W. R. <i>Análise de imagens digitais</i>. Thomson, 2008. Capítulos de segmentação e de representação e descrição.</>,
    <>OTSU, N. A threshold selection method from gray-level histograms. <i>IEEE Transactions on Systems, Man, and Cybernetics</i>, v. 9, n. 1, p. 62–66, 1979.</>,
    <>WOEBBECKE, D. M. et al. Color indices for weed identification under various soil, residue, and lighting conditions. <i>Transactions of the ASAE</i>, v. 38, n. 1, p. 259–269, 1995.</>,
    <>MEYER, G. E.; NETO, J. C. Verification of color vegetation indices for automated crop imaging applications. <i>Computers and Electronics in Agriculture</i>, v. 63, n. 2, p. 282–293, 2008.</>,
    <>SCHENATTO, K. <i>Geoprocessamento aplicado à agricultura visando o mapeamento de doenças em folhas de laranjeiras por meio de técnicas de processamento digital de imagens</i>. Trabalho de Diplomação (Tecnologia em Análise e Desenvolvimento de Sistemas), UTFPR, Medianeira, 2011.</>,
  ],
}
