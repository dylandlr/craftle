#!/usr/bin/env python3
"""Measure genuine in-world displacement from logged pose samples, not video pixels."""
import argparse,glob,json,math,pathlib,sys
p=argparse.ArgumentParser()
p.add_argument("directory",type=pathlib.Path)
p.add_argument("--expected",type=int,default=9)
p.add_argument("--min-moving-agents",type=int,default=5)
p.add_argument("--min-displacement",type=float,default=0.5)
a=p.parse_args()
rows=[]
for file in sorted(glob.glob(str(a.directory/"agent_*.log"))):
    poses=[]
    for line in pathlib.Path(file).read_text(errors="replace").splitlines():
        try: e=json.loads(line)
        except ValueError: continue
        if e.get("type")=="pose_sample" and e.get("position"): poses.append(e["position"])
    if poses:
        x,y,z=poses[0]["x"],poses[0]["y"],poses[0]["z"]
        distances=[math.hypot(q["x"]-x,q["z"]-z) for q in poses]
        displacement=max(distances)
    else:displacement=0
    rows.append({"agent":pathlib.Path(file).stem,"pose_samples":len(poses),"maximum_horizontal_displacement_blocks":round(displacement,3),"moving":displacement>=a.min_displacement})
moving=sum(x["moving"] for x in rows)
report={"expected":a.expected,"moving_agents":moving,"min_required":a.min_moving_agents,"threshold_blocks":a.min_displacement,"agents":rows}
report["pass"]=len(rows)==a.expected and moving>=a.min_moving_agents
(a.directory/"displacement-report.json").write_text(json.dumps(report,indent=2)+"\n")
print(json.dumps(report,indent=2))
if not report["pass"]:sys.exit(1)
