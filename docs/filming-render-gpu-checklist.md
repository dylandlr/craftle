# Filming terrain / GPU checklist

This is a diagnostic runbook, not proof that the chunk issue is resolved.
Do not reset Turesla's world, reward schema or training checkpoint to fix the viewer.

## Client-only first pass

In the Windows Minecraft spectator client: Esc -> Options -> Video Settings ->
Render Distance: **6 chunks**. Leave the **server view distance unchanged** for
controlled learning experiments. F3 can help distinguish client-rendered chunks
from visible loaded terrain. If the issue persists, collect F3 while attached,
then detach from the target (Shift) and capture F3 again at the same coordinates.

Keep `spectatorsGenerateChunks=false` to minimize observer effects, but note that
a spectator may show empty terrain if the server has not sent chunks around the
spectated player. The spectator's render-distance setting is a **local client**
preference; Docker Compose cannot directly edit the Windows client's settings.

## Independent server checks

```powershell
docker compose -f deploy/filming/compose.yml exec minecraft rcon-cli "list"
docker compose -f deploy/filming/compose.yml exec minecraft rcon-cli "gamerule spectatorsGenerateChunks"
docker stats craftle-filming-minecraft-1
```

If testing server-side view-distance changes later, use isolated worlds and
record the settings as an experimental variable. Do **not** silently change
server view distance mid-training, as it changes entity/block observations.

## GPU checks on Windows

```powershell
nvidia-smi
nvidia-smi --query-compute-apps=pid,process_name,used_gpu_memory --format=csv
docker compose -f deploy/filming/compose.yml --profile learning exec agent sh -lc 'echo LIBGL_ALWAYS_SOFTWARE=$LIBGL_ALWAYS_SOFTWARE; test -e /dev/nvidia0 && echo NVIDIA_DEVICE_PRESENT || echo NVIDIA_DEVICE_ABSENT'
```

The targeted DQN in `src/option-dqn.js` is a hand-written JavaScript neural
network; its matrix operations run on CPU. `LIBGL_ALWAYS_SOFTWARE=1` instructs
Mesa/OpenGL software rendering in the learning container. Minecraft's Windows
client is a different process and normally renders on the GPU.

GPU acceleration for future experiments should be a separate, opt-in, benchmarked
training backend with compatible checkpoint import/export and CPU/GPU parity tests.
Do not assume that exposing the NVIDIA device to Docker will accelerate the
current JS DQN.

## Capture evidence

For each chunk-loss incident record timestamp, F3 rendered/loaded chunks,
position, whether the camera is attached, FPS, server CPU/memory, and the
Turesla `pose_sample` closest to that timestamp.
