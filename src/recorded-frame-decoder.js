// Offline RGB24 decoder for recorded first-person footage.
// Useful for policy dataset creation and testing observation plumbing.
// This is NOT low-latency live agent perception.
import {spawn} from 'node:child_process';
import {makeVisualObservation} from './vision-observation.js';
export async function* decodeRecordedFrames(filename,{width=84,height=84,fps=5,limit=100,startedAt=new Date().toISOString()}={}){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||!Number.isInteger(fps)||fps<1||!Number.isInteger(limit)||limit<1)throw Error('Invalid decoder options');
  const frameSize=width*height*3;
  const child=spawn('ffmpeg',['-hide_banner','-loglevel','error','-i',filename,'-vf',`fps=${fps},scale=${width}:${height}`,'-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{stdio:['ignore','pipe','pipe']});
  let stderr='',buffer=Buffer.alloc(0),frameId=0;
  child.stderr.on('data',d=>{stderr+=d.toString().slice(0,1024);});
  try{
    for await(const chunk of child.stdout){
      buffer=Buffer.concat([buffer,chunk]);
      while(buffer.length>=frameSize){
        const rgb=new Uint8Array(buffer.subarray(0,frameSize));
        buffer=buffer.subarray(frameSize);
        yield makeVisualObservation({rgb,width,height,frameId,capturedAt:new Date(Date.parse(startedAt)+1000*frameId/fps).toISOString()});
        if(++frameId>=limit){child.kill('SIGTERM');return;}
      }
    }
    if(buffer.length)throw Error(`Truncated RGB stream (${buffer.length} trailing bytes)`);
    if(frameId===0)throw Error(`No frames decoded from ${filename}: ${stderr}`);
  }finally{if(child.exitCode===null)child.kill('SIGTERM');}
}
