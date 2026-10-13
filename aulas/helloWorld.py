import cv2
import matplotlib.pyplot as plt

# Carrega a imagem
img = cv2.imread('spfc.jpg')

# Cria a janela permitindo redimensionamento (WINDOW_NORMAL)
cv2.namedWindow('teste', cv2.WINDOW_NORMAL | cv2.WINDOW_KEEPRATIO)

# Opcional: define um tamanho inicial para a janela
cv2.resizeWindow('teste', 800, 600)

# Exibe a imagem
cv2.imshow('teste', img)

cvt = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

# Split dos canais HSV
h, s, v = cv2.split(cvt)

# Equalização de histograma
h_eq = cv2.equalizeHist(h)
s_eq = cv2.equalizeHist(s)
v_eq = cv2.equalizeHist(v)

cv2.namedWindow('Hue', cv2.WINDOW_NORMAL)
cv2.namedWindow('Saturation', cv2.WINDOW_NORMAL)
cv2.namedWindow('Value', cv2.WINDOW_NORMAL)
cv2.namedWindow('Hue Equalized', cv2.WINDOW_NORMAL)
cv2.namedWindow('Saturation Equalized', cv2.WINDOW_NORMAL)
cv2.namedWindow('Value Equalized', cv2.WINDOW_NORMAL)

cv2.imshow('Hue', h)
cv2.imshow('Saturation', s)
cv2.imshow('Value', v)
cv2.imshow('Hue Equalized', h_eq)
cv2.imshow('Saturation Equalized', s_eq)
cv2.imshow('Value Equalized', v_eq)

# Histogramas dos canais
plt.figure(figsize=(12, 4))

plt.subplot(131)
plt.hist(h.ravel(), bins=256, range=[0, 256], color='red')
plt.title('Histograma Hue')
plt.xlabel('Pixel Value')
plt.ylabel('Frequency')

plt.subplot(132)
plt.hist(s.ravel(), bins=256, range=[0, 256], color='green')
plt.title('Histograma Saturation')
plt.xlabel('Pixel Value')
plt.ylabel('Frequency')

plt.subplot(133)
plt.hist(v.ravel(), bins=256, range=[0, 256], color='blue')
plt.title('Histograma Value')
plt.xlabel('Pixel Value')
plt.ylabel('Frequency')

plt.tight_layout()
plt.show()

# Histogramas equalizados
plt.figure(figsize=(12, 4))

plt.subplot(131)
plt.hist(h_eq.ravel(), bins=256, range=[0, 256], color='red', alpha=0.7)
plt.title('Histograma Hue Equalized')
plt.xlabel('Pixel Value')
plt.ylabel('Frequency')

plt.subplot(132)
plt.hist(s_eq.ravel(), bins=256, range=[0, 256], color='green', alpha=0.7)
plt.title('Histograma Saturation Equalized')
plt.xlabel('Pixel Value')
plt.ylabel('Frequency')

plt.subplot(133)
plt.hist(v_eq.ravel(), bins=256, range=[0, 256], color='blue', alpha=0.7)
plt.title('Histograma Value Equalized')
plt.xlabel('Pixel Value')
plt.ylabel('Frequency')

plt.tight_layout()
plt.show()

cv2.waitKey(0)
cv2.destroyAllWindows()
