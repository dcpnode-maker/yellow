FROM oven/bun:1.3.14-alpine@sha256:5acc90a93e91ff07bf72aa90a7c9f0fa189765aec90b47bdbf2152d2196383c0 AS install

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.3.14-alpine@sha256:5acc90a93e91ff07bf72aa90a7c9f0fa189765aec90b47bdbf2152d2196383c0 AS database-tools

WORKDIR /app

ARG YELLOW_BUILD_SHA
ENV YELLOW_BUILD_SHA=$YELLOW_BUILD_SHA
LABEL org.opencontainers.image.revision=$YELLOW_BUILD_SHA

COPY --from=install --chown=bun:bun /app/node_modules ./node_modules
COPY --chown=bun:bun package.json bun.lock ./
COPY --chown=bun:bun scripts ./scripts
COPY --chown=bun:bun migrations ./migrations
COPY --chown=bun:bun src ./src

USER bun

CMD ["bun", "run", "db:migrate"]

FROM oven/bun:1.3.14-alpine@sha256:5acc90a93e91ff07bf72aa90a7c9f0fa189765aec90b47bdbf2152d2196383c0 AS runtime

WORKDIR /app

ARG YELLOW_BUILD_SHA
ENV NODE_ENV=production
ENV PORT=3000
ENV YELLOW_BUILD_SHA=$YELLOW_BUILD_SHA
LABEL org.opencontainers.image.revision=$YELLOW_BUILD_SHA

COPY --from=install --chown=bun:bun /app/node_modules ./node_modules
COPY --chown=bun:bun package.json bun.lock ./
COPY --chown=bun:bun src ./src

USER bun

EXPOSE 3000

CMD ["bun", "run", "start"]
