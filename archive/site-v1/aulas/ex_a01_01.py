import cv2 as cv
import numpy as np
import matplotlib.pyplot as plt

# Pedir o caminho da imagem
caminho = input("Digite o caminho da imagem: ")
img = cv.imread(caminho)

if img is None:
    print("Erro ao carregar a imagem")
    exit()

# Menu de espaço de cor
print("\nEscolha o espaço de cor:")
print("1 - HSV")
print("2 - RGB")
print("3 - LAB")
print("4 - Grayscale")
escolha_cor = input("Digite a opcao: ")

# Menu de operações
print("\nO que deseja fazer?")
print("1 - Ver os canais")
print("2 - Ver histogramas")
print("3 - Ver tudo")
escolha_op = input("Digite a opcao: ")

salvar = input("\nSalvar as imagens? (s/n): ").lower() == 's'

# Converter para RGB para mostrar a original
img_rgb = cv.cvtColor(img, cv.COLOR_BGR2RGB)

# Converter para o espaço de cor escolhido
if escolha_cor == '1':
    img_convertida = cv.cvtColor(img, cv.COLOR_BGR2HSV)
    nome_espaco = 'HSV'
    c1, c2, c3 = cv.split(img_convertida)
    nome_c1, nome_c2, nome_c3 = 'Hue', 'Saturation', 'Value'

elif escolha_cor == '2':
    img_convertida = cv.cvtColor(img, cv.COLOR_BGR2RGB)
    nome_espaco = 'RGB'
    c1, c2, c3 = cv.split(img_convertida)
    nome_c1, nome_c2, nome_c3 = 'Red', 'Green', 'Blue'

elif escolha_cor == '3':
    img_convertida = cv.cvtColor(img, cv.COLOR_BGR2LAB)
    nome_espaco = 'LAB'
    c1, c2, c3 = cv.split(img_convertida)
    nome_c1, nome_c2, nome_c3 = 'Luminance', 'A', 'B'

elif escolha_cor == '4':
    img_convertida = cv.cvtColor(img, cv.COLOR_BGR2GRAY)
    nome_espaco = 'Grayscale'
    c1 = img_convertida
    nome_c1 = 'Intensity'

print(f"\nImagem convertida para {nome_espaco}")

# Exibir canais
if escolha_op == '1' or escolha_op == '3':
    if escolha_cor == '4':
        plt.figure(figsize=(10, 4))
        plt.subplot(121)
        plt.imshow(img_rgb)
        plt.title('Original')
        plt.axis('off')

        plt.subplot(122)
        plt.imshow(c1, cmap='gray')
        plt.title(f'{nome_espaco}: {nome_c1}')
        plt.axis('off')

        if salvar:
            cv.imwrite(f'{nome_espaco.lower()}_canal.jpg', c1)
            print(f"Canais salvos")
    else:
        plt.figure(figsize=(15, 4))

        plt.subplot(141)
        plt.imshow(img_rgb)
        plt.title('Original')
        plt.axis('off')

        plt.subplot(142)
        plt.imshow(c1, cmap='gray')
        plt.title(f'{nome_c1}')
        plt.axis('off')

        plt.subplot(143)
        plt.imshow(c2, cmap='gray')
        plt.title(f'{nome_c2}')
        plt.axis('off')

        plt.subplot(144)
        plt.imshow(c3, cmap='gray')
        plt.title(f'{nome_c3}')
        plt.axis('off')

        if salvar:
            cv.imwrite(f'{nome_espaco.lower()}_canal_1.jpg', c1)
            cv.imwrite(f'{nome_espaco.lower()}_canal_2.jpg', c2)
            cv.imwrite(f'{nome_espaco.lower()}_canal_3.jpg', c3)
            print(f"Canais salvos")

    plt.show()

# Histogramas
if escolha_op == '2' or escolha_op == '3':
    if escolha_cor == '4':
        plt.figure(figsize=(6, 4))
        plt.hist(c1.ravel(), bins=256, color='gray')
        plt.title(f'Histograma {nome_espaco}')
        plt.xlabel('Pixel Value')
        plt.ylabel('Frequencia')

        if salvar:
            plt.savefig(f'histograma_{nome_espaco.lower()}.png')
            print(f"Histograma salvo")
    else:
        plt.figure(figsize=(15, 4))

        plt.subplot(131)
        plt.hist(c1.ravel(), bins=256, color='red', alpha=0.7)
        plt.title(f'Histograma {nome_c1}')
        plt.xlabel('Pixel Value')
        plt.ylabel('Frequencia')

        plt.subplot(132)
        plt.hist(c2.ravel(), bins=256, color='green', alpha=0.7)
        plt.title(f'Histograma {nome_c2}')
        plt.xlabel('Pixel Value')
        plt.ylabel('Frequencia')

        plt.subplot(133)
        plt.hist(c3.ravel(), bins=256, color='blue', alpha=0.7)
        plt.title(f'Histograma {nome_c3}')
        plt.xlabel('Pixel Value')
        plt.ylabel('Frequencia')

        if salvar:
            plt.savefig(f'histograma_{nome_espaco.lower()}.png')
            print(f"Histogramas salvos")

    plt.show()

print("\nFim do programa")
