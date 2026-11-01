import {test} from 'node:test';
import assert from 'node:assert/strict';
import {explainEvent,explanationChat} from '../scripts/observer-explainability.js';
test('explanation distinguishes DQN selection from actual learned motive',()=>{
 const x=explainEvent({type:'target_decision',decisionId:44,action:'explore',mode:'training',targets:[],
  mask:[false,true,true],features:[0,0,0,0,0,0,1]});
 assert.match(x.explanation.join(' '),/exact Q-value ranking requires decision_trace_v1/);
 assert.match(x.explanation.join(' '),/No target candidates/);
 assert.match(x.unknown,/does not establish why/);
});
test('no route evidence does not claim physical impossibility',()=>{
 const x=explainEvent({type:'connected_exploration_audit',reason:'no_known_connected_route',decisionId:44});
 assert.match(x.explanation.join(' '),/not proof/);
 assert.match(JSON.stringify(explanationChat(x)),/↳/);
});
test('an unexecuted choice is different from a failed movement',()=>{
 const x=explainEvent({type:'grounded_exploration_no_safe_goal'});
 assert.match(x.summary,/could not execute/);
});
test('generic sound events have no fabricated explanation',()=>{
 assert.equal(explainEvent({type:'spectator_effect',kind:'sound'}),null);
});
