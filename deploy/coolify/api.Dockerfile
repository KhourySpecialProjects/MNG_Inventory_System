FROM node:22-bookworm-slim
# Python runs the DA 2404 and CSV export scripts (they used to be AWS Lambda functions)
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip \
    && pip3 install --no-cache-dir --break-system-packages boto3 pypdf reportlab pillow \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY src/api/package.json src/api/
COPY src/frontend/package.json src/frontend/
COPY src/cdk/package.json src/cdk/
RUN npm ci --include=dev && npm install -g tsx@4
COPY src/api ./src/api
COPY src/cdk/python_2404/2404_handler.py /app/exports/2404_handler.py
COPY src/cdk/python_inventory/inventory_handler.py /app/exports/inventory_handler.py
COPY deploy/coolify/run_export.py /app/exports/run_export.py
EXPOSE 3001
CMD ["tsx", "src/api/src/server.ts"]
