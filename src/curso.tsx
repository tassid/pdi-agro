import React, { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, PenLine, ChevronLeft, ChevronRight, ExternalLink, FlaskConical, Lightbulb, Maximize2, Presentation, X } from 'lucide-react'
import { Quiz, type Q } from './ui'

/* ---------- modelo ---------- */

export type SlideSpec = {
  titulo: string
  img?: string // nome do arquivo em public/fig, sem extensão
  legenda?: string
  pontos?: React.ReactNode[]
  formula?: React.ReactNode
}

export type Bloco = {
  id: string
  cod: string // '1.1'
  titulo: string
  min: number
  tipo: 'conceito' | 'lab' | 'leitura'
  slides: SlideSpec[]
  teoria: React.ReactNode
  exemplo: React.ReactNode
  pratica: React.ReactNode
  exercicios?: Ex[]
}

export type Ex = { q: React.ReactNode; r: React.ReactNode; nivel?: 'básico' | 'médio' | 'desafio' }

export type Artigo = { ref: string; link: string; tag: string; porque: string; br?: boolean; perguntas?: string[] }

export type Aula = {
  id: string
  n: number
  titulo: string
  ideia: string
  chips: string[]
  objetivos: string[]
  intervaloDepois: string // id do bloco depois do qual vem o intervalo de 20 min
  blocos: Bloco[]
  quiz: Q[]
  artigos: Artigo[]
  notebook: { nome: string; arquivo: string; descricao: string }
  entregas: React.ReactNode[]
  limitacoes: React.ReactNode[]
  referencias: string[]
}

export const fig = (n: string) => `./fig/${n}.jpg`

/* ---------- peças de conteúdo ---------- */

export function Fig({ n, cap, w }: { n: string; cap: React.ReactNode; w?: number }) {
  return (
    <figure className="fig-real" style={w ? { maxWidth: w } : undefined}>
      <a href={fig(n)} target="_blank" rel="noreferrer" title="abrir em tamanho real">
        <img src={fig(n)} alt={typeof cap === 'string' ? cap : n} loading="lazy" />
      </a>
      <figcaption>{cap}</figcaption>
    </figure>
  )
}

const ETAPA = {
  teoria: { n: 1, t: 'Fundamentação teórica', icon: <BookOpen size={16} /> },
  exemplo: { n: 2, t: 'Exemplo aplicado', icon: <Lightbulb size={16} /> },
  pratica: { n: 3, t: 'Atividade prática', icon: <FlaskConical size={16} /> },
}

function Etapa({ k, children }: { k: keyof typeof ETAPA; children: React.ReactNode }) {
  const e = ETAPA[k]
  return (
    <div className={`etapa etapa-${k}`}>
      <div className="etapa-t">
        <span className="etapa-n">{e.n}</span> {e.icon} {e.t}
      </div>
      <div className="prose etapa-body">{children}</div>
    </div>
  )
}

export function Exercicios({ itens }: { itens: Ex[] }) {
  const [abertos, setAbertos] = useState<Set<number>>(new Set())
  const alterna = (i: number) => setAbertos((a) => { const n = new Set(a); if (n.has(i)) n.delete(i); else n.add(i); return n })
  return (
    <div className="exs">
      <div className="exs-t"><PenLine size={16} /> Exercícios com gabarito</div>
      <ol>
        {itens.map((e, i) => (
          <li key={i}>
            {e.nivel && <span className={`ex-nivel ${e.nivel}`}>{e.nivel}</span>}
            <div className="ex-q">{e.q}</div>
            <button className="btn ghost ex-btn" onClick={() => alterna(i)}>{abertos.has(i) ? 'esconder gabarito' : 'ver gabarito'}</button>
            {abertos.has(i) && <div className="ex-r">{e.r}</div>}
          </li>
        ))}
      </ol>
    </div>
  )
}

/* ---------- slides ---------- */

type DeckSlide = { titulo: string; sub?: string; body: React.ReactNode }

