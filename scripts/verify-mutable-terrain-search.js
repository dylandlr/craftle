// Explicit generic-planning feasibility control, not a training demonstration.
// Uses only simulator forks and its own legal atomic actions.
import {createMutableTerrain} from '../src/mutable-terrain-env.js';
import {searchMutableTerrain} from '../src/mutable-terrain-search-control.js';
const depth=Number(process.argv[2]??8);
const beamWidth=Number(process.argv[3]??36);
const world=createMutableTerrain({layout:'chasm',span:3,platformHeight:5,
 initialBlocks:5,maxSteps:20});
const result=searchMutableTerrain(world,{depth,beamWidth,maxCandidates:150});
const replay=world.fork();const receipts=[];
for(const step of result.trace){
 const match=replay.affordances().find(c=>c.operation===step.operation&&
  JSON.stringify(c.arguments)===JSON.stringify(step.args));
 if(!match)throw Error('Control proposed an unavailable action');
 const observation=replay.act(match);
 receipts.push({operation:step.operation,arguments:step.args,observed:observation});
 if(!observation.ok)throw Error('Control proposed an unsuccessful action');
}
const reached=receipts.some(r=>r.observed.reachedLowerGround);
if(result.solved&&!reached)throw Error('Planning success failed independent replay');
console.log(JSON.stringify({schema:'craftle.generic-planning-control.v1',
 synthetic:true,realMinecraft:false,solved:result.solved,
 expanded:result.expanded,searchDepth:result.depth,reason:result.reason,
 replayVerified:reached,steps:receipts.length,receipts,
 caveat:'This planner is an explicit upper-bound reference and is not part of the learned policy.'},null,2));
