import { useEffect, useState } from 'react'
import { ExternalLink, Presentation } from 'lucide-react'
import { AulaPage, fig } from './curso'
import { aula1 } from './aulas/Aula1'
import { aula2 } from './aulas/Aula2'

const AULAS = [aula1, aula2]

function useHash() {
  const [h, setH] = useState(() => location.hash.slice(1) || 'inicio')
  useEffect(() => {
    const f = () => { setH(location.hash.slice(1) || 'inicio'); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return h
}

function Inicio() {
  return (
    <main className="wrap home">
      <section className="hero">
        <div>
          <div className="eyebrow">UTFPR Medianeira · PPGTCA · 2 encontros de 4 horas</div>
          <h1>Visão computacional aplicada com CVAT e YOLO</h1>
          <p className="bigidea">
            Do pixel à contagem no campo: definir a tarefa, anotar com critério, dividir sem vazamento, treinar, medir e testar numa fazenda que o modelo nunca viu. Todas as figuras saem de fotos
            reais de vinhedo e lavoura, geradas em Python pelo script do repositório.
          </p>
          <div className="hero-meta">
            <span className="chip">teoria → exemplo → prática em cada bloco</span>
            <span className="chip">slides integrados</span>
            <span className="chip">notebooks no Colab</span>
            <span className="chip">artigos reais</span>
          </div>
        </div>
        <figure className="fig-real hero-fig">
          <img src={fig('quatro_tarefas')} alt="quatro tarefas de visão numa foto de vinhedo" />
          <figcaption>WGISD (Embrapa): uma foto, quatro tarefas de visão.</figcaption>
        </figure>
      </section>
      <div className="aula-cards">
        {AULAS.map((a) => (
          <a key={a.id} href={`#${a.id}`} className="aula-card">
            <img src={fig(a.n === 1 ? 'nms_antes_depois' : 'augmentation_real')} alt="" />
            <div>
              <span className="eyebrow">Aula {a.n} · 240 min</span>
              <h2>{a.titulo}</h2>
              <p>{a.ideia}</p>
              <ol className="mini-blocos">
                {a.blocos.map((b) => <li key={b.id}><b>{b.cod}</b> {b.titulo} <small>{b.min}′</small></li>)}
              </ol>
            </div>
          </a>
        ))}
      </div>
      <section className="sec">
        <div className="sec-head"><span className="n">·</span><h2>Bancos de imagens usados</h2></div>
        <div className="artigos">
          <article className="artigo">
            <span className="artigo-tag">Embrapa · CC BY-NC 4.0</span>
            <p className="artigo-ref">WGISD, Embrapa Wine Grape Instance Segmentation Dataset</p>
            <p>300 fotos de 5 variedades de uva na Vinícola Guaspari (SP), com 4.431 caixas no formato YOLO e máscaras de instância. Base das duas práticas.</p>
            <a href="https://github.com/thsant/wgisd" target="_blank" rel="noreferrer">repositório <ExternalLink size={12} /></a>
          </article>
          <article className="artigo">
            <span className="artigo-tag">campo · uso acadêmico</span>
            <p className="artigo-ref">CWFID, Crop/Weed Field Image Dataset</p>
            <p>Fotos de cenoura com daninhas e rótulo por pixel. Usado nos exemplos de PDI clássico, convolução e U-Net.</p>
            <a href="https://github.com/cwfid/dataset" target="_blank" rel="noreferrer">repositório <ExternalLink size={12} /></a>
          </article>
          <article className="artigo">
            <span className="artigo-tag">extra</span>
            <p className="artigo-ref">CottonWeedDet12 · notebook YOLOWeeds</p>
            <p>Reprodução reduzida de Dang et al. (2023): 12 daninhas do algodão, modelos de tamanhos diferentes, augmentation e Monte-Carlo.</p>
            <a href="https://colab.research.google.com/github/tassid/pdi-agro/blob/main/notebooks/Extra_YOLOWeeds.ipynb" target="_blank" rel="noreferrer">abrir no Colab <ExternalLink size={12} /></a>
          </article>
        </div>
      </section>
      <section className="sec">
        <div className="sec-head"><span className="n">·</span><h2>Como usar</h2></div>
        <div className="artigos">
          <article className="artigo"><span className="artigo-tag">turma</span><p>Cada bloco começa pelos slides, segue com a teoria, mostra o exemplo em foto real e termina na prática (laboratório no navegador ou célula do Colab).</p></article>
          <article className="artigo"><span className="artigo-tag">professora</span><p><Presentation size={14} /> "Apresentar a aula inteira" abre todos os slides em sequência; setas do teclado navegam, F para tela cheia. Cada bloco também tem o botão "apresentar".</p></article>
          <article className="artigo"><span className="artigo-tag">figuras</span><p><code>python scripts/gerar_figuras.py</code> baixa as fotos dos bancos e regenera todas as imagens em <code>public/fig</code>.</p></article>
        </div>
      </section>
    </main>
  )
}

export default function App() {
  const h = useHash()
  const i = AULAS.findIndex((a) => a.id === h)
  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <a href="#inicio" className="brand">Pixel no Campo · CVAT e YOLO</a>
          <nav className="topnav">
            {AULAS.map((a) => <a key={a.id} href={`#${a.id}`} aria-current={h === a.id ? 'page' : undefined}>Aula {a.n}</a>)}
            <a href="https://github.com/tassid/pdi-agro" target="_blank" rel="noreferrer">GitHub</a>
          </nav>
        </div>
      </header>
      {i >= 0 ? <AulaPage key={h} aula={AULAS[i]} prev={AULAS[i - 1]} next={AULAS[i + 1]} /> : <Inicio />}
      <footer className="wrap foot">Tassiane Anzolin · PPGTCA / UTFPR Medianeira · material antigo (8 aulas de 60 min e 3 h) em <code>archive/site-v1</code></footer>
    </>
  )
}
