param(
  [ValidateSet('baseline','spectator')][string]$Phase='baseline',
  [int]$Samples=24,
  [int]$IntervalSeconds=5,
  [string]$OutputDirectory='recordings/isolation'
)
$ErrorActionPreference='Stop'
if($Samples -lt 2 -or $Samples -gt 720 -or $IntervalSeconds -lt 1 -or $IntervalSeconds -gt 300){throw 'Invalid sampling parameters'}
$repo=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location $repo
try {
 $out=[IO.Path]::GetFullPath($OutputDirectory)
 New-Item -ItemType Directory -Force -Path $out | Out-Null
 $file=Join-Path $out "$Phase.jsonl"
 if(Test-Path $file){throw "Refusing to overwrite an existing phase: $file"}
 function Query([string]$text) {
  $response=& docker compose -f deploy/filming/compose.yml exec -T minecraft rcon-cli $text 2>&1
  if($LASTEXITCODE -ne 0){throw "RCON command failed: $text : $response"}
  return ($response | Out-String).Trim()
 }
 $queries=@(
   'list',
   'gamerule spectatorsGenerateChunks',
   'time query gametime',
   'execute at Turesla if entity @e[type=minecraft:zombie,distance=..64]',
   'execute at Turesla if entity @e[type=minecraft:skeleton,distance=..64]',
   'execute at Turesla if entity @e[type=minecraft:creeper,distance=..64]',
   'execute at Turesla if entity @e[type=minecraft:cow,distance=..64]',
   'execute at Turesla if entity @e[type=minecraft:pig,distance=..64]',
   'execute at Turesla if entity @e[type=minecraft:sheep,distance=..64]'
 )
 for($i=0;$i -lt $Samples;$i++){
  $entry=[ordered]@{schema='craftle.spectator-environment-sample.v1';phase=$Phase;
    sample=$i;atUtc=[DateTimeOffset]::UtcNow.ToString('o');responses=[ordered]@{}}
  foreach($q in $queries){$entry.responses[$q]=Query $q}
  ($entry|ConvertTo-Json -Depth 6 -Compress)|Add-Content -LiteralPath $file -Encoding UTF8
  Write-Host "$Phase $($i+1)/$Samples"
  if($i -lt $Samples-1){Start-Sleep -Seconds $IntervalSeconds}
 }
 Write-Host "Saved: $file"
 Write-Host 'These are qualitative RCON responses, not counts of loaded chunks or server performance.'
}finally{Pop-Location}
