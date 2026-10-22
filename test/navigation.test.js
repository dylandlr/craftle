import test from 'node:test';
import assert from 'node:assert/strict';
import {decideNavigation} from '../src/navigation.js';
const base={forwardBlocked:false,groundAhead:true,displacement:1,tick:5,agentIndex:1};
test('walk on clear safe terrain',()=>assert.deepEqual(decideNavigation(base),{forward:true,jump:false,yawDelta:0,reason:'explore_forward'}));
test('avoid unsafe edge',()=>{const x=decideNavigation({...base,groundAhead:false});assert.equal(x.reason,'unsafe_edge');assert.equal(x.forward,false);});
test('jump and turn at block',()=>{const x=decideNavigation({...base,forwardBlocked:true});assert.equal(x.reason,'obstacle');assert.equal(x.jump,true);});
test('recover from no displacement',()=>{const x=decideNavigation({...base,displacement:0});assert.equal(x.reason,'stuck_recovery');assert.ok(x.yawDelta>0);});
