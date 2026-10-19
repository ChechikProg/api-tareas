# Opcional: la misma API empaquetada como imagen Docker.
# Sirve para desplegar en Fly.io, Railway, un VPS o Render con runtime: docker,
# y demuestra que la app es portable (no depende de una plataforma).

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
USER node
EXPOSE 3000
CMD ["npm", "start"]
