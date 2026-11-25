import type { Aula } from '../curso'
import { Fig } from '../curso'
import { Callout, Caso, Code, Term } from '../ui'
import { LabConversor, LabIoU, LabNMS, LabSplit } from '../labs'

export const aula1: Aula = {
  id: 'aula1',
  n: 1,
  titulo: 'Fundamentos de detecção e engenharia de dados',
  ideia: 'Antes de treinar qualquer rede, é preciso saber que pergunta ela responde, como a resposta é escrita e como medir se ela acertou. O resto é dado bem anotado e bem dividido.',
  chips: ['PDI clássico × aprendizado profundo', 'classificar, detectar, segmentar', 'R-CNN, U-Net, YOLO', 'xyxy, COCO, YOLO', 'IoU e NMS', 'GSD', 'CVAT', 'divisão por grupo'],
  objetivos: [
    'Distinguir classificação, detecção, segmentação semântica e de instâncias, e escolher a tarefa certa para um problema do campo.',
    'Explicar a diferença entre detectores de dois estágios (R-CNN) e de um estágio (YOLO), e para que serve a U-Net.',
    'Converter caixas entre xyxy, COCO e o formato YOLO normalizado.',
    'Calcular IoU à mão e explicar o papel dos limiares de confiança e do NMS.',
    'Escrever um guia de anotação, anotar no CVAT e auditar os rótulos exportados.',
    'Dividir um banco de imagens por grupo de coleta sem vazamento entre treino, validação e teste.',
  ],
  intervaloDepois: 'b13',
  notebook: {
    nome: 'Aula1_Anotacao_Auditoria_Split.ipynb',
    arquivo: 'Aula1_Anotacao_Auditoria_Split.ipynb',
    descricao: 'Baixa o WGISD (Embrapa), roda um YOLO pré-treinado, calcula IoU e NMS à mão, audita rótulos e divide por variedade.',
  },
  blocos: [
    /* ------------------------------------------------------------ 1.1 */
    {
      id: 'b11',
      cod: '1.1',
      titulo: 'Do PDI clássico às tarefas de visão',
      min: 25,
      tipo: 'conceito',
      slides: [
        { titulo: 'O pipeline que vocês já conhecem', img: 'pipeline_classico', legenda: 'CWFID: cenoura e daninhas fotografadas em campo', pontos: ['Aquisição → realce → segmentação → rotulação → descritores', 'Cada etapa é uma regra escrita por uma pessoa', 'Funciona quando o problema é "verde contra marrom"'] },
        { titulo: 'A mesma regra num vinhedo', img: 'classico_falha', pontos: ['ExG + Otsu acha folha, não acha cacho de uva verde', 'Trocar de lavoura obriga a reescrever a regra', 'A rede profunda aprende a regra a partir de exemplos'] },
        { titulo: 'Quatro perguntas diferentes sobre a mesma foto', img: 'quatro_tarefas', legenda: 'WGISD, Chardonnay: anotação real de caixas e máscaras', pontos: ['Classificação: o que tem na foto?', 'Detecção: onde está e quantos são?', 'Semântica: qual pixel é uva?', 'Instâncias: qual pixel é de qual cacho?'] },
      ],
      teoria: (
        <>
          <p>
            Até agora, na disciplina, toda decisão era escrita à mão: qual canal de cor usar, qual limiar, qual tamanho de elemento estruturante. O pipeline clássico de PDI é{' '}
            <b>aquisição → pré-processamento → segmentação → extração de descritores → classificação</b>. Ele é rápido, explicável e funciona muito bem quando o contraste é simples.
          </p>
          <p>
            O aprendizado profundo troca a regra escrita por <b>exemplos rotulados</b>. A rede aprende sozinha os filtros (a Aula 2 mostra que eles são parentes dos kernels de Sobel e Laplaciano) e a regra de
            decisão. O preço é outro: agora a qualidade do modelo é a qualidade dos dados.
          </p>
          <p>Antes de escolher a rede, escolha a pergunta. São quatro tarefas, cada uma com uma saída e um custo de anotação diferentes:</p>
          <table className="tbl">
            <thead><tr><th>tarefa</th><th>saída</th><th>custo de anotar</th><th>exemplo no campo</th></tr></thead>
            <tbody>
              <tr><td>classificação</td><td>um rótulo por imagem</td><td>segundos</td><td>folha sadia ou doente</td></tr>
              <tr><td>detecção</td><td>caixas + classe + confiança</td><td>1 a 2 min por foto</td><td>contar cachos, bois, espigas</td></tr>
              <tr><td>segmentação semântica</td><td>classe por pixel</td><td>5 a 15 min por foto</td><td>área de daninha no talhão</td></tr>
              <tr><td>segmentação de instâncias</td><td>máscara por objeto</td><td>o mais caro</td><td>tamanho de cada cacho</td></tr>
            </tbody>
          </table>
        </>
      ),
      exemplo: (
        <>
          <Fig n="pipeline_classico" cap="Pipeline clássico numa foto real do CWFID (Haug e Ostermann, 2014): o índice ExG e o limiar de Otsu separam planta de solo e a rotulação conta os objetos." />
          <Fig n="classico_falha" cap="A mesma regra aplicada ao WGISD (Santos et al., 2020). O cacho de uva verde tem a mesma cor da folha: a regra falha e não há limiar que salve." />
          <Fig n="quatro_tarefas" cap="Uma foto do WGISD, quatro tarefas. As caixas e máscaras são as anotações reais do banco." />
          <Callout kind="campo">
            <p>Quer saber quantos cachos tem na fileira para estimar produção? Detecção basta. Quer o volume de cada cacho? Aí precisa de instâncias, e o custo de anotar multiplica por dez.</p>
          </Callout>
        </>
      ),
      pratica: (
        <>
          <p><b>Dinâmica em duplas (8 min).</b> Para cada problema abaixo, escolham a tarefa e justifiquem pelo custo de anotação:</p>
          <ol>
            <li>Contar frangos mortos num aviário por câmera no teto.</li>
            <li>Medir a porcentagem de área foliar com ferrugem na soja.</li>
            <li>Separar grãos de café em "bom" e "defeituoso" numa esteira, um grão por foto.</li>
            <li>Guiar um pulverizador que aplica herbicida só em cima da daninha.</li>
          </ol>
          <Callout kind="prof"><p>Respostas esperadas: detecção, semântica, classificação, semântica ou instâncias (depende do bico). O ponto não é acertar: é perceber que a saída define o rótulo, e o rótulo define o orçamento.</p></Callout>
        </>
      ),
    },
    /* ------------------------------------------------------------ 1.2 */
    {
      id: 'b12',
      cod: '1.2',
      titulo: 'Arquiteturas e formatos de anotação',
      min: 50,
      tipo: 'conceito',
      slides: [
        { titulo: 'Dois estágios contra um estágio', img: 'rcnn_vs_yolo', pontos: ['R-CNN: propõe regiões, depois classifica cada uma (lento, preciso)', 'YOLO: uma passada pela rede prevê tudo (rápido)', 'Hoje a diferença de precisão é pequena; a de velocidade continua grande'] },
        { titulo: 'U-Net: uma resposta por pixel', img: 'unet_cwfid', pontos: ['Codificador reduz a imagem e entende o contexto', 'Decodificador volta ao tamanho original', 'Conexões de atalho devolvem o detalhe da borda'] },
        { titulo: 'Como o YOLO divide a imagem', img: 'grade_yolo', pontos: ['Backbone extrai características', 'Neck mistura escalas (objetos grandes e pequenos)', 'Heads preveem caixa, classe e confiança em cada célula'] },
        { titulo: 'A mesma caixa, três formatos', img: 'formatos_caixa', formula: <>YOLO: x<sub>c</sub> = (x₁+x₂)/2W · y<sub>c</sub> = (y₁+y₂)/2H · w = (x₂−x₁)/W · h = (y₂−y₁)/H</> },
      ],
      teoria: (
        <>
          <p>
            <b>Detectores de dois estágios</b> (família R-CNN, Girshick et al., 2014) primeiro propõem algumas centenas ou milhares de regiões candidatas e depois passam cada região por uma CNN que
            classifica e ajusta a caixa. O Faster R-CNN trocou a busca seletiva por uma rede de propostas, mas a ideia de dois passos continua.
          </p>
          <p>
            <b>Detectores de um estágio</b> (YOLO, Redmon et al., 2016) olham a imagem uma única vez: a rede divide a imagem numa grade e, em cada célula, prevê caixas, classe e confiança. Um YOLO
            moderno tem três partes:
          </p>
          <ol>
            <li><b>Backbone</b>: a CNN que transforma pixels em mapas de características (o "olho").</li>
            <li><b>Neck</b>: combina mapas de resoluções diferentes, para enxergar cacho grande e baga pequena (P3, P4, P5).</li>
            <li><b>Heads</b>: em cada posição de cada mapa, devolvem a caixa, a classe e a confiança.</li>
          </ol>
          <p>
            A <b>U-Net</b> (Ronneberger et al., 2015) é a referência para segmentação: um codificador que encolhe a imagem e um decodificador que volta ao tamanho original, com{' '}
            <Term def="ligações que copiam os mapas do codificador direto para o decodificador, para recuperar o detalhe espacial perdido na redução">conexões de atalho</Term> entre os dois lados.
          </p>
          <p><b>Formatos de caixa.</b> O mesmo retângulo aparece escrito de três jeitos, e confundir um com o outro é o erro mais comum do primeiro treino:</p>
          <ol>
            <li><b>xyxy</b> (Pascal VOC, OpenCV): canto superior esquerdo e canto inferior direito, em pixels.</li>
            <li><b>COCO</b>: canto superior esquerdo, largura e altura, em pixels.</li>
            <li><b>YOLO</b>: um arquivo <code>.txt</code> por imagem, uma linha por objeto: <code>classe x_centro y_centro largura altura</code>, tudo dividido pelo tamanho da imagem (entre 0 e 1).</li>
          </ol>
        </>
      ),
      exemplo: (
        <>
          <Fig n="rcnn_vs_yolo" cap="À esquerda, as regiões candidatas que o primeiro estágio do R-CNN gera nesta foto real (busca seletiva do OpenCV). À direita, a grade do YOLO e as caixas anotadas no WGISD." />
          <Fig n="unet_cwfid" cap="A saída que uma U-Net aprende no CWFID: cada pixel vira cenoura, daninha ou fundo. Rótulos reais do banco." />
          <Fig n="grade_yolo" cap="Grade 8×8 sobre um vinhedo de Sauvignon Blanc. A célula azul contém o centro do cacho e é a responsável por prevê-lo." />
          <Fig n="formatos_caixa" cap="Um cacho de Cabernet Franc com a caixa escrita nos três formatos. Confira a conta no conversor abaixo." />
          <Callout kind="pegadinha">
            <p>No YOLO a coordenada é do <b>centro</b>, não do canto. Se você exportar xyxy normalizado e chamar de YOLO, o treino roda sem erro e o mAP fica perto de zero.</p>
          </Callout>
        </>
      ),
      pratica: (
        <>
          <p><b>No quadro (10 min).</b> Numa imagem de 1280 × 720, um boi ocupa de (400, 200) até (560, 330). Escreva a caixa em COCO e em YOLO, classe 0. Depois confira no conversor.</p>
          <LabConversor />
          <Code title="Python · conversão" code={`def xyxy_para_yolo(x1, y1, x2, y2, W, H):
    return ((x1 + x2) / 2 / W, (y1 + y2) / 2 / H, (x2 - x1) / W, (y2 - y1) / H)

def yolo_para_xyxy(xc, yc, w, h, W, H):
    return ((xc - w / 2) * W, (yc - h / 2) * H, (xc + w / 2) * W, (yc + h / 2) * H)

print(xyxy_para_yolo(400, 200, 560, 330, 1280, 720))   # (0.375, 0.3681, 0.125, 0.1806)`} />
        </>
      ),
    },
    /* ------------------------------------------------------------ 1.3 */
    {
      id: 'b13',
      cod: '1.3',
      titulo: 'IoU, NMS, GSD e primeira inferência',
      min: 35,
      tipo: 'conceito',
      slides: [
        { titulo: 'IoU: quanto as caixas concordam', img: 'iou_exemplos', formula: <>IoU = área(A ∩ B) / área(A ∪ B)</>, pontos: ['1 = idênticas, 0 = sem contato', 'Acerto (TP) se IoU ≥ limiar, em geral 0,5'] },
        { titulo: 'Objeto pequeno sofre mais', img: 'iou_pequeno', pontos: ['O mesmo erro de 10 px custa pouco num cacho e tudo numa baga', 'Por isso a resolução (GSD) importa tanto'] },
        { titulo: 'NMS: uma caixa por objeto', img: 'nms_antes_depois', pontos: ['1. descarta caixas com confiança < conf', '2. ordena pela confiança', '3. mantém a melhor e apaga as que têm IoU > iou com ela', '4. repete'] },
        { titulo: 'GSD: quantos centímetros cabem num pixel', img: 'gsd_resolucao', formula: <>GSD = (altura de voo × tamanho do pixel do sensor) / distância focal</> },
      ],
      teoria: (
        <>
          <p>
            <b>IoU</b> (intersection over union) mede a concordância entre duas caixas: a área de interseção dividida pela área da união. É com ele que se decide se uma caixa prevista "acertou" a
            caixa anotada. O limiar mais usado é 0,5 (o "50" do mAP50).
          </p>
          <p>
            A rede devolve muitas caixas por objeto, todas um pouco deslocadas. O <b>NMS</b> (non maximum suppression) limpa essa saída: ordena pela confiança, mantém a melhor, apaga as que se sobrepõem
            a ela acima de um limiar de IoU e repete. Dois botões mandam no resultado:
          </p>
          <ol>
            <li><code>conf</code>: confiança mínima. Alto demais perde objeto (falso negativo); baixo demais aceita sujeira (falso positivo).</li>
            <li><code>iou</code> do NMS: alto demais deixa duplicatas; baixo demais apaga cachos encostados que são objetos diferentes.</li>
          </ol>
          <p>
            <b>GSD</b> (ground sample distance) é o tamanho no chão de um pixel. Com um drone a 30 m e GSD de 1 cm, um cacho de 15 cm tem 15 pixels. Subir para 120 m deixa o mesmo cacho com 4 pixels,
            e aí nenhuma rede encontra. O YOLO26 e alguns modelos recentes dispensam o NMS na saída, mas o conceito continua no centro da avaliação.
          </p>
        </>
      ),
      exemplo: (
        <>
          <Fig n="iou_exemplos" cap="Três caixas previstas sobre o mesmo cacho do WGISD. Só a primeira passa no limiar de 0,5." />
          <Fig n="iou_pequeno" cap="O mesmo deslocamento de 10 px num objeto de 200 px e num de 24 px." />
          <Fig n="nms_antes_depois" cap="Saída bruta de um detector (simulada sobre os cachos reais anotados) antes e depois do limiar de confiança e do NMS." />
          <Fig n="gsd_resolucao" cap="O mesmo cacho reduzido 4, 8 e 16 vezes: é o que acontece ao subir o drone ou ao treinar com imgsz pequeno." />
        </>
      ),
      pratica: (
        <>
          <p><b>À mão (5 min).</b> Caixa real (100, 100, 200, 200), prevista (150, 120, 250, 220). Calcule o IoU. (Resposta: interseção 50 × 80 = 4000; união 10000 + 10000 − 4000 = 16000; IoU = 0,25.)</p>
          <LabIoU />
          <LabNMS />
          <p><b>No Colab (10 min).</b> Primeira inferência com um modelo pré-treinado no COCO sobre uma foto do WGISD. O COCO não tem a classe "uva": observe o que o modelo inventa e com que confiança.</p>
          <Code code={`!pip -q install ultralytics
!wget -q https://raw.githubusercontent.com/thsant/wgisd/master/data/CDY_2017.jpg
from ultralytics import YOLO
modelo = YOLO("yolo11n.pt")            # pesos do COCO: 80 classes, nenhuma é uva
r = modelo.predict("CDY_2017.jpg", conf=0.25, iou=0.5)[0]
for c, s, b in zip(r.boxes.cls, r.boxes.conf, r.boxes.xyxy):
    print(modelo.names[int(c)], round(float(s), 2), b.round().tolist())
r.show()`} />
          <Callout kind="prof"><p>O modelo costuma achar "broccoli", "apple" ou nada. Use isso para abrir o intervalo: por que precisamos anotar o nosso próprio banco?</p></Callout>
        </>
      ),
    },
    /* ------------------------------------------------------------ 1.4 */
    {
      id: 'b14',
      cod: '1.4',
      titulo: 'Engenharia de anotação no CVAT',
      min: 45,
      tipo: 'conceito',
      slides: [
        { titulo: 'Três pessoas, três verdades', img: 'ambiguidade_anotacao', pontos: ['Caixa justa ou folgada?', 'Cacho encostado é um objeto ou dois?', 'Cacho cortado pela borda entra?', 'Sem guia de anotação, o modelo aprende a média das dúvidas'] },
        { titulo: 'Guia de anotação da turma', pontos: ['Definição de cada classe com 2 fotos de exemplo', 'Regra de borda: caixa justa no contorno visível', 'Oclusão: anota se ≥ 30% visível', 'Objetos encostados: uma caixa por objeto', 'Casos-limite registrados com print'] },
        { titulo: 'CVAT: projeto → tarefa → job', pontos: ['Projeto guarda as classes (labels)', 'Tarefa recebe as imagens e é dividida em jobs', 'Cada job tem anotador e revisor', 'Export: "Ultralytics YOLO Detection" ou "YOLO 1.1"'] },
      ],
      teoria: (
        <>
          <p>
            Anotar é medir, e toda medida precisa de protocolo. Dois anotadores sem regra comum produzem caixas diferentes para o mesmo cacho, e a rede aprende essa incerteza. O resultado aparece como
            teto de mAP que nenhum hiperparâmetro sobe.
          </p>
          <p>Um <b>guia de anotação</b> responde, com exemplos visuais, pelo menos:</p>
          <ol>
            <li>O que é cada classe e o que <i>não</i> é (cacho de uva × folha seca × sombra).</li>
            <li>Onde a caixa encosta: no contorno visível, sem folga.</li>
            <li>O que fazer com objeto ocluído, cortado pela borda, borrado ou muito pequeno.</li>
            <li>Objetos encostados: um por caixa, mesmo quando é difícil separar.</li>
          </ol>
          <p>
            No <b>CVAT</b> (cvat.ai), o trabalho se organiza em <b>projeto</b> (onde ficam as classes), <b>tarefa</b> (um lote de imagens) e <b>job</b> (a fatia de um anotador). Ferramentas úteis: retângulo
            (detecção), polígono e pincel (segmentação), tag (classificação) e a interpolação entre quadros para vídeo. A exportação escolhe o formato; para o Ultralytics, use "Ultralytics YOLO
            Detection" ou "YOLO 1.1" e confira a versão do CVAT antes da aula.
          </p>
        </>
      ),
      exemplo: (
        <>
          <Fig n="ambiguidade_anotacao" cap="Três critérios diferentes na mesma foto do WGISD. O anotador A segue o guia do banco original; B e C são os erros mais comuns em turma." />
          <Callout kind="campo"><p>O WGISD foi anotado por especialistas da Embrapa com regra explícita para cachos ocluídos e encostados. Leia a seção de anotação do artigo de Santos et al. (2020) antes de escrever o guia da dupla.</p></Callout>
        </>
      ),
      pratica: (
        <>
          <ol>
            <li><b>Rodada cega (10 min).</b> Cada um anota as mesmas 3 fotos no CVAT, sem combinar nada.</li>
            <li><b>Comparação (10 min).</b> Projetar as anotações lado a lado. Onde divergiram?</li>
            <li><b>Guia da turma (15 min).</b> Escrever juntos as regras e colar 1 print de cada caso-limite.</li>
            <li><b>Demonstração (10 min).</b> Criar projeto, tarefa e job no CVAT; exportar e abrir o zip.</li>
          </ol>
          <Code title="estrutura esperada depois do export" code={`dataset/
  data.yaml           # path, train, val, test, names
  images/train/*.jpg
  images/val/*.jpg
  labels/train/*.txt  # um por imagem, mesmo nome
  labels/val/*.txt`} />
        </>
      ),
    },
    /* ------------------------------------------------------------ 1.5 */
    {
      id: 'b15',
      cod: '1.5',
      titulo: 'Laboratório 1: anotação, auditoria e divisão segura',
      min: 50,
      tipo: 'lab',
      slides: [
        { titulo: 'Auditar antes de treinar', img: 'auditoria_rotulos', pontos: ['Toda imagem tem .txt? Todo .txt tem imagem?', 'Classe existe no data.yaml?', 'Coordenadas entre 0 e 1, largura e altura > 0?', 'Caixas duplicadas (IoU > 0,9 na mesma imagem)?'] },
        { titulo: 'Dividir por grupo, não por foto', img: 'split_por_grupo', pontos: ['Fotos do mesmo voo, dia ou talhão são quase cópias', 'Se caem em treino e teste, a nota do teste mente', 'Regra: o grupo inteiro vai para um só conjunto'] },
      ],
      teoria: (
        <>
          <p>
            Um banco anotado tem erros, sempre. A <b>auditoria</b> procura os que quebram o treino em silêncio: imagem sem rótulo, rótulo sem imagem, classe que não existe, coordenada fora de [0, 1],
            caixa de largura zero e duplicatas.
          </p>
          <p>
            O erro metodológico mais grave, porém, é o <b>vazamento</b>. Fotos tiradas em sequência no mesmo voo, ou do mesmo talhão no mesmo dia, são quase iguais. Se a divisão é aleatória por foto,
            irmãs gêmeas caem no treino e no teste, e o modelo é avaliado em imagens que, na prática, já viu. A solução é dividir por <b>grupo de coleta</b>: voo, dia, talhão, propriedade ou variedade.
          </p>
        </>
      ),
      exemplo: (
        <>
          <Fig n="auditoria_rotulos" cap="Três erros inseridos de propósito numa foto do WGISD: uma duplicata, uma classe inexistente e uma caixa que sai da imagem." />
          <Fig n="split_por_grupo" cap="Fotos reais das cinco variedades do WGISD. Na divisão por grupo, cada variedade inteira vai para treino, validação ou teste." />
          <LabSplit />
        </>
      ),
      pratica: (
        <>
          <p>Em duplas, no notebook da aula (seções 4 a 6):</p>
          <ol>
            <li>Anotar 15 fotos novas no CVAT seguindo o guia da turma, com revisão cruzada pela outra dupla.</li>
            <li>Rodar o auditor de rótulos no export e corrigir o que ele apontar.</li>
            <li>Dividir por variedade (ou pelo grupo que a dupla escolher) e provar, com código, que nenhum grupo aparece em dois conjuntos.</li>
          </ol>
          <Code code={`import glob, os, yaml
def auditar(pasta, n_classes):
    problemas = []
    imgs = {os.path.splitext(os.path.basename(f))[0] for f in glob.glob(f"{pasta}/images/*/*")}
    rots = {os.path.splitext(os.path.basename(f))[0]: f for f in glob.glob(f"{pasta}/labels/*/*.txt")}
    problemas += [("sem rótulo", i) for i in imgs - rots.keys()]
    problemas += [("sem imagem", r) for r in rots.keys() - imgs]
    for nome, f in rots.items():
        for k, linha in enumerate(open(f)):
            c, *v = linha.split()
            v = list(map(float, v))
            if not 0 <= int(c) < n_classes: problemas.append(("classe inválida", nome, k))
            if any(x < 0 or x > 1 for x in v): problemas.append(("fora de [0,1]", nome, k))
            if v[2] <= 0 or v[3] <= 0: problemas.append(("caixa vazia", nome, k))
    return problemas`} />
        </>
      ),
    },
    /* ------------------------------------------------------------ 1.6 */
    {
      id: 'b16',
      cod: '1.6',
      titulo: 'Leitura crítica de artigo',
      min: 15,
      tipo: 'leitura',
      slides: [
        { titulo: 'Leitura em formato de banca', pontos: ['Leal et al. (ENIAC 2024): gado contado por drone no Piauí', 'O aumento de dados veio antes ou depois da divisão?', 'Frames do mesmo vídeo ficaram em lados diferentes?', '"mAP" com qual limiar de IoU?', 'Revocação de 90% num rebanho de 500 cabeças: quantos ficam de fora?'] },
      ],
      teoria: (
        <p>
          Ler um artigo de visão computacional é procurar três coisas: <b>como os dados foram divididos</b>, <b>qual métrica foi reportada e com que limiar</b>, e <b>se o teste representa o uso real</b>.
          Resultado alto com teste contaminado não vale nada no campo.
        </p>
      ),
      exemplo: (
        <Caso
          tipo="artigo brasileiro"
          titulo="Automatic Cattle Detection and Counting System in Aerial Images Using Computer Vision Algorithms"
          autores="Leal et al."
          onde="ENIAC 2024, SBC OpenLib"
          link="https://sol.sbc.org.br/index.php/eniac/article/download/33817/33608"
          resumo={<p>Frames de vídeos de drone sobre um pasto no Piauí viraram 120 imagens, rotuladas no Roboflow e ampliadas para 273 com aumento de dados. Um YOLOv9 pré-treinado no COCO foi ajustado no Colab e empacotado numa API de contagem.</p>}
          pipeline={['Frames de vídeo de drone', 'Rótulos no Roboflow', 'Aumento: espelhamento, rotação, recorte, saturação', 'YOLOv9, 100 épocas, imgsz 640', 'API FastAPI + Docker']}
          numeros={[{ v: '120', l: 'imagens originais' }, { v: '273', l: 'com aumento' }, { v: '88,5%', l: 'mAP' }, { v: '90%', l: 'revocação' }]}
          discutir={[
            'O aumento foi feito antes ou depois de separar treino e teste?',
            'Frames do mesmo vídeo foram separados em conjuntos diferentes?',
            'Que diferença faz o mAP ser mAP50 ou mAP50-95?',
            'Que informação a mais vocês pediriam para acreditar no número?',
          ]}
        />
      ),
      pratica: <p>Cada dupla escreve duas perguntas de banca para o artigo e uma informação que faltou. Leitura de 2 duplas em voz alta.</p>,
    },
  ],
  artigos: [
    { tag: 'banco usado na aula', ref: 'Santos, T. T.; de Souza, L. L.; dos Santos, A. A.; Avila, S. (2020). Grape detection, segmentation, and tracking using deep neural networks and three-dimensional association. Computers and Electronics in Agriculture, 170, 105247.', link: 'https://doi.org/10.1016/j.compag.2020.105247', porque: 'Embrapa Informática Agropecuária. Origem do WGISD: 300 fotos de 5 variedades de uva, com caixas e máscaras. Compara Mask R-CNN, YOLOv2 e YOLOv3 e rastreia cachos em vídeo.' },
    { tag: 'banco usado na aula', ref: 'Haug, S.; Ostermann, J. (2014). A Crop/Weed Field Image Dataset for the Evaluation of Computer Vision Based Precision Agriculture Tasks. ECCV Workshops.', link: 'https://github.com/cwfid/dataset', porque: 'O CWFID: fotos de campo de cenoura com máscara por pixel de cultura e daninha. Usado nos exemplos de pipeline clássico e de U-Net.' },
    { tag: 'leitura crítica', ref: 'Leal et al. (2024). Automatic Cattle Detection and Counting System in Aerial Images Using Computer Vision Algorithms. ENIAC, SBC.', link: 'https://sol.sbc.org.br/index.php/eniac/article/download/33817/33608', porque: 'Estudo brasileiro curto e completo, ótimo para treinar o olhar de banca.' },
    { tag: 'arquitetura', ref: 'Redmon, J. et al. (2016). You Only Look Once: Unified, Real-Time Object Detection. CVPR.', link: 'https://arxiv.org/abs/1506.02640', porque: 'O artigo original da grade e do estágio único.' },
    { tag: 'arquitetura', ref: 'Girshick, R. et al. (2014). Rich feature hierarchies for accurate object detection and semantic segmentation. CVPR.', link: 'https://arxiv.org/abs/1311.2524', porque: 'O R-CNN e as regiões candidatas.' },
    { tag: 'arquitetura', ref: 'Ronneberger, O.; Fischer, P.; Brox, T. (2015). U-Net: Convolutional Networks for Biomedical Image Segmentation. MICCAI.', link: 'https://arxiv.org/abs/1505.04597', porque: 'A arquitetura em U com conexões de atalho.' },
    { tag: 'viés nos dados', ref: 'Noyan, M. A. (2022). Uncovering bias in the PlantVillage dataset. arXiv.', link: 'https://arxiv.org/abs/2206.04374', porque: 'Mostra um classificador acertando doença de folha olhando só o fundo da foto: o melhor argumento para auditar dados.' },
  ],
  quiz: [
    { p: 'Você precisa medir a área de cada cacho de uva. Qual tarefa?', o: ['classificação', 'detecção', 'segmentação semântica', 'segmentação de instâncias'], a: 3, e: 'Área por objeto exige uma máscara para cada cacho: instâncias.' },
    { p: 'Imagem 1000 × 500. Caixa xyxy (100, 100, 300, 200). Qual a linha YOLO?', o: ['0 0.1 0.2 0.3 0.4', '0 0.2 0.3 0.2 0.2', '0 200 150 200 100', '0 0.2 0.3 0.3 0.2'], a: 1, e: 'xc = 200/1000, yc = 150/500, w = 200/1000, h = 100/500.' },
    { p: 'Duas caixas 100 × 100, deslocadas 50 px na horizontal. IoU?', o: ['0,50', '0,33', '0,25', '0,67'], a: 1, e: 'Interseção 5000, união 15000.' },
    { p: 'O que acontece ao baixar muito o limiar de IoU do NMS?', o: ['aparecem duplicatas', 'cachos encostados são apagados', 'a confiança sobe', 'nada muda'], a: 1, e: 'Com limiar baixo, qualquer sobreposição apaga a caixa vizinha, mesmo sendo outro objeto.' },
    { p: 'Fotos em sequência de um voo foram divididas aleatoriamente entre treino e teste. O problema é:', o: ['desbalanceamento', 'vazamento', 'overfitting do NMS', 'GSD'], a: 1, e: 'Fotos vizinhas são quase iguais: o teste vira cola.' },
  ],
  entregas: [
    <><b>Guia de anotação da dupla</b>, com pelo menos 5 casos-limite ilustrados com print.</>,
    <><b>Export do CVAT auditado</b>: saída do auditor zerada e o data.yaml conferido.</>,
    <><b>Registro da divisão</b>: qual grupo foi usado e a célula que prova que nenhum grupo aparece em dois conjuntos.</>,
  ],
}
