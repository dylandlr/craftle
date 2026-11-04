// Isolate counterfactual action-set effects from value changes.
// Inputs are read-only score records from identical policy weights.
export function compareCandidateMenus(blockedScores,clearScores){
 if(!Array.isArray(blockedScores)||!Array.isArray(clearScores)||
  [...blockedScores,...clearScores].some(s=>typeof s.id!=='string'||
   !Number.isFinite(s.q)||typeof s.operation!=='string'))
  throw Error('Invalid candidate scores');
 const blocked=new Map(blockedScores.map(s=>[s.id,s]));
 const clear=new Map(clearScores.map(s=>[s.id,s]));
 if(blocked.size!==blockedScores.length||clear.size!==clearScores.length)
  throw Error('Duplicate candidate identifiers');
 const shared=[...blocked.keys()].filter(id=>clear.has(id));
 const onlyBlocked=[...blocked.keys()].filter(id=>!clear.has(id));
 const onlyClear=[...clear.keys()].filter(id=>!blocked.has(id));
 const best=scores=>scores.reduce((prev,row)=>
  !prev||row.q>prev.q?row:prev,null);
 const blockedShared=best(shared.map(id=>blocked.get(id)));
 const clearShared=best(shared.map(id=>clear.get(id)));
 const deltas=shared.map(id=>({
  id,operation:blocked.get(id).operation,
  blockedQ:blocked.get(id).q,clearQ:clear.get(id).q,
  deltaQ:blocked.get(id).q-clear.get(id).q
 }));
 return {
  sharedCount:shared.length,
  onlyBlockedCount:onlyBlocked.length,onlyClearCount:onlyClear.length,
  onlyBlockedOperations:onlyBlocked.map(id=>blocked.get(id).operation),
  onlyClearOperations:onlyClear.map(id=>clear.get(id).operation),
  fullMenuBlocked:best(blockedScores)?.operation??null,
  fullMenuClear:best(clearScores)?.operation??null,
  sharedMenuBlocked:blockedShared?.operation??null,
  sharedMenuClear:clearShared?.operation??null,
  sharedMenuSwitch:!!blockedShared&&!!clearShared&&
   blockedShared.id!==clearShared.id,
  maxAbsoluteSharedDelta:deltas.reduce((v,row)=>Math.max(v,Math.abs(row.deltaQ)),0),
  changedSharedScores:deltas.filter(row=>Math.abs(row.deltaQ)>1e-10).length,
  sharedDeltas:deltas
 };
}

// Diagnostic-only grounding check. Unlike policy preference scoring, it
// checks whether a candidate's preconditions remain supported by a newer
// observation. It does not select an action or supply an action sequence.
export function revalidateMotorCandidates(observation,candidates){
 if(typeof observation?.blockAt!=='function'||!Array.isArray(candidates))
  throw Error('Observation and candidates required');
 const at=observation.blockAt;
 const block=p=>p&&at(p.x,p.y,p.z);
 const solid=p=>block(p)?.boundingBox==='block';
 const empty=p=>block(p)?.boundingBox==='empty';
 return candidates.filter(c=>{
  if(!c?.executable)return false;
  if(c.operation==='dig')return solid(c.arguments?.position);
  if(c.operation==='place'){
   const q=c.evidence?.destination,r=c.arguments?.reference;
   return solid(r)&&empty(q)&&observation.inventory?.some(i=>
    i.name===c.arguments.itemName&&i.placeable&&i.count>0);
  }
  if(c.operation==='move'){
   const p=observation.position,a=c.arguments;
   if(!p||!a||Math.abs(a.dx??0)+Math.abs(a.dz??0)!==1||a.dy!==0)
    return false;
   const dest={x:p.x+a.dx,y:p.y,z:p.z+a.dz};
   return empty(dest)&&empty({...dest,y:dest.y+1});
  }
  return true;
 });
}
