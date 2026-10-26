param(
 [Parameter(Mandatory=$true)][string]$Video,
 [Parameter(Mandatory=$true)][string]$ReplayStartUtc,
 [string]$OutputDirectory='recordings/native'
)
$ErrorActionPreference='Stop'
$repo=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location $repo
try{
 $videoPath=[IO.Path]::GetFullPath($Video)
 if(-not (Test-Path $videoPath -PathType Leaf)){throw "Exported native Minecraft MP4 does not exist: $videoPath"}
 $stamp=[datetimeoffset]::MinValue
 if(-not [datetimeoffset]::TryParse($ReplayStartUtc,[ref]$stamp)){throw "ReplayStartUtc must be an ISO-8601 timestamp with a timezone"}
 $dir=[IO.Path]::GetFullPath($OutputDirectory)
 New-Item -ItemType Directory -Force -Path $dir | Out-Null
 $log=Join-Path $dir 'filming-agent.log'
 if(Test-Path $log){throw "Log already exists: $log. Choose a new OutputDirectory for each recording to retain evidence."}
 docker compose -f deploy/filming/compose.yml --profile learning cp agent:/state/agent/continuous/agent.log $log
 if($LASTEXITCODE -ne 0){throw 'Could not retrieve filming agent log'}
 $prefix=Join-Path $dir 'turesla-evidence'
 python scripts/align-native-filming.py --video $videoPath --log $log --video-start-utc $stamp.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ") --output-prefix $prefix
 if($LASTEXITCODE -ne 0){throw 'Native alignment failed; keep MP4 and log unchanged'}
 $metadata=@{schema='craftle.native-capture.v1';recording='flashback_native_minecraft_client';sourceVideo=$videoPath;
              videoStartUtc=$stamp.ToUniversalTime().ToString('o');createdUtc=[DateTimeOffset]::UtcNow.ToString('o');
              agentLog=$log;alignmentManifest="$prefix.json";subtitleFile="$prefix.srt";
              note='ReplayStartUtc supplied by recorder operator; no automated verification of video-to-log clock mapping'}
 $metadata|ConvertTo-Json -Depth 5|Set-Content (Join-Path $dir 'capture-metadata.json') -Encoding UTF8
 Write-Host "Evidence bundle: $dir"
}finally{Pop-Location}
