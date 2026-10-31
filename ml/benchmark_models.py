"""Reproducible PyTorch network-size sweep, independent of the live agent.
Runs synthetic batched DQN optimization to benchmark backend, not Minecraft skill.
"""
import argparse
import json
import os
import platform
import random
import time
from pathlib import Path

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--device", choices=["auto", "cpu", "cuda"], default="auto")
    parser.add_argument("--sizes", default="tiny,small,medium,large")
    parser.add_argument("--steps", type=int, default=100)
    parser.add_argument("--batch", type=int, default=256)
    parser.add_argument("--input-dim", type=int, default=44)
    parser.add_argument("--actions", type=int, default=15)
    parser.add_argument("--seed", type=int, default=17)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    if args.steps <= 0 or args.batch <= 0 or args.input_dim <= 0 or args.actions <= 0:
        parser.error("steps, batch, input-dim and actions must be positive")
    import torch
    import torch.nn as nn
    sizes = {"tiny": (16,), "small": (64, 64), "medium": (256, 256), "large": (512, 512, 256)}
    requested = [x.strip() for x in args.sizes.split(",")]
    if not requested or any(x not in sizes for x in requested):
        parser.error("Unknown size: choose " + ", ".join(sizes))
    if args.device == "cuda" and not torch.cuda.is_available():
        parser.error("CUDA requested but unavailable; no CPU fallback")
    device = "cuda" if args.device == "auto" and torch.cuda.is_available() else args.device
    if device == "auto":
        device = "cpu"
    torch.manual_seed(args.seed)
    random.seed(args.seed)
    results = []
    for name in requested:
        layers = []
        last = args.input_dim
        for n in sizes[name]:
            layers.extend([nn.Linear(last, n), nn.ReLU()])
            last = n
        layers.append(nn.Linear(last, args.actions))
        model = nn.Sequential(*layers).to(device)
        optimizer = torch.optim.Adam(model.parameters(), lr=0.0003)
        inputs = torch.randn(args.batch, args.input_dim, device=device)
        target = torch.randn(args.batch, args.actions, device=device)
        if device == "cuda":
            torch.cuda.synchronize()
        start = time.perf_counter()
        for _ in range(args.steps):
            optimizer.zero_grad(set_to_none=True)
            loss = (model(inputs) - target).square().mean()
            loss.backward()
            optimizer.step()
        if device == "cuda":
            torch.cuda.synchronize()
        elapsed = time.perf_counter() - start
        results.append({"size": name, "hidden": sizes[name], "parameters": sum(p.numel() for p in model.parameters()),
                        "steps": args.steps, "batch": args.batch, "seconds": elapsed,
                        "stepsPerSecond": args.steps / elapsed, "finalSyntheticLoss": float(loss.detach().cpu())})
    report = {"schema": "craftle.torch-model-sweep.v1", "device": device, "gpuName": torch.cuda.get_device_name(0) if device == "cuda" else None,
              "torchVersion": torch.__version__, "pythonVersion": platform.python_version(),
              "seed": args.seed, "inputDim": args.input_dim, "actions": args.actions,
              "experimentKind": "synthetic_throughput_not_survival_training", "results": results}
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("x", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)
        handle.write("\n")
    print(json.dumps(report, indent=2))

if __name__ == "__main__":
    main()
