param([switch]$Background)
$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
$runtimeDir = Join-Path $taskRoot 'runtime'
New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
Start-Transcript -Path (Join-Path $runtimeDir 'launcher.log') -Append | Out-Null
try {
$nodePath = 'C:\Users\22567\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
if (-not (Test-Path -LiteralPath $nodePath)) {
    $nodePath = (Get-Command node -ErrorAction Stop).Source
}
$serverPath = Join-Path $taskRoot 'src\server.js'
$config = Get-Content -LiteralPath (Join-Path $taskRoot 'config.json') -Raw | ConvertFrom-Json
$address = "http://127.0.0.1:$($config.port)"
function Test-Service {
    try {
        $health = Invoke-RestMethod -Uri "$address/health" -TimeoutSec 2
        return ($health.app -eq 'upm-local-course-monitor' -and $health.ok -eq $true)
    } catch { return $false }
}
if (Test-Service) {
    Write-Output "Service is reachable: $address"
    Start-Process $address
    return
}
if (-not (Test-Path -LiteralPath (Join-Path $taskRoot 'node_modules\puppeteer-core\package.json'))) {
    throw 'Missing dependencies: install them with npm ci --ignore-scripts in this folder.'
}
$probe = New-Object System.Net.Sockets.TcpClient
try {
    $probe.Connect('127.0.0.1', [int]$config.port)
    throw "Port $($config.port) is occupied by another or an older service. Close that service or change config.json port."
} catch [System.Net.Sockets.SocketException] {
    # No listening service. Start a new one.
} finally { $probe.Dispose() }
if (-not $Background) {
    Write-Output "Management address: $address"
    Write-Output 'Keep this window open while monitoring. Press Ctrl+C to stop.'
    & $nodePath $serverPath
    if ($LASTEXITCODE -ne 0) { throw "Node exited with code $LASTEXITCODE. See the error above." }
    return
}
$proc = Start-Process -FilePath $nodePath -ArgumentList ('"' + $serverPath + '"') -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDir 'server-output.log') -RedirectStandardError (Join-Path $runtimeDir 'server-error.log') -PassThru
Set-Content -LiteralPath (Join-Path $runtimeDir 'server.pid') -Value $proc.Id
for ($attempt = 0; $attempt -lt 15; $attempt++) {
    if (Test-Service) {
        Write-Output "Service is reachable: $address"
        Start-Process $address
        return
    }
    $proc.Refresh()
    if ($proc.HasExited) { break }
    Start-Sleep -Milliseconds 300
}
$errorLog = Join-Path $runtimeDir 'server-error.log'
if (Test-Path -LiteralPath $errorLog) { Get-Content -LiteralPath $errorLog | Write-Output }
throw "Service not reachable at $address. Run start-local.ps1 without -Background to see errors."
} catch {
    Write-Host ('STARTUP FAILED: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host ('Diagnostic log: ' + (Join-Path $runtimeDir 'launcher.log'))
    throw
} finally {
    Stop-Transcript | Out-Null
}
