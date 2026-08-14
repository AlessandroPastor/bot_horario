# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine AS admin-build
WORKDIR /app/admin-panel
COPY admin-panel/package.json admin-panel/package-lock.json ./
RUN npm ci
COPY admin-panel ./
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=admin-build /app/admin-panel/dist ./admin-static

# auth_info/, data/ y backups/ se montan como volúmenes (ver docker-compose.yml)
# para que la sesión de WhatsApp, los horarios y el panel de admin sobrevivan
# a recrear el contenedor.
CMD ["node", "dist/index.js"]
