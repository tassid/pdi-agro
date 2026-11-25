import { useMemo, useState } from 'react'
import { type RGB, newGray, maskToGray, rgb2hsv, loadFile } from '../lib/img'
import {
  makeTomatoes, tomatoMasks, detectTomatoes, detectBlobs, CORES_TOMATE, COR_TOMATE_CSS, TABELA_ARTIGO,
  type Camera, type Luz, type ModoTabela, type CorTomate,
} from '../lib/casos'
import { ImgCanvas, Seg, Lab, Callout, Caso, Code } from '../ui'
import { Shuffle, Upload } from 'lucide-react'

type Vista = 'resultado' | 'matiz H' | `máscara ${CorTomate}`

export function LabTomate() {
  const [seed, setSeed] = useState(3)
  const [camera, setCamera] = useState<Camera>('Full HD')
  const [luz, setLuz] = useState<Luz>('LED branca')
  const [modo, setModo] = useState<ModoTabela>('H em graus (como no artigo)')
  const [vista, setVista] = useState<Vista>('resultado')
  const [foto, setFoto] = useState<RGB | null>(null)
  const [usarFoto, setUsarFoto] = useState(false)
  const cena = useMemo(() => makeTomatoes(seed, camera, luz), [seed, camera, luz])
  const img = usarFoto && foto ? foto : cena.rgb
  const masks = useMemo(() => tomatoMasks(img, modo), [img, modo])
  const det = useMemo(() => (usarFoto ? null : detectTomatoes(masks, cena.tomates)), [masks, cena, usarFoto])
  const blobs = useMemo(() => (usarFoto ? detectBlobs(masks) : []), [masks, usarFoto])
  const hueImg = useMemo(() => {
    const g = newGray(img.w, img.h)
    for (let i = 0; i < g.data.length; i++) g.data[i] = (rgb2hsv(img.data[i * 3], img.data[i * 3 + 1], img.data[i * 3 + 2])[0] / 360) * 255
    return g
  }, [img])
  const shown = vista === 'resultado' ? img : vista === 'matiz H' ? hueImg : maskToGray(masks[vista.replace('máscara ', '') as CorTomate])
  const overlay = useMemo(
    () => (ctx: CanvasRenderingContext2D, s: number) => {
      if (vista !== 'resultado') return
      ctx.lineWidth = 2.5
      ctx.font = `600 ${11 * (s / 2)}px JetBrains Mono, monospace`
      if (det)
        det.forEach((d) => {
          const col = d.cor ? COR_TOMATE_CSS[d.cor] : '#888'
          ctx.strokeStyle = col
          ctx.setLineDash(d.objeto ? [] : [5, 4])
          ctx.beginPath()
          ctx.arc(d.t.x * s, d.t.y * s, (d.t.r + 3) * s, 0, Math.PI * 2)
          ctx.stroke()
          ctx.setLineDash([])
          const ok = d.cor === d.t.cor
          const txt = d.cor ? `${d.cor} ${ok ? '✓' : '✗'}` : 'não achou'
          ctx.fillStyle = 'rgba(20,24,18,0.78)'
          const tw = ctx.measureText(txt).width
          ctx.fillRect(d.t.x * s - tw / 2 - 4, (d.t.y + d.t.r + 6) * s - 2, tw + 8, 14 * (s / 2) + 4)
          ctx.fillStyle = ok ? '#bff0b0' : '#ffb4a8'
          ctx.fillText(txt, d.t.x * s - tw / 2, (d.t.y + d.t.r + 6) * s + 10 * (s / 2))
        })
      else
        blobs.forEach((b) => {
          ctx.strokeStyle = COR_TOMATE_CSS[b.cor]
          ctx.strokeRect(b.x0 * s, b.y0 * s, (b.x1 - b.x0 + 1) * s, (b.y1 - b.y0 + 1) * s)
          ctx.fillStyle = COR_TOMATE_CSS[b.cor]
          ctx.fillText(`${b.cor} (${Math.round(b.cx)},${Math.round(b.cy)})`, b.x0 * s, b.y0 * s - 4)
        })
    },
    [vista, det, blobs],
  )
  const acObj = det ? det.filter((d) => d.objeto).length : 0
  const acCor = det ? det.filter((d) => d.cor === d.t.cor).length : 0
  return (
    <Lab
      n="1.4"
      title="Esteira de tomates com a tabela HSV do artigo"
      desc="Oito tomates em quatro estágios de maturação, dois de cada cor, como as amostras do artigo. O classificador usa exatamente a Tabela 1 do trabalho. Troque a câmera, a luz e o jeito de aplicar a tabela."
    >
      <div className="controls">
        <Seg value={camera} options={['Full HD', 'HD'] as const} onChange={setCamera} label="webcam" />
        <Seg value={luz} options={['LED branca', 'lâmpada amarela', 'pouca luz'] as const} onChange={setLuz} label="iluminação" />
        <button type="button" className="btn ghost" onClick={() => { setSeed((s) => s + 1); setUsarFoto(false) }}>
          <Shuffle size={15} /> Outra bandeja
        </button>
        <span className="btn ghost upload">
          <Upload size={15} /> Foto de tomates
          <input
            type="file"
            accept="image/*"
            aria-label="Carregar foto de tomates"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              setFoto(await loadFile(f))
              setUsarFoto(true)
            }}
          />
        </span>
      </div>
      <div className="controls">
        <Seg value={modo} options={['H em graus (como no artigo)', 'tabela colada no OpenCV (H de 0 a 179)'] as const} onChange={setModo} label="como a tabela foi aplicada" />
        <Seg value={vista} options={['resultado', 'matiz H', 'máscara vermelho', 'máscara laranja', 'máscara amarelo', 'máscara verde'] as const} onChange={setVista} label="ver" />
      </div>
      <div className="lab-cols two">
        <div className="panel">
          <div className="panel-t">
            <span>{usarFoto ? 'sua foto' : `webcam ${camera} · ${luz}`}</span>
            <span>{vista}</span>
          </div>
          <ImgCanvas img={shown} overlay={overlay} label="tomates classificados pela cor" />
        </div>
        <div className="panel" style={{ alignContent: 'start' }}>
          {det ? (
            <>
              <div className="stats">
                <div className="stat">
                  <b className={acObj === 8 ? 'ok' : 'bad'}>{acObj}/8</b>
                  <span>objetos detectados</span>
                </div>
                <div className="stat">
                  <b className={acCor === 8 ? 'ok' : 'bad'}>{acCor}/8</b>
                  <span>cores corretas</span>
                </div>
              </div>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>amostra</th>
                      <th>cor real</th>
                      <th>matiz</th>
                      <th>detectado</th>
                      <th>cor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {det.map((d, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td>{d.t.cor}</td>
                        <td>{d.t.hue}°</td>
                        <td className={d.objeto ? 'ok' : 'bad'}>{d.objeto ? 'acerto' : 'erro'}</td>
                        <td className={d.cor === d.t.cor ? 'ok' : 'bad'}>{d.cor ?? 'nenhuma'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="note">
              Na sua foto não existe gabarito: cada mancha grande de uma cor vira um objeto, com a posição do centro, como na interface do artigo. Confira no olho se a tabela funcionou com a luz da sua cozinha.
            </p>
          )}
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Tabela 1 do artigo</th>
                  <th>H mín</th>
                  <th>H máx</th>
                  <th>S mín</th>
                  <th>V mín</th>
                </tr>
              </thead>
              <tbody>
                {TABELA_ARTIGO.map((r, i) => (
                  <tr key={i}>
                    <td style={{ color: COR_TOMATE_CSS[r.cor] }}>{r.cor}</td>
                    <td>{r.h[0]}</td>
                    <td>{r.h[1]}</td>
                    <td>{r.s}</td>
                    <td>{r.v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <p className="note">
        Cores das bordas: {CORES_TOMATE.map((c) => (
          <span key={c} style={{ color: COR_TOMATE_CSS[c], fontWeight: 600, marginRight: 10 }}>
            {c}
          </span>
        ))}
        Linha tracejada: o tomate não foi encontrado.
      </p>
    </Lab>
  )
}

const CODE = `import cv2, numpy as np

img = cv2.imread("tomates.jpg")              # OpenCV lê em BGR
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)   # H de 0 a 179 (graus / 2), S e V de 0 a 255

# Tabela 1 do artigo está em GRAUS. Para o OpenCV, divida H por 2:
faixas = {
    "vermelho": [((0, 50, 50), (5, 255, 255)), ((170, 50, 50), (179, 255, 255))],
    "laranja":  [((6, 50, 50), (17, 255, 255))],
    "amarelo":  [((18, 50, 50), (30, 255, 255))],
    "verde":    [((31, 50, 50), (60, 255, 255))],
}
k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
for cor, lista in faixas.items():
    mask = sum(cv2.inRange(hsv, np.array(a), np.array(b)) for a, b in lista)
    mask = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_OPEN, k)
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for c in cnts:
        if cv2.contourArea(c) < 400:        # ignora o cálice e o reflexo
            continue
        x, y, w, h = cv2.boundingRect(c)
        cv2.rectangle(img, (x, y), (x + w, y + h), (255, 255, 255), 2)
        cv2.putText(img, f"{cor} ({x + w//2},{y + h//2})", (x, y - 6),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
cv2.imwrite("resultado.jpg", img)`

export const secaoTomate = {
  id: 'a1-caso',
  titulo: 'Caso real: separar tomates pela cor',
  min: 10,
  body: (
    <div className="prose">
      <p>
        Tudo o que vimos hoje aparece junto num trabalho de 2023: um sistema com webcam, OpenCV e um braço robótico com Arduino que separa tomates maduros dos verdes. A decisão é só a cor, em
        HSV, com uma tabela de faixas de matiz.
      </p>
      <Caso
        tipo="artigo · 2023"
        titulo="Visão computacional aplicada na agroindústria"
        autores="Noguti Júnior, J.; Santos, S. S. L.; Florian, F. (UNIARA)"
        onde="Revista FT, v. 27, ed. 129"
        link="https://doi.org/10.5281/zenodo.10385278"
        resumo={<p>Classificação de tomates por estágio de maturação para a seleção pós-colheita, que hoje ainda é feita à mão em muitas beneficiadoras.</p>}
        pipeline={[
          'Captura por webcam USB, com fundo contrastante',
          'Ajuste de brilho, saturação e desfoque na interface (PyQt)',
          'Conversão BGR → HSV',
          'Uma máscara inRange por cor, duas para o vermelho (0–10° e 341–360°)',
          'Contornos, centro do objeto e envio da posição ao Arduino',
        ]}
        numeros={[
          { v: '8', l: 'amostras de cor, verde a vermelho' },
          { v: '100%', l: 'acerto com webcam Full HD' },
          { v: '75%', l: 'acerto com webcam HD' },
          { v: '4', l: 'servos no braço (garra, rotação, avanço, altura)' },
        ]}
        discutir={[
          <>A Tabela 1 mistura H em graus (0–360) com S e V em 0–255. O OpenCV guarda H de 0 a 179. O que acontece se alguém copiar a tabela direto para o <code>cv2.inRange</code>? Teste no lab.</>,
          <>As amostras foram peças coloridas fabricadas, não tomates. O que muda com tomate de verdade (brilho, cálice verde, manchas)?</>,
          <>Oito amostras bastam para dizer "100%"? Quantas vocês usariam, e em quantas condições de luz?</>,
        ]}
      />
      <LabTomate />
      <Callout kind="pegadinha" title="A pegadinha da Aula 1, num artigo publicado">
        <p>
          Com a tabela colada no OpenCV sem dividir H por 2, o tomate verde (≈ 95°, que vira 47 no OpenCV) cai na faixa do amarelo (36 a 60), e a segunda faixa do vermelho (341 a 360) nunca é
          alcançada, porque o H do OpenCV para em 179. O código funciona, não dá erro, e classifica errado.
        </p>
      </Callout>
      <Callout kind="prof">
        <p>
          Peça para a turma trazer tomates de feira no próximo encontro e fotografar com o celular sobre uma folha branca. O botão "Foto de tomates" aplica a mesma tabela na foto deles. Com luz de
          cozinha, quase sempre algum tomate muda de classe, o que abre a discussão sobre controlar a aquisição.
        </p>
      </Callout>
      <Code code={CODE} title="Python · OpenCV (tabela do artigo convertida)" />
    </div>
  ),
}
