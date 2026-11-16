// Non-learning baseline: choose executable motor candidate nearest the supplied
// goal coordinates. This consumes the SAME goal and candidate geometry that the
// parametric Q network is given; no goalKey, hidden world, or task-label lookup.
const xyz=vector=>vector&&['x','y','z'].every(k=>
  Number.isFinite(vector[k]));

export function candidateTargetCoordinates(candidate){
  if(!candidate||!candidate.executable||!candidate.arguments)
    throw Error('Nonexecutable or missing action geometry');
  const args=candidate.arguments;
  let target;
  if(candidate.operation==='dig'){
    target=args.position;
  }else if(candidate.operation==='place'){
    const reference=args.reference,face=args.face;
    if(!xyz(reference)||!xyz(face)||
       !['x','y','z'].every(k=>Number.isInteger(face[k]))||
       Math.abs(face.x)+Math.abs(face.y)+Math.abs(face.z)!==1)
      throw Error('Invalid reference and face for placement');
    target={x:reference.x+face.x,y:reference.y+face.y,
      z:reference.z+face.z};
  }else throw Error('Unsupported action for coordinate-matching baseline');
  if(!xyz(target))throw Error('Missing candidate destination');
  return {x:target.x,y:target.y,z:target.z};
}

export function chooseByGoalCoordinates(observation,candidates){
  if(!xyz(observation?.goal)||!Array.isArray(candidates))
    throw Error('Goal and executable candidate list required');
  const rows=candidates.filter(c=>c?.executable).map(candidate=>{
    const target=candidateTargetCoordinates(candidate);
    const g=observation.goal;
    return {candidate,target,distanceSquared:
      (g.x-target.x)**2+(g.y-target.y)**2+(g.z-target.z)**2};
  });
  if(!rows.length)return {candidate:null,reason:'no_executable_candidates'};
  rows.sort((a,b)=>a.distanceSquared-b.distanceSquared);
  if(rows.length>1&&Math.abs(rows[0].distanceSquared-rows[1].distanceSquared)<1e-12)
    return {candidate:null,reason:'ambiguous_nearest_goal'};
  return {candidate:rows[0].candidate,
    distance:Math.sqrt(rows[0].distanceSquared),
    reason:'nearest_supplied_goal_coordinate'};
}
