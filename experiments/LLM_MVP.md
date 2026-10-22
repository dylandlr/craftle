# Craftle: LLM intelligent-agent MVP

Set `CRAFTLE_AGENT_IDS=agent_001` and `CRAFTLE_BEHAVIOR=llm_agent`. The bot receives decoded first-person RGB frames from Prismarine Viewer and permitted self-state (health/hunger); it never receives Mineflayer block queries in this treatment.

Environment variables:
- `CRAFTLE_LLM_API_KEY` — secret for an OpenAI-compatible multimodal Chat Completions endpoint
- `CRAFTLE_LLM_MODEL` — vision-capable model supported by that endpoint
- `CRAFTLE_LLM_BASE_URL` — optional endpoint root (default `https://api.openai.com/v1`)
- `CRAFTLE_LLM_INTERVAL_MS` — minimum interval between completed LLM decisions (default 5000)
- `CRAFTLE_LLM_MAX_STEPS` — per-session LLM request budget (default 100)
- `CRAFTLE_LLM_MEMORY_FILE` — persistent distilled lessons (default `recordings/llm/agent-memory.json`)
- `CRAFTLE_LIVE_SIZE` — headless view resolution, default 128
- `CRAFTLE_RECORD_FRAMES` — headless capture limit, default 1000

Requires the same Xvfb / software GL / `node-canvas-webgl` environment as existing live RGB tests. Configure with `npm run configure` and start with `npm start`. Do not commit secrets or agent memory files. The model is pretrained; this is an autonomy/planning/memory study, not learning from scratch.

Controller contract: multimodal model returns JSON containing goal, belief, plan, legal action and distilled memory. The result of the preceding action is included in the next observation context for reflection. Decisions are logged; actions are dispatched through the existing movement adapter. Camera images are never sent to a preprocessor that returns game blocks. Timeout/errors stop movement; the agent does not keep walking blindly.

Limitations of v1:
- Actions include elementary movement, looking, crosshair-targeted mining, item use and entity attack. Crafting, inventory management, long-horizon execution and reward/counterfactual evaluation remain upcoming. Mining target resolution occurs exclusively inside the action executor and is not surfaced as sensory input to the model.
- Internal LLM pretraining may contain Minecraft knowledge.
- Memory is a bounded lesson list, not yet episodic retrieval or validated learning.
- A live agent run needs credentials and a multimodal model; GitHub CI currently only exercises a mocked model.
- Repeated RGB images, sensor quality and action outcomes require audit before drawing scientific conclusions.
