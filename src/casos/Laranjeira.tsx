import { useMemo, useState } from 'react'
import { newRGB, rdylgn } from '../lib/img'
import { makeLaranjeira, laranjeiraPipeline, amostrasPomar, interpolar, infestacaoReal, POMAR, type LuzFolha, type Interpolador } from '../lib/casos'
import { ImgCanvas, Seg, Slider, Lab, Callout, Caso, Code } from '../ui'
import { memo } from '../samples'
import { Shuffle } from 'lucide-react'

type Vista = 'foto' | 'canal L' | 'canal H' | 'folha + lesões'

export function LabLaranjeira() {
  const [seed, setSeed] = useState(5)
  const [sev, setSev] = useState(0.45)
  const [luz, setLuz] = useState<LuzFolha>('duas fluorescentes (como no TCC)')
  const [tL, setTL] = useState(170)
  const [tH, setTH] = useState(33)
  const [morf, setMorf] = useState(true)
  const [vista, setVista] = useState<Vista>('folha + lesões')
  const cena = memo(`lar-${seed}-${sev}-${luz}`, () => makeLaranjeira(seed, sev, luz))
  const r = useMemo(() => laranjeiraPipeline(cena.rgb, tL, tH, morf), [cena, tL, tH, morf])
  const tinted = useMemo(() => {
    const o = newRGB(cena.rgb.w, cena.rgb.h)
    for (let i = 0; i < r.folha.data.length; i++) {
      const c = r.lesao.data[i] ? [220, 60, 40] : r.folha.data[i] ? [60, 160, 70] : [238, 238, 234]
      for (let k = 0; k < 3; k++) o.data[i * 3 + k] = cena.rgb.data[i * 3 + k] * 0.35 + c[k] * 0.65
    }
    return o
  }, [cena, r])
  const shown = vista === 'foto' ? cena.rgb : vista === 'canal L' ? r.L : vista === 'canal H' ? { ...r.H, data: r.H.data.map((v) => (v / 179) * 255) } : tinted
  const erro = r.severidade - cena.severidade
  return (
    <Lab
      n="3.3"
      title="Severidade numa folha de laranjeira"
      desc="Fotografia em macro sobre fundo claro, como no TCC. O canal L do HLS separa a folha do fundo; o canal H separa a lesão (marrom e amarela) do tecido verde. A severidade é a área de lesão dividida pela área da folha."
    >
      <div className="controls">
        <Seg value={luz} options={['duas fluorescentes (como no TCC)', 'sol lateral, sem controle'] as const} onChange={setLuz} label="iluminação na captura" />
        <Slider id="lsev" label="severidade simulada" value={sev} min={0.05} max={1} step={0.05} onChange={setSev} fmt={(v) => v.toFixed(2)} />
        <button type="button" className="btn ghost" onClick={() => setSeed((s) => s + 1)}>
          <Shuffle size={15} /> Outra folha
        </button>
      </div>
      <div className="controls">
        <Slider id="ltl" label="limiar em L (folha: L < limiar)" value={tL} min={60} max={240} onChange={setTL} />
        <Slider id="lth" label="limiar em H (lesão: H < limiar, OpenCV 0–179)" value={tH} min={10} max={60} onChange={setTH} />
        <Seg value={morf ? 'com erosão + dilatação' : 'sem morfologia'} options={['com erosão + dilatação', 'sem morfologia'] as const} onChange={(v) => setMorf(v === 'com erosão + dilatação')} label="morfologia" />
      </div>
      <div className="lab-cols two">
        <div className="panel">
          <div className="controls">
            <Seg value={vista} options={['foto', 'canal L', 'canal H', 'folha + lesões'] as const} onChange={setVista} />
          </div>
          <ImgCanvas img={shown} label="folha de laranjeira segmentada" />
        </div>
        <div className="panel" style={{ alignContent: 'start' }}>
          <div className="stats">
            <div className="stat">
              <b>{r.severidade.toFixed(1)}%</b>
              <span>severidade medida</span>
            </div>
            <div className="stat">
              <b>{cena.severidade.toFixed(1)}%</b>
              <span>severidade real</span>
            </div>
            <div className="stat">
              <b className={Math.abs(erro) < 2 ? 'ok' : 'bad'}>{erro >= 0 ? '+' : ''}{erro.toFixed(1)} p.p.</b>
              <span>erro</span>
            </div>
            <div className="stat">
              <b>{r.manchas}</b>
              <span>manchas contadas</span>
            </div>
          </div>
          <p className="note">
            Com as duas fluorescentes, os limiares padrão funcionam. Troque para "sol lateral": a sombra da folha entra na máscara do L e o mesmo limiar deixa de servir. É o que o TCC chama de
            "dificuldade em determinar um nível de threshold ideal para todas as imagens".
          </p>
        </div>
      </div>
    </Lab>
  )
}

