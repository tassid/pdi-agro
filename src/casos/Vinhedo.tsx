import { useMemo, useState } from 'react'
import { rdylgn } from '../lib/img'
import { makeVinhedo, resample, type Resolucao, type Epoca, type Entrelinha } from '../lib/casos'
import { ImgCanvas, Seg, Lab, Caso } from '../ui'
import { memo } from '../samples'

type Vista = 'NDVI' | 'cor verdadeira (RGB 321)'

export function LabVinhedo() {
  const [res, setRes] = useState<Resolucao>('ALOS multiespectral · 10 m')
  const [epoca, setEpoca] = useState<Epoca>('fevereiro (pré-colheita)')
  const [entre, setEntre] = useState<Entrelinha>('solo exposto')
  const [vista, setVista] = useState<Vista>('NDVI')
  const v = memo(`vin-${epoca}-${entre}`, () => makeVinhedo(21, epoca, entre))
  const r = useMemo(() => resample(v, res), [v, res])
  const lo = -0.1, hi = 0.8
  const img = vista === 'NDVI' ? { ...r.ndvi, data: r.ndvi.data.map((x) => (255 * (x - lo)) / (hi - lo)) } : r.rgb
  const scale = 480 / r.w
  const overlay = useMemo(
    () => (ctx: CanvasRenderingContext2D, s: number) => {
      const k = (s * r.w) / v.w
      ctx.lineWidth = 2
      ctx.font = `700 ${13}px JetBrains Mono, monospace`
      v.parcelas.forEach((p) => {
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'
        ctx.strokeRect(p.x0 * k, p.y0 * k, (p.x1 - p.x0) * k, (p.y1 - p.y0) * k)
        ctx.fillStyle = 'rgba(20,24,18,0.8)'
        ctx.fillRect(p.x0 * k + 4, p.y0 * k + 4, 30, 18)
        ctx.fillStyle = '#fff'
        ctx.fillText(p.id, p.x0 * k + 8, p.y0 * k + 17)
      })
    },
    [r, v],
  )
  const ordReal = [...r.stats].sort((a, b) => b.vigor - a.vigor).map((s) => s.id).join(' > ')
  const ordImg = [...r.stats].sort((a, b) => b.media - a.media).map((s) => s.id).join(' > ')
  return (
    <Lab
      n="4.4"
      title="NDVI por parcela num vinhedo da Serra Gaúcha"
      desc="Seis parcelas de videira em espaldeira, com linhas a cada 2,5 m e vigor diferente em cada uma. O NDVI é calculado com as bandas do vermelho e do infravermelho próximo, como no trabalho, em três resoluções."
    >
      <div className="controls">
        <Seg value={res} options={['ALOS multiespectral · 10 m', 'ALOS fusionada · 2,5 m', 'drone · 0,5 m'] as const} onChange={setRes} label="imagem" />
        <Seg value={vista} options={['NDVI', 'cor verdadeira (RGB 321)'] as const} onChange={setVista} label="ver" />
      </div>
      <div className="controls">
        <Seg value={epoca} options={['outubro (brotação)', 'fevereiro (pré-colheita)'] as const} onChange={setEpoca} label="data da imagem" />
        <Seg value={entre} options={['solo exposto', 'gramada', 'grama seca'] as const} onChange={setEntre} label="entrelinha" />
      </div>
      <div className="lab-cols two">
        <div className="panel">
          <div className="panel-t">
            <span>{r.w} × {r.h} pixels</span>
            <span>{vista === 'NDVI' ? 'NDVI de −0,1 (vermelho) a 0,8 (verde)' : 'composição colorida'}</span>
          </div>
          <ImgCanvas img={img} lut={vista === 'NDVI' ? (x) => rdylgn(x / 255) : undefined} scale={scale} pixelated overlay={overlay} label="vinhedo com parcelas" />
        </div>
        <div className="panel" style={{ alignContent: 'start' }}>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>parcela</th>
                  <th>vigor real</th>
                  <th>NDVI médio</th>
                  <th>desvio (intra)</th>
                  <th>pixels</th>
                </tr>
              </thead>
              <tbody>
                {r.stats.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{s.vigor.toFixed(2)}</td>
                    <td>{s.media.toFixed(3)}</td>
                    <td>{s.desvio.toFixed(3)}</td>
                    <td>{s.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="stats">
            <div className="stat">
              <b className={r.r > 0.9 ? 'ok' : 'bad'}>{r.r.toFixed(2)}</b>
              <span>correlação NDVI × vigor real</span>
            </div>
            <div className="stat">
              <b>{r.amplitude.toFixed(3)}</b>
              <span>diferença entre parcelas</span>
            </div>
          </div>
          <p className="note">
            Ordem real: {ordReal}
            <br />
            Ordem pelo NDVI: {ordImg}
          </p>
        </div>
      </div>
    </Lab>
  )
}

export const casoVinhedo = (
  <Caso
    tipo="capítulo de livro · Embrapa · 2011"
    titulo="Processamento digital de imagens orbitais e SIG para apoio à agricultura de precisão em videira e macieira no RS"
    autores="Hoff, R.; Farias, A. R.; Ducati, J. R.; Toniolo, G. R. (Embrapa Uva e Vinho; UFRGS)"
    onde="Agricultura de precisão: um novo olhar, Embrapa, p. 273–276"
    resumo={
      <p>
        A Rede de Agricultura de Precisão da Embrapa testou todos os satélites do acervo para achar um produto barato com resolução suficiente para enxergar a parcela de vinhedo (Flores da
        Cunha) e de pomar de maçã (Vacaria).
      </p>
    }
    pipeline={[
      'Comparação entre SRTM (90 m), ASTER (15 m), IKONOS (1–4 m) e ALOS (10 m e 2,5 m)',
      'Ortorretificação, registro e aumento linear de contraste (ENVI)',
      'Fusão das bandas RGB 321 com a pancromática: 2,5 m',
      'NDVI com as bandas 3 (vermelho, 0,58–0,68 µm) e 4 (NIR, 0,725–1,10 µm) do AVNIR-2',
      'Camadas de altimetria, declividade, exposição e NDVI no SIG (gvSIG)',
    ]}
    numeros={[
      { v: '10 m', l: 'multiespectral ALOS' },
      { v: '2,5 m', l: 'após fusão com a pancromática' },
      { v: 'out/2009', l: 'data da imagem NDVI do pomar' },
      { v: '2', l: 'unidades piloto: vinhedo e macieira' },
    ]}
    discutir={[
      <>Uma linha de videira tem menos de 1 m de largura, e o pixel do ALOS tem 10 m. O que exatamente o NDVI desse pixel está medindo? Teste "entrelinha: gramada" no lab.</>,
      <>Os autores recomendam imagens pouco antes e durante a colheita. Por que a imagem de outubro (brotação) ajuda menos?</>,
      <>O ALOS parou de ser fornecido. Que satélites gratuitos de hoje fazem o mesmo papel, e com que resolução?</>,
    ]}
  />
)
