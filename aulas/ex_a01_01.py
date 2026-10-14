import cv2 as cv
import numpy as np
import matplotlib.pyplot as plt
import os

# Pedir o caminho da imagem
image_path = input("Digite o caminho da imagem: ")
img = cv.imread(image_path)

if img is None:
    print("Erro ao carregar a imagem. Verifique o caminho e tente novamente.")
    exit()

# Converter BGR para RGB para exibição correta
img_rgb = cv.cvtColor(img, cv.COLOR_BGR2RGB)

# Menu de espaço de cor
print("\nEscolha o espaço de cor:")
print("1 - HSV (Hue, Saturation, Value)")
print("2 - RGB (Red, Green, Blue)")
print("3 - LAB (Luminance, A, B)")
print("4 - Grayscale (Escala de cinza)")
color_choice = input("Digite sua escolha (1/2/3/4): ").strip()

# Menu de operações
print("\nEscolha uma opção:")
print("1 - Exibir os canais do espaço de cor")
print("2 - Gerar histogramas dos canais")
print("3 - Fazer ambas as opções")
operation_choice = input("Digite sua escolha (1/2/3): ").strip()

print("\nDeseja salvar as imagens geradas? (s/n)")
save_option = input().lower() == 's'

# Dicionário para armazenar conversões e nomes de canais
color_spaces = {
    '1': {'name': 'HSV', 'func': lambda x: cv.cvtColor(x, cv.COLOR_BGR2HSV), 'channels': ['Hue', 'Saturation', 'Value'], 'colors': ['red', 'green', 'blue']},
    '2': {'name': 'RGB', 'func': lambda x: cv.cvtColor(x, cv.COLOR_BGR2RGB), 'channels': ['Red', 'Green', 'Blue'], 'colors': ['red', 'green', 'blue']},
    '3': {'name': 'LAB', 'func': lambda x: cv.cvtColor(x, cv.COLOR_BGR2LAB), 'channels': ['Luminance', 'A', 'B'], 'colors': ['gray', 'purple', 'orange']},
    '4': {'name': 'Grayscale', 'func': lambda x: cv.cvtColor(x, cv.COLOR_BGR2GRAY), 'channels': ['Intensity'], 'colors': ['gray']}
}

if color_choice not in color_spaces:
    print("Opção inválida!")
    exit()

space = color_spaces[color_choice]
converted_img = space['func'](img)
channels = cv.split(converted_img) if color_choice != '4' else [converted_img]

print(f"\n✓ Imagem convertida para {space['name']}")

# Exibir canais
if operation_choice == '1' or operation_choice == '3':
    plt.figure(figsize=(15, 5))

    # Mostrar imagem original
    plt.subplot(1, len(channels) + 1, 1)
    plt.imshow(img_rgb)
    plt.title('Original (RGB)')
    plt.axis('off')

    # Mostrar cada canal
    for i, (channel, channel_name) in enumerate(zip(channels, space['channels'])):
        plt.subplot(1, len(channels) + 1, i + 2)
        if space['name'] == 'Grayscale':
            plt.imshow(channel, cmap='gray')
        else:
            plt.imshow(channel, cmap='gray')
        plt.title(f'{space["name"]}: {channel_name}')
        plt.axis('off')

    if save_option:
        for i, (channel, channel_name) in enumerate(zip(channels, space['channels'])):
            filename = f"{space['name'].lower()}_{channel_name.lower()}.jpg"
            cv.imwrite(filename, channel)
        print(f"✓ Canais do {space['name']} salvos como imagens.")

    plt.tight_layout()
    plt.show()

# Gerar histogramas
if operation_choice == '2' or operation_choice == '3':
    plt.figure(figsize=(15, 4))

    for i, (channel, channel_name, color) in enumerate(zip(channels, space['channels'], space['colors'])):
        plt.subplot(1, len(channels), i + 1)
        plt.hist(channel.ravel(), bins=256, range=[0, 256], color=color, alpha=0.7)
        plt.title(f'Histograma {space["name"]}: {channel_name}')
        plt.xlabel('Pixel Value')
        plt.ylabel('Frequency')
        plt.grid(True, alpha=0.3)

    if save_option:
        filename = f"histogramas_{space['name'].lower()}.png"
        plt.savefig(filename, dpi=150, bbox_inches='tight')
        print(f"✓ Histogramas salvos como '{filename}'.")

    plt.tight_layout()
    plt.show()

print("\n✓ Processamento concluído!")


