FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY src/api/package.json src/api/
COPY src/frontend/package.json src/frontend/
COPY src/cdk/package.json src/cdk/
RUN npm ci --workspace=src/frontend --workspace=src/api --include-workspace-root --include=dev

COPY src/api ./src/api
COPY src/frontend ./src/frontend
RUN npm -w src/frontend run build

FROM nginx:1.27-alpine
COPY deploy/coolify/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/src/frontend/dist /usr/share/nginx/html
EXPOSE 80
