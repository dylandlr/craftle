param(
 [ValidateSet('accepted','continuous-v1','continuous-v2')]
 [string]$Checkpoint = 'accepted'
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$sourceRoot = Join-Path $root 'deploy/persistent/state/agent'
$filmRoot = Join-Path $root 'deploy/filming/state/agent'
$names = @{
 accepted = 'accepted-policy.json'
 'continuous-v1' = 'continuous-policy.json'
 'continuous-v2' = 'continuous-policy-reward-v2.json'
}
$source = Join-Path $sourceRoot $names[$Checkpoint]
if(-not (Test-Path $source)){ throw "Missing source checkpoint: $source" }
New-Item -ItemType Directory -Force -Path $filmRoot | Out-Null
$destination = Join-Path $filmRoot 'continuous-policy.json'
if(Test-Path $destination){throw "Filming checkpoint already exists; refusing to overwrite it. Delete/reset the filming environment deliberately if needed."}
Copy-Item -LiteralPath $source -Destination $destination -ErrorAction Stop
Write-Host "Copied $Checkpoint into isolated filming checkpoint."
Write-Host "Original persistent Minecraft world and training checkpoint were not modified."
Write-Host 'Start filming server: docker compose -f deploy/filming/compose.yml --profile learning up -d --build'
Write-Host 'In Minecraft Java 1.21.1 connect to 127.0.0.1:25575 using a distinct recorder username.'
Write-Host 'The filming run is NOT an uncontaminated benchmark; it is isolated from persistent training.'
