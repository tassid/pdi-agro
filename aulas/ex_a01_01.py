import cv2 as cv
import numpy as np
import matplotlib.pyplot as plt

# pedir pro usuário o caminho da imagem
image_path = input("Digite o caminho da imagem: ")
# Carregar a imagem
img = cv.imread(image_path)

# Verificar se a imagem foi carregada corretamente
if img is None:
    print("Erro ao carregar a imagem. Verifique o caminho e tente novamente.")
    exit()
    
# criar menu de opções para o usuário escolher
print("\nEscolha uma opção:")
print("1 - gere os canais de espaço da cor")
print("2 - gere os histogramas dos canais de cor")
print("3 - fazer ambas as opções")
choice = input("Digite sua escolha (1/2/3): ").strip()

print("Deseja salvar as imagens geradas? (s/n)")
save_option = input().lower() == 's'

# Converter para o espaço de cor HSV (usado em todas as opções)
hsv_img = cv.cvtColor(img, cv.COLOR_BGR2HSV)
h, s, v = cv.split(hsv_img)

# Processar a imagem com base na escolha do usuário
if choice == '1' or choice == '3':
    if save_option:
        # Salvar os canais
        cv.imwrite('hue_channel.jpg', h)
        cv.imwrite('saturation_channel.jpg', s)
        cv.imwrite('value_channel.jpg', v)
        print("✓ Canais salvos como 'hue_channel.jpg', 'saturation_channel.jpg' e 'value_channel.jpg'.")
    else:
        print("✓ Canais gerados (não salvos).")

if choice == '2' or choice == '3':
    # Gerar histogramas
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

    if save_option:
        # Salvar os histogramas
        plt.savefig('histogramas_canais_cor.png')
        print("✓ Histogramas salvos como 'histogramas_canais_cor.png'.")
    else:
        print("✓ Histogramas gerados (não salvos).")

    plt.show()


