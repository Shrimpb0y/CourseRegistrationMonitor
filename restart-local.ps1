$ErrorActionPreference = 'Stop'
try {
    $config = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'config.json') -Raw | ConvertFrom-Json
    $address = "http://127.0.0.1:$($config.port)"
    $health = $null
    try { $health = Invoke-RestMethod -Uri "$address/health" -TimeoutSec 2 } catch { }
    if ($health -and $health.app -eq 'upm-local-course-monitor') {
        & (Join-Path $PSScriptRoot 'stop-local.ps1')
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            $probe = New-Object System.Net.Sockets.TcpClient
            try { $probe.Connect('127.0.0.1', [int]$config.port); $listening = $true }
            catch [System.Net.Sockets.SocketException] { $listening = $false }
            finally { $probe.Dispose() }
            if (-not $listening) { break }
            Start-Sleep -Milliseconds 300
        }
        if ($listening) { throw 'The old service has not stopped. Close its console and retry.' }
    }
    & (Join-Path $PSScriptRoot 'start-local.ps1')
} catch {
    Write-Host ('RESTART FAILED: ' + $_.Exception.Message) -ForegroundColor Red
    throw
}
