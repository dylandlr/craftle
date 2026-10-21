#!/usr/bin/env node
import fs from 'node:fs';
const source=process.argv[2]??'recordings/controller.log';
const dest=process.argv[3]??'recordings/renderer-health.json';
const log=fs.readFileSync(source,'utf8');
const missing={};
for(const m of log.matchAll(/Error: Unknown entity ([a-z0-9_]+)/g))missing[m[1]]=(missing[m[1]]??0)+1;
const events=[];
for(const line of log.split(/\r?\n/)){
  if(!line.startsWith('{'))continue;
  try{events.push(JSON.parse(line))}catch{}
}
const byType={};
for(const e of events)if(e.type)byType[e.type]=(byType[e.type]??0)+1;
const report={
  note:'Unknown entity means Prismarine Viewer could not render a model; it does not necessarily terminate capture. Review POV pixels before acceptance.',
  unknownEntities:missing,
  unknownEntityOccurrences:Object.values(missing).reduce((a,b)=>a+b,0),
  events:byType,
  spawnedAgents:[...new Set(events.filter(e=>e.type==='spawn').map(e=>e.agent))],
  recorderFailures:events.filter(e=>e.type==='pov_capture_failed'||e.type==='recording_error'),
  cameraErrors:events.filter(e=>e.type==='camera_sweep_error')
};
fs.mkdirSync('recordings',{recursive:true});
fs.writeFileSync(dest,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.recorderFailures.length||report.cameraErrors.length)process.exitCode=1;
