import { secaoTomate } from '../casos/Tomate'
import { useMemo, useState } from 'react'
import { type RGB, pixelate, quantize, plane, histogram, rgb2hsv, rgb2lab, hsv2rgb, type ColorPlane } from '../lib/img'
import { makeField } from '../lib/synth'
import { ImgCanvas, Slider, Seg, SourcePicker, Lab, Callout, Term, Code, Histogram, rgbStr } from '../ui'
import { memo, useSource } from '../samples'
import type { Aula } from '../lesson'

/* ============ Lab 1.1 · lupa de pixels ============ */

function LupaPixels() {
  const src = useSource('lavoura')
  const [p, setP] = useState<[number, number]>([140, 110])
  const [modo, setModo] = useState<'RGB' | 'R' | 'G' | 'B'>('RGB')
  const img = src.img
  const R = 3
  const cells: { c: [number, number, number]; x: number; y: number }[] = []
  for (let j = -R; j <= R; j++)
    for (let i = -R; i <= R; i++) {
      const x = Math.min(img.w - 1, Math.max(0, p[0] + i)), y = Math.min(img.h - 1, Math.max(0, p[1] + j))
      const k = (y * img.w + x) * 3
      cells.push({ c: [img.data[k], img.data[k + 1], img.data[k + 2]], x, y })
    }
  const overlay = useMemo(
    () => (ctx: CanvasRenderingContext2D, s: number) => {
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.strokeRect((p[0] - R) * s, (p[1] - R) * s, (2 * R + 1) * s, (2 * R + 1) * s)
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 1
      ctx.strokeRect((p[0] - R) * s - 2, (p[1] - R) * s - 2, (2 * R + 1) * s + 4, (2 * R + 1) * s + 4)
    },
    [p],
  )
  const ci = modo === 'R' ? 0 : modo === 'G' ? 1 : modo === 'B' ? 2 : -1
  return (
    <Lab n="1.1" title="Lupa de pixels" desc="Passe o mouse (ou o dedo) sobre a imagem. À direita aparecem os números que o computador realmente enxerga em volta daquele ponto.">
      <SourcePicker {...src.pickerProps} />
      <div className="lab-cols two">
        <div className="panel">
          <div className="panel-t">
            <span>imagem · {img.w}×{img.h} px</span>
            <span>
              (x={p[0]}, y={p[1]})
            </span>
          </div>
          <ImgCanvas img={img} overlay={overlay} onPixel={(x, y) => setP([x, y])} label="imagem para inspecionar pixels" />
        </div>
        <div className="panel">
          <div className="panel-t">
            <span>vizinhança 7×7</span>
            <Seg value={modo} options={['RGB', 'R', 'G', 'B'] as const} onChange={setModo} />
          </div>
          <div className="pxgrid" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {cells.map((c, i) => {
              const show: [number, number, number] = ci < 0 ? c.c : [ci === 0 ? c.c[0] : 0, ci === 1 ? c.c[1] : 0, ci === 2 ? c.c[2] : 0]
              const lum = 0.299 * show[0] + 0.587 * show[1] + 0.114 * show[2]
              return (
                <div key={i} style={{ background: rgbStr(show), color: lum > 120 ? '#111' : '#f4f4f4', outline: i === 24 ? '2px solid var(--grain)' : undefined }}>
                  {ci < 0 ? (
                    <>
                      <span>{Math.round(c.c[0])}</span>
                      <span>{Math.round(c.c[1])}</span>
                      <span>{Math.round(c.c[2])}</span>
                    </>
                  ) : (
                    <span style={{ fontSize: '0.72rem' }}>{Math.round((c.c as number[])[ci])}</span>
                  )}
                </div>
              )
            })}
          </div>
          <p className="note">
            Cada quadradinho é um pixel. No modo RGB, os três números são R, G e B (de 0 a 255). Tente achar um pixel de planta: o G ganha dos outros dois?
          </p>
        </div>
      </div>
    </Lab>
  )
}

