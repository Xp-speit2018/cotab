FROM node:22-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json wrangler.jsonc ./
COPY worker/ worker/

EXPOSE 8787

CMD ["npm", "run", "dev", "--", "--ip", "0.0.0.0", "--port", "8787", "--persist-to", "/data"]
