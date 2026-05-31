# ============================================
# 腾讯云自动部署脚本 - PowerShell版本
# 使用方法：
#   1. 以管理员身份打开PowerShell
#   2. 执行：.\tencent-auto-deploy.ps1
# ============================================

Write-Host "============================================" -ForegroundColor Green
Write-Host "  酷玩预备齐库存管理系统 - 腾讯云自动部署" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

# ============================================
# 第一步：收集服务器信息
# ============================================
Write-Host "[第一步] 请输入腾讯云服务器信息" -ForegroundColor Yellow
Write-Host ""

$ServerIP = Read-Host "请输入腾讯云服务器公网IP"
$ServerUser = Read-Host "请输入SSH用户名 [默认: root]"
if ([string]::IsNullOrEmpty($ServerUser)) { $ServerUser = "root" }
$ServerPort = Read-Host "请输入SSH端口 [默认: 22]"
if ([string]::IsNullOrEmpty($ServerPort)) { $ServerPort = "22" }

Write-Host ""
Write-Host "服务器信息确认：" -ForegroundColor Cyan
Write-Host "  IP地址: $ServerIP" -ForegroundColor White
Write-Host "  用户名: $ServerUser" -ForegroundColor White
Write-Host "  端口: $ServerPort" -ForegroundColor White
Write-Host ""

$Confirm = Read-Host "确认开始部署? (y/n)"
if ($Confirm -ne "y") {
    Write-Host "部署已取消" -ForegroundColor Yellow
    exit 1
}

# ============================================
# 第二步：检查SSH连接
# ============================================
Write-Host ""
Write-Host "[第二步] 检查SSH连接..." -ForegroundColor Yellow

# 测试SSH连接
try {
    $SshTest = ssh -o StrictHostKeyChecking=no -p $ServerPort $ServerUser@$ServerIP "echo SSH连接成功" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] SSH连接失败，请检查：" -ForegroundColor Red
        Write-Host "  1. 服务器IP是否正确" -ForegroundColor Yellow
        Write-Host "  2. 安全组是否开放22端口" -ForegroundColor Yellow
        Write-Host "  3. SSH密钥是否配置" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "✓ SSH连接正常" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] SSH命令执行失败，请确保已安装OpenSSH" -ForegroundColor Red
    Write-Host "Windows安装OpenSSH: 设置 → 应用 → 可选功能 → OpenSSH客户端" -ForegroundColor Yellow
    exit 1
}

# ============================================
# 第三步：上传项目文件
# ============================================
Write-Host ""
Write-Host "[第三步] 上传项目文件到服务器..." -ForegroundColor Yellow
Write-Host "这可能需要几分钟，请耐心等待..." -ForegroundColor Cyan
Write-Host ""

# 创建服务器目录
ssh -p $ServerPort $ServerUser@$ServerIP "mkdir -p /var/www/stock-management/{backups,server/logs}"

# 上传文件
$LocalPath = "c:\Users\Remy WANG\projects\stockManagement\*"
$SftpPath = "$ServerUser@$ServerIP" + ":/var/www/stock-management/"

# 使用scp上传
Write-Host "上传项目文件..." -ForegroundColor Cyan
scp -r -P $ServerPort "c:\Users\Remy WANG\projects\stockManagement\*" "$ServerUser@$ServerIP:/var/www/stock-management/"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] 文件上传失败" -ForegroundColor Red
    exit 1
}

Write-Host "✓ 文件上传完成" -ForegroundColor Green

# ============================================
# 第四步：在服务器上执行部署
# ============================================
Write-Host ""
Write-Host "[第四步] 在服务器上执行自动部署..." -ForegroundColor Yellow
Write-Host ""

# 创建远程部署命令
$RemoteCommands = @"
cd /var/www/stock-management
chmod +x auto-deploy.sh
./auto-deploy.sh
"@

# 执行远程命令
ssh -t -p $ServerPort $ServerUser@$ServerIP $RemoteCommands

if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARN] 远程部署可能未完全成功，请检查日志" -ForegroundColor Yellow
}

# ============================================
# 第五步：验证部署
# ============================================
Write-Host ""
Write-Host "[第五步] 验证部署状态..." -ForegroundColor Yellow
Write-Host ""

ssh -p $ServerPort $ServerUser@$ServerIP "pm2 status && systemctl status nginx --no-pager | head -5"

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  🎉 部署完成！" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "访问地址：" -ForegroundColor Cyan
Write-Host "  http://$ServerIP" -ForegroundColor White
Write-Host ""
Write-Host "默认管理员账号：" -ForegroundColor Cyan
Write-Host "  用户名: admin" -ForegroundColor White
Write-Host "  密码: admin123" -ForegroundColor White
Write-Host "  ⚠️ 请立即登录并修改默认密码！" -ForegroundColor Yellow
Write-Host ""
Write-Host "查看服务状态：" -ForegroundColor Cyan
Write-Host "  ssh $ServerUser@$ServerIP" -ForegroundColor White
Write-Host "  pm2 status" -ForegroundColor White
Write-Host "  pm2 logs kuwanyubeiqi-server" -ForegroundColor White
Write-Host ""

Read-Host "按回车键退出"
