import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MinecraftOutcomeLedger} from '../src/minecraft-outcome-ledger.js';
const obs=(tick,extra={})=>({tick,position:{x:0,y:64,z:0},health:20,food:18,inventory:[],blocks:[],...extra});
test('observed inventory and block changes are evidence, not proven causal success',()=>{
 const l=new MinecraftOutcomeLedger();
 l.begin({decisionId:'d1',action:'harvest_0',observation:obs(100,{blocks:[{position:{x:2,y:64,z:0},name:'oak_log'}]})});
 const t=l.finish({observation:obs(140,{inventory:[{name:'oak_log',count:1}],blocks:[{position:{x:2,y:64,z:0},name:'air'}]})});
 assert.equal(t.evidence.inventoryDeltas.oak_log,1);
 assert.equal(t.evidence.blockChanges.length,1);
 assert.equal(t.evidence.elapsedTicks,40);
 assert.equal(t.result,'unknown');
 assert.equal(t.evidence.causalAttribution,'unverified_temporal_association');
});
test('without measured change action is not automatically marked successful',()=>{
 const l=new MinecraftOutcomeLedger();
 l.begin({decisionId:'d2',action:'explore',observation:obs(0)});
 assert.equal(l.finish({observation:obs(36)}).result,'no_observable_change');
});
test('timeout retains observed evidence and does not imply environmental terminal',()=>{
 const l=new MinecraftOutcomeLedger();
 l.begin({decisionId:'d3',action:'explore',observation:obs(0)});
 const r=l.finish({reason:'timeout',observation:obs(80,{position:{x:3,y:64,z:0}})});
 assert.equal(r.result,'timed_out');assert.equal(r.evidence.displacement,3);
 assert.equal(r.evidence.episodeTerminal,false);
});
test('death is terminal and rejects tick regression',()=>{
 const l=new MinecraftOutcomeLedger();
 l.begin({decisionId:'d4',action:'retreat',observation:obs(10)});
 assert.throws(()=>l.finish({observation:obs(9)}),/regression/);
 const r=l.finish({environmentTerminal:true,observation:obs(13,{health:0})});
 assert.equal(r.result,'verified_failure');assert.equal(r.evidence.episodeTerminal,true);
});
test('overlapping attempts and malformed observations are rejected',()=>{
 const l=new MinecraftOutcomeLedger();
 l.begin({decisionId:'d5',action:'explore',observation:obs(1)});
 assert.throws(()=>l.begin({decisionId:'d6',action:'explore',observation:obs(2)}));
 assert.throws(()=>l.finish({observation:obs(3,{inventory:[{name:'stone',count:-1}]})}));
 assert.equal(l.active.decisionId,'d5');
});
