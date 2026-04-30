# Deploy 24h (online permanente)

Este projeto ja esta preparado para deploy com persistencia do banco SQLite (`data/app.sqlite`) usando Docker.

## Opcao 1: Render (recomendado)

1. Crie uma conta em [Render](https://render.com) e conecte seu GitHub.
2. Suba este projeto para um repositorio no GitHub.
3. No Render, clique em **New +** -> **Blueprint** e selecione o repositorio.
4. O arquivo `render.yaml` criara automaticamente:
   - 1 Web Service com Docker
   - 1 disco persistente montado em `/var/data`
5. Aguarde o build terminar.
6. URL final:
   - Cliente: `https://SEU-APP.onrender.com/cliente_pedidos/`
   - Admin: `https://SEU-APP.onrender.com/site/login.html`

## Opcao 2: Railway

1. Crie uma conta em [Railway](https://railway.app).
2. Crie projeto e conecte o repositorio GitHub.
3. Railway detecta `Dockerfile`/`railway.json` automaticamente.
4. Adicione um volume persistente e monte em `/var/data`.
5. Publique e use os mesmos caminhos de cliente/admin.

## Observacoes importantes

- O `docker-entrypoint.sh` cria um link simbolico para salvar `data/` no disco persistente.
- Sem disco persistente, pedidos e cadastros podem ser perdidos em reinicios.
- O login inicial admin continua:
  - `admin@casadasracoes.local`
  - `1234`
