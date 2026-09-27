import React, { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Quiz, type Q } from './ui'

export type Trilha = 'grad' | 'mest'

export type Secao = { id: string; titulo: string; min?: number; body: React.ReactNode }

export type Aula = {
  id: string // 'aula1'
  n: number
  trilha: Trilha
  titulo: string
  ideia: string
  ementa: string[]
  labs: string[]
  cor: string[] // 4 cores do "swatch" do cartão
  objetivos: string[]
  roteiro: { t: string; min: number; tipo: 'gancho' | 'conceito' | 'lab' | 'fecho' }[]
  secoes: Secao[]
  quiz: Q[]
  desafios: { nivel: string; txt: React.ReactNode }[]
  leitura: React.ReactNode[]
}

export const TRILHA = {
  grad: { nome: 'Graduação · Ciência da Computação', curto: 'Graduação', disc: 'OP63I · Processamento de Imagens e Reconhecimento de Padrões' },
  mest: { nome: 'Mestrado · PPGTCA', curto: 'Mestrado', disc: 'Tecnologias Computacionais para o Agronegócio' },
}

const TIPO_COR = {
  gancho: 'var(--grain-soft)',
  conceito: 'var(--sky-soft)',
  lab: 'var(--leaf-soft)',
  fecho: 'var(--soil-soft)',
}
const TIPO_NOME = { gancho: 'gancho', conceito: 'conceito', lab: 'mão na massa', fecho: 'fechamento' }

export function Roteiro({ r }: { r: Aula['roteiro'] }) {
  const total = r.reduce((a, b) => a + b.min, 0)
  return (
    <div className="roteiro" aria-label={`Roteiro de ${total} minutos`}>
      <div className="roteiro-bar">
        {r.map((s, i) => (
          <div key={i} style={{ flex: s.min, background: TIPO_COR[s.tipo] }} title={`${s.t} · ${s.min} min`}>
            {s.min}′
          </div>
        ))}
      </div>
      <div className="roteiro-legend">
        <span>
          <b>{total} min</b> no total
        </span>
        {(Object.keys(TIPO_COR) as (keyof typeof TIPO_COR)[]).map((k) => (
          <span key={k} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <i style={{ width: 10, height: 10, background: TIPO_COR[k], border: '1px solid var(--rule)', borderRadius: 2, display: 'inline-block' }} />
            {TIPO_NOME[k]} ({r.filter((s) => s.tipo === k).reduce((a, b) => a + b.min, 0)}′)
          </span>
        ))}
      </div>
    </div>
  )
}

export function LessonPage({ aula, prev, next }: { aula: Aula; prev?: Aula; next?: Aula }) {
  const secs: { id: string; titulo: string; min?: number }[] = [
    ...aula.secoes,
    { id: 'quiz', titulo: 'Quiz relâmpago', min: undefined },
    { id: 'desafios', titulo: 'Desafios pra casa' },
    { id: 'leitura', titulo: 'Leitura' },
  ]
  const [on, setOn] = useState(secs[0].id)
  useEffect(() => {
    const obs = new IntersectionObserver(
      (es) => {
        const vis = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (vis[0]) setOn(vis[0].target.id)
      },
      { rootMargin: '-80px 0px -65% 0px' },
    )
    secs.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) obs.observe(el)
    })
    return () => obs.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aula.id])

  const t = TRILHA[aula.trilha]
  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return (
    <main>
      <header className="wrap lesson-head">
        <div className="eyebrow">
          {t.curto} · Aula {aula.n} de 6 · {t.disc}
        </div>
        <h1>{aula.titulo}</h1>
        <p className="bigidea">{aula.ideia}</p>
        <div className="hero-meta" style={{ marginTop: 18 }}>
          {aula.ementa.map((e) => (
            <span key={e} className="chip">
              {e}
            </span>
          ))}
        </div>
        <Roteiro r={aula.roteiro} />
        <div style={{ marginTop: 22, maxWidth: '72ch' }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            ao final, a turma consegue
          </div>
          <ol style={{ margin: 0, paddingLeft: '1.3em', display: 'grid', gap: 4 }}>
            {aula.objetivos.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ol>
        </div>
      </header>
      <div className="wrap lesson-grid">
        <nav className="toc" aria-label="Seções da aula">
          <ol>
            {secs.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} onClick={go(s.id)} className={on === s.id ? 'on' : ''}>
                  <span className="n">{i < aula.secoes.length ? `${aula.n}.${i + 1}` : '·'}</span>
                  <span>{s.titulo}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="content">
          {aula.secoes.map((s, i) => (
            <section className="sec" id={s.id} key={s.id}>
              <div className="sec-head">
                <span className="n">
                  {aula.n}.{i + 1}
                </span>
                <h2>{s.titulo}</h2>
                {s.min && <span className="min">~{s.min} min</span>}
              </div>
              {s.body}
            </section>
          ))}
          <section className="sec" id="quiz">
            <div className="sec-head">
              <span className="n">·</span>
              <h2>Quiz relâmpago</h2>
              <span className="min">5 perguntas</span>
            </div>
            <Quiz qs={aula.quiz} />
          </section>
          <section className="sec" id="desafios">
            <div className="sec-head">
              <span className="n">·</span>
              <h2>Desafios pra casa</h2>
            </div>
            <ol className="desafios">
              {aula.desafios.map((d, i) => (
                <li key={i}>
                  <div>
                    <span className="lvl">{d.nivel}</span>
                    {d.txt}
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <section className="sec" id="leitura">
            <div className="sec-head">
              <span className="n">·</span>
              <h2>Leitura</h2>
            </div>
            <ul className="refs">
              {aula.leitura.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </section>
          <nav className="pager" aria-label="Outras aulas">
            {prev ? (
              <a href={`#${prev.id}`}>
                <small>
                  <ArrowLeft size={12} /> Aula {prev.n}
                </small>
                {prev.titulo}
              </a>
            ) : (
              <a href="#inicio">
                <small>
                  <ArrowLeft size={12} /> Início
                </small>
                Todas as aulas
              </a>
            )}
            {next ? (
              <a href={`#${next.id}`} className="next">
                <small>
                  Aula {next.n} <ArrowRight size={12} />
                </small>
                {next.titulo}
              </a>
            ) : (
              <a href="#inicio" className="next">
                <small>
                  Início <ArrowRight size={12} />
                </small>
                Todas as aulas
              </a>
            )}
          </nav>
        </div>
      </div>
    </main>
  )
}
