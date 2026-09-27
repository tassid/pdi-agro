# Pixel no Campo: Processamento Digital de Imagens aplicado ao agronegócio

Material didático interativo com 6 aulas de 60 minutos, de Tassiane Anzolin (PPGTCA/UTFPR Medianeira).

Graduação em Ciência da Computação (OP63I, Processamento de Imagens e Reconhecimento de Padrões):

1. A lavoura vira uma planilha → aquisição, amostragem e quantização, espaços de cor, histograma
2. Receitas aplicadas em cada pixel → transformações de intensidade, convolução, morfologia matemática
3. Segmentar, rotular, medir → Otsu, índices de vegetação, componentes conexos, descritores

Mestrado (PPGTCA):

4. Enxergar além do verde → assinatura espectral, NDVI/NDRE/SAVI, zonas de manejo, taxa variável
5. Reconhecer padrões sem se enganar → descritores, k-NN, Bayes, matriz de confusão, validação por grupo
6. Redes que aprendem a enxergar → CNN treinada no navegador, transfer learning, aprendizado por atalho

Cada aula tem um caso real (artigo, boletim da Embrapa ou TCC da UTFPR Medianeira) reproduzido num laboratório: tomates por cor (Aula 1), contagem de frangos em aviário (Aula 2), severidade em folhas de laranjeira e mapa por IDP (Aula 3), NDVI em vinhedos e falhas na linha de soja com drone (Aula 4), cobertura de braquiária em citros com Random Forest (Aula 5).

A página inicial também lista leituras da casa: trabalhos da UTFPR (RIUT e Revista de Computação Aplicada ao Agronegócio) que continuam os casos, para desafios e seminários.

Cada aula traz roteiro de 60 min, laboratórios que rodam no navegador (com imagens sintéticas ou foto do aluno), código Python para o Colab, quiz, desafios e leitura da bibliografia da disciplina.

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
  lib/ml.ts      k-NN, mínima distância, Bayes, validação cruzada
  lib/cnn.ts     CNN pequena com retropropagação em TypeScript puro
  lib/casos.ts   cenas e métodos dos casos reais (tomate, aviário, laranjeira, vinhedo, soja, citros)
  casos/         laboratórios e fichas dos casos reais
  aulas/         conteúdo das 6 aulas
```
