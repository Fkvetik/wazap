# Wazap — Disparador WhatsApp com Baileys

Sistema completo de disparador WhatsApp multi-instância, sem Puppeteer, com painel web.

## Requisitos

- Node.js 18+ (recomendado: 20 LTS)
- npm ou yarn
- Ubuntu 22.04 / Windows 10+

---

## Instalação

### 1. Clone ou copie a pasta do projeto

```bash
cd wazap
npm install
```

### 2. Inicie o sistema

```bash
npm start
```

Acesse o painel em: **http://localhost:3000**

---

## Uso básico

### Conectar um número

1. Abra o painel → aba **Instâncias**
2. Digite um ID (ex: `chip1`) → clique **Adicionar**
3. O QR Code aparece na tela
4. No celular: WhatsApp → menu ⋮ → **Dispositivos conectados** → **Conectar dispositivo**
5. Escaneie o QR. O status muda para **Conectado** ✅

### Criar campanha e disparar

1. Aba **Campanhas** → **Nova campanha**
2. Preencha nome, mensagem (use `{nome}`, `{cidade}` para personalizar)
3. Configure delays, horário e limite diário
4. **Salve**
5. Importe contatos (CSV ou Google Sheets)
6. Clique **▶ Iniciar**

---

## Formato do CSV

```
telefone,nome,cidade,produto
5511999998888,João,São Paulo,Apartamento X
5521988887777,Maria,Rio de Janeiro,Studio Y
```

- Coluna obrigatória: `telefone` (ou `phone`, `numero`, `number`)
- Coluna de nome: `nome` (ou `name`) — opcional
- Demais colunas viram variáveis `{coluna}` na mensagem

---

## Google Sheets

Para importar de planilha pública basta o ID (trecho da URL entre `/d/` e `/edit`):

```
https://docs.google.com/spreadsheets/d/1BxiMVs0XRA...ABC/edit
                                        ^^^^^^^^^^^^^^^^
                                        este é o ID
```

Para planilhas privadas, coloque o arquivo `google_credentials.json`
(conta de serviço) dentro da pasta `data/`.

---

## Variáveis de personalização

Na mensagem, use `{nome_da_coluna}`:

```
Oi {nome}! Temos uma oferta exclusiva em {cidade}.
Confira o empreendimento {produto} 🏠
```

---

## Configurações de campanha

| Campo | Descrição | Padrão |
|-------|-----------|--------|
| Delay mínimo | Menor espera entre mensagens (seg) | 8s |
| Delay máximo | Maior espera entre mensagens (seg) | 25s |
| Horário início | Começa a enviar a partir de (hora) | 08h |
| Horário fim | Para de enviar depois de (hora) | 20h |
| Limite diário | Máx. mensagens por número/dia | 200 |
| Rotação | Como alterna instâncias | round-robin |

---

## Rodando com PM2 (VPS)

```bash
npm install -g pm2
pm2 start src/index.js --name wazap
pm2 save
pm2 startup
```

Ver logs:
```bash
pm2 logs wazap
```

---

## Estrutura de arquivos

```
wazap/
├── src/
│   ├── index.js      # Entrada principal
│   ├── db.js         # Banco SQLite
│   ├── whatsapp.js   # Gerenciador Baileys
│   ├── sender.js     # Motor de disparo
│   ├── importer.js   # CSV + Google Sheets
│   ├── api.js        # Rotas Express
│   └── socket.js     # Módulo Socket.IO
├── public/
│   └── index.html    # Painel web
├── data/
│   ├── wazap.db      # Banco SQLite (criado automaticamente)
│   └── sessions/     # Sessões Baileys (criadas automaticamente)
├── uploads/          # Mídias das campanhas
├── package.json
└── README.md
```

---

## Anti-ban: o que o sistema faz

- Simula digitação (`composing`) antes de cada mensagem
- Delay aleatório entre mensagens (configurável)
- Limita envios por número por dia
- Rotação entre múltiplos chips
- Valida se número existe no WhatsApp antes de enviar
- Detecta ban (erro 403) e pausa a instância automaticamente
- Respeita janela horária configurada

---

## Variáveis de ambiente (opcional)

Crie um arquivo `.env` na raiz:

```env
PORT=3000
GOOGLE_API_KEY=sua_api_key_aqui
```

---

## Avisos importantes

- Use sempre números previamente aquecidos (warmup)
- Delays abaixo de 5s aumentam risco de ban
- Não envie para listas compradas sem consentimento
- O sistema salva sessões localmente em `data/sessions/`
