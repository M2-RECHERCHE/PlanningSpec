# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS base

ARG MINIZINC_VERSION="2.9.7"
ARG MINIZINC_BUNDLE_SHA256="7e78d3a1d6feec2f5b6a43628632decb6995755ade92ff4e51a2188c54ca6399"
ARG MINIZINC_BUNDLE_URL="https://github.com/MiniZinc/MiniZincIDE/releases/download/${MINIZINC_VERSION}/MiniZincIDE-${MINIZINC_VERSION}-bundle-linux-x86_64.tgz"
ARG MINIZINC_SOLVER_PACKAGES=""
ARG REQUIRE_MINIZINC_SOLVERS="Gecode Chuffed HiGHS"

ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:/opt/minizinc/bin:${PATH}"
WORKDIR /app

COPY docker/verify-minizinc-solvers.sh /usr/local/bin/verify-minizinc-solvers

RUN corepack enable \
    && apt-get -o Acquire::Retries=5 update \
    && apt-get -o Acquire::Retries=5 install -y --no-install-recommends ca-certificates curl libegl1 libfontconfig1 libgl1 tar tini \
    && mkdir -p /opt/minizinc \
    && curl -fsSL "$MINIZINC_BUNDLE_URL" -o /tmp/minizinc-bundle.tgz \
    && printf '%s  %s\n' "$MINIZINC_BUNDLE_SHA256" /tmp/minizinc-bundle.tgz | sha256sum -c - \
    && tar -xzf /tmp/minizinc-bundle.tgz -C /opt/minizinc --strip-components=1 \
    && ln -sf /opt/minizinc/bin/minizinc /usr/bin/minizinc \
    && if [ -n "$MINIZINC_SOLVER_PACKAGES" ]; then \
        apt-get -o Acquire::Retries=5 install -y --no-install-recommends $MINIZINC_SOLVER_PACKAGES; \
      fi \
    && chmod +x /usr/local/bin/verify-minizinc-solvers \
    && REQUIRE_MINIZINC_SOLVERS="$REQUIRE_MINIZINC_SOLVERS" verify-minizinc-solvers \
    && rm -f /tmp/minizinc-bundle.tgz \
    && rm -rf /var/lib/apt/lists/*

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
COPY backend/packages/language/package.json backend/packages/language/package.json
COPY backend/packages/server/package.json backend/packages/server/package.json
COPY backend/packages/cli/package.json backend/packages/cli/package.json
COPY backend/packages/extension/package.json backend/packages/extension/package.json
COPY frontend/package.json frontend/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS dev

ENV NODE_ENV=development
COPY . .
EXPOSE 4000
CMD ["pnpm", "--filter", "planning-spec-server", "dev"]

FROM deps AS build

COPY . .
RUN pnpm --filter planning-spec-language build \
    && pnpm --filter planning-spec-server build

FROM base AS runtime

ENV NODE_ENV=production
ENV PORT=4000
ENV MINIZINC_PATH=/usr/bin/minizinc
ENV MINIZINC_WORKDIR=/var/lib/planify/minizinc

RUN groupadd --system --gid 10001 planify \
    && useradd --system --uid 10001 --gid planify --home-dir /app --shell /usr/sbin/nologin planify \
    && mkdir -p /var/lib/planify/minizinc /var/log/planify \
    && chown -R planify:planify /app /var/lib/planify /var/log/planify

COPY --from=build --chown=planify:planify /app /app

USER planify
EXPOSE 4000
ENTRYPOINT ["tini", "--"]
CMD ["node", "backend/packages/server/dist/server.js"]