/* ============ Lab 1.2 · GSD, amostragem e quantização ============ */

const SENSOR_MM = 13.2, FOCAL_MM = 8.8, IMG_W = 5472, IMG_H = 3648
const BASE_GSD = 0.5 // cm/px da imagem sintética

function Amostragem() {
  const [alt, setAlt] = useState(40)
  const [bits, setBits] = useState(8)
  const [seed, setSeed] = useState(3)
  const scene = memo(`gsd${seed}`, () => makeField(360, 240, seed, { espacamento: 90, passo: 15, cobertura: 0.28, daninhas: 34, estresse: 0.2, angulo: 4 }))
  const gsd = (alt * 100 * SENSOR_MM) / (FOCAL_MM * IMG_W) // cm/px
  const block = Math.max(1, Math.round(gsd / BASE_GSD))
  const out = useMemo(() => quantize(pixelate(scene.rgb, block), bits), [scene, block, bits])
  const footW = (gsd * IMG_W) / 100, footH = (gsd * IMG_H) / 100
  const efetiva = footW * footH * 0.25 * 0.3
  const fotos = Math.ceil(1_000_000 / efetiva)
  const mb = (IMG_W * IMG_H * 3 * bits) / 8 / 1e6
  return (
    <Lab
      n="1.2"
      title="Qual altura voar? (amostragem e quantização)"
      desc="A imagem mostra plântulas de soja com algumas plantas daninhas pequenas na entrelinha. Suba o drone e veja quando as daninhas deixam de ser enxergáveis. Depois, reduza os bits."
    >
      <div className="controls">
        <Slider id="alt" label="altura de voo" value={alt} min={10} max={120} step={5} onChange={setAlt} fmt={(v) => `${v} m`} />
        <Slider id="bits" label="bits por canal" value={bits} min={1} max={8} onChange={setBits} fmt={(v) => `${v} bits = ${2 ** v} níveis`} />
        <button type="button" className="btn ghost" onClick={() => setSeed((s) => s + 1)}>
          Outro talhão
        </button>
      </div>
      <div className="lab-cols two">
        <div className="panel">
          <div className="panel-t">
            <span>como a câmera vê a {alt} m</span>
            <span>1 pixel ≈ {gsd.toFixed(2)} cm</span>
          </div>
          <ImgCanvas img={out} pixelated label="talhão simulado na altura escolhida" />
        </div>
        <div className="panel">
          <div className="formula">
            GSD = (H × largura_sensor) / (f × largura_imagem)
            <br />= ({alt} m × 100 × {SENSOR_MM} mm) / ({FOCAL_MM} mm × {IMG_W} px)
            <br />= <b>{gsd.toFixed(2)} cm/px</b>
          </div>
          <div className="stats">
            <div className="stat">
              <b>
                {footW.toFixed(0)} × {footH.toFixed(0)} m
              </b>
              <span>área de 1 foto no chão</span>
            </div>
            <div className="stat">
              <b>{fotos.toLocaleString('pt-BR')}</b>
              <span>fotos p/ cobrir 100 ha*</span>
            </div>
            <div className="stat">
              <b>{mb.toFixed(1)} MB</b>
              <span>1 foto sem compressão</span>
            </div>
            <div className="stat">
              <b>{((fotos * mb) / 1000).toFixed(0)} GB</b>
              <span>o voo inteiro, cru</span>
            </div>
          </div>
          <p className="note">
            *Com 75% de sobreposição frontal e 70% lateral, valores comuns para gerar ortomosaico. Câmera de referência: sensor de 1″ (13,2 mm), lente de 8,8 mm, 5472×3648 px, típica de drones
            RGB de mapeamento.
          </p>
        </div>
      </div>
    </Lab>
  )
}

/* ============ Lab 1.3 · espaços de cor ============ */

const PLANES: ColorPlane[] = ['R', 'G', 'B', 'Cinza', 'H', 'S', 'V', 'L*', 'a*', 'b*']
const hueLUT = (v: number) => hsv2rgb((v / 255) * 359, 0.85, 0.95) as [number, number, number]

