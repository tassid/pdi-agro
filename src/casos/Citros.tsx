import { useEffect, useMemo, useState } from 'react'
import { newRGB, rng } from '../lib/img'
import { makeCitros, pixelFeatures, trainForest, predictForest, confusao, metricas, VOOS, type Voo, type Forest } from '../lib/casos'
import { ImgCanvas, Seg, Lab, Caso, Code } from '../ui'
import { memo } from '../samples'
import { Eraser, Play, Sparkles } from 'lucide-react'

type Classe = 'Gramínea' | 'Outros'
const W = 300, H = 200

function tracosExemplo(gram: Uint8Array, seed: number): { g: number[]; o: number[] } {
  const R = rng(seed)
  const g: number[] = [], o: number[] = []
  let tries = 0
  // como um supervisor com pressa: alguns riscos na braquiária e no solo claro, quase nada na sombra
  while ((g.length < 700 || o.length < 700) && tries++ < 4000) {
    const x = 6 + Math.floor(R() * (W - 12)), y = 30 + Math.floor(R() * (H - 60))
    const alvo = gram[y * W + x]
    const lista = alvo ? g : o
    if (lista.length >= 700) continue
    const ang = R() * Math.PI, len = 10 + R() * 16
    for (let t = 0; t < len; t++) {
      const xx = Math.round(x + Math.cos(ang) * t), yy = Math.round(y + Math.sin(ang) * t)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const q = (yy + dy) * W + xx + dx
          if (xx + dx < 0 || yy + dy < 0 || xx + dx >= W || yy + dy >= H) continue
          if (gram[q] === alvo) lista.push(q)
        }
    }
  }
  return { g: [...new Set(g)], o: [...new Set(o)] }
}

