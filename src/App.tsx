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
          <h1>Visão computacional aplicada à agricultura: detecção de objetos com CVAT e YOLO</h1>
          <p className="bigidea">
            Material de apoio a duas aulas de 4 horas sobre detecção de objetos em imagens agrícolas: definição da tarefa, protocolo de anotação, partição dos dados, treinamento, métricas de
            avaliação e avaliação sob mudança de distribuição. As figuras são geradas por script Python a partir de imagens de conjuntos públicos; quando envolvem previsões simuladas, isso é
            indicado na legenda.
          </p>
          <div className="hero-meta">
            <span className="chip">fundamentação → exemplo → prática</span>
            <span className="chip">slides integrados</span>
            <span className="chip">notebooks executáveis no Colab</span>
            <span className="chip">referências em ABNT</span>
          </div>
        </div>
        <figure className="fig-real hero-fig">
          <img src={fig('quatro_tarefas')} alt="quatro tarefas de visão computacional em uma imagem de vinhedo" />
          <figcaption>Classificação, detecção, segmentação semântica e de instâncias em uma imagem do WGISD (SANTOS et al., 2020).</figcaption>
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
        <div className="sec-head"><span className="n">·</span><h2>Conjuntos de dados utilizados</h2></div>
        <div className="artigos">
          <article className="artigo">
            <span className="artigo-tag">Embrapa · CC BY-NC 4.0</span>
            <p className="artigo-ref">WGISD, Embrapa Wine Grape Instance Segmentation Dataset</p>
            <p>300 imagens de cinco variedades de uva obtidas na Vinícola Guaspari (SP), com caixas no formato YOLO e máscaras de instância (SANTOS et al., 2020). Utilizado nas duas atividades práticas.</p>
            <a href="https://github.com/thsant/wgisd" target="_blank" rel="noreferrer">repositório <ExternalLink size={12} /></a>
          </article>
          <article className="artigo">
            <span className="artigo-tag">uso acadêmico</span>
            <p className="artigo-ref">CWFID, Crop/Weed Field Image Dataset</p>
            <p>Imagens de campo de cenoura com plantas daninhas e rótulo por pixel (HAUG; OSTERMANN, 2014). Utilizado nos exemplos de processamento clássico, convolução e segmentação.</p>
            <a href="https://github.com/cwfid/dataset" target="_blank" rel="noreferrer">repositório <ExternalLink size={12} /></a>
          </article>
          <article className="artigo">
            <span className="artigo-tag">material complementar</span>
            <p className="artigo-ref">CottonWeedDet12 · notebook YOLOWeeds</p>
            <p>Reprodução em escala reduzida do protocolo de Dang et al. (2023): 12 espécies de plantas daninhas do algodão, modelos de diferentes escalas, aumento de dados e repetições de Monte Carlo.</p>
            <a href="https://colab.research.google.com/github/tassid/pdi-agro/blob/main/notebooks/Extra_YOLOWeeds.ipynb" target="_blank" rel="noreferrer">abrir no Colab <ExternalLink size={12} /></a>
          </article>
        </div>
      </section>
      <section className="sec">
        <div className="sec-head"><span className="n">·</span><h2>Organização do material</h2></div>
        <div className="artigos">
          <article className="artigo"><span className="artigo-tag">estrutura</span><p>Cada bloco apresenta slides, fundamentação teórica com citações, exemplo aplicado, atividade prática e exercícios com gabarito. Cada aula termina com leituras recomendadas, pressupostos e limitações, e referências.</p></article>
          <article className="artigo"><span className="artigo-tag">apresentação</span><p><Presentation size={14} /> O modo de apresentação reúne os slides da aula; a navegação usa as setas do teclado e a tecla F alterna a tela cheia.</p></article>
          <article className="artigo"><span className="artigo-tag">figuras</span><p>O script <code>scripts/gerar_figuras.py</code> obtém as imagens dos repositórios públicos e regenera todas as figuras em <code>public/fig</code>, o que permite verificar e reproduzir cada uma.</p></article>
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
          <a href="#inicio" className="brand">Pixel no Campo · Detecção de objetos</a>
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