function EspacosDeCor() {
  const src = useSource('folha')
  const [pl, setPl] = useState<ColorPlane>('a*')
  const [pick, setPick] = useState<[number, number] | null>(null)
  const img: RGB = src.img
  const g = useMemo(() => plane(img, pl), [img, pl])
  const hist = useMemo(() => histogram(g, 64), [g])
  const px = pick ?? [Math.floor(img.w / 2), Math.floor(img.h / 2)]
  const k = (px[1] * img.w + px[0]) * 3
  const c: [number, number, number] = [img.data[k], img.data[k + 1], img.data[k + 2]]
  const [h, s, v] = rgb2hsv(...c)
  const [L, A, B] = rgb2lab(...c)
  const overlay = useMemo(
    () => (ctx: CanvasRenderingContext2D, sc: number) => {
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc((px[0] + 0.5) * sc, (px[1] + 0.5) * sc, 7, 0, Math.PI * 2)
      ctx.stroke()
    },
    [px],
  )
  const dica: Partial<Record<ColorPlane, string>> = {
    H: 'Matiz em cores falsas: a folha fica toda da mesma "faixa" mesmo onde há sombra. As lesões marrons caem em outra faixa.',
    'a*': 'Eixo verde ↔ vermelho. Verde é escuro aqui (a* negativo). Lesões e solo ficam claros. Um limiar nesse canal já separa muita coisa.',
    V: 'Brilho puro. Sombra e luz dominam este canal, por isso ele é ruim para separar planta de solo.',
    S: 'Saturação: quão "pura" é a cor. Palha e fundo cinza têm S baixa.',
    G: 'O canal verde sozinho engana: solo claro também tem G alto.',
  }
  return (
    <Lab n="1.3" title="A mesma folha em 10 canais" desc="Escolha um canal e clique na imagem para ler o pixel nos três espaços de cor. Qual canal separa melhor a lesão do tecido sadio?">
      <SourcePicker {...src.pickerProps} />
      <Seg value={pl} options={PLANES} onChange={setPl} label="canal" />
      <div className="lab-cols">
        <div className="panel">
          <div className="panel-t">
            <span>original</span>
            <span>clique para ler um pixel</span>
          </div>
          <ImgCanvas img={img} overlay={overlay} onClickPixel={(x, y) => setPick([x, y])} label="imagem original" />
        </div>
        <div className="panel">
          <div className="panel-t">
            <span>canal {pl}</span>
            <span>{pl === 'H' ? 'cores = matiz' : 'claro = valor alto'}</span>
          </div>
          <ImgCanvas img={g} lut={pl === 'H' ? hueLUT : undefined} overlay={overlay} onClickPixel={(x, y) => setPick([x, y])} label={`canal ${pl}`} />
        </div>
      </div>
      <div className="lab-cols">
        <div className="panel">
          <div className="panel-t">
            <span>histograma do canal {pl}</span>
          </div>
          <Histogram data={hist} color="var(--sky)" />
          {dica[pl] && <p className="note">{dica[pl]}</p>}
        </div>
        <div className="panel">
          <div className="panel-t">
            <span>pixel ({px[0]}, {px[1]})</span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
            <div style={{ width: 56, borderRadius: 8, background: rgbStr(c), border: '1px solid var(--rule)' }} />
            <div className="readout" style={{ flex: 1 }}>
              RGB&nbsp; {c.map((v) => Math.round(v)).join(', ')}
              <br />
              HSV&nbsp; {h.toFixed(0)}°, {(s * 100).toFixed(0)}%, {(v * 100).toFixed(0)}%
              <br />
              L*a*b* {L.toFixed(0)}, {A.toFixed(0)}, {B.toFixed(0)}
            </div>
          </div>
        </div>
      </div>
    </Lab>
  )
}

/* ============ conteúdo ============ */

