# Servidor da Puca no Fly.io (docs/stack.md §5.2). Build a partir da raiz do repo: o servidor usa src/journey e src/voice.
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm install -g tsx@4.23.15 && npm cache clean --force

COPY tsconfig.json ./
COPY src ./src
COPY server ./server

EXPOSE 8787
CMD ["tsx", "server/src/server.ts"]
