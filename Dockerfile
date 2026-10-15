# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; \
    npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS server
WORKDIR /app
ENV NODE_ENV=production GUIDE_HOST=0.0.0.0 GUIDE_PORT=8787 GUIDE_DATA_DIR=/app/.runtime GUIDE_SECURE_COOKIES=true
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; \
    npm ci --omit=dev && mkdir /app/.runtime && chown node:node /app/.runtime
COPY --from=build /app/dist ./dist
COPY server ./server
COPY src/data.ts src/guide-schema.ts ./src/
USER node
VOLUME ["/app/.runtime"]
EXPOSE 8787
CMD ["node", "--use-env-proxy", "server/index.mjs"]
