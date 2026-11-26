import { LabCitros, CalcConfusao, casoCitros, codeCitros } from '../casos/Citros'
import { useMemo, useState } from 'react'
import { FEATURES, CLASSES_ML, FAZENDAS, makeDataset, train, crossValidate, type FeatureId, type Clf, type Sample, type CVResult } from '../lib/ml'
import { CAT } from '../lib/img'
import { ImgCanvas, Slider, Seg, Lab, Callout, Term, Code, Legend, rgbStr } from '../ui'
import { memo } from '../samples'
import type { Aula } from '../lesson'

const CLS_COR = ['#3f9a3a', '#c8702a', '#d6b32a']
const FAZ_COR = CAT.slice(0, 4).map(rgbStr)
const fname = (id: FeatureId) => FEATURES.find((f) => f.id === id)!.nome
const FEAT_IDS = FEATURES.map((f) => f.id) as FeatureId[]

const dataset = (efeito: number) => memo(`ds-${efeito}`, () => makeDataset(5, 8, 3, efeito))

/* ---------- dispersão com regiões de decisão ---------- */

function Scatter(p: {
  data: Sample[]
  fx: FeatureId
  fy: FeatureId
  colorBy: 'classe' | 'fazenda'
  regions?: (x: number[]) => number
}) {
  const W = 360, H = 270, L = 40, B = 30, T = 8, R = 8
  const xs = p.data.map((s) => s.f[p.fx]), ys = p.data.map((s) => s.f[p.fy])
  const pad = (a: number[]) => {
    const lo = Math.min(...a), hi = Math.max(...a), d = (hi - lo) * 0.06 || 1
    return [lo - d, hi + d]
  }
  const [x0, x1] = pad(xs), [y0, y1] = pad(ys)
  const sx = (v: number) => L + ((v - x0) / (x1 - x0)) * (W - L - R)
  const sy = (v: number) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B)
  const cells = useMemo(() => {
    if (!p.regions) return []
    const n = 46, out: { x: number; y: number; c: number }[] = []
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const vx = x0 + ((i + 0.5) / n) * (x1 - x0), vy = y0 + ((j + 0.5) / n) * (y1 - y0)
        out.push({ x: i, y: j, c: p.regions([vx, vy]) })
      }
    return out
  }, [p.regions, x0, x1, y0, y1])
  const cw = (W - L - R) / 46, ch = (H - T - B) / 46
  const shape = (s: Sample, cx: number, cy: number, fill: string) => {
    const f = s.fazenda
    if (f === 0) return <circle cx={cx} cy={cy} r={3.4} fill={fill} />
    if (f === 1) return <rect x={cx - 3} y={cy - 3} width={6} height={6} fill={fill} />
    if (f === 2) return <path d={`M${cx},${cy - 4}L${cx + 4},${cy + 3}L${cx - 4},${cy + 3}Z`} fill={fill} />
    return <path d={`M${cx},${cy - 4}L${cx + 4},${cy}L${cx},${cy + 4}L${cx - 4},${cy}Z`} fill={fill} />
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="espaço de características" style={{ display: 'block', background: 'var(--surface-2)', borderRadius: 8 }}>
      {cells.map((c, i) => (
        <rect key={i} x={L + c.x * cw} y={H - B - (c.y + 1) * ch} width={cw + 0.5} height={ch + 0.5} fill={CLS_COR[c.c]} opacity={0.22} />
      ))}
      <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="var(--ink-faint)" />
      <line x1={L} x2={L} y1={T} y2={H - B} stroke="var(--ink-faint)" />
      {[x0, (x0 + x1) / 2, x1].map((v, i) => (
        <text key={i} x={sx(v)} y={H - B + 12} fontSize={9} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} fill="var(--ink-faint)" fontFamily="var(--f-mono)">
          {v.toFixed(v > 10 ? 0 : 2)}
        </text>
      ))}
      {[y0, (y0 + y1) / 2, y1].map((v, i) => (
        <text key={i} x={L - 4} y={sy(v) + 3} fontSize={9} textAnchor="end" fill="var(--ink-faint)" fontFamily="var(--f-mono)">
          {v.toFixed(v > 10 ? 0 : 2)}
        </text>
      ))}
      <text x={(W + L) / 2} y={H - 4} fontSize={10} textAnchor="middle" fill="var(--ink-soft)" fontFamily="var(--f-mono)">{fname(p.fx)}</text>
      {p.data.map((s, i) => (
        <g key={i} opacity={0.9}>
          {shape(s, sx(s.f[p.fx]), sy(s.f[p.fy]), p.colorBy === 'classe' ? CLS_COR[s.y] : FAZ_COR[s.fazenda])}
        </g>
      ))}
    </svg>
  )
}

