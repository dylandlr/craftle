#!/usr/bin/env python3
"""Audit shared-world capture timing from each agent's JSONL controller log."""
import argparse
import datetime as dt
import glob
import json
import pathlib
import sys

def millis(timestamp):
    return dt.datetime.fromisoformat(timestamp.replace("Z", "+00:00")).timestamp() * 1000

p=argparse.ArgumentParser()
p.add_argument("folder",type=pathlib.Path)
p.add_argument("--expected",type=int,default=9)
p.add_argument("--max-start-skew-ms",type=float,default=500)
p.add_argument("--max-release-skew-ms",type=float,default=500)
a=p.parse_args()
records=[]
for filename in sorted(glob.glob(str(a.folder / "agent_*.log"))):
    events=[]
    with open(filename,encoding="utf8",errors="replace") as f:
        for line in f:
            try: events.append(json.loads(line))
            except (ValueError,TypeError): pass
    start=next((e for e in events if e.get("type")=="pov_capture_started"),None)
    release=next((e for e in events if e.get("type")=="capture_released"),None)
    records.append({"agent":pathlib.Path(filename).stem,
                    "release":release.get("timestamp") if release else None,
                    "recorder_start":start.get("timestamp") if start else None})
starts=[millis(x["recorder_start"]) for x in records if x["recorder_start"]]
releases=[millis(x["release"]) for x in records if x["release"]]
report={"expected":a.expected,"found":len(records),"started":len(starts),
        "release_skew_ms":round(max(releases)-min(releases),2) if releases else None,
        "recorder_start_skew_ms":round(max(starts)-min(starts),2) if starts else None,
        "renderer_start_advisory_tolerance_ms":a.max_start_skew_ms,
        "barrier_release_tolerance_ms":a.max_release_skew_ms,
        "renderer_start_within_advisory":bool(starts and max(starts)-min(starts)<=a.max_start_skew_ms),
        "limitations":"Application-side timestamps are not timestamps for encoded frames or Minecraft ticks. Gate checks barrier-release skew. Renderer-start skew is diagnostic only; neither establishes encoded-frame synchronization.",
        "agents":records}
report["pass"]=len(records)==a.expected and len(starts)==a.expected and len(releases)==a.expected and report["release_skew_ms"]<=a.max_release_skew_ms
(a.folder/"timing-report.json").write_text(json.dumps(report,indent=2)+"\n")
print(json.dumps(report,indent=2))
if not report["pass"]:sys.exit(1)
