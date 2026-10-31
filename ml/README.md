# Python/PyTorch ML backend — first migration step

Craftle keeps **TypeScript/JavaScript with Mineflayer** for Minecraft embodiment,
server I/O and navigation; use **Python/PyTorch** for scalable trainable models,
tensor data pipelines, GPU training, and evaluation. The current handwritten
`src/option-dqn.js` is retained as a frozen baseline.

## Windows host installation

Use a separate Python 3.11/3.12 virtual environment and an official PyTorch
CUDA-enabled build matched to your platform. Consult
https://pytorch.org/get-started/locally/ for the current wheel selector. The
NVIDIA driver showing CUDA 13.0 in nvidia-smi indicates **driver capability**;
it does not mean you must install a CUDA 13.0 toolkit or that Docker can use GPU.

```powershell
py -3.11 -m venv .venv-ml
.\.venv-ml\Scripts\Activate.ps1
python -m pip install --upgrade pip
# Use PyTorch's currently recommended Windows/Pip/CUDA install command.
python -c "import torch; print(torch.__version__, torch.cuda.is_available()); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU only')"
python ml/benchmark_models.py --device auto --output experiments/benchmarks/rtx4050-sweep.json
```

Do not install PyTorch inside the running agent container yet. It currently
does not have an NVIDIA device, and graphics is explicitly software-rendered.

## Experiments

The benchmark runs synthetic MSE optimization on neural networks of several
sizes, with controlled seed, action count and input dimensions. It records
parameters, optimization steps per second and hardware. **This is not a DQN
behavior benchmark** and does not prove Minecraft learning performance.
Use isolated models and unchanged input/action contracts in the next phase;
add a Python training service / versioned IPC and integrate distinct checkpoint
names for each size and instinct treatment. Preserve the current JS DQN baseline.

The RTX 4050 Laptop GPU has approximately 6 GiB of VRAM. Benchmark batch sizes
and memory use before expanding convolutional visual models. On WSL2, Docker
GPU access requires separate GPU passthrough validation.
