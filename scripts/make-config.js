import fs from 'node:fs';
const names=['Turesla','Edislov','Curiday','Faradell','Lovring','Wattoni','Hoppage','Shannileo','Teslard'];
const agents=Array.from({length:9},(_,i)=>({id:'agent_'+String(i+1).padStart(3,'0'),name:names[i],cognition:{foveatedVision:!!(i<8 && (i&1)),cognitiveMap:!!(i<8 && (i&2)),knowledgeGraph:!!(i<8 && (i&4))},promptCondition:'neutral',training:'base',cohort:i===8?'baseline_replication':'factorial'}));
const config={host:'127.0.0.1',port:25565,version:'1.21.1',maxDays:100,decisionIntervalMs:6000,agents};
fs.writeFileSync('config.json',JSON.stringify(config,null,2)+'\n');
console.log('Configured '+agents.length+' agents');
