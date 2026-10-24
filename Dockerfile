# Official Playwright image: Node + Chromium + its system libraries, pinned to the same Playwright version as package.json.
FROM mcr.microsoft.com/playwright:v1.63.0-noble

WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/mcp-server/package.json packages/mcp-server/
COPY packages/agent/package.json packages/agent/
COPY apps/dashboard/package.json apps/dashboard/
RUN npm ci --include=dev
COPY . .
RUN npm run build

ENV PORT=10000
EXPOSE 10000
CMD ["npm", "start"]
