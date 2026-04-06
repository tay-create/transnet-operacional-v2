# ═══════════════════════════════════════════════════════════════
# Stage 1 — Build do React
# ═══════════════════════════════════════════════════════════════
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY public ./public
COPY src ./src
COPY tailwind.config.js ./
COPY .env.example .env

ARG GENERATE_SOURCEMAP=false
ENV GENERATE_SOURCEMAP=$GENERATE_SOURCEMAP
ENV NODE_OPTIONS=--openssl-legacy-provider

RUN npm run build

# ═══════════════════════════════════════════════════════════════
# Stage 2 — Runtime Node (Express)
# ═══════════════════════════════════════════════════════════════
FROM node:20-alpine AS runtime

ENV TZ=America/Sao_Paulo
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/America/Sao_Paulo /etc/localtime && \
    echo "America/Sao_Paulo" > /etc/timezone

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps

COPY server.js ./
COPY middleware ./middleware
COPY src ./src

COPY --from=builder /app/build ./build

EXPOSE 3001

RUN addgroup -S transnet && adduser -S transnet -G transnet
USER transnet

CMD ["node", "server.js"]