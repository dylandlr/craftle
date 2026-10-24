"""Make an explanatory overlay from timestamped telemetry, never inferred achievements."""
import json
from datetime import datetime
from pathlib import Path


def epoch(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()


def stamp(seconds):
    milliseconds = round(max(0, seconds) * 1000)
    seconds, milliseconds = divmod(milliseconds, 1000)
    minutes, seconds = divmod(seconds, 60)
    hours, minutes = divmod(minutes, 60)
    return f"{hours:02}:{minutes:02}:{seconds:02},{milliseconds:03}"


def write_captions(directory, start, span):
    log = directory / "agent.log"
    if not log.exists():
        return False
    events = []
    for line in log.read_text().splitlines():
        try:
            event = json.loads(line)
            timestamp = epoch(event["timestamp"])
        except (ValueError, KeyError, TypeError):
            continue
        events.append((timestamp, event))
    events.sort(key=lambda pair: pair[0])
    policy, action, health, food = "SCRIPTED PRIMITIVES", "waiting", "?", "?"
    meals, harvests, hits = 0, 0, 0
    cues = [(0, "Telemetry overlay | latest logged state\nScripted survival primitives; no discovered skills")]
    for timestamp, event in events:
        kind = event.get("type")
        if kind == "option_decision":
            policy = event.get("mode", "unknown").upper() + " OPTIONS + SCRIPTED PRIMITIVES"
            action = event.get("action", "?")
        elif kind == "survival_reference_action":
            action, health, food = event["objective"], event["health"], event["food"]
        elif kind == "survival_reference_consumed":
            meals += 1
            food = event.get("afterFood", food)
        elif kind == "survival_reference_plant_harvest":
            harvests += 1
        elif kind == "survival_reference_food_damage_observed" and event.get("attribution") == "self":
            hits += 1
        else:
            continue
        offset = max(0, timestamp - start)
        if offset >= span:
            break
        text = (f"{policy}\nLatest logged: {action} | health {health} | food {food}\n"
                f"Measured: meals {meals} | harvests {harvests} | self hits {hits}")
        if offset <= cues[-1][0] + 0.001:
            cues[-1] = (offset, text)
        else:
            cues.append((offset, text))
    output = []
    for index, (offset, text) in enumerate(cues):
        end = cues[index + 1][0] if index + 1 < len(cues) else span
        output.append(f"{index+1}\n{stamp(offset)} --> {stamp(end)}\n{text}\n")
    (directory / "demo-overlay.srt").write_text("\n".join(output))
    return True
