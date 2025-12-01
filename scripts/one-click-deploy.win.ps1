Param(
  [string]$Server = "151.243.109.79",
  [string]$User = "root",
  [string]$Password = "",
  [string]$ServerEnv = "/root/.env.production",
  [string]$LocalEnv = ".env.production",
  [string]$HostKey = ""
)

Write-Host "[local] Installing deps" -ForegroundColor Cyan
npm ci
if ($LASTEXITCODE -ne 0) {
  Write-Host "npm ci failed, falling back to npm install" -ForegroundColor Yellow
  npm install --no-audit
}
Write-Host "[local] Building (npx vite build + esbuild)" -ForegroundColor Cyan
npx vite build
if ($LASTEXITCODE -ne 0) {
  Write-Host "vite build failed – continuing with server-only build" -ForegroundColor Yellow
}
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

$releaseDir = Join-Path $PSScriptRoot "..\release"
if (!(Test-Path $releaseDir)) { New-Item -ItemType Directory -Path $releaseDir | Out-Null }

$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$pkgName = "ibiki-sms-$timestamp.tar.gz"
$pkgPath = Join-Path $releaseDir $pkgName

Write-Host "[local] Packaging -> $pkgPath" -ForegroundColor Cyan
tar -czf $pkgPath dist package.json package-lock.json deploy.sh .env.example VERSION

if ([string]::IsNullOrWhiteSpace($Password)) { throw "Password is required (use -Password)" }

$sshTarget = "$User@$Server"

Write-Host "[remote] Bootstrapping PostgreSQL (reads DATABASE_URL from $ServerEnv)" -ForegroundColor Cyan
& "$PSScriptRoot\..\plink.exe" -ssh -batch @( if ($HostKey) { "-hostkey", $HostKey } ) $sshTarget -pw $Password -m "$PSScriptRoot\remote-db-bootstrap.sh" | Write-Output

Write-Host "[remote] Uploading package and env" -ForegroundColor Cyan
& "$PSScriptRoot\..\pscp.exe" -batch @( if ($HostKey) { "-hostkey", $HostKey } ) -pw $Password $pkgPath "${sshTarget}:/root/" | Write-Output
& "$PSScriptRoot\..\pscp.exe" -batch @( if ($HostKey) { "-hostkey", $HostKey } ) -pw $Password $LocalEnv "${sshTarget}:${ServerEnv}" | Write-Output

Write-Host "[remote] Deploying with server-deploy.sh" -ForegroundColor Cyan
$remoteCmd = "bash -lc 'bash /opt/ibiki-sms/scripts/server-deploy.sh /root/$pkgName $ServerEnv'"
& "$PSScriptRoot\..\plink.exe" -ssh -batch @( if ($HostKey) { "-hostkey", $HostKey } ) $sshTarget -pw $Password $remoteCmd | Write-Output

Write-Host "[remote] Deploying with remote-deploy.sh (safe)" -ForegroundColor Cyan
& "$PSScriptRoot\..\plink.exe" -ssh -batch @( if ($HostKey) { "-hostkey", $HostKey } ) $sshTarget -pw $Password -m "$PSScriptRoot\remote-deploy.sh" | Write-Output

Write-Host "[done] Deployment completed. App managed by PM2 (ibiki-sms)." -ForegroundColor Green
