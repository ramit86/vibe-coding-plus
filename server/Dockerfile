FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev || npm i --omit=dev
COPY server ./server
EXPOSE 8787
CMD ["node", "server/index.mjs"]
