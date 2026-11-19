# Se construye desde la raíz del repositorio (usa los paquetes compartidos de packages/)
FROM node:20-alpine AS build
WORKDIR /repo
COPY . .
RUN npm ci && npm run build -w @geohive/geocodificador-web

FROM nginx:1.27-alpine
COPY apps/geocodificador/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/geocodificador/frontend/dist /usr/share/nginx/html/geocodificador
