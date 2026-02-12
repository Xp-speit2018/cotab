FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

FROM node:22-alpine

WORKDIR /app
COPY --from=builder /app/package.json /app/package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist/ dist/

ENV PORT=4444
EXPOSE 4444

USER node
CMD ["node", "dist/index.js"]
