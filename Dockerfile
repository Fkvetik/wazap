FROM node:20-bullseye-slim

WORKDIR /app

# Instalar dependências do sistema uma única vez (na build da imagem)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ git \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependências Node (cache layer separado)
COPY package*.json ./
RUN npm install --production

# Copiar código fonte
COPY . .

# Criar diretório de dados
RUN mkdir -p data/sessions

EXPOSE 3000

CMD ["node", "src/index.js"]
