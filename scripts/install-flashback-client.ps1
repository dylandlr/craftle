param(
  [Parameter(Mandatory=$true)][string]$GameDirectory,
  [switch]$DownloadMods,
  [switch]$Force
)
$ErrorActionPreference='Stop'
$game=[IO.Path]::GetFullPath($GameDirectory)
if (-not (Test-Path $game -PathType Container)) { throw "Minecraft profile directory not found: $game. Create/select a dedicated Fabric 1.21.1 installation first." }
$mods=Join-Path $game 'mods'
New-Item -ItemType Directory -Force -Path $mods | Out-Null
$manifest=@{
  schema='craftle.flashback-client.v1'; gameVersion='1.21.1'; loader='fabric'
  mods=@(); installedAtUtc=[DateTime]::UtcNow.ToString('o')
}
function Get-Modrinth([string]$slug) {
  $uri="https://api.modrinth.com/v2/project/$slug/version?loaders=%5B%22fabric%22%5D&game_versions=%5B%221.21.1%22%5D&include_changelog=false"
  $response=Invoke-RestMethod -Uri $uri -Headers @{'User-Agent'='Craftle-filming/0.1 (Minecraft client setup)'} -TimeoutSec 30
  # Windows PowerShell 5.1 can preserve JSON arrays as a single nested Object[].
  # Unroll them explicitly before filtering; ISO-8601 timestamps sort lexically.
  $versions=@($response | ForEach-Object { $_ })
  $releases=@($versions | Where-Object { $_.version_type -eq 'release' -and $_.game_versions -contains '1.21.1' -and $_.loaders -contains 'fabric' } | Sort-Object -Property date_published -Descending)
  if (-not $releases.Count) { throw "No compatible Fabric 1.21.1 release found for $slug" }
  return $releases[0]
}
foreach($slug in @('flashback','fabric-api')){
  $version=Get-Modrinth $slug
  $files=@($version.files | Where-Object { $_.primary -eq $true })
  if(-not $files.Count){$files=@($version.files)}
  $file=$files[0]
  if(-not $file -or -not $file.hashes.sha512 -or -not $file.url -or -not $file.filename.EndsWith('.jar')){throw "Missing trusted file/hash for $slug"}
  $name=[IO.Path]::GetFileName($file.filename)
  $dest=Join-Path $mods $name
  $entry=@{project=$slug;version=$version.version_number;filename=$name;sha512=$file.hashes.sha512;modrinthVersionId=$version.id}
  if(-not $DownloadMods){
    Write-Host "Would install $slug $($version.version_number): $name"
    $entry.status='dry_run'
  }else{
    $others=@(Get-ChildItem -Path $mods -Filter '*.jar' -File | Where-Object {($_.Name -match 'flashback|fabric-api') -and $_.Name -ne $name})
    if($others.Count){throw "Existing Flashback/Fabric API jars found. Refusing mixed versions: $($others.Name -join ', '). Use a clean profile."}
    if(Test-Path $dest){
      $hash=(Get-FileHash -Algorithm SHA512 $dest).Hash.ToLowerInvariant()
      if($hash -ne $file.hashes.sha512.ToLowerInvariant()){throw "Existing file digest differs: $dest"}
    }else{
      $tmp="$dest.part"
      try{
        Invoke-WebRequest -Uri $file.url -OutFile $tmp -TimeoutSec 180
        $hash=(Get-FileHash -Algorithm SHA512 $tmp).Hash.ToLowerInvariant()
        if($hash -ne $file.hashes.sha512.ToLowerInvariant()){throw "SHA-512 verification failed: $slug"}
        Move-Item -LiteralPath $tmp -Destination $dest
      }finally{if(Test-Path $tmp){Remove-Item -LiteralPath $tmp -Force}}
    }
    $entry.status='sha512_verified'
    Write-Host "Installed and verified $slug : $name"
  }
  $manifest.mods+= $entry
}
if($DownloadMods){
  $out=Join-Path $game 'craftle-flashback-install.json'
  $manifest | ConvertTo-Json -Depth 6 | Set-Content -Path $out -Encoding UTF8
  Write-Host "Manifest: $out"
  Write-Host 'Start this game directory with a Fabric 1.21.1 launcher profile. Flashback is client-only.'
}else{
  Write-Host 'DRY RUN. Re-run with -DownloadMods to download version-filtered jars from Modrinth and verify SHA-512.'
}
