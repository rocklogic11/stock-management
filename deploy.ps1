# ============================================
# 酷玩预备齐库存管理系统 - Windows部署脚本
# 以管理员身份运行PowerShell执行此脚本
# ============================================

Write-Host "============================================" -ForegroundColor Green
Write-Host "酷玩预备齐库存管理系统 - Windows部署" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

# 配置变量
$AppName = "stock-management"
$AppDir = "C:\www\$AppName"
$BackendPort = 3000

# 检查是否以管理员身份运行
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[WARN] 建议以管理员身份运行此脚本" -ForegroundColor Yellow
    $response = Read-Host "是否继续? (y/n)"
    if ($response -ne "y") {
        exit 1
    }
}

# 1. 检查系统要求
Write-Host "[INFO] 步骤1: 检查系统要求..." -ForegroundColor Green

# 检查Node.js
try {
    $nodeVersion = node -v
    Write-Host "Node.js: $nodeVersion" -ForegroundColor Cyan
} catch {
    Write-Host "[ERROR] Node.js 未安装，请先安装 Node.js 18+" -ForegroundColor Red
    exit 1
}

# 检查npm
try {
    $npmVersion = npm -v
    Write-Host "npm: $npmVersion" -ForegroundColor Cyan
} catch {
    Write-Host "[ERROR] npm 未安装" -ForegroundColor Red
    exit 1
}

# 2. 创建目录结构
Write-Host "[INFO] 步骤2: 创建目录结构..." -ForegroundColor Green
New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
New-Item -ItemType Directory -Force -Path "$AppDir\backups" | Out-Null
New-Item -ItemType Directory -Force -Path "$AppDir\server\logs" | Out-Null

# 3. 部署后端
Write-Host "[INFO] 步骤3: 部署后端服务..." -ForegroundColor Green
Set-Location "$AppDir\server"

# 安装依赖
Write-Host "安装后端依赖..." -ForegroundColor Cyan
npm install --production

# 创建日志目录
New-Item -ItemType Directory -Force -Path "logs" | Out-Null

# 4. 构建前端
Write-Host "[INFO] 步骤4: 构建前端..." -ForegroundColor Green
Set-Location "$AppDir\web"

# 安装依赖
Write-Host "安装前端依赖..." -ForegroundColor Cyan
npm install

# 构建生产版本
Write-Host "构建生产版本..." -ForegroundColor Cyan
npm run build

# 5. 配置环境变量
Write-Host "[INFO] 步骤5: 配置环境变量..." -ForegroundColor Green
if (-not (Test-Path "$AppDir\server\.env.production")) {
    Write-Host "[WARN] 未找到 .env.production 文件" -ForegroundColor Yellow
    Write-Host "请手动创建生产环境配置文件" -ForegroundColor Yellow
    Copy-Item "$AppDir\server\.env.production.example" "$AppDir\server\.env.production"
    Write-Host "已创建示例配置文件，请编辑: $AppDir\server\.env.production" -ForegroundColor Cyan
} else {
    Write-Host "环境变量配置文件已存在" -ForegroundColor Cyan
}

# 6. 安装PM2 (Windows)
Write-Host "[INFO] 步骤6: 配置PM2..." -ForegroundColor Green

# 检查PM2是否安装
try {
    $pm2Version = pm2 -v
    Write-Host "PM2: $pm2Version" -ForegroundColor Cyan
} catch {
    Write-Host "安装PM2..." -ForegroundColor Cyan
    npm install -g pm2
    # Windows需要安装pm2-windows-service
    npm install -g pm2-windows-service
    pm2-service-install
}

# 启动或重启应用
Set-Location "$AppDir\server"
$pm2List = pm2 list
if ($pm2List -match "kuwanyubeiqi-server") {
    Write-Host "重启应用..." -ForegroundColor Cyan
    pm2 restart ecosystem.config.js --env production
} else {
    Write-Host "首次启动应用..." -ForegroundColor Cyan
    pm2 start ecosystem.config.js --env production
}

# 保存PM2配置
pm2 save

# 7. 配置Windows防火墙
Write-Host "[INFO] 步骤7: 配置防火墙..." -ForegroundColor Green
New-NetFirewallRule -DisplayName "Stock Management Backend" -Direction Inbound -LocalPort $BackendPort -Protocol TCP -Action Allow -ErrorAction SilentlyContinue

# 8. 数据库初始化提示
Write-Host "[INFO] 步骤8: 数据库初始化..." -ForegroundColor Green
Write-Host "[WARN] 请手动执行数据库初始化：" -ForegroundColor Yellow
Write-Host "  cd $AppDir\server" -ForegroundColor Cyan
Write-Host "  node src\scripts\init-db.js" -ForegroundColor Cyan

# 完成
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "部署完成！" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "后续步骤：" -ForegroundColor Yellow
Write-Host "  1. 编辑 .env.production 配置生产环境变量" -ForegroundColor Cyan
Write-Host "  2. 初始化数据库: cd server && node src\scripts\init-db.js" -ForegroundColor Cyan
Write-Host "  3. 配置Nginx或IIS作为反向代理" -ForegroundColor Cyan
Write-Host "  4. 访问 http://localhost:$BackendPort" -ForegroundColor Cyan
Write-Host ""
Write-Host "PM2 常用命令：" -ForegroundColor Yellow
Write-Host "  查看状态: pm2 status" -ForegroundColor Cyan
Write-Host "  查看日志: pm2 logs" -ForegroundColor Cyan
Write-Host "  重启应用: pm2 restart kuwanyubeiqi-server" -ForegroundColor Cyan
Write-Host "  停止应用: pm2 stop kuwanyubeiqi-server" -ForegroundColor Cyan
Write-Host ""

# 暂停查看输出
Read-Host "按回车键退出"
