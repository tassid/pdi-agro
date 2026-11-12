# Pixel no Campo: Processamento Digital de Imagens aplicado ao agronegócio

Material didático interativo com 6 aulas de 60 minutos e um módulo de 2 aulas de 3 horas sobre YOLO, de Tassiane Anzolin (PPGTCA/UTFPR Medianeira).

Graduação em Ciência da Computação (OP63I, Processamento de Imagens e Reconhecimento de Padrões):

1. A lavoura vira uma planilha → aquisição, amostragem e quantização, espaços de cor, histograma
2. Receitas aplicadas em cada pixel → transformações de intensidade, convolução, morfologia matemática
3. Segmentar, rotular, medir → Otsu, índices de vegetação, componentes conexos, descritores

Mestrado (PPGTCA):

4. Enxergar além do verde → assinatura espectral, NDVI/NDRE/SAVI, zonas de manejo, taxa variável
5. Reconhecer padrões sem se enganar → descritores, k-NN, Bayes, matriz de confusão, validação por grupo
6. Redes que aprendem a enxergar → CNN treinada no navegador, transfer learning, aprendizado por atalho

Módulo YOLO (2 aulas de 3 horas, com intervalo):

7. Onde está e quantos são → perceptron (AND, OR e o XOR), MLP e CNN, classificar × segmentar × detectar, U-Net, R-CNN × YOLO, função de perda, as cinco tarefas do YOLO, rótulo no formato YOLO, IoU, grade e cabeças (P3/P4/P5), sem âncora, NMS e o YOLO26 sem NMS, inferência com ultralytics. Caso real: gado contado por drone no Piauí (Leal et al., ENIAC 2024)
8. Treinar, medir e levar pro campo → rotular no CVAT (classificação, detecção e segmentação), data.yaml e validação de rótulos, parada antecipada, busca em grade e aleatória, split por voo, GSD × imgsz × fatias (SAHI), treino do yolo26n, P, R, mAP50, mAP50-95, mudança de domínio, rastreamento e contagem no brete, exportação. Caso real: Global Wheat Head Detection (David et al., 2020)

Cada aula tem um caso real (artigo, boletim da Embrapa ou TCC da UTFPR Medianeira) reproduzido num laboratório: tomates por cor (Aula 1), contagem de frangos em aviário (Aula 2), severidade em folhas de laranjeira e mapa por IDP (Aula 3), NDVI em vinhedos e falhas na linha de soja com drone (Aula 4), cobertura de braquiária em citros com Random Forest (Aula 5).

A página inicial também lista leituras da casa: trabalhos da UTFPR (RIUT e Revista de Computação Aplicada ao Agronegócio) que continuam os casos, para desafios e seminários.

Cada aula traz roteiro de 60 min, laboratórios que rodam no navegador (com imagens sintéticas ou foto do aluno), código Python para o Colab, quiz, desafios e leitura da bibliografia da disciplina.

## Notebooks (Google Colab)

| Aula | Tema | Abrir no Colab |
|------|------|----------------|
| 1 | Imagem como matriz, espaços de cor, GSD | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/tassid/pdi-agro/blob/main/notebooks/Aula1_Imagem_como_Matriz.ipynb) |
| 2 | Transformações, filtros, morfologia | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/tassid/pdi-agro/blob/main/notebooks/Aula2_Transformacoes_Filtros_Morfologia.ipynb) |
| 3 | Segmentação, rotulação, descritores | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/tassid/pdi-agro/blob/main/notebooks/Aula3_Segmentacao_Rotulacao_Descritores.ipynb) |
| 4 | Índices espectrais, zonas de manejo | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/tassid/pdi-agro/blob/main/notebooks/Aula4_Indices_Espectrais_Zonas.ipynb) |
| 5 | Classificação, validação por grupo | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/tassid/pdi-agro/blob/main/notebooks/Aula5_Classificacao_Validacao.ipynb) |
| 6 | CNN, transfer learning, YOLO | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/tassid/pdi-agro/blob/main/notebooks/Aula6_Redes_Neurais_CNN.ipynb) |
| 7 | Perceptron e MLP, YOLO pronto, IoU e NMS à mão, piquete sintético | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/tassid/pdi-agro/blob/main/notebooks/Aula7_YOLO_Deteccao.ipynb) |
| 8 | Banco por voo, treino do yolo26n, grade de hiperparâmetros, mAP, fazenda B, segmentação e classificação, brete, exportação | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/tassid/pdi-agro/blob/main/notebooks/Aula8_YOLO_Treino_Avaliacao.ipynb) |

## Rodando localmente

```bash
npm install
npm run dev
```

## Build

```bash
npm run build          # site para o GitHub Pages, em dist/
npm run build:single   # um único index.html autocontido, em dist-single/
```

## Deploy

Igual ao projeto do microbioma: suba o repositório no GitHub, ative Pages com a fonte "GitHub Actions", e cada push na `main` publica o site pelo workflow em `.github/workflows/deploy.yml`.

## Estrutura

```
src/
  App.tsx        início e navegação entre aulas (#aula1 … #aula6)
  lesson.tsx     layout da aula: roteiro, sumário, quiz, desafios, leitura
  ui.tsx         componentes (canvas de imagem, sliders, quiz, código)
  lib/img.ts     operações de PDI (cor, histograma, convolução, morfologia, Otsu, rotulação)
  lib/synth.ts   gerador de imagens sintéticas (talhão, folhas, sementes, bandas multiespectrais)
  lib/neuro.ts   perceptron, MLP com Adam, parada antecipada e busca de hiperparâmetros
  lib/yolo.ts    caixas, IoU, NMS, curva PR, mAP, rastreador e o gerador de piquetes vistos de drone
  lib/ml.ts      k-NN, mínima distância, Bayes, validação cruzada
  lib/cnn.ts     CNN pequena com retropropagação em TypeScript puro
  lib/casos.ts   cenas e métodos dos casos reais (tomate, aviário, laranjeira, vinhedo, soja, citros)
  casos/         laboratórios e fichas dos casos reais
  aulas/         conteúdo das 6 aulas
```
