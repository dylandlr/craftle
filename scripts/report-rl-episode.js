import fs from 'node:fs';
const file=process.argv[2];
if(!file)throw Error('Usage: node scripts/report-rl-episode.js <agent.log>');
const events=fs.readFileSync(file,'utf8').split(/\r?\n/).flatMap(line=>{try{return [JSON.parse(line)]}catch{return []}});
const actions=events.filter(e=>e.type==='rl_action'),transitions=events.filter(e=>e.type==='rl_transition');
const rewards=transitions.map(e=>e.reward).filter(Number.isFinite);
const distances=transitions.map(e=>e.displacement).filter(Number.isFinite);
const report={schemaVersion:1,policy:actions[0]?.policy??'unknown',
 actions:actions.length,transitions:transitions.length,uniqueVisualStates:new Set(actions.map(e=>e.state)).size,
 cumulativeReward:rewards.reduce((a,b)=>a+b,0),meanReward:rewards.length?rewards.reduce((a,b)=>a+b,0)/rewards.length:null,
 cumulativeDisplacement:distances.reduce((a,b)=>a+b,0),
 actionsByType:Object.fromEntries([...new Set(actions.map(x=>x.action))].map(a=>[a,actions.filter(e=>e.action===a).length])),
 caveat:'Displacement between frames includes passive movement, frame delays and action inertia. This does not measure net exploration, survival or learning advantage.'};
console.log(JSON.stringify(report,null,2));
