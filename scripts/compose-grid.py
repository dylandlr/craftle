#!/usr/bin/env python3
"""Compose nine Craftle POV clips into one labeled 3x3 review video.

Each cell is 480x480, preserving the source's square framing. Missing clips receive a visible MISSING slate.
Paired CI jobs have separate worlds: this grid is a renderer review, not a shared-world replay.
"""
import argparse
import json
import pathlib
import subprocess
import sys

NAMES = ["Turesla", "Edislov", "Curiday", "Faradell", "Lovring", "Hoppage", "Wattoni", "Shannileo", "Teslard"]

def valid_video(path):
    if not path or not path.is_file() or path.stat().st_size == 0:
        return False
    p = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                        "-show_entries", "stream=codec_type", "-of", "default=nw=1:nk=1",
                        str(path)], capture_output=True, text=True)
    return p.returncode == 0 and "video" in p.stdout

def main():
    p = argparse.ArgumentParser()
    p.add_argument("input_root", type=pathlib.Path)
    p.add_argument("output", type=pathlib.Path)
    p.add_argument("--seconds", type=int, default=5)
    args = p.parse_args()
    if not 1 <= args.seconds <= 120:
        p.error("--seconds must be between 1 and 120")

    root = args.input_root
    files = sorted(root.rglob("agent_*.mp4"))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"]
    filters = []
    status = []
    for i, name in enumerate(NAMES):
        key = f"agent_{i+1:03d}.mp4"
        candidates = [f for f in files if f.name == key]
        video = next((f for f in candidates if valid_video(f)), None)
        if video:
            command += ["-stream_loop", "-1", "-i", str(video)]
        else:
            command += ["-f", "lavfi", "-i", "color=c=black:s=480x480:r=25"]
        label = f"{i+1:02d} {name}" + ("" if video else "  MISSING")
        filters.append(
            f"[{i}:v]fps=25,scale=480:480:force_original_aspect_ratio=decrease,"
            f"pad=480:480:(ow-iw)/2:(oh-ih)/2:black,setsar=1,"
            f"drawtext=text='{label}':fontcolor=white:fontsize=19:"
            f"x=12:y=12:box=1:boxcolor=black@0.7[v{i}]"
        )
        status.append({"agent": name, "id": key[:-4], "source": str(video) if video else None, "present": bool(video)})
    filters.append("".join(f"[v{i}]" for i in range(3)) + "hstack=inputs=3[top]")
    filters.append("".join(f"[v{i}]" for i in range(3,6)) + "hstack=inputs=3[middle]")
    filters.append("".join(f"[v{i}]" for i in range(6,9)) + "hstack=inputs=3[bottom]")
    filters.append("[top][middle][bottom]vstack=inputs=3[out]")
    command += ["-filter_complex", ";".join(filters), "-map", "[out]",
                "-t", str(args.seconds), "-an", "-c:v", "libx264",
                "-preset", "veryfast", "-pix_fmt", "yuv420p", str(args.output)]
    result = subprocess.run(command)
    report = {"layout": "3 columns × 3 rows", "separateWorlds": True, "durationSeconds": args.seconds,
              "video": str(args.output), "agents": status}
    args.output.with_suffix(".json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    if result.returncode:
        sys.exit(result.returncode)

if __name__ == "__main__":
    main()
