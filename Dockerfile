# The app: Next.js standalone on Node 24. See docker-compose.yml.

FROM node:24-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Full source and every dependency, dev ones included. The build runs here,
# and so does `migrate` in docker-compose.yml, which needs drizzle-kit.
FROM deps AS builder
COPY . .
# NEXT_PUBLIC_* are inlined into the client bundle when it is built, so the
# rig's measured spans have to be here, not only at runtime. docker-compose
# passes them through from .env.
ARG NEXT_PUBLIC_SHEET_TOP_MM
ARG NEXT_PUBLIC_SHEET_RIGHT_MM
ARG NEXT_PUBLIC_SHEET_BOTTOM_MM
ARG NEXT_PUBLIC_SHEET_LEFT_MM
ARG NEXT_PUBLIC_SHEET_DIAG_MM
ARG NEXT_PUBLIC_SHEET_DIAG2_MM
ARG NEXT_PUBLIC_SHEET_BLACK_SQUARE_MM
ENV NEXT_PUBLIC_SHEET_TOP_MM=$NEXT_PUBLIC_SHEET_TOP_MM \
    NEXT_PUBLIC_SHEET_RIGHT_MM=$NEXT_PUBLIC_SHEET_RIGHT_MM \
    NEXT_PUBLIC_SHEET_BOTTOM_MM=$NEXT_PUBLIC_SHEET_BOTTOM_MM \
    NEXT_PUBLIC_SHEET_LEFT_MM=$NEXT_PUBLIC_SHEET_LEFT_MM \
    NEXT_PUBLIC_SHEET_DIAG_MM=$NEXT_PUBLIC_SHEET_DIAG_MM \
    NEXT_PUBLIC_SHEET_DIAG2_MM=$NEXT_PUBLIC_SHEET_DIAG2_MM \
    NEXT_PUBLIC_SHEET_BLACK_SQUARE_MM=$NEXT_PUBLIC_SHEET_BLACK_SQUARE_MM \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
USER app
EXPOSE 3000
CMD ["node", "server.js"]
