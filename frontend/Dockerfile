# VulnFlow Frontend Dockerfile - Multi-stage build
# 技术栈: Vite + React 19 + TypeScript + TailwindCSS 4

# ============================================================
# Stage: development (开发模式，支持热重载)
# ============================================================
FROM node:22-alpine AS development

WORKDIR /app

# 安装 curl 用于容器健康检查 (docker-compose healthcheck 需要)
RUN apk add --no-cache curl

# 先复制依赖描述文件，利用 Docker 层缓存
COPY package.json package-lock.json* ./

# 安装依赖 (node_modules 会被 docker-compose 的匿名卷保留)
RUN npm ci --include=dev

# 源码通过 volume 挂载 (./frontend:/app)，此处无需 COPY 源码
EXPOSE 3000

# 启动 Vite 开发服务器，监听所有网卡、端口 3000 (匹配 docker-compose expose)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000", "--strictPort"]

# ============================================================
# Stage: build (生产构建)
# ============================================================
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --include=dev

COPY . .
RUN npm run build

# ============================================================
# Stage: production (Nginx 静态托管)
# ============================================================
FROM nginx:alpine AS production

RUN apk add --no-cache curl

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=10s \
    CMD curl -f http://localhost:3000/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
