# ============================================
# 后端 Dockerfile
# ============================================

FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 安装依赖
COPY server/package*.json ./
RUN npm install --production

# 复制源代码
COPY server/ .

# 创建必要目录
RUN mkdir -p logs uploads backups

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 使用PM2运行
RUN npm install -g pm2
CMD ["pm2-runtime", "ecosystem.config.js", "--env", "production"]
