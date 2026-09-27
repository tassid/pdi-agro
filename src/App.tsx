import { useEffect, useMemo, useState } from 'react'
import { rgbIndex, normalize, histogram, otsu, threshold, maskToGray, rdylgn, INDEX_RANGE } from './lib/img'
import { ImgCanvas, Seg } from './ui'
import { LessonPage, TRILHA, type Aula } from './lesson'
import { field } from './samples'
import { aula1 } from './aulas/Aula1'
import { aula2 } from './aulas/Aula2'
import { aula3 } from './aulas/Aula3'
import { aula4 } from './aulas/Aula4'
import { aula5 } from './aulas/Aula5'
import { aula6 } from './aulas/Aula6'

const AULAS: Aula[] = [aula1, aula2, aula3, aula4, aula5, aula6]

const CASOS = [
  { a: 'aula1', t: 'Tomates separados pela cor', ref: 'Noguti Júnior, Santos e Florian · Revista FT, 2023', o: 'A tabela HSV do artigo numa esteira simulada, webcam HD × Full HD e o erro de unidade do H no OpenCV' },
  { a: 'aula2', t: 'Contagem de frangos no aviário', ref: 'Berlanda · TCC UTFPR Medianeira, 2015', o: 'Clarão da câmera infravermelha, subtração de fundo, inRange e contagem por área da ave em seis regiões' },
  { a: 'aula3', t: 'Doença em folhas de laranjeira e mapa do pomar', ref: 'Schenatto · TCC UTFPR Medianeira, 2011', o: 'Canais L e H do HLS, severidade por folha e interpolação por inverso da distância' },
  { a: 'aula4', t: 'NDVI em vinhedo e macieira', ref: 'Hoff et al. · Embrapa Uva e Vinho, 2011', o: 'ALOS a 10 m e 2,5 m, NDVI por parcela e o pixel misturado da entrelinha' },
  { a: 'aula4', t: 'Falhas e duplas na linha de soja', ref: 'Souza et al. · Energia na Agricultura, 2022', o: 'GSD do Phantom 3 Pro, sobreposição das plantas em V4 e a classificação de Kurachi' },
  { a: 'aula5', t: 'Braquiária na entrelinha dos citros', ref: 'Carvalho e Carvalho · Embrapa Mandioca e Fruticultura, 2022', o: 'Segmentação treinável com Random Forest, Kappa e a validação por pixel' },
  { a: 'aula5', t: 'Linha de base com Dummy', ref: 'Souza et al. · Energia na Agricultura, 2022', o: 'Random Forest a 65,5% contra 49,6% do chute' },
]

const LEITURAS = [
  {
    a: 'aula2',
    t: 'Desenvolvimento de ferramenta não invasiva para cálculo de densidade de aves em aviários comerciais',
    ref: 'Algeri, Becker-Algeri, Abreu e Paula Filho · Revista de Computação Aplicada ao Agronegócio (UTFPR Medianeira), v. 1, n. 2, 2018',
    url: 'https://periodicos.utfpr.edu.br/rcaa/article/download/9396/6139',
    o: 'A continuação do TCC do aviário: câmeras infravermelhas, classificadores Haar e LBP e cerca de 17,7% de erro médio em 1.920 imagens. Bom para comparar receita manual com detector treinado.',
  },
  {
    a: 'aula3',
    t: 'Geoprocessamento aplicado à agricultura visando o mapeamento de doenças em folhas de laranjeiras',
    ref: 'Schenatto · TCC UTFPR Medianeira, 2011 (o caso da Aula 3, no RIUT)',
    url: 'https://repositorio.utfpr.edu.br/jspui/handle/1/13433',
    o: 'O texto completo do caso da laranjeira, com o módulo em C++ e OpenCV e o módulo de mapas.',
  },
  {
    a: 'aula6',
    t: 'Identificação de plantas de milho utilizando imagens aéreas obtidas por VANTs',
    ref: 'Salvadori · TCC Ciência da Computação, UTFPR Ponta Grossa, 2020',
    url: 'https://repositorio.utfpr.edu.br/jspui/bitstream/1/26481/1/identificacaomilhoimagensaereas.pdf',
    o: 'A mesma pergunta com dois métodos: HSV + componentes conexos (precisão 50,4%, revocação 81,6%) contra RetinaNet (99,0% e 97,6%). Liga a Aula 3 à Aula 6.',
  },
  {
    a: 'aula5',
    t: 'Detecção de objetos em imagens por meio da combinação de descritores locais e classificadores',
    ref: 'Ghellere · TCC Ciência da Computação, UTFPR Medianeira, 2015',
    url: 'https://repositorio.utfpr.edu.br/jspui/bitstream/1/12518/4/MD_COCIC_2015_1_02.pdf',
    o: 'SIFT e SURF com bag of keypoints e cinco classificadores (redes neurais, fuzzy, Random Forest, SVM, k-NN). Não é agro, mas é o pipeline da Aula 5 inteiro num TCC do curso.',
  },
  {
    a: 'aula5',
    t: 'Técnicas de aprendizado ativo para avaliação do vigor de sementes de soja',
    ref: 'RIUT · para explorar',
    url: 'http://riut.utfpr.edu.br/jspui/handle/1/5184',
    o: 'Tema para seminário: rotular menos imagens escolhendo quais o especialista deve rotular primeiro.',
  },
  {
    a: 'aula1',
    t: 'Desenvolvimento de um aplicativo mobile para o auxílio do teste de tetrazólio nas sementes de soja',
    ref: 'RIUT · para explorar',
    url: 'https://repositorio.utfpr.edu.br/jspui/handle/1/32447',
    o: 'Tema para desafio: celular como sensor, com a cor do tetrazólio indicando o vigor da semente.',
  },
]

