FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build && cp -r .next/static .next/standalone/.next/static && mkdir -p /app/data/raw /app/.next/standalone/.next/cache && chown -R node:node /app/data /app/.next/standalone/.next/cache
USER node
ENV NODE_ENV=production PORT=3100 HOSTNAME=0.0.0.0 RAW_DATA_DIR=/app/data/raw
EXPOSE 3100
CMD ["node", ".next/standalone/server.js"]