const CODE_1 = `# Aula 1 · a imagem é uma matriz
import numpy as np
import matplotlib.pyplot as plt
from skimage import io, color
from google.colab import files

nome = list(files.upload().keys())[0]     # envie uma foto de folha ou de lavoura
img = io.imread(nome)[..., :3]            # descarta o canal alfa, se existir
print(img.shape, img.dtype)               # (altura, largura, 3) uint8
print("pixel (linha 100, coluna 50):", img[100, 50])   # [R G B]

hsv = color.rgb2hsv(img)                  # H, S e V entre 0 e 1
lab = color.rgb2lab(img)                  # L* de 0 a 100; a* e b* negativos e positivos

fig, ax = plt.subplots(1, 4, figsize=(16, 4))
ax[0].imshow(img); ax[0].set_title("RGB")
ax[1].imshow(hsv[..., 0], cmap="hsv"); ax[1].set_title("H (matiz)")
ax[2].imshow(lab[..., 1], cmap="RdYlGn_r"); ax[2].set_title("a*  (verde <-> vermelho)")
ax[3].hist(img[..., 1].ravel(), bins=256, color="green"); ax[3].set_title("histograma do G")
for a in ax[:3]: a.axis("off")
plt.show()

# quantização: quantos níveis você aguenta perder?
for bits in [8, 4, 2, 1]:
    passo = 256 // 2**bits
    q = (img // passo) * passo
    print(bits, "bits ->", len(np.unique(q[..., 1])), "tons de verde")`

const CODE_GSD = `# GSD: quantos centímetros de chão cabem em 1 pixel
def gsd_cm(altura_m, sensor_mm=13.2, focal_mm=8.8, largura_px=5472):
    return altura_m * 100 * sensor_mm / (focal_mm * largura_px)

for h in [30, 60, 90, 120]:
    print(f"{h:>4} m -> {gsd_cm(h):.2f} cm/px")`

