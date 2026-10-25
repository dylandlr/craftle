#!/usr/bin/env python3
"""Create a time-aligned two-agent comparison video from actual POV captures."""
import json,subprocess,sys
from pathlib import Path
from datetime import datetime,timezone

def stamp(s):
    return datetime.fromisoformat(s.replace("Z","+00:00")).timestamp()

def load(directory):
    d=Path(directory)
    entries=[json.loads(s) for s in (d/"frames.jsonl").read_text().splitlines() if s.strip()]
    frames=[]
    for e in entries:
        f=d/"frames"/e["file"]
        if f.is_file():frames.append((stamp(e["capturedAt"]),f))
    if len(frames)<10:raise ValueError(f"Not enough frames in {d}")
    if any(b[0]<a[0] for a,b in zip(frames,frames[1:])):raise ValueError("Nonmonotonic frames")
    return frames

def create(left,right,output,fps=8):
    # Align each independent simulation to seconds since its first POV frame.
    # Do not imply simultaneous shared-world events.
    a,b=load(left),load(right)
    duration=min(a[-1][0]-a[0][0],b[-1][0]-b[0][0])
    if duration<30:raise ValueError("Insufficient overlapping episode duration")
    out=Path(output);out.parent.mkdir(parents=True,exist_ok=True)
    import bisect,tempfile
    from PIL import Image,ImageDraw
    with tempfile.TemporaryDirectory() as tmp:
        offsets=[[t-rows[0][0] for t,_ in rows] for rows in (a,b)]
        count=int(duration*fps)
        for i in range(count):
            time=i/fps
            canvas=Image.new("RGB",(640,370),"#121417")
            draw=ImageDraw.Draw(canvas)
            for j,rows in enumerate((a,b)):
                k=max(0,bisect.bisect_right(offsets[j],time)-1)
                with Image.open(rows[k][1]) as source:
                    canvas.paste(source.convert("RGB").resize((320,320)),(j*320,28))
                draw.text((j*320+8,8),("LEFT" if j==0 else "RIGHT")+f"  t={time:.1f}s",fill="white")
            canvas.save(Path(tmp)/f"{i:06d}.jpg",quality=80)
        subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y","-framerate",str(fps),"-i",f"{tmp}/%06d.jpg","-c:v","libx264","-pix_fmt","yuv420p","-movflags","+faststart",str(out)],check=True)
    audit={"schema":"craftle.pov-comparison.v1","left":str(left),"right":str(right),"alignment":"elapsed time since first captured frame; independent world simulations","fps":fps,"durationSeconds":duration,"framesEncoded":count,"leftCaptureFrames":len(a),"rightCaptureFrames":len(b)}
    out.with_suffix(".json").write_text(json.dumps(audit,indent=2)+"\n")
    return audit
if __name__=="__main__":
    print(json.dumps(create(*sys.argv[1:4]),indent=2))
