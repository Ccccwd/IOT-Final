# Mosquitto 便携版安装脚本
# 这个脚本会下载 Mosquitto 便携版并配置到项目目录

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Mosquitto 便携版安装脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 创建 tools 目录
$toolsDir = "E:\IOT-Final\tools"
if (-not (Test-Path $toolsDir)) {
    New-Item -ItemType Directory -Path $toolsDir | Out-Null
    Write-Host "✓ 创建目录: $toolsDir" -ForegroundColor Green
}

# Mosquitto 下载 URL（64位 Windows）
$mosquittoUrl = "https://mosquitto.org/files/binary/mosquitto-2.0.20-install-windows-x64.exe"
$mosquittoInstaller = "$toolsDir\mosquitto-installer.exe"

Write-Host "正在下载 Mosquitto 安装器..." -ForegroundColor Yellow
Write-Host "下载地址: $mosquittoUrl" -ForegroundColor Gray

try {
    # 使用默认代理下载
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri $mosquittoUrl -OutFile $mosquittoInstaller -UseBasicParsing
    $ProgressPreference = 'Continue'

    Write-Host "✓ 下载完成: $mosquittoInstaller" -ForegroundColor Green
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "下一步操作：" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "1. 运行安装器: $mosquittoInstaller" -ForegroundColor Yellow
    Write-Host "2. 安装到默认路径: C:\Program Files\Mosquitto" -ForegroundColor Yellow
    Write-Host "3. 安装完成后，运行以下命令启动:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   cd E:\IOT-Final" -ForegroundColor White
    Write-Host "   mosquitto -c mosquitto.conf -v" -ForegroundColor White
    Write-Host ""

    # 询问是否立即运行安装器
    $run = Read-Host "是否立即运行安装器？(Y/N)"
    if ($run -eq "Y" -or $run -eq "y") {
        Start-Process $mosquittoInstaller
        Write-Host "安装器已启动，请按照提示完成安装..." -ForegroundColor Green
    }

} catch {
    Write-Host "✗ 下载失败: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "请手动下载并安装:" -ForegroundColor Yellow
    Write-Host "1. 访问: https://mosquitto.org/download/" -ForegroundColor White
    Write-Host "2. 下载 Windows 安装器" -ForegroundColor White
    Write-Host "3. 运行安装器" -ForegroundColor White
}
