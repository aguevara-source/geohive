# Se construye desde la raíz del repositorio (usa los paquetes compartidos de packages/)
FROM node:20-alpine AS build
WORKDIR /repo
# true: solo presentación (sin "Ingresar" ni acceso a las apps). false: plataforma completa.
ARG SOLO_PRESENTACION=false
ENV VITE_SOLO_PRESENTACION=$SOLO_PRESENTACION
COPY . .
RUN npm ci && npm run build -w @geohive/portal

FROM nginx:1.27-alpine
COPY portal/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/portal/dist /usr/share/nginx/html
