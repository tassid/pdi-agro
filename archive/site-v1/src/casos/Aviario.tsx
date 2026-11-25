import { useMemo, useState } from 'react'
import { maskToGray } from '../lib/img'
import { makeAviario, aveMask, contarAves, type PreAve, type ContaAve } from '../lib/casos'
import { ImgCanvas, Seg, Slider, Lab, Callout, Caso, Code } from '../ui'
import { memo } from '../samples'
import { Shuffle } from 'lucide-react'

type Vista = 'câmera' | 'fundo (modelo)' | 'depois do pré-processamento' | 'máscara'
type Modelo = 'mesma câmera, sem aves' | 'outro vídeo, câmera deslocada'

export function LabAviario() {
  const [seed, setSeed] = useState(4)
  const [n, setN] = useState(130)
  const [pre, setPre] = useState<PreAve>('subtração de fundo + inRange')
  const [modelo, setModelo] = useState<Modelo>('mesma câmera, sem aves')
  const [conta, setConta] = useState<ContaAve>('pixels ÷ área da ave')
  const [lo, setLo] = useState(40)
  const [vista, setVista] = useState<Vista>('máscara')
  const cena = memo(`av-${seed}-${n}`, () => makeAviario(seed, n))
  const fundo = modelo === 'mesma câmera, sem aves' ? cena.fundo : cena.fundoOutro
  const { base, mask } = useMemo(() => aveMask(cena.img, fundo, pre, lo), [cena, fundo, pre, lo])
  const cont = useMemo(() => contarAves(mask, cena.regioes, conta), [mask, cena, conta])
  const erros = cena.regioes.map((r, i) => (r.verdade ? (100 * Math.abs(cont[i] - r.verdade)) / r.verdade : cont[i] ? 100 : 0))
  const erroMedio = erros.reduce((a, b) => a + b, 0) / erros.length
  const shown = vista === 'câmera' ? cena.img : vista === 'fundo (modelo)' ? fundo : vista === 'máscara' ? maskToGray(mask) : base
  const overlay = useMemo(
    () => (ctx: CanvasRenderingContext2D, s: number) => {
      ctx.lineWidth = 2
      ctx.font = `600 ${11 * (s / 2)}px JetBrains Mono, monospace`
      cena.regioes.forEach((r, i) => {
        ctx.strokeStyle = '#f2c14e'
        ctx.strokeRect(r.x0 * s + 1, r.y0 * s + 1, (r.x1 - r.x0) * s - 2, (r.y1 - r.y0) * s - 2)
        const txt = `R${r.id}: ${cont[i]}`
        ctx.fillStyle = 'rgba(20,24,18,0.8)'
        ctx.fillRect(r.x0 * s + 4, r.y0 * s + 4, ctx.measureText(txt).width + 8, 16 * (s / 2))
        ctx.fillStyle = '#f2c14e'
        ctx.fillText(txt, r.x0 * s + 8, r.y0 * s + 4 + 12 * (s / 2))
      })
    },
    [cena, cont],
  )
  const loMax = pre === 'subtração de fundo + inRange' ? 120 : 230
  return (
    <Lab
      n="2.4"
      title="Contar frangos num aviário dark house"
      desc="Cena no formato das câmeras do TCC: infravermelha, a 1,80 m de altura e 45° de inclinação, com o clarão no centro. Seis regiões fixas, como a janela 'Estático' do sistema. O gabarito é o número real de aves em cada região."
    >
      <div className="controls">
        <Seg value={pre} options={['inRange direto', 'multiplicar por 0,7 + inRange', 'subtração de fundo + inRange'] as const} onChange={setPre} label="pré-processamento (as três tentativas do TCC)" />
        <Slider id="avlo" label={pre === 'subtração de fundo + inRange' ? 'limiar da diferença' : 'inRange: mínimo (máximo = mínimo + 50)'} value={Math.min(lo, loMax)} min={0} max={loMax} onChange={setLo} />
      </div>
      <div className="controls">
        <Seg value={conta} options={['pixels ÷ área da ave', 'contornos', 'erosão + contornos'] as const} onChange={setConta} label="como contar" />
        {pre === 'subtração de fundo + inRange' && <Seg value={modelo} options={['mesma câmera, sem aves', 'outro vídeo, câmera deslocada'] as const} onChange={setModelo} label="imagem de fundo" />}
        <Slider id="avn" label="aves no quadro" value={n} min={40} max={220} step={10} onChange={setN} />
        <button type="button" className="btn ghost" onClick={() => setSeed((s) => s + 1)}>
          <Shuffle size={15} /> Outro quadro
        </button>
      </div>
      <div className="lab-cols two">
        <div className="panel">
          <div className="controls">
            <Seg value={vista} options={['câmera', 'fundo (modelo)', 'depois do pré-processamento', 'máscara'] as const} onChange={setVista} />
          </div>
          <ImgCanvas img={shown} overlay={overlay} label="aviário com regiões de contagem" />
        </div>
        <div className="panel" style={{ alignContent: 'start' }}>
          <div className="stats">
            <div className="stat">
              <b className={erroMedio < 20 ? 'ok' : 'bad'}>{erroMedio.toFixed(1)}%</b>
              <span>erro médio nas 6 regiões</span>
            </div>
            <div className="stat">
              <b>15,2%</b>
              <span>erro médio no TCC (1 quadro)</span>
            </div>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>região</th>
                  <th>área da ave (px)</th>
                  <th>manual</th>
                  <th>algoritmo</th>
                  <th>erro</th>
                </tr>
              </thead>
              <tbody>
                {cena.regioes.map((r, i) => (
                  <tr key={r.id}>
                    <td>R{r.id}</td>
                    <td>{r.area}</td>
                    <td>{r.verdade}</td>
                    <td>{cont[i]}</td>
                    <td className={erros[i] <= 15 ? 'ok' : 'bad'}>{erros[i].toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">A área da ave muda por região porque, com a câmera inclinada, a ave do fundo aparece menor. No TCC ela ia de 281 a 650 px.</p>
        </div>
      </div>
    </Lab>
  )
}

const CODE = `import cv2, numpy as np

fundo = cv2.cvtColor(cv2.imread("fundo_sem_aves.png"), cv2.COLOR_BGR2GRAY)
video = cv2.VideoCapture("aviario.avi")
regioes = {"R1": (8, 30, 124, 128), "R2": (124, 30, 240, 128)}   # x0, y0, x1, y1
area_ave = {"R1": 290, "R2": 300}                                  # px, medido por região

contagens = {r: [] for r in regioes}
while True:
    ok, quadro = video.read()
    if not ok:
        break
    cinza = cv2.cvtColor(quadro, cv2.COLOR_BGR2GRAY)
    dif = cv2.subtract(cinza, fundo)                  # subtração de fundo tira o clarão
    mask = cv2.inRange(dif, 40, 255)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    for r, (x0, y0, x1, y1) in regioes.items():
        brancos = cv2.countNonZero(mask[y0:y1, x0:x1])
        contagens[r].append(brancos / area_ave[r])

# como no TCC: mediana de 49 quadros (2 s de vídeo) é mais estável que 1 quadro
for r, v in contagens.items():
    print(r, round(np.median(v[:49])))`

export const secaoAviario = {
  id: 'a2-caso',
  titulo: 'Caso real: contar frangos no aviário',
  min: 12,
  body: (
    <div className="prose">
      <p>
        Um TCC defendido aqui em Medianeira usou quase todas as receitas desta aula num problema da avicultura do oeste: contar quantas aves estão perto do comedouro, quadro a quadro, em vídeos
        da Embrapa Suínos e Aves.
      </p>
      <Caso
        tipo="TCC · UTFPR Medianeira · 2015"
        titulo="Contagem de aves de corte em um aviário através do processamento digital de imagens"
        autores="Berlanda, C. A. G. · orientação: Paula Filho, P. L.; coorientação: Abreu, P. G."
        onde="Tecnologia em Análise e Desenvolvimento de Sistemas, UTFPR Medianeira"
        resumo={
          <p>
            Vídeos de um aviário dark house de 100 × 12 m no oeste de Santa Catarina, gravados por 8 câmeras infravermelhas durante 42 dias. A câmera infravermelha cria um clarão circular no
            centro da imagem, e é esse clarão que derruba o limiar simples.
          </p>
        }
        pipeline={[
          'Imagem de fundo sem aves, editada para apagar comedouros e o tonel que só existiam no vídeo-modelo',
          'Subtração de fundo, conversão para cinza e inRange com intervalo de 50 níveis',
          'Contagem de pixels brancos ÷ área média de uma ave, com uma área por região',
          'Canny + findContours e sequências de erosão e dilatação, que foram descartados',
          'Média e mediana de 49 quadros (2 s) e exportação para CSV',
        ]}
        numeros={[
          { v: '15,2%', l: 'erro médio num único quadro' },
          { v: '12,6%', l: 'erro médio com a mediana' },
          { v: '281–650 px', l: 'área de uma ave, conforme a região' },
          { v: '1,80 m · 45°', l: 'altura e inclinação das câmeras' },
        ]}
        discutir={[
          <>Por que contornos falham quando as aves se encostam? Ligue com o que a abertura faz com objetos que se tocam.</>,
          <>O TCC conta "pixels ÷ área da ave". Duas meias aves na borda da região contam como uma. Isso é defeito ou vantagem para medir comportamento?</>,
          <>A imagem de fundo veio de outro vídeo, com a câmera em outra posição. Que ruído isso cria? Teste no lab com "outro vídeo, câmera deslocada".</>,
        ]}
      />
      <LabAviario />
      <Callout kind="campo" title="O que o TCC ensina sobre as receitas">
        <p>
          Subtração de imagens é uma operação de ponto entre duas imagens: tira o clarão porque o clarão está nas duas. Erosão separa aves grudadas, mas, como o próprio trabalho relata, erosão forte
          o bastante para separar o bando apaga a ave que está sozinha. É a pegadinha do tamanho do carimbo, com frango no lugar de planta.
        </p>
      </Callout>
      <Code code={CODE} title="Python · OpenCV (versão em Python do método do TCC, que foi escrito em C++)" />
    </div>
  ),
}
