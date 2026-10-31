# Read-only diagnostics: never touches agent state or restarts containers.
$ErrorActionPreference = 'Continue'
$compose = 'deploy/filming/compose.yml'
Write-Host '=== Host GPU ==='
if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
  & nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total --format=csv
  & nvidia-smi --query-compute-apps=pid,process_name,used_gpu_memory --format=csv
} else {
  Write-Host 'nvidia-smi unavailable on PATH; this does not prove no GPU exists.'
}
Write-Host '=== Filming service state ==='
docker compose -f $compose --profile learning --profile follow ps
Write-Host '=== World rules and players ==='
docker compose -f $compose exec -T minecraft rcon-cli list
docker compose -f $compose exec -T minecraft rcon-cli 'gamerule spectatorsGenerateChunks'
Write-Host '=== Agent graphics environment ==='
docker compose -f $compose --profile learning exec -T agent sh -lc 'printf "LIBGL_ALWAYS_SOFTWARE=%s\n" "${LIBGL_ALWAYS_SOFTWARE:-unset}"; if test -e /dev/nvidia0; then echo NVIDIA_DEVICE_PRESENT; else echo NVIDIA_DEVICE_ABSENT; fi'
Write-Host '=== Note ==='
Write-Host 'Client render distance is configured inside the Windows Minecraft video settings. Recommended first-pass setting: 6 chunks.'
