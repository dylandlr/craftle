$ErrorActionPreference = 'Stop'
& docker info *> $null
if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop with Linux containers first.' }
foreach ($name in @('state/server', 'state/agent', 'secrets')) {
    New-Item -ItemType Directory -Force -Path (Join-Path $PSScriptRoot $name) | Out-Null
}
$secret = Join-Path $PSScriptRoot 'secrets/rcon_password.txt'
if (-not (Test-Path $secret)) {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $password = [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
    [System.IO.File]::WriteAllText($secret, $password + "`n", [System.Text.Encoding]::ASCII)
}
& docker compose -f (Join-Path $PSScriptRoot 'compose.yml') --profile learning up -d --build
if ($LASTEXITCODE -ne 0) { throw 'Deployment failed. Inspect docker compose logs; existing state was retained.' }
Write-Host 'Craftle is starting. Minecraft Java can connect at localhost:25565.'
Write-Host 'World, validated policy and recordings live under deploy/persistent/state.'
