# Human demonstration / video pretraining track (v0.1)

## Research question
Does human demonstration pretraining accelerate learning and transfer, compared with the same architecture trained from scratch, and compared with pretrained Voyager/LLM reasoning?

## Distinct, reproducible treatments
A. Scratch RL: zero imported Minecraft player demonstrations, default randomized policy.
B. BC-human-actions: random CNN/recurrent model trained on synchronized *real first-person frames* and *keyboard/mouse controls*. No imported pretrained neural weights.
C. IDM + video BC: learn inverse dynamics on A/V labeled clips, pseudo-label approved unlabeled gameplay videos, then BC, followed by online RL. Label pseudo actions distinctly from measured actions, with uncertainty.
D. SSL video encoder + online RL: self-supervised frame sequence representations without action labels.
E. VPT pretrained model or reproduction: explicitly pretrained human-video control. External model weights cannot be described as learned from scratch.
F. Existing Craftle structured-targeted DQN, Craftle LLM, and upstream Voyager separate controls with declared knowledge access.

## Data
Canonical clip record: dataset ID, source video/owner, license/access restrictions, Minecraft edition/version/modpack and field of view, resolution, FPS/frame timestamps, synchronized tick+mouse/key action timestamps, self-state if consented/instrumented, player/session split identity hash, world seed, task category, environment/hud state, audio/subtitles handling, action label source (= observed controller | IDM pseudo-label | unknown), confidence, video SHA256, frame/action manifest version and possible training/test overlap.

For strict human-versus-agent generalization: split by original player, recording session, world seed AND source video, not by random frames. No duplicate or near-duplicate clips between train and test. Never include held-out agent gameplay in pretraining.

## First engineering milestone
1. Build a consented human input recorder/mod/client instrumentation: RGB frames + key presses/releases, mouse deltas, inventory clicks and HUD events on a shared monotonic clock; Minecraft world events logged on separate server clock. A high-quality action-label stream is essential.
2. Ingest existing authorized videos as video-only examples, without pretending to know the real actions.
3. Generate validated clips with paired frame and action indices; audit missing frames, latency, dropped inputs and codec deviations. Keep explicit 20Hz/variable FPS mappings.
4. Train a small causal CNN + GRU behavioral cloning baseline on labeled demonstrations using supervised discrete controls and mouse-bin head. Hold out human players/worlds.
5. Live Minecraft evaluation: action playback adapter translating policy outputs to permitted primitive controls, no privileged sensory leaks, identical held-out tasks/seeds/time budgets as scratch RL.
6. Fine-tune the BC-init agent with online RL using the same environment, reward and total experience budget as scratch RL. Compare zero-shot and learning curves.
7. Add IDM pseudo-labeling only after held-out action prediction is calibrated. Report error/coverage and comparison with fully labeled data.
8. Add curated MineDojo video material only after data license and availability checks; transcripts/tutorials convey expert knowledge and are different experimental prior regimes.

## Key results
- Zero-shot success; learned survival skills; actual meals/hunger recovery; collected/crafted unique items; action prediction accuracy and calibration; generalization to unseen worlds/modded environments; sample efficiency (reward versus Minecraft steps); train compute/GPU hours and data video hours.
- Control confounders: supervised action prior vs LLM pretrained Minecraft knowledge; matching model capacity where feasible; sensor and action parity; camera viewpoint/mouse sensitivity/HUD normalization; world-version differences; training-data duplication; video rights.
- Baselines are not interchangeable: published VPT already contains broad demonstration prior and Voyager contains language prior. Report transfer from their pretrained weights separately.
- In no-LLM research, human-demonstration BC is NOT from-scratch knowledge emergence. It is a teacher-informed treatment; scratch RL remains preserved control.

## References
- https://openai.com/index/vpt/
- https://github.com/openai/Video-Pre-Training
- https://github.com/MineDojo/MineDojo

## Deployment gate
No real human videos are currently ingested or trained by the presence of this specification. The prior repo contains visual behavioral cloning code, but it has not been verified as a human-action synchronized live policy. Do not claim training success without dataset provenance, epochs/losses, held-out action accuracy and live trials.
