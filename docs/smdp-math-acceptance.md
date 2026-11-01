# SMDP mathematical acceptance gate (isolated reference)

The attached user's equation is implemented in `src/smdp-target.js`. It is NOT yet wired into live Turesla. The live v1 checkpoint is unchanged.

## Numerical verification
For rewards [1,2,3], gamma=.9, duration=3, next eligible maximum Q=5:
- discounted option reward = 1 + .9*2 + .9^2*3 = 5.23
- future bootstrap = .9^3*5 = 3.645
- target = 8.875.
Death terminal: no bootstrap. An interrupted option in a continuing environment still bootstraps using the next policy, unless a different formal interruption contract is specified.

Run `node --test test/smdp-target.test.js`. Ten tests cover durations 1 and 3, death, interruption, empty mask refusal, masked high Q exclusion, invalid inputs, potential telescoping, terminal potential, and calibrated half-life.

## Safety decisions
- A nonterminal empty eligible mask is an executive recovery obligation, not a value of zero or a fake death. Reference function rejects it rather than silently making a wrong update.
- The reward argument is a per-tick sequence, not a single terminal scalar. In production, reward events must be tied to authoritative elapsed server ticks or an explicitly documented approximation.
- Potential shaping F(s,s',k) = gamma^k Phi(s') - Phi(s) telescopes for contiguous options. A terminal environment requires terminal potential zero to prevent phantom reward. Policy invariance assumes bounded potential, consistent discount, proper terminal treatment, and otherwise valid MDP/SMDP conditions.
- Gamma=.95 is not suitable to reuse as a per-server-tick gamma without horizon review; consider calibration to a chosen reward half-life (e.g. 60s => gamma 2^(-1/1200)).
- This reference does not validate Minecraft causal attribution, target perception, simulator time accuracy, or learned convergence. Those need independent integration/evaluation tests.
