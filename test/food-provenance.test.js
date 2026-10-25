import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';import {attachFoodProvenance} from '../src/food-provenance.js';
test('pickup and inventory changes record decision context without claiming causation',()=>{
 const bot=new EventEmitter();bot.entity={id:7};bot.inventory=new EventEmitter();let items=[];bot.inventory.items=()=>items;
 const events=[];let active={decisionId:9,skill:'harvest'};
 const p=attachFoodProvenance(bot,{log:e=>events.push(e),getDecision:()=>active,clock:()=>123});
 items=[{name:'carrot',count:2}];bot.inventory.emit('updateSlot');
 bot.emit('playerCollect',{id:7},{id:12,getDroppedItem:()=>({name:'carrot'})});
 assert.equal(events.filter(e=>e.type==='food_provenance_inventory_delta').length,1);
 assert.equal(events[0].decisionId,9);
 assert.equal(events[0].evidence,'client_inventory_observation_not_causal_proof');
 assert.equal(events[1].entityId,12);
 bot.emit('playerCollect',{id:8},{id:13});assert.equal(events.length,2);
 p.stop();items=[];bot.inventory.emit('updateSlot');assert.equal(events.length,2);
 assert.equal(bot.listenerCount('playerCollect'),0);
});
