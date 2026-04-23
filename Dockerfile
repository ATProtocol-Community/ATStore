# Playwright base image includes OS deps + browsers under PLAYWRIGHT_BROWSERS_PATH (/ms-playwright).
# Build from repository root:
#   docker build -f packages/db/Dockerfile .
FROM mcr.microsoft.com/playwright:v1.59.1-noble

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate

COPY . .

# Keep install command compatible with older pnpm CLIs in base images.
RUN pnpm install
RUN pnpm build

ENV NODE_ENV=production

CMD ["bash"]
