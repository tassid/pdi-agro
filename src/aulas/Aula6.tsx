import { useEffect, useMemo, useRef, useState } from 'react'
import { Play, RotateCcw, Eraser } from 'lucide-react'
import { type RGB, type Gray, toGray, convolve, KERNELS, newGray, viridis, rng } from '../lib/img'
import { makePatch, type Doenca } from '../lib/synth'
import { N, newNet, toInput, down2, trainEpoch, accuracy, predict, saliency, type Net } from '../lib/cnn'
import { ImgCanvas, Seg, Lab, Callout, Term, Code, LineChart, Legend } from '../ui'
import { leaf, memo } from '../samples'
import type { Aula } from '../lesson'

/* ============ Lab 6.1 · banco de filtros ============ */

const BANK: { nome: string; k: number[][] }[] = [
  { nome: 'borda vertical', k: KERNELS['Sobel x'].k },
  { nome: 'borda horizontal', k: KERNELS['Sobel y'].k },
  { nome: 'mancha escura', k: [[1, 1, 1], [1, -8, 1], [1, 1, 1]].map((r) => r.map((v) => v / 2)) },
  { nome: 'nervura clara', k: [[-1, 2, -1], [-1, 2, -1], [-1, 2, -1]] },
]

function pool2(g: Gray): Gray {
  const w = Math.floor(g.w / 2), h = Math.floor(g.h / 2)
  const o = newGray(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const a = (yy: number, xx: number) => g.data[yy * g.w + xx]
      o.data[y * w + x] = Math.max(a(2 * y, 2 * x), a(2 * y + 1, 2 * x), a(2 * y, 2 * x + 1), a(2 * y + 1, 2 * x + 1))
    }
  return o
}

