# ============================================
# 前端 Dockerfile (构建阶段)
# ============================================

# 构建阶段
FROM node:18-alpine as builder

WORKDIR /app

# 安装依赖
COPY web/package*.json ./
RUN npm install

# 复制源代码并构建
COPY web/ .
RUN npm run build

# 生产阶段 - 使用 Nginx 托管静态文件
FROM nginx:alpine

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制Nginx配置
COPY docker/nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
