# ---------- BUILD ----------
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build -- --configuration production

# ---------- SERVE ----------
FROM nginx:alpine

# Limpia nginx default
RUN rm -rf /usr/share/nginx/html/*

# Copia build Ionic/Angular
COPY --from=build /app/www /usr/share/nginx/html

# 🔥 Copia config SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
