#!/usr/bin/env python3
"""Render event-log telemetry as video; optionally encode actual camera PNG frames."""
import argparse,json,pathlib,subprocess,shutil
from PIL import Image,ImageDraw,ImageFont
p=argparse.ArgumentParser();p.add_argument('--log',required=True);p.add_argument('--out',default='recordings');p.add_argument('--frames');p.add_argument('--fps',type=int,default=8);a=p.parse_args()
out=pathlib.Path(a.out);out.mkdir(parents=True,exist_ok=True)
events=[json.loads(line) for line in pathlib.Path(a.log).read_text().splitlines() if line.strip()]
if not events:raise SystemExit('No logged events')
if not shutil.which('ffmpeg'):raise SystemExit('ffmpeg is required')
report={'events':len(events),'agents':sorted({str(e['agent']) for e in events if e.get('agent')}),'gameplay_video':None,'telemetry_video':'telemetry.mp4'}
if a.frames:
    frames=list(pathlib.Path(a.frames).glob('*.png'))
    if not frames:raise SystemExit('No actual camera PNG frames; refusing to invent gameplay video')
    subprocess.run(['ffmpeg','-y','-v','error','-framerate',str(a.fps),'-pattern_type','glob','-i',str(pathlib.Path(a.frames)/'*.png'),'-c:v','libx264','-pix_fmt','yuv420p',str(out/'gameplay.mp4')],check=True)
    report['gameplay_video']='gameplay.mp4'
tmp=out/'frames';tmp.mkdir(exist_ok=True)
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',20)
for i in range(min(240,max(16,len(events)))):
    ix=min(len(events)-1,i*len(events)//min(240,max(16,len(events))))
    im=Image.new('RGB',(960,540),(15,27,33));d=ImageDraw.Draw(im)
    d.text((25,24),'CRAFTLE — TELEMETRY, NOT GAMEPLAY FOOTAGE',font=font,fill=(230,195,100))
    d.text((25,70),f'Event {ix+1} / {len(events)}',font=font,fill=(170,242,190))
    for j,(k,v) in enumerate(list(events[ix].items())[:11]):d.text((25,112+j*32),f'{k}: {str(v)[:85]}',font=font,fill='white')
    im.save(tmp/f'{i:05d}.png')
subprocess.run(['ffmpeg','-y','-v','error','-framerate',str(a.fps),'-i',str(tmp/'%05d.png'),'-c:v','libx264','-pix_fmt','yuv420p',str(out/'telemetry.mp4')],check=True)
shutil.rmtree(tmp)
(out/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
