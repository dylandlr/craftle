import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createOptionDQN} from './option-dqn.js';
import {TARGET_INPUTS,TARGET_ACTIONS,TARGET_SCHEMA} from './target-opportunities.js';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
export function inspectTargetCheckpoint(file){
 const p=JSON.parse(fs.readFileSync(file,'utf8'));
 if(!Number.isSafeInteger(p.updates)||p.updates<0)throw Error('Invalid persistent checkpoint update count');
 createOptionDQN({snapshot:p,training:false,inputs:TARGET_INPUTS,options:TARGET_ACTIONS,schema:TARGET_SCHEMA,random:()=>0.5});
 return {sha256:sha(file),updates:p.updates,schema:p.schema};
}
export function preparePersistentSession(root){
 fs.mkdirSync(root,{recursive:true});
 const checkpoint=path.join(root,'accepted-policy.json');
 const incoming=fs.existsSync(checkpoint)?inspectTargetCheckpoint(checkpoint):null;
 const directory=path.join(root,'sessions',new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID());
 fs.mkdirSync(directory,{recursive:true});
 const candidate=path.join(directory,'candidate-policy.json');
 if(incoming)fs.copyFileSync(checkpoint,candidate);
 const session={schema:'craftle.persistent-session.v1',directory,checkpoint,candidate,incoming,contract:'targeted44-actions15-v1'};
 fs.writeFileSync(path.join(directory,'session.json'),JSON.stringify(session,null,2)+'\n');
 return session;
}
export function promotePersistentSession(session,events,{exitCode,videoValid}={}){
 if(exitCode!==0||!videoValid)throw Error('Session or recording failed; accepted checkpoint preserved');
 if(!events.some(e=>e.type==='shutdown')||events.some(e=>['target_runtime_error','recording_error','error','kicked'].includes(e.type)))throw Error('Incomplete or invalid agent session');
 const decisions=events.filter(e=>e.type==='target_decision');
 if(!decisions.length||decisions.some(e=>e.mode!=='training'||e.contract!==session.contract||!e.mask?.[e.index]))throw Error('Persistent action contract mismatch');
 const transitions=events.filter(e=>['target_transition','target_terminal'].includes(e.type));
 if(!transitions.length)throw Error('No learning transitions');
 const outgoing=inspectTargetCheckpoint(session.candidate),initial=session.incoming?.updates??0;
 let expected=initial;
 for(const transition of transitions){expected+=4;if(!Number.isFinite(transition.reward)||transition.updates!==expected)throw Error('Persistent transition accounting mismatch');}
 if(outgoing.updates!==expected)throw Error('Persistent checkpoint accounting mismatch');
 const current=fs.existsSync(session.checkpoint)?inspectTargetCheckpoint(session.checkpoint):null;
 if(current?.sha256!==session.incoming?.sha256)throw Error('Accepted checkpoint changed during session');
 fs.copyFileSync(session.candidate,session.checkpoint+'.tmp');fs.renameSync(session.checkpoint+'.tmp',session.checkpoint);
 const result={status:'promoted',incoming:session.incoming,outgoing,episodeUpdates:outgoing.updates-initial};
 fs.writeFileSync(path.join(session.directory,'promotion.json'),JSON.stringify(result,null,2)+'\n');
 return result;
}
