# ============================================
# 数据库备份脚本 (Windows PowerShell)
# 使用方法: .\backup-db.ps1
# ============================================

Write-Host "============================================" -ForegroundColor Green
Write-Host "数据库备份脚本" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

# 配置
$BackupDir = "C:\www\stock-management\backups"
$Date = Get-Date -Format "yyyyMMdd_HHmmss"
$RetentionDays = 7

# 创建备份目录
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

# 读取环境变量
$EnvFile = "C:\www\stock-management\server\.env.production"
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match "^([^#=]+)=(.*)$") {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
        }
    }
}

$DbDialect = $env:DB_DIALECT

if ($DbDialect -eq "sqlite") {
    Write-Host "[INFO] 备份SQLite数据库..." -ForegroundColor Green
    $SqliteDb = "C:\www\stock-management\server\data\kuwanyubeiqi.db"
    if (Test-Path $SqliteDb) {
        Copy-Item $SqliteDb "$BackupDir\kuwanyubeiqi_$Date.db"
        Write-Host "备份完成: $BackupDir\kuwanyubeiqi_$Date.db" -ForegroundColor Cyan
    } else {
        Write-Host "[ERROR] 数据库文件不存在: $SqliteDb" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[INFO] 备份MySQL数据库..." -ForegroundColor Green
    $Mysqldump = "mysqldump --host=$($env:DB_HOST) --port=$($env:DB_PORT) --user=$($env:DB_USER) --password=$($env:DB_PASSWORD) $($env:DB_NAME) | gzip > $BackupDir\kuwanyubeiqi_$Date.sql.gz"
    Invoke-Expression $Mysqldump
    Write-Host "备份完成: $BackupDir\kuwanyubeiqi_$Date.sql.gz" -ForegroundColor Cyan
}

# 删除旧备份
Write-Host "[INFO] 清理 $RetentionDays 天前的备份..." -ForegroundColor Green
Get-ChildItem "$BackupDir\kuwanyubeiqi_*.db" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) } | Remove-Item -Force
Get-ChildItem "$BackupDir\kuwanyubeiqi_*.sql.gz" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) } | Remove-Item -Force

Write-Host ""
Write-Host "备份任务完成！" -ForegroundColor Green
Write-Host "备份位置: $BackupDir" -ForegroundColor Cyan
Get-ChildItem $BackupDir | Sort-Object LastWriteTime -Descending | Select-Object -First 10

Read-Host "按回车键退出"
