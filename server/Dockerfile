# Servidor de Puca no Fly.io (docs/stack.md §5.2). Build a partir da raiz do repo: o servidor usa src/journey e src/voice.
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm install -g tsx@4.23.15 && npm cache clean --force

COPY tsconfig.json ./
COPY src ./src
# src/data importa o mapa da Kota (kit/kota/mapa.ts); o turno do LLM leva o Notion da Kota no prompt (decisão 0012)
COPY kit ./kit
COPY server ./server

# Company brain com os ADRs e o código do kota-bank (#228): o repo é público, entra num commit fixo
ARG KOTA_BANK_COMMIT=5f38c79eeba30d9b7dfe2f58bb272d9040ea928e
RUN mkdir -p /app/kota-bank \
  && node -e "fetch('https://codeload.github.com/JucaGF/kota-bank/tar.gz/${KOTA_BANK_COMMIT}').then(r=>{if(!r.ok)throw new Error('kota-bank '+r.status);return r.arrayBuffer()}).then(b=>require('fs').writeFileSync('/tmp/kb.tgz',Buffer.from(b)))" \
  && tar xzf /tmp/kb.tgz -C /app/kota-bank --strip-components=1 && rm /tmp/kb.tgz
ENV KOTA_BANK_DIR=/app/kota-bank

EXPOSE 8787
CMD ["tsx", "server/src/server.ts"]
