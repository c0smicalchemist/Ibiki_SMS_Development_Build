param(
    [Parameter(Mandatory=$true)][string]$Host,
    [string]$User = 'root',
    [Parameter(Mandatory=$true)][string]$SshPassword,
    [int]$RemotePort = 5000,
    [int]$LocalPort = 5500,
    [Parameter(Mandatory=$true)][string]$Email,
    [Parameter(Mandatory=$true)][string]$Password,
    [string]$PlinkPath = '.\\plink.exe',
    [string]$HostKey
)

function Start-SSHPortForward {
    param(
        [string]$Plink,
        [string]$Host,
        [string]$User,
        [string]$Pass,
        [int]$LocalPort,
        [int]$RemotePort,
        [string]$HostKey
    )
    $args = @('-batch','-ssh','-L',"$LocalPort:127.0.0.1:$RemotePort",'-pw',$Pass,"$User@$Host",'-N')
    if ($HostKey) { $args = @('-batch','-ssh','-hostkey', $HostKey,'-L',"$LocalPort:127.0.0.1:$RemotePort",'-pw',$Pass,"$User@$Host",'-N') }
    $p = Start-Process -FilePath $Plink -ArgumentList $args -PassThru -WindowStyle Hidden
    return $p
}

function Wait-PortOpen {
    param([int]$Port,[int]$TimeoutMs = 8000)
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($sw.ElapsedMilliseconds -lt $TimeoutMs) {
        try {
            $c = New-Object System.Net.Sockets.TcpClient
            $c.Connect('127.0.0.1',$Port)
            $c.Close()
            return $true
        } catch {}
        Start-Sleep -Milliseconds 200
    }
    return $false
}

function Stop-ProcSafe { param([System.Diagnostics.Process]$Proc) if ($Proc -and !$Proc.HasExited) { try { Stop-Process -Id $Proc.Id -Force } catch {} } }

if (!(Test-Path $PlinkPath)) { throw "plink.exe not found at $PlinkPath" }

$pf = $null
try {
    $pf = Start-SSHPortForward -Plink $PlinkPath -Host $Host -User $User -Pass $SshPassword -LocalPort $LocalPort -RemotePort $RemotePort -HostKey $HostKey
    if (-not (Wait-PortOpen -Port $LocalPort -TimeoutMs 10000)) { throw "Port forward failed to open on 127.0.0.1:$LocalPort" }
    $payload = @{ email = $Email; password = $Password } | ConvertTo-Json -Compress
    $resp = Invoke-RestMethod -Uri "http://127.0.0.1:$LocalPort/api/auth/login" -Method Post -ContentType 'application/json' -Body $payload
    $token = $null
    if ($resp -is [string]) { try { $obj = $resp | ConvertFrom-Json; $token = $obj.token } catch { $token = $null } } else { $token = $resp.token }
    if (-not $token) { Write-Output 'TOKEN_LEN=0'; exit 1 }
    Write-Output "TOKEN_LEN=$($token.Length)"
} finally { Stop-ProcSafe -Proc $pf }

