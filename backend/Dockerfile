# ---------- BUILD ----------
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Genera Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# ---------- RUN ----------
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
# Asegura que las plantillas HTML existan en la imagen incluso si el script de copia fallara
COPY --from=build /app/src/Modules/email/templates ./dist/Modules/email/templates
COPY --from=build /app/src/Modules/email/templates ./dist/src/Modules/email/templates

EXPOSE 3018

# Ejecuta migraciones y luego aplica seeds antes de iniciar
CMD ["sh", "-c", "npx prisma migrate deploy && npm run seed:prod && node dist/src/index.js"]
