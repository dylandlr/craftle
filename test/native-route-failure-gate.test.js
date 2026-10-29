import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeRouteFailureGate} from '../src/native-route-failure-gate.js';
test('repeated failed paths at unchanged origin are suppressed until cooldown',()=>{
 const gate=createNativeRouteFailureGate({cooldownMs:30000});
 const p={x:9,y:71,z:-25};
 assert.equal(gate.check({position:p,now:100}).allow,true);
 gate.failed({position:p,now:100});
 assert.equal(gate.check({position:p,now:1800}).reason,'unchanged_failed_origin');
 assert.equal(gate.check({position:p,now:30100}).allow,true);
});
test('movement and successful routes allow immediate re-probing',()=>{
 const gate=createNativeRouteFailureGate();
 gate.failed({position:{x:9,y:71,z:-25},now:1000});
 assert.equal(gate.check({position:{x:11,y:71,z:-25},now:1100}).allow,true);
 gate.succeeded();
 assert.equal(gate.check({position:{x:9,y:71,z:-25},now:1200}).allow,true);
});
test('invalid samples are rejected without throwing',()=>{
 const gate=createNativeRouteFailureGate();
 assert.equal(gate.check({position:null,now:123}).allow,false);
});
