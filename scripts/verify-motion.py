#!/usr/bin/env python3
"""Reject motionless Minecraft POV footage (diagnostic, not proof of agency)."""
import argparse, subprocess, pathlib, json, sys
p=argparse.ArgumentParser()
p.add_argument("directory")
p.add_argument("--min-different-frames",type=int,default=2)
a=p.parse_args()
results=[]
for file in sorted(pathlib.Path(a.directory).glob("*.mp4")):
    cmd=["ffmpeg","-v","error","-i",str(file),"-vf","fps=2,scale=32:32,format=gray","-f","rawvideo","-"]
    raw=subprocess.run(cmd,capture_output=True,check=True).stdout
    size=32*32
    frames=[raw[i:i+size] for i in range(0,len(raw)-size+1,size)]
    diffs=[sum(abs(x-y) for x,y in zip(frames[i],frames[i-1]))/size for i in range(1,len(frames))]
    changed=sum(d>1.5 for d in diffs)
    results.append({"file":str(file),"sampled_frames":len(frames),"different_frames":changed,"max_mean_absolute_difference":max(diffs,default=0),"pass":changed>=a.min_different_frames})
print(json.dumps(results,indent=2))
if not results or not all(x["pass"] for x in results):sys.exit(1)
