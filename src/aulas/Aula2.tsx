import type { Aula } from '../curso'
import { Fig } from '../curso'
import { Callout, Caso, Code } from '../ui'
import { LabConv, LabMetricas, LabPerceptron } from '../labs'

export const aula2: Aula = {
  id: 'aula2',
  n: 2,
  titulo: 'Redes neurais, treinamento e avaliação de detectores',
  ideia:
    'Esta aula apresenta os fundamentos das redes neurais convolucionais, o procedimento de treinamento de um detector e os critérios para avaliá-lo, com ênfase na distinção entre desempenho no domínio de treinamento e desempenho sob mudança de distribuição.',
  chips: ['perceptron', 'perceptron multicamadas', 'retropropagação', 'descida do gradiente', 'convolução', 'transferência de aprendizado', 'funções de perda', 'aumento de dados', 'métricas de detecção', 'erro de contagem', 'seleção de hiperparâmetros', 'mudança de distribuição', 'rastreamento', 'reprodutibilidade'],
  objetivos: [
    'Aplicar a regra de atualização do perceptron e explicar, geometricamente, a limitação de modelos lineares e o papel das camadas ocultas com ativação não linear.',
    'Descrever a descida do gradiente e a retropropagação, e analisar o efeito da taxa de aprendizado.',
    'Calcular uma convolução, relacionar filtros aprendidos a filtros clássicos de processamento de imagens e fundamentar a transferência de aprendizado.',
    'Configurar e executar o treinamento de um detector, interpretando funções de perda, pré-processamento, aumento de dados, agenda da taxa de aprendizado e parada antecipada.',
    'Calcular e interpretar precisão, revocação, F1, AP, mAP50, mAP50-95 e erro de contagem, e selecionar hiperparâmetros exclusivamente no conjunto de validação.',
    'Avaliar o modelo sob mudança de distribuição, estimar contagens em vídeo com rastreamento e documentar o experimento de forma reprodutível.',
  ],
  intervaloDepois: 'b23',
  notebook: {
    nome: 'Aula2_Treino_Avaliacao_Dominio.ipynb',
    arquivo: 'Aula2_Treino_Avaliacao_Dominio.ipynb',
    descricao: 'Treinamento de um detector no WGISD com partição por variedade, análise das curvas, métricas, erro de contagem, avaliação em variedade não vista, teste de robustez, rastreamento e exportação.',
  },
  blocos: [
    /* ============================================================ 2.1 */
    {
      id: 'b21',
      cod: '2.1',
      titulo: 'Preparação do ambiente computacional',
      min: 15,
      tipo: 'lab',
      slides: [
        { titulo: 'Verificação do ambiente', pontos: ['Ambiente de execução com GPU', 'Registro das versões de Python, PyTorch, CUDA e Ultralytics', 'Obtenção do WGISD e geração do arquivo de configuração', 'Conferência dos caminhos e das classes'] },
        { titulo: 'Justificativa do uso de GPU', pontos: ['A convolução repete a mesma operação em todas as posições da imagem', 'GPUs executam essas operações em paralelo', 'O custo por imagem é expresso em GFLOPs e depende do modelo e da resolução'] },
        { titulo: 'Requisitos de reprodutibilidade', pontos: ['Versões de software', 'Semente aleatória e modo determinístico', 'Partição registrada em arquivo', 'Parâmetros de treinamento (args.yaml)'] },
      ],
      teoria: (
        <>
          <p>
            O treinamento de redes convolucionais é dominado por operações de multiplicação e acumulação repetidas em todas as posições da imagem, o que favorece o uso de processadores gráficos. O
            custo computacional por imagem é usualmente expresso em operações de ponto flutuante (GFLOPs) e cresce com o número de parâmetros e com a resolução de entrada.
          </p>
          <p>
            Valores padrão de parâmetros, como transformações de aumento de dados e otimizador, podem variar entre versões das bibliotecas. Por isso, as versões de software, a semente aleatória, a
            partição dos dados e os parâmetros efetivamente utilizados devem ser registrados, condição necessária para a reprodução dos resultados (KAPOOR; NARAYANAN, 2023).
          </p>
        </>
      ),
      exemplo: <Code code={`!nvidia-smi --query-gpu=name,memory.total --format=csv
!pip -q install ultralytics
import ultralytics, torch, sys
print(sys.version.split()[0], torch.__version__, ultralytics.__version__)
print("GPU:", torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else "")`} />,
      pratica: <p>Executar as células 1 e 2 do notebook, que obtêm o WGISD, aplicam a partição por variedade definida na Aula 1 e escrevem o arquivo <code>data.yaml</code>. Verificar no resultado: três variedades no treino, uma na validação e uma no teste.</p>,
      exercicios: [
        { nivel: 'básico', q: 'O mesmo notebook, executado em dias diferentes, produziu mAP distintos sem alteração de código. Indicar três causas possíveis.', r: <p>Atualização de versão da biblioteca com padrões diferentes; semente não fixada, alterando a ordem das amostras e o aumento de dados; partição refeita aleatoriamente. Operações não determinísticas em GPU também podem contribuir.</p> },
      ],
    },
    /* ============================================================ 2.2 */
    {
      id: 'b22',
      cod: '2.2',
      titulo: 'Do perceptron às redes convolucionais',
      min: 50,
      tipo: 'conceito',
      slides: [
        { titulo: 'Perceptron', img: 'perceptron_and_or_xor', formula: <>ŷ = H(w·x + b) · w ← w + η (y − ŷ) x</>, pontos: ['Fronteira de decisão linear (ROSENBLATT, 1958)', 'AND e OR são linearmente separáveis; XOR não é (MINSKY; PAPERT, 1969)'] },
        { titulo: 'Exemplo resolvido: OR, primeira época', formula: <>w = (0, 0), b = 0, η = 0,2</>, pontos: ['(0,0), y=0: ŷ=0, sem atualização', '(0,1), y=1: ŷ=0; w=(0; 0,2), b=0,2', '(1,0), y=1: z=0,2 → ŷ=1', '(1,1), y=1: ŷ=1', 'Ao fim da época, (0,0) é classificado incorretamente; a época seguinte corrige b'] },
        { titulo: 'Perceptron multicamadas', img: 'mlp_xor', pontos: ['Camada oculta com ativação não linear', 'Fronteiras de decisão não lineares', 'Treinado por retropropagação (RUMELHART; HINTON; WILLIAMS, 1986)'] },
        { titulo: 'Funções de ativação', img: 'ativacoes', pontos: ['Sigmoide: saturação e gradientes pequenos', 'ReLU (NAIR; HINTON, 2010)', 'SiLU: z·σ(z) (ELFWING; UCHIBE; DOYA, 2018), empregada na família YOLO'] },
        { titulo: 'Descida do gradiente', img: 'descida_gradiente', formula: <>w ← w − η ∂L/∂w</>, pontos: ['Taxa pequena: convergência lenta', 'Taxa grande: oscilação ou divergência', 'Gradiente estimado em lotes (descida estocástica)'] },
        { titulo: 'Convolução discreta', img: 'conv_passo', pontos: ['Soma ponderada sobre uma vizinhança', 'Na rede, os pesos do núcleo são parâmetros', 'Conectividade local e compartilhamento de pesos (LECUN et al., 1998)'] },
        { titulo: 'Filtros clássicos como caso particular', img: 'filtros_conv', pontos: ['Sobel, Laplaciano e média são núcleos fixos', 'Uma camada convolucional aprende dezenas de núcleos'] },
        { titulo: 'Hierarquia de características', img: 'mapas_caracteristicas', pontos: ['Convolução → ativação → subamostragem', 'Camadas iniciais: bordas e texturas', 'Camadas profundas: padrões de maior abstração'] },
        { titulo: 'Transferência de aprendizado', pontos: ['Inicialização com pesos treinados em conjunto amplo (COCO)', 'Camadas iniciais tendem a ser mais transferíveis (YOSINSKI et al., 2014)', 'A transferibilidade diminui com a distância entre domínios'] },
      ],
      teoria: (
        <>
          <h4>Perceptron</h4>
          <p>
            O perceptron (ROSENBLATT, 1958) calcula <code>z = w·x + b</code> e produz 1 se z &gt; 0 e 0 caso contrário. Os parâmetros são atualizados a cada erro por{' '}
            <code>w ← w + η (y − ŷ) x</code> e <code>b ← b + η (y − ŷ)</code>. A equação <code>w·x + b = 0</code> define um hiperplano; portanto, o perceptron resolve apenas problemas linearmente
            separáveis. Funções como AND e OR satisfazem essa condição; o XOR não, limitação analisada por Minsky e Papert (1969). Para conjuntos linearmente separáveis, o algoritmo converge em
            número finito de atualizações; caso contrário, não converge.
          </p>
          <h4>Perceptron multicamadas e retropropagação</h4>
          <p>
            A inclusão de camadas ocultas com funções de ativação não lineares permite representar fronteiras não lineares. Sem a não linearidade, a composição de camadas permanece uma
            transformação linear. O treinamento minimiza uma função de perda L por descida do gradiente, <code>w ← w − η ∂L/∂w</code>, e as derivadas em relação a todos os parâmetros são obtidas
            eficientemente pela retropropagação, aplicação sistemática da regra da cadeia (RUMELHART; HINTON; WILLIAMS, 1986). Na prática, o gradiente é estimado sobre lotes de amostras e combinado
            com momento ou com otimizadores adaptativos (GOODFELLOW; BENGIO; COURVILLE, 2016). A taxa de aprendizado η é, em geral, o hiperparâmetro mais sensível.
          </p>
          <h4>Redes convolucionais</h4>
          <p>
            Uma camada totalmente conectada sobre uma imagem de 640 × 640 × 3 teria 1,2 milhão de entradas por neurônio. As redes convolucionais exploram a estrutura espacial da imagem por meio de{' '}
            <b>conectividade local</b> e <b>compartilhamento de pesos</b>: um núcleo de pequena dimensão é aplicado em todas as posições (LECUN et al., 1998). Os filtros de Sobel, Laplaciano e média,
            usados no processamento clássico, são casos particulares de núcleos fixos; em uma rede, os valores do núcleo são aprendidos.
          </p>
          <p>
            A dimensão espacial da saída é <code>⌊(N − K + 2P) / S⌋ + 1</code>, em que N é a dimensão da entrada, K a do núcleo, P o preenchimento e S o passo. Uma camada com 64 núcleos 3 × 3 sobre
            entrada de 3 canais possui 64 × (3 × 3 × 3 + 1) = 1.792 parâmetros. A composição de blocos de convolução, ativação e subamostragem produz mapas de menor resolução e maior número de
            canais, associados a padrões progressivamente mais abstratos.
          </p>
          <h4>Transferência de aprendizado</h4>
          <p>
            Em vez de inicialização aleatória, os parâmetros podem ser inicializados com pesos treinados em um conjunto amplo, como o COCO (LIN et al., 2014). Yosinski et al. (2014) mostram que as
            características das primeiras camadas tendem a ser gerais e as das últimas, específicas da tarefa, e que a transferibilidade diminui com a distância entre a tarefa de origem e a de
            destino. Em conjuntos pequenos, o congelamento das primeiras camadas reduz o número de parâmetros ajustados; o efeito dessa escolha deve ser verificado no conjunto de validação.
          </p>
        </>
      ),
      exemplo: (
        <>
          <Fig n="perceptron_and_or_xor" cap="Figura 1. Perceptron treinado (η = 0,2) nas funções AND, OR e XOR. No XOR, o algoritmo não converge após 30 épocas." />
          <Fig n="mlp_xor" cap="Figura 2. Perceptron multicamadas 2-4-1 treinado por retropropagação (implementação em NumPy) e evolução do erro." />
          <Fig n="ativacoes" cap="Figura 3. Funções de ativação degrau, sigmoide, ReLU e SiLU." />
          <Fig n="descida_gradiente" cap="Figura 4. Trinta iterações da descida do gradiente em uma função quadrática de dois parâmetros, com três taxas de aprendizado." />
          <Fig n="conv_passo" cap="Figura 5. Convolução com o núcleo de Sobel sobre um bloco de 6 × 6 pixels de uma imagem do WGISD." />
          <Fig n="filtros_conv" cap="Figura 6. Núcleos clássicos aplicados a uma imagem do CWFID." />
          <Fig n="mapas_caracteristicas" cap="Figura 7. Mapas de características obtidos com filtros fixos (Gabor e Laplaciano), ativação ReLU e subamostragem. Ilustração; em uma rede treinada, os filtros são aprendidos." />
          <Caso
            tipo="artigo em periódico"
            titulo="Weed detection in soybean crops using ConvNets"
            autores="Ferreira, Freitas, da Silva, Pistori e Folhes"
            onde="Computers and Electronics in Agriculture, v. 143, p. 314-324, 2017"
            link="https://doi.org/10.1016/j.compag.2017.10.027"
            resumo={<p>Imagens de VANT de lavouras de soja são segmentadas em superpixels e classificadas em solo, soja, gramínea e folha larga. Uma rede convolucional é comparada a SVM, AdaBoost e Random Forest alimentados com descritores de forma, cor e textura, o que permite contrastar características aprendidas e definidas manualmente.</p>}
            pipeline={['Imagens de VANT em lavouras de soja', 'Segmentação em superpixels', 'Rotulação de segmentos em quatro classes', 'Rede convolucional comparada a classificadores com descritores']}
            numeros={[{ v: '15.336', l: 'segmentos rotulados' }, { v: '4', l: 'classes' }, { v: '> 98%', l: 'acurácia reportada para a rede convolucional' }]}
            discutir={['A tarefa formulada é de classificação, detecção ou segmentação?', 'Segmentos de uma mesma imagem foram alocados em conjuntos distintos? Qual o efeito sobre a estimativa?']}
          />
        </>
      ),
      pratica: (
        <>
          <LabPerceptron />
          <LabConv />
          <p><b>Exercício no quadro (10 min).</b> Com pesos iniciais nulos, η = 0,2 e a função OR, executar manualmente as duas primeiras épocas e comparar com o laboratório.</p>
          <Code title="Python · perceptron multicamadas para o XOR" code={`import numpy as np
X = np.array([[0,0],[0,1],[1,0],[1,1]], float); y = np.array([[0],[1],[1],[0]], float)
rng = np.random.default_rng(1)
W1, b1 = rng.normal(size=(2, 4)), np.zeros(4)
W2, b2 = rng.normal(size=(4, 1)), np.zeros(1)
sig = lambda z: 1 / (1 + np.exp(-z))
for it in range(4000):
    h = np.tanh(X @ W1 + b1); o = sig(h @ W2 + b2)          # propagação direta
    d_o = (o - y) * o * (1 - o)                              # retropropagação
    d_h = d_o @ W2.T * (1 - h**2)
    W2 -= h.T @ d_o; b2 -= d_o.sum(0); W1 -= X.T @ d_h; b1 -= d_h.sum(0)
print(o.round(2).ravel())`} />
        </>
      ),
      exercicios: [
        { nivel: 'básico', q: 'Mostrar que a composição de duas camadas lineares sem ativação equivale a uma única camada linear.', r: <p>W₂(W₁x + b₁) + b₂ = (W₂W₁)x + (W₂b₁ + b₂), que é uma transformação afim; a fronteira de decisão continua linear.</p> },
        { nivel: 'básico', q: 'Calcular a dimensão de saída para entrada 640 × 640, núcleo 3 × 3, preenchimento 1 e passo 2.', r: <p>⌊(640 − 3 + 2) / 2⌋ + 1 = 319 + 1 = 320.</p> },
        { nivel: 'médio', q: 'Comparar o número de parâmetros de uma camada convolucional com 32 núcleos 3 × 3 sobre 16 canais e de uma camada densa que liga 80 × 80 × 16 entradas a 32 neurônios.', r: <p>Convolucional: 32 × (3 × 3 × 16 + 1) = 4.640. Densa: 80 × 80 × 16 × 32 + 32 = 3.276.832, cerca de 700 vezes mais.</p> },
        { nivel: 'médio', q: 'Calcular a resposta do núcleo de Sobel horizontal [−1 0 1; −2 0 2; −1 0 1] sobre a vizinhança [10 10 50; 10 10 50; 10 10 50].', r: <p>(−10 + 50) + (−20 + 100) + (−10 + 50) = 160, indicando borda vertical com transição de intensidade baixa para alta.</p> },
        { nivel: 'desafio', q: 'Com 150 imagens anotadas, discutir quais camadas congelar e como verificar a decisão.', r: <p>Segundo Yosinski et al. (2014), as primeiras camadas são mais gerais; congelá-las reduz o número de parâmetros ajustados e o risco de sobreajuste. A decisão deve ser verificada comparando, no conjunto de validação, o treinamento com e sem congelamento, preferencialmente com mais de uma semente.</p> },
      ],
    },
    /* ============================================================ 2.3 */
    {
      id: 'b23',
      cod: '2.3',
      titulo: 'Treinamento de um detector',
      min: 45,
      tipo: 'conceito',
      slides: [
        { titulo: 'Funções de perda', formula: <>L = λ<sub>box</sub>·L<sub>box</sub> + λ<sub>cls</sub>·L<sub>cls</sub> + λ<sub>dfl</sub>·L<sub>dfl</sub></>, pontos: ['L_box: baseada em CIoU (ZHENG et al., 2020)', 'L_cls: entropia cruzada binária', 'L_dfl: distribution focal loss (LI et al., 2020)', 'Pesos definidos nos parâmetros de treino da versão utilizada'] },
        { titulo: 'Redimensionamento com preservação de proporção', img: 'letterbox', pontos: ['Redução até o lado maior igualar imgsz', 'Preenchimento da área restante', 'Reescala correspondente das caixas'] },
        { titulo: 'Aumento de dados', img: 'augmentation_real', pontos: ['Transformações geométricas alteram as caixas', 'Transformações fotométricas preservam as caixas', 'Mosaico de quatro imagens (BOCHKOVSKIY; WANG; LIAO, 2020)', 'Aplicado somente ao treino (SHORTEN; KHOSHGOFTAAR, 2019)'] },
        { titulo: 'Agenda da taxa de aprendizado', img: 'lr_schedule', pontos: ['Aquecimento inicial', 'Decaimento linear ou cossenoidal (LOSHCHILOV; HUTTER, 2017)', 'Valores finais definidos por lr0 e lrf'] },
        { titulo: 'Objetos pequenos', img: 'sahi_fatias', pontos: ['Aumento da resolução de entrada', 'Inferência por fatias com sobreposição (AKYON; ALTINUC; TEMIZEL, 2022)', 'Custo de memória proporcional à área'] },
        { titulo: 'Hiperparâmetros principais', pontos: ['Escala do modelo', 'Resolução de entrada (imgsz)', 'Épocas e paciência', 'Tamanho do lote', 'Taxa de aprendizado e otimizador', 'Intensidade do aumento de dados'] },
        { titulo: 'Artefatos do treinamento', pontos: ['best.pt e last.pt', 'results.csv: perdas e métricas por época', 'args.yaml: parâmetros efetivos', 'Gráficos de curvas e lotes de treino'] },
      ],
      teoria: (
        <>
          <h4>Funções de perda</h4>
          <p>Na implementação utilizada (JOCHER; QIU; CHAURASIA, 2023), a perda de detecção combina três termos ponderados:</p>
          <ol>
            <li>
              <b>Perda de localização</b>, baseada no Complete IoU (CIoU), que acrescenta ao IoU termos proporcionais à distância normalizada entre os centros e à diferença de razão de aspecto
              (ZHENG et al., 2020). Esses termos fornecem gradiente mesmo quando as caixas não se sobrepõem.
            </li>
            <li><b>Perda de classificação</b>, entropia cruzada binária por classe.</li>
            <li><b>Distribution focal loss</b>, que modela cada borda como uma distribuição discreta sobre posições possíveis (LI et al., 2020).</li>
          </ol>
          <p>
            A atribuição de alvos determina quais posições da grade são responsáveis por cada objeto e combina qualidade de classificação e IoU. A composição e a ponderação desses termos variam entre
            versões; os valores efetivos devem ser consultados no arquivo <code>args.yaml</code> do treinamento.
          </p>
          <h4>Pré-processamento e aumento de dados</h4>
          <p>
            As imagens são redimensionadas preservando a proporção até que o lado maior iguale <code>imgsz</code>, com preenchimento da área restante. O aumento de dados é aplicado aleatoriamente a
            cada época e somente ao conjunto de treino (SHORTEN; KHOSHGOFTAAR, 2019). Inclui transformações geométricas (espelhamento, escala, translação), que exigem a transformação correspondente das
            caixas, e fotométricas (variações em HSV), que não as alteram. O mosaico, que combina quatro imagens em uma, foi popularizado pelo YOLOv4 (BOCHKOVSKIY; WANG; LIAO, 2020) e costuma ser
            desativado nas últimas épocas. A adequação de cada transformação depende do domínio: o espelhamento vertical, por exemplo, é plausível em imagens aéreas ortogonais, mas não em imagens
            laterais de dossel.
          </p>
          <h4>Otimização</h4>
          <p>
            A taxa de aprendizado é aumentada gradualmente nas primeiras épocas (aquecimento) e, em seguida, reduzida de forma linear ou cossenoidal (LOSHCHILOV; HUTTER, 2017). A parada antecipada
            interrompe o treinamento após um número de épocas sem melhora da métrica de validação (<code>patience</code>), e o melhor estado é armazenado em <code>best.pt</code>.
          </p>
          <h4>Resolução e objetos pequenos</h4>
          <p>
            A redução de imagens de alta resolução para a dimensão de entrada diminui o número de pixels por objeto (Aula 1, bloco 1.3). As alternativas são aumentar <code>imgsz</code>, com custo de
            memória aproximadamente proporcional à área, ou realizar a inferência sobre fatias sobrepostas e combinar as previsões, como no SAHI (AKYON; ALTINUC; TEMIZEL, 2022).
          </p>
        </>
      ),
      exemplo: (
        <>
          <Fig n="letterbox" cap="Figura 8. Redimensionamento com deformação e com preservação da proporção, e as caixas correspondentes." />
          <Fig n="augmentation_real" cap="Figura 9. Transformações de aumento de dados aplicadas a imagens do WGISD, com recálculo das caixas." />
          <Fig n="lr_schedule" cap="Figura 10. Agendas linear e cossenoidal da taxa de aprendizado com aquecimento de três épocas." />
          <Fig n="sahi_fatias" cap="Figura 11. Imagem do WGISD reduzida a 640 pixels e particionada em fatias de 640 pixels com 20% de sobreposição." />
        </>
      ),
      pratica: (
        <>
          <p>Iniciar o treinamento antes do intervalo (célula 3 do notebook).</p>
          <Code code={`from ultralytics import YOLO
modelo = YOLO("yolo11n.pt")          # verificar os pesos disponíveis na versão instalada
modelo.train(
    data="wgisd_yolo/data.yaml",
    epochs=40, imgsz=640, batch=16,
    patience=15, close_mosaic=10,
    seed=42, deterministic=True,
    project="runs", name="uva_n",
)`} />
          <Code title="Python · inspeção de um lote de treino" code={`from PIL import Image
Image.open("runs/uva_n/train_batch0.jpg")`} />
          <Callout kind="prof"><p>O tempo de treinamento depende da GPU disponível no Colab e da versão do software. Recomenda-se manter, no repositório da disciplina, pesos previamente treinados para o caso de interrupção da sessão.</p></Callout>
        </>
      ),
      exercicios: [
        { nivel: 'básico', q: 'Discutir a adequação do espelhamento vertical em imagens laterais de dossel e em imagens aéreas ortogonais.', r: <p>Em imagens laterais, a orientação vertical é informativa (frutos pendentes, céu acima), e o espelhamento vertical gera cenas implausíveis. Em imagens ortogonais não há orientação preferencial, e espelhamentos e rotações são transformações plausíveis.</p> },
        { nivel: 'médio', q: 'Uma imagem de 2048 × 1365 é redimensionada com preservação de proporção para 640. Calcular o fator de escala, a área útil e o preenchimento.', r: <p>Fator 0,3125; área útil 640 × 427; 213 linhas de preenchimento, cerca de 106 acima e 107 abaixo.</p> },
        { nivel: 'médio', q: 'Com imgsz 640 e lote 16, o treinamento ocupa 6 GB de memória. Estimar o efeito de imgsz 1280 com o mesmo lote.', r: <p>A memória de ativações cresce aproximadamente com a área (fator 4), resultando em cerca de 24 GB, acima da capacidade de uma GPU de 16 GB. Seria necessário reduzir o lote ou fatiar as imagens.</p> },
        { nivel: 'desafio', q: 'Explicar por que a perda de localização não utiliza apenas o IoU.', r: <p>Quando as caixas não se sobrepõem, o IoU é nulo e seu gradiente também, o que impede a otimização. O CIoU inclui a distância entre centros e a diferença de razão de aspecto, fornecendo gradiente nessas situações (ZHENG et al., 2020).</p> },
      ],
    },
    /* ============================================================ 2.4 */
    {
      id: 'b24',
      cod: '2.4',
      titulo: 'Curvas de aprendizado, métricas e seleção de hiperparâmetros',
      min: 45,
      tipo: 'conceito',
      slides: [
        { titulo: 'Curvas de aprendizado', img: 'curvas_treino', pontos: ['Perdas elevadas em treino e validação: subajuste', 'Divergência entre as perdas: sobreajuste', 'best.pt corresponde ao máximo da métrica de validação'] },
        { titulo: 'Precisão, revocação e F1', formula: <>P = TP/(TP+FP) · R = TP/(TP+FN) · F1 = 2PR/(P+R)</>, pontos: ['Correspondência por IoU ≥ limiar, uma anotação por previsão', 'Revisão das definições em Padilla, Netto e da Silva (2020)'] },
        { titulo: 'Curva PR e precisão média', img: 'pr_curva_real', pontos: ['Variação do limiar de confiança', 'AP: área sob a curva com precisão interpolada', 'Interpolação em 11 pontos (VOC 2007) ou 101 pontos (COCO)'] },
        { titulo: 'mAP50 e mAP50-95', img: 'map_limiares', pontos: ['mAP50: limiar de IoU 0,5 (EVERINGHAM et al., 2010)', 'mAP50-95: média em dez limiares (LIN et al., 2014)', 'O segundo é mais sensível à qualidade da localização'] },
        { titulo: 'Matriz de confusão em detecção', img: 'matriz_confusao', pontos: ['Diagonal: correspondências corretas por classe', 'Linha de fundo: falsos positivos', 'Coluna de fundo: falsos negativos'] },
        { titulo: 'Erro de contagem', img: 'erro_contagem', formula: <>MAE = média |n̂ − n| · viés = média (n̂ − n)</>, pontos: ['Métrica alinhada a aplicações de estimativa de produção', 'FP e FN podem se compensar: contagem correta não implica detecção correta'] },
        { titulo: 'Seleção de hiperparâmetros', img: 'grid_vs_random', pontos: ['Busca aleatória × grade (BERGSTRA; BENGIO, 2012)', 'Otimização bayesiana (SNOEK; LAROCHELLE; ADAMS, 2012)', 'Decisões tomadas apenas no conjunto de validação'] },
      ],
      teoria: (
        <>
          <h4>Curvas de aprendizado</h4>
          <p>
            O arquivo <code>results.csv</code> registra, por época, as perdas de treino e de validação e as métricas de validação. Perdas elevadas em ambos os conjuntos sugerem subajuste; redução
            da perda de treino acompanhada de aumento da perda de validação sugere sobreajuste. O diagnóstico orienta as intervenções: aumento de capacidade ou de épocas no primeiro caso; mais dados,
            regularização, aumento de dados ou parada antecipada no segundo (GOODFELLOW; BENGIO; COURVILLE, 2016).
          </p>
          <h4>Métricas de detecção</h4>
          <p>
            Para cada imagem, as previsões são ordenadas por confiança e associadas às anotações por IoU ≥ limiar, cada anotação no máximo uma vez. A partir das contagens de TP, FP e FN definem-se
            precisão, revocação e F1. Variando o limiar de confiança, obtém-se a curva precisão-revocação; a precisão média (AP) é a área sob essa curva, calculada com precisão interpolada. O PASCAL
            VOC 2007 utilizou interpolação em 11 pontos e edições posteriores, em todos os pontos (EVERINGHAM et al., 2010); o COCO adota 101 pontos de revocação e calcula a média do AP em dez
            limiares de IoU, de 0,50 a 0,95 (LIN et al., 2014). Padilla, Netto e da Silva (2020) mostram que essas variantes podem produzir valores distintos para o mesmo detector, o que exige
            explicitar o protocolo ao reportar resultados.
          </p>
          <p>
            <b>Exemplo resolvido.</b> Com 100 objetos anotados e 95 previsões, das quais 80 correspondem a anotações: TP = 80, FP = 15, FN = 20; P = 0,842; R = 0,800; F1 = 0,821; contagem prevista
            de 95, erro de −5.
          </p>
          <p>
            Em aplicações de estimativa de produção, a variável de interesse costuma ser a contagem. O erro absoluto médio (MAE) e o viés da contagem por imagem ou por parcela complementam as
            métricas de detecção, pois falsos positivos e falsos negativos podem se compensar.
          </p>
          <h4>Seleção de hiperparâmetros</h4>
          <p>
            Bergstra e Bengio (2012) mostram que, quando poucos hiperparâmetros determinam o desempenho, a busca aleatória explora mais valores desses hiperparâmetros do que a busca em grade com o
            mesmo número de avaliações. A otimização bayesiana constitui alternativa que modela a relação entre hiperparâmetros e desempenho (SNOEK; LAROCHELLE; ADAMS, 2012). Qualquer que seja o
            método, a seleção deve usar exclusivamente o conjunto de validação; a escolha da melhor entre várias configurações com base no teste produz estimativas otimistas (KAPOOR; NARAYANAN, 2023).
            Recomenda-se, quando possível, repetir o experimento com diferentes sementes e reportar média e dispersão.
          </p>
        </>
      ),
      exemplo: (
        <>
          <Fig n="curvas_treino" cap="Figura 12. Curvas de aprendizado ilustrativas, no formato do results.csv. Os valores não provêm de um treinamento real." />
          <Fig n="pr_curva_real" cap="Figura 13. Curva precisão-revocação calculada sobre 221 caixas anotadas do WGISD e previsões simuladas. O procedimento de cálculo do AP é o mesmo do COCO; o detector é simulado." />
          <Fig n="map_limiares" cap="Figura 14. Uma previsão com IoU 0,74 avaliada nos dez limiares do mAP50-95." />
          <Fig n="matriz_confusao" cap="Figura 15. Matriz de confusão de um detector com duas classes e fundo (valores ilustrativos)." />
          <Fig n="erro_contagem" cap="Figura 16. Erro de contagem por imagem em 64 imagens do WGISD, com previsões simuladas." />
          <Fig n="grid_vs_random" cap="Figura 17. Busca em grade e busca aleatória com nove avaliações, segundo o argumento de Bergstra e Bengio (2012)." />
        </>
      ),
      pratica: (
        <>
          <LabMetricas />
          <p>Com o treinamento concluído (célula 4 do notebook):</p>
          <ol>
            <li>Representar graficamente as perdas e o mAP50 por época e identificar se a interrupção ocorreu por paciência ou por limite de épocas.</li>
            <li>Avaliar o modelo no conjunto de validação e registrar P, R, mAP50 e mAP50-95.</li>
            <li>Determinar o limiar de confiança de máximo F1 e o erro de contagem por imagem na validação.</li>
          </ol>
          <Code code={`import pandas as pd
df = pd.read_csv("runs/uva_n/results.csv"); df.columns = df.columns.str.strip()
df.plot(x="epoch", y=["train/box_loss", "val/box_loss"])
df.plot(x="epoch", y=["metrics/mAP50(B)", "metrics/mAP50-95(B)"])

m = YOLO("runs/uva_n/weights/best.pt").val(data="wgisd_yolo/data.yaml", split="val")
print(f"P={m.box.mp:.3f} R={m.box.mr:.3f} mAP50={m.box.map50:.3f} mAP50-95={m.box.map:.3f}")`} />
        </>
      ),
      exercicios: [
        { nivel: 'básico', q: 'Calcular P, R e F1 para TP = 60, FP = 20 e FN = 40.', r: <p>P = 0,75; R = 0,60; F1 = 0,667.</p> },
        { nivel: 'básico', q: 'Um modelo apresenta P = 0,95 e R = 0,60. Qual o sentido esperado do erro de contagem?', r: <p>Subestimação: a baixa revocação indica muitos objetos não detectados, e a alta precisão indica poucos falsos positivos para compensá-los.</p> },
        { nivel: 'médio', q: 'Previsões ordenadas por confiança, com correspondência (1) ou não (0): 1, 1, 0, 1, 0, 1, para 5 objetos. Calcular P e R em cada posição e o AP sem interpolação (soma de P·ΔR).', r: <><p>(P; R): (1; 0,2), (1; 0,4), (0,67; 0,4), (0,75; 0,6), (0,6; 0,6), (0,67; 0,8).</p><p>AP = 0,2 + 0,2 + 0,15 + 0,133 = 0,683. A revocação máxima é 0,8, pois um objeto não é detectado.</p></> },
        { nivel: 'médio', q: 'Interpretar mAP50 = 0,90 com mAP50-95 = 0,45.', r: <p>O modelo localiza a maioria dos objetos, mas com ajuste impreciso das bordas. Para contagem, o resultado pode ser adequado; para estimar dimensões dos objetos, não.</p> },
        { nivel: 'desafio', q: 'Explicar por que selecionar a melhor de 20 configurações pelo desempenho no teste produz estimativa otimista e propor procedimento adequado.', r: <p>O máximo de várias medidas ruidosas é viesado para cima, e o teste passa a participar da seleção. O procedimento adequado seleciona pela validação (ou por validação cruzada em blocos), avalia a configuração escolhida uma única vez no teste e reporta a variabilidade entre sementes.</p> },
      ],
    },
    /* ============================================================ 2.5 */
    {
      id: 'b25',
      cod: '2.5',
      titulo: 'Laboratório 2: mudança de distribuição, rastreamento e reprodutibilidade',
      min: 45,
      tipo: 'lab',
      slides: [
        { titulo: 'Avaliação fora da distribuição de treino', img: 'dominio_variedades', pontos: ['Treino em três variedades; teste em uma variedade não vista', 'A diferença entre validação e teste estima o efeito da mudança de distribuição'] },
        { titulo: 'Caracterização da mudança', img: 'dominio_cor', pontos: ['Distribuição de matiz e brilho no interior das caixas', 'Variedades brancas e tintas ocupam regiões distintas'] },
        { titulo: 'Evidência na literatura', pontos: ['WILDS: desempenho fora da distribuição substancialmente inferior ao intra-distribuição (KOH et al., 2021)', 'Inclui o GlobalWheat, derivado do GWHD (DAVID et al., 2020)'] },
        { titulo: 'Testes de robustez', img: 'iluminacao', pontos: ['Iluminação, balanço de branco, ruído e desfoque', 'Perturbações sintéticas não substituem dados reais de outro domínio'] },
        { titulo: 'Contagem em vídeo', img: 'rastreamento_ids', pontos: ['Um mesmo objeto aparece em vários quadros', 'Rastreamento atribui identificadores persistentes', 'Contagem por identificadores únicos ou por cruzamento de linha'] },
        { titulo: 'ByteTrack', pontos: ['Predição do estado das trilhas por filtro de Kalman', 'Associação por IoU, primeiro com detecções de alta confiança', 'Recuperação de trilhas com detecções de baixa confiança (ZHANG et al., 2022)'] },
        { titulo: 'Exportação e documentação', pontos: ['Formatos: ONNX, TorchScript, TFLite, TensorRT', 'Verificação da equivalência das previsões após a exportação', 'Registro de pesos, parâmetros, versões, semente e partição'] },
      ],
      teoria: (
        <>
          <h4>Mudança de distribuição</h4>
          <p>
            Modelos ajustados a um conjunto de imagens incorporam características específicas das condições de coleta, como iluminação, sensor, fundo e estádio fenológico. Quando a distribuição dos
            dados de uso difere da distribuição de treino, o desempenho tende a diminuir. Koh et al. (2021), no benchmark WILDS, observaram desempenho fora da distribuição substancialmente inferior ao
            desempenho intra-distribuição em todos os conjuntos avaliados, entre eles o GlobalWheat, derivado do GWHD (DAVID et al., 2020). No WGISD, as variedades diferem em cor dos cachos e em
            arquitetura do dossel, o que permite construir um teste fora da distribuição por meio da partição por variedade.
          </p>
          <p>
            A análise recomendada compreende: quantificar a diferença entre validação e teste; examinar e categorizar os erros (iluminação, oclusão, escala, cor, inconsistência de anotação); e, então,
            avaliar intervenções, como inclusão de imagens do novo domínio, aumento de dados dirigido à causa identificada ou ajuste fino com poucas imagens anotadas. Perturbações sintéticas de
            iluminação e nitidez permitem testar a sensibilidade do modelo, mas não substituem a avaliação com dados reais de outro domínio.
          </p>
          <h4>Rastreamento e contagem</h4>
          <p>
            Em vídeo, a soma das detecções por quadro superestima o número de objetos. Rastreadores associam detecções entre quadros e mantêm identificadores persistentes. O ByteTrack prediz a
            posição de cada trilha com filtro de Kalman, associa primeiro as detecções de alta confiança por IoU e utiliza as de baixa confiança para recuperar trilhas não associadas, reduzindo
            perdas por oclusão (ZHANG et al., 2022). Santos et al. (2020) realizaram a contagem de cachos do WGISD em vídeo por associação tridimensional.
          </p>
          <h4>Exportação e reprodutibilidade</h4>
          <p>
            A exportação para formatos como ONNX, TorchScript, TFLite ou TensorRT viabiliza a execução em dispositivos sem o ambiente de treinamento. A equivalência das previsões entre o modelo
            original e o exportado deve ser verificada, especialmente quando há quantização. A documentação do experimento deve incluir pesos, parâmetros, versões de software, semente e partição dos
            dados (KAPOOR; NARAYANAN, 2023).
          </p>
        </>
      ),
      exemplo: (
        <>
          <Fig n="dominio_variedades" cap="Figura 18. Uma imagem de cada variedade do WGISD com as caixas anotadas." />
          <Fig n="dominio_cor" cap="Figura 19. Histogramas de matiz e brilho dos pixels no interior das caixas anotadas, por variedade." />
          <Fig n="iluminacao" cap="Figura 20. Perturbações sintéticas de iluminação, cor, ruído e nitidez aplicadas a uma imagem do WGISD." />
          <Fig n="rastreamento_ids" cap="Figura 21. Simulação de deslocamento da câmera ao longo de uma imagem do WGISD, com identificadores persistentes." />
          <Caso
            tipo="artigo em periódico"
            titulo="Detection and classification of soybean pests using deep learning with UAV images"
            autores="Tetila, Machado, Astolfi, Belete, Amorim, Roel e Pistori"
            onde="Computers and Electronics in Agriculture, v. 179, 105836, 2020"
            link="https://doi.org/10.1016/j.compag.2020.105836"
            resumo={<p>Os autores avaliam cinco arquiteturas profundas na classificação de imagens de pragas da soja obtidas por VANT em condições de campo e comparam o treinamento a partir de pesos pré-treinados com outras abordagens. As arquiteturas com ajuste fino obtiveram as maiores taxas de classificação.</p>}
            pipeline={['Imagens de VANT em lavouras de soja', 'Cinco arquiteturas profundas', 'Ajuste fino a partir de pesos pré-treinados', 'Comparação com outras abordagens']}
            numeros={[{ v: '5', l: 'arquiteturas avaliadas' }, { v: 'até 93,82%', l: 'acurácia reportada' }]}
            discutir={['Em que medida as imagens de teste diferem das de treino quanto a data, local e condições de captura?', 'Que resultado seria esperado em uma safra subsequente?']}
          />
        </>
      ),
      pratica: (
        <>
          <ol>
            <li>Avaliar <code>best.pt</code> no teste (Syrah) e comparar com a validação.</li>
            <li>Selecionar cinco erros (FP ou FN) e classificá-los por causa provável.</li>
            <li>Executar o teste de robustez (seção 5b do notebook) e identificar a perturbação de maior efeito sobre a razão entre caixas previstas e anotadas.</li>
            <li>Executar o rastreamento no vídeo de exemplo e comparar a soma de detecções com o número de identificadores.</li>
            <li>Exportar o modelo para ONNX, verificar a equivalência das previsões e arquivar a pasta do experimento.</li>
          </ol>
          <Code code={`m = YOLO("runs/uva_n/weights/best.pt")
val = m.val(data="wgisd_yolo/data.yaml", split="val", verbose=False)
teste = m.val(data="wgisd_yolo/data.yaml", split="test", verbose=False)
print("diferença de mAP50 (validação − teste):", round(val.box.map50 - teste.box.map50, 3))

ids = set()
for r in m.track("fileira.mp4", tracker="bytetrack.yaml", stream=True, conf=0.3, persist=True):
    if r.boxes.id is not None: ids.update(r.boxes.id.int().tolist())
print("identificadores únicos:", len(ids))

caminho = m.export(format="onnx", imgsz=640)
print(len(YOLO(caminho).predict("CDY_2017.jpg")[0].boxes), "caixas no modelo exportado")`} />
        </>
      ),
      exercicios: [
        { nivel: 'básico', q: 'Em um vídeo, a soma de detecções foi 900 e o rastreador produziu 75 identificadores. Interpretar.', r: <p>Cada objeto foi detectado, em média, em cerca de 12 quadros. A estimativa de contagem é 75, sujeita a erros de fragmentação ou fusão de trilhas.</p> },
        { nivel: 'médio', q: 'mAP50 = 0,88 na validação (Sauvignon Blanc) e 0,61 no teste (Syrah). Formular três hipóteses e um experimento para cada uma.', r: <p>(1) Diferença de cor entre variedades brancas e tintas: incluir variedade tinta no treino e reavaliar. (2) Diferença de iluminação ou sensor: comparar distribuições de brilho e avaliar aumento de dados fotométrico. (3) Diferença de critério de anotação: auditar uma amostra das anotações de Syrah.</p> },
        { nivel: 'médio', q: 'O rastreador reinicia o identificador de um cacho após oclusão de cinco quadros. Que parâmetro investigar?', r: <p>O número de quadros durante os quais uma trilha não associada é mantida (track_buffer). Valores maiores permitem recuperar a trilha após oclusões, com maior risco de associações incorretas.</p> },
        { nivel: 'desafio', q: 'Definir um procedimento para escolher formato de exportação e escala de modelo para execução em dispositivo móvel.', r: <p>Selecionar candidatos (por exemplo, TFLite ou NCNN, escalas n e s, precisão FP16 ou INT8); medir, no conjunto de validação, mAP e erro de contagem de cada variante exportada; medir a latência no próprio dispositivo; escolher a variante que atende à restrição de latência com menor perda de desempenho.</p> },
      ],
    },
    /* ============================================================ 2.6 */
    {
      id: 'b26',
      cod: '2.6',
      titulo: 'Pesquisa aplicada e orientação da atividade avaliativa',
      min: 20,
      tipo: 'leitura',
      slides: [
        { titulo: 'Estudos de referência', pontos: ['Santos et al. (2020): WGISD, detecção, segmentação e rastreamento', 'Barbedo (2019): identificação de doenças por lesões individuais', 'Tetila et al. (2020): pragas da soja em imagens de VANT', 'Dang et al. (2023): comparação de 25 detectores YOLO em plantas daninhas', 'David et al. (2020): GWHD, diversidade de domínios'] },
        { titulo: 'Estrutura do relatório', pontos: ['Problema e pergunta de pesquisa', 'Descrição do conjunto: origem, licença, protocolo de anotação, partição', 'Linha de base', 'Resultados em validação e em teste fora da distribuição', 'Análise de erros e limitações', 'Disponibilidade de código'] },
        { titulo: 'Critérios de avaliação', pontos: ['Dados e anotação: 25%', 'Treinamento e experimentação: 25%', 'Avaliação crítica e domínio externo: 30%', 'Demonstração e defesa: 20%'] },
      ],
      teoria: (
        <p>
          Os estudos apresentados a seguir aplicam, em escala de pesquisa, os procedimentos discutidos nas duas aulas. Recomenda-se analisá-los segundo o roteiro de leitura crítica da Aula 1:
          procedimento de partição, protocolo de avaliação, representatividade do teste, linha de base e disponibilidade de dados e código. O relatório da atividade avaliativa deve seguir estrutura
          de artigo científico, com descrição completa do conjunto e da partição, linha de base, resultados intra e fora da distribuição, análise de erros e limitações.
        </p>
      ),
      exemplo: (
        <>
          <Caso
            tipo="artigo em periódico, Embrapa"
            titulo="Grape detection, segmentation, and tracking using deep neural networks and three-dimensional association"
            autores="Santos, de Souza, dos Santos e Avila"
            onde="Computers and Electronics in Agriculture, v. 170, 105247, 2020"
            link="https://doi.org/10.1016/j.compag.2020.105247"
            resumo={<p>Os autores apresentam o WGISD, obtido na Vinícola Guaspari, em Espírito Santo do Pinhal (SP), comparam detectores de um e dois estágios e propõem a associação tridimensional de detecções entre quadros para a contagem de cachos em vídeo.</p>}
            pipeline={['300 imagens de cinco variedades, com caixas e máscaras', 'Mask R-CNN, YOLOv2 e YOLOv3', 'Partição de treino e teste disponibilizada no repositório', 'Associação tridimensional para contagem em vídeo']}
            numeros={[{ v: '300', l: 'imagens' }, { v: '4.431', l: 'cachos com caixa' }, { v: '2.020', l: 'cachos com máscara' }, { v: '5', l: 'variedades' }]}
            discutir={['A partição original considera a dependência entre imagens de um mesmo vinhedo?', 'Como a associação entre quadros altera a estimativa de contagem?']}
          />
          <Caso
            tipo="artigo em periódico, Embrapa"
            titulo="Plant disease identification from individual lesions and spots using deep learning"
            autores="Barbedo"
            onde="Biosystems Engineering, v. 180, p. 96-107, 2019"
            link="https://doi.org/10.1016/j.biosystemseng.2019.02.002"
            resumo={<p>O estudo utiliza lesões e manchas individuais, em vez da folha inteira, como unidade de classificação, o que aumenta o número de amostras e reduz a influência do fundo. Discute a limitação dos conjuntos disponíveis em representar a variedade de condições práticas.</p>}
            pipeline={['Imagens de folhas com sintomas de diversas doenças', 'Recorte de lesões e manchas individuais', 'Classificação com transferência de aprendizado', 'Comparação com a classificação da folha inteira']}
            numeros={[{ v: 'lesão', l: 'unidade de análise' }, { v: 'Embrapa', l: 'Informática Agropecuária' }]}
            discutir={['Que procedimento evitaria que lesões de uma mesma folha fossem alocadas em conjuntos distintos?', 'Quais etapas adicionais seriam necessárias para aplicação em campo?']}
          />
        </>
      ),
      pratica: <Callout kind="prof"><p>Apresentação dos critérios da atividade avaliativa e definição, por dupla, do problema, do conjunto de dados e do critério de partição.</p></Callout>,
      exercicios: [
        { nivel: 'médio', q: 'Redigir a subseção de partição dos dados do relatório.', r: <p>Exemplo: "As 300 imagens foram particionadas por variedade: Chardonnay, Cabernet Franc e Cabernet Sauvignon no treino (n imagens), Sauvignon Blanc na validação (m) e Syrah no teste (k), de modo que nenhuma sessão de coleta ocorra em mais de um conjunto. A validação foi utilizada para parada antecipada e escolha do limiar de confiança; o teste foi avaliado uma única vez."</p> },
      ],
    },
  ],
  artigos: [
    { tag: 'conjunto de dados', br: true, ref: 'Santos et al. (2020). Grape detection, segmentation, and tracking using deep neural networks and three-dimensional association. Computers and Electronics in Agriculture, 170, 105247.', link: 'https://doi.org/10.1016/j.compag.2020.105247', porque: 'Origem do WGISD e procedimento de contagem em vídeo.', perguntas: ['Como o desempenho dos detectores de um e dois estágios foi comparado?', 'Como a associação tridimensional evita contagens repetidas?'] },
    { tag: 'redes convolucionais na agricultura', br: true, ref: 'Ferreira et al. (2017). Weed detection in soybean crops using ConvNets. Computers and Electronics in Agriculture, 143, 314-324.', link: 'https://doi.org/10.1016/j.compag.2017.10.027', porque: 'Comparação entre rede convolucional e classificadores com descritores definidos manualmente.', perguntas: ['Qual a unidade amostral da partição?', 'Quais descritores foram usados na comparação?'] },
    { tag: 'transferência de aprendizado', br: true, ref: 'Tetila et al. (2020). Detection and classification of soybean pests using deep learning with UAV images. Computers and Electronics in Agriculture, 179, 105836.', link: 'https://doi.org/10.1016/j.compag.2020.105836', porque: 'Avaliação de arquiteturas profundas e do ajuste fino em imagens de campo.', perguntas: ['Como as condições de coleta do teste se relacionam com as do treino?'] },
    { tag: 'dados e unidade de análise', br: true, ref: 'Barbedo (2019). Plant disease identification from individual lesions and spots using deep learning. Biosystems Engineering, 180, 96-107.', link: 'https://doi.org/10.1016/j.biosystemseng.2019.02.002', porque: 'Estratégia para conjuntos pequenos e redução da influência do fundo.' },
    { tag: 'comparação de detectores', ref: 'Dang et al. (2023). YOLOWeeds: A novel benchmark of YOLO object detectors for multi-class weed detection in cotton production systems. Computers and Electronics in Agriculture, 205, 107655.', link: 'https://doi.org/10.1016/j.compag.2023.107655', porque: 'Comparação de 25 detectores com repetições de Monte Carlo; notebook complementar no repositório.', perguntas: ['Qual a relação entre ganho de mAP e custo computacional?', 'Qual a justificativa para as repetições com sementes diferentes?'] },
    { tag: 'mudança de distribuição', ref: 'Koh et al. (2021). WILDS: A benchmark of in-the-wild distribution shifts. ICML, PMLR 139, 5637-5664.', link: 'https://proceedings.mlr.press/v139/koh21a.html', porque: 'Evidência sistemática da queda de desempenho fora da distribuição, incluindo um conjunto agrícola.' },
    { tag: 'diversidade de domínios', ref: 'David et al. (2020). Global Wheat Head Detection (GWHD) dataset. Plant Phenomics.', link: 'https://arxiv.org/abs/2005.02162', porque: 'Conjunto de espigas de trigo de várias regiões e sensores.', perguntas: ['Como as regiões foram distribuídas entre treino e teste?'] },
    { tag: 'métricas', br: true, ref: 'Padilla, Netto e da Silva (2020). A survey on performance metrics for object-detection algorithms. IWSSIP.', link: 'https://doi.org/10.1109/IWSSIP48289.2020.9145130', porque: 'Definições e variantes de cálculo do AP.' },
    { tag: 'hiperparâmetros', ref: 'Bergstra e Bengio (2012). Random search for hyper-parameter optimization. JMLR, 13, 281-305.', link: 'https://jmlr.org/papers/v13/bergstra12a.html', porque: 'Fundamentação da busca aleatória.' },
    { tag: 'rastreamento', ref: 'Zhang et al. (2022). ByteTrack: Multi-Object Tracking by Associating Every Detection Box. ECCV.', link: 'https://arxiv.org/abs/2110.06864', porque: 'Método de rastreamento utilizado na prática.' },
    { tag: 'objetos pequenos', ref: 'Akyon, Altinuc e Temizel (2022). Slicing Aided Hyper Inference and Fine-tuning for Small Object Detection. ICIP.', link: 'https://arxiv.org/abs/2202.06934', porque: 'Inferência por fatias para objetos pequenos.' },
  ],
  quiz: [
    { p: 'Por que o perceptron não resolve o XOR?', o: ['número insuficiente de épocas', 'taxa de aprendizado elevada', 'as classes não são linearmente separáveis', 'pesos iniciais nulos'], a: 2, e: 'A fronteira do perceptron é linear (MINSKY; PAPERT, 1969).' },
    { p: 'Entrada 320 × 320, núcleo 3 × 3, preenchimento 1, passo 2. Dimensão da saída:', o: ['318', '320', '160', '159'], a: 2, e: '⌊(320 − 3 + 2)/2⌋ + 1 = 160.' },
    { p: 'Perda de treino decrescente e perda de validação crescente a partir da época 40 indicam:', o: ['subajuste', 'sobreajuste', 'vazamento', 'GSD elevado'], a: 1, e: 'O modelo passa a ajustar particularidades do treino.' },
    { p: 'Qual transformação exige recalcular as caixas?', o: ['variação em HSV', 'desfoque', 'espelhamento horizontal', 'ruído gaussiano'], a: 2, e: 'Transformações geométricas alteram as coordenadas.' },
    { p: 'TP = 80, FP = 20, FN = 20. F1 =', o: ['0,64', '0,80', '0,90', '0,75'], a: 1, e: 'P = R = 0,8.' },
    { p: 'A diferença entre mAP50 e mAP50-95 reflete principalmente:', o: ['o número de classes', 'a qualidade da localização', 'o tamanho do lote', 'a taxa de aprendizado'], a: 1, e: 'O mAP50-95 exige maior sobreposição.' },
    { p: 'O conjunto adequado para selecionar a taxa de aprendizado é o de:', o: ['treino', 'validação', 'teste', 'qualquer um'], a: 1, e: 'O teste é reservado à estimativa final.' },
    { p: 'Em vídeo, a estimativa de contagem por rastreamento corresponde a:', o: ['soma das detecções', 'número de identificadores únicos', 'média de detecções por quadro', 'máximo de detecções em um quadro'], a: 1, e: 'Cada identificador representa um objeto observado em vários quadros.' },
  ],
  entregas: [
    <><b>Notebook reprodutível</b>, com versões, semente, partição e parâmetros registrados.</>,
    <><b>Resultados</b>: curvas de aprendizado, P, R, mAP50, mAP50-95, matriz de confusão e erro de contagem (MAE e viés), com o protocolo de cálculo explicitado.</>,
    <><b>Linha de base</b>: método clássico ou modelo pré-treinado sem ajuste, avaliado no mesmo conjunto.</>,
    <><b>Avaliação fora da distribuição</b> em outro grupo (variedade, propriedade ou data) e análise de pelo menos cinco erros, com figura e causa provável.</>,
    <><b>Relatório em formato de artigo científico</b> e demonstração de inferência na defesa.</>,
  ],
  limitacoes: [
    <>As curvas de aprendizado, a matriz de confusão e as previsões usadas nas figuras de curva PR e de erro de contagem são ilustrativas ou simuladas. Os resultados reais são os obtidos no notebook.</>,
    <>A partição do WGISD por variedade foi definida para fins didáticos e difere da partição original dos autores; os resultados não são comparáveis aos de Santos et al. (2020).</>,
    <>Apenas uma arquitetura (família YOLO, implementação Ultralytics) é treinada. Conclusões sobre a superioridade de uma família de detectores exigiriam comparação controlada, como em Huang et al. (2017) e Dang et al. (2023).</>,
    <>Com uma única execução por configuração, não é possível estimar a variabilidade entre sementes; a atividade avaliativa deve, quando viável, incluir repetições.</>,
    <>As perturbações de iluminação e nitidez são sintéticas e não representam necessariamente as condições de outro domínio real.</>,
  ],
  referencias: [
    'AKYON, F. C.; ALTINUC, S. O.; TEMIZEL, A. Slicing aided hyper inference and fine-tuning for small object detection. In: IEEE INTERNATIONAL CONFERENCE ON IMAGE PROCESSING (ICIP), 2022. Proceedings [...]. 2022. p. 966-970.',
    'BARBEDO, J. G. A. Plant disease identification from individual lesions and spots using deep learning. Biosystems Engineering, v. 180, p. 96-107, 2019. DOI: 10.1016/j.biosystemseng.2019.02.002.',
    'BERGSTRA, J.; BENGIO, Y. Random search for hyper-parameter optimization. Journal of Machine Learning Research, v. 13, p. 281-305, 2012.',
    'BOCHKOVSKIY, A.; WANG, C.-Y.; LIAO, H.-Y. M. YOLOv4: optimal speed and accuracy of object detection. arXiv, 2004.10934, 2020.',
    'DANG, F.; CHEN, D.; LU, Y.; LI, Z. YOLOWeeds: a novel benchmark of YOLO object detectors for multi-class weed detection in cotton production systems. Computers and Electronics in Agriculture, v. 205, 107655, 2023. DOI: 10.1016/j.compag.2023.107655.',
    'DAVID, E. et al. Global Wheat Head Detection (GWHD) dataset: a large and diverse dataset of high-resolution RGB-labelled images to develop and benchmark wheat head detection methods. Plant Phenomics, v. 2020, 3521852, 2020.',
    'ELFWING, S.; UCHIBE, E.; DOYA, K. Sigmoid-weighted linear units for neural network function approximation in reinforcement learning. Neural Networks, v. 107, p. 3-11, 2018.',
    'EVERINGHAM, M.; VAN GOOL, L.; WILLIAMS, C. K. I.; WINN, J.; ZISSERMAN, A. The Pascal Visual Object Classes (VOC) challenge. International Journal of Computer Vision, v. 88, p. 303-338, 2010.',
    'FERREIRA, A. dos S.; FREITAS, D. M.; SILVA, G. G. da; PISTORI, H.; FOLHES, M. T. Weed detection in soybean crops using ConvNets. Computers and Electronics in Agriculture, v. 143, p. 314-324, 2017. DOI: 10.1016/j.compag.2017.10.027.',
    'GOODFELLOW, I.; BENGIO, Y.; COURVILLE, A. Deep learning. Cambridge: MIT Press, 2016.',
    'HUANG, J. et al. Speed/accuracy trade-offs for modern convolutional object detectors. In: IEEE CONFERENCE ON COMPUTER VISION AND PATTERN RECOGNITION (CVPR), 2017. Proceedings [...]. 2017. p. 7310-7311.',
    'JOCHER, G.; QIU, J.; CHAURASIA, A. Ultralytics YOLO. Versão 8.0.0. 2023. Software. Disponível em: https://github.com/ultralytics/ultralytics.',
    'KAPOOR, S.; NARAYANAN, A. Leakage and the reproducibility crisis in machine-learning-based science. Patterns, v. 4, n. 9, 100804, 2023. DOI: 10.1016/j.patter.2023.100804.',
    'KOH, P. W. et al. WILDS: a benchmark of in-the-wild distribution shifts. In: INTERNATIONAL CONFERENCE ON MACHINE LEARNING (ICML), 38., 2021. Proceedings [...]. PMLR, v. 139, p. 5637-5664, 2021.',
    'LECUN, Y.; BOTTOU, L.; BENGIO, Y.; HAFFNER, P. Gradient-based learning applied to document recognition. Proceedings of the IEEE, v. 86, n. 11, p. 2278-2324, 1998.',
    'LI, X. et al. Generalized focal loss: learning qualified and distributed bounding boxes for dense object detection. Advances in Neural Information Processing Systems, v. 33, p. 21002-21012, 2020.',
    'LIN, T.-Y. et al. Microsoft COCO: common objects in context. In: EUROPEAN CONFERENCE ON COMPUTER VISION (ECCV), 2014. Proceedings [...]. Cham: Springer, 2014. p. 740-755.',
    'LOSHCHILOV, I.; HUTTER, F. SGDR: stochastic gradient descent with warm restarts. In: INTERNATIONAL CONFERENCE ON LEARNING REPRESENTATIONS (ICLR), 2017. Proceedings [...]. 2017.',
    'MINSKY, M.; PAPERT, S. Perceptrons: an introduction to computational geometry. Cambridge: MIT Press, 1969.',
    'NAIR, V.; HINTON, G. E. Rectified linear units improve restricted Boltzmann machines. In: INTERNATIONAL CONFERENCE ON MACHINE LEARNING (ICML), 27., 2010. Proceedings [...]. 2010. p. 807-814.',
    'PADILLA, R.; NETTO, S. L.; DA SILVA, E. A. B. A survey on performance metrics for object-detection algorithms. In: INTERNATIONAL CONFERENCE ON SYSTEMS, SIGNALS AND IMAGE PROCESSING (IWSSIP), 2020. Proceedings [...]. 2020. p. 237-242. DOI: 10.1109/IWSSIP48289.2020.9145130.',
    'ROSENBLATT, F. The perceptron: a probabilistic model for information storage and organization in the brain. Psychological Review, v. 65, n. 6, p. 386-408, 1958.',
    'RUMELHART, D. E.; HINTON, G. E.; WILLIAMS, R. J. Learning representations by back-propagating errors. Nature, v. 323, p. 533-536, 1986.',
    'SANTOS, T. T.; DE SOUZA, L. L.; DOS SANTOS, A. A.; AVILA, S. Grape detection, segmentation, and tracking using deep neural networks and three-dimensional association. Computers and Electronics in Agriculture, v. 170, 105247, 2020. DOI: 10.1016/j.compag.2020.105247.',
    'SHORTEN, C.; KHOSHGOFTAAR, T. M. A survey on image data augmentation for deep learning. Journal of Big Data, v. 6, 60, 2019.',
    'SNOEK, J.; LAROCHELLE, H.; ADAMS, R. P. Practical Bayesian optimization of machine learning algorithms. Advances in Neural Information Processing Systems, v. 25, p. 2951-2959, 2012.',
    'TETILA, E. C. et al. Detection and classification of soybean pests using deep learning with UAV images. Computers and Electronics in Agriculture, v. 179, 105836, 2020. DOI: 10.1016/j.compag.2020.105836.',
    'YOSINSKI, J.; CLUNE, J.; BENGIO, Y.; LIPSON, H. How transferable are features in deep neural networks? Advances in Neural Information Processing Systems, v. 27, p. 3320-3328, 2014.',
    'ZHANG, Y. et al. ByteTrack: multi-object tracking by associating every detection box. In: EUROPEAN CONFERENCE ON COMPUTER VISION (ECCV), 2022. Proceedings [...]. Cham: Springer, 2022. p. 1-21.',
    'ZHENG, Z. et al. Distance-IoU loss: faster and better learning for bounding box regression. In: AAAI CONFERENCE ON ARTIFICIAL INTELLIGENCE, 34., 2020. Proceedings [...]. 2020. p. 12993-13000.',
  ],
}
