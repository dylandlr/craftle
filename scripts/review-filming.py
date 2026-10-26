#!/usr/bin/env python3
"""Read-only diagnostic timeline for Craftle filming logs; optionally inspect real MP4 with ffprobe."""
import argparse, collections, datetime as dt, json, pathlib, subprocess

def read_events(path):
    with pathlib.Path(path).open(encoding='utf8', errors='replace') as stream:
        for line in stream:
            if not line.startswith('{"timestamp":'): continue
            try:
                event=json.loads(line)
                event['_time']=dt.datetime.fromisoformat(event['timestamp'].replace('Z','+00:00'))
                yield event
            except (KeyError, ValueError, TypeError, json.JSONDecodeError): continue

def summarize(events):
    counts=collections.Counter()
    decisions=collections.Counter()
    traversed=collections.Counter()
    y_samples=[]
    spans=[]
    last_pose=None
    no_path=0
    for e in events:
        typ=e.get('type')
        counts[typ]+=1
        if typ=='target_decision': decisions[e.get('action','?')]+=1
        if typ=='target_navigation_result' and e.get('status')=='noPath': no_path+=1
        if typ=='pose_sample':
            p=e.get('position') or {}
            if all(isinstance(p.get(k),(int,float)) for k in ('x','y','z')):
                y_samples.append(p['y'])
                traversed[(int(p['x']//8),int(p['z']//8))]+=1
                if last_pose:
                    delta=(p['x']-last_pose['x'])**2+(p['z']-last_pose['z'])**2
                    if delta>.5: spans.append({'time':e['timestamp'],'motionBlocks':round(delta**.5,2),'y':p['y']})
                last_pose=p
    return {
        'schema':'craftle.filming-review.v1',
        'eventCounts':{k:counts[k] for k in ['target_decision','target_action','target_navigation_result','target_action_rejected','target_runtime_error','target_consumed','target_attack_attempt','target_harvest_attempt','death_screen_observed']},
        'actionCounts':dict(decisions),'noPathReports':no_path,
        'poseCount':len(y_samples),'observedYRange':[min(y_samples),max(y_samples)] if y_samples else None,
        'uniqueEightBlockCells':len(traversed),'mostRepeatedCells':[{'cell':list(p),'samples':n} for p,n in traversed.most_common(8)],
        'note':'High Y and repeated cells may be consistent with treetop travel; block-underfoot classification requires world/block data or video verification.'
    }

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--log',required=True)
    parser.add_argument('--video',help='Optional actual Flashback MP4; used for ffprobe metadata only')
    parser.add_argument('--out',default='recordings/native/filming-review.json')
    args=parser.parse_args()
    result=summarize(read_events(args.log))
    if args.video:
        if not pathlib.Path(args.video).is_file(): parser.error('Video not found; cannot analyze unseen footage')
        probe=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration,size:stream=codec_name,width,height,r_frame_rate','-of','json',args.video],capture_output=True,text=True,check=True)
        result['videoProbe']=json.loads(probe.stdout)
        result['videoPath']=args.video
        result['frameContentAnalyzed']=False
    out=pathlib.Path(args.out);out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
    print(json.dumps(result,indent=2))
if __name__=='__main__': main()
