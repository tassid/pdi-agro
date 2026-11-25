import type { Aula } from '../curso'
import { Fig } from '../curso'
import { Callout, Caso, Code } from '../ui'
import { LabConv, LabMetricas, LabPerceptron } from '../labs'

export const aula2: Aula = {
  id: 'aula2',
  n: 2,
  titulo: 'Redes neurais, treinamento e avaliação em campo',
  ideia: 'Uma rede é um empilhado de perceptrons com filtros aprendidos. Treinar é fácil; difícil é saber se o número que sai no fim vale para a próxima fazenda.',
  chips: ['perceptron e XOR', 'MLP e retropropagação', 'descida do gradiente', 'convolução e pooling', 'transfer learning', 'perdas do YOLO', 'letterbox e augmentation', 'GSD e SAHI', 'P, R, F1, AP, mAP', 'erro de contagem', 'early stopping', 'grade × aleatória', 'mudança de domínio', 'rastreamento', 'exportação'],
  objetivos: [
    'Aplicar a regra de atualização do perceptron e explicar, com a geometria, por que uma camada não resolve o XOR e uma camada escondida resolve.',
    'Descrever a descida do gradiente e a retropropagação, e o efeito da taxa de aprendizado.',
    'Calcular uma convolução à mão, relacionar filtros aprendidos aos filtros clássicos de PDI e justificar o transfer learning.',
    'Configurar e executar um treino YOLO, lendo as perdas, o letterbox, o augmentation, a agenda da taxa de aprendizado e a parada antecipada.',
    'Diagnosticar underfitting e overfitting pelas curvas e calcular precisão, revocação, F1, AP, mAP50, mAP50-95 e erro de contagem.',
    'Escolher hiperparâmetros só com a validação, comparando busca em grade e aleatória.',
    'Avaliar o modelo num domínio diferente do treino, contar objetos em vídeo com rastreamento e exportar o modelo de forma reprodutível.',
  ],
  intervaloDepois: 'b23',
  notebook: {
    nome: 'Aula2_Treino_Avaliacao_Dominio.ipynb',
    arquivo: 'Aula2_Treino_Avaliacao_Dominio.ipynb',
    descricao: 'Treina um YOLO no WGISD com divisão por variedade, lê as curvas, mede P, R, mAP e erro de contagem, testa numa variedade nunca vista, rastreia e exporta.',
  },
  blocos: [
    /* ============================================================ 2.1 */
    {
      id: 'b21',
      cod: '2.1',
      titulo: 'Preparação do ambiente',
      min: 15,
      tipo: 'lab',
      slides: [
        { titulo: 'Checklist antes de treinar', pontos: ['Ambiente de execução → GPU (T4)', '!nvidia-smi mostra a placa', 'pip install ultralytics e anotar a versão', 'Clonar o WGISD e rodar a célula de preparação', 'Abrir o data.yaml e conferir caminhos e classes'] },
        { titulo: 'Por que GPU', pontos: ['Uma convolução é a mesma conta repetida em milhões de pixels', 'A GPU faz milhares dessas contas em paralelo', 'yolo11n em 640 px: cerca de 6,5 GFLOPs por imagem', 'Na CPU, 40 épocas levam horas; na T4, minutos'] },
        { titulo: 'Reprodutibilidade começa aqui', pontos: ['Versões: Python, PyTorch, CUDA, Ultralytics', 'Semente fixa (seed=42) e deterministic=True', 'Divisão salva em arquivo, não só em memória', 'Tudo isso vai para o relatório'] },
      ],
      teoria: (
        <>
          <p>
            Treino de detector sem GPU leva horas. No Colab, ative a GPU antes de qualquer outra célula, porque trocar o ambiente apaga o que já foi instalado. A GPU acelera porque convolução é a
            mesma conta repetida em cada pixel: milhares de núcleos fazem essas contas em paralelo.
          </p>
          <p>
            Anote as versões do Python, do PyTorch e do Ultralytics: a mesma chamada <code>model.train()</code> pode ter padrões diferentes entre versões (augmentation, otimizador, nomes das perdas).
            Fixe a semente e salve a divisão dos dados em arquivo. Sem isso, ninguém (nem você daqui a três meses) reproduz o número do relatório.
          </p>
        </>
      ),
      exemplo: <Code code={`!nvidia-smi --query-gpu=name,memory.total --format=csv
!pip -q install ultralytics
import ultralytics, torch, sys
print(sys.version.split()[0], torch.__version__, ultralytics.__version__)
print("GPU:", torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else "")`} />,
      pratica: <p>Rodem as células 1 e 2 do notebook. Elas clonam o WGISD, montam a divisão por variedade da Aula 1 e escrevem o <code>data.yaml</code>. Conferir no print: treino com 3 variedades, validação com 1, teste com 1.</p>,
      exercicios: [
        { nivel: 'básico', q: 'O notebook rodou ontem e hoje o mAP mudou 2 pontos sem você mexer em nada. Cite três causas possíveis.', r: <p>Versão nova do Ultralytics ou do PyTorch com padrões diferentes; semente não fixada (ordem das imagens e augmentation aleatórios); divisão dos dados refeita aleatoriamente. Também pode ser não determinismo de operações na GPU.</p> },
      ],
    },
    /* ============================================================ 2.2 */
    {
      id: 'b22',
      cod: '2.2',
      titulo: 'Do perceptron à CNN',
      min: 50,
      tipo: 'conceito',
      slides: [
        { titulo: 'O perceptron de Rosenblatt', img: 'perceptron_and_or_xor', formula: <>ŷ = degrau(w·x + b) · w ← w + η (y − ŷ) x</>, pontos: ['AND e OR: uma reta separa', 'XOR: nenhuma reta separa'] },
        { titulo: 'Conta resolvida: OR, primeira época', formula: <>w = (0, 0), b = 0, η = 0,2</>, pontos: ['(0,0), y=0: z=0 → ŷ=0, sem erro', '(0,1), y=1: ŷ=0, erro 1 → w=(0; 0,2), b=0,2', '(1,0), y=1: z=0,2 → ŷ=1, sem erro', '(1,1), y=1: ŷ=1, sem erro', 'Agora (0,0) dá z=0,2 → ŷ=1: a próxima época corrige b'] },
        { titulo: 'Camada escondida resolve o XOR', img: 'mlp_xor', pontos: ['2 entradas → 4 neurônios tanh → 1 saída sigmoide', 'Fronteira curva, impossível para uma reta', 'Treinado por retropropagação'] },
        { titulo: 'Funções de ativação', img: 'ativacoes', pontos: ['Sigmoide: suave, mas satura e o gradiente some', 'ReLU: barata, não satura no positivo', 'SiLU = z·sigmoide(z): suave, usada no YOLO'] },
        { titulo: 'Descida do gradiente', img: 'descida_gradiente', formula: <>w ← w − η ∂L/∂w</>, pontos: ['η pequeno: lento', 'η grande: oscila ou diverge', 'Retropropagação: regra da cadeia, da saída para a entrada'] },
        { titulo: 'Convolução à mão', img: 'conv_passo', pontos: ['Kernel 3 × 3 desliza sobre a imagem', 'Cada saída = soma dos produtos', 'Na CNN, os 9 números são pesos aprendidos'] },
        { titulo: 'Filtro escolhido × filtro aprendido', img: 'filtros_conv', pontos: ['Sobel, Laplaciano e média: o que vocês escolhiam em PDI', 'Uma camada de CNN tem dezenas desses, aprendidos'] },
        { titulo: 'Conv → ReLU → pooling, muitas vezes', img: 'mapas_caracteristicas', pontos: ['Camadas iniciais: bordas e texturas', 'Camadas finais: partes de objeto', 'Pooling reduz o tamanho e aumenta o campo de visão'] },
        { titulo: 'Por que CNN e não MLP para imagem', pontos: ['MLP em 640 × 640 × 3: 1,2 milhão de entradas por neurônio', 'Conv 3 × 3 × 3 → 1 mapa: 28 pesos, reutilizados em toda a imagem', 'Compartilhamento de pesos: o cacho é cacho em qualquer canto'] },
        { titulo: 'Transfer learning', pontos: ['Pesos do COCO já sabem bordas, texturas, formas', 'Só as camadas finais precisam aprender "cacho de uva"', 'Menos dados, menos épocas, melhor resultado', 'Cuidado: COCO é urbano; o agro é outro domínio'] },
      ],
      teoria: (
        <>
          <h4>Perceptron</h4>
          <p>
            O <b>perceptron</b> (Rosenblatt, 1958) calcula <code>z = w·x + b</code> e responde 1 se z &gt; 0, senão 0. A regra de aprendizado é: quando erra, mexe os pesos na direção do exemplo,{' '}
            <code>w ← w + η (y − ŷ) x</code> e <code>b ← b + η (y − ŷ)</code>. Geometricamente, <code>w·x + b = 0</code> é uma reta no plano: o perceptron separa as classes com uma reta. Por isso
            aprende AND e OR, mas nunca o XOR, cujos pontos (0,1) e (1,0) ficam em diagonais opostas. O teorema de convergência garante que, se existe uma reta, o perceptron a encontra; se não existe,
            ele oscila para sempre.
          </p>
          <h4>MLP e retropropagação</h4>
          <p>
            Empilhando neurônios numa <b>camada escondida</b> e trocando o degrau por uma função suave (sigmoide, tanh, ReLU, SiLU), a rede vira um <b>MLP</b> e desenha fronteiras curvas. Sem a não
            linearidade, empilhar camadas seria inútil: a composição de funções lineares é linear.
          </p>
          <p>
            Para treinar, define-se uma <b>perda</b> L (erro quadrático, entropia cruzada) e aplica-se a <b>descida do gradiente</b>: <code>w ← w − η ∂L/∂w</code>. A <b>retropropagação</b> calcula todas
            essas derivadas de uma vez, aplicando a regra da cadeia da saída para a entrada. A taxa de aprendizado η é o hiperparâmetro mais importante: pequena demais, o treino não sai do lugar;
            grande demais, oscila ou diverge. Na prática usa-se o gradiente de um <b>lote</b> (batch) de imagens por vez e otimizadores como SGD com momento e AdamW.
          </p>
          <h4>Convolução</h4>
          <p>
            Para imagem, ligar cada pixel a cada neurônio é inviável: uma entrada de 640 × 640 × 3 tem 1,2 milhão de valores. A <b>CNN</b> usa <b>convolução</b>: um kernel pequeno (3 × 3 × canais)
            percorre a imagem e calcula, em cada posição, a soma dos produtos. São os mesmos Sobel e Laplaciano da disciplina, só que os números do kernel são <b>pesos aprendidos</b>. Duas
            propriedades tornam isso eficiente: <b>conectividade local</b> (cada saída olha só a vizinhança) e <b>compartilhamento de pesos</b> (o mesmo kernel em toda a imagem, então um cacho é
            reconhecido em qualquer canto).
          </p>
          <p>
            Tamanho da saída: <code>⌊(N − K + 2P) / S⌋ + 1</code>, com N o lado da entrada, K o kernel, P o padding e S o stride. Uma camada com 64 kernels de 3 × 3 sobre 3 canais tem
            64 × (3 × 3 × 3 + 1) = 1.792 pesos. Empilham-se blocos <b>conv → ativação → pooling</b> (ou conv com stride 2): os mapas ficam menores e mais numerosos; as primeiras camadas respondem a
            bordas e cores, as últimas a partes de objeto.
          </p>
          <h4>Transfer learning</h4>
          <p>
            Em vez de começar com pesos aleatórios, começamos com os pesos treinados no COCO (cerca de 118 mil imagens de treino, 80 classes). As camadas iniciais já sabem ver bordas e texturas;
            ajustamos o resto para as nossas classes. É isso que <code>YOLO("yolo11n.pt")</code> faz: a última camada da head é trocada para o nosso número de classes. Com poucos dados, dá para
            congelar o backbone (<code>freeze=10</code>) e treinar só o resto.
          </p>
        </>
      ),
      exemplo: (
        <>
          <Fig n="perceptron_and_or_xor" cap="Perceptron treinado de verdade (η = 0,2) nas três portas. No XOR ele termina 30 épocas ainda errando." />
          <Fig n="mlp_xor" cap="Um MLP 2 → 4 → 1 treinado com retropropagação em NumPy resolve o XOR com uma fronteira curva." />
          <Fig n="ativacoes" cap="As ativações mais usadas. O YOLO usa SiLU nas camadas convolucionais." />
          <Fig n="descida_gradiente" cap="30 passos de descida do gradiente numa perda de dois pesos, com três taxas de aprendizado." />
          <Fig n="conv_passo" cap="Convolução calculada à mão sobre 6 × 6 pixels de um cacho real do WGISD, com o kernel de Sobel." />
          <Fig n="filtros_conv" cap="Quatro kernels clássicos aplicados a uma foto real do CWFID. Uma CNN aprende dezenas desses por camada." />
          <Fig n="mapas_caracteristicas" cap="Duas camadas de conv → ReLU → pooling com filtros fixos sobre uma foto do WGISD, para enxergar o que é um mapa de características." />
          <Callout kind="analogia"><p>O backbone pré-treinado é um agrônomo recém-formado: já sabe o que é folha, sombra e solo. Falta só mostrar como é o cacho desta variedade.</p></Callout>
          <Caso
            tipo="artigo brasileiro"
            titulo="Weed detection in soybean crops using ConvNets"
            autores="dos Santos Ferreira, Freitas, da Silva, Pistori e Folhes"
            onde="Computers and Electronics in Agriculture 143 (2017), 314-324"
            link="https://doi.org/10.1016/j.compag.2017.10.027"
            resumo={<p>Imagens de drone de lavouras de soja segmentadas em superpixels e classificadas em solo, soja, gramínea e folha larga. A ConvNet foi comparada a SVM, AdaBoost e Random Forest alimentados com descritores de forma, cor e textura: exatamente a troca de regra escrita por filtro aprendido deste bloco.</p>}
            pipeline={['Fotos de VANT sobre soja', 'Segmentação em superpixels', '15.336 segmentos rotulados em 4 classes', 'ConvNet contra SVM, AdaBoost e Random Forest com descritores']}
            numeros={[{ v: '15.336', l: 'segmentos rotulados' }, { v: '4', l: 'classes' }, { v: '> 98%', l: 'acurácia da ConvNet' }]}
            discutir={['Classificar superpixels é classificação, detecção ou segmentação?', 'Os segmentos de uma mesma foto foram separados entre treino e teste?']}
          />
        </>
      ),
      pratica: (
        <>
          <LabPerceptron />
          <LabConv />
          <p><b>No quadro (10 min).</b> Pesos iniciais zero, η = 0,2, porta OR. Façam à mão as duas primeiras épocas e confiram no laboratório.</p>
          <Code title="Python · MLP do XOR em 15 linhas" code={`import numpy as np
X = np.array([[0,0],[0,1],[1,0],[1,1]], float); y = np.array([[0],[1],[1],[0]], float)
rng = np.random.default_rng(1)
W1, b1 = rng.normal(size=(2, 4)), np.zeros(4)
W2, b2 = rng.normal(size=(4, 1)), np.zeros(1)
sig = lambda z: 1 / (1 + np.exp(-z))
for it in range(4000):
    h = np.tanh(X @ W1 + b1); o = sig(h @ W2 + b2)          # ida
    d_o = (o - y) * o * (1 - o)                              # volta: regra da cadeia
    d_h = d_o @ W2.T * (1 - h**2)
    W2 -= h.T @ d_o; b2 -= d_o.sum(0); W1 -= X.T @ d_h; b1 -= d_h.sum(0)
print(o.round(2).ravel())                                    # perto de [0, 1, 1, 0]`} />
        </>
      ),
      exercicios: [
        { nivel: 'básico', q: 'Por que empilhar camadas lineares (sem ativação) não resolve o XOR?', r: <p>W₂(W₁x + b₁) + b₂ = (W₂W₁)x + (W₂b₁ + b₂): continua sendo uma função linear, logo uma reta. A não linearidade é que permite dobrar o espaço.</p> },
        { nivel: 'básico', q: 'Entrada 640 × 640, kernel 3 × 3, padding 1, stride 2. Qual o tamanho da saída?', r: <p>⌊(640 − 3 + 2) / 2⌋ + 1 = 319 + 1 = 320. Cada conv com stride 2 divide o lado por 2.</p> },
        { nivel: 'médio', q: 'Quantos pesos tem uma camada com 32 kernels 3 × 3 sobre uma entrada de 16 canais? E uma camada densa ligando 80 × 80 × 16 a 32 neurônios?', r: <p>Conv: 32 × (3 × 3 × 16 + 1) = 4.640. Densa: 80 × 80 × 16 × 32 + 32 = 3.276.832, cerca de 700 vezes mais.</p> },
        { nivel: 'médio', q: 'Calcule a saída do kernel Sobel x [−1 0 1; −2 0 2; −1 0 1] sobre a vizinhança [10 10 50; 10 10 50; 10 10 50].', r: <p>(−10 + 50) + (−20 + 100) + (−10 + 50) = 40 + 80 + 40 = 160: borda vertical forte, do escuro para o claro.</p> },
        { nivel: 'desafio', q: 'Você tem só 150 fotos anotadas. Que partes do modelo pré-treinado vale congelar e por quê?', r: <p>Congelar o backbone (ou suas primeiras camadas) preserva os filtros genéricos do COCO e reduz o número de pesos ajustados, o que diminui o overfitting com poucos dados. Neck e heads continuam treináveis para aprender a escala e a aparência do cacho. Compare na validação treinar com e sem <code>freeze</code>.</p> },
      ],
    },
    /* ============================================================ 2.3 */
    {
      id: 'b23',
      cod: '2.3',
      titulo: 'Treinamento YOLO e execução na GPU',
      min: 45,
      tipo: 'conceito',
      slides: [
        { titulo: 'O que o YOLO minimiza', formula: <>L = λ<sub>box</sub>·L<sub>box</sub> + λ<sub>cls</sub>·L<sub>cls</sub> + λ<sub>dfl</sub>·L<sub>dfl</sub></>, pontos: ['box_loss: 1 − CIoU entre caixa prevista e real', 'cls_loss: entropia cruzada binária por classe', 'dfl_loss: refina a posição de cada borda', 'Pesos padrão: box 7,5 · cls 0,5 · dfl 1,5 (confira na sua versão)'] },
        { titulo: 'Letterbox: a foto entra quadrada', img: 'letterbox', pontos: ['Reduz mantendo a proporção', 'Completa com cinza', 'As caixas são reescaladas junto'] },
        { titulo: 'Augmentation já vem ligado', img: 'augmentation_real', pontos: ['Geométrico: as caixas acompanham', 'Fotométrico: as caixas ficam iguais', 'Mosaic mistura 4 fotos: mais contexto, mais objetos pequenos', 'close_mosaic: desliga o mosaic nas últimas 10 épocas'] },
        { titulo: 'Agenda da taxa de aprendizado', img: 'lr_schedule', pontos: ['Aquecimento nas 3 primeiras épocas', 'Decai até lr0 × lrf', 'Linear ou cosseno'] },
        { titulo: 'Objeto pequeno: imgsz e SAHI', img: 'sahi_fatias', pontos: ['imgsz=640 encolhe uma foto de 2048 px 3,2 vezes', 'Mais imgsz = mais detalhe, mais memória (batch menor)', 'SAHI fatia a foto e junta com NMS'] },
        { titulo: 'Os hiperparâmetros que mais importam', pontos: ['model: n, s, m, l, x (tamanho)', 'imgsz: resolução de entrada', 'epochs e patience', 'batch (limitado pela memória)', 'lr0, optimizer', 'augmentation: mosaic, fliplr, hsv_*, scale'] },
        { titulo: 'O que sai do treino', pontos: ['runs/uva_n/weights/best.pt e last.pt', 'results.csv: perdas e métricas por época', 'args.yaml: todos os parâmetros usados', 'Gráficos: curvas, PR, matriz de confusão, lotes de treino'] },
      ],
      teoria: (
        <>
          <h4>As perdas</h4>
          <p>O Ultralytics reporta três perdas na detecção:</p>
          <ol>
            <li>
              <code>box_loss</code>: 1 − CIoU entre a caixa prevista e a real. O <b>CIoU</b> (complete IoU) é o IoU com dois termos a mais: um que penaliza a distância entre os centros e outro que
              penaliza a diferença de proporção. Assim há gradiente mesmo quando as caixas ainda não se tocam.
            </li>
            <li><code>cls_loss</code>: entropia cruzada binária entre a probabilidade prevista de cada classe e o alvo.</li>
            <li><code>dfl_loss</code> (distribution focal loss): em vez de um número para cada borda, a rede prevê uma distribuição sobre posições possíveis, o que refina a localização.</li>
          </ol>
          <p>
            A perda total é a soma ponderada (<code>box</code>, <code>cls</code>, <code>dfl</code> nos argumentos de treino). Para decidir qual posição da grade deve aprender qual objeto, os YOLOs
            recentes usam uma <b>atribuição de alvos</b> que combina a qualidade da classe e o IoU. Nomes e composição mudam entre versões: leia o cabeçalho do <code>results.csv</code>.
          </p>
          <h4>Pré-processamento e augmentation</h4>
          <p>
            Toda imagem entra na rede quadrada, com lado <code>imgsz</code>, por <b>letterbox</b>: reduz mantendo a proporção e completa com cinza. O <b>augmentation</b> é aplicado a cada época, de
            forma aleatória, só no treino: <code>mosaic</code> (4 fotos em uma), <code>fliplr</code>, variações de HSV, <code>scale</code>, <code>translate</code>, e opcionais como{' '}
            <code>mixup</code> e <code>copy_paste</code>. Transformações geométricas mudam as caixas; fotométricas não. O mosaic é desligado nas últimas épocas (<code>close_mosaic=10</code>) para o
            modelo terminar vendo fotos normais.
          </p>
          <h4>Otimização</h4>
          <p>
            A taxa de aprendizado começa com um <b>aquecimento</b> (warmup) e depois decai até <code>lr0 × lrf</code>, de forma linear ou em cosseno. O otimizador padrão é escolhido automaticamente
            (SGD com momento ou AdamW, conforme o tamanho do treino). <b>Parada antecipada</b>: <code>patience=15</code> encerra o treino depois de 15 épocas sem melhora na métrica de validação (uma
            combinação de mAP50 e mAP50-95) e o melhor peso fica em <code>best.pt</code>.
          </p>
          <h4>Resolução e objetos pequenos</h4>
          <p>
            Fotos de 2048 px reduzidas para 640 perdem detalhe (volte ao GSD da Aula 1). Duas saídas: subir o <code>imgsz</code> (a memória cresce com o quadrado do lado, então o batch diminui) ou
            fatiar a imagem em pedaços com sobreposição, rodar o detector em cada um e juntar com NMS, como faz o <b>SAHI</b> (Akyon et al., 2022). Para treinar no mesmo espírito, fatie as fotos de
            treino em ladrilhos antes de treinar.
          </p>
        </>
      ),
      exemplo: (
        <>
          <Fig n="letterbox" cap="Uma foto do WGISD esticada (deforma o cacho) e em letterbox (mantém a proporção), com as caixas reescaladas." />
          <Fig n="augmentation_real" cap="As transformações do Ultralytics aplicadas a fotos reais do WGISD, com as caixas recalculadas. O mosaic junta quatro variedades." />
          <Fig n="lr_schedule" cap="As duas agendas de taxa de aprendizado do Ultralytics, com aquecimento de 3 épocas." />
          <Fig n="sahi_fatias" cap="Foto de 2048 px do WGISD: inteira reduzida para 640 (esquerda) ou fatiada em pedaços de 640 com sobreposição (direita)." />
        </>
      ),
      pratica: (
        <>
          <p>Disparem o treino <b>antes do intervalo</b> (célula 3 do notebook). Ele roda enquanto vocês tomam café.</p>
          <Code code={`from ultralytics import YOLO
modelo = YOLO("yolo11n.pt")          # confira os pesos disponíveis na sua versão
modelo.train(
    data="wgisd_yolo/data.yaml",
    epochs=40, imgsz=640, batch=16,
    patience=15,                    # parada antecipada
    close_mosaic=10,                # últimas 10 épocas sem mosaic
    seed=42, deterministic=True,
    project="runs", name="uva_n",
)`} />
          <Code title="Python · ver o augmentation que a rede recebe" code={`from PIL import Image
Image.open("runs/uva_n/train_batch0.jpg")   # um lote real do treino, com mosaic e caixas`} />
          <Callout kind="prof"><p>Com a T4 do Colab, 40 épocas no WGISD levam cerca de 10 a 15 minutos com o modelo nano. Abra o <code>train_batch0.jpg</code> durante o intervalo: a turma vê o mosaic em ação.</p></Callout>
        </>
      ),
      exercicios: [
        { nivel: 'básico', q: 'Por que o espelhamento vertical (flipud) vem desligado por padrão e faz sentido ligá-lo em imagens de drone?', r: <p>Em fotos tiradas do chão, o céu está em cima e cacho pendurado não aparece de cabeça para baixo: espelhar na vertical criaria cenas impossíveis. Em imagens aéreas (nadir) não existe "em cima", então flipud e rotações são válidos.</p> },
        { nivel: 'médio', q: 'Uma foto 2048 × 1365 entra em letterbox para 640. Qual o fator de escala, o tamanho da área útil e quantas linhas de cinza entram em cima e embaixo?', r: <p>Escala = 640 / 2048 = 0,3125. Área útil: 640 × 427. Sobram 213 linhas: cerca de 106 em cima e 107 embaixo.</p> },
        { nivel: 'médio', q: 'Com imgsz 640 e batch 16 a memória da GPU está em 6 GB. Estime o que acontece com imgsz 1280 e o mesmo batch.', r: <p>A memória das ativações cresce com a área: cerca de 4 vezes mais, uns 24 GB, o que estoura a T4 (16 GB). Use batch 4 ou 8, ou fatie as imagens.</p> },
        { nivel: 'desafio', q: 'Por que a perda de caixa usa CIoU e não só o IoU?', r: <p>Quando as caixas não se tocam, IoU = 0 para qualquer distância e o gradiente é zero: a rede não sabe para onde mover. O CIoU soma a distância normalizada entre os centros e a diferença de proporção, dando direção mesmo sem sobreposição.</p> },
      ],
    },
    /* ============================================================ 2.4 */
    {
      id: 'b24',
      cod: '2.4',
      titulo: 'Curvas, métricas e hiperparâmetros',
      min: 45,
      tipo: 'conceito',
      slides: [
        { titulo: 'Lendo as curvas', img: 'curvas_treino', pontos: ['As duas perdas altas: underfitting', 'Treino desce e validação sobe: overfitting', 'best.pt fica no pico da validação'] },
        { titulo: 'Precisão, revocação, F1', formula: <>P = TP/(TP+FP) · R = TP/(TP+FN) · F1 = 2PR/(P+R)</>, pontos: ['Precisão: das caixas desenhadas, quantas eram cacho', 'Revocação: dos cachos que existiam, quantos foram achados', 'F1: equilíbrio entre os dois'] },
        { titulo: 'Curva PR e AP', img: 'pr_curva_real', pontos: ['Varre o limiar de confiança', 'AP = área sob a curva PR (interpolada)', 'mAP50: média das classes com IoU 0,5'] },
        { titulo: 'mAP50-95: dez limiares de IoU', img: 'map_limiares', pontos: ['IoU de 0,50 a 0,95, de 0,05 em 0,05', 'Uma caixa com IoU 0,74 acerta em 5 dos 10', 'Premia localização precisa'] },
        { titulo: 'Matriz de confusão do detector', img: 'matriz_confusao', pontos: ['Diagonal: acertos por classe', 'Linha "fundo": falsos positivos', 'Coluna "fundo": objetos que o modelo não viu'] },
        { titulo: 'A métrica do produtor: erro de contagem', img: 'erro_contagem', formula: <>MAE = média |previstos − reais| · viés = média (previstos − reais)</> },
        { titulo: 'Grade ou aleatória?', img: 'grid_vs_random', pontos: ['Mesmo orçamento de treinos', 'Aleatória testa mais valores do que importa', 'Ajuste só com treino e validação; teste é para o fim'] },
      ],
      teoria: (
        <>
          <h4>Curvas</h4>
          <p>
            O <code>results.csv</code> guarda, por época, as perdas de treino e de validação e as métricas na validação. <b>Underfitting</b>: as duas perdas altas e o mAP ainda subindo (mais épocas,
            modelo maior). <b>Overfitting</b>: perda de treino caindo e de validação subindo, mAP caindo (mais dados, mais augmentation, modelo menor, parar antes).
          </p>
          <h4>De caixas a métricas</h4>
          <p>Para cada imagem, as caixas previstas (da maior para a menor confiança) são casadas com as anotadas por IoU ≥ limiar, cada anotação no máximo uma vez. Daí saem:</p>
          <ol>
            <li><b>Precisão</b> P = TP / (TP + FP): das caixas que o modelo desenhou, quantas eram cachos.</li>
            <li><b>Revocação</b> R = TP / (TP + FN): dos cachos que existiam, quantos o modelo achou.</li>
            <li><b>F1</b> = 2PR / (P + R): média harmônica; o pico da curva F1 × confiança sugere o <code>conf</code> de uso.</li>
            <li><b>AP</b>: varrendo o limiar de confiança, traça-se a curva precisão × revocação; o AP é a área sob ela, com a precisão interpolada pelo máximo à direita. O COCO usa 101 pontos de revocação.</li>
            <li><b>mAP50</b>: média do AP das classes com IoU 0,5. <b>mAP50-95</b>: média do AP em dez limiares de IoU, de 0,50 a 0,95. É a métrica principal do COCO.</li>
          </ol>
          <p>
            <b>Exemplo resolvido.</b> 100 cachos no teste; o modelo desenhou 95 caixas, 80 casaram. TP = 80, FP = 15, FN = 20. P = 80/95 = 0,84; R = 80/100 = 0,80; F1 = 2 × 0,84 × 0,80 / 1,64 = 0,82.
            Contagem prevista: 95, erro de −5.
          </p>
          <p>
            Métrica de detecção não é métrica de negócio. Para estimar produção, o que importa é o <b>erro de contagem</b>: MAE (erro absoluto médio por foto ou por fileira) e viés (se conta a mais ou
            a menos). Um modelo com mAP mediano pode contar bem, porque FP e FN se compensam, e o contrário também acontece.
          </p>
          <h4>Hiperparâmetros</h4>
          <p>
            Taxa de aprendizado, imgsz, tamanho do modelo, augmentation. Com orçamento fixo, a <b>busca aleatória</b> costuma vencer a <b>busca em grade</b> (Bergstra e Bengio, 2012), porque explora mais
            valores do hiperparâmetro que realmente importa. O Ultralytics tem <code>model.tune()</code>, que faz uma busca evolutiva. Toda escolha é feita olhando a validação. O teste é aberto uma vez,
            no fim; se o artigo reporta o melhor de 20 configurações no teste, o número está inflado.
          </p>
        </>
      ),
      exemplo: (
        <>
          <Fig n="curvas_treino" cap="Formato típico do results.csv. As curvas são ilustrativas; no notebook vocês plotam as suas." />
          <Fig n="pr_curva_real" cap="Curva PR calculada sobre 221 cachos reais do WGISD contra um detector simulado. Repare como o AP cai ao exigir IoU 0,75." />
          <Fig n="map_limiares" cap="Uma caixa prevista com IoU 0,74 sobre um cacho real: acerto nos cinco primeiros limiares do mAP50-95, erro nos outros cinco." />
          <Fig n="matriz_confusao" cap="Leitura da matriz de confusão de um detector com duas classes e fundo (valores ilustrativos)." />
          <Fig n="erro_contagem" cap="Erro de contagem por foto em 64 fotos reais do WGISD, com um detector simulado. É o gráfico que o produtor entende." />
          <Fig n="grid_vs_random" cap="Nove treinos em grade testam 3 taxas de aprendizado; nove aleatórios testam 9." />
        </>
      ),
      pratica: (
        <>
          <LabMetricas />
          <p>Com o treino pronto (célula 4 do notebook):</p>
          <ol>
            <li>Plotem as perdas e o mAP50 por época. O treino parou por paciência ou por fim de épocas? Há sinal de overfitting?</li>
            <li>Rodem <code>model.val(split="val")</code> e anotem P, R, mAP50 e mAP50-95.</li>
            <li>Achem o <code>conf</code> do pico de F1 e meçam o erro de contagem por foto da validação.</li>
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
        { nivel: 'básico', q: 'TP = 60, FP = 20, FN = 40. Calcule P, R e F1.', r: <p>P = 60/80 = 0,75; R = 60/100 = 0,60; F1 = 2 × 0,75 × 0,60 / 1,35 = 0,67.</p> },
        { nivel: 'básico', q: 'Modelo com P = 0,95 e R = 0,60. Na contagem de cachos, o erro típico é para mais ou para menos?', r: <p>Para menos: revocação baixa significa muitos cachos sem caixa, e precisão alta significa poucas caixas falsas para compensar.</p> },
        { nivel: 'médio', q: 'Detecções ordenadas por confiança, com acerto (1) ou erro (0): 1, 1, 0, 1, 0, 1. Há 5 objetos. Calcule P e R a cada passo e o AP (sem interpolação, somando P × ΔR).', r: <><p>Passo a passo (P; R): (1; 0,2), (1; 0,4), (0,67; 0,4), (0,75; 0,6), (0,6; 0,6), (0,67; 0,8).</p><p>AP = 1 × 0,2 + 1 × 0,2 + 0,75 × 0,2 + 0,67 × 0,2 = 0,68. O objeto nunca achado limita a revocação a 0,8.</p></> },
        { nivel: 'médio', q: 'O mAP50 está em 0,90 e o mAP50-95 em 0,45. O que isso diz sobre o modelo?', r: <p>Ele acha os cachos, mas as caixas não encaixam bem nas bordas. Para contagem isso basta; para medir tamanho de cacho, não. Caminhos: mais resolução, anotação mais consistente nas bordas, modelo maior.</p> },
        { nivel: 'desafio', q: 'Você testou 20 configurações e escolheu a de maior mAP no teste. Por que o número reportado está otimista e como corrigir?', r: <p>Escolher pelo teste é ajustar ao teste: o máximo de 20 medidas ruidosas é viesado para cima. Corrija escolhendo pela validação (ou validação cruzada por grupo) e reportando o teste da configuração escolhida uma única vez; melhor ainda, repetir com sementes diferentes e reportar média e desvio.</p> },
      ],
    },
    /* ============================================================ 2.5 */
    {
      id: 'b25',
      cod: '2.5',
      titulo: 'Laboratório 2: mudança de domínio, rastreamento e exportação',
      min: 45,
      tipo: 'lab',
      slides: [
        { titulo: 'O teste que importa: outra fazenda', img: 'dominio_variedades', pontos: ['Cor do cacho, folhagem, luz e câmera mudam', 'Treinamos em 3 variedades e testamos em Syrah', 'A queda de mAP mede o quanto o modelo generaliza'] },
        { titulo: 'A mudança de domínio medida', img: 'dominio_cor', pontos: ['Matiz dos pixels dentro das caixas', 'Brancas e tintas ocupam regiões diferentes', 'Treinar só em brancas e testar em tintas: queda esperada'] },
        { titulo: 'Condições que o treino não viu', img: 'iluminacao', pontos: ['Fim de tarde, contraluz', 'Outra câmera, outro balanço de branco', 'Desfoque, chuva, poeira', 'Teste o modelo em cada uma'] },
        { titulo: 'Contar em vídeo sem contar duas vezes', img: 'rastreamento_ids', pontos: ['Detector vê o mesmo cacho em vários quadros', 'Rastreador (ByteTrack) mantém o id', 'Contagem = ids únicos, não soma de caixas'] },
        { titulo: 'Como o ByteTrack associa', pontos: ['Prevê a nova posição de cada trilha (filtro de Kalman)', 'Casa as detecções de alta confiança por IoU', 'Tenta casar as de baixa confiança com as trilhas que sobraram', 'Trilha sem par por alguns quadros é encerrada'] },
        { titulo: 'Exportar e reproduzir', pontos: ['model.export(format="onnx") para rodar fora do Python', 'TFLite ou NCNN para celular, TensorRT para Jetson', 'Guardar: best.pt, data.yaml, args.yaml, results.csv', 'Anotar versões, semente e divisão'] },
      ],
      teoria: (
        <>
          <h4>Mudança de domínio</h4>
          <p>
            Um modelo treinado e validado numa fazenda aprende também o que é próprio daquela fazenda: a luz da manhã, a câmera, a cor do solo, a variedade. Num <b>domínio diferente</b> o desempenho
            cai, e essa queda é a informação mais honesta do trabalho. Fontes comuns: iluminação (hora, nuvem), sensor (câmera, celular, drone), escala (altura de voo), fundo (solo, palhada) e o
            próprio objeto (variedade, estádio fenológico). No WGISD, cada variedade é um domínio: Syrah tem cachos escuros e Chardonnay, cachos verdes.
          </p>
          <p>
            O que fazer: medir a queda (validação × teste em outro domínio), olhar os erros e classificá-los por causa, e só então agir: incluir imagens do novo domínio no treino, augmentation dirigido
            à causa (variação de HSV para luz, blur para movimento), ou ajuste fino com poucas imagens anotadas do novo domínio.
          </p>
          <h4>Rastreamento e contagem</h4>
          <p>
            Em <b>vídeo</b>, o mesmo cacho aparece em dezenas de quadros. Somar as caixas superestima a contagem. Um rastreador associa as detecções entre quadros e dá um id a cada objeto; a contagem
            passa a ser o número de ids únicos (ou de ids que cruzam uma linha virtual). O <b>ByteTrack</b> (Zhang et al., 2022) prevê a nova posição de cada trilha com um filtro de Kalman, casa primeiro
            as detecções de alta confiança por IoU e depois tenta recuperar as de baixa confiança, o que reduz trilhas perdidas por oclusão. Santos et al. (2020) contaram cachos do WGISD em vídeo com
            uma associação em 3D.
          </p>
          <h4>Exportação e reprodutibilidade</h4>
          <p>
            Exportar o modelo (ONNX, TorchScript, TFLite, NCNN, TensorRT) permite rodar no celular, no computador de bordo do trator ou numa Jetson, sem Python. Confira que o modelo exportado dá o
            mesmo resultado que o <code>.pt</code> numa imagem de teste. E reprodutibilidade é guardar tudo que levou ao número: pesos, configuração (<code>args.yaml</code>), versões, semente e a
            divisão.
          </p>
        </>
      ),
      exemplo: (
        <>
          <Fig n="dominio_variedades" cap="Uma foto de cada variedade do WGISD com as caixas reais. O brilho e a cor do cacho mudam bastante entre domínios." />
          <Fig n="dominio_cor" cap="Histogramas de matiz e brilho dos pixels dentro das caixas anotadas, por variedade: a mudança de domínio em números." />
          <Fig n="iluminacao" cap="A mesma foto do WGISD em seis condições simuladas. Use-as como teste de estresse do modelo." />
          <Fig n="rastreamento_ids" cap="Simulação de uma câmera andando pela fileira sobre uma foto real: cada cacho mantém o id entre quadros." />
          <Caso
            tipo="artigo brasileiro"
            titulo="Detection and classification of soybean pests using deep learning with UAV images"
            autores="Tetila, Machado, Astolfi, Belete, Amorim, Roel e Pistori"
            onde="Computers and Electronics in Agriculture 179 (2020), 105836"
            link="https://doi.org/10.1016/j.compag.2020.105836"
            resumo={<p>Pragas da soja fotografadas por drone em condições reais de campo, classificadas por cinco arquiteturas profundas. As redes com ajuste fino a partir de pesos pré-treinados foram as melhores: transfer learning num problema de campo brasileiro.</p>}
            pipeline={['Imagens de VANT em lavouras de soja', 'Cinco arquiteturas profundas comparadas', 'Treino do zero × ajuste fino de pesos pré-treinados']}
            numeros={[{ v: '5', l: 'arquiteturas comparadas' }, { v: 'até 93,82%', l: 'acurácia com ajuste fino' }]}
            discutir={['Em que condições (dia, hora, propriedade) foram as fotos de teste?', 'Como o resultado mudaria numa safra seguinte?']}
          />
        </>
      ),
      pratica: (
        <>
          <ol>
            <li>Avaliem o <code>best.pt</code> no teste (Syrah, nunca visto). Comparem com a validação: quantos pontos de mAP50 caíram?</li>
            <li>Escolham 5 erros (FP ou FN) e classifiquem a causa: luz, oclusão, escala, cor, anotação.</li>
            <li>Rodem o modelo nas variações de iluminação (célula do notebook) e vejam qual condição mais derruba a revocação.</li>
            <li>Rodem o rastreamento no vídeo de exemplo e comparem soma de caixas com ids únicos.</li>
            <li>Exportem para ONNX, confiram uma predição e guardem a pasta <code>runs/uva_n</code> no Drive.</li>
          </ol>
          <Code code={`m = YOLO("runs/uva_n/weights/best.pt")
val = m.val(data="wgisd_yolo/data.yaml", split="val", verbose=False)
teste = m.val(data="wgisd_yolo/data.yaml", split="test", verbose=False)
print("queda de mAP50:", round(val.box.map50 - teste.box.map50, 3))

ids = set()
for r in m.track("fileira.mp4", tracker="bytetrack.yaml", stream=True, conf=0.3, persist=True):
    if r.boxes.id is not None: ids.update(r.boxes.id.int().tolist())
print("cachos contados:", len(ids))

caminho = m.export(format="onnx", imgsz=640)
onnx = YOLO(caminho)
print(len(onnx.predict("CDY_2017.jpg")[0].boxes), "caixas no ONNX")`} />
        </>
      ),
      exercicios: [
        { nivel: 'básico', q: 'No vídeo, o detector somou 900 caixas e o rastreador 75 ids. Quantos cachos? Por que os números diferem tanto?', r: <p>75: cada cacho aparece em cerca de 12 quadros em média. A soma de caixas conta o mesmo cacho a cada quadro.</p> },
        { nivel: 'médio', q: 'mAP50 de 0,88 na validação (Sauvignon Blanc) e 0,61 no teste (Syrah). Liste três hipóteses e um experimento para testar cada uma.', r: <p>(1) Cor: o treino tinha poucas uvas tintas; inclua Cabernet no treino e reavalie. (2) Luz ou câmera diferentes na coleta de Syrah; compare histogramas de brilho e teste com augmentation de HSV mais forte. (3) Anotação diferente (outro anotador ou regra); audite 20 fotos de Syrah lado a lado.</p> },
        { nivel: 'médio', q: 'O rastreador troca o id de um cacho quando uma folha passa na frente por 5 quadros. Que parâmetro do rastreador ajuda?', r: <p>O tempo que uma trilha sem par sobrevive antes de ser encerrada (track_buffer no bytetrack.yaml). Aumentá-lo permite recuperar o mesmo id depois da oclusão, com o risco de juntar objetos diferentes.</p> },
        { nivel: 'desafio', q: 'O modelo vai rodar num celular no campo. Que formato de exportação e que tamanho de modelo você escolheria, e como validaria a escolha?', r: <p>TFLite ou NCNN com o modelo nano, possivelmente em FP16 ou INT8. Validaria comparando mAP e erro de contagem do exportado com o .pt no mesmo conjunto de validação e medindo o tempo por imagem no próprio aparelho.</p> },
      ],
    },
    /* ============================================================ 2.6 */
    {
      id: 'b26',
      cod: '2.6',
      titulo: 'Pesquisa aplicada e orientação do trabalho',
      min: 20,
      tipo: 'leitura',
      slides: [
        { titulo: 'O que a pesquisa faz com isso', pontos: ['Santos et al. (2020): WGISD, Embrapa, detecção + rastreamento', 'Barbedo (2019): doenças por lesão individual, Embrapa', 'Tetila et al. (2020): pragas da soja por drone', 'Dang et al. (2023): YOLOWeeds, 25 YOLOs em daninhas do algodão', 'David et al. (2020): GWHD, espigas de trigo de vários países'] },
        { titulo: 'Como transformar o trabalho em artigo', pontos: ['Pergunta do produtor, não da rede', 'Banco descrito: origem, licença, anotação, divisão', 'Linha de base simples antes do modelo complexo', 'Teste em outro domínio', 'Análise de erros com figuras'] },
        { titulo: 'Trabalho em dupla', pontos: ['Dados e anotação: 25%', 'Treino e experimentação: 25%', 'Avaliação crítica e domínio externo: 30%', 'Demonstração e defesa: 20%'] },
      ],
      teoria: (
        <>
          <p>
            Os trabalhos abaixo fazem as mesmas escolhas que vocês fizeram hoje, em escala maior. Leiam procurando: <b>como dividiram</b>, <b>que métrica reportaram</b> e <b>se testaram fora do
            domínio</b>. Use a ficha de leitura crítica de cada artigo na seção de artigos.
          </p>
          <p>
            Para o trabalho, a estrutura de um bom relatório técnico em formato de artigo: introdução com o problema do campo; materiais com o banco (origem, licença, como foi anotado, guia, como foi
            dividido); métodos (modelo, hiperparâmetros, como foram escolhidos); resultados na validação e no teste externo; análise de erros com figuras; limitações; e um repositório que roda do zero.
          </p>
        </>
      ),
      exemplo: (
        <>
          <Caso
            tipo="artigo da Embrapa"
            titulo="Grape detection, segmentation, and tracking using deep neural networks and three-dimensional association"
            autores="Santos, de Souza, dos Santos e Avila"
            onde="Computers and Electronics in Agriculture 170 (2020), 105247"
            link="https://doi.org/10.1016/j.compag.2020.105247"
            resumo={<p>Os autores criaram o WGISD nos vinhedos da Vinícola Guaspari, em Espírito Santo do Pinhal (SP), compararam detectores de um e dois estágios e usaram a trajetória da câmera para associar cachos entre quadros e contá-los sem repetição. É o banco que vocês usaram nas duas aulas.</p>}
            pipeline={['300 fotos, 5 variedades, caixas e máscaras', 'Mask R-CNN, YOLOv2 e YOLOv3', 'Divisão em treino e teste declarada no repositório', 'Rastreamento por associação 3D em vídeo']}
            numeros={[{ v: '300', l: 'fotos' }, { v: '4.431', l: 'cachos com caixa' }, { v: '2.020', l: 'cachos com máscara' }, { v: '5', l: 'variedades' }]}
            discutir={['A divisão do banco original é por foto. Que vazamento isso pode causar entre fotos do mesmo vinhedo?', 'Por que o rastreamento muda o número que interessa ao produtor?']}
          />
          <Caso
            tipo="artigo da Embrapa"
            titulo="Plant disease identification from individual lesions and spots using deep learning"
            autores="Barbedo"
            onde="Biosystems Engineering 180 (2019), 96-107"
            link="https://doi.org/10.1016/j.biosystemseng.2019.02.002"
            resumo={<p>Em vez de classificar a folha inteira, o trabalho classifica cada lesão e mancha separadamente. Isso multiplica o número de exemplos e reduz o efeito do fundo, um jeito de contornar a falta de bancos grandes e o viés que Noyan (2022) encontrou no PlantVillage.</p>}
            pipeline={['Fotos de folhas com doenças de várias culturas', 'Recorte de lesões e manchas individuais', 'Classificação com CNN e transfer learning', 'Comparação com a folha inteira']}
            numeros={[{ v: 'lesão', l: 'unidade de classificação' }, { v: 'Embrapa', l: 'Informática Agropecuária' }]}
            discutir={['Recortar lesões é classificação ou detecção? O que seria preciso para usar isso no campo?', 'Que vazamento aparece se lesões da mesma folha caem em treino e teste?']}
          />
        </>
      ),
      pratica: (
        <Callout kind="prof">
          <p>Fechar com os critérios do trabalho (seção abaixo) e abrir 5 minutos para dúvidas. Cada dupla sai com o problema, o banco e o grupo de divisão escolhidos.</p>
        </Callout>
      ),
      exercicios: [
        { nivel: 'médio', q: 'Escreva em duas frases a seção "divisão dos dados" do relatório da dupla, de modo que a banca não precise perguntar nada.', r: <p>Exemplo: "As 300 imagens foram divididas por variedade: Chardonnay, Cabernet Franc e Cabernet Sauvignon no treino (n imagens), Sauvignon Blanc na validação (m) e Syrah no teste (k), de modo que nenhuma sessão de coleta aparece em dois conjuntos. A validação foi usada para parada antecipada e escolha do limiar; o teste foi avaliado uma única vez."</p> },
      ],
    },
  ],
  artigos: [
    { tag: 'banco da aula', br: true, ref: 'Santos, T. T. et al. (2020). Grape detection, segmentation, and tracking using deep neural networks and three-dimensional association. Computers and Electronics in Agriculture, 170, 105247.', link: 'https://doi.org/10.1016/j.compag.2020.105247', porque: 'O WGISD e o rastreamento de cachos em vídeo.', perguntas: ['Qual a diferença de desempenho entre Mask R-CNN e YOLO no artigo?', 'Como a associação 3D evita contar o mesmo cacho duas vezes?'] },
    { tag: 'CNN no agro', br: true, ref: 'dos Santos Ferreira, A.; Freitas, D. M.; da Silva, G. G.; Pistori, H.; Folhes, M. T. (2017). Weed detection in soybean crops using ConvNets. Computers and Electronics in Agriculture, 143, 314-324.', link: 'https://doi.org/10.1016/j.compag.2017.10.027', porque: 'ConvNet contra SVM, AdaBoost e Random Forest com descritores, em daninhas da soja fotografadas por drone.', perguntas: ['Os segmentos de uma mesma foto foram separados entre treino e teste?', 'Que descritores manuais foram comparados?'] },
    { tag: 'transfer learning', br: true, ref: 'Tetila, E. C. et al. (2020). Detection and classification of soybean pests using deep learning with UAV images. Computers and Electronics in Agriculture, 179, 105836.', link: 'https://doi.org/10.1016/j.compag.2020.105836', porque: 'Cinco arquiteturas e o ganho do ajuste fino em pragas da soja fotografadas por drone.', perguntas: ['Treino do zero contra ajuste fino: qual a diferença?', 'O teste veio de outra lavoura ou data?'] },
    { tag: 'dados e viés', br: true, ref: 'Barbedo, J. G. A. (2019). Plant disease identification from individual lesions and spots using deep learning. Biosystems Engineering, 180, 96-107.', link: 'https://doi.org/10.1016/j.biosystemseng.2019.02.002', porque: 'Classificar lesões em vez de folhas inteiras para lidar com bancos pequenos (Embrapa).' },
    { tag: 'benchmark', ref: 'Dang, F.; Chen, D.; Lu, Y.; Li, Z. (2023). YOLOWeeds: A novel benchmark of YOLO object detectors for multi-class weed detection in cotton production systems. Computers and Electronics in Agriculture, 205, 107655.', link: 'https://doi.org/10.1016/j.compag.2023.107655', porque: '25 YOLOs comparados em 12 daninhas, com Monte-Carlo e análise de augmentation. Tem notebook extra no repositório.', perguntas: ['Quanto o modelo maior ganhou de mAP e quanto custou de tempo?', 'Por que repetir com sementes diferentes?'] },
    { tag: 'domínio', ref: 'David, E. et al. (2020). Global Wheat Head Detection (GWHD) dataset. Plant Phenomics.', link: 'https://arxiv.org/abs/2005.02162', porque: 'Espigas de trigo de vários países e câmeras: o exemplo clássico de mudança de domínio.', perguntas: ['Como o banco foi dividido entre regiões?', 'O que muda entre os domínios?'] },
    { tag: 'hiperparâmetros', ref: 'Bergstra, J.; Bengio, Y. (2012). Random search for hyper-parameter optimization. JMLR 13.', link: 'https://jmlr.org/papers/v13/bergstra12a.html', porque: 'Por que a busca aleatória vence a grade com o mesmo orçamento.' },
    { tag: 'rastreamento', ref: 'Zhang, Y. et al. (2022). ByteTrack: Multi-Object Tracking by Associating Every Detection Box. ECCV.', link: 'https://arxiv.org/abs/2110.06864', porque: 'O rastreador padrão do Ultralytics.' },
    { tag: 'objetos pequenos', ref: 'Akyon, F. C.; Altinuc, S. O.; Temizel, A. (2022). Slicing Aided Hyper Inference and Fine-tuning for Small Object Detection. ICIP.', link: 'https://arxiv.org/abs/2202.06934', porque: 'O SAHI: fatiar a imagem para não perder objeto pequeno.' },
  ],
  quiz: [
    { p: 'Por que um perceptron sozinho não aprende o XOR?', o: ['faltam épocas', 'η muito alto', 'as classes não são separáveis por uma reta', 'os pesos começam em zero'], a: 2, e: 'XOR precisa de duas retas: camada escondida e ativação não linear.' },
    { p: 'Entrada 320 × 320, conv 3 × 3, padding 1, stride 2. Tamanho da saída?', o: ['318', '320', '160', '159'], a: 2, e: '⌊(320 − 3 + 2) / 2⌋ + 1 = 159 + 1 = 160.' },
    { p: 'Perda de treino caindo e de validação subindo desde a época 40. Diagnóstico?', o: ['underfitting', 'overfitting', 'vazamento', 'GSD alto'], a: 1, e: 'A rede passou a decorar o treino.' },
    { p: 'Qual transformação muda as coordenadas das caixas?', o: ['variação de HSV', 'blur', 'espelhamento horizontal', 'ruído gaussiano'], a: 2, e: 'Geométricas mudam as caixas; fotométricas não.' },
    { p: 'TP = 80, FP = 20, FN = 20. F1?', o: ['0,64', '0,80', '0,90', '0,75'], a: 1, e: 'P = R = 0,8, então F1 = 0,8.' },
    { p: 'Modelo com P = 0,95 e R = 0,60. Na contagem de cachos, o erro típico é:', o: ['contar a mais', 'contar a menos', 'contar certo', 'não dá para saber'], a: 1, e: 'Revocação baixa: muitos cachos ficam sem caixa.' },
    { p: 'Qual conjunto se usa para escolher a taxa de aprendizado?', o: ['treino', 'validação', 'teste', 'qualquer um'], a: 1, e: 'O teste só é aberto no fim.' },
    { p: 'Num vídeo, o detector achou 900 caixas e o rastreador 75 ids. Quantos cachos?', o: ['900', '75', '825', '12'], a: 1, e: 'Cada id é um cacho visto em vários quadros.' },
  ],
  entregas: [
    <><b>Notebook de treino</b> que roda do zero, com versões, semente, divisão e parâmetros registrados.</>,
    <><b>Resultados</b>: curvas, P, R, mAP50, mAP50-95, matriz de confusão e erro de contagem (MAE e viés).</>,
    <><b>Linha de base</b>: um método clássico (limiar de cor + componentes) ou o modelo pré-treinado sem ajuste, para comparar.</>,
    <><b>Domínio externo</b>: avaliação em outro grupo (variedade, propriedade, data) e análise de pelo menos 5 erros, com figura e causa provável.</>,
    <><b>Relatório em formato de artigo</b> e demonstração de inferência em imagem ou vídeo na defesa.</>,
  ],
}
