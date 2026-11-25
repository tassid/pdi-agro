import type { Aula } from '../curso'
import { Fig } from '../curso'
import { Callout, Caso, Code } from '../ui'
import { LabPerceptron } from '../labs'

export const aula2: Aula = {
  id: 'aula2',
  n: 2,
  titulo: 'Redes neurais, treinamento e avaliação em campo',
  ideia: 'Uma rede é um empilhado de perceptrons com filtros aprendidos. Treinar é fácil; difícil é saber se o número que sai no fim vale para a próxima fazenda.',
  chips: ['perceptron e XOR', 'ativações', 'CNN e transfer learning', 'perdas do YOLO', 'augmentation', 'GSD e SAHI', 'P, R, F1, mAP', 'early stopping', 'grade × aleatória', 'mudança de domínio', 'rastreamento'],
  objetivos: [
    'Aplicar a regra de atualização do perceptron e explicar por que uma camada não resolve o XOR.',
    'Relacionar filtros convolucionais aprendidos aos filtros clássicos de PDI e justificar o transfer learning.',
    'Configurar e executar um treino YOLO, lendo as perdas, o augmentation e a parada antecipada.',
    'Diagnosticar underfitting e overfitting pelas curvas e interpretar precisão, revocação, F1, mAP50 e mAP50-95.',
    'Avaliar o modelo num domínio diferente do treino e explicar a queda de desempenho.',
    'Contar objetos em vídeo com rastreamento e exportar o modelo de forma reprodutível.',
  ],
  intervaloDepois: 'b23',
  notebook: {
    nome: 'Aula2_Treino_Avaliacao_Dominio.ipynb',
    arquivo: 'Aula2_Treino_Avaliacao_Dominio.ipynb',
    descricao: 'Treina um YOLO no WGISD com divisão por variedade, lê as curvas, mede P, R e mAP e testa numa variedade nunca vista.',
  },
  blocos: [
    {
      id: 'b21',
      cod: '2.1',
      titulo: 'Preparação do ambiente',
      min: 15,
      tipo: 'lab',
      slides: [{ titulo: 'Checklist antes de treinar', pontos: ['Ambiente de execução → GPU (T4)', '!nvidia-smi mostra a placa', 'pip install ultralytics e anotar a versão', 'Clonar o WGISD e rodar a célula de preparação', 'Abrir o data.yaml e conferir caminhos e classes'] }],
      teoria: <p>Treino de detector sem GPU leva horas. No Colab, ative a GPU antes de qualquer outra célula, porque trocar o ambiente apaga o que já foi instalado. Anote as versões do Python, do PyTorch e do Ultralytics: elas vão no relatório.</p>,
      exemplo: <Code code={`!nvidia-smi --query-gpu=name,memory.total --format=csv
!pip -q install ultralytics
import ultralytics, torch, sys
print(sys.version.split()[0], torch.__version__, ultralytics.__version__)`} />,
      pratica: <p>Rodem as células 1 e 2 do notebook. Elas clonam o WGISD (só as anotações e 300 fotos), montam a divisão por variedade da Aula 1 e escrevem o <code>data.yaml</code>. Conferir no print: treino com 3 variedades, validação com 1, teste com 1.</p>,
    },
    {
      id: 'b22',
      cod: '2.2',
      titulo: 'Do perceptron à CNN',
      min: 50,
      tipo: 'conceito',
      slides: [
        { titulo: 'O perceptron de Rosenblatt', img: 'perceptron_and_or_xor', formula: <>ŷ = degrau(w·x + b) · w ← w + η (y − ŷ) x</>, pontos: ['AND e OR: uma reta separa', 'XOR: nenhuma reta separa', 'Solução: camada escondida + ativação não linear'] },
        { titulo: 'Funções de ativação', img: 'ativacoes', pontos: ['Sigmoide: suave, mas satura', 'ReLU: barata, não satura no positivo', 'SiLU: suave como a sigmoide, usada no YOLO'] },
        { titulo: 'Filtro escolhido × filtro aprendido', img: 'filtros_conv', pontos: ['Convolução = o kernel da Aula 2 de PDI', 'Na CNN, os 9 números do kernel 3×3 são pesos', 'Retropropagação ajusta os pesos pelo gradiente da perda'] },
        { titulo: 'Transfer learning', pontos: ['Pesos do COCO já sabem bordas, texturas, formas', 'Só as camadas finais precisam aprender "cacho de uva"', 'Menos dados, menos épocas, melhor resultado', 'Cuidado: COCO é urbano; o agro é outro domínio'] },
      ],
      teoria: (
        <>
          <p>
            O <b>perceptron</b> (Rosenblatt, 1958) soma as entradas com pesos, compara com zero e responde 0 ou 1. A regra de aprendizado é simples: quando erra, mexe os pesos na direção do exemplo,{' '}
            <code>w ← w + η (y − ŷ) x</code>. Isso traça uma reta no plano, e por isso resolve AND e OR mas nunca o XOR, que precisa de duas retas.
          </p>
          <p>
            Empilhando perceptrons numa <b>camada escondida</b> e trocando o degrau por uma função suave (sigmoide, ReLU, SiLU), a rede vira um <b>MLP</b> e passa a desenhar fronteiras curvas. Os pesos
            agora são ajustados pelo <b>gradiente descendente</b>: a <b>retropropagação</b> calcula quanto cada peso contribuiu para o erro e o otimizador dá um passo contrário.
          </p>
          <p>
            Para imagem, ligar cada pixel a cada neurônio é inviável (uma foto de 640 × 640 × 3 tem 1,2 milhão de entradas). A <b>CNN</b> resolve com convolução: um kernel pequeno percorre a imagem,
            exatamente como Sobel e Laplaciano, só que os números do kernel são aprendidos. As primeiras camadas aprendem bordas; as últimas, partes de objeto.
          </p>
          <p>
            <b>Transfer learning</b>: em vez de começar com pesos aleatórios, começamos com os pesos treinados no COCO (330 mil imagens, 80 classes). As camadas iniciais já sabem ver; ajustamos o resto
            para as nossas classes. É isso que <code>YOLO("yolo11n.pt")</code> faz.
          </p>
        </>
      ),
      exemplo: (
        <>
          <Fig n="perceptron_and_or_xor" cap="Perceptron treinado de verdade (η = 0,2) nas três portas. No XOR ele termina 30 épocas ainda errando." />
          <Fig n="ativacoes" cap="As ativações mais usadas. O YOLO usa SiLU nas camadas convolucionais." />
          <Fig n="filtros_conv" cap="Quatro kernels clássicos aplicados a uma foto real do CWFID. Uma CNN aprende dezenas desses por camada." />
          <Callout kind="analogia"><p>O backbone pré-treinado é um agrônomo recém-formado: já sabe o que é folha, sombra e solo. Falta só mostrar como é o cacho desta variedade.</p></Callout>
        </>
      ),
      pratica: (
        <>
          <LabPerceptron />
          <p><b>No quadro (10 min).</b> Pesos iniciais zero, η = 0,2, porta OR. Façam à mão a primeira época (4 exemplos) e confiram no laboratório.</p>
        </>
      ),
    },
    {
      id: 'b23',
      cod: '2.3',
      titulo: 'Treinamento YOLO e execução na GPU',
      min: 45,
      tipo: 'conceito',
      slides: [
        { titulo: 'O que o YOLO minimiza', pontos: ['box_loss: erro de posição e tamanho da caixa (IoU)', 'cls_loss: erro de classe', 'dfl_loss: refinamento da borda da caixa', 'Os nomes mudam entre versões: confira no results.csv'] },
        { titulo: 'Augmentation já vem ligado', img: 'augmentation_real', pontos: ['Geométrico: as caixas acompanham', 'Fotométrico: as caixas ficam iguais', 'Mosaic mistura 4 fotos: mais contexto, mais objetos pequenos'] },
        { titulo: 'Objeto pequeno: imgsz e SAHI', img: 'sahi_fatias', pontos: ['imgsz=640 encolhe uma foto de 2048 px 3,2 vezes', 'Mais imgsz = mais detalhe e mais memória', 'SAHI fatia a foto e junta com NMS'] },
      ],
      teoria: (
        <>
          <p>
            O Ultralytics reporta três perdas na detecção: <code>box_loss</code> (quão longe a caixa está da anotação, medida por IoU), <code>cls_loss</code> (erro de classe) e <code>dfl_loss</code>{' '}
            (distribution focal loss, que refina onde fica cada borda). Os nomes e a composição mudam entre versões, então leia o cabeçalho do <code>results.csv</code> da sua versão.
          </p>
          <p>
            O <b>augmentation</b> já vem ligado: mosaic, espelhamento, variação de HSV, escala e translação. Transformações geométricas mudam as caixas; fotométricas não. Ele é aplicado só no treino,
            depois da divisão: aumentar antes de dividir é vazamento.
          </p>
          <p>
            <b>Resolução.</b> O <code>imgsz</code> é o lado da imagem que entra na rede. Fotos de 2048 px reduzidas para 640 perdem detalhe de objetos pequenos (volte ao GSD da Aula 1). Duas saídas:
            subir o <code>imgsz</code> (custa memória) ou fatiar a imagem em pedaços com sobreposição e juntar as detecções, como faz o <b>SAHI</b> (Akyon et al., 2022).
          </p>
          <p><b>Parada antecipada</b>: <code>patience=15</code> encerra o treino depois de 15 épocas sem melhora na validação e guarda o melhor peso em <code>best.pt</code>.</p>
        </>
      ),
      exemplo: (
        <>
          <Fig n="augmentation_real" cap="As transformações do Ultralytics aplicadas a fotos reais do WGISD, com as caixas recalculadas. O mosaic junta quatro variedades." />
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
    seed=42, project="runs", name="uva_n",
)`} />
          <Callout kind="prof"><p>Com a T4 do Colab, 40 épocas no WGISD levam cerca de 10 a 15 minutos com o modelo nano. Se a GPU cair, o notebook tem pesos prontos para seguir.</p></Callout>
        </>
      ),
    },
    {
      id: 'b24',
      cod: '2.4',
      titulo: 'Curvas, métricas e hiperparâmetros',
      min: 45,
      tipo: 'conceito',
      slides: [
        { titulo: 'Lendo as curvas', img: 'curvas_treino', pontos: ['As duas perdas altas: underfitting', 'Treino desce e validação sobe: overfitting', 'best.pt fica no pico da validação'] },
        { titulo: 'Precisão, revocação, F1', img: 'pr_curva_real', formula: <>P = TP/(TP+FP) · R = TP/(TP+FN) · F1 = 2PR/(P+R)</>, pontos: ['AP = área sob a curva PR', 'mAP50: média das classes com IoU 0,5', 'mAP50-95: média de IoU 0,50 a 0,95'] },
        { titulo: 'Matriz de confusão do detector', img: 'matriz_confusao', pontos: ['Diagonal: acertos por classe', 'Linha "fundo": falsos positivos', 'Coluna "fundo": objetos que o modelo não viu'] },
        { titulo: 'Grade ou aleatória?', img: 'grid_vs_random', pontos: ['Mesmo orçamento de treinos', 'Aleatória testa mais valores do que importa', 'Ajuste só com treino e validação; teste é para o fim'] },
      ],
      teoria: (
        <>
          <p>Para cada imagem, as caixas previstas são casadas com as anotadas por IoU ≥ 0,5. Daí saem:</p>
          <ol>
            <li><b>Precisão</b> P = TP / (TP + FP): das caixas que o modelo desenhou, quantas eram cachos.</li>
            <li><b>Revocação</b> R = TP / (TP + FN): dos cachos que existiam, quantos o modelo achou.</li>
            <li><b>F1</b>: média harmônica das duas; o pico da curva F1 × confiança sugere o <code>conf</code> de uso.</li>
            <li><b>AP</b>: área sob a curva precisão × revocação de uma classe. <b>mAP50</b> é a média das classes com IoU 0,5; <b>mAP50-95</b> repete para IoU de 0,50 a 0,95 e tira a média.</li>
          </ol>
          <p>
            Métrica de detecção não é métrica de negócio. Para estimar produção, o que importa é o <b>erro de contagem</b> (cachos previstos − cachos reais por fileira). Um modelo com mAP mediano pode
            contar bem, e o contrário também acontece.
          </p>
          <p>
            <b>Hiperparâmetros</b>: taxa de aprendizado, imgsz, tamanho do modelo, augmentation. Com orçamento fixo, a <b>busca aleatória</b> costuma vencer a <b>busca em grade</b> (Bergstra e Bengio, 2012),
            porque explora mais valores do hiperparâmetro que realmente importa. Toda escolha é feita olhando a validação. O teste é aberto uma vez, no fim.
          </p>
        </>
      ),
      exemplo: (
        <>
          <Fig n="curvas_treino" cap="Formato típico do results.csv. As curvas são ilustrativas; no notebook vocês plotam as suas." />
          <Fig n="pr_curva_real" cap="Curva PR calculada sobre 221 cachos reais do WGISD contra um detector simulado. Repare como o AP cai ao exigir IoU 0,75." />
          <Fig n="matriz_confusao" cap="Leitura da matriz de confusão de um detector com duas classes e fundo (valores ilustrativos)." />
          <Fig n="grid_vs_random" cap="Nove treinos em grade testam 3 taxas de aprendizado; nove aleatórios testam 9." />
        </>
      ),
      pratica: (
        <>
          <p>Com o treino pronto (célula 4):</p>
          <ol>
            <li>Plotem as perdas e o mAP50 por época. O treino parou por paciência ou por fim de épocas?</li>
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
    },
    {
      id: 'b25',
      cod: '2.5',
      titulo: 'Laboratório 2: mudança de domínio, rastreamento e exportação',
      min: 45,
      tipo: 'lab',
      slides: [
        { titulo: 'O teste que importa: outra fazenda', img: 'dominio_variedades', pontos: ['Cor do cacho, folhagem, luz e câmera mudam', 'Treinamos em 3 variedades e testamos em Syrah', 'A queda de mAP mede o quanto o modelo generaliza'] },
        { titulo: 'Contar em vídeo sem contar duas vezes', img: 'rastreamento_ids', pontos: ['Detector vê o mesmo cacho em vários quadros', 'Rastreador (ByteTrack) mantém o id', 'Contagem = ids únicos, não soma de caixas'] },
        { titulo: 'Exportar e reproduzir', pontos: ['model.export(format="onnx") para rodar fora do Python', 'Guardar: best.pt, data.yaml, args.yaml, results.csv', 'Anotar versões, semente e divisão', 'Notebook roda do zero e chega no mesmo número'] },
      ],
      teoria: (
        <>
          <p>
            Um modelo treinado e validado numa fazenda aprende também o que é próprio daquela fazenda: a luz da manhã, a câmera, a cor do solo, a variedade. Num <b>domínio diferente</b> o desempenho cai,
            e essa queda é a informação mais honesta do trabalho. No WGISD, cada variedade é um domínio: Syrah tem cachos escuros e Chardonnay tem cachos verdes.
          </p>
          <p>
            Em <b>vídeo</b>, o mesmo cacho aparece em dezenas de quadros. Somar as caixas superestima a contagem. Um rastreador como o <b>ByteTrack</b> (Zhang et al., 2022) associa as detecções entre quadros e
            dá um id a cada objeto; a contagem passa a ser o número de ids únicos. Santos et al. (2020) fizeram exatamente isso com os cachos do WGISD.
          </p>
          <p>
            Por fim, <b>exportar</b> o modelo (ONNX, TorchScript, TFLite) permite rodar no celular ou no computador de bordo do trator. E reprodutibilidade é guardar tudo que levou ao número: pesos,
            configuração, versões, semente e a divisão.
          </p>
        </>
      ),
      exemplo: (
        <>
          <Fig n="dominio_variedades" cap="Uma foto de cada variedade do WGISD com as caixas reais. O brilho médio e a cor do cacho mudam bastante entre domínios." />
          <Fig n="rastreamento_ids" cap="Simulação de uma câmera andando pela fileira sobre uma foto real: cada cacho mantém o id entre quadros." />
        </>
      ),
      pratica: (
        <>
          <ol>
            <li>Avaliem o <code>best.pt</code> no teste (Syrah, nunca visto). Comparem com a validação.</li>
            <li>Escolham 5 erros (FP ou FN) e classifiquem a causa: luz, oclusão, escala, cor, anotação.</li>
            <li>Rodem o rastreamento no vídeo de exemplo do notebook e comparem soma de caixas com ids únicos.</li>
            <li>Exportem para ONNX e guardem a pasta <code>runs/uva_n</code> no Drive.</li>
          </ol>
          <Code code={`m = YOLO("runs/uva_n/weights/best.pt")
teste = m.val(data="wgisd_yolo/data.yaml", split="test")
print("queda de mAP50:", round(m.val(split="val").box.map50 - teste.box.map50, 3))

ids = set()
for r in m.track("fileira.mp4", tracker="bytetrack.yaml", stream=True, conf=0.3):
    if r.boxes.id is not None: ids.update(r.boxes.id.int().tolist())
print("cachos contados:", len(ids))
m.export(format="onnx")`} />
        </>
      ),
    },
    {
      id: 'b26',
      cod: '2.6',
      titulo: 'Pesquisa aplicada e orientação do trabalho',
      min: 20,
      tipo: 'leitura',
      slides: [
        { titulo: 'O que a pesquisa faz com isso', pontos: ['Santos et al. (2020): WGISD, Embrapa, detecção + rastreamento 3D', 'David et al. (2020): GWHD, espigas de trigo de vários países', 'Dang et al. (2023): YOLOWeeds, 25 YOLOs comparados em daninhas do algodão'] },
        { titulo: 'Trabalho em dupla', pontos: ['Dados e anotação: 25%', 'Treino e experimentação: 25%', 'Avaliação crítica e domínio externo: 30%', 'Demonstração e defesa: 20%'] },
      ],
      teoria: <p>Os três trabalhos abaixo fazem as mesmas escolhas que vocês fizeram hoje, em escala maior. Leiam procurando: como dividiram, que métrica reportaram e se testaram fora do domínio.</p>,
      exemplo: (
        <Caso
          tipo="artigo da Embrapa"
          titulo="Grape detection, segmentation, and tracking using deep neural networks and three-dimensional association"
          autores="Santos, de Souza, dos Santos e Avila"
          onde="Computers and Electronics in Agriculture 170 (2020), 105247"
          link="https://doi.org/10.1016/j.compag.2020.105247"
          resumo={<p>Os autores criaram o WGISD nos vinhedos da Vinícola Guaspari, em Espírito Santo do Pinhal (SP), compararam detectores de um e dois estágios e usaram a trajetória da câmera para associar cachos entre quadros e contá-los sem repetição. É o banco que vocês usaram nas duas aulas.</p>}
          pipeline={['300 fotos, 5 variedades, caixas e máscaras', 'Mask R-CNN, YOLOv2 e YOLOv3', 'Divisão em treino e teste declarada no repositório', 'Rastreamento por associação 3D em vídeo']}
          numeros={[{ v: '300', l: 'fotos' }, { v: '4.432', l: 'cachos anotados' }, { v: '5', l: 'variedades' }]}
          discutir={['A divisão do banco original é por foto. Que vazamento isso pode causar entre fotos do mesmo vinhedo?', 'Por que o rastreamento muda o número que interessa ao produtor?']}
        />
      ),
      pratica: (
        <Callout kind="prof">
          <p>Fechar com os critérios do trabalho (seção abaixo) e abrir 5 minutos para dúvidas. Cada dupla sai com o problema e o grupo de divisão escolhidos.</p>
        </Callout>
      ),
    },
  ],
  artigos: [
    { tag: 'banco da aula', ref: 'Santos, T. T. et al. (2020). Grape detection, segmentation, and tracking using deep neural networks and three-dimensional association. Computers and Electronics in Agriculture, 170, 105247.', link: 'https://doi.org/10.1016/j.compag.2020.105247', porque: 'O WGISD e o rastreamento de cachos em vídeo.' },
    { tag: 'benchmark', ref: 'Dang, F.; Chen, D.; Lu, Y.; Li, Z. (2023). YOLOWeeds: A novel benchmark of YOLO object detectors for multi-class weed detection in cotton production systems. Computers and Electronics in Agriculture, 205, 107655.', link: 'https://doi.org/10.1016/j.compag.2023.107655', porque: '25 YOLOs comparados em 12 daninhas, com Monte-Carlo e análise de augmentation. Tem notebook extra no repositório.' },
    { tag: 'domínio', ref: 'David, E. et al. (2020). Global Wheat Head Detection (GWHD) dataset. Plant Phenomics.', link: 'https://arxiv.org/abs/2005.02162', porque: 'Espigas de trigo de vários países e câmeras: o exemplo clássico de mudança de domínio.' },
    { tag: 'hiperparâmetros', ref: 'Bergstra, J.; Bengio, Y. (2012). Random search for hyper-parameter optimization. JMLR 13.', link: 'https://jmlr.org/papers/v13/bergstra12a.html', porque: 'Por que a busca aleatória vence a grade com o mesmo orçamento.' },
    { tag: 'rastreamento', ref: 'Zhang, Y. et al. (2022). ByteTrack: Multi-Object Tracking by Associating Every Detection Box. ECCV.', link: 'https://arxiv.org/abs/2110.06864', porque: 'O rastreador padrão do Ultralytics.' },
    { tag: 'objetos pequenos', ref: 'Akyon, F. C.; Altinuc, S. O.; Temizel, A. (2022). Slicing Aided Hyper Inference and Fine-tuning for Small Object Detection. ICIP.', link: 'https://arxiv.org/abs/2202.06934', porque: 'O SAHI: fatiar a imagem para não perder objeto pequeno.' },
  ],
  quiz: [
    { p: 'Por que um perceptron sozinho não aprende o XOR?', o: ['falta épocas', 'η muito alto', 'as classes não são separáveis por uma reta', 'os pesos começam em zero'], a: 2, e: 'XOR precisa de duas retas: camada escondida e ativação não linear.' },
    { p: 'Perda de treino caindo e de validação subindo desde a época 40. Diagnóstico?', o: ['underfitting', 'overfitting', 'vazamento', 'GSD alto'], a: 1, e: 'A rede passou a decorar o treino.' },
    { p: 'Modelo com P = 0,95 e R = 0,60. Na contagem de cachos, o erro típico é:', o: ['contar a mais', 'contar a menos', 'contar certo', 'não dá para saber'], a: 1, e: 'Revocação baixa: muitos cachos ficam sem caixa.' },
    { p: 'Qual conjunto se usa para escolher a taxa de aprendizado?', o: ['treino', 'validação', 'teste', 'qualquer um'], a: 1, e: 'O teste só é aberto no fim.' },
    { p: 'Num vídeo, o detector achou 900 caixas e o rastreador 75 ids. Quantos cachos?', o: ['900', '75', '825', '12'], a: 1, e: 'Cada id é um cacho visto em vários quadros.' },
  ],
  entregas: [
    <><b>Notebook de treino</b> que roda do zero, com versões, semente e parâmetros registrados.</>,
    <><b>Resultados</b>: curvas, P, R, mAP50, mAP50-95, matriz de confusão e erro de contagem.</>,
    <><b>Domínio externo</b>: avaliação em outro grupo (variedade, propriedade, data) e análise de pelo menos 5 erros.</>,
    <><b>Relatório em formato de artigo</b> e demonstração de inferência em imagem ou vídeo na defesa.</>,
  ],
}
