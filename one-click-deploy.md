# ============================================
# 腾讯云一键部署命令
# 使用方法：复制下方命令，在腾讯云服务器上执行
# ============================================

## 🚀 一键部署（复制整个代码块执行）

登录到腾讯云服务器后，执行以下命令（**一次性复制整个代码块**）：

```bash
# 下载并执行部署脚本（自动安装所有依赖）
curl -fsSL https://raw.githubusercontent.com/你的用户名/stockManagement/main/auto-deploy.sh | sudo bash
```

如果上述命令无法访问（脚本未上传到GitHub），请使用以下方式：

---

## 📝 方式1：手动复制脚本内容执行

**步骤1：在服务器上创建部署脚本**
```bash
sudo nano /tmp/auto-deploy.sh
# 将 auto-deploy.sh 的内容复制粘贴到这里
# 按 Ctrl+O 保存，Ctrl+X 退出
```

**步骤2：赋予执行权限并执行**
```bash
sudo chmod +x /tmp/auto-deploy.sh
sudo /tmp/auto-deploy.sh
```

---

## 📂 方式2：从本地上传项目并部署

**在本地电脑执行：**
```bash
# 1. 上传项目到服务器
scp -r c:\Users\Remy WANG\projects\stockManagement root@你的服务器IP:/var/www/stock-management

# 2. SSH连接到服务器
ssh root@你的服务器IP

# 3. 执行部署脚本
cd /var/www/stock-management
chmod +x auto-deploy.sh
sudo ./auto-deploy.sh
```

---

## 🐳 方式3：Docker一键部署（最简单）

**在服务器上执行：**
```bash
# 1. 安装Docker
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin

# 2. 上传项目或克隆仓库
cd /var/www
git clone <你的仓库地址> stock-management
cd stock-management

# 3. 配置环境变量
cp .env.docker.example .env.docker
nano .env.docker
# ⚠️ 修改所有密码和密钥

# 4. 一键启动
docker compose up -d

# 5. 初始化数据库
docker compose exec backend node src/scripts/init-db.js

# 6. 访问应用
echo "部署完成！访问: http://$(curl -s ifconfig.me)"
```

---

## ⚙️ 部署过程中需要输入的信息

脚本会自动提示您输入以下信息：
1. **域名**（可选，留空使用IP访问）
2. **数据库密码**（至少8位）
3. **JWT密钥**（可留空自动生成）

---

## ✅ 部署完成后的验证

```bash
# 1. 检查服务状态
sudo systemctl status nginx
sudo systemctl status mysql
pm2 status

# 2. 测试访问
curl http://localhost/api/health

# 3. 查看日志
pm2 logs kuwanyubeiqi-server
tail -f /var/log/nginx/stock-management_error.log
```

---

## 🔒 安全加固（部署后必须执行）

```bash
# 1. 配置防火墙
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw --force enable

# 2. 安装SSL证书（如果有域名）
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名

# 3. 修改默认管理员密码
# 访问 http://你的服务器IP
# 使用 admin / admin123 登录并立即修改密码
```

---

## 📞 需要帮助？

如果遇到问题，请提供：
1. 错误截图或日志
2. 服务器操作系统版本
3. 执行到哪一步出错

---

**快速链接：**
- 部署脚本：`auto-deploy.sh`
- Docker配置：`docker-compose.yml`
- Nginx配置：`nginx.conf`
- 环境变量模板：`server/.env.production.example`
