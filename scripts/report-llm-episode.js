#!/usr/bin/env node
// Audit an actual episode without confusing intent with verified game progression.
import fs from 'node:fs';
const file=process.argv[2]??'recordings/events.jsonl';
const events=fs.readFileSync(file,'utf8').split(/\r?\n/).flatMap(line=>{try{return [JSON.parse(line)]}catch{return []}});
const decisions=events.filter(x=>x.type==='llm_decision');
const outcomes=events.filter(x=>x.type==='llm_action_applied');
const deaths=events.filter(x=>x.type==='death');
const goals=new Map();
for(const e of decisions){if(!goals.has(e.goal))goals.set(e.goal,0);goals.set(e.goal,goals.get(e.goal)+1);}
const actions={};
for(const e of outcomes){const key=e.action;actions[key]??={attempts:0,reportedSuccess:0,reportedFailure:0};actions[key].attempts++;if(e.success)actions[key].reportedSuccess++;else actions[key].reportedFailure++;}
const first=events.find(x=>x.timestamp),last=events.filter(x=>x.timestamp).at(-1);
const report={
 schemaVersion:1,source:file,
 agentIds:[...new Set(decisions.map(x=>x.agent_id))],
 modelActions:decisions.length,appliedActions:outcomes.length,
 uniqueObservedFrameIds:new Set(decisions.map(x=>x.frameId)).size,
 reportedGoals:[...goals].map(([goal,occurrences])=>({goal,occurrences})),
 actionOutcomes:actions,
 deaths:deaths.length,
 durationSeconds:first&&last?Math.round((Date.parse(last.timestamp)-Date.parse(first.timestamp))/1000):null,
 minecraftMilestonesVerified:[],
 caveat:'Tool success and self-reported goals do not prove learning or Minecraft milestone completion. A mock LLM is a diagnostic only.'
};
console.log(JSON.stringify(report,null,2));
