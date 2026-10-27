#!/usr/bin/env python3
"""Deterministic, read-only inspection of Craftle's decision and physics tick trace."""
import argparse, collections, json, pathlib, datetime

def iso(t):
    try:return datetime.datetime.fromisoformat(t.replace('Z','+00:00'))
    except (ValueError,AttributeError):return None

def load(path):
    with open(path,encoding='utf-8',errors='replace') as stream:
        for line in stream:
            if not line.startswith('{"timestamp":'):continue
            try:
                e=json.loads(line)
                if isinstance(e,dict) and iso(e.get('timestamp')):yield e
            except json.JSONDecodeError:pass

def explain(events,limit):
    counts=collections.Counter(e.get('type') for e in events)
    traces=[e for e in events if e.get('type')=='decision_trace_v1']
    ticks=[e for e in events if e.get('type')=='physics_tick_trace_v1']
    failures=[e for e in events if e.get('type')=='target_navigation_result' and e.get('status')=='noPath']
    rewards=[e for e in events if e.get('type')=='target_transition']
    leaf_ticks=sum('leaves' in str(e.get('underfootBlock','')) for e in ticks)
    decisions=[]
    for e in traces[:limit]:
        d=e.get('neuralTrace') or {}
        vals=d.get('qValues') or []
        mask=e.get('mask') or []
        allowed=[(e.get('actions',[])[i],round(v,5)) for i,v in enumerate(vals) if i<len(mask) and mask[i]]
        allowed.sort(key=lambda a:-a[1])
        decisions.append({
          'timestamp':e['timestamp'],'decisionId':e.get('decisionId'),
          'selected':e.get('selection'),'why':d.get('selectionReason') or e.get('mode'),
          'epsilon':d.get('epsilon'),'topAllowedQ':allowed[:5],
          'availableActions':sum(bool(x) for x in mask),
          'targets':e.get('agentObservation',{}).get('targets',[]),
          'hunger':e.get('agentObservation',{}).get('food'),
          'health':e.get('agentObservation',{}).get('health')
        })
    return {'schema':'craftle.tick-explanation.v1',
     'eventCounts':dict(counts),'decisionTraces':len(traces),'physicsTicks':len(ticks),
     'leafFootingTicks':leaf_ticks,'leafFootingFraction':leaf_ticks/len(ticks) if ticks else None,
     'noPathEvents':len(failures),'rewardTransitions':len(rewards),
     'sampleDecisions':decisions,
     'limits':['PhysicsTick events are Mineflayer local ticks, not certified server ticks.',
       'DQN actions are selected approximately every 1.8 s, not every physics tick.',
       'Q-values and hidden activations exist only if CRAFTLE_DECISION_TRACE=1 was enabled.',
       'Minecraft replay frame alignment requires a verified recording start anchor.']}

def main():
    p=argparse.ArgumentParser();p.add_argument('--log',required=True);p.add_argument('--out',default='recordings/diagnostics/tick-report.json');p.add_argument('--limit',type=int,default=30)
    args=p.parse_args()
    report=explain(list(load(args.log)),max(0,min(args.limit,500)))
    dest=pathlib.Path(args.out);dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,indent=2))
if __name__=='__main__':main()
