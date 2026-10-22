// Aggregate consecutive Minecraft online-RL sessions. World and checkpoint persist.
// Independent evaluation must use separate seeds and frozen checkpoints.
import fs from 'node:fs';
import path from 'node:path';
const root=process.argv[2]??'recordings/continuous';
const episodes=fs.readdirSync(root).filter(x=>/^episode-[0-9]+$/.test(x)).sort((a,b)=>Number(a.split('-')[1])-Number(b.split('-')[1]));
if(!episodes.length)throw Error('No completed episode folders');
const results=episodes.map(name=>{
 const file=path.join(root,name,'agent.log');
 const events=fs.readFileSync(file,'utf8').split(/\r?\n/).flatMap(s=>{try{return [JSON.parse(s)]}catch{return []}});
 const actions=events.filter(x=>x.type==='rl_action');
 const transitions=events.filter(x=>x.type==='rl_transition');
 const rewards=transitions.map(x=>x.reward).filter(Number.isFinite);
 return {episode:name,actions:actions.length,transitions:transitions.length,uniqueVisualStates:new Set(actions.map(x=>x.state)).size,
  cumulativeReward:Number(rewards.reduce((a,b)=>a+b,0).toFixed(4)),
  displacement:Number(transitions.reduce((a,x)=>a+(Number.isFinite(x.displacement)?x.displacement:0),0).toFixed(3)),
  errors:events.filter(x=>x.type==='rl_error').length,deaths:events.filter(x=>x.type==='death').length};
});
const report={schemaVersion:1,worldContinuity:'same server and world across restarted agent sessions',
 treatment:'online visual Q-learning',episodes:results,totalUpdates:results.reduce((a,x)=>a+x.transitions,0),
 caveat:'Training rewards are not held-out success. Saved checkpoint continuity alone does not show improving competence.'};
console.log(JSON.stringify(report,null,2));
