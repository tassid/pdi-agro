import { useMemo, useState } from 'react'
import { maskToGray } from '../lib/img'
import { makeSoja, sojaPipeline, gsdPhantom3, KURACHI_CSS, kurachi, type Estadio, type Velocidade, type CanalSoja, type Kurachi } from '../lib/casos'
import { ImgCanvas, Seg, Slider, Lab, Caso } from '../ui'
import { memo } from '../samples'
import { Shuffle } from 'lucide-react'

type Vista = 'imagem' | 'canal usado' | 'máscara'

export function LabSoja() {
  const [seed, setSeed] = useState(2)
  const [vel, setVel] = useState<Velocidade>(4)
  const [est, setEst] = useState<Estadio>('V4')
  const [alt, setAlt] = useState(10)
  const [palha, setPalha] = useState(true)
  const [nuvem, setNuvem] = useState(false)
  const [canal, setCanal] = useState<CanalSoja>('G (como no artigo)')
  const [vista, setVista] = useState<Vista>('imagem')
  const cena = memo(`soja-${seed}-${vel}-${est}-${alt}-${palha}-${nuvem}`, () => makeSoja({ seed, velocidade: vel, estadio: est, altura: alt, palha, nuvem }))
  const r = useMemo(() => sojaPipeline(cena, canal), [cena, canal])
  const shown = vista === 'imagem' ? cena.img : vista === 'canal usado' ? r.gray : maskToGray(r.mask)
  const scale = Math.max(1, 720 / cena.w)
  const overlay = useMemo(
    () => (ctx: CanvasRenderingContext2D, s: number) => {
      if (vista === 'canal usado') return
      ctx.lineWidth = 2
      r.grupos.forEach((g) => {
        ctx.strokeStyle = '#f2d24e'
        ctx.strokeRect(g.x0 * s, g.y0 * s, (g.x1 - g.x0 + 1) * s, (g.y1 - g.y0 + 1) * s)
      })
      r.grupos.slice(1).forEach((g, i) => {
        const a = r.grupos[i]
        ctx.strokeStyle = KURACHI_CSS[kurachi(r.dist[i])]
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(a.cx * s, a.cy * s + 2)
        ctx.lineTo(g.cx * s, g.cy * s + 2)
        ctx.stroke()
      })
    },
    [r, vista],
  )
  const classes: Kurachi[] = ['falha', 'aceitável', 'duplo']
  return (
    <Lab
      n="4.5"
      title="Falhas e duplas na linha de soja, vistas de um drone"
      desc="1,5 m de linha semeada com 16 sementes por metro (espaçamento esperado de 6,25 cm) e 80% de germinação. A câmera é a de um DJI Phantom 3 Pro. O pipeline segue o artigo: um canal, limiar, erosão, grupos de plantas e a distância entre grupos vizinhos."
    >
      <div className="controls">
        <Slider id="salt" label={`altura de voo · GSD ${gsdPhantom3(alt).toFixed(2)} cm/px`} value={alt} min={3} max={30} onChange={setAlt} fmt={(v) => `${v} m`} />
        <Seg value={est} options={['VC', 'V2', 'V4'] as const} onChange={setEst} label="estádio" />
        <Seg value={String(vel) as '4' | '6' | '8'} options={['4', '6', '8'] as const} onChange={(v) => setVel(+v as Velocidade)} label="semeadora (km/h)" />
      </div>
      <div className="controls">
        <Seg value={canal} options={['G (como no artigo)', 'ExG'] as const} onChange={setCanal} label="canal segmentado" />
        <Seg value={palha ? 'com palha de aveia' : 'solo limpo'} options={['com palha de aveia', 'solo limpo'] as const} onChange={(v) => setPalha(v === 'com palha de aveia')} label="plantio direto" />
        <Seg value={nuvem ? 'nuvem' : 'sol'} options={['sol', 'nuvem'] as const} onChange={(v) => setNuvem(v === 'nuvem')} label="céu no voo" />
        <button type="button" className="btn ghost" onClick={() => setSeed((s) => s + 1)}>
          <Shuffle size={15} /> Outro trecho
        </button>
      </div>
      <div className="panel">
        <div className="controls">
          <Seg value={vista} options={['imagem', 'canal usado', 'máscara'] as const} onChange={setVista} />
        </div>
        <ImgCanvas img={shown} scale={scale} pixelated overlay={overlay} label="linha de soja com grupos e distâncias" />
        <p className="note">
          Caixas amarelas: grupos de plantas. Linhas: distância até o grupo seguinte, em{' '}
          {classes.map((c) => (
            <span key={c} style={{ color: KURACHI_CSS[c], fontWeight: 700, marginRight: 8 }}>
              {c}
            </span>
          ))}
          (mesmas cores da figura do artigo).
        </p>
      </div>
      <div className="lab-cols two">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Kurachi et al. (1989)</th>
                <th>real</th>
                <th>imagem</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c}>
                  <td style={{ color: KURACHI_CSS[c], fontWeight: 600 }}>
                    {c} {c === 'duplo' ? '(< 3,1 cm)' : c === 'falha' ? '(> 9,4 cm)' : '(3,1 a 9,4 cm)'}
                  </td>
                  <td>{r.pctReal[c].toFixed(0)}%</td>
                  <td>{r.pctEst[c].toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="stats" style={{ alignContent: 'start' }}>
          <div className="stat">
            <b>{cena.plantas.length}</b>
            <span>plantas reais</span>
          </div>
          <div className="stat">
            <b className={Math.abs(r.grupos.length - cena.plantas.length) <= 2 ? 'ok' : 'bad'}>{r.grupos.length}</b>
            <span>grupos encontrados</span>
          </div>
          <div className="stat">
            <b>{(6.25 / cena.gsd).toFixed(1)} px</b>
            <span>6,25 cm na imagem</span>
          </div>
        </div>
      </div>
    </Lab>
  )
}

