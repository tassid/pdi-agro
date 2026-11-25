"""
Gera todas as figuras do site a partir de fotos REAIS de dois bancos públicos:

  WGISD (Embrapa Wine Grape Instance Segmentation Dataset)
    Santos et al. (2020), Computers and Electronics in Agriculture 170, 105247
    https://github.com/thsant/wgisd  (licença CC BY-NC 4.0)
    cachos de uva de 5 variedades, com caixas no formato YOLO e máscaras de instância

  CWFID (Crop/Weed Field Image Dataset)
    Haug e Ostermann (2014), ECCV Workshops
    https://github.com/cwfid/dataset
    cenouras e plantas daninhas fotografadas em campo, com máscara de planta e rótulo cultura/daninha

Uso:
    python scripts/gerar_figuras.py            # baixa os dados (uma vez) e gera public/fig/*.jpg

Cada função fig_* gera uma figura citada no site; o nome do arquivo é o nome da função.
"""
from __future__ import annotations

import os
import urllib.request
from pathlib import Path

import cv2
import matplotlib

matplotlib.use("Agg")
import matplotlib.patches as patches
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image

RAIZ = Path(__file__).resolve().parent
DADOS = RAIZ / "dados"
SAIDA = RAIZ.parent / "public" / "fig"
SAIDA.mkdir(parents=True, exist_ok=True)
DADOS.mkdir(exist_ok=True)

AZUL = "#131a9f"
AMARELO = "#ffe000"
VERDE = "#228b22"
VERMELHO = "#b22222"
RNG = np.random.default_rng(42)

WGISD = "https://raw.githubusercontent.com/thsant/wgisd/master/data/"
CWFID = "https://raw.githubusercontent.com/cwfid/dataset/master/"

VARIEDADES = {
    "CDY": ("Chardonnay", ["CDY_2017", "CDY_2026", "CDY_2038"]),
    "CFR": ("Cabernet Franc", ["CFR_1622", "CFR_1634", "CFR_1646"]),
    "CSV": ("Cabernet Sauvignon", ["CSV_1881", "CSV_1867", "CSV_1896"]),
    "SVB": ("Sauvignon Blanc", ["SVB_1931", "SVB_1943", "SVB_1955"]),
    "SYH": ("Syrah", ["SYH_2017-04-27_1236", "SYH_2017-04-27_1265", "SYH_2017-04-27_1294"]),
}

# amostra de 64 fotos (cerca de 13 por variedade) usada nas estatísticas do banco
AMOSTRA = ['CDY_2015', 'CDY_2017', 'CDY_20180427_152937457_BURST000_COVER_TOP', 'CDY_20180427_153201477_BURST000_COVER_TOP', 'CDY_20180427_153409150_BURST000_COVER_TOP', 'CDY_20180427_153615626_BURST000_COVER_TOP', 'CDY_2024', 'CDY_2026', 'CDY_2030', 'CDY_2036', 'CDY_2038', 'CDY_2042', 'CDY_2048', 'CFR_1620', 'CFR_1622', 'CFR_1626', 'CFR_1632', 'CFR_1634', 'CFR_1638', 'CFR_1644', 'CFR_1646', 'CFR_1651', 'CFR_1657', 'CFR_1659', 'CFR_1663', 'CFR_1671', 'CSV_1865', 'CSV_1867', 'CSV_1871', 'CSV_1878', 'CSV_1881', 'CSV_1886', 'CSV_1893', 'CSV_1896', 'CSV_1900', 'CSV_1906', 'CSV_1908', 'CSV_20180427_144507419', 'CSV_20180427_144556277', 'SVB_1929', 'SVB_1931', 'SVB_1935', 'SVB_1941', 'SVB_1943', 'SVB_1947', 'SVB_1953', 'SVB_1955', 'SVB_1959', 'SVB_1965', 'SVB_1967', 'SVB_1971', 'SVB_1977', 'SYH_2017-04-27_1232', 'SYH_2017-04-27_1236', 'SYH_2017-04-27_1243', 'SYH_2017-04-27_1262', 'SYH_2017-04-27_1265', 'SYH_2017-04-27_1273', 'SYH_2017-04-27_1291', 'SYH_2017-04-27_1294', 'SYH_2017-04-27_1310', 'SYH_2017-04-27_1320', 'SYH_2017-04-27_1324', 'SYH_2017-04-27_1334']

plt.rcParams.update({"font.size": 12, "axes.titlesize": 13, "axes.titleweight": "bold", "font.family": "DejaVu Sans"})


# ------------------------------------------------------------------ dados
def baixar(url: str, destino: Path) -> Path:
    if not destino.exists():
        print("baixando", url)
        urllib.request.urlretrieve(url, destino)
    return destino


def uva(nome: str, mascara: bool = False):
    img = np.array(Image.open(baixar(WGISD + nome + ".jpg", DADOS / f"{nome}.jpg")).convert("RGB"))
    txt = baixar(WGISD + nome + ".txt", DADOS / f"{nome}.txt").read_text().split("\n")
    caixas = np.array([list(map(float, l.split()[1:])) for l in txt if l.strip()])  # xc yc w h (relativo)
    if mascara:
        m = np.load(baixar(WGISD + nome + ".npz", DADOS / f"{nome}.npz"))["arr_0"]
        return img, caixas, m
    return img, caixas


def cenoura(i: str = "001"):
    img = np.array(Image.open(baixar(f"{CWFID}images/{i}_image.png", DADOS / f"cwfid_{i}_image.png")).convert("RGB"))
    anot = np.array(Image.open(baixar(f"{CWFID}annotations/{i}_annotation.png", DADOS / f"cwfid_{i}_annotation.png")).convert("RGB"))
    return img, anot


def yolo_para_xyxy(c, w, h):
    xc, yc, bw, bh = c
    return np.array([(xc - bw / 2) * w, (yc - bh / 2) * h, (xc + bw / 2) * w, (yc + bh / 2) * h])


def iou(a, b):
    x1, y1 = max(a[0], b[0]), max(a[1], b[1])
    x2, y2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    ua = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / ua if ua > 0 else 0.0


def caixa(ax, b, cor=AMARELO, lw=2.5, txt=None, ls="-"):
    ax.add_patch(patches.Rectangle((b[0], b[1]), b[2] - b[0], b[3] - b[1], fill=False, ec=cor, lw=lw, ls=ls))
    if txt:
        ax.text(b[0], b[1] - 6, txt, color="black", fontsize=10, fontweight="bold",
                bbox=dict(fc=cor, ec="none", pad=1.5))


def salvar(fig, nome):
    caminho = SAIDA / f"{nome}.jpg"
    fig.savefig(caminho, dpi=110, bbox_inches="tight", facecolor="white", pil_kwargs={"quality": 82, "optimize": True})
    plt.close(fig)
    print("ok", caminho.name)


def limpar(axes):
    for ax in np.atleast_1d(axes).flat:
        ax.set_xticks([]); ax.set_yticks([])
        for s in ax.spines.values():
            s.set_visible(False)


