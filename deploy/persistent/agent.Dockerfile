FROM node:22-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends util-linux python3 python3-pil xvfb xauth ffmpeg libgl1-mesa-dev libxi-dev libxext-dev libx11-dev libglu1-mesa-dev build-essential pkg-config libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm install --no-save --no-audit --no-fund 'github:PrismarineJS/node-canvas-webgl' webpack@5 webpack-cli@6 process buffer assert
COPY src ./src
COPY scripts ./scripts
ARG CRAFTLE_CUSTOM_VIEWER=1
RUN if [ "$CRAFTLE_CUSTOM_VIEWER" = "1" ]; then node scripts/patch-prismarine-browser.js && (cd node_modules/prismarine-viewer && /app/node_modules/.bin/webpack --config webpack.config.js); else echo 'Craftle cinematic camera disabled: using stock Prismarine Viewer'; fi
CMD ["flock", "-n", "/state/agent/runner.lock", "node", "scripts/persistent-agent.js"]
