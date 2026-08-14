FROM oven/bun:1.3.14-alpine AS install

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.3.14-alpine AS database-tools

WORKDIR /app

COPY --from=install /app/node_modules ./node_modules
COPY package.json bun.lock ./
COPY scripts ./scripts
COPY migrations ./migrations

CMD ["bun", "run", "db:migrate"]

FROM oven/bun:1.3.14-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=install --chown=bun:bun /app/node_modules ./node_modules
COPY --chown=bun:bun package.json bun.lock ./
COPY --chown=bun:bun src ./src

USER bun

EXPOSE 3000

CMD ["bun", "run", "start"]
