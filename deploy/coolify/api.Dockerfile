FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY src/api/package.json src/api/
COPY src/frontend/package.json src/frontend/
COPY src/cdk/package.json src/cdk/
RUN npm ci --include=dev && npm install -g tsx@4
COPY src/api ./src/api
EXPOSE 3001
CMD ["tsx", "src/api/src/server.ts"]