export const aula1: Aula = {
  id: 'aula1',
  n: 1,
  trilha: 'grad',
  titulo: 'A lavoura vira uma planilha',
  ideia: 'O computador não vê folha nem soja. Ele vê uma tabela de números, e tudo o que faremos no semestre é conta em cima dessa tabela.',
  ementa: ['Aquisição de imagens', 'Amostragem e quantização', 'Espaços de cor', 'Histograma'],
  labs: ['Lupa de pixels', 'Altura de voo e GSD', '10 canais de cor', 'Caso real: tomates'],
  cor: ['#6aa84f', '#b3861a', '#9a4a2c', '#2d6a8a'],
  objetivos: [
    'Explicar uma imagem digital como a função f(x, y) amostrada e quantizada.',
    'Calcular o GSD de um voo de drone e decidir a altura certa para um objetivo agronômico.',
    'Converter entre RGB, HSV e L*a*b* e justificar qual espaço usar para separar planta, solo e lesão.',
    'Ler um histograma e dizer o que ele mostra e o que ele esconde.',
    'Reproduzir o classificador de maturação de tomate de um artigo e achar o erro de unidade que ele esconde.',
  ],
  roteiro: [
    { t: 'Gancho: quantos números tem uma foto?', min: 5, tipo: 'gancho' },
    { t: 'Imagem como matriz + Lab 1.1', min: 10, tipo: 'conceito' },
    { t: 'Aquisição e GSD + Lab 1.2', min: 12, tipo: 'lab' },
    { t: 'Espaços de cor', min: 7, tipo: 'conceito' },
    { t: 'Lab 1.3', min: 9, tipo: 'lab' },
    { t: 'Caso real: tomates + Lab 1.4', min: 10, tipo: 'lab' },
    { t: 'Fechamento + quiz', min: 7, tipo: 'fecho' },
  ],
  secoes: [
    {
      id: 'a1-gancho',
      titulo: 'Quantos números tem uma foto?',
      min: 5,
      body: (
        <div className="prose">
          <p>
            Comece a aula com uma pergunta simples: <b>uma foto de celular de 12 megapixels tem quantos números dentro dela?</b> Deixe a turma chutar. A resposta é 36 milhões: 12 milhões de pixels, cada um
            com três valores (vermelho, verde e azul).
          </p>
          <p>
            Agora imagine um drone que tira 2.000 fotos por voo sobre um talhão de soja. Isso passa de 70 bilhões de números. Ninguém olha isso a olho. É aí que entra o processamento digital de imagens:
            transformar essa montanha de números em uma resposta que o produtor entende, como <i>"a mancha de estresse ocupa 3,2 ha no canto norte"</i>.
          </p>
          <Callout kind="prof">
            <p>
              Peça para cada aluno abrir a câmera do celular e olhar a resolução nas configurações. Anote na lousa os valores. Serve de gancho para o cálculo do GSD daqui a pouco.
            </p>
          </Callout>
        </div>
      ),
    },
    {
      id: 'a1-matriz',
      titulo: 'A imagem é uma função f(x, y)',
      min: 10,
      body: (
        <div className="prose">
          <p>
            Gonzalez e Woods definem a imagem como uma função bidimensional <code>f(x, y)</code>, em que <code>x</code> e <code>y</code> são coordenadas espaciais e o valor de <code>f</code> é a
            intensidade naquele ponto. Ela vira <b>digital</b> quando fazemos duas discretizações:
          </p>
          <ol>
            <li>
              <b>
                <Term def="Discretizar as coordenadas: decidir em quantos pontos (pixels) o mundo contínuo vai ser dividido. Define a resolução espacial.">Amostragem</Term>
              </b>
              : quantos pixels usamos para cobrir a cena (resolução espacial).
            </li>
            <li>
              <b>
                <Term def="Discretizar a intensidade: decidir quantos níveis de valor cada pixel pode assumir. Com 8 bits, são 256 níveis (0 a 255).">Quantização</Term>
              </b>
              : quantos níveis de intensidade cada pixel pode ter (resolução radiométrica).
            </li>
          </ol>
          <Callout kind="analogia">
            <p>
              Pense numa planilha de Excel. Cada célula é um pixel e guarda um número de 0 a 255. Uma imagem em tons de cinza é <b>uma</b> planilha. Uma imagem colorida são <b>três planilhas
              empilhadas</b>, uma para o vermelho, uma para o verde e uma para o azul. Quando alguém disser "canal G", pense "a aba verde da planilha".
            </p>
          </Callout>
          <p>
            Por convenção, a origem fica no <b>canto superior esquerdo</b>, e em Python acessamos <code>img[linha, coluna]</code>, ou seja, <code>img[y, x]</code>. Essa inversão confunde todo mundo
            pelo menos uma vez no semestre.
          </p>
          <LupaPixels />
        </div>
      ),
    },
    {
      id: 'a1-aquisicao',
      titulo: 'Do sensor ao pixel: aquisição',
      min: 12,
      body: (
        <div className="prose">
          <p>
            O sensor da câmera só mede <b>quanta luz chegou</b> em cada fotossítio. Ele não sabe a cor. Para ter cor, existe um mosaico de filtros na frente do sensor, o{' '}
            <Term def="Padrão de filtros coloridos em cima do sensor: em cada bloco 2×2 há um filtro vermelho, um azul e dois verdes (RGGB). A câmera depois interpola as cores que faltam em cada pixel (demosaicing).">
              filtro de Bayer
            </Term>
            , com o dobro de filtros verdes em relação a vermelhos e azuis. Curiosidade que ajuda a lembrar: a câmera comum já nasce com mais sensibilidade ao verde, igualzinho ao nosso olho.
          </p>
          <h3>GSD: o número mais importante de um voo</h3>
          <p>
            No agro, a pergunta prática da amostragem é: <b>quantos centímetros de chão cabem em um pixel?</b> Isso se chama{' '}
            <Term def="Ground Sample Distance: a distância no terreno entre os centros de dois pixels vizinhos. GSD de 2 cm/px significa que cada pixel cobre um quadrado de 2 × 2 cm no chão.">GSD</Term>. Ele
            cresce em linha reta com a altura de voo. Dobrou a altura, dobrou o GSD, e cada pixel passa a cobrir quatro vezes mais área.
          </p>
          <Callout kind="campo">
            <p>
              Uma regra prática: para detectar um objeto com confiança, ele precisa ocupar pelo menos alguns pixels de lado. Uma plântula daninha de 2 cm pede GSD bem abaixo de 1 cm/px. Já para ver a
              mancha de estresse de um talhão inteiro, 5 cm/px ou até imagem de satélite resolvem. No Brasil, o teto usual para drones é 120 m acima do solo, então altura também tem limite legal.
            </p>
          </Callout>
          <Amostragem />
          <Code code={CODE_GSD} />
          <p>
            Repare no painel da direita: diminuir a altura melhora o GSD, mas o número de fotos cresce com o quadrado. Voar a 20 m em vez de 40 m quadruplica fotos, bateria e tempo de processamento. Não
            existe altura "certa", existe altura certa <b>para uma pergunta</b>.
          </p>
        </div>
      ),
    },
    {
      id: 'a1-cor',
      titulo: 'Espaços de cor: RGB, HSV e L*a*b*',
      min: 16,
      body: (
        <div className="prose">
          <p>
            RGB é o jeito como a câmera grava, mas mistura duas coisas numa só: <b>que cor é</b> e <b>quanta luz tem</b>. Uma folha ao sol e a mesma folha à sombra têm valores RGB bem diferentes. Por isso
            existem outros espaços:
          </p>
          <ul>
            <li>
              <b>HSV</b>: separa a matiz (H, o "nome" da cor, em graus de 0 a 360), a saturação (S, quão pura) e o valor (V, o brilho). Sombra mexe muito em V e pouco em H.
            </li>
            <li>
              <b>L*a*b*</b>: pensado para ser perceptualmente uniforme. L* é a luminosidade, a* vai do verde (negativo) ao vermelho (positivo) e b* do azul ao amarelo. Para agro, o a* é quase um
              "detector de verde" pronto.
            </li>
          </ul>
          <Callout kind="analogia">
            <p>
              RGB é a receita do pintor (quanto de cada tinta). HSV é como a gente descreve a cor falando: "um verde meio apagado e escuro". Por isso HSV é mais fácil de usar em regra de decisão.
            </p>
          </Callout>
          <EspacosDeCor />
          <Callout kind="pegadinha">
            <p>
              <b>1.</b> A matiz é circular: 0° e 359° são o mesmo vermelho. Tirar a média de H de pixels avermelhados dá um valor verde no meio do caminho, e errado.
            </p>
            <p>
              <b>2.</b> O OpenCV lê imagens em ordem <b>BGR</b>, não RGB, e guarda H de 0 a 179 (metade dos graus) para caber em 8 bits. O scikit-image usa RGB e H de 0 a 1. Sempre confira a
              documentação antes de copiar um limiar de um artigo.
            </p>
          </Callout>
          <h3>O histograma</h3>
          <p>
            O histograma conta quantos pixels existem em cada nível de intensidade. Ele mostra contraste, exposição e, muitas vezes, se dá para separar dois grupos com um corte só (dois "morros" bem
            separados). Ele <b>não</b> mostra onde os pixels estão: uma folha com uma lesão grande e uma folha com cem lesões pequenas podem ter o mesmo histograma.
          </p>
        </div>
      ),
    },
    secaoTomate,
    {
      id: 'a1-fecho',
      titulo: 'Pra levar pra casa',
      min: 7,
      body: (
        <div className="prose">
          <ol>
            <li>Imagem digital é uma matriz de números: amostrada no espaço (pixels) e quantizada na intensidade (bits).</li>
            <li>No campo, a amostragem se decide pelo GSD, que depende da altura, do sensor e da lente. A escolha vem da pergunta agronômica.</li>
            <li>RGB mistura cor e iluminação. HSV e L*a*b* separam as duas coisas e deixam a segmentação mais robusta à sombra.</li>
          </ol>
          <Code code={CODE_1} />
        </div>
      ),
    },
  ],
  quiz: [
    { p: 'Uma foto RGB de 4000 × 3000 pixels, 8 bits por canal, guarda quantos valores numéricos?', o: ['12 milhões', '36 milhões', '96 milhões', '288 milhões'], a: 1, e: '4000 × 3000 = 12 milhões de pixels, vezes 3 canais = 36 milhões de valores. (96 milhões seria o número de bits dividido por 3, confusão comum.)' },
    { p: 'Com 3 bits por canal, cada canal pode assumir quantos níveis?', o: ['3', '6', '8', '256'], a: 2, e: '2³ = 8 níveis. Com 8 bits, 2⁸ = 256.' },
    { p: 'O drone sobe de 30 m para 60 m com a mesma câmera. O que acontece com o GSD?', o: ['Cai pela metade', 'Não muda', 'Dobra, e cada pixel cobre 4× mais área', 'Quadruplica'], a: 2, e: 'O GSD é proporcional à altura. Dobrou a altura, dobrou o lado do pixel no chão, e a área coberta por pixel cresce 4 vezes.' },
    { p: 'Por que HSV costuma funcionar melhor que RGB para separar folha de solo em fotos com sombra?', o: ['Porque tem mais canais', 'Porque a sombra altera principalmente o V e pouco o H', 'Porque HSV é o formato da câmera', 'Porque HSV tem 16 bits'], a: 1, e: 'A sombra reduz o brilho (V). A matiz (H) da folha continua na faixa do verde, então um corte em H resiste melhor à variação de luz.' },
    { p: 'Você carregou uma imagem com cv2.imread e o canal img[:,:,0] parece ser o azul. Por quê?', o: ['A imagem está corrompida', 'O OpenCV usa a ordem BGR', 'O índice 0 é sempre o alfa', 'O OpenCV converte para HSV automaticamente'], a: 1, e: 'O OpenCV guarda os canais em ordem BGR. Use cv2.cvtColor(img, cv2.COLOR_BGR2RGB) antes de mostrar com matplotlib.' },
  ],
  desafios: [
    { nivel: 'aquecimento', txt: <>Calcule o GSD de um voo a 80 m com a câmera de referência (13,2 mm, 8,8 mm, 5472 px). Qual o tamanho de uma foto no chão, em metros?</> },
    { nivel: 'mão na massa', txt: <>No Colab, carregue uma foto de folha e encontre o pixel com o menor valor de a* (o "mais verde"). Marque-o com um círculo usando matplotlib.</> },
    { nivel: 'investigação', txt: <>Fotografe a mesma folha ao sol e à sombra. Compare os histogramas de V e de H das duas fotos. Qual canal mudou mais? Escreva três linhas explicando o porquê.</> },
  ],
  leitura: [
    <>GONZALEZ, R. C.; WOODS, R. E. <i>Processamento digital de imagens</i>. 3. ed. Pearson, 2010. Cap. 2 (fundamentos: aquisição, amostragem e quantização) e cap. 6 (processamento de imagens coloridas).</>,
    <>PEDRINI, H.; SCHWARTZ, W. R. <i>Análise de imagens digitais: princípios, algoritmos e aplicações</i>. Thomson, 2008. Capítulos iniciais sobre fundamentos e sistemas de cor.</>,
    <>SOLOMON, C.; BRECKON, T. <i>Fundamentos de processamento digital de imagens</i>. LTC, 2013. Formação da imagem e cor, com exemplos práticos.</>,
    <>NOGUTI JÚNIOR, J.; SANTOS, S. S. L.; FLORIAN, F. Visão computacional aplicada na agroindústria. <i>Revista FT</i>, v. 27, ed. 129, 2023. DOI: 10.5281/zenodo.10385278.</>,
  ],
}
