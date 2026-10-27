// Exploration candidate ranking for Craftle's optional v2 execution baseline.
// Uses Mineflayer's LOCAL block cache, never global map or external LLM knowledge.
export function scoreExplorationCandidate({origin,candidate,blockAt,failed=new Set()}){
 const key=[Math.floor(candidate.x),Math.floor(candidate.z)].join(',');
 if(failed.has(key))return {valid:false,reason:'previous_no_path',score:-Infinity};
 if(![origin.x,origin.z,candidate.x,candidate.z].every(Number.isFinite))return {valid:false,reason:'bad_position',score:-Infinity};
 const x=Math.floor(candidate.x),z=Math.floor(candidate.z);
 const y0=Math.floor(origin.y);
 let best=null;
 for(let y=y0+2;y>=y0-5;y--){
  const ground=blockAt(x,y-1,z),feet=blockAt(x,y,z),head=blockAt(x,y+1,z);
  if(!ground||!feet||!head)continue;
  const solid=ground.boundingBox==='block',empty=feet.boundingBox==='empty'&&head.boundingBox==='empty';
  if(!solid||!empty)continue;
  const leaves=ground.name?.includes('leaves')??false;
  const vertical=Math.abs(y-origin.y);
  const horizontal=Math.hypot(candidate.x-origin.x,candidate.z-origin.z);
  const score=horizontal*0.02-vertical*0.18-(leaves?2.5:0);
  if(!best||score>best.score)best={valid:true,position:{x,y,z},score,ground:ground.name,leaves};
 }
 return best??{valid:false,reason:'no_safe_cached_footing',score:-Infinity};
}
export function chooseGroundedExploreGoal({origin,blockAt,failed=new Set(),seed=0,distance=12}){
 const options=[];
 for(let i=0;i<12;i++){
  const angle=(seed+i)*2.399963229728653;
  const radius=distance*(0.7+(i%4)*.1);
  const candidate={x:origin.x+Math.cos(angle)*radius,z:origin.z+Math.sin(angle)*radius};
  const result=scoreExplorationCandidate({origin,candidate,blockAt,failed});
  if(result.valid)options.push(result);
 }
 options.sort((a,b)=>b.score-a.score);
 return {selected:options[0]??null,viableCandidates:options.length,totalCandidates:12};
}