export function LabMapaPomar() {
  const [seed] = useState(11)
  const [metodo, setMetodo] = useState<Interpolador>('IDP (inverso da distância)')
  const [p, setP] = useState(2)
  const [raio, setRaio] = useState(45)
  const [pixel, setPixel] = useState(2)
  const pts = memo(`pomar-${seed}`, () => amostrasPomar(seed))
  const grid = useMemo(() => interpolar(pts, metodo, p, raio, pixel), [pts, metodo, p, raio, pixel])
  const zmax = 40
  const { rmse, vazios } = useMemo(() => {
    let s = 0, n = 0, v = 0
    for (let j = 0; j < grid.h; j++)
      for (let i = 0; i < grid.w; i++) {
        const z = grid.g.data[j * grid.w + i]
        if (Number.isNaN(z)) {
          v++
          continue
        }
        s += (z - infestacaoReal((i + 0.5) * pixel, (j + 0.5) * pixel, seed)) ** 2
        n++
      }
    return { rmse: Math.sqrt(s / (n || 1)), vazios: (100 * v) / (grid.w * grid.h) }
  }, [grid, pixel, seed])
  const view = useMemo(() => {
    const g = { ...grid.g, data: grid.g.data.map((z) => (Number.isNaN(z) ? -1 : 255 * (1 - Math.min(1, z / zmax)))) }
    return g
  }, [grid])
  const real = memo(`pomar-real-${seed}`, () => {
    const w = 150, h = 100
    const g = { w, h, data: new Float32Array(w * h) }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) g.data[j * w + i] = 255 * (1 - Math.min(1, infestacaoReal(i + 0.5, j + 0.5, seed) / zmax))
    return g
  })
  const lut = (v: number): [number, number, number] => (v < 0 ? [205, 205, 200] : rdylgn(v / 255))
  const scale = Math.max(1, Math.round(300 / grid.w))
  const overlay = useMemo(
    () => (ctx: CanvasRenderingContext2D, s: number) => {
      const k = s / pixel
      pts.forEach((q) => {
        ctx.beginPath()
        ctx.arc(q.x * k, q.y * k, 4, 0, Math.PI * 2)
        ctx.fillStyle = '#1b2417'
        ctx.fill()
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 1.5
        ctx.stroke()
      })
    },
    [pts, pixel],
  )
  return (
    <Lab
      n="3.4"
      title="Da folha ao mapa: 36 pontos viram um pomar inteiro"
      desc="O TCC mediu a severidade em quatro folhas de cada um dos 36 pontos amostrais de um pomar de 1,49 ha, marcados com GPS, e interpolou o resto da área. Aqui você controla o interpolador. O mapa da direita é a infestação real, que o produtor nunca vê."
    >
      <div className="controls">
        <Seg value={metodo} options={['IDP (inverso da distância)', 'MM (média móvel)'] as const} onChange={setMetodo} label="interpolador" />
        {metodo === 'IDP (inverso da distância)' && <Slider id="idp" label="potência p" value={p} min={0.5} max={5} step={0.5} onChange={setP} />}
        <Slider id="raio" label="raio de busca (m)" value={raio} min={15} max={150} step={5} onChange={setRaio} />
        <Slider id="pix" label="tamanho do pixel do mapa (m)" value={pixel} min={1} max={10} onChange={setPixel} />
      </div>
      <div className="lab-cols two">
        <div className="panel">
          <div className="panel-t">
            <span>mapa temático interpolado</span>
            <span>verde = pouca doença · vermelho = muita</span>
          </div>
          <ImgCanvas img={view} lut={lut} scale={scale} pixelated overlay={overlay} label="mapa de infestação interpolado" />
        </div>
        <div className="panel">
          <div className="panel-t">
            <span>infestação real (gabarito)</span>
            <span>{POMAR.w} × {POMAR.h} m</span>
          </div>
          <ImgCanvas img={real} lut={lut} scale={2} label="infestação real no pomar" />
        </div>
      </div>
      <div className="stats">
        <div className="stat">
          <b>{rmse.toFixed(1)} p.p.</b>
          <span>erro médio do mapa (RMSE)</span>
        </div>
        <div className="stat">
          <b className={vazios > 0 ? 'bad' : 'ok'}>{vazios.toFixed(0)}%</b>
          <span>área sem vizinho no raio</span>
        </div>
        <div className="stat">
          <b>36 × 4</b>
          <span>pontos × folhas por ponto</span>
        </div>
      </div>
      <div className="formula">Z = Σ (Zᵢ / dᵢᵖ) ÷ Σ (1 / dᵢᵖ) &nbsp;&nbsp; com p = 0, o IDP vira a média móvel</div>
    </Lab>
  )
}

