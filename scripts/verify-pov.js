#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
export function probeVideo(file){
  const c=spawnSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_type,width,height','-of','json',file],{encoding:'utf8'});
  if(c.status!==0)throw Error(c.stderr?.trim()||'ffprobe failed');
  return JSON.parse(c.stdout);
}
export function inspectPov(directory,agentIds,{probe=probeVideo}={}){
  const results=agentIds.map(id=>{
    const file=path.join(directory,`${id}.mp4`);
    if(!fs.existsSync(file)||fs.statSync(file).size<1024)return{id,file,ok:false,error:'missing_or_empty'};
    try{
      const data=probe(file),video=(data.streams||[]).find(x=>x.codec_type==='video'),duration=Number(data.format?.duration||0);
      if(!video||!(video.width>0)||!(video.height>0)||!(duration>0))return{id,file,ok:false,error:'invalid_video_stream'};
      return{id,file,ok:true,duration,width:video.width,height:video.height,bytes:fs.statSync(file).size};
    }catch(e){return{id,file,ok:false,error:String(e.message)}}
  });
  return{expected:agentIds.length,passed:results.filter(r=>r.ok).length,allValid:results.every(r=>r.ok),results};
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)){
  const dir=process.argv[2]||'recordings/pov';
  const config=JSON.parse(fs.readFileSync(process.argv[3]||'config.json','utf8'));
  const report=inspectPov(dir,config.agents.map(a=>a.id));
  fs.mkdirSync('recordings',{recursive:true});
  fs.writeFileSync('recordings/pov-manifest.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({expected:report.expected,passed:report.passed,failures:report.results.filter(r=>!r.ok)},null,2));
  if(!report.allValid)process.exitCode=1;
}