import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encodeTargets,TARGET_ACTIONS} from '../src/target-opportunities.js';
const base={health:11,food:0,foodAvailable:false,foodUnits:0,foodPoints:0,hostileDistance:24,blocked:true,displacement:0,position:{x:0,y:64,z:0},targets:[]};
test('legacy observation preserves baseline explore eligibility',()=>{
 const x=encodeTargets(base);assert.equal(x.mask[TARGET_ACTIONS.indexOf('explore')],true);assert.equal(x.requiresRecovery,false);
});
test('explicit no-route evidence excludes explore without labeling another action safe',()=>{
 const x=encodeTargets({...base,exploreFeasible:false});assert.equal(x.mask[TARGET_ACTIONS.indexOf('explore')],false);
 assert.deepEqual(x.mask.filter(Boolean),[]);assert.equal(x.requiresRecovery,true);
});
test('no-route explore can still leave a genuinely eligible retreat',()=>{
 const x=encodeTargets({...base,hostileDistance:12,exploreFeasible:false});
 assert.deepEqual(x.mask.flatMap((yes,i)=>yes?[TARGET_ACTIONS[i]]:[]),['retreat']);
 assert.equal(x.requiresRecovery,false);
});
test('unknown feasibility is not mistaken for known infeasibility',()=>{
 assert.equal(encodeTargets({...base,exploreFeasible:null}).mask[1],true);
});
