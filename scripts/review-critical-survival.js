// Offline, read-only diagnosis of the latest low-health / canopy stall.
// Does not issue Minecraft commands or modify a checkpoint.
import fs from 'node:fs';
const file=process.argv[2]??'/state/agent/continuous/agent.log';
const bytes=Math.max(1024,Math.min(Number(process.argv[3]??16777216)||16777216,67108864));
const fd=fs.openSync(file,'r');
let lines,start=0,size;
try {
 size=fs.fstatSync(fd).size;start=Math.max(0,size-bytes);
 const b=Buffer.alloc(size-start);fs.readSync(fd,b,0,b.length,start);
 lines=b.toString('utf8').split(/\r?\n/);
 if(start>0)lines.shift();
}finally{fs.closeSync(fd);}
const events=lines.flatMap(line=>{if(!line.trim().startsWith('{'))return [];
 try {const e=JSON.parse(line);return e&&e.type?[e]:[];}catch{return [];}});
const types=['target_decision','target_transition','target_action','target_navigation_stall',
 'navigation_immobility_audit','navigation_footing_diagnostic','canopy_geometry_snapshot',
 'canopy_egress_execution_audit','canopy_egress_no_route','canopy_egress_released',
 'canopy_stepdown_plan','canopy_stepdown_execution','canopy_risk_decision',
 'canopy_risk_candidate','canopy_risk_execution','canopy_risk_no_verified_adjacent_fall',
 'target_navigation_result','target_navigation_goal','target_runtime_error',
 'death_screen_observed','life_feedback_available','pose_sample'];
const last=(type)=>events.findLast(e=>e.type===type)??null;
const recent=(type,n=5)=>events.filter(e=>e.type===type).slice(-n);
const projection=e=>!e?null:({
 timestamp:e.timestamp,type:e.type,decisionId:e.decisionId??null,
 skill:e.skill??e.action??null,health:e.health??null,food:e.food??null,
 reason:e.reason??e.routeReason??e.outcome??null,
 stalls:e.stalls??null,selected:e.selected??e.waypoint??null,
 goal:e.goal??e.pathGoal??null,
 position:e.position??e.start??null,
 underfoot:e.underfoot??e.footMinusPointThree?.name??null,
 message:e.message??null});
const lastDecision=last('target_decision'),lastPose=last('pose_sample'),
 lastGeometry=last('canopy_geometry_snapshot');
const canopyEvents=events.filter(e=>e.type.startsWith('canopy_'));
const result={schema:'craftle.critical-survival-review.v1',readOnly:true,
 logFile:file,bytesRead:size-start,eventsRead:events.length,partialTail:start>0,
 latestEvent:projection(events.at(-1)),lastPose:projection(lastPose),
 lastDecision:projection(lastDecision),lastAction:projection(last('target_action')),
 lastTransition:projection(last('target_transition')),
 lastCanopyGeometry:lastGeometry?{
  timestamp:lastGeometry.timestamp,health:lastGeometry.health,food:lastGeometry.food,
  routeReason:lastGeometry.routeReason,selected:lastGeometry.selected,
  snapshotOrigin:lastGeometry.snapshot?.origin??null}:null,
 recentNavigationStalls:recent('target_navigation_stall').map(projection),
 recentImmobility:recent('navigation_immobility_audit',3).map(projection),
 recentCanopy:canopyEvents.slice(-12).map(projection),
 recentNavigationFailures:recent('target_navigation_result').map(projection),
 recentErrors:recent('target_runtime_error').map(projection),
 latestDeath:projection(last('death_screen_observed')),
 counts:Object.fromEntries(types.map(type=>[type,events.filter(e=>e.type===type).length])),
 caveats:[
  'This is a tail sample and may omit earlier decisions.',
  'A missing canopy_geometry_snapshot does not prove the agent is off a tree.',
  'A planned path does not prove movement; compare poses, stalls, and path results.',
  'No automatic recovery, damage, teleport, or mutation is performed.'
 ]};
console.log(JSON.stringify(result,null,2));
