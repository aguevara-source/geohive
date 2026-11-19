# Se construye desde la raíz del repositorio (usa los paquetes compartidos de packages/)
FROM node:20-alpine AS build
WORKDIR /repo
COPY . .
RUN npm ci && npm run build -w @geohive/visor-web

FROM nginx:1.27-alpine
COPY apps/visor/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/visor/frontend/dist /usr/share/nginx/html/visor
