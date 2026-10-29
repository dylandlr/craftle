// Passive canopy episode accounting. Observations never direct bot actions.
export function createCanopyOutcomeTracker({clock=Date.now,timeoutMs=20000}={}){
 let episode=null,serial=0;
 const sample=({position,underfoot,life,health,food})=>{
  if(!position||!Number.isFinite(position.y)||typeof underfoot!=='string')return [];
  const leaf=underfoot.includes('leaves'),now=clock(),events=[];
  if(episode&&episode.life!==life){events.push({type:'canopy_episode_censored',episodeId:episode.id,reason:'life_changed',elapsedMs:now-episode.start});episode=null;}
  if(leaf&&!episode){episode={id:++serial,life,start:now,y:position.y,minY:position.y,lastReport:now};events.push({type:'canopy_episode_started',episodeId:episode.id,startY:position.y,underfoot,health,food,learned:false});}
  if(!episode)return events;
  episode.minY=Math.min(episode.minY,position.y);
  if(!leaf){
   events.push({type:'canopy_episode_exited',episodeId:episode.id,elapsedMs:now-episode.start,verticalDescent:episode.y-position.y,underfoot,health,food,learned:false,evidence:'observed_nonleaf_footing_not_survival_success'});
   episode=null;
  }else if(now-episode.start>=timeoutMs&&now-episode.lastReport>=timeoutMs){
   episode.lastReport=now;
   events.push({type:'canopy_episode_still_trapped',episodeId:episode.id,elapsedMs:now-episode.start,maxObservedDescent:episode.y-episode.minY,underfoot,health,food,learned:false});
  }
  return events;
 };
 const reset=(reason='lifecycle_reset')=>{if(!episode)return [];const result=[{type:'canopy_episode_censored',episodeId:episode.id,reason,elapsedMs:clock()-episode.start}];episode=null;return result;};
 return {sample,reset};
}
