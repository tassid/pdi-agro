import type { Aula } from '../curso'
import { Fig } from '../curso'
import { Callout, Caso, Code, Term } from '../ui'
import { LabConversor, LabGSD, LabIoU, LabNMS, LabSplit } from '../labs'

export const aula1: Aula = {
  id: 'aula1',
  n: 1,
  titulo: 'Fundamentos de detecção e engenharia de dados',
  ideia: 'Antes de treinar qualquer rede, é preciso saber que pergunta ela responde, como a resposta é escrita e como medir se ela acertou. O resto é dado bem anotado e bem dividido.',
  chips: ['imagem como matriz', 'PDI clássico × aprendizado profundo', 'classificar, detectar, segmentar', 'R-CNN, U-Net, YOLO', 'backbone, neck, heads', 'xyxy, COCO, YOLO, polígono', 'IoU e NMS', 'GSD', 'CVAT', 'auditoria', 'divisão por grupo'],
  objetivos: [
    'Distinguir classificação, detecção, segmentação semântica e de instâncias, e escolher a tarefa certa para um problema do campo pelo custo de anotação.',
    'Explicar a diferença entre detectores de dois estágios (R-CNN) e de um estágio (YOLO), a função de backbone, neck e heads, e para que serve a U-Net.',
    'Converter caixas entre xyxy, COCO e YOLO normalizado, e entender o formato de polígono do YOLO-seg.',
    'Calcular IoU à mão, simular o NMS passo a passo e explicar o efeito dos limiares de confiança e de IoU.',
    'Calcular o GSD de um voo e prever se o objeto terá pixels suficientes na entrada da rede.',
    'Escrever um guia de anotação, anotar no CVAT, auditar os rótulos exportados e descrever o banco com estatísticas.',
    'Dividir um banco de imagens por grupo de coleta sem vazamento entre treino, validação e teste, e provar isso com código.',
  ],
  intervaloDepois: 'b13',
  notebook: {
    nome: 'Aula1_Anotacao_Auditoria_Split.ipynb',
    arquivo: 'Aula1_Anotacao_Auditoria_Split.ipynb',
    descricao: 'Baixa o WGISD (Embrapa), converte formatos, roda um YOLO pré-treinado, calcula IoU e NMS à mão, audita rótulos, descreve o banco e divide por variedade.',
  },
  blocos: [
    /* ============================================================ 1.1 */
    {
      id: 'b11',
      cod: '1.1',
      titulo: 'Do PDI clássico às tarefas de visão',
      min: 25,
      tipo: 'conceito',
      slides: [
        { titulo: 'Para o computador, a foto é uma tabela', img: 'imagem_matriz', pontos: ['Foto de 2048 × 1365 px = 2,8 milhões de pixels', 'Cada pixel tem 3 números de 0 a 255 (R, G, B)', 'Uma foto vira um tensor 1365 × 2048 × 3', 'Tudo o que vem depois é conta nessa tabela'] },
        { titulo: 'Canais de cor separam coisas diferentes', img: 'canais_cor', pontos: ['RGB mistura cor e brilho', 'HSV separa matiz (H), saturação (S) e brilho (V)', 'No PDI clássico, você escolhe o canal', 'Na rede, ela aprende a combinação'] },
        { titulo: 'O pipeline que vocês já conhecem', img: 'pipeline_classico', legenda: 'CWFID: cenoura e daninhas fotografadas em campo', pontos: ['Aquisição → realce → segmentação → rotulação → descritores', 'Cada etapa é uma regra escrita por uma pessoa', 'Funciona quando o problema é "verde contra marrom"'] },
        { titulo: 'A mesma regra num vinhedo', img: 'classico_falha', pontos: ['ExG + Otsu acha folha, não acha cacho de uva verde', 'Trocar de lavoura obriga a reescrever a regra', 'A rede profunda aprende a regra a partir de exemplos'] },
        { titulo: 'Regra escrita × regra aprendida', pontos: ['Clássico: rápido, explicável, pouco dado, quebra fácil', 'Profundo: robusto, precisa de muitos rótulos e GPU', 'TCC da UTFPR (Salvadori, 2020): HSV deu P = 50%, RetinaNet deu P = 99%', 'Os dois convivem: PDI clássico para pré-processar, auditar e explicar'] },
        { titulo: 'Quatro perguntas diferentes sobre a mesma foto', img: 'quatro_tarefas', legenda: 'WGISD, Chardonnay: anotação real de caixas e máscaras', pontos: ['Classificação: o que tem na foto?', 'Detecção: onde está e quantos são?', 'Semântica: qual pixel é uva?', 'Instâncias: qual pixel é de qual cacho?'] },
        { titulo: 'A saída define o rótulo, o rótulo define o orçamento', pontos: ['Classificação: segundos por foto', 'Detecção: 1 a 2 min por foto', 'Semântica: 5 a 15 min por foto', 'Instâncias: a mais cara', 'Escolha a tarefa mais barata que responde à pergunta do produtor'] },
      ],
      teoria: (
        <>
          <p>
            Para o computador uma foto é uma <b>matriz</b>. Uma foto do WGISD tem 2048 × 1365 pixels; cada pixel guarda três números entre 0 e 255, um para cada canal (vermelho, verde, azul). A imagem
            inteira é um tensor de forma <code>(altura, largura, canais) = (1365, 2048, 3)</code>, com 8,4 milhões de números. Tudo o que fizemos em PDI, e tudo o que a rede vai fazer, é conta em cima
            dessa tabela.
          </p>
          <p>
            O <b>pipeline clássico</b> de PDI é <b>aquisição → pré-processamento → segmentação → extração de descritores → classificação</b>. Cada etapa é uma regra escrita por uma pessoa: o índice
            ExG = 2g − r − b realça o verde, o limiar de Otsu escolhe o corte que maximiza a variância entre as classes, a rotulação de componentes conexos dá um número a cada mancha, e descritores
            (área, perímetro, circularidade, cor média) alimentam um classificador. É rápido, explicável e funciona muito bem quando o contraste é simples.
          </p>
          <p>
            O problema aparece quando o contraste some. Num vinhedo de uva branca, o cacho e a folha têm quase a mesma cor: nenhum limiar de ExG separa os dois. Seria preciso inventar descritores de
            textura e forma, ajustar à mão e refazer tudo na próxima variedade. O <b>aprendizado profundo</b> troca a regra escrita por <b>exemplos rotulados</b>: a rede aprende sozinha os filtros (a
            Aula 2 mostra que eles são parentes de Sobel e Laplaciano) e a regra de decisão. O preço muda de lugar: agora a qualidade do modelo é a qualidade dos dados.
          </p>
          <p>Antes de escolher a rede, escolha a pergunta. São quatro tarefas, cada uma com uma saída e um custo de anotação:</p>
          <table className="tbl">
            <thead><tr><th>tarefa</th><th>saída</th><th>rótulo</th><th>custo</th><th>exemplo no campo</th></tr></thead>
            <tbody>
              <tr><td>classificação</td><td>uma classe por imagem</td><td>uma palavra</td><td>segundos</td><td>folha sadia ou com ferrugem</td></tr>
              <tr><td>detecção</td><td>caixas + classe + confiança</td><td>retângulos</td><td>1 a 2 min/foto</td><td>contar cachos, bois, espigas</td></tr>
              <tr><td>segmentação semântica</td><td>classe por pixel</td><td>pintura por pixel</td><td>5 a 15 min/foto</td><td>área de daninha no talhão</td></tr>
              <tr><td>segmentação de instâncias</td><td>máscara por objeto</td><td>polígono por objeto</td><td>o maior</td><td>tamanho de cada cacho</td></tr>
            </tbody>
          </table>
          <p>
            Há ainda tarefas vizinhas que o mesmo framework resolve: <b>estimativa de pose</b> (pontos-chave, por exemplo no corpo do animal), <b>caixas orientadas</b> (OBB, úteis em imagens aéreas
            onde o objeto está inclinado) e <b>rastreamento</b> (detecção + identidade ao longo do vídeo, que vemos na Aula 2).
          </p>
        </>
      ),
      exemplo: (
        <>
          <Fig n="imagem_matriz" cap="Um cacho de Chardonnay do WGISD e os valores RGB reais de um bloco de 8 × 8 pixels. A rede recebe exatamente estes números." />
          <Fig n="canais_cor" cap="Os seis canais de uma foto de Syrah. O cacho escuro se separa no V e no H; no G ele quase some entre as folhas." />
          <Fig n="pipeline_classico" cap="Pipeline clássico numa foto real do CWFID (Haug e Ostermann, 2014): o índice ExG e o limiar de Otsu separam planta de solo e a rotulação conta os objetos." />
          <Fig n="classico_falha" cap="A mesma regra aplicada ao WGISD (Santos et al., 2020). O cacho de uva verde tem a cor da folha: a regra falha e não há limiar que salve." />
          <Caso
            tipo="TCC da UTFPR"
            titulo="Identificação de plantas de milho utilizando imagens aéreas obtidas por VANTs"
            autores="Salvadori"
            onde="Ciência da Computação, UTFPR Ponta Grossa, 2020"
            link="https://repositorio.utfpr.edu.br/jspui/bitstream/1/26481/1/identificacaomilhoimagensaereas.pdf"
            resumo={<p>A mesma pergunta (onde estão as plantas de milho?) resolvida de dois jeitos: com regra escrita (HSV e componentes conexos) e com uma rede detectora (RetinaNet). É a comparação deste bloco num trabalho do nosso curso.</p>}
            pipeline={['Imagens aéreas de VANT sobre lavoura de milho', 'Método 1: limiar em HSV + componentes conexos', 'Método 2: RetinaNet, detector de um estágio', 'Comparação por precisão e revocação']}
            numeros={[{ v: '50,4%', l: 'precisão, HSV' }, { v: '81,6%', l: 'revocação, HSV' }, { v: '99,0%', l: 'precisão, RetinaNet' }, { v: '97,6%', l: 'revocação, RetinaNet' }]}
            discutir={['Por que o método clássico tem revocação razoável e precisão baixa? O que ele está contando a mais?', 'Quanto tempo de anotação a RetinaNet exigiu e o método clássico não?']}
          />
          <Fig n="quatro_tarefas" cap="Uma foto do WGISD, quatro tarefas. As caixas e máscaras são as anotações reais do banco." />
          <Callout kind="campo">
            <p>Quer saber quantos cachos tem na fileira para estimar produção? Detecção basta. Quer o volume de cada cacho? Aí precisa de instâncias, e o custo de anotar multiplica por dez.</p>
          </Callout>
        </>
      ),
      pratica: (
        <>
          <p><b>Dinâmica em duplas (8 min).</b> Para cada problema abaixo, escolham a tarefa e justifiquem pelo custo de anotação. Depois confiram nos exercícios.</p>
          <Code title="Python · a foto como matriz" code={`import numpy as np
from PIL import Image
!wget -q https://raw.githubusercontent.com/thsant/wgisd/master/data/CDY_2017.jpg
img = np.array(Image.open("CDY_2017.jpg"))
print(img.shape, img.dtype)          # (1365, 2048, 3) uint8
print(img[700:703, 300:303])         # 3 x 3 pixels, 3 canais cada
r, g, b = [img[..., k].astype(float) for k in range(3)]
exg = 2 * g - r - b                  # o índice da aula de PDI
print("ExG médio:", exg.mean().round(1))`} />
        </>
      ),
      exercicios: [
        { nivel: 'básico', q: 'Contar frangos mortos num aviário por câmera no teto. Qual tarefa?', r: <p>Detecção: precisa saber onde e quantos, e uma caixa por ave é suficiente. Classificação não conta; segmentação é cara demais para o ganho.</p> },
        { nivel: 'básico', q: 'Medir a porcentagem de área foliar com ferrugem na soja. Qual tarefa?', r: <p>Segmentação semântica: a resposta é uma área, então precisa da classe de cada pixel (lesão × folha × fundo). Não importa separar lesão por lesão.</p> },
        { nivel: 'médio', q: 'Separar grãos de café bons e defeituosos numa esteira, com câmera que fotografa um grão por vez.', r: <p>Classificação: cada imagem tem um único objeto centralizado. Se a câmera visse vários grãos por foto, viraria detecção.</p> },
        { nivel: 'médio', q: 'Uma foto do WGISD tem 2048 × 1365 px em RGB de 8 bits. Quantos bytes ela ocupa descompactada? E reduzida para 640 × 427?', r: <p>2048 × 1365 × 3 = 8.386.560 bytes (cerca de 8 MB). Reduzida: 640 × 427 × 3 = 819.840 bytes. A rede vê 10 vezes menos informação, e é por isso que objetos pequenos sofrem.</p> },
        { nivel: 'desafio', q: 'Um pulverizador precisa aplicar herbicida só sobre a daninha, com bicos espaçados de 25 cm. Detecção ou segmentação? Justifique pela resolução do bico.', r: <p>Com bicos a cada 25 cm, basta saber em qual faixa de 25 cm há daninha: uma caixa (detecção) já dá essa posição, e anotar caixas é muito mais barato. Segmentação só compensaria com bicos de alta resolução ou para estimar dose por área.</p> },
      ],
    },
    /* ============================================================ 1.2 */
    {
      id: 'b12',
      cod: '1.2',
      titulo: 'Arquiteturas e formatos de anotação',
      min: 50,
      tipo: 'conceito',
      slides: [
        { titulo: 'Dois estágios contra um estágio', img: 'rcnn_vs_yolo', pontos: ['R-CNN: propõe regiões, depois classifica cada uma', 'YOLO: uma passada pela rede prevê tudo', 'Hoje a diferença de precisão é pequena; a de velocidade continua grande'] },
        { titulo: 'A família R-CNN em três passos', pontos: ['R-CNN (2014): ~2.000 regiões, uma CNN por região, lento', 'Fast R-CNN (2015): uma CNN na imagem, recorta o mapa de características', 'Faster R-CNN (2015): uma rede de propostas (RPN) substitui a busca seletiva', 'Mask R-CNN (2017): acrescenta uma máscara por objeto'] },
        { titulo: 'U-Net: uma resposta por pixel', img: 'unet_cwfid', pontos: ['Codificador reduz a imagem e entende o contexto', 'Decodificador volta ao tamanho original', 'Conexões de atalho devolvem o detalhe da borda', 'Saída: um mapa de classes do tamanho da foto'] },
        { titulo: 'Como o YOLO divide a imagem', img: 'grade_yolo', pontos: ['A célula que contém o centro do objeto é a responsável', 'Cada célula prevê caixa, classe e confiança', 'Tudo numa passada só: tempo real'] },
        { titulo: 'Backbone, neck e heads', img: 'piramide_p3p5', pontos: ['Backbone: CNN que extrai características', 'Neck: mistura três resoluções (P3, P4, P5)', 'Heads: caixa, classe e confiança em cada posição', 'Stride 8 para pequenos, 32 para grandes'] },
        { titulo: 'Com âncoras e sem âncoras', img: 'ancora_vs_livre', pontos: ['YOLOv2 a v5: ajustam caixas-modelo (âncoras)', 'YOLOv8 em diante: prevê distâncias até as bordas', 'Sem âncoras: menos hiperparâmetros para ajustar ao banco'] },
        { titulo: 'A mesma caixa, três formatos', img: 'formatos_caixa', formula: <>YOLO: x<sub>c</sub> = (x₁+x₂)/2W · y<sub>c</sub> = (y₁+y₂)/2H · w = (x₂−x₁)/W · h = (y₂−y₁)/H</> },
        { titulo: 'Segmentação no formato YOLO', img: 'mascara_poligono', pontos: ['Caixa: classe + 4 números', 'Máscara: um bit por pixel (pesado)', 'YOLO-seg: classe + vértices do polígono normalizados', 'No CVAT: ferramenta de polígono'] },
        { titulo: 'data.yaml: o mapa do banco', formula: <>path · train · val · test · names</>, pontos: ['Um .txt por imagem, mesmo nome, pasta labels/ espelhando images/', 'Imagem sem objeto: .txt vazio (exemplo negativo, ajuda!)', 'Classes numeradas a partir de 0, na mesma ordem do names'] },
      ],
      teoria: (
        <>
          <h4>Dois estágios</h4>
          <p>
            A família <b>R-CNN</b> (Girshick et al., 2014) resolve a detecção em dois passos. Primeiro <b>propõe regiões</b> que talvez contenham objetos (cerca de 2.000, pela busca seletiva, que agrupa
            superpixels parecidos). Depois, cada região é recortada, redimensionada e passa por uma CNN que <b>classifica</b> e <b>ajusta a caixa</b>. A evolução foi tirar trabalho repetido: o Fast
            R-CNN roda a CNN uma vez só na imagem inteira e recorta o mapa de características; o Faster R-CNN troca a busca seletiva por uma rede de propostas (RPN) treinável; o Mask R-CNN acrescenta
            um ramo que pinta a máscara de cada objeto. Santos et al. (2020) usaram o Mask R-CNN no WGISD.
          </p>
          <h4>Um estágio</h4>
          <p>
            O <b>YOLO</b> (Redmon et al., 2016) olha a imagem uma vez só. A ideia original: dividir a imagem numa grade S × S; a célula que contém o centro de um objeto é responsável por ele e prevê
            a caixa (x, y, w, h), a confiança de que há objeto e a probabilidade de cada classe. Um YOLO moderno tem três partes:
          </p>
          <ol>
            <li><b>Backbone</b>: a CNN que transforma pixels em mapas de características, cada vez menores e mais abstratos.</li>
            <li>
              <b>Neck</b>: combina mapas de três resoluções. Com entrada de 640 px, P3 tem stride 8 (grade 80 × 80, boa para objetos pequenos), P4 tem stride 16 (40 × 40) e P5 tem stride 32
              (20 × 20, para objetos grandes).
            </li>
            <li><b>Heads</b>: em cada posição de cada mapa, devolvem a caixa, a classe e a confiança. São 80² + 40² + 20² = 8.400 posições candidatas para uma entrada de 640 × 640.</li>
          </ol>
          <p>
            Até o YOLOv5, cada posição ajustava <b>âncoras</b>: caixas-modelo com proporções fixas, calculadas por k-means sobre o banco. Do YOLOv8 em diante o detector é <b>sem âncoras</b>: cada
            ponto prevê diretamente as distâncias até as quatro bordas (l, t, r, b). Isso tira um hiperparâmetro sensível, porque cacho de uva (alto e estreito) e boi visto de cima (largo) pedem âncoras
            diferentes.
          </p>
          <h4>Segmentação</h4>
          <p>
            A <b>U-Net</b> (Ronneberger et al., 2015) é a referência para segmentação semântica: um <b>codificador</b> que encolhe a imagem e ganha contexto, um <b>decodificador</b> que volta ao tamanho
            original, e <Term def="ligações que copiam os mapas do codificador direto para o decodificador, para recuperar o detalhe espacial perdido na redução">conexões de atalho</Term> entre os dois
            lados para recuperar a borda fina. A saída é um mapa de classes do tamanho da foto, treinado com perda por pixel (entropia cruzada ou Dice).
          </p>
          <h4>Formatos de anotação</h4>
          <p>O mesmo retângulo aparece escrito de três jeitos, e confundir um com o outro é o erro mais comum do primeiro treino:</p>
          <ol>
            <li><b>xyxy</b> (Pascal VOC, OpenCV, saída do Ultralytics): canto superior esquerdo e canto inferior direito, em pixels.</li>
            <li><b>COCO</b>: canto superior esquerdo, largura e altura, em pixels, todas as anotações num único JSON.</li>
            <li><b>YOLO</b>: um <code>.txt</code> por imagem, uma linha por objeto: <code>classe x_centro y_centro largura altura</code>, tudo dividido pelo tamanho da imagem.</li>
            <li><b>YOLO-seg</b>: <code>classe x1 y1 x2 y2 ... xn yn</code>, os vértices do polígono, também normalizados.</li>
          </ol>
          <p>
            <b>Exemplo resolvido.</b> Imagem 2048 × 1365, caixa xyxy (479, 365, 866, 638). Largura = 387, altura = 273. Centro = (672,5; 501,5). YOLO: x<sub>c</sub> = 672,5 / 2048 = 0,3284;
            y<sub>c</sub> = 501,5 / 1365 = 0,3674; w = 387 / 2048 = 0,1890; h = 273 / 1365 = 0,2000. COCO: [479, 365, 387, 273].
          </p>
        </>
      ),
      exemplo: (
        <>
          <Fig n="rcnn_vs_yolo" cap="À esquerda, as regiões candidatas que o primeiro estágio do R-CNN gera nesta foto real (busca seletiva do OpenCV). À direita, a grade do YOLO e as caixas anotadas no WGISD." />
          <Fig n="grade_yolo" cap="Grade 8 × 8 sobre um vinhedo de Sauvignon Blanc. A célula azul contém o centro do cacho e é a responsável por prevê-lo." />
          <Fig n="piramide_p3p5" cap="As três escalas do neck sobre uma foto real reduzida para 640 px. Em amarelo, os cachos que cada escala atende melhor pelo tamanho." />
          <Fig n="ancora_vs_livre" cap="Âncoras (tracejadas) contra a previsão sem âncoras: o ponto amarelo prevê as quatro distâncias até as bordas do cacho." />
          <Fig n="unet_cwfid" cap="A saída que uma U-Net aprende no CWFID: cada pixel vira cenoura, daninha ou fundo. Rótulos reais do banco." />
          <Fig n="formatos_caixa" cap="Um cacho de Cabernet Franc com a caixa escrita nos três formatos. Confira a conta no conversor abaixo." />
          <Fig n="mascara_poligono" cap="A máscara real de um cacho do WGISD convertida em polígono (cv2.findContours + approxPolyDP), que é como o YOLO-seg e o CVAT guardam a segmentação." />
          <Callout kind="pegadinha">
            <p>No YOLO a coordenada é do <b>centro</b>, não do canto. Se você exportar xyxy normalizado e chamar de YOLO, o treino roda sem erro e o mAP fica perto de zero.</p>
          </Callout>
        </>
      ),
      pratica: (
        <>
          <p><b>No quadro (10 min).</b> Faça as conversões dos exercícios à mão e confira no conversor.</p>
          <LabConversor />
          <Code title="Python · conversões" code={`def xyxy_para_yolo(x1, y1, x2, y2, W, H):
    return ((x1 + x2) / 2 / W, (y1 + y2) / 2 / H, (x2 - x1) / W, (y2 - y1) / H)

def yolo_para_xyxy(xc, yc, w, h, W, H):
    return ((xc - w / 2) * W, (yc - h / 2) * H, (xc + w / 2) * W, (yc + h / 2) * H)

def coco_para_yolo(x, y, w, h, W, H):
    return ((x + w / 2) / W, (y + h / 2) / H, w / W, h / H)

print(xyxy_para_yolo(400, 200, 560, 330, 1280, 720))   # (0.375, 0.3681, 0.125, 0.1806)`} />
          <Code title="data.yaml" code={`path: /content/wgisd_yolo
train: images/train
val: images/val
test: images/test
names:
  0: grape`} />
        </>
      ),
      exercicios: [
        { nivel: 'básico', q: 'Imagem 1280 × 720. Um boi ocupa de (400, 200) até (560, 330). Escreva em COCO e em YOLO (classe 0).', r: <p>COCO: [400, 200, 160, 130]. YOLO: 0 0.3750 0.3681 0.1250 0.1806.</p> },
        { nivel: 'básico', q: 'A linha YOLO "0 0.5 0.5 0.2 0.4" numa imagem 1000 × 500. Quais os cantos em pixels?', r: <p>Centro (500, 250), largura 200, altura 200. Cantos: (400, 150) e (600, 350).</p> },
        { nivel: 'médio', q: 'Com entrada 640 × 640 e strides 8, 16 e 32, quantas posições candidatas o detector avalia? E com imgsz 1280?', r: <p>640: 80² + 40² + 20² = 6.400 + 1.600 + 400 = 8.400. Com 1280: 160² + 80² + 40² = 33.600, quatro vezes mais, e cerca de quatro vezes mais cálculo.</p> },
        { nivel: 'médio', q: 'Um aluno exportou "0 0.10 0.20 0.30 0.40" achando que era YOLO, mas eram os cantos x1 y1 x2 y2 normalizados. Qual era a caixa YOLO correta?', r: <p>xc = (0,10 + 0,30)/2 = 0,20; yc = (0,20 + 0,40)/2 = 0,30; w = 0,20; h = 0,20. Linha correta: 0 0.20 0.30 0.20 0.20. A caixa errada fica deslocada e o dobro do tamanho.</p> },
        { nivel: 'desafio', q: 'Por que um detector de dois estágios tende a ir melhor em objetos pequenos e raros, e por que mesmo assim o YOLO domina na lavoura?', r: <p>O segundo estágio olha cada região com mais calma e o desequilíbrio entre fundo e objeto é tratado pelas propostas. Mas na lavoura o modelo roda embarcado (drone, trator, celular) e precisa de tempo real; o YOLO moderno, com neck multiescala, chegou perto em precisão sendo muitas vezes mais rápido.</p> },
      ],
    },
    /* ============================================================ 1.3 */
    {
      id: 'b13',
      cod: '1.3',
      titulo: 'IoU, NMS, GSD e primeira inferência',
      min: 35,
      tipo: 'conceito',
      slides: [
        { titulo: 'IoU: quanto as caixas concordam', img: 'iou_exemplos', formula: <>IoU = área(A ∩ B) / área(A ∪ B)</>, pontos: ['1 = idênticas, 0 = sem contato', 'Acerto (TP) se IoU ≥ limiar, em geral 0,5'] },
        { titulo: 'Conta resolvida', formula: <>A = (100,100,200,200) · B = (150,120,250,220)</>, pontos: ['Interseção: x de 150 a 200, y de 120 a 200 → 50 × 80 = 4.000', 'Áreas: 10.000 cada', 'União: 10.000 + 10.000 − 4.000 = 16.000', 'IoU = 4.000 / 16.000 = 0,25 → não é acerto'] },
        { titulo: 'Objeto pequeno sofre mais', img: 'iou_vs_deslocamento', pontos: ['10 px de erro num objeto de 24 px: IoU cai para 0,2', 'O mesmo erro num cacho de 200 px: IoU 0,8', 'Por isso a resolução (GSD) importa tanto'] },
        { titulo: 'NMS: uma caixa por objeto', img: 'nms_antes_depois', pontos: ['1. descarta caixas com confiança < conf', '2. ordena pela confiança', '3. mantém a melhor e apaga as que têm IoU ≥ iou com ela', '4. repete até a fila acabar'] },
        { titulo: 'NMS passo a passo', img: 'nms_passos' },
        { titulo: 'O limiar de confiança', img: 'conf_limiares', pontos: ['conf baixo: acha tudo e muito lixo', 'conf alto: só certezas, perde cachos', 'O valor certo depende do custo de cada erro'] },
        { titulo: 'GSD: quantos centímetros cabem num pixel', img: 'gsd_resolucao', formula: <>GSD = altura de voo × tamanho do pixel do sensor ÷ distância focal</>, pontos: ['40 m, pixel de 2,4 µm, focal 8,8 mm → 1,1 cm/px', 'Cacho de 15 cm ≈ 14 px na foto', 'Reduzida de 5472 para 640 px: menos de 2 px'] },
        { titulo: 'Primeira inferência: COCO não conhece uva', pontos: ['yolo11n.pt foi treinado em 80 classes urbanas', 'Na foto do vinhedo ele procura "broccoli", "apple" ou nada', 'É a motivação para anotar o nosso banco'] },
      ],
      teoria: (
        <>
          <p>
            <b>IoU</b> (intersection over union, ou índice de Jaccard) mede a concordância entre duas caixas: a área de interseção dividida pela área da união. Vale 1 para caixas idênticas e 0 para
            caixas que não se tocam. É com ele que se decide se uma caixa prevista acertou a anotada: com limiar 0,5 (o "50" do mAP50), IoU ≥ 0,5 é <b>verdadeiro positivo</b> (TP); abaixo disso a
            caixa prevista é <b>falso positivo</b> (FP) e o objeto que ficou sem par é <b>falso negativo</b> (FN).
          </p>
          <p>Para duas caixas xyxy A e B:</p>
          <p className="slide-formula">
            interseção = max(0, min(x₂ᴬ, x₂ᴮ) − max(x₁ᴬ, x₁ᴮ)) × max(0, min(y₂ᴬ, y₂ᴮ) − max(y₁ᴬ, y₁ᴮ)) · IoU = interseção / (área A + área B − interseção)
          </p>
          <p>
            O IoU é implacável com objetos pequenos: o mesmo erro absoluto de 10 pixels leva um cacho de 200 px a IoU 0,82 e uma baga de 24 px a 0,21. Por isso modelos com bom mAP em cachos podem
            ir mal em bagas, insetos ou plântulas.
          </p>
          <p>
            A rede devolve muitas caixas por objeto, todas um pouco deslocadas, porque várias posições vizinhas da grade "veem" o mesmo cacho. O <b>NMS</b> (non maximum suppression) limpa essa saída:
          </p>
          <ol>
            <li>descarta as caixas com confiança abaixo de <code>conf</code>;</li>
            <li>ordena as restantes da maior para a menor confiança;</li>
            <li>pega a primeira, guarda, e apaga todas as que têm IoU ≥ <code>iou</code> com ela;</li>
            <li>repete com a próxima da fila até ela acabar. O NMS é feito por classe.</li>
          </ol>
          <p>
            Dois botões mandam no resultado: <code>conf</code> alto demais perde objeto (FN), baixo demais aceita sujeira (FP); <code>iou</code> do NMS alto demais deixa duplicatas, baixo demais apaga
            cachos encostados que são objetos diferentes. O YOLO26 é treinado para dispensar o NMS na saída (uma previsão por objeto), mas o conceito continua no centro da avaliação.
          </p>
          <p>
            <b>GSD</b> (ground sample distance) é o tamanho no chão de um pixel: GSD = H × p / f, com H a altura de voo, p o tamanho do pixel do sensor e f a distância focal. Exemplo: drone a 40 m,
            pixel de 2,4 µm e focal de 8,8 mm → 40 × 2,4 / 8,8 = 10,9 mm ≈ 1,1 cm/px. Um cacho de 15 cm ocupa uns 14 px na foto. Se a foto de 5472 px for reduzida para <code>imgsz=640</code>, o
            cacho chega à rede com menos de 2 px: impossível detectar.
          </p>
        </>
      ),
      exemplo: (
        <>
          <Fig n="iou_exemplos" cap="Três caixas previstas sobre o mesmo cacho do WGISD. Só a primeira passa no limiar de 0,5." />
          <Fig n="iou_vs_deslocamento" cap="IoU em função do deslocamento para objetos de 24, 64 e 200 pixels." />
          <Fig n="nms_antes_depois" cap="Saída bruta de um detector (simulada sobre os cachos reais anotados) antes e depois do limiar de confiança e do NMS." />
          <Fig n="nms_passos" cap="O algoritmo do NMS executado passo a passo sobre três cachos vizinhos." />
          <Fig n="conf_limiares" cap="O mesmo conjunto de detecções com três limiares de confiança. Verde acerta um cacho real; vermelho é falso positivo." />
          <Fig n="gsd_resolucao" cap="O mesmo cacho reduzido 4, 8 e 16 vezes: é o que acontece ao subir o drone ou ao treinar com imgsz pequeno." />
        </>
      ),
      pratica: (
        <>
          <LabIoU />
          <LabNMS />
          <LabGSD />
          <p><b>No Colab (10 min).</b> Primeira inferência com um modelo pré-treinado no COCO sobre uma foto do WGISD. Observe o que o modelo inventa e com que confiança.</p>
          <Code code={`!pip -q install ultralytics
!wget -q https://raw.githubusercontent.com/thsant/wgisd/master/data/CDY_2017.jpg
from ultralytics import YOLO
modelo = YOLO("yolo11n.pt")            # pesos do COCO: 80 classes, nenhuma é uva
for conf in [0.05, 0.25, 0.5]:
    r = modelo.predict("CDY_2017.jpg", conf=conf, iou=0.5, verbose=False)[0]
    print(conf, [(modelo.names[int(c)], round(float(s), 2)) for c, s in zip(r.boxes.cls, r.boxes.conf)])
r.show()`} />
          <Callout kind="prof"><p>O modelo costuma achar "broccoli", "apple", "potted plant" ou nada. Use isso para abrir o intervalo: por que precisamos anotar o nosso próprio banco?</p></Callout>
        </>
      ),
      exercicios: [
        { nivel: 'básico', q: 'Duas caixas 100 × 100, deslocadas 50 px na horizontal. Qual o IoU?', r: <p>Interseção 50 × 100 = 5.000. União 10.000 + 10.000 − 5.000 = 15.000. IoU = 0,33.</p> },
        { nivel: 'básico', q: 'Caixa prevista inteiramente dentro da real, com metade da área. IoU?', r: <p>Interseção = área da prevista = 0,5A. União = A. IoU = 0,5: passa no limiar 0,5 por um fio.</p> },
        { nivel: 'médio', q: 'Detecções (conf): A 0,9; B 0,8; C 0,7; D 0,3. IoU(A,B) = 0,7; IoU(A,C) = 0,2; IoU(B,C) = 0,6; D sem sobreposição. Com conf = 0,25 e NMS iou = 0,5, quais ficam?', r: <p>Fila: A, B, C, D. Mantém A; apaga B (0,7 ≥ 0,5); C fica (0,2 com A). Próxima: C, mantém. D mantém. Resultado: A, C, D. Note que B não apaga C, porque B já tinha saído.</p> },
        { nivel: 'médio', q: 'Drone a 60 m, pixel de 3,3 µm, focal 10 mm. Qual o GSD? Uma plântula de 5 cm tem quantos pixels?', r: <p>GSD = 60 × 3,3 / 10 = 19,8 mm ≈ 2 cm/px. Plântula de 5 cm ≈ 2,5 px: não dá para detectar. Precisa voar a uns 15 m (0,5 cm/px, 10 px).</p> },
        { nivel: 'desafio', q: 'Num pomar, as copas se encostam muito. O NMS com iou = 0,7 deixa duplicatas; com 0,3 apaga árvores. Proponha uma saída.', r: <p>Opções: usar um limiar intermediário escolhido na validação; usar Soft-NMS (reduz a confiança em vez de apagar); treinar segmentação de instâncias; ou usar um modelo sem NMS (YOLO26). E avaliar pelo erro de contagem, que é o que importa no pomar.</p> },
      ],
    },
    /* ============================================================ 1.4 */
    {
      id: 'b14',
      cod: '1.4',
      titulo: 'Engenharia de anotação no CVAT',
      min: 45,
      tipo: 'conceito',
      slides: [
        { titulo: 'Três pessoas, três verdades', img: 'ambiguidade_anotacao', pontos: ['Caixa justa ou folgada?', 'Cacho encostado é um objeto ou dois?', 'Sem guia, o modelo aprende a média das dúvidas'] },
        { titulo: 'Casos-limite reais', img: 'casos_limite', pontos: ['Cortado pela borda', 'Pequeno, ao fundo', 'Encostados', 'Com folhas na frente'] },
        { titulo: 'Guia de anotação da turma', pontos: ['Definição de cada classe com 2 fotos de exemplo', 'O que NÃO é a classe (folha seca, sombra)', 'Regra de borda: justa no contorno visível', 'Oclusão: anota se ≥ 30% visível', 'Objetos encostados: uma caixa por objeto', 'Fundo distante: ignorar (regra do WGISD)'] },
        { titulo: 'Concordância entre anotadores', formula: <>concordância = média do IoU entre as caixas casadas de A e B</>, pontos: ['Anotar 10 fotos em dupla, sem combinar', 'Casar as caixas por IoU e medir', 'Abaixo de 0,7: o guia está vago'] },
        { titulo: 'CVAT: projeto → tarefa → job', pontos: ['Projeto guarda as classes (labels)', 'Tarefa recebe as imagens e é dividida em jobs', 'Cada job tem anotador e revisor', 'Estados: annotation → validation → acceptance'] },
        { titulo: 'Ferramentas certas para cada tarefa', pontos: ['Retângulo: detecção', 'Polígono e pincel: segmentação', 'Tag: classificação', 'Pontos: contagem e pose', 'Interpolação entre quadros: vídeo', 'Modelos automáticos para pré-anotar e corrigir'] },
        { titulo: 'Exportar sem surpresa', pontos: ['Formato "Ultralytics YOLO Detection" ou "YOLO 1.1"', 'Conferir a versão do CVAT antes da aula', 'Abrir o zip e contar imagens e .txt', 'Rodar o auditor do Lab 1.5 antes de treinar'] },
      ],
      teoria: (
        <>
          <p>
            Anotar é medir, e toda medida precisa de protocolo. Dois anotadores sem regra comum produzem caixas diferentes para o mesmo cacho; a rede aprende essa incerteza e o mAP encontra um teto que
            nenhum hiperparâmetro sobe. Um banco pequeno e consistente costuma valer mais que um banco grande e contraditório.
          </p>
          <p>Um <b>guia de anotação</b> responde, sempre com exemplos visuais:</p>
          <ol>
            <li>O que é cada classe e o que <i>não</i> é (cacho × folha seca × sombra × poste da espaldeira).</li>
            <li>Onde a caixa encosta: no contorno visível, sem folga, sem incluir a folha.</li>
            <li>Oclusão: a partir de quanto visível o objeto é anotado (por exemplo, 30%), e se a caixa cobre a parte visível ou a estimada.</li>
            <li>Objeto cortado pela borda da foto, borrado, ou muito pequeno ao fundo.</li>
            <li>Objetos encostados: um por caixa, mesmo quando é difícil separar.</li>
            <li>Imagens sem objeto: entram no banco com <code>.txt</code> vazio; elas ensinam a rede a não ver cacho onde não há.</li>
          </ol>
          <p>
            Para medir se o guia funciona, use a <b>concordância entre anotadores</b>: duas pessoas anotam as mesmas fotos, as caixas são casadas por IoU e calcula-se o IoU médio e a fração de caixas
            sem par. Se a concordância está baixa, o problema está no guia, não nas pessoas.
          </p>
          <p>
            No <b>CVAT</b> (cvat.ai, código aberto, também instalável no servidor do laboratório), o trabalho se organiza em <b>projeto</b> (onde ficam as classes), <b>tarefa</b> (um lote de imagens) e{' '}
            <b>job</b> (a fatia de um anotador, com etapas de anotação, validação e aceite). Ferramentas: retângulo, polígono, pincel, pontos, tag e interpolação entre quadros de vídeo. Modelos
            automáticos podem pré-anotar, e o humano corrige: muito mais rápido, mas o viés do modelo entra no banco se ninguém revisar.
          </p>
        </>
      ),
      exemplo: (
        <>
          <Fig n="ambiguidade_anotacao" cap="Três critérios diferentes na mesma foto do WGISD. O anotador A segue o guia do banco original; B e C são os erros mais comuns em turma." />
          <Fig n="casos_limite" cap="Casos-limite reais do WGISD com as caixas como o banco as anotou." />
          <Callout kind="campo"><p>O README do WGISD diz que cachos muito ao fundo devem ser ignorados e explica como foram tratadas as oclusões. Leiam essa seção antes de escrever o guia da dupla.</p></Callout>
        </>
      ),
      pratica: (
        <>
          <ol>
            <li><b>Rodada cega (10 min).</b> Cada um anota as mesmas 3 fotos no CVAT, sem combinar nada.</li>
            <li><b>Comparação (10 min).</b> Projetar as anotações lado a lado e medir a concordância com o código abaixo.</li>
            <li><b>Guia da turma (15 min).</b> Escrever juntos as regras e colar 1 print de cada caso-limite.</li>
            <li><b>Demonstração (10 min).</b> Criar projeto, tarefa e job no CVAT; exportar e abrir o zip.</li>
          </ol>
          <Code title="Python · concordância entre dois anotadores" code={`import numpy as np
def ler(f, W, H):
    out = []
    for l in open(f):
        c, xc, yc, w, h = map(float, l.split())
        out.append([(xc - w/2) * W, (yc - h/2) * H, (xc + w/2) * W, (yc + h/2) * H])
    return out

def concordancia(A, B, lim=0.5):
    usados, ious = set(), []
    for a in A:
        cand = [(iou(a, b), j) for j, b in enumerate(B) if j not in usados]
        v, j = max(cand, default=(0, -1))
        if v >= lim: usados.add(j); ious.append(v)
    sem_par = len(A) + len(B) - 2 * len(ious)
    return np.mean(ious) if ious else 0, sem_par`} />
          <Code title="estrutura esperada depois do export" code={`dataset/
  data.yaml           # path, train, val, test, names
  images/train/*.jpg
  labels/train/*.txt  # um por imagem, mesmo nome (vazio = sem objeto)
  images/val/...
  labels/val/...`} />
        </>
      ),
      exercicios: [
        { nivel: 'básico', q: 'Por que imagens sem nenhum objeto devem entrar no banco?', r: <p>Elas ensinam a rede que aquele fundo (folha, solo, poste) não é a classe. Sem negativos, o modelo tende a desenhar caixas em qualquer coisa parecida, e a precisão cai.</p> },
        { nivel: 'médio', q: 'Dois anotadores marcaram 20 e 24 caixas nas mesmas fotos; 18 casaram com IoU médio 0,78. Quantas caixas sem par? O guia está bom?', r: <p>Sem par: 20 + 24 − 2 × 18 = 8. A concordância de posição é boa (0,78), mas 8 caixas sem par indicam dúvida sobre o que anotar (provavelmente cachos ao fundo ou ocluídos). O guia precisa de uma regra mais clara de inclusão.</p> },
        { nivel: 'médio', q: 'A turma usou pré-anotação automática e só corrigiu o que viu errado. Que viés isso pode introduzir?', r: <p>O banco herda o que o modelo automático não vê: se ele erra cachos escuros ou pequenos e ninguém percebe, esses objetos ficam sem rótulo e viram "fundo" para o modelo novo. Revisão obrigatória e amostragem de fotos para conferir do zero ajudam.</p> },
        { nivel: 'desafio', q: 'Escreva a regra do guia para cachos parcialmente atrás de folhas, de modo que duas pessoas cheguem na mesma caixa.', r: <p>Exemplo: "Anotar se pelo menos 30% do cacho está visível. A caixa cobre só a parte visível, do primeiro ao último pixel de baga visível, sem estimar a parte escondida. Se a folha divide o cacho em duas partes visíveis, uma única caixa cobre as duas." O importante é ser verificável por outra pessoa.</p> },
      ],
    },
    /* ============================================================ 1.5 */
    {
      id: 'b15',
      cod: '1.5',
      titulo: 'Laboratório 1: anotação, auditoria e divisão segura',
      min: 50,
      tipo: 'lab',
      slides: [
        { titulo: 'Auditar antes de treinar', img: 'auditoria_rotulos', pontos: ['Toda imagem tem .txt? Todo .txt tem imagem?', 'Classe existe no data.yaml?', 'Coordenadas entre 0 e 1, largura e altura > 0?', 'Caixas duplicadas (IoU > 0,9 na mesma imagem)?'] },
        { titulo: 'Conheça o banco antes de treinar', img: 'estatisticas_banco', pontos: ['Quantos objetos por foto?', 'Que fração da foto o objeto ocupa? (define imgsz)', 'Onde ficam os centros? (viés de posição)', 'Qual a proporção das caixas?'] },
        { titulo: 'Fotos vizinhas são quase gêmeas', img: 'quase_iguais', pontos: ['Mesma sessão, mesma luz, mesmas plantas', 'Correlação de cor perto de 1', 'Uma no treino e a outra no teste = cola'] },
        { titulo: 'Dividir por grupo, não por foto', img: 'split_por_grupo', pontos: ['Grupo = voo, dia, talhão, propriedade, variedade', 'O grupo inteiro vai para um só conjunto', 'Treino 70%, validação 15%, teste 15% dos grupos'] },
        { titulo: 'Para que serve cada conjunto', pontos: ['Treino: ajusta os pesos', 'Validação: escolhe época, hiperparâmetros, limiares', 'Teste: aberto uma vez, no fim, para o número do artigo', 'Teste usado para decidir vira validação, e o resultado fica otimista'] },
      ],
      teoria: (
        <>
          <p>
            Um banco anotado tem erros, sempre. A <b>auditoria</b> procura os que quebram o treino em silêncio: imagem sem rótulo, rótulo sem imagem, classe que não existe, coordenada fora de [0, 1],
            caixa de largura zero, duplicatas e imagens corrompidas. O Ultralytics avisa sobre alguns ao montar o cache, mas descarta rótulos ruins sem parar o treino: é fácil treinar com metade do
            banco sem perceber.
          </p>
          <p>
            Depois de auditar, <b>descreva o banco</b>: objetos por foto, distribuição de tamanho das caixas (que fração da foto o objeto ocupa), posição dos centros e proporção largura/altura. Esses
            números decidem o <code>imgsz</code>, o uso de fatiamento e o augmentation.
          </p>
          <p>
            O erro metodológico mais grave é o <b>vazamento</b> (data leakage). Fotos tiradas em sequência no mesmo voo, ou do mesmo talhão no mesmo dia, são quase iguais. Se a divisão é aleatória por
            foto, irmãs gêmeas caem no treino e no teste, e o modelo é avaliado em imagens que, na prática, já viu. O resultado é otimista e não se repete na fazenda seguinte. A solução é dividir por{' '}
            <b>grupo de coleta</b>: voo, dia, talhão, propriedade ou variedade. Ao escrever o artigo, declare o critério de divisão; banca boa pergunta isso primeiro.
          </p>
          <p>
            Por último, os três conjuntos têm papéis diferentes. <b>Treino</b> ajusta os pesos. <b>Validação</b> escolhe tudo o que é decisão humana: época de parada, hiperparâmetros, limiar de
            confiança. <b>Teste</b> é aberto uma vez, no fim. Se você olhou o teste para escolher alguma coisa, ele virou validação.
          </p>
        </>
      ),
      exemplo: (
        <>
          <Fig n="auditoria_rotulos" cap="Três erros inseridos de propósito numa foto do WGISD: uma duplicata, uma classe inexistente e uma caixa que sai da imagem." />
          <Fig n="estatisticas_banco" cap="Estatísticas de 64 fotos e 924 caixas reais do WGISD. Os cachos ocupam em geral menos de 2% da foto e são mais altos que largos." />
          <Fig n="quase_iguais" cap="Duas fotos de Chardonnay da mesma sessão contra uma de Syrah: a correlação do histograma de cor mostra o quanto fotos vizinhas são parecidas." />
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
            <li>Gerar as estatísticas do banco e decidir um <code>imgsz</code> justificado.</li>
            <li>Dividir por variedade (ou pelo grupo que a dupla escolher) e provar, com código, que nenhum grupo aparece em dois conjuntos.</li>
          </ol>
          <Code code={`import glob, os
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
      exercicios: [
        { nivel: 'básico', q: 'Por que não basta embaralhar as 300 fotos do WGISD e separar 70/15/15?', r: <p>Fotos da mesma variedade e sessão são quase iguais; o embaralhamento coloca irmãs gêmeas no treino e no teste. O teste mede memória, não generalização.</p> },
        { nivel: 'médio', q: 'O banco tem 12 voos sobre 4 fazendas. Proponha uma divisão sem vazamento e diga o que cada conjunto mede.', r: <p>Por exemplo: voos de 3 fazendas no treino e na validação (separados por voo), e a 4ª fazenda inteira no teste. A validação mede generalização para outro voo; o teste mede generalização para outra propriedade, que é o uso real.</p> },
        { nivel: 'médio', q: 'As estatísticas mostram caixas com mediana de 1% da área de fotos 2048 × 1365. Com imgsz 640, quantos pixels tem o lado de um cacho típico na entrada?', r: <p>1% da área ≈ lado de 10% de cada dimensão (se fosse quadrado): cerca de 205 × 137 px na foto. Reduzindo 3,2 vezes: cerca de 64 × 43 px. Dá para detectar; bagas, não.</p> },
        { nivel: 'desafio', q: 'Um colega fez augmentation (espelhamento) em todas as fotos e depois dividiu aleatoriamente. Por que isso é ainda pior que vazamento por fotos vizinhas?', r: <p>A foto e sua versão espelhada são a mesma cena; se caem em lados diferentes, o teste contém literalmente imagens do treino. O augmentation tem que ser aplicado só no treino, depois da divisão, como o Ultralytics faz durante o treino.</p> },
      ],
    },
    /* ============================================================ 1.6 */
    {
      id: 'b16',
      cod: '1.6',
      titulo: 'Leitura crítica de artigo',
      min: 15,
      tipo: 'leitura',
      slides: [
        { titulo: 'Três perguntas para qualquer artigo', pontos: ['Como os dados foram divididos? Por grupo?', 'Qual métrica e com que limiar de IoU?', 'O teste representa o uso real?'] },
        { titulo: 'Leitura em formato de banca', pontos: ['Leal et al. (ENIAC 2024): gado contado por drone no Piauí', 'O aumento de dados veio antes ou depois da divisão?', 'Frames do mesmo vídeo ficaram em lados diferentes?', '"mAP" com qual limiar de IoU?', 'Revocação de 90% num rebanho de 500 cabeças: quantos ficam de fora?'] },
        { titulo: 'Leitura extra da casa', pontos: ['Algeri et al. (2018), Revista de Computação Aplicada ao Agronegócio, UTFPR Medianeira', 'Densidade de aves em aviário com classificadores Haar e LBP', 'Compare com o que um YOLO faria hoje'] },
      ],
      teoria: (
        <p>
          Ler um artigo de visão computacional é procurar três coisas: <b>como os dados foram divididos</b>, <b>qual métrica foi reportada e com que limiar</b>, e <b>se o teste representa o uso real</b>.
          Resultado alto com teste contaminado não vale nada no campo. Use a ficha de leitura crítica da seção de artigos para cada trabalho.
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
      pratica: <p>Cada dupla escreve duas perguntas de banca para o artigo e uma informação que faltou. Leitura de 2 duplas em voz alta. Para casa, a dupla escolhe um artigo da lista e preenche a ficha.</p>,
      exercicios: [
        { nivel: 'médio', q: 'O artigo reporta revocação de 90%. Num rebanho de 500 cabeças, quantos animais ficam fora da contagem? E se a precisão for 96%, quantas caixas falsas?', r: <p>FN = 10% de 500 = 50 animais. Com 450 TP e precisão 0,96: TP + FP = 450 / 0,96 ≈ 469, então FP ≈ 19. A contagem final seria 469: erro de 31 cabeças (6%), mesmo com métricas que parecem altas.</p> },
      ],
    },
  ],
  artigos: [
    { tag: 'banco usado na aula', br: true, ref: 'Santos, T. T.; de Souza, L. L.; dos Santos, A. A.; Avila, S. (2020). Grape detection, segmentation, and tracking using deep neural networks and three-dimensional association. Computers and Electronics in Agriculture, 170, 105247.', link: 'https://doi.org/10.1016/j.compag.2020.105247', porque: 'Embrapa Informática Agropecuária. Origem do WGISD: 300 fotos de 5 variedades de uva, com caixas e máscaras. Compara Mask R-CNN e YOLO e rastreia cachos em vídeo.', perguntas: ['Como o banco foi dividido em treino e teste? Por foto ou por grupo?', 'Que regra de anotação foi usada para cachos ao fundo e ocluídos?', 'Que métricas foram usadas para detecção e para segmentação?'] },
    { tag: 'TCC da UTFPR', br: true, ref: 'Salvadori (2020). Identificação de plantas de milho utilizando imagens aéreas obtidas por VANTs. TCC, Ciência da Computação, UTFPR Ponta Grossa.', link: 'https://repositorio.utfpr.edu.br/jspui/bitstream/1/26481/1/identificacaomilhoimagensaereas.pdf', porque: 'PDI clássico (HSV e componentes conexos) contra RetinaNet na mesma lavoura. Liga o bloco 1.1 a todo o resto.', perguntas: ['Quantas imagens foram anotadas e quanto tempo isso levou?', 'O teste veio de outra área do voo?', 'Por que a precisão do método clássico é tão baixa?'] },
    { tag: 'revista da UTFPR Medianeira', br: true, ref: 'Algeri, Becker-Algeri, Abreu e Paula Filho (2018). Desenvolvimento de ferramenta não invasiva para cálculo de densidade de aves em aviários comerciais. Revista de Computação Aplicada ao Agronegócio, v. 1, n. 2.', link: 'https://periodicos.utfpr.edu.br/rcaa/article/download/9396/6139', porque: 'Detecção de aves com classificadores Haar e LBP em câmeras infravermelhas. Ótimo para comparar o detector clássico com um YOLO.', perguntas: ['Que descritores substituem as camadas convolucionais aqui?', 'Como o erro foi medido? Por contagem ou por caixa?'] },
    { tag: 'leitura crítica', br: true, ref: 'Leal et al. (2024). Automatic Cattle Detection and Counting System in Aerial Images Using Computer Vision Algorithms. ENIAC, SBC.', link: 'https://sol.sbc.org.br/index.php/eniac/article/download/33817/33608', porque: 'Estudo brasileiro curto e completo, ótimo para treinar o olhar de banca.' },
    { tag: 'detecção no agro', br: true, ref: 'Osco, L. P. et al. (2020). A convolutional neural network approach for counting and geolocating citrus-trees in UAV multispectral imagery. ISPRS Journal of Photogrammetry and Remote Sensing, 160, 97-106.', link: 'https://doi.org/10.1016/j.isprsjprs.2019.12.010', porque: 'Contagem e geolocalização de laranjeiras em pomar denso a partir de drone multiespectral (UNESP, UFMS). Mostra quando a contagem por densidade vence o detector de caixas.', perguntas: ['Por que caixas e NMS sofrem num pomar denso?', 'Que bandas espectrais entraram na rede?'] },
    { tag: 'arquitetura', ref: 'Redmon, J. et al. (2016). You Only Look Once: Unified, Real-Time Object Detection. CVPR.', link: 'https://arxiv.org/abs/1506.02640', porque: 'O artigo original da grade e do estágio único.' },
    { tag: 'arquitetura', ref: 'Girshick, R. et al. (2014). Rich feature hierarchies for accurate object detection and semantic segmentation. CVPR.', link: 'https://arxiv.org/abs/1311.2524', porque: 'O R-CNN e as regiões candidatas.' },
    { tag: 'arquitetura', ref: 'Ronneberger, O.; Fischer, P.; Brox, T. (2015). U-Net: Convolutional Networks for Biomedical Image Segmentation. MICCAI.', link: 'https://arxiv.org/abs/1505.04597', porque: 'A arquitetura em U com conexões de atalho.' },
    { tag: 'banco usado na aula', ref: 'Haug, S.; Ostermann, J. (2014). A Crop/Weed Field Image Dataset for the Evaluation of Computer Vision Based Precision Agriculture Tasks. ECCV Workshops.', link: 'https://github.com/cwfid/dataset', porque: 'O CWFID: fotos de campo de cenoura com máscara por pixel de cultura e daninha.' },
    { tag: 'viés nos dados', ref: 'Noyan, M. A. (2022). Uncovering bias in the PlantVillage dataset. arXiv:2206.04374.', link: 'https://arxiv.org/abs/2206.04374', porque: 'Um modelo treinado só com 8 pixels do fundo das fotos acertou 49% das 38 classes de doença (o chute daria 2,6%). O melhor argumento para auditar dados.', perguntas: ['O que é viés de captura?', 'Como evitar isso no banco da dupla?'] },
  ],
  quiz: [
    { p: 'Você precisa medir a área de cada cacho de uva. Qual tarefa?', o: ['classificação', 'detecção', 'segmentação semântica', 'segmentação de instâncias'], a: 3, e: 'Área por objeto exige uma máscara para cada cacho: instâncias.' },
    { p: 'Imagem 1000 × 500. Caixa xyxy (100, 100, 300, 200). Qual a linha YOLO?', o: ['0 0.1 0.2 0.3 0.4', '0 0.2 0.3 0.2 0.2', '0 200 150 200 100', '0 0.2 0.3 0.3 0.2'], a: 1, e: 'xc = 200/1000, yc = 150/500, w = 200/1000, h = 100/500.' },
    { p: 'Duas caixas 100 × 100, deslocadas 50 px na horizontal. IoU?', o: ['0,50', '0,33', '0,25', '0,67'], a: 1, e: 'Interseção 5000, união 15000.' },
    { p: 'Qual escala do neck atende melhor um objeto de 20 px numa entrada de 640?', o: ['P3 (stride 8)', 'P4 (stride 16)', 'P5 (stride 32)', 'tanto faz'], a: 0, e: 'Com stride 32, um objeto de 20 px cabe em menos de uma célula. P3 tem grade 80 × 80.' },
    { p: 'O que acontece ao baixar muito o limiar de IoU do NMS?', o: ['aparecem duplicatas', 'cachos encostados são apagados', 'a confiança sobe', 'nada muda'], a: 1, e: 'Com limiar baixo, qualquer sobreposição apaga a caixa vizinha, mesmo sendo outro objeto.' },
    { p: 'Drone a 40 m, pixel de 2,4 µm, focal de 8,8 mm. GSD?', o: ['0,11 cm/px', '1,1 cm/px', '11 cm/px', '4,4 cm/px'], a: 1, e: '40 × 2,4 / 8,8 ≈ 10,9 mm.' },
    { p: 'Fotos em sequência de um voo foram divididas aleatoriamente entre treino e teste. O problema é:', o: ['desbalanceamento', 'vazamento', 'overfitting do NMS', 'GSD'], a: 1, e: 'Fotos vizinhas são quase iguais: o teste vira cola.' },
    { p: 'Para que serve o conjunto de validação?', o: ['ajustar os pesos', 'escolher épocas, hiperparâmetros e limiares', 'reportar o número final', 'aumentar os dados'], a: 1, e: 'O teste fica guardado para o número final.' },
  ],
  entregas: [
    <><b>Guia de anotação da dupla</b>, com pelo menos 5 casos-limite ilustrados com print e a medida de concordância entre os dois anotadores.</>,
    <><b>Export do CVAT auditado</b>: saída do auditor zerada, data.yaml conferido e estatísticas do banco (objetos por foto, tamanho das caixas).</>,
    <><b>Registro da divisão</b>: qual grupo foi usado e a célula que prova que nenhum grupo aparece em dois conjuntos.</>,
    <><b>Ficha de leitura crítica</b> de um artigo da lista, com as três perguntas de banca respondidas.</>,
  ],
}