def exg_mascara(img):
    f = img.astype(np.float32) / 255
    s = f.sum(2) + 1e-6
    r, g, b = f[..., 0] / s, f[..., 1] / s, f[..., 2] / s
    exg = 2 * g - r - b
    e8 = cv2.normalize(exg, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    _, m = cv2.threshold(e8, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return exg, m


# ------------------------------------------------------------------ AULA 1
def fig_pipeline_classico():
    img, _ = cenoura("001")
    exg, m = exg_mascara(img)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m)
    cores = RNG.integers(60, 255, (n, 3)); cores[0] = 0
    rot = cores[lab].astype(np.uint8)
    fig, ax = plt.subplots(1, 4, figsize=(16, 5.4))
    for a, im, t in zip(ax, [img, exg, m, rot], ["1. aquisição (foto RGB)", "2. realce: índice ExG", "3. segmentação: Otsu", f"4. rotulação: {n - 1} objetos"]):
        a.imshow(im, cmap="RdYlGn" if im is exg else "gray"); a.set_title(t)
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area > 400:
            ax[3].add_patch(patches.Rectangle((x, y), w, h, fill=False, ec=AMARELO, lw=1.5))
    limpar(ax)
    fig.suptitle("Cadeia clássica de processamento aplicada a uma imagem do CWFID: cada etapa é definida explicitamente", fontsize=13, y=0.98)
    salvar(fig, "pipeline_classico")


def fig_classico_falha():
    """a mesma regra (ExG + Otsu) que funcionou na cenoura, aplicada à uva"""
    img, _ = uva("CSV_1881")
    _, m = exg_mascara(img)
    fig, ax = plt.subplots(1, 2, figsize=(13, 4.8))
    ax[0].imshow(img); ax[0].set_title("Vinhedo (WGISD, Cabernet Sauvignon)")
    ax[1].imshow(m, cmap="gray"); ax[1].set_title("ExG + Otsu: segmenta a folhagem, não os cachos")
    limpar(ax)
    salvar(fig, "classico_falha")


def fig_quatro_tarefas():
    img, cx, m = uva("CDY_2017", mascara=True)
    h, w = img.shape[:2]
    fig, ax = plt.subplots(1, 4, figsize=(18, 4.4))
    ax[0].imshow(img); ax[0].set_title("Classificação")
    ax[0].text(30, 120, "uva: Chardonnay (0,97)", fontsize=13, fontweight="bold", bbox=dict(fc=AMARELO, ec="none"))
    ax[1].imshow(img); ax[1].set_title(f"Detecção: {len(cx)} caixas")
    for c in cx:
        caixa(ax[1], yolo_para_xyxy(c, w, h))
    sem = m.max(2) > 0
    ov = img.copy(); ov[sem] = (0.45 * ov[sem] + 0.55 * np.array([255, 224, 0])).astype(np.uint8)
    ax[2].imshow(ov); ax[2].set_title("Segmentação semântica")
    ins = img.copy()
    paleta = (plt.cm.tab20(np.linspace(0, 1, m.shape[2]))[:, :3] * 255).astype(np.uint8)
    for k in range(m.shape[2]):
        s = m[..., k] > 0
        ins[s] = (0.4 * ins[s] + 0.6 * paleta[k]).astype(np.uint8)
    ax[3].imshow(ins); ax[3].set_title(f"Segmentação de instâncias: {m.shape[2]} cachos")
    limpar(ax)
    salvar(fig, "quatro_tarefas")


def fig_formatos():
    img, cx = uva("CFR_1634")
    h, w = img.shape[:2]
    centrais = cx[(cx[:, 0] > 0.2) & (cx[:, 0] < 0.8)]
    c = centrais[np.argmax(centrais[:, 2] * centrais[:, 3])]
    b = yolo_para_xyxy(c, w, h)
    pad = 120
    x0, y0 = int(max(0, b[0] - pad)), int(max(0, b[1] - pad))
    x1, y1 = int(min(w, b[2] + pad)), int(min(h, b[3] + pad))
    fig, ax = plt.subplots(figsize=(11, 7))
    ax.imshow(img[y0:y1, x0:x1])
    bb = b - np.array([x0, y0, x0, y0])
    caixa(ax, bb, lw=3)
    ax.plot([bb[0]], [bb[1]], "o", color=VERMELHO, ms=10); ax.plot([bb[2]], [bb[3]], "o", color=VERMELHO, ms=10)
    ax.plot([(bb[0] + bb[2]) / 2], [(bb[1] + bb[3]) / 2], "x", color=AMARELO, ms=16, mew=4)
    xyxy = f"xyxy (pixels):  {b[0]:.0f}, {b[1]:.0f}, {b[2]:.0f}, {b[3]:.0f}"
    coco = f"COCO (pixels):  x={b[0]:.0f}, y={b[1]:.0f}, w={b[2] - b[0]:.0f}, h={b[3] - b[1]:.0f}"
    yol = f"YOLO (0 a 1):   0 {c[0]:.4f} {c[1]:.4f} {c[2]:.4f} {c[3]:.4f}"
    ax.text(0.01, -0.04, f"imagem {w} × {h} px\n{xyxy}\n{coco}\n{yol}", transform=ax.transAxes, va="top",
            family="monospace", fontsize=12, bbox=dict(fc="white", ec=AZUL, lw=2))
    ax.set_title("Cacho anotado do WGISD (Cabernet Franc) em três representações")
    limpar(ax)
    salvar(fig, "formatos_caixa")


def fig_grade_yolo():
    img, cx = uva("SVB_1943")
    h, w = img.shape[:2]
    S = 8
    fig, ax = plt.subplots(figsize=(12, 8))
    ax.imshow(img)
    for i in range(1, S):
        ax.axvline(i * w / S, color="white", lw=1, alpha=0.7); ax.axhline(i * h / S, color="white", lw=1, alpha=0.7)
    for c in cx:
        b = yolo_para_xyxy(c, w, h)
        caixa(ax, b, lw=2)
        gx, gy = int(c[0] * S), int(c[1] * S)
        ax.add_patch(patches.Rectangle((gx * w / S, gy * h / S), w / S, h / S, fc=AZUL, alpha=0.35))
        ax.plot(c[0] * w, c[1] * h, "o", color=AMARELO, ms=7, mec="black")
    ax.set_title(f"Grade {S}×{S}: a célula que contém o centro do cacho é a responsável por prevê-lo")
    limpar(ax)
    salvar(fig, "grade_yolo")


def fig_rcnn_vs_yolo():
    img, cx = uva("CSV_1867")
    h, w = img.shape[:2]
    small = cv2.resize(img, (w // 3, h // 3))
    ss = cv2.ximgproc.segmentation.createSelectiveSearchSegmentation()
    ss.setBaseImage(cv2.cvtColor(small, cv2.COLOR_RGB2BGR)); ss.switchToSelectiveSearchFast()
    rects = ss.process()[:400]
    fig, ax = plt.subplots(1, 2, figsize=(16, 5.6))
    ax[0].imshow(small)
    for (x, y, rw, rh) in rects[::2]:
        ax[0].add_patch(patches.Rectangle((x, y), rw, rh, fill=False, ec=AMARELO, lw=0.6, alpha=0.7))
    ax[0].set_title(f"R-CNN, 1º estágio: {len(rects)} regiões candidatas\n(selective search), cada uma vai para a CNN")
    S = 8
    ax[1].imshow(img)
    for i in range(1, S):
        ax[1].axvline(i * w / S, color="white", lw=0.8, alpha=0.6); ax[1].axhline(i * h / S, color="white", lw=0.8, alpha=0.6)
    for c in cx:
        caixa(ax[1], yolo_para_xyxy(c, w, h), lw=2)
    ax[1].set_title("Um estágio: previsão densa de caixa e classe\nem todas as células, em uma única passagem")
    limpar(ax)
    salvar(fig, "rcnn_vs_yolo")


def fig_unet_cwfid():
    img, anot = cenoura("002")
    fig, ax = plt.subplots(1, 3, figsize=(15, 5.6))
    ax[0].imshow(img); ax[0].set_title("Entrada: imagem de campo")
    cor = np.zeros_like(img); cor[anot[..., 1] > 0] = (34, 139, 34); cor[anot[..., 0] > 0] = (178, 34, 34)
    ax[1].imshow(cor); ax[1].set_title("Saída esperada: rótulo por pixel\nverde = cenoura · vermelho = daninha")
    ov = img.copy(); msk = cor.sum(2) > 0
    ov[msk] = (0.4 * ov[msk] + 0.6 * cor[msk]).astype(np.uint8)
    ax[2].imshow(ov); ax[2].set_title("Sobreposição do rótulo à imagem")
    limpar(ax)
    salvar(fig, "unet_cwfid")


def fig_iou():
    img, cx = uva("CDY_2026")
    h, w = img.shape[:2]
    c = cx[np.argmax(cx[:, 2] * cx[:, 3])]
    g = yolo_para_xyxy(c, w, h)
    bw, bh = g[2] - g[0], g[3] - g[1]
    preds = [g + np.array([0.08 * bw, 0.05 * bh, 0.08 * bw, 0.05 * bh]),
             g + np.array([0.3 * bw, 0.2 * bh, 0.3 * bw, 0.2 * bh]),
             g + np.array([0.55 * bw, -0.1 * bh, 0.55 * bw, -0.1 * bh])]
    pad = int(0.8 * max(bw, bh))
    x0, y0 = int(max(0, g[0] - pad)), int(max(0, g[1] - pad))
    crop = img[y0:int(min(h, g[3] + pad)), x0:int(min(w, g[2] + pad))]
    off = np.array([x0, y0, x0, y0])
    fig, ax = plt.subplots(1, 3, figsize=(16, 5.6))
    for a, p in zip(ax, preds):
        v = iou(g, p)
        a.imshow(crop)
        caixa(a, g - off, cor="#00e676", lw=3, txt="real")
        caixa(a, p - off, cor=AMARELO if v >= 0.5 else "#ff5252", lw=3, ls="--", txt="prevista")
        a.set_title(f"IoU = {v:.2f}  →  {'acerto (TP)' if v >= 0.5 else 'erro (FP)'} com limiar 0,5")
    limpar(ax)
    salvar(fig, "iou_exemplos")


def fig_iou_pequeno():
    fig, ax = plt.subplots(1, 2, figsize=(12, 4.6))
    for a, (tam, nome) in zip(ax, [(200, "cacho grande (200 px)"), (24, "baga pequena (24 px)")]):
        g = np.array([0, 0, tam, tam]); p = g + 10
        v = iou(g, p)
        a.add_patch(patches.Rectangle((0, 0), tam, tam, fc="#00e676", alpha=0.35, ec="#00a152", lw=2))
        a.add_patch(patches.Rectangle((10, 10), tam, tam, fill=False, ec=VERMELHO, lw=2, ls="--"))
        a.set_xlim(-10, tam + 25); a.set_ylim(tam + 25, -10); a.set_aspect("equal")
        a.set_title(f"{nome}\ndeslocamento de 10 px → IoU = {v:.2f}")
    limpar(ax)
    salvar(fig, "iou_pequeno")


def _deteccoes_simuladas(cx, w, h, n_fp=6, seed=0):
    r = np.random.default_rng(seed)
    dets = []
    for c in cx:
        g = yolo_para_xyxy(c, w, h); bw, bh = g[2] - g[0], g[3] - g[1]
        for k in range(r.integers(3, 6)):
            j = r.normal(0, 0.08, 4) * np.array([bw, bh, bw, bh])
            dets.append((*(g + j), float(np.clip(r.normal(0.78 - 0.1 * k, 0.08), 0.05, 0.99)), 1))
    for _ in range(n_fp):
        x, y = r.uniform(0, w * 0.85), r.uniform(0, h * 0.85); s = r.uniform(80, 220)
        dets.append((x, y, x + s, y + s * 1.4, float(r.uniform(0.05, 0.5)), 0))
    return np.array(dets)


def nms(d, thr):
    d = d[np.argsort(-d[:, 4])]; keep = []
    while len(d):
        keep.append(d[0]); d = np.array([x for x in d[1:] if iou(keep[-1], x) < thr])
    return np.array(keep)


def fig_nms():
    img, cx = uva("SVB_1955")
    h, w = img.shape[:2]
    d = _deteccoes_simuladas(cx, w, h)
    k = nms(d[d[:, 4] >= 0.25], 0.5)
    fig, ax = plt.subplots(1, 2, figsize=(16, 5.6))
    ax[0].imshow(img); ax[1].imshow(img)
    for x in d:
        caixa(ax[0], x, cor=AMARELO if x[4] >= 0.25 else "#ff8a80", lw=1.2)
    for x in k:
        caixa(ax[1], x, lw=2.5, txt=f"{x[4]:.2f}")
    ax[0].set_title(f"Saída bruta da rede: {len(d)} caixas (rosa = confiança < 0,25)")
    ax[1].set_title(f"Depois de conf ≥ 0,25 e NMS com IoU 0,5: {len(k)} caixas")
    limpar(ax)
    salvar(fig, "nms_antes_depois")


def fig_gsd():
    img, cx = uva("CFR_1646")
    h, w = img.shape[:2]
    c = cx[0]; b = yolo_para_xyxy(c, w, h).astype(int)
    pad = 160
    crop = img[max(0, b[1] - pad):b[3] + pad, max(0, b[0] - pad):b[2] + pad]
    fig, ax = plt.subplots(1, 4, figsize=(16, 4.6))
    for a, f in zip(ax, [1, 4, 8, 16]):
        pequeno = cv2.resize(crop, (max(1, crop.shape[1] // f), max(1, crop.shape[0] // f)), interpolation=cv2.INTER_AREA)
        a.imshow(pequeno, interpolation="nearest")
        a.set_title(f"resolução ÷{f}: cacho com ~{(b[2] - b[0]) // f} px")
    limpar(ax)
    fig.suptitle("Redução de resolução: o mesmo cacho representado por número decrescente de pixels", y=1.02)
    salvar(fig, "gsd_resolucao")


def fig_ambiguidade():
    img, cx = uva("SVB_1931")
    h, w = img.shape[:2]
    fig, ax = plt.subplots(1, 3, figsize=(18, 4.6))
    for a in ax: a.imshow(img)
    for c in cx:
        caixa(ax[0], yolo_para_xyxy(c, w, h), lw=2)
    r = np.random.default_rng(3)
    for c in cx:
        b = yolo_para_xyxy(c, w, h); bw, bh = b[2] - b[0], b[3] - b[1]
        caixa(ax[1], b + np.array([-0.15 * bw, -0.12 * bh, 0.15 * bw, 0.12 * bh]), cor="#40c4ff", lw=2)
    bs = np.array([yolo_para_xyxy(c, w, h) for c in cx])
    ordem = np.argsort(bs[:, 0]); grupos = np.array_split(ordem, max(1, len(cx) // 3))
    for gidx in grupos:
        g = bs[gidx]; caixa(ax[2], [g[:, 0].min(), g[:, 1].min(), g[:, 2].max(), g[:, 3].max()], cor="#ff5252", lw=2.5)
    ax[0].set_title("Critério A: caixa ajustada, um cacho por caixa")
    ax[1].set_title("Critério B: caixa com margem, inclui folhagem")
    ax[2].set_title("Critério C: cachos contíguos agrupados")
    limpar(ax)
    salvar(fig, "ambiguidade_anotacao")


def fig_auditoria():
    img, cx = uva("CDY_2038")
    h, w = img.shape[:2]
    fig, ax = plt.subplots(figsize=(12, 8))
    ax.imshow(img)
    for i, c in enumerate(cx):
        caixa(ax, yolo_para_xyxy(c, w, h), lw=2, txt="0 grape")
    b = yolo_para_xyxy(cx[0], w, h)
    caixa(ax, b + np.array([30, 40, 30, 40]), cor="#ff5252", lw=3, txt="duplicada", ls="--")
    caixa(ax, [w * 0.05, h * 0.05, w * 0.22, h * 0.25], cor="#ff5252", lw=3, txt="classe 3 (não existe)", ls="--")
    caixa(ax, [w * 0.86, h * 0.7, w * 1.08, h * 0.98], cor="#ff5252", lw=3, txt="x > 1 (fora da foto)", ls="--")
    ax.set_xlim(0, w); ax.set_ylim(h, 0)
    ax.set_title("Auditoria de rótulos: três inconsistências inseridas artificialmente (em vermelho)")
    limpar(ax)
    salvar(fig, "auditoria_rotulos")


def fig_split_grupos():
    fig, ax = plt.subplots(3, 5, figsize=(18, 8.6))
    for j, (cod, (nome, fotos)) in enumerate(VARIEDADES.items()):
        for i, f in enumerate(fotos):
            img, cx = uva(f)
            th = cv2.resize(img, (400, int(400 * img.shape[0] / img.shape[1])))
            ax[i, j].imshow(th)
            if i == 0:
                papel = {"CDY": "TREINO", "CFR": "TREINO", "CSV": "TREINO", "SVB": "VALIDAÇÃO", "SYH": "TESTE"}[cod]
                cor = {"TREINO": AZUL, "VALIDAÇÃO": "#b8860b", "TESTE": VERMELHO}[papel]
                ax[i, j].set_title(f"{nome}\n{papel}", color=cor)
    limpar(ax)
    fig.suptitle("Partição por grupo no WGISD: cada variedade é alocada integralmente a um único conjunto", y=1.0)
    salvar(fig, "split_por_grupo")


# ------------------------------------------------------------------ AULA 2
def fig_perceptron():
    X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]], float)
    alvos = {"AND": [0, 0, 0, 1], "OR": [0, 1, 1, 1], "XOR": [0, 1, 1, 0]}
    fig, ax = plt.subplots(1, 3, figsize=(15, 4.8))
    for a, (nome, y) in zip(ax, alvos.items()):
        y = np.array(y); wv = np.zeros(2); b = 0.0; eta = 0.2; erros = 0
        for ep in range(30):
            erros = 0
            for xi, yi in zip(X, y):
                p = int(wv @ xi + b > 0); e = yi - p
                wv += eta * e * xi; b += eta * e; erros += abs(e)
            if erros == 0:
                break
        xx, yy = np.meshgrid(np.linspace(-0.4, 1.4, 200), np.linspace(-0.4, 1.4, 200))
        zz = (wv[0] * xx + wv[1] * yy + b > 0)
        a.contourf(xx, yy, zz, levels=[-0.5, 0.5, 1.5], colors=["#fdecea", "#e3e6fb"])
        for xi, yi in zip(X, y):
            a.scatter(*xi, s=260, c=AZUL if yi else "white", edgecolors="black", lw=2, zorder=3)
        ok = "convergiu" if erros == 0 else f"não converge ({erros} erros após 30 épocas)"
        a.set_title(f"{nome}: w=({wv[0]:.1f}, {wv[1]:.1f}), b={b:.1f}\n{ok}")
        a.set_xlim(-0.4, 1.4); a.set_ylim(-0.4, 1.4); a.set_aspect("equal")
        a.set_xlabel("x₁"); a.set_ylabel("x₂")
    salvar(fig, "perceptron_and_or_xor")


def fig_ativacoes():
    z = np.linspace(-5, 5, 300)
    fig, ax = plt.subplots(figsize=(9, 4.4))
    ax.plot(z, (z > 0).astype(float), color="gray", lw=2, ls=":", label="degrau (perceptron)")
    ax.plot(z, 1 / (1 + np.exp(-z)), color=VERDE, lw=3, label="sigmoide")
    ax.plot(z, np.maximum(0, z), color=AZUL, lw=3, label="ReLU")
    ax.plot(z, z / (1 + np.exp(-z)), color="#b8860b", lw=3, ls="--", label="SiLU (usada no YOLO)")
    ax.set_ylim(-1, 4); ax.grid(alpha=0.3); ax.legend(); ax.set_xlabel("z = w·x + b"); ax.set_ylabel("ativação")
    ax.set_title("Funções de ativação")
    salvar(fig, "ativacoes")


def fig_filtros_conv():
    img, _ = cenoura("003")
    g = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY).astype(np.float32)
    g = g[250:850, 150:850]
    ks = {
        "Sobel x (bordas verticais)": np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], np.float32),
        "Sobel y (bordas horizontais)": np.array([[-1, -2, -1], [0, 0, 0], [1, 2, 1]], np.float32),
        "Laplaciano (detalhe fino)": np.array([[0, 1, 0], [1, -4, 1], [0, 1, 0]], np.float32),
        "Média 9×9 (suaviza)": np.ones((9, 9), np.float32) / 81,
    }
    fig, ax = plt.subplots(1, 5, figsize=(20, 4.6))
    ax[0].imshow(g, cmap="gray"); ax[0].set_title("Entrada (tons de cinza)")
    for a, (nome, k) in zip(ax[1:], ks.items()):
        r = cv2.filter2D(g, -1, k)
        v = np.abs(r) if "Média" not in nome else r
        a.imshow(v, cmap="magma" if "Média" not in nome else "gray", vmax=np.percentile(v, 99))
        a.set_title(nome)
    limpar(ax)
    fig.suptitle("Núcleos clássicos de convolução; em uma rede convolucional, os valores do núcleo são parâmetros aprendidos", y=1.02)
    salvar(fig, "filtros_conv")


def fig_augmentation():
    img, cx = uva("CFR_1659")
    h, w = img.shape[:2]
    small = cv2.resize(img, (w // 2, h // 2)); hs, ws = small.shape[:2]

    def desenha(a, im, cs, titulo):
        a.imshow(im); a.set_title(titulo)
        H, W = im.shape[:2]
        for c in cs:
            caixa(a, yolo_para_xyxy(c, W, H), lw=1.8)

    hsv = cv2.cvtColor(small, cv2.COLOR_RGB2HSV).astype(np.int32)
    hsv[..., 0] = (hsv[..., 0] + 8) % 180; hsv[..., 2] = np.clip(hsv[..., 2] * 0.6, 0, 255)
    escuro = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB)
    flip = small[:, ::-1]; cflip = cx.copy(); cflip[:, 0] = 1 - cflip[:, 0]
    escala = cv2.resize(small[hs // 4:3 * hs // 4, ws // 4:3 * ws // 4], (ws, hs))
    cesc = []
    for c in cx:
        xc, yc, bw, bh = (c[0] - 0.25) * 2, (c[1] - 0.25) * 2, c[2] * 2, c[3] * 2
        if 0 < xc < 1 and 0 < yc < 1:
            cesc.append([xc, yc, bw, bh])
    # mosaic com quatro fotos de variedades diferentes
    nomes = ["CFR_1659", "CDY_2017", "SVB_1967", "SYH_2017-04-27_1324"]
    mos = np.zeros((hs, ws, 3), np.uint8); cm = []
    for k, n in enumerate(nomes):
        im, cs = uva(n)
        q = cv2.resize(im, (ws // 2, hs // 2)); oy, ox = (k // 2) * hs // 2, (k % 2) * ws // 2
        mos[oy:oy + hs // 2, ox:ox + ws // 2] = q
        for c in cs:
            cm.append([c[0] / 2 + (k % 2) / 2, c[1] / 2 + (k // 2) / 2, c[2] / 2, c[3] / 2])
    fig, ax = plt.subplots(2, 3, figsize=(18, 8.4))
    desenha(ax[0, 0], small, cx, "Original")
    desenha(ax[0, 1], flip, cflip, "fliplr: espelha a foto E as caixas")
    desenha(ax[0, 2], escuro, cx, "hsv_h e hsv_v: fim de tarde, caixas iguais")
    desenha(ax[1, 0], escala, cesc, "scale: zoom de 2×, caixas cortadas somem")
    desenha(ax[1, 1], mos, cm, "mosaic: 4 fotos (4 variedades) numa só")
    blur = cv2.GaussianBlur(small, (0, 0), 6)
    desenha(ax[1, 2], blur, cx, "blur: câmera tremida no trator")
    limpar(ax)
    salvar(fig, "augmentation_real")


def fig_sahi():
    img, cx = uva("CDY_20180427_153409150_BURST000_COVER_TOP") if (DADOS / "CDY_20180427_153409150_BURST000_COVER_TOP.jpg").exists() or True else None
    h, w = img.shape[:2]
    fig, ax = plt.subplots(1, 2, figsize=(16, 5.6))
    ax[0].imshow(cv2.resize(img, (640, int(640 * h / w)))); ax[0].set_title(f"Foto inteira reduzida para 640 px\n(original {w}×{h}: cada cacho perde {w / 640:.1f}× de detalhe)")
    ax[1].imshow(img)
    t, ov = 640, 0.2
    passo = int(t * (1 - ov))
    for y in range(0, h - int(t * ov), passo):
        for x in range(0, w - int(t * ov), passo):
            ax[1].add_patch(patches.Rectangle((x, y), t, t, fill=False, ec=AMARELO, lw=1.5, alpha=0.9))
    for c in cx:
        caixa(ax[1], yolo_para_xyxy(c, w, h), cor="#00e676", lw=1.5)
    ax[1].set_title("Fatias de 640 px com 20% de sobreposição;\ninferência por fatia e combinação por NMS")
    limpar(ax)
    salvar(fig, "sahi_fatias")


def fig_curvas():
    ep = np.arange(1, 101)
    r = np.random.default_rng(1)
    tr = 2.6 * np.exp(-ep / 18) + 0.35 + r.normal(0, 0.02, ep.size)
    va = 2.6 * np.exp(-ep / 18) + 0.55 + 0.0009 * np.maximum(0, ep - 35) ** 1.6 + r.normal(0, 0.03, ep.size)
    m50 = 0.82 * (1 - np.exp(-ep / 14)) - 0.0000045 * np.maximum(0, ep - 35) ** 2.6 + r.normal(0, 0.008, ep.size)
    melhor = int(np.argmax(m50)); parada = melhor + 15
    fig, ax = plt.subplots(1, 2, figsize=(15, 4.8))
    ax[0].plot(ep, tr, color=AZUL, lw=2.5, label="perda de treino")
    ax[0].plot(ep, va, color=VERMELHO, lw=2.5, label="perda de validação")
    ax[0].axvspan(1, 15, color="#fff8cc", alpha=0.9); ax[0].text(3, 2.9, "underfitting", fontsize=11)
    ax[0].axvspan(45, 100, color="#fdecea", alpha=0.9); ax[0].text(60, 2.9, "overfitting", fontsize=11)
    ax[0].set(xlabel="época", ylabel="perda", title="Perdas de treino e de validação"); ax[0].legend(); ax[0].grid(alpha=0.3)
    ax[1].plot(ep, 100 * m50, color=VERDE, lw=2.5, label="mAP50 na validação")
    ax[1].axvline(melhor + 1, color=AZUL, ls="--"); ax[1].text(melhor + 2, 20, f"best.pt\n(época {melhor + 1})", color=AZUL)
    ax[1].axvline(parada + 1, color=VERMELHO, ls=":"); ax[1].text(parada + 2, 45, f"interrupção\n(patience=15)", color=VERMELHO)
    ax[1].set(xlabel="época", ylabel="mAP50 (%)", title="Parada antecipada: guarda o melhor e para depois de 15 épocas sem melhora")
    ax[1].grid(alpha=0.3)
    fig.text(0.5, -0.03, "Curvas ilustrativas (valores não provenientes de treinamento real), no formato do results.csv", ha="center", fontsize=10, color="gray")
    salvar(fig, "curvas_treino")


def fig_pr_real():
    """curva PR calculada de verdade: caixas reais do WGISD contra um detector simulado"""
    gts, dets = [], []
    for k, (cod, (_, fotos)) in enumerate(VARIEDADES.items()):
        for j, f in enumerate(fotos):
            img, cx = uva(f); h, w = img.shape[:2]
            g = [yolo_para_xyxy(c, w, h) for c in cx]
            d = _deteccoes_simuladas(cx, w, h, n_fp=5, seed=10 * k + j)
            d = nms(d[d[:, 4] >= 0.01], 0.5)
            gts.append(g); dets.append(d)
    todas = [(i, d) for i, ds in enumerate(dets) for d in ds]
    todas.sort(key=lambda t: -t[1][4])
    npos = sum(len(g) for g in gts)
    fig, ax = plt.subplots(1, 2, figsize=(15, 5))
    for limiar, cor in [(0.5, AZUL), (0.75, VERMELHO)]:
        usado = [np.zeros(len(g), bool) for g in gts]; tp = []
        for i, d in todas:
            ious = [iou(d, g) for g in gts[i]]
            j = int(np.argmax(ious)) if ious else -1
            if j >= 0 and ious[j] >= limiar and not usado[i][j]:
                usado[i][j] = True; tp.append(1)
            else:
                tp.append(0)
        tp = np.array(tp); ctp = np.cumsum(tp); cfp = np.cumsum(1 - tp)
        rec = ctp / npos; prec = ctp / (ctp + cfp)
        pint = np.maximum.accumulate(prec[::-1])[::-1]
        ap = np.trapezoid(pint, rec) if hasattr(np, "trapezoid") else np.trapz(pint, rec)
        ax[0].plot(rec, prec, color=cor, lw=1, alpha=0.4); ax[0].plot(rec, pint, color=cor, lw=2.5, label=f"IoU ≥ {limiar}: AP = {ap:.2f}")
        if limiar == 0.5:
            confs = np.array([d[4] for _, d in todas])
            f1 = 2 * prec * rec / (prec + rec + 1e-9)
            ax[1].plot(confs, prec, color=AZUL, lw=2.5, label="precisão")
            ax[1].plot(confs, rec, color=VERDE, lw=2.5, label="revocação")
            ax[1].plot(confs, f1, color="#b8860b", lw=2.5, ls="--", label="F1")
            kbest = int(np.argmax(f1)); ax[1].axvline(confs[kbest], color="gray", ls=":")
            ax[1].text(confs[kbest] + 0.01, 0.1, f"melhor F1\nconf = {confs[kbest]:.2f}", color="gray")
    ax[0].set(xlabel="revocação", ylabel="precisão", title=f"Curva PR em {npos} cachos reais do WGISD", xlim=(0, 1.02), ylim=(0, 1.02)); ax[0].legend(); ax[0].grid(alpha=0.3)
    ax[1].set(xlabel="limiar de confiança", title="O limiar de confiança troca precisão por revocação", xlim=(1, 0)); ax[1].legend(); ax[1].grid(alpha=0.3)
    fig.text(0.5, -0.03, "Anotações do WGISD; previsões simuladas com ruído e falsos positivos. AP calculado com precisão interpolada.", ha="center", fontsize=10, color="gray")
    salvar(fig, "pr_curva_real")


def fig_confusao():
    classes = ["cenoura", "daninha", "fundo"]
    M = np.array([[182, 21, 9], [27, 141, 18], [11, 14, 0]])
    fig, ax = plt.subplots(figsize=(6.4, 5.4))
    ax.imshow(M, cmap="Blues")
    for i in range(3):
        for j in range(3):
            ax.text(j, i, M[i, j], ha="center", va="center", fontsize=16, color="white" if M[i, j] > 100 else "black")
    ax.set_xticks(range(3), classes); ax.set_yticks(range(3), classes)
    ax.set_xlabel("previsto"); ax.set_ylabel("real")
    ax.set_title("Matriz de confusão de um detector (valores ilustrativos)")
    salvar(fig, "matriz_confusao")


def fig_grid_random():
    r = np.random.default_rng(0)
    imp = lambda x: np.exp(-((x - 0.63) ** 2) / 0.01)
    fig, ax = plt.subplots(1, 2, figsize=(13, 5.6))
    g = np.linspace(0.1, 0.9, 3)
    gx, gy = np.meshgrid(g, g)
    rx, ry = r.uniform(0, 1, 9), r.uniform(0, 1, 9)
    for a, (x, y, t) in zip(ax, [(gx.ravel(), gy.ravel(), "Busca em grade: 9 testes, 3 valores do lr"), (rx, ry, "Busca aleatória: 9 testes, 9 valores do lr")]):
        a.scatter(x, y, s=120, c=AZUL, zorder=3)
        xs = np.linspace(0, 1, 200)
        a.fill_between(xs, -0.25, -0.25 + 0.2 * imp(xs), color=VERDE, alpha=0.6)
        for xi in x: a.plot([xi, xi], [-0.25, -0.05], color=AZUL, alpha=0.4)
        a.set_xlim(0, 1); a.set_ylim(-0.27, 1); a.set_title(t)
        a.set_xlabel("taxa de aprendizado (importa muito)"); a.set_ylabel("momentum (importa pouco)")
    fig.text(0.5, -0.03, "Argumento de Bergstra e Bengio (2012): com mesmo orçamento, a busca aleatória avalia mais valores do hiperparâmetro relevante.", ha="center", fontsize=10, color="gray")
    salvar(fig, "grid_vs_random")


def fig_dominio_variedades():
    fig, ax = plt.subplots(1, 5, figsize=(20, 3.8))
    for a, (cod, (nome, fotos)) in zip(ax, VARIEDADES.items()):
        img, cx = uva(fotos[1]); h, w = img.shape[:2]
        a.imshow(img)
        for c in cx:
            caixa(a, yolo_para_xyxy(c, w, h), lw=1.5)
        brilho = img.mean()
        a.set_title(f"{nome}\nbrilho médio {brilho:.0f} · {len(cx)} cachos")
    limpar(ax)
    fig.suptitle("Cinco variedades do WGISD: diferenças de cor dos cachos, dossel e iluminação", y=1.04)
    salvar(fig, "dominio_variedades")


def fig_rastreamento():
    """simula um vídeo andando ao longo da fileira: a mesma foto vista por uma janela que desliza"""
    img, cx = uva("SVB_1967"); h, w = img.shape[:2]
    jan = int(w * 0.55)
    fig, ax = plt.subplots(1, 3, figsize=(18, 4.6))
    ids = {i: i + 1 for i in range(len(cx))}
    for a, k in zip(ax, range(3)):
        x0 = int(k * (w - jan) / 2)
        a.imshow(img[:, x0:x0 + jan])
        for i, c in enumerate(cx):
            b = yolo_para_xyxy(c, w, h) - np.array([x0, 0, x0, 0])
            if b[0] > 0 and b[2] < jan:
                caixa(a, b, lw=2, txt=f"id {ids[i]}")
        a.set_title(f"quadro {k * 15}: câmera andou {x0} px")
    limpar(ax)
    fig.suptitle(f"Rastreamento simulado: identificadores persistentes entre quadros ({len(cx)} cachos anotados)", y=1.04)
    salvar(fig, "rastreamento_ids")



# ================================================================== figuras da versão completa
def _todas():
    for n in AMOSTRA:
        img, cx = uva(n)
        yield n, img, cx


def fig_imagem_matriz():
    img, cx = uva("CDY_2017"); h, w = img.shape[:2]
    b = yolo_para_xyxy(cx[0], w, h).astype(int)
    cy, cxp = (b[1] + b[3]) // 2, (b[0] + b[2]) // 2
    zona = img[cy - 60:cy + 60, cxp - 60:cxp + 60]
    peq = img[cy - 4:cy + 4, cxp - 4:cxp + 4]
    fig, ax = plt.subplots(1, 3, figsize=(18, 6), gridspec_kw={"width_ratios": [1.3, 1, 1.25]})
    ax[0].imshow(img); ax[0].add_patch(patches.Rectangle((cxp - 60, cy - 60), 120, 120, fill=False, ec=AMARELO, lw=3)); ax[0].set_title("Imagem 2048 × 1365 px")
    ax[1].imshow(zona, interpolation="nearest"); ax[1].add_patch(patches.Rectangle((56, 56), 8, 8, fill=False, ec=AMARELO, lw=3)); ax[1].set_title("Recorte de 120 × 120 px")
    ax[2].imshow(peq, interpolation="nearest")
    for i in range(8):
        for j in range(8):
            r, g, bb = peq[i, j]
            ax[2].text(j, i, f"{r}\n{g}\n{bb}", ha="center", va="center", fontsize=7.5, color="white" if peq[i, j].mean() < 140 else "black", family="monospace")
    ax[2].set_title("8 × 8 pixels: (R, G, B) de 0 a 255")
    limpar(ax)
    salvar(fig, "imagem_matriz")


def fig_canais_cor():
    img, _ = uva("SYH_2017-04-27_1265")
    small = cv2.resize(img, (img.shape[1] // 3, img.shape[0] // 3))
    hsv = cv2.cvtColor(small, cv2.COLOR_RGB2HSV)
    fig, ax = plt.subplots(2, 3, figsize=(16, 7.5))
    for a, (k, n) in zip(ax[0], enumerate(["R", "G", "B"])):
        a.imshow(small[..., k], cmap="gray"); a.set_title(f"canal {n}")
    for a, (k, n) in zip(ax[1], enumerate(["H (matiz)", "S (saturação)", "V (brilho)"])):
        a.imshow(hsv[..., k], cmap="twilight" if k == 0 else "gray"); a.set_title(n)
    limpar(ax)
    fig.suptitle("Canais RGB e HSV de uma imagem de Syrah do WGISD", y=1.0)
    salvar(fig, "canais_cor")


def fig_piramide_p3p5():
    img, cx = uva("CSV_1881"); h, w = img.shape[:2]
    lado = 640; f = lado / w; im = cv2.resize(img, (lado, int(h * f)))
    fig, ax = plt.subplots(1, 3, figsize=(18, 4.8))
    for a, (st, nome) in zip(ax, [(8, "P3, stride 8: grade 80 × 80, objetos pequenos"), (16, "P4, stride 16: grade 40 × 40, médios"), (32, "P5, stride 32: grade 20 × 20, grandes")]):
        a.imshow(im)
        for x in range(0, lado, st): a.axvline(x, color="white", lw=0.4 if st == 8 else 0.7, alpha=0.6)
        for y in range(0, im.shape[0], st): a.axhline(y, color="white", lw=0.4 if st == 8 else 0.7, alpha=0.6)
        for c in cx:
            b = yolo_para_xyxy(c, lado, im.shape[0]); lado_obj = max(b[2] - b[0], b[3] - b[1])
            alvo = 8 if lado_obj < 48 else 16 if lado_obj < 120 else 32
            caixa(a, b, cor=AMARELO if alvo == st else "#888888", lw=2 if alvo == st else 1)
        a.set_title(nome)
    limpar(ax)
    fig.suptitle("Níveis do pescoço; em amarelo, cachos cujo tamanho corresponde ao nível", y=1.03)
    salvar(fig, "piramide_p3p5")


def fig_ancora_vs_livre():
    img, cx = uva("CFR_1622"); h, w = img.shape[:2]
    c = cx[np.argmax(cx[:, 2] * cx[:, 3])]; b = yolo_para_xyxy(c, w, h)
    pad = 200; x0, y0 = int(max(0, b[0] - pad)), int(max(0, b[1] - pad))
    crop = img[y0:int(min(h, b[3] + pad)), x0:int(min(w, b[2] + pad))]; bb = b - [x0, y0, x0, y0]
    px, py = (bb[0] + bb[2]) / 2 + 10, (bb[1] + bb[3]) / 2 - 15
    fig, ax = plt.subplots(1, 2, figsize=(14, 6))
    ax[0].imshow(crop); ax[1].imshow(crop)
    for (aw, ah), cor in zip([(120, 120), (90, 220), (220, 90)], ["#ff8a80", "#40c4ff", "#b388ff"]):
        caixa(ax[0], [px - aw / 2, py - ah / 2, px + aw / 2, py + ah / 2], cor=cor, lw=2, ls="--")
    caixa(ax[0], bb, cor="#00e676", lw=3)
    ax[0].set_title("Com âncoras: ajuste de caixas de referência\npré-definidas")
    caixa(ax[1], bb, cor="#00e676", lw=3)
    ax[1].plot(px, py, "o", color=AMARELO, ms=12, mec="black")
    for (dx, dy, t) in [(bb[0] - px, 0, "l"), (bb[2] - px, 0, "r"), (0, bb[1] - py, "t"), (0, bb[3] - py, "b")]:
        ax[1].annotate("", xy=(px + dx, py + dy), xytext=(px, py), arrowprops=dict(arrowstyle="->", color=AMARELO, lw=2.5))
        ax[1].text(px + dx * 0.55, py + dy * 0.55 - 8, t, color="black", fontsize=13, fontweight="bold", bbox=dict(fc=AMARELO, ec="none", pad=1))
    ax[1].set_title("Sem âncoras: regressão das distâncias\naté as quatro bordas (l, t, r, b)")
    limpar(ax)
    salvar(fig, "ancora_vs_livre")


def fig_mascara_poligono():
    img, cx, m = uva("CDY_2017", mascara=True); h, w = img.shape[:2]
    k = int(np.argmax(m.reshape(-1, m.shape[2]).sum(0)))
    mk = (m[..., k] > 0).astype(np.uint8)
    cont, _ = cv2.findContours(mk, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    c = max(cont, key=cv2.contourArea); poli = cv2.approxPolyDP(c, 4, True)[:, 0, :]
    x, y, bw, bh = cv2.boundingRect(c); pad = 60
    x0, y0 = max(0, x - pad), max(0, y - pad); crop = img[y0:y + bh + pad, x0:x + bw + pad]
    fig, ax = plt.subplots(1, 3, figsize=(17, 6))
    ax[0].imshow(crop); caixa(ax[0], [x - x0, y - y0, x + bw - x0, y + bh - y0], lw=3); ax[0].set_title("Caixa: 4 valores")
    ov = crop.copy(); mm = mk[y0:y + bh + pad, x0:x + bw + pad] > 0
    ov[mm] = (0.4 * ov[mm] + 0.6 * np.array([255, 224, 0])).astype(np.uint8)
    ax[1].imshow(ov); ax[1].set_title("Máscara: 1 bit por pixel")
    ax[2].imshow(crop); ax[2].plot(list(poli[:, 0] - x0) + [poli[0, 0] - x0], list(poli[:, 1] - y0) + [poli[0, 1] - y0], "-o", color=AMARELO, ms=4, lw=2)
    linha = "0 " + " ".join(f"{px / w:.3f} {py / h:.3f}" for px, py in poli[:4]) + " ..."
    ax[2].set_title(f"YOLO-seg: polígono com {len(poli)} vértices")
    ax[2].text(0, -0.08, linha, transform=ax[2].transAxes, family="monospace", fontsize=10, va="top")
    limpar(ax)
    salvar(fig, "mascara_poligono")


def fig_iou_vs_deslocamento():
    d = np.arange(0, 61)
    fig, ax = plt.subplots(figsize=(10, 4.8))
    for tam, cor in [(24, VERMELHO), (64, "#b8860b"), (200, AZUL)]:
        ious = [iou([0, 0, tam, tam], [s, s, tam + s, tam + s]) for s in d]
        ax.plot(d, ious, lw=3, color=cor, label=f"objeto de {tam} px")
    ax.axhline(0.5, color="gray", ls="--"); ax.text(45, 0.52, "limiar 0,5", color="gray")
    ax.set(xlabel="deslocamento diagonal da caixa prevista (px)", ylabel="IoU", ylim=(0, 1.02), title="O mesmo erro em pixels derruba o IoU de objetos pequenos muito antes")
    ax.legend(); ax.grid(alpha=0.3)
    salvar(fig, "iou_vs_deslocamento")


def fig_nms_passos():
    img, cx = uva("SVB_1943"); h, w = img.shape[:2]
    bs = np.array([yolo_para_xyxy(c, w, h) for c in cx]); centro = bs[np.argsort(bs[:, 0])][len(bs) // 2]
    viz = [b for b in bs if abs((b[0] + b[2]) / 2 - (centro[0] + centro[2]) / 2) < 350][:3]
    x0 = int(min(b[0] for b in viz) - 80); y0 = int(min(b[1] for b in viz) - 80)
    x1 = int(max(b[2] for b in viz) + 80); y1 = int(max(b[3] for b in viz) + 80)
    crop = img[max(0, y0):y1, max(0, x0):x1]; off = np.array([max(0, x0), max(0, y0)] * 2)
    r = np.random.default_rng(5); dets = []
    for g in viz:
        bw, bh = g[2] - g[0], g[3] - g[1]
        for k in range(3):
            dets.append(list(g - off + r.normal(0, 0.07, 4) * [bw, bh, bw, bh]) + [round(0.9 - 0.2 * k + r.normal(0, 0.03), 2)])
    dets = np.array(dets); ordem = dets[np.argsort(-dets[:, 4])]
    fig, ax = plt.subplots(1, 4, figsize=(20, 5.4))
    for a in ax: a.imshow(crop)
    for d in ordem: caixa(ax[0], d, lw=1.5, txt=f"{d[4]:.2f}")
    ax[0].set_title(f"1. saída bruta: {len(dets)} caixas")
    mant = []; rest = list(ordem)
    for passo, a in zip(range(3), ax[1:]):
        if not rest: break
        topo = rest.pop(0); mant.append(topo)
        apagadas = [x for x in rest if iou(topo, x) >= 0.5]; rest = [x for x in rest if iou(topo, x) < 0.5]
        for d in mant: caixa(a, d, cor="#00e676", lw=3, txt=f"{d[4]:.2f}")
        for d in apagadas: caixa(a, d, cor="#ff5252", lw=1.5, ls=":")
        for d in rest: caixa(a, d, cor=AMARELO, lw=1)
        a.set_title(f"{passo + 2}. mantém {topo[4]:.2f}, remove {len(apagadas)} (IoU ≥ 0,5)")
    limpar(ax)
    fig.suptitle("NMS passo a passo: verde = mantida, vermelho = removida, amarelo = pendente (previsões simuladas)", y=1.02)
    salvar(fig, "nms_passos")


def fig_conf_limiares():
    img, cx = uva("CSV_1908"); h, w = img.shape[:2]
    d = nms(_deteccoes_simuladas(cx, w, h, n_fp=10, seed=3), 0.5)
    fig, ax = plt.subplots(1, 3, figsize=(18, 4.8))
    for a, c in zip(ax, [0.1, 0.4, 0.7]):
        a.imshow(img); k = d[d[:, 4] >= c]
        for x in k: caixa(a, x, cor="#00e676" if x[5] else "#ff5252", lw=2)
        tp = int(k[:, 5].sum()); a.set_title(f"conf ≥ {c}: {tp} acertos, {len(k) - tp} falsos\n({len(cx)} cachos reais)")
    limpar(ax)
    fig.suptitle("Efeito do limiar de confiança sobre previsões simuladas", y=1.03)
    salvar(fig, "conf_limiares")


def fig_casos_limite():
    img, cx = uva("SVB_1967"); h, w = img.shape[:2]
    bs = [yolo_para_xyxy(c, w, h) for c in cx]
    areas = [(b[2] - b[0]) * (b[3] - b[1]) for b in bs]
    borda = min(bs, key=lambda b: min(b[0], b[1], w - b[2], h - b[3]))
    pequeno = bs[int(np.argmin(areas))]
    pares = [(i, j, iou(bs[i], bs[j])) for i in range(len(bs)) for j in range(i + 1, len(bs))]
    i, j, _ = max(pares, key=lambda t: t[2]); junto = [min(bs[i][0], bs[j][0]), min(bs[i][1], bs[j][1]), max(bs[i][2], bs[j][2]), max(bs[i][3], bs[j][3])]
    img2, cx2 = uva("CFR_1671"); h2, w2 = img2.shape[:2]; bs2 = [yolo_para_xyxy(c, w2, h2) for c in cx2]
    casos = [(img, borda, [borda], "cortado pela borda"), (img, pequeno, [pequeno], "pequeno, ao fundo"), (img, junto, [bs[i], bs[j]], "cachos encostados"), (img2, bs2[0], [bs2[0]], "folhas na frente")]
    fig, ax = plt.subplots(1, 4, figsize=(19, 5))
    for a, (im, ref, cxs, t) in zip(ax, casos):
        H, W = im.shape[:2]; pad = 90
        x0, y0 = int(max(0, ref[0] - pad)), int(max(0, ref[1] - pad)); x1, y1 = int(min(W, ref[2] + pad)), int(min(H, ref[3] + pad))
        a.imshow(im[y0:y1, x0:x1])
        for b in cxs: caixa(a, b - np.array([x0, y0, x0, y0]), lw=2.5)
        a.set_title(t)
    limpar(ax)
    fig.suptitle("Casos-limite do WGISD com as anotações originais do conjunto", y=1.03)
    salvar(fig, "casos_limite")


def fig_estatisticas_banco():
    linhas = []
    for n, img, cx in _todas():
        for c in cx:
            linhas.append((n[:3], c[0], c[1], c[2] * c[3] * 100, c[2] * img.shape[1] / (c[3] * img.shape[0])))
    v = np.array([l[0] for l in linhas]); num = np.array([l[1:] for l in linhas], float)
    por_foto = {}
    for n in AMOSTRA: por_foto.setdefault(n[:3], []).append(len(uva(n)[1]))
    fig, ax = plt.subplots(1, 4, figsize=(21, 4.6))
    ax[0].boxplot([por_foto[k] for k in VARIEDADES], tick_labels=list(VARIEDADES)); ax[0].set(title="Cachos por foto", ylabel="caixas")
    ax[1].hist(num[:, 2], bins=30, color=AZUL); ax[1].set(title="Área da caixa (% da foto)", xlabel="%")
    hm, _, _ = np.histogram2d(num[:, 1], num[:, 0], bins=12, range=[[0, 1], [0, 1]])
    ax[2].imshow(hm, cmap="magma", extent=[0, 1, 1, 0]); ax[2].set(title="Onde ficam os centros", xlabel="x", ylabel="y")
    ax[3].hist(num[:, 3], bins=30, color="#b8860b"); ax[3].set(title="Largura / altura da caixa", xlabel="razão (cachos são altos: < 1)")
    fig.suptitle(f"Estatísticas de {len(AMOSTRA)} fotos e {len(linhas)} caixas reais do WGISD: estatística descritiva", y=1.03)
    salvar(fig, "estatisticas_banco")


def fig_quase_iguais():
    a, _ = uva("CDY_20180427_153201477_BURST000_COVER_TOP"); b, _ = uva("CDY_20180427_153409150_BURST000_COVER_TOP")
    p, q = uva("CDY_2024")[0], uva("CDY_2026")[0]
    fig, ax = plt.subplots(1, 4, figsize=(20, 4.4))
    ax[0].imshow(p); ax[0].set_title("CDY_2024"); ax[1].imshow(q); ax[1].set_title("CDY_2026 (mesma sessão)")
    hp = cv2.calcHist([cv2.cvtColor(p, cv2.COLOR_RGB2HSV)], [0, 1], None, [30, 32], [0, 180, 0, 256])
    hq = cv2.calcHist([cv2.cvtColor(q, cv2.COLOR_RGB2HSV)], [0, 1], None, [30, 32], [0, 180, 0, 256])
    hr = cv2.calcHist([cv2.cvtColor(uva("SYH_2017-04-27_1265")[0], cv2.COLOR_RGB2HSV)], [0, 1], None, [30, 32], [0, 180, 0, 256])
    s1 = cv2.compareHist(hp, hq, cv2.HISTCMP_CORREL); s2 = cv2.compareHist(hp, hr, cv2.HISTCMP_CORREL)
    ax[2].imshow(uva("SYH_2017-04-27_1265")[0]); ax[2].set_title("Syrah (outra sessão)")
    ax[3].bar(["vizinhas", "Syrah"], [s1, s2], color=[VERMELHO, AZUL]); ax[3].set(ylim=(0, 1), title="Correlação do histograma de cor")
    for k, v in enumerate([s1, s2]): ax[3].text(k, v + 0.02, f"{v:.2f}", ha="center", fontsize=13)
    limpar(ax[:3])
    fig.suptitle("Similaridade de cor entre imagens da mesma sessão e de sessões distintas", y=1.03)
    salvar(fig, "quase_iguais")


def fig_mlp_xor():
    X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]], float); y = np.array([[0], [1], [1], [0]], float)
    r = np.random.default_rng(1); W1 = r.normal(0, 1, (2, 4)); b1 = np.zeros(4); W2 = r.normal(0, 1, (4, 1)); b2 = np.zeros(1)
    sig = lambda z: 1 / (1 + np.exp(-z)); perdas = []
    for _ in range(4000):
        h = np.tanh(X @ W1 + b1); o = sig(h @ W2 + b2)
        perdas.append(float(np.mean((o - y) ** 2)))
        do = (o - y) * o * (1 - o); dW2 = h.T @ do; db2 = do.sum(0)
        dh = do @ W2.T * (1 - h ** 2); dW1 = X.T @ dh; db1 = dh.sum(0)
        for P, G in [(W1, dW1), (b1, db1), (W2, dW2), (b2, db2)]: P -= 1.0 * G
    xx, yy = np.meshgrid(np.linspace(-0.4, 1.4, 250), np.linspace(-0.4, 1.4, 250))
    zz = sig(np.tanh(np.c_[xx.ravel(), yy.ravel()] @ W1 + b1) @ W2 + b2).reshape(xx.shape)
    fig, ax = plt.subplots(1, 2, figsize=(13, 5))
    ax[0].contourf(xx, yy, zz, levels=20, cmap="coolwarm_r", alpha=0.6); ax[0].contour(xx, yy, zz, levels=[0.5], colors="black", linewidths=2)
    for xi, yi in zip(X, y.ravel()): ax[0].scatter(*xi, s=260, c=AZUL if yi else "white", edgecolors="black", lw=2, zorder=3)
    ax[0].set(title="MLP 2 → 4 → 1 (tanh, sigmoide): XOR resolvido", xlabel="x₁", ylabel="x₂"); ax[0].set_aspect("equal")
    ax[1].plot(perdas, color=AZUL, lw=2.5); ax[1].set(yscale="log", xlabel="iteração", ylabel="erro quadrático médio", title="Retropropagação: o erro cai até quase zero"); ax[1].grid(alpha=0.3)
    salvar(fig, "mlp_xor")


def fig_descida_gradiente():
    f = lambda a, b: (a - 1) ** 2 + 6 * (b + 0.5) ** 2
    g = lambda a, b: np.array([2 * (a - 1), 12 * (b + 0.5)])
    aa, bb = np.meshgrid(np.linspace(-2.5, 3, 200), np.linspace(-2, 1.5, 200))
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.contour(aa, bb, f(aa, bb), levels=25, cmap="Greys", alpha=0.6)
    for lr, cor, nome in [(0.02, "#b8860b", "η = 0,02 (lento)"), (0.08, VERDE, "η = 0,08 (bom)"), (0.165, VERMELHO, "η = 0,165 (oscila)")]:
        p = np.array([-2.0, 1.2]); cam = [p.copy()]
        for _ in range(30): p = p - lr * g(*p); cam.append(p.copy())
        cam = np.array(cam); ax.plot(cam[:, 0], cam[:, 1], "-o", color=cor, ms=3, lw=2, label=nome)
    ax.plot(1, -0.5, "*", color=AZUL, ms=20, label="mínimo")
    ax.set(xlabel="peso w₁", ylabel="peso w₂", title="Descida do gradiente: w ← w − η ∇L(w), 30 passos"); ax.legend()
    salvar(fig, "descida_gradiente")


def fig_conv_passo():
    img, _ = uva("CDY_2017")
    g = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    patch = cv2.resize(g[600:900, 300:600], (6, 6), interpolation=cv2.INTER_AREA).astype(int)
    k = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]])
    out = np.array([[int((patch[i:i + 3, j:j + 3] * k).sum()) for j in range(4)] for i in range(4)])
    fig, ax = plt.subplots(1, 3, figsize=(16, 5.4), gridspec_kw={"width_ratios": [6, 3, 4]})
    ax[0].imshow(patch, cmap="gray", vmin=0, vmax=255)
    for i in range(6):
        for j in range(6): ax[0].text(j, i, patch[i, j], ha="center", va="center", color="red" if i < 3 and j < 3 else ("white" if patch[i, j] < 128 else "black"), fontsize=13, fontweight="bold" if i < 3 and j < 3 else None)
    ax[0].add_patch(patches.Rectangle((-0.5, -0.5), 3, 3, fill=False, ec=VERMELHO, lw=3)); ax[0].set_title("Entrada 6 × 6 (tons de cinza, WGISD)")
    ax[1].imshow(k, cmap="coolwarm", vmin=-2, vmax=2)
    for i in range(3):
        for j in range(3): ax[1].text(j, i, k[i, j], ha="center", va="center", fontsize=16, fontweight="bold")
    ax[1].set_title("Núcleo 3 × 3 (Sobel horizontal)")
    ax[2].imshow(out, cmap="coolwarm")
    for i in range(4):
        for j in range(4): ax[2].text(j, i, out[i, j], ha="center", va="center", fontsize=13, fontweight="bold" if (i, j) == (0, 0) else None)
    ax[2].add_patch(patches.Rectangle((-0.5, -0.5), 1, 1, fill=False, ec=VERMELHO, lw=3)); ax[2].set_title("Saída 4 × 4 (sem padding)")
    limpar(ax)
    conta = " + ".join(f"{patch[i, j]}·({k[i, j]})" for i in range(3) for j in range(3) if k[i, j] != 0)
    fig.text(0.5, -0.04, f"saída[0,0] = {conta} = {out[0, 0]}", ha="center", family="monospace", fontsize=11)
    salvar(fig, "conv_passo")


def fig_mapas_caracteristicas():
    img, _ = uva("CFR_1634")
    g = cv2.cvtColor(cv2.resize(img, (512, 341)), cv2.COLOR_RGB2GRAY).astype(np.float32) / 255
    filtros = [cv2.getGaborKernel((11, 11), 3, th, 6, 0.6, 0) for th in np.linspace(0, np.pi, 4, endpoint=False)]
    filtros += [np.array([[0, 1, 0], [1, -4, 1], [0, 1, 0]], np.float32), cv2.getGaussianKernel(9, 2) @ cv2.getGaussianKernel(9, 2).T]
    c1 = [np.maximum(0, cv2.filter2D(g, -1, f)) for f in filtros]
    pool = lambda x: x[: x.shape[0] // 2 * 2, : x.shape[1] // 2 * 2].reshape(x.shape[0] // 2, 2, x.shape[1] // 2, 2).max((1, 3))
    c2 = [pool(np.maximum(0, cv2.filter2D(pool(c1[i]), -1, filtros[(i + 1) % 4]))) for i in range(4)]
    fig, ax = plt.subplots(2, 6, figsize=(20, 6.4))
    ax[0, 0].imshow(g, cmap="gray"); ax[0, 0].set_title("entrada 512 × 341")
    for a, m, t in zip(ax[0, 1:], c1, ["0°", "45°", "90°", "135°", "Laplaciano"]):
        a.imshow(m, cmap="magma", vmax=np.percentile(m, 99)); a.set_title(f"camada 1 · {t}")
    ax[1, 0].imshow(c1[5], cmap="gray"); ax[1, 0].set_title("camada 1 · suavização")
    for a, m in zip(ax[1, 1:5], c2): a.imshow(m, cmap="viridis", vmax=np.percentile(m, 99)); a.set_title(f"camada 2 · {m.shape[1]} × {m.shape[0]}")
    ax[1, 5].axis("off"); ax[1, 5].text(0, 0.5, "conv → ReLU → max pool\nrepetido muitas vezes:\nmapas menores, mais\nabstratos e em maior\nnúmero de canais", fontsize=12, va="center")
    limpar(ax)
    fig.suptitle("Mapas de características com filtros fixos (Gabor e Laplaciano), para fins ilustrativos", y=1.02)
    salvar(fig, "mapas_caracteristicas")


def fig_letterbox():
    img, cx = uva("CDY_20180427_153615626_BURST000_COVER_TOP"); h, w = img.shape[:2]
    f = 640 / max(w, h); nw, nh = int(w * f), int(h * f)
    lb = np.full((640, 640, 3), 114, np.uint8); oy = (640 - nh) // 2; lb[oy:oy + nh, :nw] = cv2.resize(img, (nw, nh))
    est = cv2.resize(img, (640, 640))
    fig, ax = plt.subplots(1, 3, figsize=(18, 5.6), gridspec_kw={"width_ratios": [1.5, 1, 1]})
    ax[0].imshow(img); ax[0].set_title(f"original {w} × {h}")
    ax[1].imshow(est); ax[1].set_title("redimensionamento sem preservar proporção")
    ax[2].imshow(lb); ax[2].set_title("redimensionamento com preservação\nda proporção e preenchimento")
    for c in cx:
        caixa(ax[0], yolo_para_xyxy(c, w, h), lw=1.5); caixa(ax[1], yolo_para_xyxy(c, 640, 640), lw=1.5)
        b = yolo_para_xyxy(c, nw, nh); caixa(ax[2], b + [0, oy, 0, oy], lw=1.5)
    limpar(ax)
    salvar(fig, "letterbox")


def fig_lr_schedule():
    ep = np.arange(0, 100.01, 0.25); lr0, lrf, wu = 0.01, 0.01, 3
    lin = lr0 * ((1 - ep / 100) * (1 - lrf) + lrf); cos = lr0 * (((1 - np.cos(ep * np.pi / 100)) / 2) * (lrf - 1) + 1)
    aq = np.where(ep < wu, ep / wu, 1)
    fig, ax = plt.subplots(figsize=(10, 4.4))
    ax.plot(ep, lin * aq, color=AZUL, lw=3, label="linear (padrão)"); ax.plot(ep, cos * aq, color="#b8860b", lw=3, ls="--", label="cosseno (cos_lr=True)")
    ax.axvspan(0, wu, color="#fff8cc"); ax.text(0.3, 0.0105, "aquecimento\n(warmup_epochs=3)", fontsize=10)
    ax.set(xlabel="época", ylabel="taxa de aprendizado", title="Agenda da taxa de aprendizado: lr0 = 0,01 até lr0 × lrf = 0,0001", ylim=(0, 0.0115)); ax.legend(); ax.grid(alpha=0.3)
    salvar(fig, "lr_schedule")


def fig_map_limiares():
    img, cx = uva("CDY_2026"); h, w = img.shape[:2]
    c = cx[np.argmax(cx[:, 2] * cx[:, 3])]; g = yolo_para_xyxy(c, w, h); bw, bh = g[2] - g[0], g[3] - g[1]
    p = g + np.array([0.06 * bw, 0.04 * bh, 0.12 * bw, 0.1 * bh]); v = iou(g, p)
    pad = 120; x0, y0 = int(g[0] - pad), int(g[1] - pad); crop = img[y0:int(g[3] + pad), x0:int(g[2] + pad)]
    fig, ax = plt.subplots(1, 2, figsize=(14, 5.4), gridspec_kw={"width_ratios": [1, 1.6]})
    ax[0].imshow(crop); caixa(ax[0], g - [x0, y0, x0, y0], cor="#00e676", lw=3, txt="real"); caixa(ax[0], p - [x0, y0, x0, y0], lw=3, ls="--", txt="prevista")
    ax[0].set_title(f"IoU = {v:.2f}"); limpar(ax[0])
    lims = np.round(np.arange(0.5, 0.96, 0.05), 2)
    ax[1].bar([f"{l:.2f}" for l in lims], [1] * len(lims), color=[VERDE if v >= l else VERMELHO for l in lims])
    for k, l in enumerate(lims): ax[1].text(k, 0.5, "TP" if v >= l else "FP", ha="center", color="white", fontsize=13, fontweight="bold")
    ax[1].set(yticks=[], xlabel="limiar de IoU", title=f"Conta como acerto em {int((lims <= v).sum())} dos 10 limiares do mAP50-95")
    salvar(fig, "map_limiares")


def fig_erro_contagem():
    reais, prev = [], []
    for k, (n, img, cx) in enumerate(_todas()):
        h, w = img.shape[:2]; d = nms(_deteccoes_simuladas(cx, w, h, n_fp=4, seed=k), 0.5)
        r = np.random.default_rng(100 + k); perdidos = r.binomial(len(cx), 0.12)
        reais.append(len(cx)); prev.append(int((d[:, 4] >= 0.4).sum()) - perdidos)
    reais, prev = np.array(reais), np.array(prev); mae = np.abs(prev - reais).mean(); vies = (prev - reais).mean()
    fig, ax = plt.subplots(1, 2, figsize=(14, 5))
    ax[0].scatter(reais, prev, s=60, c=AZUL, alpha=0.7); m = max(reais.max(), prev.max()) + 2
    ax[0].plot([0, m], [0, m], "--", color="gray"); ax[0].set(xlabel="cachos anotados na foto", ylabel="cachos previstos", title=f"Contagem por foto: MAE = {mae:.1f}, viés = {vies:+.1f}")
    ax[1].hist(prev - reais, bins=range(-8, 9), color="#b8860b", edgecolor="white"); ax[1].set(xlabel="previstos − reais", ylabel="fotos", title="Distribuição do erro de contagem")
    for a in ax: a.grid(alpha=0.3)
    fig.text(0.5, -0.03, f"{len(AMOSTRA)} imagens do WGISD; previsões simuladas (conf 0,4).", ha="center", fontsize=10, color="gray")
    salvar(fig, "erro_contagem")


def fig_dominio_cor():
    fig, ax = plt.subplots(1, 2, figsize=(15, 4.8))
    for (cod, (nome, _)), cor in zip(VARIEDADES.items(), [AZUL, "#b8860b", VERMELHO, VERDE, "#6a1b9a"]):
        hs, vs = [], []
        for n in [a for a in AMOSTRA if a.startswith(cod)][:6]:
            img, cx = uva(n); h, w = img.shape[:2]; hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV)
            for c in cx:
                b = yolo_para_xyxy(c, w, h).astype(int); reg = hsv[max(0, b[1]):b[3], max(0, b[0]):b[2]].reshape(-1, 3)
                hs.append(reg[::7, 0]); vs.append(reg[::7, 2])
        hs, vs = np.concatenate(hs), np.concatenate(vs)
        ax[0].hist(hs, bins=90, range=(0, 180), density=True, histtype="step", lw=2.2, color=cor, label=nome)
        ax[1].hist(vs, bins=64, range=(0, 256), density=True, histtype="step", lw=2.2, color=cor, label=nome)
    ax[0].set(title="Matiz (H) dentro das caixas dos cachos", xlabel="H (OpenCV, 0 a 180)", xlim=(0, 180)); ax[0].legend()
    ax[1].set(title="Brilho (V) dentro das caixas", xlabel="V"); ax[1].legend()
    fig.text(0.5, -0.03, "Pixels no interior das caixas anotadas do WGISD (amostra de seis imagens por variedade).", ha="center", fontsize=10, color="gray")
    salvar(fig, "dominio_cor")


def fig_iluminacao():
    img, cx = uva("CSV_1867"); small = cv2.resize(img, (img.shape[1] // 3, img.shape[0] // 3)).astype(np.float32) / 255
    variantes = [("meio-dia", small), ("fim de tarde (γ = 1,8)", small ** 1.8), ("contraluz (γ = 0,5)", small ** 0.5),
                 ("balanço de branco quente", np.clip(small * [1.15, 1.0, 0.75], 0, 1)), ("câmera de celular (ruído)", np.clip(small + np.random.default_rng(0).normal(0, 0.06, small.shape), 0, 1)), ("chuva fina (desfoque)", cv2.GaussianBlur(small, (0, 0), 3))]
    fig, ax = plt.subplots(2, 3, figsize=(17, 7.6))
    for a, (t, im) in zip(ax.flat, variantes): a.imshow(im); a.set_title(t)
    limpar(ax)
    fig.suptitle("Perturbações sintéticas de iluminação, cor, ruído e nitidez", y=1.0)
    salvar(fig, "iluminacao")


def fig_dados_widgets():
    """recortes e caixas usados pelos laboratórios interativos do site (IoU e NMS)"""
    import json
    img, cx = uva("CDY_2026"); h, w = img.shape[:2]
    c = cx[np.argmax(cx[:, 2] * cx[:, 3])]; g = yolo_para_xyxy(c, w, h)
    bw, bh = g[2] - g[0], g[3] - g[1]; pad = int(0.8 * max(bw, bh))
    x0, y0 = int(max(0, g[0] - pad)), int(max(0, g[1] - pad)); x1, y1 = int(min(w, g[2] + pad)), int(min(h, g[3] + pad))
    Image.fromarray(img[y0:y1, x0:x1]).save(SAIDA / "lab_iou.jpg", quality=85)
    iou_d = {"w": x1 - x0, "h": y1 - y0, "gt": [round(float(v), 1) for v in (g - np.array([x0, y0, x0, y0]))]}
    img, cx = uva("SVB_1955"); h, w = img.shape[:2]; f = 1024 / w
    Image.fromarray(cv2.resize(img, (1024, int(h * f)))).save(SAIDA / "lab_nms.jpg", quality=85)
    d = _deteccoes_simuladas(cx, w, h)
    nms_d = {"w": 1024, "h": int(h * f), "dets": [[round(float(v) * f, 1) for v in x[:4]] + [round(float(x[4]), 3)] for x in d],
             "gt": [[round(float(v) * f, 1) for v in yolo_para_xyxy(c, w, h)] for c in cx]}
    (SAIDA / "labs.json").write_text(json.dumps({"iou": iou_d, "nms": nms_d}))
    print("ok labs.json")


if __name__ == "__main__":
    for nome, f in list(globals().items()):
        if nome.startswith("fig_") and callable(f):
            f()
