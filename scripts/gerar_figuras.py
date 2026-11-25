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
    fig.suptitle("Pipeline clássico de PDI numa lavoura de cenoura real (CWFID): cada etapa é uma regra escrita à mão", fontsize=13, y=0.98)
    salvar(fig, "pipeline_classico")


def fig_classico_falha():
    """a mesma regra (ExG + Otsu) que funcionou na cenoura, aplicada à uva"""
    img, _ = uva("CSV_1881")
    _, m = exg_mascara(img)
    fig, ax = plt.subplots(1, 2, figsize=(13, 4.8))
    ax[0].imshow(img); ax[0].set_title("Vinhedo (WGISD, Cabernet Sauvignon)")
    ax[1].imshow(m, cmap="gray"); ax[1].set_title("Mesma regra ExG + Otsu: separa folha, não acha o cacho")
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
    ax.set_title("Um cacho real do WGISD (Cabernet Franc) em três formatos de caixa")
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
    ax[1].set_title("YOLO, estágio único: uma passada pela rede\nprevê caixa e classe em todas as células de uma vez")
    limpar(ax)
    salvar(fig, "rcnn_vs_yolo")


def fig_unet_cwfid():
    img, anot = cenoura("002")
    fig, ax = plt.subplots(1, 3, figsize=(15, 5.6))
    ax[0].imshow(img); ax[0].set_title("Entrada: foto de campo")
    cor = np.zeros_like(img); cor[anot[..., 1] > 0] = (34, 139, 34); cor[anot[..., 0] > 0] = (178, 34, 34)
    ax[1].imshow(cor); ax[1].set_title("Saída esperada: rótulo por pixel\nverde = cenoura · vermelho = daninha")
    ov = img.copy(); msk = cor.sum(2) > 0
    ov[msk] = (0.4 * ov[msk] + 0.6 * cor[msk]).astype(np.uint8)
    ax[2].imshow(ov); ax[2].set_title("Sobreposição: é isso que a U-Net aprende")
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
    fig.suptitle("Subir o drone (ou reduzir o imgsz) é isto: o mesmo cacho com cada vez menos pixels", y=1.02)
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
    ax[0].set_title("Anotador A: caixa justa, um cacho por caixa")
    ax[1].set_title("Anotador B: caixa folgada, inclui folha")
    ax[2].set_title("Anotador C: junta cachos encostados")
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
    ax.set_title("Auditoria de rótulos: três erros que o validador do Lab 1 precisa apontar (em vermelho)")
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
    fig.suptitle("Divisão por grupo no WGISD: cada variedade (e cada vinhedo/dia de coleta) inteira num só conjunto", y=1.0)
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
    ax.set_title("Funções de ativação: a não linearidade é o que resolve o XOR")
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
    ax[0].imshow(g, cmap="gray"); ax[0].set_title("Entrada (canal cinza)")
    for a, (nome, k) in zip(ax[1:], ks.items()):
        r = cv2.filter2D(g, -1, k)
        v = np.abs(r) if "Média" not in nome else r
        a.imshow(v, cmap="magma" if "Média" not in nome else "gray", vmax=np.percentile(v, 99))
        a.set_title(nome)
    limpar(ax)
    fig.suptitle("Na Aula 2 de PDI você escolhia o kernel. Na CNN, os números do kernel são pesos aprendidos.", y=1.02)
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
    ax[1].set_title("SAHI: fatias de 640 px com 20% de sobreposição,\ninferência em cada fatia e NMS para juntar")
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
    ax[0].set(xlabel="época", ylabel="perda", title="Perdas: quando a validação descola, a rede decorou"); ax[0].legend(); ax[0].grid(alpha=0.3)
    ax[1].plot(ep, 100 * m50, color=VERDE, lw=2.5, label="mAP50 na validação")
    ax[1].axvline(melhor + 1, color=AZUL, ls="--"); ax[1].text(melhor + 2, 20, f"best.pt\n(época {melhor + 1})", color=AZUL)
    ax[1].axvline(parada + 1, color=VERMELHO, ls=":"); ax[1].text(parada + 2, 45, f"para aqui\n(patience=15)", color=VERMELHO)
    ax[1].set(xlabel="época", ylabel="mAP50 (%)", title="Parada antecipada: guarda o melhor e para depois de 15 épocas sem melhora")
    ax[1].grid(alpha=0.3)
    fig.text(0.5, -0.03, "Curvas ilustrativas, no formato do results.csv do Ultralytics", ha="center", fontsize=10, color="gray")
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
    fig.text(0.5, -0.03, "Caixas reais do WGISD; detecções simuladas com ruído e falsos positivos. O cálculo de AP é o mesmo do COCO.", ha="center", fontsize=10, color="gray")
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
    ax.set_title("Matriz de confusão de um detector (ilustrativa)\na linha \"fundo\" são os falsos positivos")
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
    fig.text(0.5, -0.03, "Bergstra e Bengio (2012): quando só um hiperparâmetro importa, a busca aleatória explora mais valores dele.", ha="center", fontsize=10, color="gray")
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
    fig.suptitle("Mesmo dataset, cinco domínios: cor do cacho, folhagem, luz e câmera mudam entre variedades", y=1.04)
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
    fig.suptitle(f"Rastreamento: o mesmo cacho mantém o id entre quadros, então a contagem é {len(cx)} e não a soma das caixas", y=1.04)
    salvar(fig, "rastreamento_ids")


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
