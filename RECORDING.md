# Recording workflows

- Recording pipeline validation: on PR/push, create and encode a **labeled synthetic telemetry** fixture.
- Record eight-agent Minecraft smoke: manual Actions run, disposable Minecraft server, actual bot event logs, telemetry MP4, diagnostics, and fourteen-day artifacts.
- To encode **real gameplay camera frames**, supply PNG frames to `scripts/record-run.py --frames /path/to/frames`. This does not capture the frames automatically.
- No headless Minecraft client camera/replay recorder is integrated yet. **Do not represent generated telemetry footage as Minecraft gameplay.**
- Archive artifacts are temporary and may include sensitive logs; review before publishing.