export const casoSoja = (
  <Caso
    tipo="artigo · 2022"
    titulo="Machine learning e processamento digital de imagens UAV para estimar a distribuição longitudinal de plantas de soja"
    autores="Souza, F. L. P.; Favan, J. R.; Passos, J. R. S.; Dias, M. A.; Campos, S. (UNESP Botucatu e outros)"
    onde="Energia na Agricultura, v. 37, n. 3, p. 1–11"
    link="https://doi.org/10.17224/EnergAgric.2022v37n3p1-11"
    resumo={
      <p>
        Na Fazenda Lageado (UNESP), a soja foi semeada a 4, 6 e 8 km/h sobre palha de aveia-preta, com 16 sementes por metro. O objetivo era trocar a trena, que ainda é o método usado para medir
        falhas e duplas na linha, por imagens de drone.
      </p>
    }
    pipeline={[
      'Voo a 10 m com 70% de sobreposição, DJI Phantom 3 Pro, estádio V4',
      'Separação dos canais (split) e escolha do verde (G)',
      'Bordas, erosão e contornos para formar grupos de plantas',
      'Distância euclidiana entre grupos, salva em CSV e rotulada à mão (certa ou errada)',
      'Dummy, Regressão Logística, Random Forest e SVM em validação cruzada de 10 dobras',
    ]}
    numeros={[
      { v: '65,5%', l: 'acurácia do Random Forest' },
      { v: '49,6%', l: 'acurácia do Dummy (chute)' },
      { v: '55–62%', l: 'falhas estimadas pela imagem' },
      { v: '6,25 cm', l: 'espaçamento esperado entre plantas' },
    ]}
    discutir={[
      <>A 10 m, o GSD do Phantom 3 Pro é de uns 0,43 cm/px e uma planta em V4 tem uns 15 cm de diâmetro. Com 6,25 cm entre plantas, o que acontece com as folhas vizinhas? Veja no lab.</>,
      <>Por que o artigo compara com um Dummy Classifier? O que 65,5% significa quando o chute dá 49,6%?</>,
      <>O voo a 8 km/h pegou uma nuvem. Como isso contamina a comparação entre velocidades de semeadura?</>,
    ]}
  />
)
