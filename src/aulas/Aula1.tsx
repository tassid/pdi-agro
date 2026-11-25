import type { Aula } from '../curso'
import { Fig } from '../curso'
import { Callout, Caso, Code, Term } from '../ui'
import { LabConversor, LabGSD, LabIoU, LabNMS, LabSplit } from '../labs'

export const aula1: Aula = {
  id: 'aula1',
  n: 1,
  titulo: 'Fundamentos de detecção de objetos e engenharia de dados',
  ideia:
    'Esta aula estabelece os conceitos necessários antes de qualquer treinamento: a definição da tarefa de visão computacional, a representação das anotações, as medidas de concordância entre previsão e referência, e os procedimentos de anotação, auditoria e partição dos dados que condicionam a validade da avaliação.',
  chips: ['representação digital da imagem', 'processamento clássico e aprendizado profundo', 'taxonomia das tarefas', 'detectores de um e dois estágios', 'segmentação', 'formatos de anotação', 'IoU e NMS', 'GSD', 'protocolo de anotação', 'auditoria', 'partição por grupo'],
  objetivos: [
    'Distinguir classificação, detecção, segmentação semântica e segmentação de instâncias, e justificar a escolha da tarefa em função da pergunta agronômica e do custo de anotação.',
    'Descrever a organização de detectores de dois estágios (família R-CNN), de um estágio (família YOLO) e baseados em transformers (DETR), bem como da U-Net para segmentação.',
    'Converter caixas delimitadoras entre as representações xyxy, COCO e YOLO, e descrever a representação poligonal usada em segmentação de instâncias.',
    'Calcular a interseção sobre união (IoU) e executar manualmente a supressão de não máximos (NMS), analisando o efeito dos limiares de confiança e de IoU.',
    'Calcular a distância de amostragem no solo (GSD) e estimar a resolução efetiva de um objeto na entrada da rede.',
    'Elaborar um protocolo de anotação, medir a concordância entre anotadores e auditar um conjunto rotulado.',
    'Particionar um conjunto de imagens por grupo de coleta, evitando vazamento de dados entre treino, validação e teste.',
  ],
  intervaloDepois: 'b13',
  notebook: {
    nome: 'Aula1_Anotacao_Auditoria_Split.ipynb',
    arquivo: 'Aula1_Anotacao_Auditoria_Split.ipynb',
    descricao: 'Obtenção do WGISD, conversão de formatos, cálculo de GSD, IoU e NMS, auditoria de rótulos, estatísticas descritivas, concordância entre anotadores e partição por variedade.',
  },
  blocos: [
    /* ============================================================ 1.1 */
    {
      id: 'b11',
      cod: '1.1',
      titulo: 'Do processamento clássico às tarefas de visão computacional',
      min: 25,
      tipo: 'conceito',
      slides: [
        { titulo: 'Representação digital da imagem', img: 'imagem_matriz', pontos: ['Imagem colorida: tensor de dimensão altura × largura × 3', 'Cada elemento: intensidade de 0 a 255 (8 bits)', 'Foto do WGISD: 1365 × 2048 × 3 ≈ 8,4 milhões de valores'] },
        { titulo: 'Espaços de cor', img: 'canais_cor', pontos: ['RGB combina cromaticidade e luminância', 'HSV separa matiz (H), saturação (S) e valor (V)', 'A escolha do espaço altera a separabilidade das classes'] },
        { titulo: 'Cadeia clássica de processamento', img: 'pipeline_classico', legenda: 'CWFID (HAUG; OSTERMANN, 2014)', pontos: ['Aquisição → realce → segmentação → rotulação → descritores → classificação', 'Índice ExG (WOEBBECKE et al., 1995); limiar de Otsu (OTSU, 1979)', 'Cada etapa é definida explicitamente pelo projetista'] },
        { titulo: 'Limite das regras definidas manualmente', img: 'classico_falha', pontos: ['Baixo contraste cromático entre objeto e fundo', 'A regra válida para um cultivo não se transfere a outro', 'Motiva a aprendizagem de representações a partir de exemplos'] },
        { titulo: 'Comparação entre as abordagens', pontos: ['Clássica: interpretável, pouca demanda de dados, sensível a mudanças de cena', 'Aprendizado profundo: maior capacidade de generalização intra-domínio, maior demanda de rótulos e computação', 'Evidência local: Salvadori (2020) comparou HSV e RetinaNet na contagem de milho', 'As abordagens são complementares: pré-processamento, auditoria e linhas de base'] },
        { titulo: 'Taxonomia das tarefas', img: 'quatro_tarefas', legenda: 'WGISD (SANTOS et al., 2020)', pontos: ['Classificação: rótulo por imagem', 'Detecção: caixa, classe e confiança por objeto', 'Segmentação semântica: classe por pixel', 'Segmentação de instâncias: máscara por objeto'] },
        { titulo: 'Custo de anotação', pontos: ['Cresce da classificação para a segmentação de instâncias', 'Caixa tradicional: cerca de 35 s por objeto (PAPADOPOULOS et al., 2017)', 'Cliques extremos: cerca de 7 s por objeto, com qualidade equivalente', 'Critério: menor nível de anotação que responde à pergunta de pesquisa'] },
      ],
      teoria: (
        <>
          <h4>Representação digital da imagem</h4>
          <p>
            Uma imagem digital colorida é representada como um tensor de dimensão <code>altura × largura × canais</code>. No modelo RGB com 8 bits por canal, cada elemento assume valores inteiros
            entre 0 e 255. As fotografias do conjunto WGISD (SANTOS et al., 2020), por exemplo, têm 2048 × 1365 pixels, o que corresponde a aproximadamente 8,4 milhões de valores por imagem. Tanto os
            métodos clássicos de processamento digital de imagens quanto as redes neurais operam sobre essa representação (GONZALEZ; WOODS, 2010).
          </p>
          <p>
            A escolha do espaço de cor afeta a separabilidade entre classes. O espaço HSV separa a matiz (H), a saturação (S) e o valor (V), o que tende a reduzir a sensibilidade de regras baseadas em cor
            a variações de iluminação. Em métodos clássicos, essa escolha é feita pelo projetista; em redes convolucionais, a combinação de canais é aprendida durante o treinamento.
          </p>
          <h4>Cadeia clássica de processamento</h4>
          <p>
            A abordagem clássica organiza a análise em etapas definidas explicitamente: aquisição, pré-processamento, segmentação, extração de descritores e classificação (GONZALEZ; WOODS, 2010). Em
            aplicações agrícolas, uma combinação frequente é o índice de excesso de verde, ExG = 2g − r − b, calculado sobre as coordenadas cromáticas normalizadas (WOEBBECKE et al., 1995), seguido
            da limiarização de Otsu, que seleciona o limiar que maximiza a variância entre classes do histograma (OTSU, 1979). A rotulação de componentes conexos e o cálculo de descritores de forma e
            cor completam a cadeia.
          </p>
          <p>
            Essa abordagem é interpretável, computacionalmente barata e exige poucos dados rotulados. Seu desempenho, entretanto, depende da existência de um contraste estável entre objeto e fundo.
            Quando o objeto e o fundo têm cores semelhantes, como cachos de uvas brancas e folhagem, a regra precisa ser complementada por descritores de textura e forma ajustados manualmente, e o
            ajuste tende a não se transferir para outros cultivos ou condições de captura. O aprendizado profundo substitui a especificação manual por uma representação aprendida a partir de
            exemplos rotulados (LECUN; BENGIO; HINTON, 2015), deslocando o principal custo do projeto para a obtenção e a qualidade das anotações. As duas abordagens não são excludentes: métodos
            clássicos continuam úteis como linha de base, como pré-processamento e como ferramenta de auditoria.
          </p>
          <h4>Taxonomia das tarefas</h4>
          <p>
            A escolha do modelo é precedida pela definição da tarefa, que determina a forma da saída e o tipo de anotação necessária. O Quadro 1 resume as quatro tarefas tratadas nesta disciplina.
          </p>
          <table className="tbl">
            <caption style={{ captionSide: 'top', textAlign: 'left', fontSize: '0.85rem', marginBottom: 4 }}>Quadro 1. Tarefas de visão computacional, saídas e anotações correspondentes.</caption>
            <thead><tr><th>tarefa</th><th>saída</th><th>anotação</th><th>exemplo agrícola</th></tr></thead>
            <tbody>
              <tr><td>classificação</td><td>uma classe por imagem</td><td>rótulo da imagem</td><td>folha sadia ou com sintoma</td></tr>
              <tr><td>detecção</td><td>caixa, classe e confiança por objeto</td><td>caixa delimitadora</td><td>contagem de cachos, animais, espigas</td></tr>
              <tr><td>segmentação semântica</td><td>classe por pixel</td><td>máscara por classe</td><td>área ocupada por plantas daninhas</td></tr>
              <tr><td>segmentação de instâncias</td><td>máscara por objeto</td><td>polígono por objeto</td><td>área ou volume de cada cacho</td></tr>
            </tbody>
          </table>
          <p>
            O custo de anotação cresce da classificação para a segmentação de instâncias. Para caixas delimitadoras, Papadopoulos et al. (2017) reportam cerca de 35 s por caixa no protocolo
            tradicional usado no ILSVRC e cerca de 7 s com o protocolo de cliques extremos, sem perda de qualidade dos detectores treinados. Recomenda-se, portanto, adotar o menor nível de
            anotação capaz de responder à pergunta de pesquisa. Outras tarefas suportadas pelos mesmos frameworks incluem estimativa de pose por pontos-chave, caixas orientadas e rastreamento.
          </p>
        </>
      ),
      exemplo: (
        <>
          <Fig n="imagem_matriz" cap="Figura 1. Recorte de uma imagem do WGISD e valores RGB de um bloco de 8 × 8 pixels." />
          <Fig n="canais_cor" cap="Figura 2. Canais RGB e HSV de uma imagem de Syrah do WGISD." />
          <Fig n="pipeline_classico" cap="Figura 3. Cadeia clássica (ExG, Otsu e componentes conexos) aplicada a uma imagem do CWFID (HAUG; OSTERMANN, 2014)." />
          <Fig n="classico_falha" cap="Figura 4. A mesma regra aplicada a uma imagem do WGISD (SANTOS et al., 2020): a segmentação recupera a folhagem, mas não distingue os cachos de uva branca." />
          <Caso
            tipo="trabalho de conclusão de curso, UTFPR"
            titulo="Identificação de plantas de milho utilizando imagens aéreas obtidas por VANTs"
            autores="Enzo Salvadori"
            onde="Bacharelado em Ciência da Computação, UTFPR Ponta Grossa, 2020"
            link="https://repositorio.utfpr.edu.br/jspui/bitstream/1/26481/1/identificacaomilhoimagensaereas.pdf"
            resumo={<p>O trabalho compara, no mesmo conjunto de imagens aéreas, um método baseado em limiarização no espaço HSV e componentes conexos com um detector convolucional de um estágio (RetinaNet). Permite discutir, num contexto local, o custo e o benefício de cada abordagem.</p>}
            pipeline={['Imagens aéreas de VANT sobre lavoura de milho', 'Método 1: limiarização em HSV e componentes conexos', 'Método 2: detector RetinaNet', 'Avaliação por precisão e revocação']}
            numeros={[{ v: '50,4%', l: 'precisão, HSV' }, { v: '81,6%', l: 'revocação, HSV' }, { v: '99,0%', l: 'precisão, RetinaNet' }, { v: '97,6%', l: 'revocação, RetinaNet' }]}
            discutir={['Como foram definidos os conjuntos de treino e de teste? Há independência espacial entre eles?', 'Qual o custo de anotação exigido pelo detector e não exigido pelo método clássico?', 'Os resultados se mantêm em outro talhão, outra data ou outra altura de voo?']}
          />
          <Fig n="quatro_tarefas" cap="Figura 5. As quatro tarefas aplicadas à mesma imagem do WGISD, com anotações originais do conjunto." />
        </>
      ),
      pratica: (
        <>
          <p><b>Atividade em duplas (8 min).</b> Para cada problema dos exercícios abaixo, indicar a tarefa adequada e justificar a escolha em função da pergunta e do custo de anotação.</p>
          <Code title="Python · a imagem como tensor" code={`import numpy as np
from PIL import Image
!wget -q https://raw.githubusercontent.com/thsant/wgisd/master/data/CDY_2017.jpg
img = np.array(Image.open("CDY_2017.jpg"))
print(img.shape, img.dtype)          # (1365, 2048, 3) uint8
print(img[700:703, 300:303])         # bloco 3 x 3, três canais
f = img.astype(float) / 255
s = f.sum(axis=2) + 1e-6
r, g, b = f[..., 0] / s, f[..., 1] / s, f[..., 2] / s
exg = 2 * g - r - b                  # Woebbecke et al. (1995)
print("ExG médio:", exg.mean().round(3))`} />
        </>
      ),
      exercicios: [
        { nivel: 'básico', q: 'Estimar o número de aves mortas em um aviário a partir de uma câmera fixa no teto. Qual tarefa é adequada?', r: <p>Detecção, pois a pergunta envolve localização e contagem de objetos individuais; a caixa delimitadora é suficiente. A classificação não fornece contagem e a segmentação impõe custo de anotação sem ganho para a pergunta.</p> },
        { nivel: 'básico', q: 'Estimar a porcentagem de área foliar com lesões de ferrugem na soja. Qual tarefa é adequada?', r: <p>Segmentação semântica, pois a variável de interesse é uma área. Não é necessário distinguir lesões individuais.</p> },
        { nivel: 'médio', q: 'Separar grãos de café conformes e defeituosos em uma esteira, com uma imagem por grão.', r: <p>Classificação, pois cada imagem contém um único objeto. Se a imagem contivesse vários grãos, a tarefa passaria a ser detecção.</p> },
        { nivel: 'médio', q: 'Calcular o número de bytes de uma imagem RGB de 8 bits com 2048 × 1365 pixels e da mesma imagem reduzida para 640 × 427.', r: <p>2048 × 1365 × 3 = 8.386.560 bytes; 640 × 427 × 3 = 819.840 bytes. A redução corresponde a cerca de 10,2 vezes menos informação na entrada do modelo, o que afeta principalmente objetos pequenos.</p> },
        { nivel: 'desafio', q: 'Um pulverizador seletivo possui bicos espaçados de 25 cm. Discutir se detecção ou segmentação é mais adequada para acioná-los.', r: <p>Com resolução de atuação de 25 cm, basta identificar em qual faixa há planta daninha; a caixa delimitadora fornece essa informação com menor custo de anotação. A segmentação seria justificável com atuadores de maior resolução ou quando a dose depende da área foliar.</p> },
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
        { titulo: 'Detectores de dois estágios e de um estágio', img: 'rcnn_vs_yolo', pontos: ['Dois estágios: propostas de região, depois classificação e regressão', 'Um estágio: previsão densa em uma única passagem', 'O compromisso entre velocidade e acurácia depende de extrator, resolução e número de propostas (HUANG et al., 2017)'] },
        { titulo: 'Família R-CNN', pontos: ['R-CNN: busca seletiva e uma CNN por região (GIRSHICK et al., 2014)', 'Faster R-CNN: rede de propostas (RPN) treinável (REN et al., 2017)', 'Mask R-CNN: ramo adicional de máscara (HE et al., 2017)'] },
        { titulo: 'Família YOLO', img: 'grade_yolo', pontos: ['Formulação original: grade S × S, previsão por célula (REDMON et al., 2016)', 'Versões posteriores: extratores e pescoços multiescala', 'Implementação de referência nesta disciplina: Ultralytics (JOCHER; QIU; CHAURASIA, 2023)'] },
        { titulo: 'Extrator, pescoço e cabeças', img: 'piramide_p3p5', pontos: ['Extrator (backbone): mapas de características', 'Pescoço (neck): fusão multiescala, inspirada em FPN (LIN et al., 2017)', 'Cabeças (heads): caixa, classe e confiança por posição'] },
        { titulo: 'Âncoras e formulação sem âncoras', img: 'ancora_vs_livre', pontos: ['Com âncoras: ajuste de caixas-modelo pré-definidas', 'Sem âncoras: regressão das distâncias às bordas (TIAN et al., 2019)', 'Reduz hiperparâmetros dependentes da geometria do conjunto'] },
        { titulo: 'Detectores baseados em transformers', pontos: ['DETR: previsão de conjunto, correspondência bipartida, sem NMS (CARION et al., 2020)', 'RT-DETR: variante em tempo real (ZHAO et al., 2024)', 'Alternativa relevante quando o NMS limita desempenho ou latência'] },
        { titulo: 'U-Net para segmentação', img: 'unet_cwfid', pontos: ['Codificador e decodificador simétricos', 'Conexões de atalho preservam detalhe espacial (RONNEBERGER; FISCHER; BROX, 2015)', 'Saída: mapa de classes com a resolução da entrada'] },
        { titulo: 'Representações da caixa delimitadora', img: 'formatos_caixa', formula: <>YOLO: x<sub>c</sub> = (x₁+x₂)/2W · y<sub>c</sub> = (y₁+y₂)/2H · w = (x₂−x₁)/W · h = (y₂−y₁)/H</> },
        { titulo: 'Representação poligonal', img: 'mascara_poligono', pontos: ['Máscara binária: um valor por pixel', 'Polígono: vértices normalizados do contorno', 'Formato YOLO-seg: classe seguida dos vértices'] },
      ],
      teoria: (
        <>
          <h4>Detectores de dois estágios</h4>
          <p>
            A família R-CNN organiza a detecção em duas etapas. Na formulação original, cerca de 2.000 regiões candidatas são geradas por busca seletiva (UIJLINGS et al., 2013) e cada região é
            classificada por uma rede convolucional (GIRSHICK et al., 2014). O Faster R-CNN substituiu a busca seletiva por uma rede de propostas de regiões treinável e compartilhou o processamento
            convolucional entre as etapas (REN et al., 2017); o Mask R-CNN acrescentou um ramo de segmentação por instância (HE et al., 2017). Santos et al. (2020) empregaram o Mask R-CNN no WGISD.
          </p>
          <h4>Detectores de um estágio</h4>
          <p>
            Os detectores de um estágio produzem previsões densas em uma única passagem pela rede. Na formulação original do YOLO, a imagem é dividida em uma grade S × S e a célula que contém o centro
            de um objeto é responsável por prever sua caixa, a confiança e as probabilidades de classe (REDMON et al., 2016). Detectores atuais dessa família organizam-se em três componentes:
          </p>
          <ol>
            <li><b>Extrator de características</b> (backbone): rede convolucional que produz mapas de características em resoluções decrescentes.</li>
            <li>
              <b>Pescoço</b> (neck): combina mapas de diferentes resoluções, em arranjo derivado das redes de pirâmide de características (LIN et al., 2017). Para entrada de 640 × 640, os níveis
              P3, P4 e P5 têm passos (strides) de 8, 16 e 32 pixels, isto é, grades de 80 × 80, 40 × 40 e 20 × 20, totalizando 8.400 posições de previsão.
            </li>
            <li><b>Cabeças</b> (heads): em cada posição, estimam a caixa, a classe e a confiança.</li>
          </ol>
          <p>
            Versões anteriores ajustavam caixas de referência pré-definidas (âncoras), cujas dimensões são estimadas a partir do conjunto de dados. Formulações sem âncoras, como a do FCOS (TIAN et
            al., 2019), regridem diretamente as distâncias de cada ponto às quatro bordas do objeto, eliminando hiperparâmetros dependentes da geometria das caixas.
          </p>
          <h4>Compromisso entre velocidade e acurácia</h4>
          <p>
            A comparação entre famílias de detectores não admite uma resposta única. Huang et al. (2017) mostram que o compromisso entre velocidade, memória e acurácia depende do extrator de
            características, da resolução de entrada e do número de propostas, e não apenas da arquitetura de detecção. Detectores baseados em transformers, como o DETR, tratam a detecção como
            previsão de conjunto com correspondência bipartida e dispensam a supressão de não máximos (CARION et al., 2020); o RT-DETR adapta essa formulação a aplicações em tempo real e reporta, no
            COCO, desempenho superior a modelos YOLO contemporâneos em velocidade e acurácia (ZHAO et al., 2024). A escolha da arquitetura deve, portanto, considerar a restrição de execução (servidor,
            computador embarcado, dispositivo móvel) e ser validada no próprio conjunto de dados. Nesta disciplina, a família YOLO é adotada por razões didáticas e de disponibilidade de
            implementação, não por superioridade geral.
          </p>
          <h4>Segmentação</h4>
          <p>
            A U-Net é uma arquitetura de referência para segmentação semântica: um codificador reduz a resolução espacial e aumenta o contexto, um decodificador restaura a resolução original e{' '}
            <Term def="ligações que copiam os mapas do codificador para o decodificador, recuperando a informação espacial perdida na redução de resolução">conexões de atalho</Term> preservam o detalhe
            das bordas (RONNEBERGER; FISCHER; BROX, 2015).
          </p>
          <h4>Formatos de anotação</h4>
          <ol>
            <li><b>xyxy</b> (Pascal VOC): cantos superior esquerdo e inferior direito, em pixels (EVERINGHAM et al., 2010).</li>
            <li><b>COCO</b>: canto superior esquerdo, largura e altura, em pixels, em arquivo JSON único (LIN et al., 2014).</li>
            <li><b>YOLO</b>: um arquivo de texto por imagem, com uma linha <code>classe x_centro y_centro largura altura</code> por objeto, normalizada pelas dimensões da imagem.</li>
            <li><b>YOLO-seg</b>: <code>classe x1 y1 … xn yn</code>, com os vértices do polígono normalizados.</li>
          </ol>
          <p>
            <b>Exemplo resolvido.</b> Imagem de 2048 × 1365 pixels e caixa xyxy (479, 365, 866, 638). Largura 387, altura 273, centro (672,5; 501,5). Em YOLO: x<sub>c</sub> = 0,3284;
            y<sub>c</sub> = 0,3674; w = 0,1890; h = 0,2000. Em COCO: [479, 365, 387, 273].
          </p>
        </>
      ),
      exemplo: (
        <>
          <Fig n="rcnn_vs_yolo" cap="Figura 6. Regiões candidatas geradas por busca seletiva (OpenCV) e grade de previsão de um detector de um estágio, sobre imagem do WGISD." />
          <Fig n="grade_yolo" cap="Figura 7. Grade 8 × 8; em azul, as células que contêm o centro de cachos anotados." />
          <Fig n="piramide_p3p5" cap="Figura 8. Níveis P3, P4 e P5 sobre imagem reduzida a 640 pixels; em amarelo, os cachos cujo tamanho corresponde a cada nível." />
          <Fig n="ancora_vs_livre" cap="Figura 9. Formulação com âncoras (caixas tracejadas) e sem âncoras (distâncias l, t, r, b a partir de um ponto)." />
          <Fig n="unet_cwfid" cap="Figura 10. Rótulo por pixel do CWFID (cultura e planta daninha), correspondente à saída esperada de uma U-Net." />
          <Fig n="formatos_caixa" cap="Figura 11. Uma caixa do WGISD nas representações xyxy, COCO e YOLO." />
          <Fig n="mascara_poligono" cap="Figura 12. Máscara de instância do WGISD convertida em polígono (cv2.findContours e cv2.approxPolyDP)." />
          <Callout kind="pegadinha">
            <p>No formato YOLO, as coordenadas referem-se ao centro da caixa. A exportação de cantos normalizados sob esse formato não gera erro de execução, mas invalida o treinamento; por isso, a conversão deve ser verificada visualmente antes do treino.</p>
          </Callout>
        </>
      ),
      pratica: (
        <>
          <p>Resolver manualmente as conversões dos exercícios e verificar os resultados no conversor.</p>
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
        { nivel: 'básico', q: 'Imagem de 1280 × 720 pixels; objeto entre (400, 200) e (560, 330). Escrever a caixa em COCO e em YOLO (classe 0).', r: <p>COCO: [400, 200, 160, 130]. YOLO: 0 0.3750 0.3681 0.1250 0.1806.</p> },
        { nivel: 'básico', q: 'Dada a linha YOLO "0 0.5 0.5 0.2 0.4" em uma imagem de 1000 × 500, determinar os cantos em pixels.', r: <p>Centro (500, 250), largura 200, altura 200. Cantos: (400, 150) e (600, 350).</p> },
        { nivel: 'médio', q: 'Com entrada 640 × 640 e passos 8, 16 e 32, quantas posições de previsão existem? E com entrada 1280 × 1280?', r: <p>640: 80² + 40² + 20² = 8.400. 1280: 160² + 80² + 40² = 33.600, quatro vezes mais posições e custo computacional aproximadamente proporcional.</p> },
        { nivel: 'médio', q: 'A linha "0 0.10 0.20 0.30 0.40" foi exportada como YOLO, mas contém cantos normalizados (x1 y1 x2 y2). Qual seria a linha correta?', r: <p>x<sub>c</sub> = 0,20; y<sub>c</sub> = 0,30; w = 0,20; h = 0,20. Linha correta: 0 0.20 0.30 0.20 0.20.</p> },
        { nivel: 'desafio', q: 'Discutir critérios para escolher entre um detector de dois estágios, um de um estágio e um baseado em transformer em uma aplicação embarcada em trator.', r: <p>Os critérios incluem latência no hardware de destino, memória disponível, tamanho típico dos objetos e acurácia exigida. A literatura mostra que o compromisso depende de extrator, resolução e implementação (HUANG et al., 2017; ZHAO et al., 2024); a decisão deve se apoiar em medições no próprio conjunto de validação e no dispositivo de execução.</p> },
      ],
    },
    /* ============================================================ 1.3 */
    {
      id: 'b13',
      cod: '1.3',
      titulo: 'IoU, NMS, GSD e inferência com modelo pré-treinado',
      min: 35,
      tipo: 'conceito',
      slides: [
        { titulo: 'Interseção sobre união (IoU)', img: 'iou_exemplos', formula: <>IoU = área(A ∩ B) / área(A ∪ B)</>, pontos: ['Equivalente ao índice de Jaccard', 'Critério de correspondência: IoU ≥ limiar (PASCAL VOC: 0,5)'] },
        { titulo: 'Exemplo resolvido', formula: <>A = (100,100,200,200) · B = (150,120,250,220)</>, pontos: ['Interseção: 50 × 80 = 4.000', 'União: 10.000 + 10.000 − 4.000 = 16.000', 'IoU = 0,25'] },
        { titulo: 'Sensibilidade ao tamanho do objeto', img: 'iou_vs_deslocamento', pontos: ['Um mesmo erro absoluto reduz mais o IoU de objetos pequenos', 'Relevante para frutos, insetos, plântulas'] },
        { titulo: 'Supressão de não máximos (NMS)', img: 'nms_antes_depois', pontos: ['1. Descartar previsões com confiança < conf', '2. Ordenar por confiança', '3. Manter a primeira; remover as que têm IoU ≥ iou com ela', '4. Repetir; executado por classe'] },
        { titulo: 'NMS: execução passo a passo', img: 'nms_passos' },
        { titulo: 'Limiar de confiança', img: 'conf_limiares', pontos: ['Limiar baixo: maior revocação, menor precisão', 'Limiar alto: maior precisão, menor revocação', 'Escolha deve ser feita no conjunto de validação'] },
        { titulo: 'Variantes do NMS', pontos: ['Soft-NMS: reduz a confiança em vez de remover (BODLA et al., 2017)', 'Detectores sem NMS: correspondência um a um (CARION et al., 2020)'] },
        { titulo: 'Distância de amostragem no solo (GSD)', img: 'gsd_resolucao', formula: <>GSD = H · p / f</>, pontos: ['H: altura de voo; p: tamanho do pixel do sensor; f: distância focal', 'Determina quantos pixels o objeto ocupa na imagem', 'A redução para imgsz diminui ainda mais esse número'] },
      ],
      teoria: (
        <>
          <h4>Interseção sobre união</h4>
          <p>
            A interseção sobre união, equivalente ao índice de Jaccard, mede a sobreposição entre duas regiões: a área da interseção dividida pela área da união. Em detecção, uma previsão é
            considerada verdadeiro positivo (TP) quando seu IoU com uma anotação ainda não associada é maior ou igual a um limiar; o protocolo do PASCAL VOC adota 0,5 (EVERINGHAM et al., 2010) e o do
            COCO calcula a média em dez limiares, de 0,50 a 0,95 (LIN et al., 2014). Previsões sem correspondência são falsos positivos (FP) e anotações sem correspondência, falsos negativos (FN).
          </p>
          <p className="slide-formula">
            I = max(0, min(x₂ᴬ, x₂ᴮ) − max(x₁ᴬ, x₁ᴮ)) · max(0, min(y₂ᴬ, y₂ᴮ) − max(y₁ᴬ, y₁ᴮ)) · IoU = I / (área A + área B − I)
          </p>
          <p>
            Como o IoU é uma razão de áreas, o mesmo erro absoluto de localização produz reduções maiores em objetos pequenos: um deslocamento diagonal de 10 pixels resulta em IoU de 0,82 para um
            objeto de 200 × 200 pixels e de 0,21 para um objeto de 24 × 24 pixels (Figura 14).
          </p>
          <h4>Supressão de não máximos</h4>
          <p>
            Detectores densos produzem várias previsões sobrepostas para um mesmo objeto. A supressão de não máximos (NMS) seleciona, por classe, a previsão de maior confiança e remove as que se
            sobrepõem a ela acima de um limiar de IoU, repetindo o processo até esgotar a lista. Dois parâmetros controlam o resultado: o limiar de confiança (<code>conf</code>), que regula o
            compromisso entre precisão e revocação, e o limiar de IoU do NMS, que regula a remoção de duplicatas em cenas com objetos muito próximos. O Soft-NMS reduz a confiança das previsões
            sobrepostas em vez de removê-las (BODLA et al., 2017); detectores baseados em correspondência um a um dispensam a etapa (CARION et al., 2020).
          </p>
          <h4>Distância de amostragem no solo</h4>
          <p>
            A distância de amostragem no solo (GSD) é a dimensão, no terreno, representada por um pixel: GSD = H · p / f, em que H é a altura de voo, p o tamanho do pixel do sensor e f a distância
            focal. Para H = 40 m, p = 2,4 µm e f = 8,8 mm, obtém-se GSD ≈ 1,1 cm/pixel; um objeto de 15 cm ocupa então cerca de 14 pixels. Se a imagem de 5.472 pixels de largura for reduzida para 640
            pixels na entrada da rede, o mesmo objeto passa a ocupar menos de 2 pixels. O planejamento da coleta e a escolha da resolução de entrada devem, portanto, considerar o tamanho dos objetos de
            interesse.
          </p>
        </>
      ),
      exemplo: (
        <>
          <Fig n="iou_exemplos" cap="Figura 13. Três previsões sobre um cacho anotado do WGISD e respectivos valores de IoU." />
          <Fig n="iou_vs_deslocamento" cap="Figura 14. IoU em função do deslocamento para objetos de 24, 64 e 200 pixels (cálculo analítico)." />
          <Fig n="nms_antes_depois" cap="Figura 15. Previsões simuladas a partir das caixas anotadas, antes e depois da filtragem por confiança e do NMS. As previsões não provêm de um modelo treinado." />
          <Fig n="nms_passos" cap="Figura 16. Execução do NMS passo a passo sobre três cachos vizinhos (previsões simuladas)." />
          <Fig n="conf_limiares" cap="Figura 17. Efeito do limiar de confiança sobre previsões simuladas: acertos (verde) e falsos positivos (vermelho)." />
          <Fig n="gsd_resolucao" cap="Figura 18. Um mesmo cacho com resolução reduzida por fatores de 4, 8 e 16." />
        </>
      ),
      pratica: (
        <>
          <LabIoU />
          <LabNMS />
          <LabGSD />
          <p><b>Inferência com modelo pré-treinado (10 min).</b> Aplicar um modelo treinado no COCO, que não contém a classe uva, a uma imagem do WGISD e registrar as classes e confianças previstas. O objetivo é evidenciar a necessidade de um conjunto rotulado para o domínio.</p>
          <Code code={`!pip -q install ultralytics
!wget -q https://raw.githubusercontent.com/thsant/wgisd/master/data/CDY_2017.jpg
from ultralytics import YOLO
modelo = YOLO("yolo11n.pt")            # treinado no COCO (80 classes)
for conf in [0.05, 0.25, 0.5]:
    r = modelo.predict("CDY_2017.jpg", conf=conf, iou=0.5, verbose=False)[0]
    print(conf, [(modelo.names[int(c)], round(float(s), 2)) for c, s in zip(r.boxes.cls, r.boxes.conf)])`} />
        </>
      ),
      exercicios: [
        { nivel: 'básico', q: 'Calcular o IoU entre duas caixas de 100 × 100 pixels deslocadas 50 pixels na horizontal.', r: <p>Interseção 5.000; união 15.000; IoU = 0,33.</p> },
        { nivel: 'básico', q: 'Uma caixa prevista está contida na caixa de referência e tem metade de sua área. Qual o IoU?', r: <p>Interseção = 0,5A e união = A; IoU = 0,5.</p> },
        { nivel: 'médio', q: 'Previsões com confiança A 0,9; B 0,8; C 0,7; D 0,3. IoU(A,B) = 0,7; IoU(A,C) = 0,2; IoU(B,C) = 0,6; D sem sobreposição. Com conf = 0,25 e limiar de NMS 0,5, quais previsões permanecem?', r: <p>A é mantida; B é removida (0,7 ≥ 0,5); C permanece (0,2 em relação a A); D permanece. Resultado: A, C e D. B não remove C porque já foi eliminada.</p> },
        { nivel: 'médio', q: 'Calcular o GSD para H = 60 m, p = 3,3 µm e f = 10 mm, e o número de pixels ocupados por uma plântula de 5 cm.', r: <p>GSD = 60 × 3,3 / 10 = 19,8 mm/pixel ≈ 2 cm/pixel; a plântula ocupa cerca de 2,5 pixels, valor insuficiente para detecção confiável. Seria necessário reduzir a altura de voo ou usar maior distância focal.</p> },
        { nivel: 'desafio', q: 'Em um pomar com copas contíguas, o NMS com limiar 0,7 mantém duplicatas e com limiar 0,3 remove árvores distintas. Propor alternativas e um critério de avaliação.', r: <p>Alternativas: limiar intermediário selecionado na validação, Soft-NMS (BODLA et al., 2017), segmentação de instâncias, métodos baseados em densidade (OSCO et al., 2020) ou detectores sem NMS (CARION et al., 2020). O critério deve refletir a finalidade, por exemplo o erro absoluto de contagem por parcela.</p> },
      ],
    },
    /* ============================================================ 1.4 */
    {
      id: 'b14',
      cod: '1.4',
      titulo: 'Protocolo de anotação no CVAT',
      min: 45,
      tipo: 'conceito',
      slides: [
        { titulo: 'Variabilidade entre anotadores', img: 'ambiguidade_anotacao', pontos: ['Ajuste da caixa ao contorno', 'Objetos contíguos', 'Sem protocolo explícito, a variabilidade é incorporada ao modelo'] },
        { titulo: 'Casos-limite no WGISD', img: 'casos_limite', pontos: ['Objeto cortado pela borda', 'Objeto pequeno ou distante', 'Objetos contíguos', 'Oclusão por folhagem'] },
        { titulo: 'Conteúdo mínimo de um protocolo', pontos: ['Definição operacional de cada classe, com exemplos positivos e negativos', 'Regra de ajuste da caixa', 'Critério de inclusão por fração visível', 'Tratamento de objetos contíguos, cortados e distantes', 'Imagens sem objetos: arquivo de rótulos vazio'] },
        { titulo: 'Concordância entre anotadores', formula: <>IoU médio entre caixas correspondentes · fração de caixas sem correspondência</>, pontos: ['Anotação independente de um subconjunto', 'Correspondência por IoU', 'Revisão do protocolo nos casos de discordância'] },
        { titulo: 'Erros de rótulo em conjuntos públicos', pontos: ['Northcutt, Athalye e Mueller (2021) estimam erros de rótulo em conjuntos de teste amplamente usados', 'Erros no teste podem alterar a ordenação entre modelos', 'Revisão e auditoria fazem parte do método'] },
        { titulo: 'Organização no CVAT', pontos: ['Projeto: definição das classes', 'Tarefa: conjunto de imagens', 'Job: fração atribuída a um anotador, com etapas de anotação, validação e aceite', 'Ferramentas: retângulo, polígono, pincel, pontos, rótulo de imagem, interpolação em vídeo'] },
        { titulo: 'Exportação', pontos: ['Formatos YOLO ou COCO, conforme a versão do CVAT', 'Verificação da contagem de imagens e arquivos de rótulo', 'Auditoria automática antes do treinamento (bloco 1.5)'] },
      ],
      teoria: (
        <>
          <p>
            A anotação é um procedimento de medição e, como tal, requer protocolo. Diferenças sistemáticas entre anotadores introduzem ruído nos rótulos, que se reflete tanto no treinamento quanto na
            avaliação. Northcutt, Athalye e Mueller (2021) documentaram erros de rótulo em conjuntos de teste de uso corrente e mostraram que esses erros podem alterar a ordenação entre modelos, o que
            justifica tratar a qualidade da anotação como parte do método experimental.
          </p>
          <p>Um protocolo de anotação deve especificar, com exemplos visuais:</p>
          <ol>
            <li>A definição operacional de cada classe e os casos que não pertencem a ela (por exemplo, folhas secas, sombras e estruturas de condução).</li>
            <li>A regra de ajuste da caixa ao contorno visível do objeto.</li>
            <li>O critério de inclusão de objetos parcialmente ocluídos, por exemplo uma fração mínima visível, e se a caixa cobre a parte visível ou a extensão estimada.</li>
            <li>O tratamento de objetos cortados pela borda da imagem, desfocados, distantes ou contíguos.</li>
            <li>O tratamento de imagens sem objetos de interesse, que permanecem no conjunto com arquivo de rótulos vazio e atuam como exemplos negativos.</li>
          </ol>
          <p>
            A consistência do protocolo pode ser avaliada pela <b>concordância entre anotadores</b>: um subconjunto de imagens é anotado de forma independente por duas pessoas, as caixas são associadas
            por IoU e reportam-se o IoU médio das correspondências e a fração de caixas sem correspondência. Valores baixos indicam ambiguidade no protocolo e orientam sua revisão.
          </p>
          <p>
            O CVAT (Computer Vision Annotation Tool) organiza o trabalho em projetos, nos quais se definem as classes; tarefas, que agrupam imagens; e jobs, que distribuem as imagens entre anotadores
            com etapas de anotação, validação e aceite. A ferramenta oferece retângulos, polígonos, pincel, pontos, rótulos de imagem e interpolação entre quadros de vídeo, além de suporte a
            pré-anotação por modelos. A pré-anotação reduz o tempo de trabalho, mas pode transferir ao conjunto os erros sistemáticos do modelo usado, razão pela qual exige revisão humana.
          </p>
        </>
      ),
      exemplo: (
        <>
          <Fig n="ambiguidade_anotacao" cap="Figura 19. Três critérios de anotação aplicados à mesma imagem. O primeiro corresponde às anotações originais do WGISD; os demais foram gerados para ilustrar variações comuns." />
          <Fig n="casos_limite" cap="Figura 20. Casos-limite do WGISD com as caixas originais do conjunto." />
          <Callout kind="campo"><p>A documentação do WGISD descreve os critérios adotados para cachos distantes e ocluídos. Recomenda-se sua leitura antes da redação do protocolo da dupla (SANTOS et al., 2020).</p></Callout>
        </>
      ),
      pratica: (
        <>
          <ol>
            <li><b>Anotação independente (10 min).</b> Cada estudante anota as mesmas três imagens no CVAT, sem combinação prévia.</li>
            <li><b>Comparação (10 min).</b> Cálculo da concordância com o código abaixo e discussão das divergências.</li>
            <li><b>Protocolo (15 min).</b> Redação coletiva das regras, com uma imagem de exemplo para cada caso-limite.</li>
            <li><b>Demonstração (10 min).</b> Criação de projeto, tarefa e job no CVAT; exportação e inspeção do arquivo gerado.</li>
          </ol>
          <Code title="Python · concordância entre dois anotadores" code={`import numpy as np
def concordancia(A, B, lim=0.5):
    """A, B: listas de caixas xyxy do mesmo conjunto de imagens."""
    usados, ious = set(), []
    for a in A:
        cand = [(iou(a, b), j) for j, b in enumerate(B) if j not in usados]
        v, j = max(cand, default=(0, -1))
        if v >= lim:
            usados.add(j); ious.append(v)
    sem_par = len(A) + len(B) - 2 * len(ious)
    return (np.mean(ious) if ious else 0.0), sem_par`} />
          <Code title="estrutura esperada após a exportação" code={`dataset/
  data.yaml
  images/train/*.jpg
  labels/train/*.txt   # um arquivo por imagem; vazio quando não há objetos
  images/val/...
  labels/val/...`} />
        </>
      ),
      exercicios: [
        { nivel: 'básico', q: 'Justificar a inclusão de imagens sem objetos de interesse no conjunto de treinamento.', r: <p>Essas imagens fornecem exemplos negativos de fundo (folhagem, solo, estruturas), reduzindo previsões espúrias e, portanto, falsos positivos.</p> },
        { nivel: 'médio', q: 'Dois anotadores marcaram 20 e 24 caixas nas mesmas imagens; 18 foram associadas com IoU médio de 0,78. Calcular as caixas sem correspondência e interpretar.', r: <p>20 + 24 − 2 × 18 = 8 caixas sem correspondência. A localização é consistente (IoU médio 0,78), mas há divergência sobre quais objetos anotar, o que indica necessidade de critério de inclusão mais preciso.</p> },
        { nivel: 'médio', q: 'Discutir o viés que a pré-anotação automática sem revisão sistemática pode introduzir.', r: <p>Objetos que o modelo de pré-anotação não detecta tendem a permanecer sem rótulo e passam a ser tratados como fundo, reproduzindo no novo conjunto os erros sistemáticos daquele modelo. Revisão obrigatória e anotação independente de uma amostra mitigam o problema.</p> },
        { nivel: 'desafio', q: 'Redigir uma regra verificável para cachos parcialmente ocluídos por folhas.', r: <p>Exemplo: "Anotar o cacho quando pelo menos 30% de sua extensão estiver visível. A caixa abrange apenas a parte visível, do primeiro ao último pixel de baga visível. Quando a folha divide o cacho em partes visíveis, uma única caixa abrange todas as partes." A regra deve permitir que outro anotador reproduza a mesma caixa.</p> },
      ],
    },
    /* ============================================================ 1.5 */
    {
      id: 'b15',
      cod: '1.5',
      titulo: 'Laboratório 1: anotação, auditoria e partição dos dados',
      min: 50,
      tipo: 'lab',
      slides: [
        { titulo: 'Auditoria de rótulos', img: 'auditoria_rotulos', pontos: ['Correspondência entre imagens e arquivos de rótulo', 'Classes existentes no arquivo de configuração', 'Coordenadas no intervalo [0, 1] e dimensões positivas', 'Duplicatas na mesma imagem'] },
        { titulo: 'Estatística descritiva do conjunto', img: 'estatisticas_banco', pontos: ['Objetos por imagem', 'Fração da imagem ocupada pelo objeto', 'Distribuição espacial dos centros', 'Razão de aspecto das caixas'] },
        { titulo: 'Dependência entre observações', img: 'quase_iguais', pontos: ['Imagens de uma mesma sessão são fortemente correlacionadas', 'A hipótese de independência da partição aleatória não se sustenta', 'Consequência: subestimação do erro de generalização'] },
        { titulo: 'Partição por grupo', img: 'split_por_grupo', pontos: ['Validação cruzada em blocos (ROBERTS et al., 2017)', 'Grupo: sessão, talhão, propriedade, data, variedade', 'Cada grupo pertence a um único conjunto'] },
        { titulo: 'Vazamento de dados', pontos: ['Informação do teste disponível no treinamento ou na seleção do modelo', 'Identificado como causa recorrente de resultados não reprodutíveis (KAPOOR; NARAYANAN, 2023)', 'Formas comuns: partição inadequada, aumento de dados antes da partição, seleção de modelo no teste'] },
        { titulo: 'Funções dos conjuntos', pontos: ['Treino: ajuste dos parâmetros', 'Validação: seleção de época, hiperparâmetros e limiares', 'Teste: estimativa final, consultado uma única vez'] },
      ],
      teoria: (
        <>
          <h4>Auditoria e descrição do conjunto</h4>
          <p>
            Antes do treinamento, o conjunto rotulado deve ser auditado quanto a inconsistências que não interrompem a execução, mas alteram o resultado: imagens sem rótulo, rótulos sem imagem,
            classes inexistentes, coordenadas fora do intervalo [0, 1], caixas de dimensão nula e duplicatas. Recomenda-se ainda descrever o conjunto por estatísticas como número de objetos por
            imagem, distribuição do tamanho relativo das caixas, distribuição espacial dos centros e razão de aspecto. Essas estatísticas fundamentam decisões posteriores, como a resolução de entrada e
            as transformações de aumento de dados.
          </p>
          <h4>Dependência entre observações e partição por grupo</h4>
          <p>
            A partição aleatória pressupõe observações independentes. Em dados agrícolas essa hipótese raramente se sustenta: imagens de uma mesma sessão, talhão ou data compartilham iluminação,
            sensor e, muitas vezes, os mesmos indivíduos. Roberts et al. (2017) mostram que ignorar estruturas temporais, espaciais ou hierárquicas na validação leva à subestimação do erro de
            predição e recomendam a validação em blocos sempre que houver estrutura de dependência nos dados. Em visão computacional, isso corresponde a particionar por grupo de coleta, de modo que
            cada grupo pertença a um único conjunto.
          </p>
          <p>
            Essa questão se insere no problema mais amplo do vazamento de dados. Kapoor e Narayanan (2023), em levantamento de revisões anteriores, identificaram vazamento em 294 artigos de 17
            disciplinas e propuseram uma taxonomia de oito tipos. Entre as formas mais comuns em visão computacional estão a partição sem respeito aos grupos, a aplicação de aumento de dados antes da
            partição e o uso do conjunto de teste para selecionar modelos ou hiperparâmetros.
          </p>
          <h4>Funções dos conjuntos</h4>
          <p>
            O conjunto de <b>treino</b> é usado para ajustar os parâmetros do modelo; o de <b>validação</b>, para todas as decisões de projeto (época de parada, hiperparâmetros, limiares); e o de{' '}
            <b>teste</b>, para a estimativa final de desempenho, consultado uma única vez. Quando o teste orienta alguma decisão, passa a cumprir a função de validação e a estimativa resultante tende a
            ser otimista.
          </p>
        </>
      ),
      exemplo: (
        <>
          <Fig n="auditoria_rotulos" cap="Figura 21. Três inconsistências inseridas artificialmente em uma imagem do WGISD (duplicata, classe inexistente e caixa fora da imagem)." />
          <Fig n="estatisticas_banco" cap="Figura 22. Estatísticas de 924 caixas em 64 imagens do WGISD. A maioria das caixas ocupa menos de 2% da área da imagem." />
          <Fig n="quase_iguais" cap="Figura 23. Correlação entre histogramas de cor de imagens da mesma sessão e de sessões distintas." />
          <Fig n="split_por_grupo" cap="Figura 24. Exemplo de partição por variedade no WGISD." />
          <LabSplit />
        </>
      ),
      pratica: (
        <>
          <p>Em duplas, utilizando o notebook da aula (seções 4 a 6):</p>
          <ol>
            <li>Anotar 15 imagens no CVAT segundo o protocolo da turma, com revisão cruzada por outra dupla.</li>
            <li>Executar a auditoria sobre o arquivo exportado e corrigir as inconsistências encontradas.</li>
            <li>Calcular as estatísticas descritivas e justificar a resolução de entrada a ser usada na Aula 2.</li>
            <li>Particionar o conjunto por grupo e verificar, por código, que nenhum grupo ocorre em mais de um conjunto.</li>
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
            c, *v = linha.split(); v = list(map(float, v))
            if not 0 <= int(c) < n_classes: problemas.append(("classe inválida", nome, k))
            if any(x < 0 or x > 1 for x in v): problemas.append(("fora de [0, 1]", nome, k))
            if v[2] <= 0 or v[3] <= 0: problemas.append(("dimensão nula", nome, k))
    return problemas`} />
        </>
      ),
      exercicios: [
        { nivel: 'básico', q: 'Explicar por que a partição aleatória das 300 imagens do WGISD pode superestimar o desempenho.', r: <p>Imagens de uma mesma variedade e sessão são correlacionadas; a partição aleatória coloca imagens muito semelhantes em treino e teste, violando a independência e subestimando o erro de generalização (ROBERTS et al., 2017).</p> },
        { nivel: 'médio', q: 'Um conjunto tem 12 voos sobre 4 propriedades. Propor uma partição e indicar o que cada conjunto estima.', r: <p>Por exemplo, três propriedades em treino e validação (separadas por voo) e a quarta propriedade integralmente no teste. A validação estima a generalização para novos voos; o teste, para uma nova propriedade.</p> },
        { nivel: 'médio', q: 'A mediana da área relativa das caixas é 1% em imagens de 2048 × 1365. Estimar as dimensões de um cacho típico na entrada de 640 pixels.', r: <p>Supondo proporção semelhante à da imagem, o lado relativo é cerca de 10%: aproximadamente 205 × 137 pixels na imagem original e 64 × 43 pixels após a redução por um fator de 3,2.</p> },
        { nivel: 'desafio', q: 'Explicar por que aplicar aumento de dados antes da partição constitui vazamento.', r: <p>Uma imagem e sua versão transformada representam a mesma cena; se forem alocadas em conjuntos distintos, o teste passa a conter informação do treino. O aumento de dados deve ser aplicado apenas ao conjunto de treino, após a partição (KAPOOR; NARAYANAN, 2023).</p> },
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
        { titulo: 'Roteiro de leitura crítica', pontos: ['Como os dados foram particionados?', 'Qual métrica e com que limiar de IoU?', 'O conjunto de teste representa a condição de uso?', 'Há comparação com linha de base?', 'O código e os dados estão disponíveis?'] },
        { titulo: 'Estudo para análise', pontos: ['Leal et al. (2024): detecção e contagem de bovinos em imagens de VANT', 'Leitura complementar: Algeri et al. (2018), densidade de aves com classificadores Haar e LBP'] },
      ],
      teoria: (
        <p>
          A análise crítica de um estudo de visão computacional deve verificar, no mínimo, o procedimento de partição dos dados, a definição precisa das métricas reportadas (incluindo o limiar de
          IoU), a representatividade do conjunto de teste em relação à condição de uso, a existência de linha de base e a disponibilidade de código e dados. A ficha de leitura de cada referência na
          seção de leituras recomendadas segue esse roteiro.
        </p>
      ),
      exemplo: (
        <Caso
          tipo="artigo em evento nacional"
          titulo="Automatic Cattle Detection and Counting System in Aerial Images Using Computer Vision Algorithms"
          autores="Leal, Jayson, Lira, Veloso, Oseas e Benjamin"
          onde="ENIAC 2024, SBC, p. 472-483"
          link="https://doi.org/10.5753/eniac.2024.245107"
          resumo={<p>Os autores desenvolvem um sistema de contagem de bovinos a partir de imagens de VANT obtidas sobre pastagens no Piauí, sob diferentes condições ambientais, empregando um detector da família YOLO treinado com transferência de aprendizado e disponibilizado como serviço.</p>}
          pipeline={['Quadros extraídos de vídeos de VANT', 'Anotação em ferramenta online', 'Aumento de dados', 'Detector YOLO pré-treinado no COCO', 'Serviço de inferência']}
          numeros={[{ v: '120', l: 'imagens originais' }, { v: '273', l: 'após aumento de dados' }, { v: '88,5%', l: 'mAP reportado' }, { v: '90%', l: 'revocação reportada' }]}
          discutir={[
            'O aumento de dados foi aplicado antes ou depois da partição?',
            'Quadros de um mesmo vídeo foram alocados em conjuntos distintos?',
            'O mAP reportado corresponde a IoU 0,5 ou à média de 0,50 a 0,95?',
            'Que informações adicionais seriam necessárias para reproduzir o resultado?',
          ]}
        />
      ),
      pratica: <p>Cada dupla formula duas questões metodológicas sobre o estudo e identifica uma informação ausente. Como atividade extraclasse, a dupla preenche a ficha de leitura de uma das referências recomendadas.</p>,
      exercicios: [
        { nivel: 'médio', q: 'Com revocação de 90% e precisão de 96% em um rebanho de 500 animais, estimar FN, FP e o erro de contagem.', r: <p>TP = 450 e FN = 50. TP + FP = 450 / 0,96 ≈ 469, logo FP ≈ 19. A contagem estimada seria 469, com erro de −31 animais (−6,2%).</p> },
      ],
    },
  ],
  artigos: [
    { tag: 'conjunto de dados', br: true, ref: 'Santos et al. (2020). Grape detection, segmentation, and tracking using deep neural networks and three-dimensional association. Computers and Electronics in Agriculture, 170, 105247.', link: 'https://doi.org/10.1016/j.compag.2020.105247', porque: 'Origem do WGISD (Embrapa Informática Agropecuária): imagens de cinco variedades de uva, com caixas e máscaras; compara detectores e propõe rastreamento em vídeo.', perguntas: ['Como o conjunto foi particionado em treino e teste?', 'Quais critérios de anotação foram adotados para cachos distantes e ocluídos?', 'Quais métricas foram usadas para detecção e segmentação?'] },
    { tag: 'TCC, UTFPR', br: true, ref: 'Salvadori (2020). Identificação de plantas de milho utilizando imagens aéreas obtidas por VANTs. UTFPR Ponta Grossa.', link: 'https://repositorio.utfpr.edu.br/jspui/bitstream/1/26481/1/identificacaomilhoimagensaereas.pdf', porque: 'Comparação entre método clássico (HSV) e detector convolucional (RetinaNet) no mesmo conjunto.', perguntas: ['Qual foi o procedimento de partição?', 'Os conjuntos são espacialmente independentes?', 'Qual o esforço de anotação envolvido?'] },
    { tag: 'periódico, UTFPR Medianeira', br: true, ref: 'Algeri et al. (2018). Desenvolvimento de ferramenta não invasiva para cálculo de densidade de aves em aviários comerciais. Revista de Computação Aplicada ao Agronegócio, v. 1, n. 2.', link: 'https://periodicos.utfpr.edu.br/rcaa/article/download/9396/6139', porque: 'Detecção de aves com classificadores Haar-like e LBP; permite comparar descritores definidos manualmente com detectores aprendidos.', perguntas: ['Como o erro foi medido?', 'Que condições de iluminação foram contempladas?'] },
    { tag: 'evento nacional', br: true, ref: 'Leal et al. (2024). Automatic Cattle Detection and Counting System in Aerial Images Using Computer Vision Algorithms. ENIAC, SBC.', link: 'https://doi.org/10.5753/eniac.2024.245107', porque: 'Estudo aplicado de escopo reduzido, adequado para exercício de leitura crítica.' },
    { tag: 'contagem por densidade', br: true, ref: 'Osco et al. (2020). A convolutional neural network approach for counting and geolocating citrus-trees in UAV multispectral imagery. ISPRS Journal of Photogrammetry and Remote Sensing, 160, 97-106.', link: 'https://doi.org/10.1016/j.isprsjprs.2019.12.010', porque: 'Alternativa à detecção por caixas em cenas com objetos contíguos.', perguntas: ['Por que a detecção por caixas e o NMS são limitados em pomares densos?', 'Quais bandas espectrais foram utilizadas?'] },
    { tag: 'compromisso velocidade × acurácia', ref: 'Huang et al. (2017). Speed/accuracy trade-offs for modern convolutional object detectors. CVPR.', link: 'https://arxiv.org/abs/1611.10012', porque: 'Comparação controlada entre famílias de detectores, extratores e resoluções.' },
    { tag: 'detecção com transformers', ref: 'Zhao et al. (2024). DETRs Beat YOLOs on Real-time Object Detection. CVPR.', link: 'https://arxiv.org/abs/2304.08069', porque: 'Detector sem NMS em tempo real; contraponto à adoção exclusiva da família YOLO.' },
    { tag: 'métricas', br: true, ref: 'Padilla, Netto e da Silva (2020). A survey on performance metrics for object-detection algorithms. IWSSIP.', link: 'https://doi.org/10.1109/IWSSIP48289.2020.9145130', porque: 'Revisão das métricas de detecção e das variantes de interpolação do AP (UFRJ).' },
    { tag: 'vazamento de dados', ref: 'Kapoor e Narayanan (2023). Leakage and the reproducibility crisis in machine-learning-based science. Patterns, 4(9), 100804.', link: 'https://doi.org/10.1016/j.patter.2023.100804', porque: 'Taxonomia de oito tipos de vazamento e proposta de fichas de modelo.' },
    { tag: 'validação em blocos', ref: 'Roberts et al. (2017). Cross-validation strategies for data with temporal, spatial, hierarchical, or phylogenetic structure. Ecography, 40(8), 913-929.', link: 'https://doi.org/10.1111/ecog.02881', porque: 'Fundamentação da partição por grupo em dados com dependência.' },
    { tag: 'viés em conjuntos de dados', ref: 'Noyan (2022). Uncovering bias in the PlantVillage dataset. arXiv:2206.04374.', link: 'https://arxiv.org/abs/2206.04374', porque: 'Um modelo treinado com 8 pixels de fundo alcançou 49% de acurácia em 38 classes (acaso: 2,6%), evidenciando viés de captura.' },
  ],
  quiz: [
    { p: 'A estimativa da área de cada cacho requer qual tarefa?', o: ['classificação', 'detecção', 'segmentação semântica', 'segmentação de instâncias'], a: 3, e: 'A área por objeto requer uma máscara para cada instância.' },
    { p: 'Imagem 1000 × 500; caixa xyxy (100, 100, 300, 200). Qual a linha YOLO?', o: ['0 0.1 0.2 0.3 0.4', '0 0.2 0.3 0.2 0.2', '0 200 150 200 100', '0 0.2 0.3 0.3 0.2'], a: 1, e: 'x_c = 0,2; y_c = 0,3; w = 0,2; h = 0,2.' },
    { p: 'Duas caixas de 100 × 100 deslocadas 50 pixels na horizontal têm IoU igual a:', o: ['0,50', '0,33', '0,25', '0,67'], a: 1, e: 'Interseção 5.000; união 15.000.' },
    { p: 'Qual nível do pescoço é mais adequado a um objeto de 20 pixels em entrada de 640?', o: ['P3 (passo 8)', 'P4 (passo 16)', 'P5 (passo 32)', 'indiferente'], a: 0, e: 'Com passo 32, o objeto ocupa menos de uma célula.' },
    { p: 'Reduzir excessivamente o limiar de IoU do NMS tende a:', o: ['manter duplicatas', 'remover objetos contíguos distintos', 'aumentar a confiança', 'não alterar o resultado'], a: 1, e: 'Sobreposições pequenas passam a provocar remoção.' },
    { p: 'GSD para H = 40 m, p = 2,4 µm, f = 8,8 mm:', o: ['0,11 cm/pixel', '1,1 cm/pixel', '11 cm/pixel', '4,4 cm/pixel'], a: 1, e: '40 × 2,4 / 8,8 ≈ 10,9 mm.' },
    { p: 'A partição aleatória de imagens de um mesmo voo entre treino e teste caracteriza:', o: ['desbalanceamento de classes', 'vazamento de dados', 'sobreajuste do NMS', 'erro de GSD'], a: 1, e: 'Observações dependentes em conjuntos distintos (ROBERTS et al., 2017).' },
    { p: 'O conjunto de validação destina-se a:', o: ['ajustar os pesos', 'selecionar épocas, hiperparâmetros e limiares', 'reportar o desempenho final', 'aumentar os dados'], a: 1, e: 'O teste é reservado à estimativa final.' },
  ],
  entregas: [
    <><b>Protocolo de anotação</b> da dupla, com pelo menos cinco casos-limite ilustrados e a medida de concordância entre anotadores.</>,
    <><b>Conjunto exportado e auditado</b>, acompanhado das estatísticas descritivas (objetos por imagem, tamanho relativo das caixas).</>,
    <><b>Registro da partição</b>: critério de agrupamento adotado e verificação, por código, da ausência de grupos compartilhados entre conjuntos.</>,
    <><b>Ficha de leitura crítica</b> de uma das referências recomendadas.</>,
  ],
  limitacoes: [
    <>Os exemplos concentram-se em dois conjuntos (WGISD e CWFID), coletados em condições específicas. As conclusões ilustradas não devem ser generalizadas a outros cultivos, sensores ou regiões sem validação própria.</>,
    <>As figuras de NMS, limiar de confiança e curva PR usam previsões simuladas a partir das caixas anotadas, e não saídas de um modelo treinado. Elas ilustram os algoritmos, não o desempenho de um detector.</>,
    <>A prática utiliza a família YOLO na implementação Ultralytics por disponibilidade e facilidade de uso. Outras famílias (R-CNN, DETR, RT-DETR) são discutidas, mas não exercitadas; a escolha em um projeto real deve ser baseada em comparação no próprio conjunto.</>,
    <>Valores padrão de parâmetros, nomes de pesos e formatos de exportação variam entre versões de software. As versões utilizadas devem ser registradas e conferidas na documentação correspondente.</>,
    <>A partição do WGISD por variedade é um recurso didático para evidenciar mudança de domínio; ela difere da partição publicada pelos autores do conjunto, o que impede comparação direta com os resultados de Santos et al. (2020).</>,
  ],
  referencias: [
    'ALGERI, T.; BECKER-ALGERI, T. A.; ABREU, P. G. de; PAULA FILHO, P. L. de. Desenvolvimento de ferramenta não invasiva para cálculo de densidade de aves em aviários comerciais. Revista de Computação Aplicada ao Agronegócio, Medianeira, v. 1, n. 2, p. 1-12, 2018.',
    'BODLA, N.; SINGH, B.; CHELLAPPA, R.; DAVIS, L. S. Soft-NMS: improving object detection with one line of code. In: IEEE INTERNATIONAL CONFERENCE ON COMPUTER VISION (ICCV), 2017. Proceedings [...]. 2017. p. 5561-5569.',
    'CARION, N.; MASSA, F.; SYNNAEVE, G.; USUNIER, N.; KIRILLOV, A.; ZAGORUYKO, S. End-to-end object detection with transformers. In: EUROPEAN CONFERENCE ON COMPUTER VISION (ECCV), 2020. Proceedings [...]. Cham: Springer, 2020. p. 213-229.',
    'EVERINGHAM, M.; VAN GOOL, L.; WILLIAMS, C. K. I.; WINN, J.; ZISSERMAN, A. The Pascal Visual Object Classes (VOC) challenge. International Journal of Computer Vision, v. 88, p. 303-338, 2010.',
    'GIRSHICK, R.; DONAHUE, J.; DARRELL, T.; MALIK, J. Rich feature hierarchies for accurate object detection and semantic segmentation. In: IEEE CONFERENCE ON COMPUTER VISION AND PATTERN RECOGNITION (CVPR), 2014. Proceedings [...]. 2014. p. 580-587.',
    'GONZALEZ, R. C.; WOODS, R. E. Processamento digital de imagens. 3. ed. São Paulo: Pearson Prentice Hall, 2010.',
    'HAUG, S.; OSTERMANN, J. A crop/weed field image dataset for the evaluation of computer vision based precision agriculture tasks. In: EUROPEAN CONFERENCE ON COMPUTER VISION WORKSHOPS, 2014. Proceedings [...]. Cham: Springer, 2015. p. 105-116.',
    'HE, K.; GKIOXARI, G.; DOLLÁR, P.; GIRSHICK, R. Mask R-CNN. In: IEEE INTERNATIONAL CONFERENCE ON COMPUTER VISION (ICCV), 2017. Proceedings [...]. 2017. p. 2961-2969.',
    'HUANG, J. et al. Speed/accuracy trade-offs for modern convolutional object detectors. In: IEEE CONFERENCE ON COMPUTER VISION AND PATTERN RECOGNITION (CVPR), 2017. Proceedings [...]. 2017. p. 7310-7311.',
    'JOCHER, G.; QIU, J.; CHAURASIA, A. Ultralytics YOLO. Versão 8.0.0. 2023. Software. Disponível em: https://github.com/ultralytics/ultralytics.',
    'KAPOOR, S.; NARAYANAN, A. Leakage and the reproducibility crisis in machine-learning-based science. Patterns, v. 4, n. 9, 100804, 2023. DOI: 10.1016/j.patter.2023.100804.',
    'LEAL, I.; JAYSON, A.; LIRA, R.; VELOSO, R.; OSEAS, A.; BENJAMIN, M. Automatic cattle detection and counting system in aerial images using computer vision algorithms. In: ENCONTRO NACIONAL DE INTELIGÊNCIA ARTIFICIAL E COMPUTACIONAL (ENIAC), 21., 2024, Belém. Anais [...]. Porto Alegre: SBC, 2024. p. 472-483. DOI: 10.5753/eniac.2024.245107.',
    'LECUN, Y.; BENGIO, Y.; HINTON, G. Deep learning. Nature, v. 521, p. 436-444, 2015.',
    'LIN, T.-Y. et al. Microsoft COCO: common objects in context. In: EUROPEAN CONFERENCE ON COMPUTER VISION (ECCV), 2014. Proceedings [...]. Cham: Springer, 2014. p. 740-755.',
    'LIN, T.-Y.; DOLLÁR, P.; GIRSHICK, R.; HE, K.; HARIHARAN, B.; BELONGIE, S. Feature pyramid networks for object detection. In: IEEE CONFERENCE ON COMPUTER VISION AND PATTERN RECOGNITION (CVPR), 2017. Proceedings [...]. 2017. p. 2117-2125.',
    'NORTHCUTT, C. G.; ATHALYE, A.; MUELLER, J. Pervasive label errors in test sets destabilize machine learning benchmarks. In: NEURAL INFORMATION PROCESSING SYSTEMS TRACK ON DATASETS AND BENCHMARKS, 2021. Proceedings [...]. 2021.',
    'NOYAN, M. A. Uncovering bias in the PlantVillage dataset. arXiv, 2206.04374, 2022.',
    'OSCO, L. P. et al. A convolutional neural network approach for counting and geolocating citrus-trees in UAV multispectral imagery. ISPRS Journal of Photogrammetry and Remote Sensing, v. 160, p. 97-106, 2020. DOI: 10.1016/j.isprsjprs.2019.12.010.',
    'OTSU, N. A threshold selection method from gray-level histograms. IEEE Transactions on Systems, Man, and Cybernetics, v. 9, n. 1, p. 62-66, 1979.',
    'PADILLA, R.; NETTO, S. L.; DA SILVA, E. A. B. A survey on performance metrics for object-detection algorithms. In: INTERNATIONAL CONFERENCE ON SYSTEMS, SIGNALS AND IMAGE PROCESSING (IWSSIP), 2020. Proceedings [...]. 2020. p. 237-242. DOI: 10.1109/IWSSIP48289.2020.9145130.',
    'PAPADOPOULOS, D. P.; UIJLINGS, J. R. R.; KELLER, F.; FERRARI, V. Extreme clicking for efficient object annotation. In: IEEE INTERNATIONAL CONFERENCE ON COMPUTER VISION (ICCV), 2017. Proceedings [...]. 2017. p. 4930-4939.',
    'REDMON, J.; DIVVALA, S.; GIRSHICK, R.; FARHADI, A. You only look once: unified, real-time object detection. In: IEEE CONFERENCE ON COMPUTER VISION AND PATTERN RECOGNITION (CVPR), 2016. Proceedings [...]. 2016. p. 779-788.',
    'REN, S.; HE, K.; GIRSHICK, R.; SUN, J. Faster R-CNN: towards real-time object detection with region proposal networks. IEEE Transactions on Pattern Analysis and Machine Intelligence, v. 39, n. 6, p. 1137-1149, 2017.',
    'ROBERTS, D. R. et al. Cross-validation strategies for data with temporal, spatial, hierarchical, or phylogenetic structure. Ecography, v. 40, n. 8, p. 913-929, 2017. DOI: 10.1111/ecog.02881.',
    'RONNEBERGER, O.; FISCHER, P.; BROX, T. U-Net: convolutional networks for biomedical image segmentation. In: MEDICAL IMAGE COMPUTING AND COMPUTER-ASSISTED INTERVENTION (MICCAI), 2015. Proceedings [...]. Cham: Springer, 2015. p. 234-241.',
    'SALVADORI, E. Identificação de plantas de milho utilizando imagens aéreas obtidas por VANTs. 2020. Trabalho de Conclusão de Curso (Bacharelado em Ciência da Computação), Universidade Tecnológica Federal do Paraná, Ponta Grossa, 2020.',
    'SANTOS, T. T.; DE SOUZA, L. L.; DOS SANTOS, A. A.; AVILA, S. Grape detection, segmentation, and tracking using deep neural networks and three-dimensional association. Computers and Electronics in Agriculture, v. 170, 105247, 2020. DOI: 10.1016/j.compag.2020.105247.',
    'TIAN, Z.; SHEN, C.; CHEN, H.; HE, T. FCOS: fully convolutional one-stage object detection. In: IEEE/CVF INTERNATIONAL CONFERENCE ON COMPUTER VISION (ICCV), 2019. Proceedings [...]. 2019. p. 9627-9636.',
    'UIJLINGS, J. R. R.; VAN DE SANDE, K. E. A.; GEVERS, T.; SMEULDERS, A. W. M. Selective search for object recognition. International Journal of Computer Vision, v. 104, p. 154-171, 2013.',
    'WOEBBECKE, D. M.; MEYER, G. E.; VON BARGEN, K.; MORTENSEN, D. A. Color indices for weed identification under various soil, residue, and lighting conditions. Transactions of the ASAE, v. 38, n. 1, p. 259-269, 1995.',
    'ZHAO, Y. et al. DETRs beat YOLOs on real-time object detection. In: IEEE/CVF CONFERENCE ON COMPUTER VISION AND PATTERN RECOGNITION (CVPR), 2024. Proceedings [...]. 2024. p. 16965-16974.',
  ],
}
