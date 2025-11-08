FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV TRANSPORT=http
EXPOSE 8081
CMD ["node", "dist/server/index.js"]
