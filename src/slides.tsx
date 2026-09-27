import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, X, Maximize2 } from 'lucide-react'
import type { Aula } from './lesson'
import { TRILHA } from './lesson'

type SlideData = {
  title: string
  content: React.ReactNode
}

function buildSlides(aula: Aula): SlideData[] {
  const t = TRILHA[aula.trilha]
  const slides: SlideData[] = []

  // Slide 1: Título
  slides.push({
    title: aula.titulo,
    content: (
      <div className="slide-title-content">
        <p className="slide-eyebrow">{t.curto} · Aula {aula.n} de 6</p>
        <p className="slide-bigidea">{aula.ideia}</p>
        <div className="slide-chips">
          {aula.ementa.map((e) => (
            <span key={e} className="slide-chip">{e}</span>
          ))}
        </div>
      </div>
    ),
  })

  // Slide 2: Objetivos
  slides.push({
    title: 'Objetivos da aula',
    content: (
      <div className="slide-list">
        <p>Ao final, a turma consegue:</p>
        <ol>
          {aula.objetivos.map((o, i) => (
            <li key={i}>{o}</li>
          ))}
        </ol>
      </div>
    ),
  })

  // Slides das seções (simplificados)
  aula.secoes.forEach((sec, i) => {
    slides.push({
      title: sec.titulo,
      content: (
        <div className="slide-section">
          <p className="slide-section-num">Seção {aula.n}.{i + 1}</p>
          <div className="slide-section-body">
            {sec.body}
          </div>
        </div>
      ),
    })
  })

  // Slide Quiz
  slides.push({
    title: 'Quiz relâmpago',
    content: (
      <div className="slide-list">
        <ol>
          {aula.quiz.map((q, i) => (
            <li key={i}>
              <strong>{q.p}</strong>
              <ol type="a" style={{ marginTop: 8 }}>
                {q.o.map((opt, j) => (
                  <li key={j} style={{ color: j === q.a ? '#228b22' : undefined }}>
                    {opt} {j === q.a && '✓'}
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      </div>
    ),
  })

  // Slide Desafios
  slides.push({
    title: 'Desafios pra casa',
    content: (
      <div className="slide-list">
        <ol>
          {aula.desafios.map((d, i) => (
            <li key={i}>
              <strong>[{d.nivel}]</strong> {d.txt}
            </li>
          ))}
        </ol>
      </div>
    ),
  })

  // Slide Leitura
  slides.push({
    title: 'Leitura recomendada',
    content: (
      <div className="slide-list">
        <ul>
          {aula.leitura.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </div>
    ),
  })

  return slides
}

export function SlideDeck({ aula, onClose }: { aula: Aula; onClose: () => void }) {
  const slides = buildSlides(aula)
  const [current, setCurrent] = useState(0)

  const prev = () => setCurrent((c) => Math.max(0, c - 1))
  const next = () => setCurrent((c) => Math.min(slides.length - 1, c + 1))

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prev()
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') next()
      if (e.key === 'Escape') onClose()
      if (e.key === 'f' || e.key === 'F') toggleFullscreen()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  const slide = slides[current]

  return (
    <div className="slide-deck">
      <div className="slide">
        <div className="slide-stripe" />
        <header className="slide-header">{slide.title}</header>
        <div className="slide-content">{slide.content}</div>
        <footer className="slide-footer">
          <span>{current + 1} / {slides.length}</span>
        </footer>
      </div>

      <div className="slide-controls">
        <button onClick={onClose} title="Fechar (Esc)">
          <X size={20} />
        </button>
        <button onClick={toggleFullscreen} title="Tela cheia (F)">
          <Maximize2 size={20} />
        </button>
        <button onClick={prev} disabled={current === 0} title="Anterior (←)">
          <ChevronLeft size={24} />
        </button>
        <span className="slide-counter">{current + 1} / {slides.length}</span>
        <button onClick={next} disabled={current === slides.length - 1} title="Próximo (→)">
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  )
}
