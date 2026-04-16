#
# web-frontend (Next.js) - Cloud Run Dockerfile
#
# Notes:
# - Cloud Run sets $PORT (default 8080). We bind Next to 0.0.0.0:$PORT.
# - NEXT_PUBLIC_* vars are baked at build time for client bundles; we pass them as build args.
#

FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile


FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure optional runtime asset directories exist even if the repo doesn't have them.
RUN mkdir -p /app/public

RUN yarn build


FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Keep runtime assets that next-intl dynamically imports
COPY --from=builder /app/messages ./messages
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/middleware.ts ./middleware.ts

# Next.js runtime deps
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 8080

CMD ["sh", "-c", "node_modules/.bin/next start -H 0.0.0.0 -p ${PORT}"]

