# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS deps

ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
COPY backend/packages/language/package.json backend/packages/language/package.json
COPY backend/packages/server/package.json backend/packages/server/package.json
COPY backend/packages/cli/package.json backend/packages/cli/package.json
COPY backend/packages/extension/package.json backend/packages/extension/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS dev

ENV NODE_ENV=development
ENV HOST=0.0.0.0
COPY . .
EXPOSE 3000
CMD ["pnpm", "--filter", "planning-spec-frontend", "start"]

FROM deps AS build

ARG REACT_APP_API_BASE_URL=
ENV REACT_APP_API_BASE_URL=${REACT_APP_API_BASE_URL}
COPY . .
RUN pnpm --filter planning-spec-frontend build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY docker/nginx-frontend.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/build /usr/share/nginx/html

EXPOSE 8080
