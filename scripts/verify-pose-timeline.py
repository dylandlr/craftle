#!/usr/bin/env python3
"""Review shared-world pose telemetry. World-age anchors are periodic, not per-frame clocks."""
import json,glob,pathlib,datetime as dt,argparse,sys
p=argparse.ArgumentParser()
p.add_argument("root",type=pathlib.Path)
p.add_argument("--expected",type=int,default=9)
a=p.parse_args()
summary=[]
for file in sorted(glob.glob(str(a.root/"agent_*.log"))):
    poses=[]
    with open(file,encoding="utf8",errors="replace") as f:
        for line in f:
            try: e=json.loads(line)
            except (ValueError,TypeError):continue
            if e.get("type")=="pose_sample":poses.append(e)
    def stamp(e):return dt.datetime.fromisoformat(e["timestamp"].replace("Z","+00:00")).timestamp()
    times=[stamp(e) for e in poses]
    summary.append({"agent":pathlib.Path(file).stem,"samples":len(poses),
                    "first":poses[0]["timestamp"] if poses else None,
                    "last":poses[-1]["timestamp"] if poses else None,
                    "world_age_anchors":sum(e.get("worldAgeAnchor") is not None for e in poses),
                    "first_epoch":times[0] if times else None,
                    "last_epoch":times[-1] if times else None})
active=[x for x in summary if x["samples"]]
overlap=max(0,min(x["last_epoch"] for x in active)-max(x["first_epoch"] for x in active)) if len(active)==a.expected else 0
report={"expected_agents":a.expected,"agents_with_pose":len(active),"common_pose_window_seconds":round(overlap,3),
        "notes":"These are 250 ms-spaced pose samples anchored to periodic Minecraft time packets. They are not encoded-frame timestamps or exact simulation-tick synchronization.",
        "agents":summary}
report["pass"]=len(active)==a.expected and overlap>1
(a.root/"pose-timeline.json").write_text(json.dumps(report,indent=2)+"\n")
print(json.dumps(report,indent=2))
if not report["pass"]:sys.exit(1)
