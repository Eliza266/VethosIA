# API VetIA (NestJS) para Cloud Run. Multi-stage: build con devDeps, runtime slim.
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# Cloud Run inyecta PORT; el server escucha en 0.0.0.0:$PORT.
EXPOSE 8080
CMD ["node", "dist/main.js"]