function useHash() {
  const read = () => (typeof location !== 'undefined' ? location.hash.replace('#', '') : '')
  const [h, setH] = useState(read)
  useEffect(() => {
    const f = () => {
      const nh = read()
      setH((old) => {
        const isAula = (x: string) => AULAS.some((a) => a.id === x)
        if (isAula(nh) || nh === 'inicio' || nh === '' || isAula(old)) window.scrollTo({ top: 0 })
        return nh
      })
    }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return h
}

function HeroDemo() {
  const [etapa, setEtapa] = useState<'o que a câmera grava' | 'índice ExG' | 'máscara de planta'>('o que a câmera grava')
  const [p, setP] = useState<[number, number] | null>(null)
  const sc = field(7, 0.6, 26, 0.5)
  const exg = useMemo(() => rgbIndex(sc.rgb, 'ExG'), [sc])
  const [lo, hi] = INDEX_RANGE.ExG
  const view = useMemo(() => normalize(exg, lo, hi), [exg, lo, hi])
  const t = useMemo(() => otsu(histogram(view)), [view])
  const mask = useMemo(() => threshold(view, t), [view, t])
  const cover = useMemo(() => (100 * mask.data.reduce((a, b) => a + b, 0)) / mask.data.length, [mask])
  const img = etapa === 'o que a câmera grava' ? sc.rgb : etapa === 'índice ExG' ? view : maskToGray(mask)
  const lut = etapa === 'índice ExG' ? (v: number) => rdylgn(v / 255) : undefined
  const k = p ? p[1] * sc.w + p[0] : -1
  return (
    <div className="demo">
      <Seg value={etapa} options={['o que a câmera grava', 'índice ExG', 'máscara de planta'] as const} onChange={setEtapa} />
      <div className="demo-stage" style={{ marginTop: 10 }}>
        <ImgCanvas img={img} lut={lut} onPixel={(x, y) => setP([x, y])} label="talhão de soja simulado visto de cima" />
      </div>
      <div className="demo-caption">
        <span>
          {p
            ? `pixel (${p[0]}, ${p[1]}) · RGB ${[0, 1, 2].map((c) => Math.round(sc.rgb.data[k * 3 + c])).join(', ')} · ExG ${exg.data[k].toFixed(2)}`
            : 'passe o mouse sobre o talhão'}
        </span>
        <span>cobertura verde: {cover.toFixed(1)}%</span>
      </div>
    </div>
  )
}

function Swatch({ c }: { c: string[] }) {
  return (
    <span className="swatch" aria-hidden="true">
      {c.map((x, i) => (
        <i key={i} style={{ background: x }} />
      ))}
    </span>
  )
}

function Home() {
  const grad = AULAS.filter((a) => a.trilha === 'grad'), mest = AULAS.filter((a) => a.trilha === 'mest')
  const Card = ({ a }: { a: Aula }) => (
    <a className="acard" href={`#${a.id}`}>
      <div className="acard-top">
        <span className="acard-num">Aula {a.n} · 60 min</span>
        <Swatch c={a.cor} />
      </div>
      <h3>{a.titulo}</h3>
      <p className="idea">{a.ideia}</p>
      <div className="labs">
        {a.labs.map((l) => (
          <span className="chip leaf" key={l}>
            {l}
          </span>
        ))}
      </div>
    </a>
  )
  return (
    <main>
      <section className="wrap hero">
        <div>
          <div className="eyebrow">UTFPR · Campus Medianeira · 6 aulas interativas</div>
          <h1>
            Processamento digital de imagens <em>aplicado ao agronegócio</em>
          </h1>
          <p className="lede">Cada aula tem teoria curta, laboratórios que rodam aqui mesmo no navegador e um caso real do campo. Dá para usar as imagens de exemplo ou a foto que você tirar agora.</p>
          <div className="hero-meta">
            <span className="chip">3 aulas · graduação</span>
            <span className="chip">3 aulas · mestrado</span>
            <span className="chip">25 laboratórios</span>
            <span className="chip">7 casos reais</span>
            <span className="chip">nada para instalar</span>
          </div>
        </div>
        <HeroDemo />
      </section>

      <section className="wrap track" id="como">
        <div className="howto">
          <div>
            <h3>Para a turma</h3>
            <p>Abra a aula, mexa nos controles dos laboratórios e tente responder às perguntas antes de ler a explicação. Tudo roda no seu navegador, inclusive no celular.</p>
          </div>
          <div>
            <h3>Para quem dá a aula</h3>
            <p>A barra colorida no topo de cada aula é o roteiro de 60 minutos. Os blocos azuis "Nota pra quem dá a aula" trazem dinâmicas e perguntas para fazer à turma.</p>
          </div>
          <div>
            <h3>Para ir além</h3>
            <p>Cada aula termina com código Python pronto para o Google Colab, quiz, desafios em três níveis e a leitura da bibliografia da disciplina.</p>
          </div>
        </div>
      </section>

      <section className="wrap track" id="graduacao">
        <div className="track-head">
          <div>
            <div className="eyebrow">{TRILHA.grad.disc}</div>
            <h2>Graduação em Ciência da Computação</h2>
          </div>
          <p>Da aquisição à contagem de objetos: espaço de cores, transformações, morfologia matemática, segmentação e descritores, cobrindo a primeira parte da ementa da disciplina.</p>
        </div>
        <div className="cards">
          {grad.map((a) => (
            <Card a={a} key={a.id} />
          ))}
        </div>
      </section>

      <section className="wrap track" id="mestrado">
        <div className="track-head">
          <div>
            <div className="eyebrow">{TRILHA.mest.disc}</div>
            <h2>Mestrado · PPGTCA</h2>
          </div>
          <p>Além do visível e além da regra fixa: sensoriamento multiespectral, reconhecimento de padrões com validação honesta e redes convolucionais treinadas ao vivo.</p>
        </div>
        <div className="cards">
          {mest.map((a) => (
            <Card a={a} key={a.id} />
          ))}
        </div>
      </section>


      <section className="wrap track" id="casos">
        <div className="track-head">
          <div>
            <div className="eyebrow">trabalhos publicados, reproduzidos no navegador</div>
            <h2>Casos reais</h2>
          </div>
          <p>Cada aula tem um trabalho real, com o método do artigo rodando num laboratório e os números publicados ao lado para comparar. Dois deles são TCCs defendidos aqui na UTFPR Medianeira.</p>
        </div>
        <div className="tbl-wrap">
          <table className="tbl casos-tbl">
            <thead>
              <tr>
                <th>aula</th>
                <th>trabalho</th>
                <th>o que dá para reproduzir</th>
              </tr>
            </thead>
            <tbody>
              {CASOS.map((c) => (
                <tr key={c.t}>
                  <td>
                    <a href={`#${c.a}`}>Aula {c.a.slice(-1)}</a>
                  </td>
                  <td>
                    <b>{c.t}</b>
                    <br />
                    <span className="note">{c.ref}</span>
                  </td>
                  <td>{c.o}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="wrap track" id="leituras-da-casa">
        <div className="track-head">
          <div>
            <div className="eyebrow">Repositório Institucional da UTFPR (RIUT) e revista do câmpus</div>
            <h2>Leituras da casa</h2>
          </div>
          <p>
            Trabalhos da UTFPR que continuam os casos das aulas. Servem de tema para desafio, seminário ou ideia de TCC. Vale procurar mais no RIUT filtrando por câmpus Medianeira e pelos cursos de
            Ciência da Computação e PPGTCA.
          </p>
        </div>
        <div className="tbl-wrap">
          <table className="tbl casos-tbl">
            <thead>
              <tr>
                <th>aula</th>
                <th>trabalho</th>
                <th>por que ler</th>
              </tr>
            </thead>
            <tbody>
              {LEITURAS.map((c) => (
                <tr key={c.t}>
                  <td>
                    <a href={`#${c.a}`}>Aula {c.a.slice(-1)}</a>
                  </td>
                  <td>
                    <a href={c.url} target="_blank" rel="noreferrer">
                      <b>{c.t}</b>
                    </a>
                    <br />
                    <span className="note">{c.ref}</span>
                  </td>
                  <td>{c.o}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note" style={{ marginTop: 12 }}>
          Busca geral no repositório: <a href="https://repositorio.utfpr.edu.br/jspui/" target="_blank" rel="noreferrer">repositorio.utfpr.edu.br</a>. Revista do câmpus:{' '}
          <a href="https://periodicos.utfpr.edu.br/rcaa" target="_blank" rel="noreferrer">
            Revista de Computação Aplicada ao Agronegócio
          </a>
          .
        </p>
      </section>

      <section className="wrap track" id="bibliografia">
        <div className="track-head">
          <h2>Bibliografia</h2>
          <p>A mesma do plano de ensino da disciplina OP63I, com os artigos do agro citados em cada aula.</p>
        </div>
        <ul className="biblio">
          <li>GONZALEZ, R. C.; WOODS, R. E. Processamento digital de imagens. 3. ed. São Paulo: Pearson, 2010.</li>
          <li>PEDRINI, H.; SCHWARTZ, W. R. Análise de imagens digitais: princípios, algoritmos e aplicações. São Paulo: Thomson, 2008.</li>
          <li>FACELI, K.; LORENA, A. C.; GAMA, J.; CARVALHO, A. C. P. L. F. Inteligência artificial: uma abordagem de aprendizagem de máquina. Rio de Janeiro: LTC, 2011.</li>
          <li>SOLOMON, C.; BRECKON, T. Fundamentos de processamento digital de imagens: uma abordagem prática com exemplos em Matlab. Rio de Janeiro: LTC, 2013.</li>
          <li>HAYKIN, S. Redes neurais: princípios e prática. 2. ed. Porto Alegre: Bookman, 2001.</li>
          <li>BISHOP, C. M. Neural networks for pattern recognition. New York: Oxford University Press, 2002.</li>
          <li>MITCHELL, T. M. Machine learning. Boston: McGraw-Hill, 1997.</li>
          <li>AZEVEDO, E.; CONCI, A. Computação gráfica: geração de imagens. Rio de Janeiro: Campus, 2003.</li>
        </ul>
      </section>
      <footer className="wrap foot">
        Material didático de Tassiane Anzolin · PPGTCA/UTFPR Medianeira. Todas as imagens de exemplo são sintéticas, geradas por código dentro do próprio site, para que cada aluno possa sortear um talhão,
        uma folha ou uma bandeja de sementes diferente.
      </footer>
    </main>
  )
}

export default function App() {
  const h = useHash()
  const i = AULAS.findIndex((a) => a.id === h)
  useEffect(() => {
    document.title = i >= 0 ? `Aula ${AULAS[i].n} · Pixel no Campo` : 'Pixel no Campo'
  }, [i])
  return (
    <>
      <div className="top-stripe" />
      <header className="topbar">
        <div className="wrap">
          <a className="brand" href="#inicio">
            <span className="brand-mark" aria-hidden="true">
              {Array.from({ length: 9 }, (_, k) => (
                <i key={k} />
              ))}
            </span>
            Pixel no Campo
          </a>
          <nav className="topnav" aria-label="Aulas">
            {AULAS.map((a, k) => (
              <span key={a.id} style={{ display: 'contents' }}>
                {k === 3 && <span className="sep" aria-hidden="true" />}
                <a href={`#${a.id}`} aria-current={a.id === h ? 'page' : undefined} title={a.titulo}>
                  Aula {a.n}
                </a>
              </span>
            ))}
          </nav>
        </div>
      </header>
      {i >= 0 ? <LessonPage key={AULAS[i].id} aula={AULAS[i]} prev={AULAS[i - 1]} next={AULAS[i + 1]} /> : <Home />}
    </>
  )
}
