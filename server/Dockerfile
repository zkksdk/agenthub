# =============================================
# Builder 阶段：只编译 TypeScript
# =============================================
FROM node:18-alpine AS builder

# 安装编译工具链（better-sqlite3 需要）
RUN apk add --no-cache python3 make g++

WORKDIR /app

# 先只复制依赖文件，利用 Docker 缓存
COPY package*.json ./
RUN npm ci

# 再复制源码（这层会缓存直到源码改变）
COPY . .

# 编译 TypeScript
RUN npm run build

# =============================================
# Production 阶段：只运行，不需要编译工具链
# =============================================
FROM node:18-alpine

RUN apk add --no-cache \
    python3 make g++ \
    && mkdir -p /app/uploads /app/data /app/web/dist \
    && chown -R node:node /app

WORKDIR /app

# 以 node 用户运行（更安全）
USER node

COPY --from=builder --chown=node:node /app/dist       ./dist
COPY --from=builder --chown=node:node /app/package*.json ./

# 只装生产依赖，节省镜像体积
RUN npm ci --omit=dev && rm -rf /root/.npm

# 复制前端构建产物（如果存在，否则 nginx 会报 404 但 API 正常）
COPY --from=builder --chown=node:node /app/web/dist ./web/dist 2>/dev/null || true

EXPOSE 3000

CMD ["node", "dist/main"]
