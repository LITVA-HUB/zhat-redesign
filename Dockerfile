FROM node:24-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json requirements-content.txt ./
RUN npm ci && python3 -m venv /opt/zhat-venv \
    && /opt/zhat-venv/bin/pip install --no-cache-dir -r requirements-content.txt
COPY . .
RUN npm run build

ENV PATH="/opt/zhat-venv/bin:${PATH}" \
    NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0
EXPOSE 8080
VOLUME ["/app/.data"]
CMD ["node", "scripts/serve.mjs"]
