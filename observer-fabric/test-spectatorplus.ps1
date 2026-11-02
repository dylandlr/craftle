# SpectatorPlus isolated compatibility probe for Craftle Minecraft 1.21.1.
# Only targets observer-fabric/test-server/minecraft-test, never a production compose stack.
# By default this is read-only. -Install requires a version explicitly declaring 1.21.1;
# -AllowUnlistedGameVersion is a deliberate experimental override for a disposable world.
[CmdletBinding()]
param(
  [switch]$Install,
  [switch]$AllowUnlistedGameVersion,
  [switch]$Remove,
  [switch]$RestartTestServer,
  [string]$ProjectId = "qnFMs6Ja"
)
$ErrorActionPreference = "Stop"
$testDir = Join-Path $PSScriptRoot "test-server"
if (!(Test-Path (Join-Path $testDir "compose.yml"))) {
  throw "Missing isolated compose: $testDir/compose.yml"
}
Push-Location $testDir
try {
  $containerId = (docker compose ps -q minecraft-test)
  if (!$containerId) { throw "Isolated minecraft-test is not running. No production changes made." }
  $servicePorts = (docker compose port minecraft-test 25565 2>$null)
  Write-Host "Target: minecraft-test ($containerId) at $servicePorts"
  $mods = docker compose exec -T minecraft-test sh -c 'ls -lah /data/mods'
  Write-Host "Installed test-server JARs:"
  $mods
  $headers = @{ "User-Agent" = "Craftle-compatibility-probe/0.1 (research mod audit)" }
  $versions = @(Invoke-RestMethod -Uri "https://api.modrinth.com/v2/project/$ProjectId/version?loaders=%5B%22fabric%22%5D" -Headers $headers)
  $candidates = @($versions | Where-Object { $_.game_versions -contains "1.21.1" } | Sort-Object date_published -Descending)
  if ($candidates.Count -gt 0) {
    $chosen = $candidates[0]
    Write-Host "Explicitly compatible 1.21.1 version: $($chosen.version_number) ($($chosen.id))"
  } else {
    Write-Warning "Modrinth does not explicitly list a Fabric Minecraft 1.21.1 release. No compatibility claim."
    $fallback = @($versions | Where-Object { $_.game_versions -contains "1.21" } | Sort-Object date_published -Descending)
    $chosen = if ($fallback.Count -gt 0) { $fallback[0] } else { $null }
    if ($chosen) {
      Write-Host "Closest 1.21-only candidate (UNVERIFIED on 1.21.1): $($chosen.version_number) ($($chosen.id))"
    }
  }
  if ($Remove) {
    docker compose exec -T minecraft-test sh -c 'find /data/mods -maxdepth 1 -type f -name "spectatorplus-*.jar" -print -delete'
    if ($LASTEXITCODE -ne 0) { throw "Failed to remove test-server SpectatorPlus JAR" }
    Write-Host "Removed only spectatorplus-*.jar from isolated test server."
  } elseif ($Install) {
    if (!$chosen) { throw "No Fabric candidate found. Nothing installed." }
    if (($chosen.game_versions -notcontains "1.21.1") -and !$AllowUnlistedGameVersion) {
      throw "No explicit 1.21.1 release. Retry only with -AllowUnlistedGameVersion on disposable test world."
    }
    $file = @($chosen.files | Where-Object { $_.primary -eq $true -and $_.filename -match "\.jar$" } | Select-Object -First 1)
    if (!$file) { throw "No primary JAR found in Modrinth metadata." }
    $file = $file[0]
    if (!$file.hashes.sha512) { throw "No sha512 metadata; refusing download." }
    $name = "spectatorplus-$($chosen.id).jar"
    $target = Join-Path $env:TEMP $name
    Invoke-WebRequest -Uri $file.url -Headers $headers -OutFile $target
    $actual = (Get-FileHash -Path $target -Algorithm SHA512).Hash.ToLowerInvariant()
    if ($actual -ne $file.hashes.sha512.ToLowerInvariant()) { throw "SHA512 mismatch. No install." }
    docker compose cp $target "minecraft-test:/data/mods/$name"
    if ($LASTEXITCODE -ne 0) { throw "docker compose cp failed" }
    Write-Host "Installed in isolated Fabric test server only: $name; restart required."
    if ($chosen.game_versions -notcontains "1.21.1") { Write-Warning "This is an unsupported cross-version compatibility experiment." }
    Write-Host "Official dependency metadata:"
    $chosen.dependencies | ConvertTo-Json -Depth 5
  } else {
    Write-Host "Read-only audit complete. No JARs downloaded or installed."
  }
  if ($RestartTestServer) {
    if (!$Install -and !$Remove) { throw "-RestartTestServer requires -Install or -Remove." }
    docker compose restart minecraft-test
    if ($LASTEXITCODE -ne 0) { throw "Isolated server restart failed." }
    Write-Host "Check startup with: docker compose logs --tail=100 minecraft-test"
  }
} finally {
  Pop-Location
}
