import cv2

# Carrega a imagem
img = cv2.imread('spfc.jpg')

# Cria a janela permitindo redimensionamento (WINDOW_NORMAL)
cv2.namedWindow('teste', cv2.WINDOW_NORMAL | cv2.WINDOW_KEEPRATIO)

# Opcional: define um tamanho inicial para a janela
cv2.resizeWindow('teste', 800, 600)

# Exibe a imagem
cv2.imshow('teste', img)

cv2.waitKey(0)
cv2.destroyAllWindows()
