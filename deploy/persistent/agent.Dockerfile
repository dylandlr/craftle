FROM node:22-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends util-linux python3 python3-pil xvfb xauth ffmpeg libgl1-mesa-dev libxi-dev libxext-dev libx11-dev libglu1-mesa-dev build-essential pkg-config libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm install --no-save 'github:PrismarineJS/node-canvas-webgl'
COPY src ./src
COPY scripts ./scripts
CMD ["flock", "-n", "/state/agent/runner.lock", "node", "scripts/persistent-agent.js"]