const CODE = `import cv2, numpy as np

img = cv2.imread("folha.jpg")
hls = cv2.cvtColor(img, cv2.COLOR_BGR2HLS)       # OpenCV: H 0–179, L 0–255, S 0–255
H, L, S = cv2.split(hls)

folha = (L < 170).astype(np.uint8)                # fundo claro, folha escura
k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
folha = cv2.morphologyEx(folha, cv2.MORPH_OPEN, k)  # erosão seguida de dilatação
cnts, _ = cv2.findContours(folha, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
maior = max(cnts, key=cv2.contourArea)
folha = np.zeros_like(folha); cv2.drawContours(folha, [maior], -1, 1, cv2.FILLED)

lesao = ((H < 33) & (folha == 1)).astype(np.uint8)  # marrom/amarelo têm matiz menor que o verde
lesao = cv2.morphologyEx(lesao, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
print(f"severidade = {100 * lesao.sum() / folha.sum():.1f}%")

# do ponto ao mapa: inverso da distância ponderada (IDP)
def idp(pts, z, xg, yg, p=2, raio=45):
    d = np.hypot(xg[..., None] - pts[:, 0], yg[..., None] - pts[:, 1])
    w = np.where(d <= raio, 1 / np.maximum(d, 1e-6) ** p, 0)
    return (w * z).sum(-1) / w.sum(-1)`

export const secaoLaranjeira = {
  id: 'a3-caso',
  titulo: 'Caso real: doença em folhas de laranjeira, da foto ao mapa',
  min: 13,
  body: (
    <div className="prose">
      <p>
        Outro TCC de Medianeira juntou segmentação, descritor de área e agricultura de precisão num mesmo software: medir quanto de cada folha está doente e transformar os pontos amostrados num
        mapa de infestação do pomar.
      </p>
      <Caso
        tipo="TCC · UTFPR Medianeira · 2011"
        titulo="Geoprocessamento aplicado à agricultura visando o mapeamento de doenças em folhas de laranjeiras"
        autores="Schenatto, K. · orientação: Bazzi, C. L.; coorientação: Paula Filho, P. L."
        onde="Tecnologia em Análise e Desenvolvimento de Sistemas, UTFPR Medianeira"
        resumo={<p>Pomar de laranjeiras de 1,49 ha em Laranjeiras do Sul (PR). O módulo de imagens foi escrito em C++ com OpenCV e o de mapas em Java, com banco de dados geográfico.</p>}
        pipeline={[
          'Foto em macro com duas lâmpadas fluorescentes perpendiculares à folha, sem sombra',
          'Teste de espaços de cor; o HSL venceu: canal L para a folha, canal H para as doenças',
          'Limiarização, erosão e dilatação',
          'Contornos (findContours) e preenchimento de cada objeto',
          'Nível de infestação por ponto e interpolação por IDP ou média móvel',
        ]}
        numeros={[
          { v: '36', l: 'pontos amostrais com GPS' },
          { v: '4', l: 'folhas por ponto, sorteadas (simuladas no TCC)' },
          { v: '1,49 ha', l: 'área do pomar' },
          { v: 'IDP · MM', l: 'interpoladores do mapa' },
        ]}
        discutir={[
          <>O TCC controlou a luz com duas lâmpadas e fundo contrastante. Por que isso é metade do trabalho de segmentação?</>,
          <>No TCC, os 36 pontos são reais (GPS), mas as quatro folhas de cada ponto foram simuladas. O que precisaria mudar para validar o mapa em campo? Quatro folhas representam a planta?</>,
          <>No mapa, qual potência do IDP deixa o foco mais "redondinho" em volta de cada ponto? Isso é informação ou artefato?</>,
        ]}
      />
      <LabLaranjeira />
      <LabMapaPomar />
      <Callout kind="campo" title="Por que isso é agricultura de precisão">
        <p>
          A severidade de uma folha é um descritor de região (área de lesão ÷ área da folha). Quando cada medida ganha uma coordenada, a tabela vira mapa, e o mapa vira decisão: pulverizar só onde a
          infestação passa de um limite. É a ponte entre esta aula e a Aula 4.
        </p>
      </Callout>
      <Code code={CODE} title="Python · OpenCV + NumPy (o TCC usou C++ e Java)" />
    </div>
  ),
}
