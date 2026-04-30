import os
import time
from googlesearch import search
import requests

def get_images(racoes):
    results = {}
    for racao in racoes:
        query = f"ração {racao} embalagem"
        print(f"Pesquisando: {query}")
        # Como não posso usar o search do Google diretamente para imagens de forma eficiente aqui sem uma API key,
        # vou usar o tool de busca do sistema em um loop controlado no pensamento do agente.
        # Este script é apenas um placeholder caso eu precise de lógica complexa, 
        # mas vou usar a ferramenta 'search' diretamente.
        pass

if __name__ == "__main__":
    with open("lista_racoes.txt", "r") as f:
        racoes = [line.strip() for line in f.readlines()]
    
    # Vou processar as primeiras 10 para não sobrecarregar
    # e depois perguntar ao usuário se ele quer todas (são centenas).
    print(racoes[:10])