function BancoFiltros() {
  const [etapa, setEtapa] = useState<'convolução' | '+ ReLU' | '+ max-pool 2×2'>('+ ReLU')
  const [doenca, setDoenca] = useState<Doenca>('ferrugem')
  const lf = leaf(8, doenca, 0.6, 'claro')
  const g = useMemo(() => toGray(lf.rgb), [lf])
  const maps = useMemo(
    () =>
      BANK.map((f) => {
        const c = convolve(g, f.k)
        let m: Gray = c
        if (etapa !== 'convolução') m = { ...c, data: c.data.map((v) => Math.max(0, v)) }
        if (etapa === '+ max-pool 2×2') m = pool2(m)
        let lo = Infinity, hi = -Infinity
        for (const v of m.data) {
          if (v < lo) lo = v
          if (v > hi) hi = v
        }
        const s = Math.max(Math.abs(lo), Math.abs(hi)) || 1
        return { ...m, data: m.data.map((v) => (etapa === 'convolução' ? 128 + (v / s) * 127 : (v / s) * 255 * 1.6)) }
      }),
    [g, etapa],
  )
  return (
    <Lab n="6.1" title="Uma camada convolucional feita à mão" desc="Quatro kernels aplicados na mesma folha. Cada saída é um mapa de ativação. Uma CNN faz exatamente isso, só que aprende os pesos sozinha e empilha dezenas de camadas.">
      <div className="controls">
        <Seg value={doenca} options={['sadia', 'ferrugem', 'mancha-alvo', 'clorose'] as const} onChange={setDoenca} label="folha" />
        <Seg value={etapa} options={['convolução', '+ ReLU', '+ max-pool 2×2'] as const} onChange={setEtapa} label="etapa" />
      </div>
      <div className="lab-cols">
        <div className="panel">
          <div className="panel-t">
            <span>entrada (cinza)</span>
            <span>
              {g.w}×{g.h}
            </span>
          </div>
          <ImgCanvas img={lf.rgb} label="folha de entrada" />
        </div>
        {maps.map((m, i) => (
          <div className="panel" key={i}>
            <div className="panel-t">
              <span>{BANK[i].nome}</span>
              <span>
                {m.w}×{m.h}
              </span>
            </div>
            <ImgCanvas img={m} lut={etapa === 'convolução' ? undefined : (v) => viridis(Math.min(1, v / 255))} scale={etapa === '+ max-pool 2×2' ? 4 : 2} label={`mapa ${BANK[i].nome}`} />
            <div className="readout" style={{ fontSize: '0.7rem' }}>
              {BANK[i].k.map((r, j) => (
                <div key={j}>{r.map((v) => v.toFixed(1).padStart(5)).join(' ')}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="note">
        {etapa === 'convolução'
          ? 'Cinza médio = zero. Claro e escuro são respostas positivas e negativas.'
          : etapa === '+ ReLU'
            ? 'A ReLU zera tudo que é negativo. Sobra só onde o padrão do kernel "casou" com a imagem.'
            : 'O max-pool guarda o maior valor de cada bloco 2×2. O mapa cai para 1/4 dos pixels e a detecção fica tolerante a pequenos deslocamentos.'}
      </p>
    </Lab>
  )
}

/* ============ dados para a CNN ============ */

type Set = { X: Float32Array[]; Y: number[]; imgs: RGB[] }
const LIGHT: [number, number, number] = [214, 214, 206], DARK: [number, number, number] = [74, 50, 40]

function makeSet(n: number, seed: number, fundo: 'nenhum' | 'denuncia' | 'trocado' | 'aleatório'): Set {
  const R = rng(seed)
  const X: Float32Array[] = [], Y: number[] = [], imgs: RGB[] = []
  for (let i = 0; i < n; i++) {
    const y = i % 2
    const doenca: Doenca = y === 0 ? 'sadia' : R() < 0.55 ? 'ferrugem' : 'mancha-alvo'
    let bg: [number, number, number] | null = null
    if (fundo === 'denuncia') bg = y === 0 ? LIGHT : DARK
    if (fundo === 'trocado') bg = y === 0 ? DARK : LIGHT
    if (fundo === 'aleatório') bg = R() < 0.5 ? LIGHT : DARK
    const br = 0.85 + R() * 0.3
    const img = down2(makePatch(32, Math.floor(R() * 1e7), { doenca, severidade: 0.35 + 0.6 * R(), brilho: br, fundoCantos: bg }))
    X.push(toInput(img))
    Y.push(y)
    imgs.push(img)
  }
  return { X, Y, imgs }
}

function FiltersView({ net, version }: { net: Net; version: number }) {
  const imgs = useMemo(() => {
    const out: RGB[] = []
    for (let f = 0; f < net.F; f++) {
      const w = net.W.slice(f * 27, f * 27 + 27)
      const mx = Math.max(...Array.from(w).map(Math.abs)) || 1
      const img: RGB = { w: 3, h: 3, data: new Float32Array(27) }
      for (let i = 0; i < 9; i++) for (let c = 0; c < 3; c++) img.data[i * 3 + c] = 128 + (w[c * 9 + i] / mx) * 127
      out.push(img)
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [net, version])
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${net.F}, 1fr)`, gap: 6, maxWidth: 330 }}>
      {imgs.map((im, i) => (
        <ImgCanvas key={i} img={im} scale={16} pixelated label={`filtro ${i + 1}`} />
      ))}
    </div>
  )
}

function useTrainer(train: Set, tests: Set[], epochs = 14, seed = 1) {
  const net = useRef<Net>(newNet(6, seed))
  const [hist, setHist] = useState<{ loss: number[]; acc: number[][] }>({ loss: [], acc: tests.map(() => []) })
  const [running, setRunning] = useState(false)
  const [version, setVersion] = useState(0)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const reset = () => {
    net.current = newNet(6, seed + Math.floor(Math.random() * 1000))
    setHist({ loss: [], acc: tests.map(() => []) })
    setVersion((v) => v + 1)
  }
  const run = () => {
    if (running) return
    setRunning(true)
    let e = 0
    const step = () => {
      if (!alive.current) return
      const loss = trainEpoch(net.current, train.X, train.Y, 0.01, 16, e)
      const accs = tests.map((t) => accuracy(net.current, t.X, t.Y))
      setHist((h) => ({ loss: [...h.loss, loss], acc: h.acc.map((a, i) => [...a, accs[i]]) }))
      setVersion((v) => v + 1)
      e++
      if (e < epochs) setTimeout(step, 16)
      else setRunning(false)
    }
    setTimeout(step, 16)
  }
  return { net: net.current, hist, running, run, reset, version }
}

/* ============ Lab 6.2 · treinar uma CNN ============ */

function TreinarCNN() {
  const train = memo('cnn-train', () => makeSet(360, 11, 'nenhum'))
  const test = memo('cnn-test', () => makeSet(160, 99, 'nenhum'))
  const t = useTrainer(train, [train, test], 14, 3)
  const [padSeed, setPadSeed] = useState(1)
  const basePad = useMemo(() => down2(makePatch(32, 500 + padSeed, { doenca: 'sadia', severidade: 0 })), [padSeed])
  const [pad, setPad] = useState<RGB>(basePad)
  useEffect(() => setPad(basePad), [basePad])
  const paint = (x: number, y: number) =>
    setPad((p) => {
      const o = { ...p, data: p.data.slice() }
      const k = (y * N + x) * 3
      o.data[k] = 138
      o.data[k + 1] = 90
      o.data[k + 2] = 52
      return o
    })
  const prob = useMemo(() => predict(t.net, toInput(pad))[1], [pad, t.net, t.version])
  const last = (a: number[]) => (a.length ? `${(a[a.length - 1] * 100).toFixed(1)}%` : '·')
  return (
    <Lab n="6.2" title="Treine uma CNN aqui no navegador" desc="Rede minúscula: conv 3×3 com 6 filtros → ReLU → max-pool → camada densa → softmax. 360 recortes de treino (16×16 px), metade sadios e metade com ferrugem ou mancha-alvo. Aperte o play e acompanhe.">
      <div className="controls">
        <button type="button" className="btn" onClick={t.run} disabled={t.running}>
          <Play size={15} /> {t.running ? 'Treinando…' : t.hist.loss.length ? 'Treinar mais 14 épocas' : 'Treinar 14 épocas'}
        </button>
        <button type="button" className="btn ghost" onClick={t.reset} disabled={t.running}>
          <RotateCcw size={15} /> Reiniciar pesos
        </button>
      </div>
      <div className="lab-cols">
        <div className="panel">
          <div className="panel-t">
            <span>perda (entropia cruzada)</span>
            <span>época {t.hist.loss.length}</span>
          </div>
          <LineChart series={[{ name: 'perda', data: t.hist.loss, color: 'var(--soil)' }]} ymin={0} ymax={Math.max(0.8, ...t.hist.loss)} xlabel="época" />
        </div>
        <div className="panel">
          <div className="panel-t">
            <span>acurácia</span>
            <span>
              treino {last(t.hist.acc[0])} · teste {last(t.hist.acc[1])}
            </span>
          </div>
          <LineChart
            series={[
              { name: 'treino', data: t.hist.acc[0], color: 'var(--sky)' },
              { name: 'teste', data: t.hist.acc[1], color: 'var(--leaf)' },
            ]}
            ymin={0.4}
            ymax={1}
            xlabel="época"
          />
          <Legend items={[{ name: 'treino', color: 'var(--sky)' }, { name: 'teste', color: 'var(--leaf)' }]} />
        </div>
        <div className="panel">
          <div className="panel-t">
            <span>os 6 filtros aprendidos (RGB)</span>
          </div>
          <FiltersView net={t.net} version={t.version} />
          <p className="note">Começam como ruído. Com o treino, alguns viram detectores de "ponto marrom no verde". Compare com os kernels feitos à mão no Lab 6.1.</p>
          <div className="panel-t" style={{ marginTop: 8 }}>
            <span>exemplos de treino</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 3 }}>
            {train.imgs.slice(0, 16).map((im, i) => (
              <ImgCanvas key={i} img={im} scale={3} pixelated label={train.Y[i] ? 'doente' : 'sadia'} />
            ))}
          </div>
        </div>
      </div>
      <div className="lab-cols two" style={{ alignItems: 'center' }}>
        <div className="panel" style={{ maxWidth: 300 }}>
          <div className="panel-t">
            <span>desenhe lesões (clique e arraste)</span>
          </div>
          <ImgCanvas img={pad} scale={16} pixelated onDrag={paint} label="folha para pintar lesões" />
          <div className="controls">
            <button type="button" className="btn ghost" onClick={() => setPad(basePad)}>
              <Eraser size={15} /> Limpar
            </button>
            <button type="button" className="btn ghost" onClick={() => setPadSeed((s) => s + 1)}>
              Outra folha
            </button>
          </div>
        </div>
        <div className="panel">
          <div className="stats">
            <div className="stat" style={{ minWidth: 200 }}>
              <b style={{ color: prob > 0.5 ? 'var(--soil)' : 'var(--leaf)' }}>{(prob * 100).toFixed(0)}%</b>
              <span>probabilidade de "doente"</span>
            </div>
          </div>
          <div style={{ height: 14, borderRadius: 7, background: 'var(--surface-2)', overflow: 'hidden', maxWidth: 360 }}>
            <div style={{ width: `${prob * 100}%`, height: '100%', background: prob > 0.5 ? 'var(--soil)' : 'var(--leaf)', transition: 'width .2s' }} />
          </div>
          <p className="note">
            {t.hist.loss.length ? 'Pinte duas ou três pintinhas e veja a probabilidade subir. Quantos pixels marrons a rede precisa para mudar de ideia?' : 'Antes do treino a rede chuta. Treine primeiro e depois volte aqui para pintar.'}
          </p>
        </div>
      </div>
    </Lab>
  )
}

/* ============ Lab 6.3 · aprendizado por atalho ============ */

function Atalho() {
  const [modo, setModo] = useState<'fundo aleatório' | 'fundo denuncia a classe'>('fundo denuncia a classe')
  const train = memo(`sc-train-${modo}`, () => makeSet(360, 21, modo === 'fundo aleatório' ? 'aleatório' : 'denuncia'))
  const same = memo(`sc-same-${modo}`, () => makeSet(160, 77, modo === 'fundo aleatório' ? 'aleatório' : 'denuncia'))
  const swapped = memo('sc-swap', () => makeSet(160, 78, 'trocado'))
  const t = useTrainer(train, [same, swapped], 12, 7)
  const sal = useMemo(() => {
    if (!t.hist.loss.length) return null
    const acc = new Float32Array(N * N)
    swapped.X.slice(0, 60).forEach((x, i) => {
      const s = saliency(t.net, x, swapped.Y[i])
      const mx = Math.max(...s) || 1
      for (let j = 0; j < N * N; j++) acc[j] += s[j] / mx
    })
    const mx = Math.max(...acc) || 1
    const g = newGray(N, N)
    for (let j = 0; j < N * N; j++) g.data[j] = (acc[j] / mx) * 255
    let corner = 0, center = 0, nc = 0, nm = 0
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const d = Math.hypot(x - N / 2 + 0.5, y - N / 2 + 0.5)
        if (d > N * 0.42) {
          corner += acc[y * N + x]
          nc++
        } else {
          center += acc[y * N + x]
          nm++
        }
      }
    return { g, ratio: corner / nc / (center / nm) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.version, swapped])
  const last = (a: number[]) => (a.length ? a[a.length - 1] : null)
  const aSame = last(t.hist.acc[0]), aSwap = last(t.hist.acc[1])
  return (
    <Lab
      n="6.3"
      title="A rede que aprendeu o fundo"
      desc="Imite um banco de imagens em que as folhas sadias foram fotografadas sobre papel claro e as doentes sobre a bancada escura. Treine e depois teste com os fundos trocados, como acontece no campo."
    >
      <div className="controls">
        <Seg
          value={modo}
          options={['fundo denuncia a classe', 'fundo aleatório'] as const}
          onChange={(v) => {
            if (!t.running) {
              setModo(v)
              t.reset()
            }
          }}
          label="como o banco de treino foi montado"
        />
        <button type="button" className="btn" onClick={t.run} disabled={t.running}>
          <Play size={15} /> {t.running ? 'Treinando…' : 'Treinar 12 épocas'}
        </button>
        <button type="button" className="btn ghost" onClick={t.reset} disabled={t.running}>
          <RotateCcw size={15} /> Reiniciar
        </button>
      </div>
      <div className="lab-cols">
        <div className="panel">
          <div className="panel-t">
            <span>treino (amostra)</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 3 }}>
            {train.imgs.slice(0, 12).map((im, i) => (
              <ImgCanvas key={i} img={im} scale={3} pixelated label={train.Y[i] ? 'doente' : 'sadia'} />
            ))}
          </div>
          <div className="panel-t" style={{ marginTop: 6 }}>
            <span>teste "no campo": fundos trocados</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 3 }}>
            {swapped.imgs.slice(0, 12).map((im, i) => (
              <ImgCanvas key={i} img={im} scale={3} pixelated label={swapped.Y[i] ? 'doente' : 'sadia'} />
            ))}
          </div>
          <p className="note">As imagens se alternam: sadia, doente, sadia, doente…</p>
        </div>
        <div className="panel">
          <div className="stats">
            <div className="stat">
              <b>{aSame === null ? '·' : `${(aSame * 100).toFixed(0)}%`}</b>
              <span>teste parecido com o treino</span>
            </div>
            <div className="stat">
              <b style={{ color: aSwap === null ? undefined : aSwap < 0.7 ? 'var(--bad)' : 'var(--ok)' }}>{aSwap === null ? '·' : `${(aSwap * 100).toFixed(0)}%`}</b>
              <span>teste com fundos trocados</span>
            </div>
          </div>
          <LineChart
            series={[
              { name: 'parecido', data: t.hist.acc[0], color: 'var(--sky)' },
              { name: 'trocado', data: t.hist.acc[1], color: 'var(--soil)' },
            ]}
            ymin={0}
            ymax={1}
            xlabel="época"
          />
          <Legend items={[{ name: 'teste parecido com o treino', color: 'var(--sky)' }, { name: 'fundos trocados', color: 'var(--soil)' }]} />
        </div>
        <div className="panel">
          <div className="panel-t">
            <span>para onde a rede olha</span>
            <span>{sal ? `bordas/centro = ${sal.ratio.toFixed(2)}` : ''}</span>
          </div>
          {sal ? <ImgCanvas img={sal.g} lut={(v) => viridis(v / 255)} scale={12} pixelated label="mapa de saliência médio" /> : <div className="readout">Treine para ver o mapa de saliência.</div>}
          <p className="note">Mapa de saliência médio (|∂P/∂pixel|) em 60 imagens de teste. Amarelo = pixels que mais mudam a decisão. Se os cantos acendem mais que o centro, a rede está olhando o fundo.</p>
        </div>
      </div>
    </Lab>
  )
}

/* ============ conteúdo ============ */

const CODE_6 = `# Aula 6 · transfer learning com PyTorch (pastas: dados/treino/<classe>/*.jpg, dados/val/<classe>/*.jpg)
import torch, torch.nn as nn
from torchvision import datasets, models, transforms

tf_treino = transforms.Compose([
    transforms.RandomResizedCrop(224, scale=(0.6, 1.0)),
    transforms.RandomHorizontalFlip(), transforms.ColorJitter(0.3, 0.3, 0.3, 0.05),
    transforms.ToTensor(), transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])])
tf_val = transforms.Compose([
    transforms.Resize(256), transforms.CenterCrop(224),
    transforms.ToTensor(), transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])])

treino = datasets.ImageFolder("dados/treino", tf_treino)
val    = datasets.ImageFolder("dados/val", tf_val)
dl_t = torch.utils.data.DataLoader(treino, batch_size=32, shuffle=True)
dl_v = torch.utils.data.DataLoader(val, batch_size=64)

dev = "cuda" if torch.cuda.is_available() else "cpu"
rede = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)   # pré-treinada no ImageNet
for p in rede.parameters(): p.requires_grad = False               # congela o extrator
rede.fc = nn.Linear(rede.fc.in_features, len(treino.classes))      # nova cabeça
rede = rede.to(dev)
opt = torch.optim.Adam(rede.fc.parameters(), lr=1e-3)
perda = nn.CrossEntropyLoss()

for epoca in range(5):
    rede.train()
    for x, y in dl_t:
        x, y = x.to(dev), y.to(dev)
        opt.zero_grad(); l = perda(rede(x), y); l.backward(); opt.step()
    rede.eval(); certo = total = 0
    with torch.no_grad():
        for x, y in dl_v:
            certo += (rede(x.to(dev)).argmax(1).cpu() == y).sum().item(); total += len(y)
    print(f"época {epoca}: acurácia de validação = {certo / total:.3f}")`

const CODE_YOLO = `# Detecção de plantas daninhas com YOLO (pacote ultralytics)
# !pip install ultralytics
from ultralytics import YOLO

modelo = YOLO("yolov8n.pt")                        # pesos pré-treinados no COCO
modelo.train(data="daninhas.yaml", epochs=50, imgsz=640)
metricas = modelo.val()                            # mAP@0.5 e mAP@0.5:0.95
print(metricas.box.map50, metricas.box.map)

res = modelo("talhao_drone.jpg", conf=0.25)
res[0].save("talhao_detectado.jpg")`

export const aula6: Aula = {
  id: 'aula6',
  n: 6,
  trilha: 'mest',
  titulo: 'Redes que aprendem a enxergar',
  ideia: 'Uma CNN é a Aula 2 com os kernels aprendidos em vez de escolhidos. E ela aprende o atalho mais fácil que os seus dados deixarem.',
  ementa: ['Perceptron e retropropagação', 'Camadas convolucionais', 'Transfer learning', 'Detecção e segmentação', 'Aprendizado por atalho'],
  labs: ['Camada feita à mão', 'CNN no navegador', 'A rede que aprendeu o fundo'],
  cor: ['#440154', '#31688e', '#35b779', '#fde725'],
  objetivos: [
    'Relacionar convolução, ReLU e pooling com os filtros clássicos vistos na graduação.',
    'Descrever o treino de uma rede (perda, gradiente, épocas) e ler curvas de perda e acurácia.',
    'Diferenciar classificação, detecção e segmentação e as métricas de cada uma (acurácia, mAP, IoU).',
    'Identificar aprendizado por atalho e propor testes que o denunciem.',
  ],
  roteiro: [
    { t: 'Gancho: kernels que se escolhem sozinhos', min: 4, tipo: 'gancho' },
    { t: 'Do neurônio à CNN + Lab 6.1', min: 12, tipo: 'conceito' },
    { t: 'Treinando uma rede: Lab 6.2', min: 14, tipo: 'lab' },
    { t: 'Atalhos: Lab 6.3', min: 14, tipo: 'lab' },
    { t: 'Estado da arte no agro', min: 9, tipo: 'conceito' },
    { t: 'Fechamento + quiz', min: 7, tipo: 'fecho' },
  ],
  secoes: [
    {
      id: 'a6-gancho',
      titulo: 'E se os kernels se escolhessem sozinhos?',
      min: 4,
      body: (
        <div className="prose">
          <p>
            Na Aula 2, a gente escolheu os pesos do kernel à mão: Sobel para borda, média para suavizar. Na Aula 5, a gente escolheu os descritores à mão: matiz, % de marrom, contraste da GLCM. As duas
            escolhas exigem saber de antemão o que importa.
          </p>
          <p>
            Uma rede neural convolucional junta as duas etapas e deixa os <b>dados</b> escolherem os kernels. A ideia não é nova (LeCun et al., 1998), mas virou o padrão da visão computacional quando
            passamos a ter GPU e bancos grandes de imagens rotuladas.
          </p>
        </div>
      ),
    },
    {
      id: 'a6-cnn',
      titulo: 'Do neurônio à camada convolucional',
      min: 12,
      body: (
        <div className="prose">
          <p>
            O neurônio artificial (Haykin, cap. 1) faz uma soma ponderada das entradas, soma um viés e passa por uma função de ativação: <code>y = φ(Σ wᵢxᵢ + b)</code>. Repare: isso é exatamente a conta de
            um pixel de saída da convolução. Uma <b>camada convolucional</b> é um conjunto de neurônios que:
          </p>
          <ul>
            <li>
              olham só uma vizinhança pequena (campo receptivo 3×3, por exemplo);
            </li>
            <li>
              <b>compartilham os mesmos pesos</b> em todas as posições da imagem, porque uma pústula de ferrugem é pústula no canto ou no meio da folha;
            </li>
            <li>produzem um mapa de ativação por filtro.</li>
          </ul>
          <p>
            Depois vêm a <b>ReLU</b> (zera negativos), o <b>pooling</b> (reduz a resolução e dá tolerância a deslocamentos) e, no fim, camadas densas que combinam tudo numa decisão, com softmax para virar
            probabilidade.
          </p>
          <BancoFiltros />
          <Callout kind="analogia">
            <p>
              As primeiras camadas de uma CNN treinada parecem muito com Sobel e Gabor: bordas e texturas simples. As camadas do meio combinam isso em "pintinha", "nervura", "borda de folha". As últimas
              respondem a conceitos inteiros, como "folha com ferrugem". É uma escada de abstração, e cada degrau é uma convolução.
            </p>
          </Callout>
        </div>
      ),
    },
    {
      id: 'a6-treino',
      titulo: 'Treinar é descer a ladeira do erro',
      min: 14,
      body: (
        <div className="prose">
          <p>
            Treinar é ajustar todos os pesos para diminuir uma <b>função de perda</b> (aqui, a entropia cruzada). A{' '}
            <Term def="Algoritmo que calcula, pela regra da cadeia, quanto cada peso da rede contribuiu para o erro (o gradiente). Com o gradiente em mãos, cada peso anda um passo pequeno na direção que reduz a perda.">
              retropropagação
            </Term>{' '}
            calcula o gradiente da perda em relação a cada peso, e um otimizador (aqui, Adam) dá um passinho na direção que reduz o erro. Uma passada por todo o conjunto de treino é uma <b>época</b>.
          </p>
          <TreinarCNN />
          <Callout kind="pegadinha">
            <p>
              Se a acurácia de treino continua subindo e a de teste para ou cai, a rede começou a decorar o treino (sobreajuste). Aumento de dados (girar, espelhar, variar o brilho), regularização e parar
              mais cedo são as defesas clássicas.
            </p>
          </Callout>
          <Callout kind="prof">
            <p>
              Toda a rede do Lab 6.2 está em cerca de 200 linhas de TypeScript, sem biblioteca, no arquivo <code>src/lib/cnn.ts</code> do repositório. Vale projetar o forward e o backward lado a lado e
              mostrar que é só multiplicação, soma e regra da cadeia.
            </p>
          </Callout>
        </div>
      ),
    },
    {
      id: 'a6-atalho',
      titulo: 'O atalho mais fácil',
      min: 14,
      body: (
        <div className="prose">
          <p>
            A rede não sabe o que você <i>quis</i> ensinar. Ela minimiza a perda do jeito mais barato que os dados permitirem. Se no banco de treino toda folha doente foi fotografada sobre uma bancada escura,
            "fundo escuro" é um preditor perfeito e muito mais fácil de aprender que "pústula de 1 mm". Isso tem nome:{' '}
            <Term def="Shortcut learning (Geirhos et al., 2020): quando o modelo resolve a tarefa de treino usando uma pista espúria que funciona no conjunto de dados, mas não no mundo real.">aprendizado por atalho</Term>.
          </p>
          <Atalho />
          <Callout kind="campo">
            <p>
              O PlantVillage, banco com dezenas de milhares de fotos de folhas destacadas em fundo uniforme, foi base de um trabalho muito citado (Mohanty et al., 2016) com mais de 99% de acurácia. No mesmo
              artigo, testando em imagens de outras fontes, a acurácia caiu para cerca de 31%. Anos depois, Noyan (2022) mostrou que um modelo que vê apenas alguns pixels do fundo, sem nenhum pedaço de
              folha, acerta muito acima do acaso nesse banco.
            </p>
          </Callout>
          <p>Testes que ajudam a pegar atalhos antes de publicar:</p>
          <ol>
            <li>Validar em dados de outra origem (outra fazenda, outra câmera, outra safra), como na Aula 5.</li>
            <li>Olhar mapas de saliência ou Grad-CAM (Selvaraju et al., 2017) e conferir se a rede olha para a lesão.</li>
            <li>Mascarar o objeto e ver se o modelo ainda "acerta" só com o fundo. Se acertar, tem atalho.</li>
          </ol>
        </div>
      ),
    },
    {
      id: 'a6-estado',
      titulo: 'Classificar, detectar, segmentar',
      min: 9,
      body: (
        <div className="prose">
          <p>No agro, as três tarefas principais de visão respondem a perguntas diferentes:</p>
          <ul>
            <li>
              <b>Classificação</b> (ResNet, EfficientNet, Vision Transformers): "esta folha tem ferrugem?". Métricas: acurácia, F1, matriz de confusão.
            </li>
            <li>
              <b>Detecção</b> (família YOLO, Faster R-CNN): "onde estão as daninhas neste ortomosaico e quantas são?". Cada objeto vira uma caixa. Métrica: mAP, que usa o{' '}
              <Term def="Intersection over Union: área da interseção entre a caixa prevista e a verdadeira dividida pela área da união das duas. 1 é encaixe perfeito. Uma detecção costuma contar como acerto com IoU ≥ 0,5.">IoU</Term>{' '}
              para decidir se a caixa prevista bate com a real.
            </li>
            <li>
              <b>Segmentação semântica</b> (U-Net, DeepLab): "quais pixels são lesão?". Dá a severidade em % da área foliar. Métrica: IoU por classe.
            </li>
          </ul>
          <p>
            Com poucos dados rotulados, o caminho quase sempre é <b>transfer learning</b>: começar de uma rede pré-treinada no ImageNet e ajustar só as últimas camadas. As primeiras camadas (bordas e
            texturas) servem para quase qualquer imagem, inclusive de folha.
          </p>
          <Code code={CODE_6} title="Python · PyTorch + torchvision" />
          <Code code={CODE_YOLO} title="Python · ultralytics (YOLO)" />
        </div>
      ),
    },
    {
      id: 'a6-fecho',
      titulo: 'Pra levar pra casa',
      min: 7,
      body: (
        <div className="prose">
          <Callout kind="prof" title="Pra fechar a trilha">
            <p>
              O artigo dos tomates (Aula 1) termina dizendo que o próximo passo seria aprendizado de máquina. Peça para a turma desenhar esse estudo em cinco minutos: que fotos coletar, em quantas
              beneficiadoras e luzes, como separar treino e teste e como checar se a rede olha o tomate e não a esteira.
            </p>
          </Callout>
          <ol>
            <li>Convolução + ReLU + pooling, empilhados, formam uma escada de abstração. Os kernels são aprendidos por retropropagação.</li>
            <li>Curva de treino subindo com teste parado é sobreajuste. Validação em outra origem de dados é obrigatória.</li>
            <li>A rede aprende qualquer pista que separe as classes, inclusive o fundo. Mapas de saliência e testes com o fundo trocado revelam o atalho.</li>
          </ol>
        </div>
      ),
    },
  ],
  quiz: [
    { p: 'Uma camada conv com 6 filtros 3×3 sobre uma entrada RGB tem quantos pesos, sem contar o viés?', o: ['54', '162', '27', '6'], a: 1, e: 'Cada filtro tem 3×3×3 = 27 pesos (um 3×3 por canal). 6 filtros × 27 = 162.' },
    { p: 'O que o max-pooling 2×2 faz?', o: ['Dobra a resolução', 'Guarda o maior valor de cada bloco 2×2, reduzindo a resolução pela metade em cada eixo', 'Aplica a ReLU', 'Normaliza as cores'], a: 1, e: 'Menos pixels para as próximas camadas e tolerância a pequenos deslocamentos do padrão.' },
    { p: 'Você tem só 300 fotos rotuladas de folhas. Qual estratégia costuma funcionar melhor?', o: ['Treinar uma ResNet-152 do zero', 'Transfer learning a partir de uma rede pré-treinada', 'Usar só a banda azul', 'Aumentar o learning rate para 1'], a: 1, e: 'As camadas iniciais pré-treinadas já sabem detectar bordas e texturas. Ajustar só o topo exige bem menos dados.' },
    { p: 'Um modelo tem 99% no banco de imagens e 35% em fotos do campo. Qual a suspeita principal?', o: ['Pouca época de treino', 'Aprendizado por atalho ou mudança de domínio (fundo, luz, câmera)', 'Erro de arredondamento', 'Imagens em alta resolução demais'], a: 1, e: 'O modelo provavelmente aprendeu pistas do banco (fundo, iluminação, enquadramento) que não existem no campo.' },
    { p: 'Duas caixas têm área 100 cada e se sobrepõem em 50. Qual o IoU?', o: ['0,25', '0,33', '0,50', '1,0'], a: 1, e: 'União = 100 + 100 − 50 = 150. IoU = 50/150 ≈ 0,33, abaixo do corte usual de 0,5.' },
  ],
  desafios: [
    { nivel: 'aquecimento', txt: <>No Lab 6.2, reinicie os pesos três vezes e anote a acurácia de teste final. Por que ela varia? O que isso diz sobre reportar um único número?</> },
    { nivel: 'mão na massa', txt: <>Rode o transfer learning com duas pastas de fotos tiradas pela turma (por exemplo, folhas sadias e com sintoma). Separe treino e validação por aluno fotógrafo, não por foto.</> },
    { nivel: 'investigação', txt: <>Pegue um modelo treinado e aplique Grad-CAM (pacote <code>pytorch-grad-cam</code>) em 20 imagens. Em quantas a região quente está na lesão? Escreva um parágrafo como se fosse a seção de limitações de um artigo.</> },
  ],
  leitura: [
    <>HAYKIN, S. <i>Redes neurais: princípios e prática</i>. 2. ed. Bookman, 2001. Capítulos sobre o neurônio, o perceptron multicamadas e a retropropagação.</>,
    <>BISHOP, C. M. <i>Neural networks for pattern recognition</i>. Oxford University Press, 2002. Funções de erro e otimização.</>,
    <>LECUN, Y. et al. Gradient-based learning applied to document recognition. <i>Proceedings of the IEEE</i>, v. 86, n. 11, p. 2278–2324, 1998.</>,
    <>MOHANTY, S. P.; HUGHES, D. P.; SALATHÉ, M. Using deep learning for image-based plant disease detection. <i>Frontiers in Plant Science</i>, v. 7, 1419, 2016.</>,
    <>GEIRHOS, R. et al. Shortcut learning in deep neural networks. <i>Nature Machine Intelligence</i>, v. 2, p. 665–673, 2020.</>,
    <>NOYAN, M. A. Uncovering bias in the PlantVillage dataset. arXiv:2206.04374, 2022.</>,
    <>KAMILARIS, A.; PRENAFETA-BOLDÚ, F. X. Deep learning in agriculture: a survey. <i>Computers and Electronics in Agriculture</i>, v. 147, p. 70–90, 2018.</>,
  ],
}