export function LabCitros() {
  const [classe, setClasse] = useState<Classe>('Gramínea')
  const [teste, setTeste] = useState<Voo>('voo C · 16h, sombra longa')
  const A = memo('citros-A', () => makeCitros(8, 'voo A · 10h, sol'))
  const T = memo(`citros-${teste}`, () => makeCitros(19, teste))
  const FA = memo('citros-FA', () => pixelFeatures(A.img))
  const FT = memo(`citros-F-${teste}`, () => pixelFeatures(T.img))
  const ex = memo('citros-tracos', () => tracosExemplo(A.gram, 3))
  const [tr, setTr] = useState<{ g: Set<number>; o: Set<number> }>(() => ({ g: new Set(ex.g), o: new Set(ex.o) }))
  const [modelo, setModelo] = useState<{ forest: Forest; ntr: number } | null>(null)

  const treinar = () => {
    const idx = [...tr.g, ...tr.o]
    const y = new Uint8Array(W * H)
    tr.g.forEach((i) => (y[i] = 1))
    const amostra = idx.length > 2500 ? idx.filter((_, k) => k % Math.ceil(idx.length / 2500) === 0) : idx
    setModelo({ forest: trainForest(FA, y, amostra, 1, 20, 10), ntr: idx.length })
  }
  // treina uma vez com os traços de exemplo, para o lab abrir funcionando
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => treinar(), [])

  const res = useMemo(() => {
    if (!modelo) return null
    const pa = new Uint8Array(W * H), pt = new Uint8Array(W * H)
    for (let i = 0; i < W * H; i++) {
      pa[i] = predictForest(modelo.forest, FA, i) > 0.5 ? 1 : 0
      pt[i] = predictForest(modelo.forest, FT, i) > 0.5 ? 1 : 0
    }
    // validação cruzada de 10 dobras sobre os pixels dos traços, como no Weka
    const idx = [...tr.g, ...tr.o]
    const y = new Uint8Array(W * H)
    tr.g.forEach((i) => (y[i] = 1))
    const R = rng(7)
    const sh = idx.map((i) => ({ i, k: R() })).sort((a, b) => a.k - b.k).map((o) => o.i).filter((_, k) => k < 2000)
    const predCV = new Uint8Array(W * H)
    for (let f = 0; f < 10; f++) {
      const te = sh.filter((_, k) => k % 10 === f), trn = sh.filter((_, k) => k % 10 !== f)
      const fo = trainForest(FA, y, trn, 11 + f, 8, 8)
      te.forEach((i) => (predCV[i] = predictForest(fo, FA, i) > 0.5 ? 1 : 0))
    }
    const cv = confusao(predCV, y, sh)
    const cA = confusao(pa, A.gram)
    const cT = confusao(pt, T.gram)
    const cob = (p: Uint8Array) => (100 * p.reduce((a, b) => a + b, 0)) / p.length
    return { pa, pt, cv, cA, cT, cobA: cob(pa), cobT: cob(pt) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelo, FT])

  const pinta = (x: number, y: number) => {
    const alvo = classe === 'Gramínea' ? 'g' : 'o', outro = alvo === 'g' ? 'o' : 'g'
    setTr((t) => {
      const n = { g: new Set(t.g), o: new Set(t.o) }
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          if (x + dx < 0 || y + dy < 0 || x + dx >= W || y + dy >= H || dx * dx + dy * dy > 5) continue
          const q = (y + dy) * W + x + dx
          n[alvo].add(q)
          n[outro].delete(q)
        }
      return n
    })
  }
  const overlay = useMemo(
    () => (ctx: CanvasRenderingContext2D, s: number) => {
      ctx.fillStyle = 'rgba(230,40,40,0.85)'
      tr.g.forEach((i) => ctx.fillRect((i % W) * s, Math.floor(i / W) * s, s, s))
      ctx.fillStyle = 'rgba(40,200,60,0.85)'
      tr.o.forEach((i) => ctx.fillRect((i % W) * s, Math.floor(i / W) * s, s, s))
    },
    [tr],
  )
  const tint = (img: typeof A.img, p: Uint8Array) => {
    const o = newRGB(W, H)
    for (let i = 0; i < W * H; i++)
      for (let k = 0; k < 3; k++) {
        const lum = 0.3 * img.data[i * 3] + 0.59 * img.data[i * 3 + 1] + 0.11 * img.data[i * 3 + 2]
        o.data[i * 3 + k] = p[i] ? img.data[i * 3 + k] * 0.3 + [235, 55, 45][k] * 0.7 : lum * 0.55 + 70
      }
    return o
  }
  const mCV = res && metricas(res.cv.vp, res.cv.fn, res.cv.fp, res.cv.vn)
  const mA = res && metricas(res.cA.vp, res.cA.fn, res.cA.fp, res.cA.vn)
  const mT = res && metricas(res.cT.vp, res.cT.fn, res.cT.fp, res.cT.vn)
  const pct = (v: number) => `${(100 * v).toFixed(1)}%`
  return (
    <Lab
      n="5.4"
      title="Segmentação treinável, como no Trainable Weka Segmentation"
      desc="Entrelinha de um pomar de citros vista do drone. Pinte traços vermelhos na braquiária e verdes em todo o resto (solo, palhada, sombra, folha larga). Um Random Forest aprende com os pixels pintados e classifica a imagem inteira. Traços de exemplo já vêm pintados."
    >
      <div className="controls">
        <Seg value={classe} options={['Gramínea', 'Outros'] as const} onChange={setClasse} label="pincel" />
        <button type="button" className="btn" onClick={treinar}>
          <Play size={15} /> Treinar
        </button>
        <button type="button" className="btn ghost" onClick={() => setTr({ g: new Set(), o: new Set() })}>
          <Eraser size={15} /> Apagar traços
        </button>
        <button type="button" className="btn ghost" onClick={() => setTr({ g: new Set(ex.g), o: new Set(ex.o) })}>
          <Sparkles size={15} /> Traços de exemplo
        </button>
      </div>
      <div className="lab-cols two">
        <div className="panel">
          <div className="panel-t">
            <span>voo A · pinte aqui</span>
            <span>
              {tr.g.size} px gramínea · {tr.o.size} px outros
            </span>
          </div>
          <ImgCanvas img={A.img} overlay={overlay} onDrag={pinta} label="imagem para pintar os traços de treino" />
        </div>
        <div className="panel">
          <div className="panel-t">
            <span>classificação no voo A</span>
            <span>vermelho = gramínea · cinza = outros</span>
          </div>
          {res ? <ImgCanvas img={tint(A.img, res.pa)} label="classificação da imagem de treino" /> : <p className="note">Treinando…</p>}
        </div>
      </div>
      <div className="lab-cols two">
        <div className="panel">
          <div className="controls">
            <Seg value={teste} options={VOOS.filter((v) => v !== 'voo A · 10h, sol')} onChange={setTeste} label="testar em outro voo" />
          </div>
          {res && <ImgCanvas img={tint(T.img, res.pt)} label="classificação em outro voo" />}
        </div>
        <div className="panel" style={{ alignContent: 'start' }}>
          {res && mCV && mA && mT && (
            <div className="tbl-wrap">
              <table className="tbl wrap1">
                <thead>
                  <tr>
                    <th>como foi medido</th>
                    <th>acurácia</th>
                    <th>Kappa</th>
                    <th>cobertura</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>10 dobras nos pixels dos traços (como o artigo)</td>
                    <td className="ok">{pct(mCV.acc)}</td>
                    <td>{mCV.kappa.toFixed(2)}</td>
                    <td>·</td>
                  </tr>
                  <tr>
                    <td>voo A inteiro × gabarito</td>
                    <td>{pct(mA.acc)}</td>
                    <td>{mA.kappa.toFixed(2)}</td>
                    <td>
                      {res.cobA.toFixed(1)}% <span className="note">(real {A.cobertura.toFixed(1)}%)</span>
                    </td>
                  </tr>
                  <tr>
                    <td>{teste} × gabarito</td>
                    <td className={mT.acc < mCV.acc - 0.05 ? 'bad' : ''}>{pct(mT.acc)}</td>
                    <td>{mT.kappa.toFixed(2)}</td>
                    <td>
                      {res.cobT.toFixed(1)}% <span className="note">(real {T.cobertura.toFixed(1)}%)</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="note">
            A primeira linha testa pixels vizinhos dos que foram usados no treino, no mesmo traço. Eles são quase cópias uns dos outros, então a nota sai alta. A pergunta do produtor é a última
            linha.
          </p>
        </div>
      </div>
    </Lab>
  )
}

export function CalcConfusao() {
  const [v, setV] = useState({ vp: 3830, fn: 184, fp: 223, vn: 3494 })
  const m = metricas(v.vp, v.fn, v.fp, v.vn)
  const campo = (k: keyof typeof v, rot: string) => (
    <label className="ctl" style={{ maxWidth: 150 }}>
      {rot}
      <input type="number" min={0} value={v[k]} onChange={(e) => setV({ ...v, [k]: Math.max(0, +e.target.value || 0) })} />
    </label>
  )
  return (
    <Lab n="5.5" title="Refaça as contas do boletim" desc="A matriz de confusão do Weka publicada no trabalho (em pixels). Confira se as métricas batem e depois mude os números para ver quem reage a quê.">
      <div className="controls">
        {campo('vp', 'VP · gramínea certa')}
        {campo('fn', 'FN · gramínea perdida')}
        {campo('fp', 'FP · outros como gramínea')}
        {campo('vn', 'VN · outros certo')}
        <button type="button" className="btn ghost" onClick={() => setV({ vp: 3830, fn: 184, fp: 223, vn: 3494 })}>
          Valores do artigo
        </button>
      </div>
      <div className="stats">
        <div className="stat"><b>{(100 * m.acc).toFixed(2)}%</b><span>acurácia · artigo 94,74%</span></div>
        <div className="stat"><b>{m.prec.toFixed(3)}</b><span>precisão · artigo 0,945</span></div>
        <div className="stat"><b>{m.rec.toFixed(3)}</b><span>revocação · artigo 0,954</span></div>
        <div className="stat"><b>{m.f1.toFixed(3)}</b><span>F1 · artigo 0,950</span></div>
        <div className="stat"><b>{m.kappa.toFixed(4)}</b><span>Kappa · artigo 0,8945</span></div>
        <div className="stat"><b>{m.mcc.toFixed(3)}</b><span>MCC · artigo 0,895</span></div>
      </div>
      <div className="formula">Kappa = (acurácia − acaso) ÷ (1 − acaso) &nbsp;·&nbsp; MCC = (VP·VN − FP·FN) ÷ √((VP+FP)(VP+FN)(VN+FP)(VN+FN))</div>
    </Lab>
  )
}

const CODE = `import numpy as np
from skimage import io, color, filters
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score, GroupKFold

def atributos(img):
    hsv = color.rgb2hsv(img)
    cinza = color.rgb2gray(img)
    media = filters.gaussian(cinza, 2)
    desvio = np.sqrt(np.maximum(filters.gaussian(cinza**2, 2) - media**2, 0))
    r, g, b = [img[..., k].astype(float) for k in range(3)]
    return np.dstack([r, g, b, hsv[..., 0], hsv[..., 1], hsv[..., 2], 2*g - r - b, media, desvio])

X, y, grupo = [], [], []
for k, (foto, tracos) in enumerate(pares):          # tracos: 1 = gramínea, 2 = outros, 0 = sem traço
    A = atributos(io.imread(foto))
    m = tracos > 0
    X.append(A[m]); y.append(tracos[m] == 1); grupo.append(np.full(m.sum(), k))
X, y, grupo = np.vstack(X), np.concatenate(y), np.concatenate(grupo)

rf = RandomForestClassifier(n_estimators=200, n_jobs=-1)
print("pixels misturados:", cross_val_score(rf, X, y, cv=10).mean())
print("por imagem:       ", cross_val_score(rf, X, y, groups=grupo, cv=GroupKFold(5)).mean())`

export const casoCitros = (
  <Caso
    tipo="boletim de pesquisa · Embrapa · 2022"
    titulo="Processamento digital e aprendizado de máquina de imagens aéreas (RPA) para estimar a cobertura do solo por gramíneas em pomar de citros"
    autores="Carvalho, R. S.; Carvalho, J. E. B. (Embrapa Mandioca e Fruticultura)"
    onde="Boletim de Pesquisa e Desenvolvimento 137, Cruz das Almas, BA"
    resumo={
      <p>
        Estimar o percentual de braquiária (<i>Urochloa</i> spp.) nas entrelinhas de um pomar de laranjeira 'Pera' em Rio Real (BA), trocando a avaliação visual, que é subjetiva, por imagens de
        drone e software livre.
      </p>
    }
    pipeline={[
      'Drone DJI Phantom a 10 m, entre 10h e 11h, exposição travada e filtro ND8',
      '80 imagens: 40 para treinar e 40 para testar; recorte da entrelinha no Fiji ImageJ',
      'Traços do supervisor em duas classes: "Gramínea" e "Outros" (solo, sombra, palhada, espontâneas)',
      'Random Forest no plugin Trainable Weka Segmentation, classificando pixel a pixel',
      'Imagem 8 bits, limiarização e % de cobertura; métricas no Weka com 10 dobras',
    ]}
    numeros={[
      { v: '94,7%', l: 'acurácia (7.324 de 7.731 pixels)' },
      { v: '0,8945', l: 'Kappa' },
      { v: '0,989', l: 'área sob a curva ROC' },
      { v: '10 m', l: 'altura de voo' },
    ]}
    discutir={[
      <>As 7.731 instâncias da validação são pixels dos traços. Pixels vizinhos no mesmo traço caem em dobras diferentes. Isso infla ou reduz a acurácia? Compare as três linhas do lab.</>,
      <>O voo foi sempre entre 10h e 11h, com exposição travada e filtro ND. Por que esse cuidado de aquisição vale tanto quanto o classificador?</>,
      <>A fórmula do MCC impressa no boletim tem só VP no numerador. Refaça a conta com a fórmula completa no Lab 5.5: o valor publicado (0,895) confere?</>,
    ]}
  />
)

export const codeCitros = <Code code={CODE} title="Python · scikit-image + scikit-learn (o boletim usou Fiji e Weka)" />
