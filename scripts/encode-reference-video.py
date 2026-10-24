"""Encode the complete sampled POV at its recorded wall-clock timing."""
import base64
import json
from pathlib import Path
import subprocess
import sys

directory = Path(sys.argv[1]).resolve()
frames = [json.loads(line) for line in (directory / "frames.jsonl").read_text().splitlines()]
if len(frames) < 10:
    raise SystemExit("Insufficient captured frames")
from datetime import datetime

times = [datetime.fromisoformat(frame["capturedAt"].replace("Z", "+00:00")).timestamp() for frame in frames]
if any(b <= a for a, b in zip(times, times[1:])):
    raise SystemExit("Capture timestamps are not strictly increasing")
if any(frame["frameId"] >= frames[i + 1]["frameId"] for i, frame in enumerate(frames[:-1])):
    raise SystemExit("Frame identifiers are not strictly increasing")

concat = ["ffconcat version 1.0"]
for index, frame in enumerate(frames):
    filename = frame["file"]
    if len(filename) != 10 or not filename[:6].isdigit() or filename[6:] != ".jpg":
        raise SystemExit("Unexpected frame filename")
    concat.append("file frames/" + filename)
    duration = times[index + 1] - times[index] if index + 1 < len(frames) else 0.1
    concat.append(f"duration {duration:.6f}")
concat.append("file frames/" + frames[-1]["file"])
(directory / "video.ffconcat").write_text("\n".join(concat) + "\n")
output = directory / "survival_reference.mp4"
subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-safe", "1", "-f", "concat", "-i",
                str(directory / "video.ffconcat"), "-fps_mode", "vfr", "-c:v", "libx264", "-pix_fmt",
                "yuv420p", "-movflags", "+faststart", str(output)], check=True)
probe = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_format", "-of", "json", str(output)]))
duration = float(probe["format"]["duration"])
span = times[-1] - times[0]
timing = {"frames": len(frames), "capturedSpanSeconds": span, "encodedSeconds": duration,
          "maxFrameGapSeconds": max(b - a for a, b in zip(times, times[1:])),
          "source": "rendered_first_person_rgb", "maxSampleFps": 10}
(directory / "video-timing.json").write_text(json.dumps(timing, indent=2) + "\n")
print(json.dumps(timing))
if span < 70 or abs(duration - span) > 2:
    raise SystemExit("Video does not cover the smoke trial with correct timing")

from PIL import Image, ImageDraw
sheet = Image.new("RGB", (768, 828), "#171717")
draw = ImageDraw.Draw(sheet)
for cell in range(9):
    index = round(cell * (len(frames) - 1) / 8)
    frame = frames[index]
    with Image.open(directory / "frames" / frame["file"]) as picture:
        sheet.paste(picture.resize((256, 256)), ((cell % 3) * 256, (cell // 3) * 276))
    draw.text(((cell % 3) * 256 + 8, (cell // 3) * 276 + 258), f"{times[index] - times[0]:.1f}s", fill="white")
sheet.save(directory / "contact-sheet.jpg", quality=80)
print("REFERENCE_CONTACT_SHEET_BASE64=" + base64.b64encode((directory / "contact-sheet.jpg").read_bytes()).decode())
