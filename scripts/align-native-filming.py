#!/usr/bin/env python3
"""Build a timestamp-aligned SRT and evidence manifest for a *native* Minecraft MP4.

The video start is an explicit UTC wall-clock time. No timestamps are inferred
from file creation or guessed from action order. Original MP4 is never touched.
"""
import argparse
import datetime as dt
import json
import pathlib
import subprocess

KINDS = {
    "target_decision": ("🎯", "selected"),
    "target_attack_intent": ("⚔", "attack intent"),
    "target_attack_attempt": ("⚔", "attack attempted"),
    "target_harvest_intent": ("⛏", "harvest intent"),
    "target_harvest_attempt": ("⛏", "harvest attempted"),
    "target_harvest_block_observation": ("⛏", "block observed"),
    "target_consumed": ("🍞", "eating observed"),
    "target_verified_recovery": ("♥", "hunger recovery observed"),
    "food_provenance_pickup_event": ("📦", "item pickup observed"),
    "death_screen_observed": ("☠", "death observed"),
}
def parse_time(value):
    result = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    if result.tzinfo is None:
        raise ValueError("time must include timezone offset or Z")
    return result.astimezone(dt.timezone.utc)

def subtitle_time(seconds):
    ms = int(round(seconds * 1000))
    h, rem = divmod(ms, 3600000)
    m, rem = divmod(rem, 60000)
    s, rem = divmod(rem, 1000)
    return f"{h:02}:{m:02}:{s:02},{rem:03}"

def create_alignment(logfile, video_start, duration, offset_seconds=0, max_events=3000):
    if duration <= 0 or duration > 86400:
        raise ValueError("duration must be between zero and 24 hours")
    video_start = parse_time(video_start)
    events = []
    malformed = 0
    with pathlib.Path(logfile).open(encoding="utf-8") as handle:
        for line in handle:
            if not line.startswith('{"timestamp":'):
                continue
            try:
                event = json.loads(line)
                if event.get("type") not in KINDS:
                    continue
                event_time = parse_time(event["timestamp"])
            except (ValueError, KeyError, TypeError, json.JSONDecodeError):
                malformed += 1
                continue
            at = (event_time - video_start).total_seconds() + offset_seconds
            if not 0 <= at < duration:
                continue
            symbol, meaning = KINDS[event["type"]]
            action = event.get("action")
            label = f"{meaning}: {str(action)[:60]}" if isinstance(action, str) else meaning
            events.append({"second": at, "type": event["type"],
                           "text": f"{symbol} {label}", "timestamp": event["timestamp"]})
            if len(events) > max_events:
                events.pop(0)
    events.sort(key=lambda item: item["second"])
    srt = []
    for index, entry in enumerate(events, 1):
        start = entry["second"]
        end = min(duration, start + 1.5, events[index]["second"] if index < len(events) else duration)
        end = max(start + 0.001, end)
        srt.extend((str(index), f"{subtitle_time(start)} --> {subtitle_time(end)}",
                    entry["text"], ""))
    return "\n".join(srt), {
        "schema": "craftle.native-video-alignment.v1",
        "origin": "mineflayer_agent_log_not_server_confirmed",
        "videoStartUtc": video_start.isoformat(),
        "durationSeconds": duration,
        "offsetSeconds": offset_seconds,
        "annotationCount": len(events),
        "malformedRelevantLines": malformed,
        "events": events,
    }

def probe_duration(video):
    result = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                             "-of", "default=noprint_wrappers=1:nokey=1", str(video)],
                            text=True, capture_output=True, check=True)
    return float(result.stdout.strip())

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--log", required=True)
    parser.add_argument("--video", required=True, help="Recorded real Minecraft MP4")
    parser.add_argument("--video-start-utc", required=True,
                        help="Exact UTC start timestamp of native recording, e.g. 2026-10-26T18:00:00Z")
    parser.add_argument("--offset-seconds", type=float, default=0.0,
                        help="Optional measured correction for capture clock drift")
    parser.add_argument("--output-prefix", default="native-filming")
    args = parser.parse_args()
    video = pathlib.Path(args.video)
    if not video.is_file():
        parser.error("native MP4 does not exist; record real Minecraft footage first")
    duration = probe_duration(video)
    srt, manifest = create_alignment(args.log, args.video_start_utc, duration, args.offset_seconds)
    prefix = pathlib.Path(args.output_prefix)
    prefix.parent.mkdir(parents=True, exist_ok=True)
    prefix.with_suffix(".srt").write_text(srt, encoding="utf-8")
    manifest.update({"video": str(video), "annotationFile": str(prefix.with_suffix(".srt"))})
    prefix.with_suffix(".json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps({"video": str(video), "durationSeconds": duration,
                      "annotations": manifest["annotationCount"],
                      "srt": str(prefix.with_suffix(".srt"))}, indent=2))
if __name__ == "__main__":
    main()
