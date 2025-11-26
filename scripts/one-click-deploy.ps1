Param(
  [string]$Server = "root@151.243.109.79",
  [string]$LocalEnv = ".env.production",
  [string]$ServerEnv = "/root/.env.production"
)

Write-Host "[local] Building and packaging"
bash scripts/build-package.sh
$pkg = (Get-ChildItem -Path release -Filter "ibiki-sms-*.tar.gz" | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
Write-Host "[local] Package: $pkg"

Write-Host "[local] Uploading package and env"
scp $pkg "${Server}:/root/"
scp $LocalEnv "${Server}:${ServerEnv}"

Write-Host "[remote] Deploying"
ssh ${Server} "bash -lc 'bash /opt/ibiki-sms/scripts/server-deploy.sh /root/$(basename \"$pkg\") ${ServerEnv}'"

Write-Host "[done] Deployment completed. App managed by PM2 (ibiki-sms)."
