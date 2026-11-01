# Live neural trace messages in spectator chat

Verbose mode now formats incoming `decision_trace_v1` rows for the **spectator account only**, using native Minecraft JSON text components. Each short message shows the selected action, whether selection was epsilon-random, greedy or forced by masking, its selected Q-value, an alternative eligible Q-value when present, the number of visible targets, and the blocked observation flag when true.

This is **a live trace**, not a reconstructed belief or a model probability. Even if epsilon-random selected the same action that greedy selection would have chosen, the presentation follows the recorded `selectionReason`.

To install without restarting Turesla (its neural traces are already flowing):

```powershell
git fetch origin
git switch -c feat/live-neural-trace-chat --track origin/feat/live-neural-trace-chat
node --test test/live-neural-trace-chat.test.js

docker compose -f deploy/filming/compose.yml --profile commentary up -d --no-deps commentary
docker compose -f deploy/filming/compose.yml --profile commentary exec commentary node /app/scripts/observer-control.js verbose
docker compose -f deploy/filming/compose.yml --profile commentary logs -f commentary
```

The commentary service reads the existing bind-mounted JSONL event stream and does not change Mineflayer policy, actions, RNG or reward. It collapses obsolete queued trace lines to prioritize the newest choice. It will still show other important behavior events. Minecraft chat will necessarily have a lower display rate than the full trace stream; **all** trace rows remain in agent.log.

If you see old unrelated orange text, it is a separate HUD/actionbar source; updating commentary does not disable it.

Current user-verified trace: decision #60, `retreat` selected by `epsilon_random` with Q=-2.733 against eligible `explore` Q=-2.878; targets empty and hunger 0. The action also happened to have the higher Q value, but selectionReason was random. Avoid describing this selection as greedy.
