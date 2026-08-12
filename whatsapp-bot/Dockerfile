# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

# auth_info/, data/ y backups/ se montan como volúmenes (ver docker-compose.yml)
# para que la sesión de WhatsApp y los horarios sobrevivan a recrear el contenedor.
CMD ["node", "dist/index.js"]
