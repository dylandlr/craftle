import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatHud,formatEvent,observerCommand,recommendedLevel} from '../scripts/observer-presentation.js';
test('HUD uses colored health and food, no long telemetry banner',()=>{
 const x=formatHud({action:'explore',health:8.3,food:7});
 assert.equal(x.extra.find(x=>x.text==='8.3/20').color,'red');
 assert.equal(x.extra.find(x=>x.text==='7/20').color,'gold');
 assert.equal(JSON.stringify(x).includes('Updates'),false);
 assert.equal(JSON.stringify(x).includes('XYZ'),false);
});
test('observer chat targets spectator only and explains navigation failure',()=>{
 const line=formatEvent({type:'navigation_impossibility_observed'});
 assert.match(JSON.stringify(line),/Current planner cannot reach a safe destination/);
 const cmd=observerCommand('dyl_is_here',line,'chat');
 assert.ok(cmd.startsWith('tellraw dyl_is_here '));
 assert.throws(()=>observerCommand('Turesla',line,'chat'));
 assert.equal(recommendedLevel({type:'navigation_impossibility_observed'}),'minimal');
});
test('unknown events are excluded from minimal human commentary',()=>{
 assert.equal(formatEvent({type:'spectator_effect'}),null);
 assert.equal(formatEvent({type:'target_transition'}),null);
 assert.equal(recommendedLevel({type:'target_transition'}),'verbose');
});
