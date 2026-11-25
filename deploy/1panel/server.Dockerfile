FROM oven/bun:1.4.2

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY drizzle.config.ts tsconfig.json ./
COPY drizzle ./drizzle
COPY scripts/database.ts ./scripts/database.ts
COPY src ./src

USER bun
CMD ["bun", "run", "start"]