function SlideBody({ s }: { s: SlideSpec }) {
  return (
    <div className={`sl-grid ${s.img ? '' : 'sl-only-text'}`}>
      {s.img && (
        <figure className="sl-fig">
          <img src={fig(s.img)} alt={s.legenda ?? s.titulo} />
          {s.legenda && <figcaption>{s.legenda}</figcaption>}
        </figure>
      )}
      {(s.pontos || s.formula) && (
        <div className="sl-text">
          {s.formula && <div className="slide-formula">{s.formula}</div>}
          {s.pontos && (
            <ol className="sl-pontos">
              {s.pontos.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}

export function buildDeck(aula: Aula): { slides: DeckSlide[]; inicio: Record<string, number> } {
  const slides: DeckSlide[] = []
  const inicio: Record<string, number> = {}
  slides.push({
    titulo: aula.titulo,
    body: (
      <div className="slide-title-content">
        <p className="slide-eyebrow">Visão computacional aplicada · Aula {aula.n} de 2 · 4 horas</p>
        <p className="slide-bigidea">{aula.ideia}</p>
        <div className="slide-chips">
          {aula.chips.map((c) => (
            <span key={c} className="slide-chip">{c}</span>
          ))}
        </div>
      </div>
    ),
  })
  slides.push({
    titulo: 'Objetivos de aprendizagem',
    body: (
      <div className="slide-list">
        <ol>
          {aula.objetivos.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ol>
      </div>
    ),
  })
  aula.blocos.forEach((b) => {
    inicio[b.id] = slides.length
    slides.push({
      titulo: `Bloco ${b.cod}`,
      body: (
        <div className="sl-divisor">
          <p className="slide-eyebrow">{b.min} min · fundamentação → exemplo → prática</p>
          <p className="slide-bigidea">{b.titulo}</p>
        </div>
      ),
    })
    b.slides.forEach((s) => slides.push({ titulo: s.titulo, sub: `${b.cod} · ${b.titulo}`, body: <SlideBody s={s} /> }))
    if (b.id === aula.intervaloDepois)
      slides.push({ titulo: 'Intervalo · 20 min', body: <div className="sl-divisor"><p className="slide-bigidea">Intervalo. O treinamento iniciado no bloco anterior continua em execução.</p></div> })
  })
  slides.push({
    titulo: 'Leituras recomendadas',
    body: (
      <div className="slide-list">
        <ol>
          {aula.artigos.map((a) => (
            <li key={a.ref}>
              <strong>{a.tag}</strong> · {a.ref}
            </li>
          ))}
        </ol>
      </div>
    ),
  })
  return { slides, inicio }
}

export function SlideDeck({ aula, start = 0, onClose }: { aula: Aula; start?: number; onClose: () => void }) {
  const { slides } = buildDeck(aula)
  const [cur, setCur] = useState(start)
  const prev = () => setCur((c) => Math.max(0, c - 1))
  const next = () => setCur((c) => Math.min(slides.length - 1, c + 1))
  const full = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) prev()
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); next() }
      if (e.key === 'Escape') onClose()
      if (e.key === 'f' || e.key === 'F') full()
    }
    window.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', k)
      document.body.style.overflow = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const s = slides[cur]
  return (
    <div className="slide-deck">
      <div className="slide">
        <div className="slide-stripe" />
        <header className="slide-header">
          {s.titulo}
          {s.sub && <small className="sl-sub">{s.sub}</small>}
        </header>
        <div className="slide-content">{s.body}</div>
        <footer className="slide-footer">
          <span>Aula {aula.n} · {aula.titulo}</span>
          <span>{cur + 1} / {slides.length}</span>
        </footer>
      </div>
      <div className="slide-controls">
        <button onClick={onClose} title="Fechar (Esc)"><X size={20} /></button>
        <button onClick={full} title="Tela cheia (F)"><Maximize2 size={20} /></button>
        <button onClick={prev} disabled={cur === 0} title="Anterior (←)"><ChevronLeft size={24} /></button>
        <span className="slide-counter">{cur + 1} / {slides.length}</span>
        <button onClick={next} disabled={cur === slides.length - 1} title="Próximo (→)"><ChevronRight size={24} /></button>
      </div>
    </div>
  )
}

/** slides do bloco embutidos no guia: miniatura navegável, clique abre o modo apresentação */
function SlidesDoBloco({ b, onOpen }: { b: Bloco; onOpen: (i: number) => void }) {
  const [i, setI] = useState(0)
  const s = b.slides[i]
  return (
    <div className="mini-deck">
      <div className="mini-head">
        <span><Presentation size={14} /> Slides do bloco · {i + 1} de {b.slides.length}</span>
        <span className="mini-acts">
          <button onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} aria-label="slide anterior"><ChevronLeft size={16} /></button>
          <button onClick={() => setI(Math.min(b.slides.length - 1, i + 1))} disabled={i === b.slides.length - 1} aria-label="próximo slide"><ChevronRight size={16} /></button>
          <button onClick={() => onOpen(i)}><Maximize2 size={14} /> apresentar</button>
        </span>
      </div>
      <div className="slide mini">
        <div className="slide-stripe" />
        <header className="slide-header">{s.titulo}</header>
        <div className="slide-content"><SlideBody s={s} /></div>
      </div>
    </div>
  )
}

/* ---------- roteiro ---------- */

const COR = { conceito: '#e3e6fb', lab: '#ffe000', leitura: '#f3e3d3', pausa: 'repeating-linear-gradient(45deg,#f2f2f2 0 6px,#e4e4e4 6px 12px)' }

function Roteiro({ aula }: { aula: Aula }) {
  const itens: { t: string; min: number; tipo: keyof typeof COR; id?: string }[] = []
  aula.blocos.forEach((b) => {
    itens.push({ t: `${b.cod} ${b.titulo}`, min: b.min, tipo: b.tipo, id: b.id })
    if (b.id === aula.intervaloDepois) itens.push({ t: 'Intervalo', min: 20, tipo: 'pausa' })
  })
  let t0 = 0
  return (
    <div className="roteiro">
      <div className="roteiro-bar">
        {itens.map((s, i) => {
          const ini = t0
          t0 += s.min
          const hm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
          return (
            <a key={i} href={s.id ? `#${s.id}` : undefined} style={{ flex: s.min, background: COR[s.tipo] }} title={`${hm(ini)} a ${hm(t0)} · ${s.t}`}
              onClick={(e) => { if (s.id) { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' }) } }}>
              {s.min}′
            </a>
          )
        })}
      </div>
      <div className="roteiro-legend">
        <span><b>{t0} min</b> no total</span>
        <span><i style={{ background: COR.conceito }} /> conceito</span>
        <span><i style={{ background: COR.lab }} /> laboratório</span>
        <span><i style={{ background: COR.leitura }} /> leitura de artigo</span>
        <span><i style={{ background: COR.pausa }} /> intervalo</span>
      </div>
    </div>
  )
}

/* ---------- página da aula ---------- */

export function AulaPage({ aula, prev, next }: { aula: Aula; prev?: Aula; next?: Aula }) {
  const [deck, setDeck] = useState<number | null>(null)
  const { inicio } = buildDeck(aula)
  const ids = [...aula.blocos.map((b) => b.id), 'artigos', 'quiz', 'entregas', 'limitacoes', 'referencias']
  const [on, setOn] = useState(ids[0])
  useEffect(() => {
    const obs = new IntersectionObserver(
      (es) => {
        const v = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (v[0]) setOn(v[0].target.id)
      },
      { rootMargin: '-80px 0px -65% 0px' },
    )
    ids.forEach((id) => { const el = document.getElementById(id); if (el) obs.observe(el) })
    return () => obs.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aula.id])
  const go = (id: string) => (e: React.MouseEvent) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }) }
  const nb = `https://colab.research.google.com/github/tassid/pdi-agro/blob/main/notebooks/${aula.notebook.arquivo}`
  return (
    <main>
      {deck !== null && <SlideDeck aula={aula} start={deck} onClose={() => setDeck(null)} />}
      <header className="wrap lesson-head">
        <div className="eyebrow head-row">
          <span>Visão computacional aplicada · Aula {aula.n} de 2 · 240 min com intervalo</span>
          <button className="btn-slides" onClick={() => setDeck(0)}><Presentation size={16} /> Apresentar a aula inteira</button>
        </div>
        <h1>{aula.titulo}</h1>
        <p className="bigidea">{aula.ideia}</p>
        <div className="hero-meta" style={{ marginTop: 18 }}>
          {aula.chips.map((c) => <span key={c} className="chip">{c}</span>)}
        </div>
        <Roteiro aula={aula} />
        <div className="head-cols">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>objetivos de aprendizagem: ao final da aula, o estudante deverá ser capaz de</div>
            <ol className="objs">{aula.objetivos.map((o) => <li key={o}>{o}</li>)}</ol>
          </div>
          <a className="nb-card" href={nb} target="_blank" rel="noreferrer">
            <img src="https://colab.research.google.com/assets/colab-badge.svg" alt="Abrir no Colab" />
            <b>{aula.notebook.nome}</b>
            <span>{aula.notebook.descricao}</span>
          </a>
        </div>
      </header>
      <div className="wrap lesson-grid">
        <nav className="toc" aria-label="Blocos da aula">
          <ol>
            {aula.blocos.map((b) => (
              <li key={b.id}>
                <a href={`#${b.id}`} onClick={go(b.id)} className={on === b.id ? 'on' : ''}>
                  <span className="n">{b.cod}</span><span>{b.titulo}</span>
                </a>
              </li>
            ))}
            {[['artigos', 'Leituras recomendadas'], ['quiz', 'Avaliação formativa'], ['entregas', 'Atividade avaliativa'], ['limitacoes', 'Pressupostos e limitações'], ['referencias', 'Referências']].map(([id, t]) => (
              <li key={id}><a href={`#${id}`} onClick={go(id)} className={on === id ? 'on' : ''}><span className="n">·</span><span>{t}</span></a></li>
            ))}
          </ol>
        </nav>
        <div className="content">
          {aula.blocos.map((b) => (
            <React.Fragment key={b.id}>
              <section className="sec" id={b.id}>
                <div className="sec-head">
                  <span className="n">{b.cod}</span>
                  <h2>{b.titulo}</h2>
                  <span className="min">{b.min} min</span>
                </div>
                <SlidesDoBloco b={b} onOpen={(i) => setDeck(inicio[b.id] + 1 + i)} />
                <Etapa k="teoria">{b.teoria}</Etapa>
                <Etapa k="exemplo">{b.exemplo}</Etapa>
                <Etapa k="pratica">
                  {b.pratica}
                  {b.exercicios && <Exercicios itens={b.exercicios} />}
                </Etapa>
              </section>
              {b.id === aula.intervaloDepois && <div className="intervalo">Intervalo de 20 minutos</div>}
            </React.Fragment>
          ))}
          <section className="sec" id="artigos">
            <div className="sec-head"><span className="n">·</span><h2>Leituras recomendadas</h2></div>
            <div className="artigos">
              {aula.artigos.map((a) => (
                <article key={a.ref} className="artigo">
                  <span className="artigo-tag">{a.tag}{a.br ? ' · Brasil' : ''}</span>
                  <p className="artigo-ref">{a.ref}</p>
                  <p>{a.porque}</p>
                  {a.perguntas && (
                    <details className="ficha">
                      <summary>ficha de leitura crítica</summary>
                      <ol>{a.perguntas.map((q) => <li key={q}>{q}</li>)}</ol>
                    </details>
                  )}
                  <a href={a.link} target="_blank" rel="noreferrer">abrir <ExternalLink size={12} /></a>
                </article>
              ))}
            </div>
          </section>
          <section className="sec" id="quiz">
            <div className="sec-head"><span className="n">·</span><h2>Avaliação formativa</h2><span className="min">{aula.quiz.length} perguntas</span></div>
            <Quiz qs={aula.quiz} />
          </section>
          <section className="sec" id="entregas">
            <div className="sec-head"><span className="n">·</span><h2>Atividade avaliativa (em dupla)</h2></div>
            <ol className="desafios">{aula.entregas.map((d, i) => <li key={i}><div>{d}</div></li>)}</ol>
          </section>
          <section className="sec" id="limitacoes">
            <div className="sec-head"><span className="n">·</span><h2>Pressupostos e limitações deste material</h2></div>
            <ol className="desafios">{aula.limitacoes.map((d, i) => <li key={i}><div>{d}</div></li>)}</ol>
          </section>
          <section className="sec" id="referencias">
            <div className="sec-head"><span className="n">·</span><h2>Referências</h2></div>
            <ul className="refs">{[...aula.referencias].sort((a, b) => a.localeCompare(b, 'pt')).map((r) => <li key={r}>{r}</li>)}</ul>
          </section>
          <nav className="pager" aria-label="Outras aulas">
            {prev ? <a href={`#${prev.id}`}><small><ArrowLeft size={12} /> Aula {prev.n}</small>{prev.titulo}</a> : <a href="#inicio"><small><ArrowLeft size={12} /> Início</small>Visão geral</a>}
            {next ? <a href={`#${next.id}`} className="next"><small>Aula {next.n} <ArrowRight size={12} /></small>{next.titulo}</a> : <a href="#inicio" className="next"><small>Início <ArrowRight size={12} /></small>Visão geral</a>}
          </nav>
        </div>
      </div>
    </main>
  )
}