function FeaturePick(p: { fx: FeatureId; fy: FeatureId; setFx: (v: FeatureId) => void; setFy: (v: FeatureId) => void; idp: string }) {
  return (
    <div className="controls">
      <div className="ctl">
        <label htmlFor={`${p.idp}x`}>eixo x</label>
        <select id={`${p.idp}x`} value={p.fx} onChange={(e) => p.setFx(e.target.value as FeatureId)} style={sel}>
          {FEATURES.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </select>
      </div>
      <div className="ctl">
        <label htmlFor={`${p.idp}y`}>eixo y</label>
        <select id={`${p.idp}y`} value={p.fy} onChange={(e) => p.setFy(e.target.value as FeatureId)} style={sel}>
          {FEATURES.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
const sel = { fontFamily: 'var(--f-mono)', fontSize: '0.84rem', padding: '6px 8px', borderRadius: 8, border: '1px solid var(--rule)', background: 'var(--bg)', color: 'var(--ink)' }

const FARM_LEGEND = FAZENDAS.map((f, i) => ({ name: `${['●', '■', '▲', '◆'][i]} ${f.nome}`, color: FAZ_COR[i] }))
const CLS_LEGEND = CLASSES_ML.map((c, i) => ({ name: c, color: CLS_COR[i] }))

/* ============ Lab 5.1 ============ */

function EspacoCaracteristicas() {
  const data = dataset(1)
  const [fx, setFx] = useState<FeatureId>('matiz')
  const [fy, setFy] = useState<FeatureId>('lesao')
  const [colorBy, setColorBy] = useState<'classe' | 'fazenda'>('classe')
  const thumbs = useMemo(() => CLASSES_ML.map((_, c) => [0, 1, 2, 3].map((f) => data.find((s) => s.y === c && s.fazenda === f)!)), [data])
  return (
    <Lab n="5.1" title="Cada folha vira um ponto" desc="288 recortes de folha de soja: 3 classes, 4 fazendas, 8 folhas por classe em cada fazenda e 3 fotos de cada folha. Cada recorte vira um vetor de 6 descritores. Escolha dois para ver o espaço de características.">
      <div className="lab-cols two">
        <div className="panel">
          <div className="panel-t">
            <span>um exemplo de cada classe em cada fazenda</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '84px repeat(4, 1fr)', gap: 6, alignItems: 'center' }}>
            <span />
            {FAZENDAS.map((f, i) => (
              <span key={i} style={{ fontFamily: 'var(--f-mono)', fontSize: '0.68rem', color: 'var(--ink-soft)', textAlign: 'center' }}>
                {f.nome.split(' (')[0]}
              </span>
            ))}
            {thumbs.map((row, c) => (
              <div key={c} style={{ display: 'contents' }}>
                <span style={{ fontFamily: 'var(--f-mono)', fontSize: '0.74rem', color: CLS_COR[c] }}>{CLASSES_ML[c]}</span>
                {row.map((s, f) => (
                  <ImgCanvas key={f} img={s.img} scale={3} pixelated label={`${CLASSES_ML[c]} na ${FAZENDAS[f].nome}`} />
                ))}
              </div>
            ))}
          </div>
          <p className="note">Repare na mesma classe mudando de cor entre as fazendas: câmera, horário e céu diferentes. Guarde isso para o Lab 5.3.</p>
        </div>
        <div className="panel">
          <FeaturePick fx={fx} fy={fy} setFx={setFx} setFy={setFy} idp="f51" />
          <Seg value={colorBy} options={['classe', 'fazenda'] as const} onChange={setColorBy} label="colorir por" />
          <Scatter data={data} fx={fx} fy={fy} colorBy={colorBy} />
          <Legend items={colorBy === 'classe' ? CLS_LEGEND : FARM_LEGEND} />
          <p className="note">Eixo y: {fname(fy)}.</p>
        </div>
      </div>
    </Lab>
  )
}

/* ============ Lab 5.2 ============ */

function ConfMatrix({ r }: { r: CVResult }) {
  const n = r.conf.length
  const mx = Math.max(...r.conf.flat())
  const rows = r.conf.map((row, i) => {
    const tp = row[i], fn = row.reduce((a, b) => a + b, 0) - tp, fp = r.conf.reduce((s, rr) => s + rr[i], 0) - tp
    const prec = tp / (tp + fp || 1), rec = tp / (tp + fn || 1)
    return { prec, rec, f1: (2 * prec * rec) / (prec + rec || 1) }
  })
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="conf" style={{ gridTemplateColumns: `90px repeat(${n}, 1fr)` }}>
        <div />
        {CLASSES_ML.map((c) => (
          <div key={c} style={{ fontSize: '0.68rem', color: 'var(--ink-soft)' }}>
            prev. {c}
          </div>
        ))}
        {r.conf.map((row, i) => (
          <div key={i} style={{ display: 'contents' }}>
            <div style={{ textAlign: 'left', fontSize: '0.7rem', color: CLS_COR[i] }}>real {CLASSES_ML[i]}</div>
            {row.map((v, j) => (
              <div key={j} style={{ background: i === j ? `color-mix(in srgb, var(--ok) ${(v / mx) * 70}%, var(--surface-2))` : v ? `color-mix(in srgb, var(--bad) ${Math.min(70, (v / mx) * 140)}%, var(--surface-2))` : 'var(--surface-2)' }}>
                {v}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>classe</th>
              <th>precisão</th>
              <th>revocação</th>
              <th>F1</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => (
              <tr key={i}>
                <td style={{ color: CLS_COR[i] }}>{CLASSES_ML[i]}</td>
                <td>{m.prec.toFixed(2)}</td>
                <td>{m.rec.toFixed(2)}</td>
                <td>{m.f1.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Classificadores() {
  const data = dataset(1)
  const [fx, setFx] = useState<FeatureId>('lesao')
  const [fy, setFy] = useState<FeatureId>('desvio')
  const [clf, setClf] = useState<Clf>('k-NN')
  const [k, setK] = useState(5)
  const model = useMemo(() => train(clf, data.map((s) => [s.f[fx], s.f[fy]]), data.map((s) => s.y), 3, k), [data, fx, fy, clf, k])
  const cv = useMemo(() => crossValidate(data, [fx, fy], clf, 3, 'aleatória', k), [data, fx, fy, clf, k])
  const nota: Record<Clf, string> = {
    'k-NN': 'Olha os k vizinhos mais próximos e faz votação. Com k = 1, a fronteira contorna cada ponto e decora o treino. Aumente o k e veja a fronteira alisar.',
    'Mínima distância': 'Calcula o centróide de cada classe e atribui ao mais próximo. A fronteira é sempre reta (a mediatriz entre centróides). Rápido e robusto, mas ingênuo.',
    'Naive Bayes': 'Modela cada descritor como uma gaussiana por classe, supondo independência entre eles. A fronteira pode ser curva porque cada classe tem sua própria variância.',
  }
  return (
    <Lab n="5.2" title="Três classificadores, três fronteiras" desc="As cores de fundo mostram a classe que o modelo daria para cada ponto do plano. A acurácia é de validação cruzada com 4 dobras aleatórias.">
      <FeaturePick fx={fx} fy={fy} setFx={setFx} setFy={setFy} idp="f52" />
      <div className="controls">
        <Seg value={clf} options={['k-NN', 'Mínima distância', 'Naive Bayes'] as const} onChange={setClf} label="classificador" />
        {clf === 'k-NN' && <Slider id="knn" label="k vizinhos" value={k} min={1} max={25} step={2} onChange={setK} />}
      </div>
      <div className="lab-cols two">
        <div className="panel">
          <Scatter data={data} fx={fx} fy={fy} colorBy="classe" regions={model} />
          <Legend items={CLS_LEGEND} />
          <p className="note">{nota[clf]}</p>
        </div>
        <div className="panel">
          <div className="stats">
            <div className="stat">
              <b>{(cv.acc * 100).toFixed(1)}%</b>
              <span>acurácia (CV aleatória)</span>
            </div>
          </div>
          <ConfMatrix r={cv} />
        </div>
      </div>
    </Lab>
  )
}

/* ============ Lab 5.3 ============ */

function Vazamento() {
  const [efeito, setEfeito] = useState(1)
  const [clf, setClf] = useState<Clf>('k-NN')
  const [feats, setFeats] = useState<'todas as 6' | 'matiz + % marrom'>('todas as 6')
  const data = dataset(efeito)
  const F: FeatureId[] = feats === 'todas as 6' ? FEAT_IDS : ['matiz', 'lesao']
  const rand = useMemo(() => crossValidate(data, F, clf, 3, 'aleatória', 3), [data, F.join(), clf])
  const lofo = useMemo(() => crossValidate(data, F, clf, 3, 'por fazenda', 3), [data, F.join(), clf])
  const drop = rand.acc - lofo.acc
  return (
    <Lab n="5.3" title="Validação honesta: a fazenda que o modelo nunca viu" desc="Mesma base, mesmo classificador, duas formas de validar. Na aleatória, fotos da mesma folha e da mesma fazenda caem no treino e no teste. Na leave-one-farm-out, cada fazenda é testada por um modelo que nunca a viu.">
      <div className="controls">
        <Slider id="efeito" label="efeito fazenda (câmera, luz)" value={efeito} min={0} max={1.5} step={0.25} onChange={setEfeito} fmt={(v) => `${v.toFixed(2)}×`} />
        <Seg value={clf} options={['k-NN', 'Mínima distância', 'Naive Bayes'] as const} onChange={setClf} label="classificador" />
        <Seg value={feats} options={['todas as 6', 'matiz + % marrom'] as const} onChange={setFeats} label="descritores" />
      </div>
      <div className="lab-cols two">
        <div className="panel">
          <div className="stats">
            <div className="stat">
              <b>{(rand.acc * 100).toFixed(1)}%</b>
              <span>CV aleatória (4 dobras)</span>
            </div>
            <div className="stat">
              <b>{(lofo.acc * 100).toFixed(1)}%</b>
              <span>deixa uma fazenda de fora</span>
            </div>
            <div className="stat">
              <b style={{ color: drop > 0.08 ? 'var(--bad)' : drop > 0.03 ? 'var(--grain)' : 'var(--ok)' }}>
                {drop >= 0 ? '−' : '+'}
                {(Math.abs(drop) * 100).toFixed(1)} p.p.
              </b>
              <span>otimismo da CV aleatória</span>
            </div>
          </div>
          <svg viewBox="0 0 340 150" width="100%" role="img" aria-label="acurácia por fazenda" style={{ display: 'block' }}>
            {lofo.porDobra.map((a, i) => {
              const x = 20 + i * 80
              return (
                <g key={i}>
                  <rect x={x} y={120 - a * 100} width={48} height={a * 100} fill={FAZ_COR[i]} opacity={0.85} />
                  <text x={x + 24} y={114 - a * 100} fontSize={10} textAnchor="middle" fill="var(--ink)" fontFamily="var(--f-mono)">
                    {(a * 100).toFixed(0)}%
                  </text>
                  <text x={x + 24} y={134} fontSize={9} textAnchor="middle" fill="var(--ink-soft)" fontFamily="var(--f-mono)">
                    {FAZENDAS[i].nome.split(' (')[0].replace('Fazenda ', 'Faz. ')}
                  </text>
                </g>
              )
            })}
            <line x1={10} x2={335} y1={120 - rand.acc * 100} y2={120 - rand.acc * 100} stroke="var(--ink)" strokeDasharray="4 3" />
            <text x={335} y={116 - rand.acc * 100} fontSize={9} textAnchor="end" fill="var(--ink)" fontFamily="var(--f-mono)">
              CV aleatória
            </text>
            <line x1={10} x2={335} y1={120} y2={120} stroke="var(--rule)" />
          </svg>
          <p className="note">Barras: acurácia em cada fazenda quando ela fica de fora do treino.</p>
        </div>
        <div className="panel">
          <div className="panel-t">
            <span>matriz de confusão · deixa uma fazenda de fora</span>
          </div>
          <ConfMatrix r={lofo} />
        </div>
      </div>
    </Lab>
  )
}

/* ============ conteúdo ============ */

const CODE_5 = `# Aula 5 · descritores + classificadores + validação por grupo
import numpy as np, pandas as pd
from skimage import io, color
from skimage.feature import graycomatrix, graycoprops
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import KNeighborsClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.model_selection import StratifiedKFold, LeaveOneGroupOut, cross_val_predict
from sklearn.metrics import classification_report, confusion_matrix

def descritores(caminho):
    img = io.imread(caminho)[..., :3]
    hsv = color.rgb2hsv(img)
    cinza = (color.rgb2gray(img) * 255).astype(np.uint8) // 16          # 16 níveis
    glcm = graycomatrix(cinza, distances=[1], angles=[0], levels=16, symmetric=True, normed=True)
    marrom = (hsv[..., 0] > 8/360) & (hsv[..., 0] < 42/360) & (hsv[..., 2] < .62) & (hsv[..., 1] > .3)
    return {"matiz": hsv[..., 0].mean(), "sat": hsv[..., 1].mean(), "brilho": hsv[..., 2].mean(),
            "marrom": marrom.mean(), "contraste": graycoprops(glcm, "contrast")[0, 0],
            "desvio": cinza.std()}

# metadados.csv com colunas: arquivo, classe, fazenda, folha
meta = pd.read_csv("metadados.csv")
X = pd.DataFrame([descritores(a) for a in meta.arquivo])
y = meta.classe

for nome, clf in [("k-NN", KNeighborsClassifier(5)), ("Naive Bayes", GaussianNB())]:
    modelo = make_pipeline(StandardScaler(), clf)
    p_aleat = cross_val_predict(modelo, X, y, cv=StratifiedKFold(4, shuffle=True, random_state=0))
    p_grupo = cross_val_predict(modelo, X, y, cv=LeaveOneGroupOut(), groups=meta.fazenda)
    print(nome, "aleatória:", (p_aleat == y).mean().round(3), "| por fazenda:", (p_grupo == y).mean().round(3))

print(classification_report(y, p_grupo))
print(confusion_matrix(y, p_grupo))`

export const aula5: Aula = {
  id: 'aula5',
  n: 5,
  trilha: 'mest',
  titulo: 'Reconhecer padrões sem se enganar',
  ideia: 'Um classificador é tão bom quanto os descritores que recebe e a validação que o avalia. Se a mesma folha está no treino e no teste, o modelo não aprendeu a doença, aprendeu a folha.',
  ementa: ['Representação e descrição', 'Espaço de características', 'k-NN, mínima distância, Bayes', 'Matriz de confusão', 'Validação por grupo'],
  labs: ['Espaço de características', 'Fronteiras de decisão', 'Vazamento por fazenda', 'Caso real: citros', 'Matriz de confusão'],
  cor: ['#3f9a3a', '#c8702a', '#d6b32a', '#2d6a8a'],
  objetivos: [
    'Descrever o pipeline clássico de reconhecimento: aquisição, pré-processamento, segmentação, descrição e classificação.',
    'Extrair descritores de cor e textura (GLCM) e interpretar o espaço de características.',
    'Comparar k-NN, mínima distância e Naive Bayes pelas fronteiras que desenham.',
    'Ler matriz de confusão, precisão, revocação e F1, e escolher uma estratégia de validação que respeite a estrutura dos dados.',
    'Reproduzir uma segmentação treinável de pixels (Random Forest) de um boletim da Embrapa e recalcular suas métricas.',
  ],
  roteiro: [
    { t: 'Gancho: 99% no artigo', min: 5, tipo: 'gancho' },
    { t: 'Descritores + Lab 5.1', min: 10, tipo: 'lab' },
    { t: 'Classificadores', min: 7, tipo: 'conceito' },
    { t: 'Lab 5.2', min: 8, tipo: 'lab' },
    { t: 'Validação + Lab 5.3', min: 13, tipo: 'lab' },
    { t: 'Caso real: citros + Labs 5.4 e 5.5', min: 11, tipo: 'lab' },
    { t: 'Fechamento + quiz', min: 6, tipo: 'fecho' },
  ],
  secoes: [
    {
      id: 'a5-gancho',
      titulo: '"Nosso modelo acerta 99%"',
      min: 5,
      body: (
        <div className="prose">
          <p>
            Todo mês sai um artigo com um classificador de doenças foliares acertando 97, 98, 99%. Aí alguém leva o modelo para a lavoura e ele acerta pouco mais que um chute. O que aconteceu? Na maioria das
            vezes, nada de errado com o algoritmo. O problema está <b>em como a acurácia foi medida</b>.
          </p>
          <p>
            Hoje a gente monta um classificador clássico do começo ao fim e, no final, vê com os próprios olhos como uma validação descuidada fabrica um número bonito.
          </p>
        </div>
      ),
    },
    {
      id: 'a5-desc',
      titulo: 'Da imagem ao vetor de características',
      min: 10,
      body: (
        <div className="prose">
          <p>
            O pipeline clássico (Gonzalez e Woods, cap. 12; Faceli et al.) é: <b>adquirir → pré-processar → segmentar → descrever → classificar</b>. As aulas da graduação cobriram os quatro primeiros
            passos. O classificador não vê a imagem, vê um <b>vetor</b> de descritores. Aqui usamos seis:
          </p>
          <ul>
            <li>
              <b>Cor</b>: matiz, saturação e brilho médios (HSV). A clorose puxa a matiz do verde (≈ 100°) para o amarelo (≈ 55°).
            </li>
            <li>
              <b>Proporção de pixels marrons</b>: uma regra de cor simples que acende nas pústulas de ferrugem.
            </li>
            <li>
              <b>Textura</b>: desvio-padrão do cinza e o contraste da{' '}
              <Term def="Matriz de co-ocorrência de níveis de cinza (Haralick et al., 1973). Conta com que frequência um nível i aparece ao lado de um nível j num deslocamento fixo. Dela saem descritores como contraste, homogeneidade e energia.">
                GLCM
              </Term>
              , que cresce quando pixels vizinhos têm valores muito diferentes (pintinhas em fundo liso).
            </li>
          </ul>
          <EspacoCaracteristicas />
          <Callout kind="analogia">
            <p>
              O vetor de descritores é a ficha do paciente. O médico não olha a pessoa inteira de novo a cada decisão, olha pressão, temperatura, exames. Se a ficha tiver os exames errados, nem o melhor
              médico acerta.
            </p>
          </Callout>
        </div>
      ),
    },
    {
      id: 'a5-clf',
      titulo: 'Classificadores e suas fronteiras',
      min: 15,
      body: (
        <div className="prose">
          <p>Todo classificador divide o espaço de características em regiões. O jeito de traçar a fronteira é o que muda:</p>
          <ul>
            <li>
              <b>Mínima distância</b> (Gonzalez e Woods, cap. 12): um protótipo (centróide) por classe. Fronteiras retas.
            </li>
            <li>
              <b>k-NN</b> (Mitchell, cap. 8; Faceli et al.): nenhum treino, só memória. Na hora de classificar, procura os k exemplos mais parecidos. Fronteira tão flexível quanto o k permitir.
            </li>
            <li>
              <b>Naive Bayes</b>: modela a distribuição de cada descritor por classe e aplica o teorema de Bayes, supondo independência entre descritores.
            </li>
          </ul>
          <Callout kind="pegadinha">
            <p>
              Sem padronizar os descritores, a distância do k-NN é dominada por quem tem a maior escala. A matiz vai de 0 a 360 e a saturação de 0 a 1: sem padronização, a saturação praticamente não conta.
              Os labs padronizam (média 0, desvio 1) com as estatísticas do <b>treino</b>, nunca do conjunto todo.
            </p>
          </Callout>
          <Classificadores />
          <Callout kind="campo" title="Sempre compare com o chute">
            <p>
              No artigo da soja com drone (Aula 4), o Random Forest chegou a 65,5% de acurácia. Parece pouco ou muito? Depende da referência: o Dummy Classifier, que só chuta a classe mais comum,
              fez 49,6%. Coloque sempre um Dummy na tabela. Ele diz quanto o modelo aprendeu de fato.
            </p>
          </Callout>
          <p>
            Na matriz de confusão, as linhas são a classe real e as colunas a prevista. <b>Precisão</b> responde "quando o modelo disse ferrugem, quantas vezes era ferrugem?". <b>Revocação</b> responde "de
            todas as ferrugens reais, quantas o modelo achou?". Para uma doença que se espalha rápido, perder um caso (revocação baixa) costuma custar mais que um alarme falso.
          </p>
        </div>
      ),
    },
    {
      id: 'a5-val',
      titulo: 'Validação que respeita os grupos',
      min: 13,
      body: (
        <div className="prose">
          <p>
            A validação cruzada aleatória supõe que as amostras são independentes. Nos dados do agro, quase nunca são: três fotos da mesma folha, várias folhas da mesma planta, várias plantas do mesmo talhão,
            vários talhões fotografados com a mesma câmera no mesmo dia. Quando amostras "parentes" caem uma no treino e outra no teste, o modelo acerta por reconhecer o parente, e a acurácia fica
            otimista.
          </p>
          <p>
            A saída é dividir por <b>grupo</b>: todas as fotos de uma folha (ou de uma fazenda, de uma safra, de um projeto) ficam do mesmo lado. O caso mais exigente é o{' '}
            <Term def="Leave-one-group-out: cada rodada da validação deixa um grupo inteiro de fora (uma fazenda, um ano, um estudo) e testa nele. Mede a capacidade de generalizar para um grupo que o modelo nunca viu.">
              leave-one-group-out
            </Term>
            , que responde à pergunta que o produtor faz: <i>funciona na minha fazenda?</i>
          </p>
          <Vazamento />
          <Callout kind="campo">
            <p>
              Roberts et al. (2017) mostram o mesmo problema em dados ecológicos com estrutura espacial, temporal e hierárquica. Em microbioma, estudos com várias fontes de dados usam
              leave-one-project-out pelo mesmo motivo. Há um exemplo completo na{' '}
              <a href="https://tassid.github.io/microbiome-multi-project-ml/" target="_blank" rel="noreferrer">
                réplica de Hagen et al. (2024)
              </a>{' '}
              que faz parte da pesquisa de mestrado da professora.
            </p>
          </Callout>
          <Callout kind="prof">
            <p>
              Coloque o efeito fazenda em 0 e mostre que as duas validações quase empatam. Depois suba para 1,5. A queda aparece sem mudar nenhuma linha do classificador. Pergunte à turma: qual dos dois
              números vocês colocariam no artigo?
            </p>
          </Callout>
        </div>
      ),
    },
    {
      id: 'a5-caso',
      titulo: 'Caso real: braquiária na entrelinha dos citros',
      min: 11,
      body: (
        <div className="prose">
          <p>
            Um boletim da Embrapa usa exatamente o pipeline desta aula, com software livre: o pesquisador pinta exemplos, um Random Forest classifica cada pixel e a cobertura sai da contagem. É um
            ótimo exercício de leitura crítica, porque o método é bom e o número publicado precisa ser lido com cuidado.
          </p>
          {casoCitros}
          <LabCitros />
          <CalcConfusao />
          <Callout kind="pegadinha" title="94,7% de quê?">
            <p>
              A validação do boletim sorteia pixels dos próprios traços de treino. Um pixel e o vizinho dele no mesmo traço são quase idênticos, e um cai no treino enquanto o outro cai no teste.
              É o vazamento do Lab 5.3 em escala de pixel. O boletim separou 40 imagens para teste; a métrica que responde à pergunta do produtor é a dessas imagens inteiras.
            </p>
          </Callout>
          {codeCitros}
        </div>
      ),
    },
    {
      id: 'a5-fecho',
      titulo: 'Pra levar pra casa',
      min: 6,
      body: (
        <div className="prose">
          <ol>
            <li>Classificador clássico = bons descritores + fronteira adequada. Descritor ruim não se salva com algoritmo sofisticado.</li>
            <li>Acurácia sozinha esconde muito. Olhe a matriz de confusão e a revocação da classe que mais importa.</li>
            <li>Divida treino e teste pelo grupo que representa o uso real (folha, talhão, fazenda, safra). Se não fizer isso, o número publicado mede memória, não generalização.</li>
          </ol>
          <Code code={CODE_5} title="Python · scikit-image + scikit-learn" />
        </div>
      ),
    },
  ],
  quiz: [
    { p: 'Com k-NN e k = 1, a acurácia no próprio conjunto de treino tende a ser:', o: ['Perto de 0%', 'Perto de 100%', 'Igual à do teste', 'Aleatória'], a: 1, e: 'Cada ponto é o seu próprio vizinho mais próximo. Por isso acurácia de treino não diz nada sobre generalização.' },
    { p: 'Por que padronizar os descritores antes do k-NN?', o: ['Para acelerar o código', 'Para que descritores com escala grande não dominem a distância', 'Porque o k-NN só aceita valores entre 0 e 1', 'Para remover outliers'], a: 1, e: 'A distância euclidiana soma diferenças ao quadrado. Um descritor em graus (0–360) engole outro que varia entre 0 e 1.' },
    { p: 'O classificador de mínima distância desenha fronteiras:', o: ['Retas (mediatrizes entre centróides)', 'Sempre circulares', 'Que contornam cada ponto', 'Aleatórias'], a: 0, e: 'Com distância euclidiana, a fronteira entre dois centróides é o hiperplano equidistante entre eles.' },
    { p: 'A validação leave-one-farm-out mede principalmente:', o: ['A velocidade do modelo', 'A capacidade de generalizar para uma fazenda nunca vista', 'O desempenho no treino', 'O número de descritores ideal'], a: 1, e: 'Cada fazenda é testada por um modelo treinado só nas outras, simulando o uso numa propriedade nova.' },
    { p: 'De 50 folhas com ferrugem, o modelo encontrou 40. Qual métrica é 0,80?', o: ['Precisão', 'Revocação', 'Acurácia', 'Especificidade'], a: 1, e: 'Revocação = verdadeiros positivos / positivos reais = 40/50. Precisão olharia para quantos dos "ferrugem" previstos estavam certos.' },
  ],
  desafios: [
    { nivel: 'aquecimento', txt: <>No Lab 5.2, encontre o par de descritores que dá a maior acurácia com mínima distância. Explique, olhando a dispersão, por que esse par funciona.</> },
    { nivel: 'mão na massa', txt: <>Use o código da aula num conjunto real (por exemplo, recortes do PlantVillage ou fotos da turma). Compare StratifiedKFold com GroupKFold usando a folha como grupo.</> },
    { nivel: 'investigação', txt: <>Proponha uma normalização de cor (balanço de branco pelo fundo, por exemplo) que reduza o efeito fazenda. Mostre a acurácia leave-one-farm-out antes e depois.</> },
  ],
  leitura: [
    <>FACELI, K. et al. <i>Inteligência artificial: uma abordagem de aprendizagem de máquina</i>. LTC, 2011. Capítulos de métodos baseados em distâncias, métodos probabilísticos e avaliação de modelos.</>,
    <>GONZALEZ, R. C.; WOODS, R. E. <i>Processamento digital de imagens</i>. 3. ed. Pearson, 2010. Cap. 11 (descritores, incluindo textura) e cap. 12 (reconhecimento de objetos).</>,
    <>MITCHELL, T. M. <i>Machine learning</i>. McGraw-Hill, 1997. Cap. 8 (aprendizado baseado em instâncias).</>,
    <>HARALICK, R. M.; SHANMUGAM, K.; DINSTEIN, I. Textural features for image classification. <i>IEEE Transactions on Systems, Man, and Cybernetics</i>, v. 3, n. 6, p. 610–621, 1973.</>,
    <>ROBERTS, D. R. et al. Cross-validation strategies for data with temporal, spatial, hierarchical, or phylogenetic structure. <i>Ecography</i>, v. 40, n. 8, p. 913–929, 2017.</>,
    <>CARVALHO, R. S.; CARVALHO, J. E. B. <i>Processamento digital e aprendizado de máquina de imagens aéreas obtidas por aeronaves remotamente pilotadas (RPA) para estimar percentual de cobertura do solo por gramíneas perenes em pomar de citros</i>. Cruz das Almas: Embrapa Mandioca e Fruticultura, 2022. (Boletim de Pesquisa e Desenvolvimento, 137).</>,
  ],
}
