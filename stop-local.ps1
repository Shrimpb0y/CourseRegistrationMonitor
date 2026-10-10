$ErrorActionPreference = 'Stop'
$config = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'config.json') -Raw | ConvertFrom-Json
$address = "http://127.0.0.1:$($config.port)"
$page = Invoke-WebRequest -Uri $address -UseBasicParsing -TimeoutSec 5
$match = [regex]::Match($page.Content, "const token='([a-f0-9]+)'")
if (-not $match.Success) { throw 'Not a UPM local manager page' }
Invoke-RestMethod -Uri "$address/api/shutdown" -Method Post -Headers @{'x-local-token'=$match.Groups[1].Value} -TimeoutSec 10 | Out-Null
Write-Output 'Local monitor stopped'
