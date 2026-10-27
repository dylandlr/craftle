#!/usr/bin/env python3
"""Create reviewable, size-checked MP4 clips from locally accessible footage.

Usage: python scripts/craftle-chunk-video.py INPUT.mp4 --output-dir REVIEW_DIRECTORY
Requires ffmpeg and ffprobe. The source is never modified.
"""
import argparse
import json
import math
import shutil
import subprocess
from pathlib import Path

def command(args):
    return subprocess.run(args, text=True, capture_output=True, check=True)

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('input', type=Path)
    p.add_argument('--output-dir', type=Path, default=Path('recordings/review-chunks'))
    p.add_argument('--chunk-seconds', type=int, default=300)
    p.add_argument('--max-mb', type=int, default=200)
    p.add_argument('--height', type=int, default=720)
    p.add_argument('--fps', type=int, default=12)
    p.add_argument('--preset', default='veryfast')
    args = p.parse_args()
    if not args.input.is_file(): p.error('Input does not exist locally: '+str(args.input))
    if args.chunk_seconds < 5 or args.max_mb < 10: p.error('Invalid chunk size or max MB')
    if not shutil.which('ffmpeg') or not shutil.which('ffprobe'): p.error('ffmpeg and ffprobe are required')
    meta = json.loads(command(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(args.input)]).stdout)
    duration = float(meta['format']['duration'])
    count = math.ceil(duration / args.chunk_seconds)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    total_kbps = int(args.max_mb * 8 * 1000 / args.chunk_seconds * .78)
    audio_kbps = 64
    video_kbps = min(1800, max(200,total_kbps-audio_kbps))
    manifest = {'source':str(args.input.resolve()),'durationSeconds':duration,
                'chunkSeconds':args.chunk_seconds,'maxTargetMB':args.max_mb,'clips':[]}
    for i in range(count):
        start = i * args.chunk_seconds
        length = min(args.chunk_seconds, duration-start)
        destination=args.output_dir / f'{args.input.stem}-part-{i:02d}.mp4'
        print(f'[{i+1}/{count}] {start:.1f}-{start+length:.1f}s => {destination}',flush=True)
        cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(start),'-i',str(args.input),
             '-t',str(length),'-map','0:v:0','-map','0:a:0?','-vf',f'fps={args.fps},scale=-2:{args.height}',
             '-c:v','libx264','-preset',args.preset,'-b:v',f'{video_kbps}k',
             '-maxrate',f'{int(video_kbps*1.25)}k','-bufsize',f'{video_kbps*2}k',
             '-c:a','aac','-b:a',f'{audio_kbps}k','-movflags','+faststart',str(destination)]
        subprocess.run(cmd,check=True)
        size=destination.stat().st_size
        if size > args.max_mb*1_000_000:
            raise RuntimeError(f'{destination} is {size/1e6:.1f} MB, exceeds limit; rerun with smaller --chunk-seconds')
        manifest['clips'].append({'name':destination.name,'startSeconds':start,'endSeconds':start+length,'bytes':size})
    manifest_path=args.output_dir/'manifest.json'
    manifest_path.write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    print(f'Finished {count} chunks; manifest: {manifest_path}',flush=True)

if __name__=='__main__':main()
