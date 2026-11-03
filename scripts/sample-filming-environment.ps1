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
 $sampleDir=Join-Path $out "$Phase.samples"
 if((Test-Path $file) -or (Test-Path $sampleDir)){
  throw "Refusing to overwrite previous phase artifacts in $out. Select a fresh OutputDirectory."
 }
 New-Item -ItemType Directory -Path $sampleDir -ErrorAction Stop | Out-Null
 $lines=New-Object 'System.Collections.Generic.List[string]'
 $utf8=New-Object System.Text.UTF8Encoding($false)
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
  $line=$entry|ConvertTo-Json -Depth 6 -Compress
  # Unique per-sample files avoid a long-lived shared append target that
  # Windows search, sync, antivirus or IDE watchers can repeatedly lock.
  # Preserve these individual files even if the final JSONL cannot be assembled.
  $sampleFile=Join-Path $sampleDir ('{0:D4}.json' -f $i)
  [System.IO.File]::WriteAllText($sampleFile,$line,$utf8)
  $lines.Add($line)
  Write-Host "$Phase $($i+1)/$Samples"
  if($i -lt $Samples-1){Start-Sleep -Seconds $IntervalSeconds}
 }
 # Assemble exactly once after capture. Any sharing violation here does not
 # invalidate or discard the already saved one-file-per-sample dataset.
 $assembled=$false
 for($attempt=1;$attempt -le 5;$attempt++){
  try{
   [System.IO.File]::WriteAllLines($file,[string[]]$lines,$utf8)
   $assembled=$true
   break
  }catch [System.IO.IOException]{
   if($attempt -lt 5){Start-Sleep -Milliseconds (500*$attempt)}
  }
 }
 if($assembled){Write-Host "Saved: $file"}
 else{
  Write-Warning "Cannot assemble JSONL due to file lock. All $Samples samples remain in $sampleDir."
  Write-Host 'Reconstruct later with:'
  Write-Host ('  Get-ChildItem -LiteralPath "{0}" -Filter *.json | Sort-Object Name | Get-Content | Set-Content -LiteralPath "{1}" -Encoding utf8' -f $sampleDir,$file)
 }
 Write-Host 'These are qualitative RCON responses, not counts of loaded chunks or server performance.'
}finally{Pop-Location}
