# Publicação no Apache

## O que foi implementado

- Backend em `PHP + SQLite` em `api/index.php`
- Bootstrap automático do banco em `api/bootstrap.php`
- Cadastro, login e sessão de clientes
- Criação de pedidos com histórico por usuário
- Painel admin para pedidos, status e catálogo

## Estrutura importante

- `cliente_pedidos/`: frontend do cliente
- `site/`: painel administrativo
- `api/`: backend PHP
- `data/app.sqlite`: banco SQLite criado automaticamente na primeira requisição
- `racoes.json`: base inicial importada para o banco no primeiro acesso

## Requisitos do Apache no Windows

1. Apache com PHP habilitado
2. Extensões PHP ativas:
- `pdo_sqlite`
- `sqlite3`
3. Permissão de escrita na pasta `data/`

## Exemplo de VirtualHost

```apache
<VirtualHost *:80>
    ServerName casadasracoes.local
    DocumentRoot "C:/Users/Usuário/Desktop/planilha"

    <Directory "C:/Users/Usuário/Desktop/planilha">
        AllowOverride All
        Require all granted
        Options Indexes FollowSymLinks
    </Directory>
</VirtualHost>
```

## Como publicar

1. Aponte o `DocumentRoot` do Apache para a pasta do projeto.
2. Reinicie o Apache.
3. Abra no navegador:
- `http://casadasracoes.local/cliente_pedidos/`
- `http://casadasracoes.local/site/`
4. No primeiro acesso, o arquivo `data/app.sqlite` sera criado automaticamente.

## Login inicial do admin

- E-mail: `admin@casadasracoes.local`
- Senha: `1234`

## Fluxos disponiveis

### Cliente

- cadastro de conta
- login/logout
- listagem de produtos
- carrinho local no navegador
- criacao de pedido
- historico de pedidos

### Admin

- login administrativo
- listagem de pedidos
- filtro por status
- atualizacao de status
- cadastro, edicao e exclusao de produtos

## Observacoes

- O banco importa os produtos de `racoes.json` apenas quando a tabela `products` estiver vazia.
- Se voce apagar `data/app.sqlite`, o sistema recria o banco e reimporta o catalogo.
- O painel admin depende de sessao PHP; mantenha cookies habilitados no navegador.
- O projeto desta maquina ainda nao tem PHP instalado no terminal, entao a validacao final em runtime no ambiente local ficou pendente.
