import {test} from 'node:test';import assert from 'node:assert/strict';
import {correlateServerEvent} from '../src/server-observer-correlation.js';
const e={schema:'craftle.server-event.v1',serverRunId:'server1',tickIndex:120,playerUuid:'player1'};
const d={runId:'agent1',optionId:'option4',playerUuid:'player1'};
const ack={runId:'agent1',optionId:'option4',serverRunId:'server1',serverTick:100,playerUuid:'player1'};
test('without start handshake event is temporal only',()=>assert.equal(correlateServerEvent(e,d).status,'temporal_association_only'));
test('matching server ack gives bounded temporal link but no causation',()=>{const x=correlateServerEvent(e,d,ack);assert.equal(x.status,'temporally_within_option');assert.equal(x.elapsedTicks,20);assert.equal(x.causalProof,false)});
test('wrong player, server or option ID never correlate',()=>{assert.equal(correlateServerEvent({...e,playerUuid:'other'},d,ack).status,'different_player');assert.equal(correlateServerEvent(e,d,{...ack,optionId:'wrong'}).status,'temporal_association_only');assert.equal(correlateServerEvent(e,d,{...ack,serverRunId:'other'}).status,'temporal_association_only')});
test('pre-start event is not attributed to option',()=>assert.equal(correlateServerEvent({...e,tickIndex:99},d,ack).status,'precedes_option_start'));
