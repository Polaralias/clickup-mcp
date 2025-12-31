# Build stage
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
# Install only production dependencies
RUN npm ci --omit=dev
# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
ENV TRANSPORT=http
EXPOSE 8081
CMD ["node", "dist/server/index.js"]
