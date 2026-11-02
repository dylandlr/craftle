# Clock-grounded option telemetry: research stage

The new server-clock contract only accepts tick samples with declared provenance from a server query or validated server packet. It does NOT claim that a wall-time timestamp is a Minecraft tick.

`ServerTickClock.observe({gameTime,observedAt,source,worldId})` records epoch and observed game time; a reset or world change invalidates the old epoch. `interval(start,end)` computes the elapsed tick difference only when both samples share world and epoch. The timestamp of events between asynchronous samples is unknown; avoid placing reward events at exact sampled ticks without synchronized event evidence.

A server integration can query `time query gametime` through the existing RCON channel in an isolated observer-only process. Caveats: RCON request/response latency makes these **sampled** bounds, not exact event timestamps. Verify whether the vanilla 1.21.1 server's gameTime increments monotonically across every behavior of interest. Do not treat 20 TPS as observed actual timing. Before training, add event-associated authoritative ticks using an actual server event observer or clearly maintain interval uncertainty.

Tests:
```powershell
node --test test/server-tick-clock.test.js test/smdp-target.test.js test/option-transition.test.js
```

This branch contains no live agent changes and does not add or restart Docker services. Next step: RCON clock sampler, event correlation and offline SMDP reconstruction with explicit uncertainty.
