# Pixel no Campo · Visão computacional aplicada com CVAT e YOLO

Guia interativo de **2 aulas de 4 horas** (240 min cada, com intervalo de 20 min), de Tassiane Anzolin (PPGTCA/UTFPR Medianeira), seguindo o plano de aula "Visão Computacional Aplicada com CVAT e YOLO".

Cada bloco da aula tem **slides integrados → teoria → exemplo → prática**. As figuras são geradas em Python a partir de **fotos reais** de dois bancos públicos (WGISD da Embrapa e CWFID), e os laboratórios rodam no navegador ou no Colab.

| Aula | Blocos | Notebook |
|---|---|---|
| 1 · Fundamentos de detecção e engenharia de dados | 1.1 PDI clássico e as quatro tarefas · 1.2 R-CNN, U-Net, YOLO e formatos de caixa · 1.3 IoU, NMS, GSD e primeira inferência · 1.4 anotação no CVAT · 1.5 Lab: auditoria e divisão por grupo · 1.6 leitura crítica (Leal et al., ENIAC 2024) | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/tassid/pdi-agro/blob/main/notebooks/Aula1_Anotacao_Auditoria_Split.ipynb) |
| 2 · Redes neurais, treinamento e avaliação em campo | 2.1 ambiente · 2.2 perceptron, XOR, CNN e transfer learning · 2.3 treino YOLO, perdas, augmentation, SAHI · 2.4 curvas, P, R, F1, mAP, grade × aleatória · 2.5 Lab: mudança de domínio, rastreamento, exportação · 2.6 pesquisa aplicada e trabalho | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/tassid/pdi-agro/blob/main/notebooks/Aula2_Treino_Avaliacao_Dominio.ipynb) |
| Extra · YOLOWeeds (Dang et al., 2023) | modelos de tamanhos diferentes, augmentation, Monte-Carlo | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/tassid/pdi-agro/blob/main/notebooks/Extra_YOLOWeeds.ipynb) |

## Bancos de imagens

1. **WGISD** · Santos, T. T. et al. (2020). Grape detection, segmentation, and tracking using deep neural networks and three-dimensional association. *Computers and Electronics in Agriculture* 170, 105247. https://github.com/thsant/wgisd (CC BY-NC 4.0)
2. **CWFID** · Haug, S.; Ostermann, J. (2014). A Crop/Weed Field Image Dataset for the Evaluation of Computer Vision Based Precision Agriculture Tasks. ECCV Workshops. https://github.com/cwfid/dataset

## Figuras

```bash
pip install opencv-contrib-python matplotlib pillow numpy
python scripts/gerar_figuras.py   # baixa as fotos para scripts/dados/ e gera public/fig/*.jpg e labs.json
```

## Site

```bash
npm install
npm run dev            # desenvolvimento
npm run build          # GitHub Pages (dist/), publicado pelo workflow a cada push na main
npm run build:single   # um único index.html autocontido
```

```
src/
  App.tsx          início e navegação (#inicio, #aula1, #aula2)
  curso.tsx        modelo de aula e bloco, página da aula, slides integrados e modo apresentação
  labs.tsx         laboratórios no navegador: IoU, NMS, conversor de caixas, perceptron, vazamento
  aulas/Aula1.tsx  conteúdo da Aula 1
  aulas/Aula2.tsx  conteúdo da Aula 2
scripts/gerar_figuras.py
notebooks/
archive/site-v1/   versão anterior (8 aulas de 60 min e módulo YOLO de 2 × 3 h), preservada como estava
```
