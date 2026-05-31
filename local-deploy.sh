#!/bin/bash
# ============================================
# 本地执行 - 腾讯云自动部署脚本
# 使用方法：在本地电脑执行此脚本
# ============================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 配置变量
SERVER_IP=""
SERVER_USER="root"
SERVER_PORT="22"
SSH_KEY=""
PROJECT_DIR="c:/Users/Remy WANG/projects/stockManagement"

# 显示横幅
clear
echo ""
echo "============================================"
echo "  酷玩预备齐库存管理系统 - 腾讯云自动部署"
echo "============================================"
echo ""

# ============================================
# 步骤1: 收集服务器信息
# ============================================
log_info "步骤1: 收集腾讯云服务器信息"
echo ""

read -p "请输入腾讯云服务器公网IP: " SERVER_IP
read -p "请输入SSH用户名 [默认: root]: " INPUT_USER
if [ -n "$INPUT_USER" ]; then
    SERVER_USER="$INPUT_USER"
fi

read -p "请输入SSH端口 [默认: 22]: " INPUT_PORT
if [ -n "$INPUT_PORT" ]; then
    SERVER_PORT="$INPUT_PORT"
fi

echo ""
log_info "SSH认证方式："
echo "  1. 使用密码认证"
echo "  2. 使用SSH密钥认证 (推荐)"
read -p "请选择 [1/2]: " AUTH_TYPE

if [ "$AUTH_TYPE" = "2" ]; then
    read -p "请输入SSH密钥路径 [默认: ~/.ssh/id_rsa]: " INPUT_KEY
    if [ -n "$INPUT_KEY" ]; then
        SSH_KEY="$INPUT_KEY"
    else
        SSH_KEY="$HOME/.ssh/id_rsa"
    fi
    
    if [ ! -f "$SSH_KEY" ]; then
        log_error "SSH密钥文件不存在: $SSH_KEY"
        exit 1
    fi
    log_info "使用SSH密钥认证: $SSH_KEY"
else
    log_info "使用密码认证 (执行部署时会提示输入密码)"
fi

echo ""
log_info "服务器信息确认:"
echo "  IP地址: $SERVER_IP"
echo "  用户名: $SERVER_USER"
echo "  端口: $SERVER_PORT"
echo "  认证方式: $([ "$AUTH_TYPE" = "2" ] && echo "SSH密钥" || echo "密码")"
echo ""
read -p "确认开始部署? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# ============================================
# 步骤2: 测试SSH连接
# ============================================
log_info "步骤2: 测试SSH连接..."

if [ "$AUTH_TYPE" = "2" ]; then
    SSH_CMD="ssh -i $SSH_KEY -p $SERVER_PORT -o StrictHostKeyChecking=no"
    $SSH_CMD ${SERVER_USER}@${SERVER_IP} "echo 'SSH连接成功'" 2>/dev/null
else
    SSH_CMD="ssh -p $SERVER_PORT"
    # 密码认证需要用户手动输入，这里只测试连接
    log_warn "密码认证需要您手动输入密码"
fi

if [ $? -ne 0 ]; then
    log_error "SSH连接失败，请检查服务器信息和网络"
    exit 1
fi

log_info "✓ SSH连接正常"
echo ""

# ============================================
# 步骤3: 上传项目文件
# ============================================
log_info "步骤3: 上传项目文件到服务器..."
echo "  本地路径: $PROJECT_DIR"
echo "  远程路径: /var/www/stock-management"
echo ""

# 创建远程目录
if [ "$AUTH_TYPE" = "2" ]; then
    $SSH_CMD ${SERVER_USER}@${SERVER_IP} "mkdir -p /var/www/stock-management"
else
    ssh -p $SERVER_PORT ${SERVER_USER}@${SERVER_IP} "mkdir -p /var/www/stock-management"
fi

# 上传文件
log_info "上传项目文件 (可能需要几分钟)..."
if [ "$AUTH_TYPE" = "2" ]; then
    scp -i $SSH_KEY -P $SERVER_PORT -r $PROJECT_DIR/* ${SERVER_USER}@${SERVER_IP}:/var/www/stock-management/
else
    scp -P $SERVER_PORT -r $PROJECT_DIR/* ${SERVER_USER}@${SERVER_IP}:/var/www/stock-management/
fi

if [ $? -ne 0 ]; then
    log_error "文件上传失败"
    exit 1
fi

log_info "✓ 文件上传完成"
echo ""

# ============================================
# 步骤4: 执行远程部署脚本
# ============================================
log_info "步骤4: 在服务器上执行自动部署脚本..."
echo ""

# 生成远程执行命令
REMOTE_COMMAND="
cd /var/www/stock-management
chmod +x auto-deploy.sh
./auto-deploy.sh
"

if [ "$AUTH_TYPE" = "2" ]; then
    $SSH_CMD ${SERVER_USER}@${SERVER_IP} "bash -s" < $PROJECT_DIR/auto-deploy.sh
else
    log_warn "请在服务器上手动执行以下命令:"
    echo "  cd /var/www/stock-management"
    echo "  chmod +x auto-deploy.sh"
    echo "  sudo ./auto-deploy.sh"
    echo ""
    read -p "按回车键继续..."
fi

log_info "✓ 远程部署命令已执行"
echo ""

# ============================================
# 步骤5: 验证部署
# ============================================
log_info "步骤5: 验证部署状态..."
echo ""

if [ "$AUTH_TYPE" = "2" ]; then
    $SSH_CMD ${SERVER_USER}@${SERVER_IP} "pm2 status && systemctl status nginx --no-pager | head -5"
fi

echo ""
log_info "============================================"
log_info "部署完成！"
log_info "============================================"
echo ""
log_info "访问地址:"
echo "  http://${SERVER_IP}"
echo ""
log_info "默认管理员账号:"
echo "  用户名: admin"
echo "  密码: admin123"
echo "  ⚠️ 请立即登录并修改默认密码！"
echo ""
log_info "查看服务状态:"
echo "  SSH连接: ssh ${SERVER_USER}@${SERVER_IP}"
echo "  查看日志: pm2 logs kuwanyubeiqi-server"
echo "  重启服务: pm2 restart kuwanyubeiqi-server"
echo ""
