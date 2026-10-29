import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeCanopyEvents} from '../scripts/report-canopy-episodes.js';
test('canopy report counts verified exits, censoring and unresolved separately',()=>{
 const events=[
  {type:'exploration_execution_variant',timestamp:'2026-10-29T00:00:00Z'},
  {type:'canopy_episode_started',episodeId:1,timestamp:'2026-10-29T00:00:01Z',startY:75,health:20,food:20},
  {type:'canopy_episode_exited',episodeId:1,timestamp:'2026-10-29T00:00:03Z',elapsedMs:2000,verticalDescent:4,health:20,food:20},
  {type:'canopy_episode_started',episodeId:2,timestamp:'2026-10-29T00:00:04Z',startY:75,health:19,food:10},
  {type:'canopy_episode_censored',episodeId:2,timestamp:'2026-10-29T00:00:06Z',reason:'death',elapsedMs:2000},
  {type:'canopy_episode_started',episodeId:3,timestamp:'2026-10-29T00:00:07Z',startY:76,health:20,food:20},
  {type:'canopy_episode_still_trapped',episodeId:3,timestamp:'2026-10-29T00:00:27Z',elapsedMs:20000}
 ];
 const r=summarizeCanopyEvents(events);
 assert.equal(r.episodes,3);assert.equal(r.verifiedExits,1);assert.equal(r.censored,1);
 assert.equal(r.unresolved,1);assert.equal(r.medianExitMs,2000);
 assert.equal(r.observedExitFraction,1/3);assert.deepEqual(r.observedHealthChanges,[0]);
});
test('report separates repeated episode ids across sessions and never invents missing starts',()=>{
 const r=summarizeCanopyEvents([
  {type:'exploration_execution_variant'},
  {type:'canopy_episode_started',episodeId:1},
  {type:'exploration_execution_variant'},
  {type:'canopy_episode_started',episodeId:1},
  {type:'canopy_episode_exited',episodeId:1,elapsedMs:1000,health:20},
  {type:'canopy_episode_exited',episodeId:7,elapsedMs:2000}
 ]);
 assert.equal(r.episodes,2);assert.equal(r.verifiedExits,1);assert.equal(r.unresolved,1);
 assert.equal(r.warnings.length,1);
});
