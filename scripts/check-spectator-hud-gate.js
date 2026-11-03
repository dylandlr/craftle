// Read-only analysis of sequential baseline/spectator RCON samples.
// This is an observational gate, NOT proof of causal non-interference.
import fs from 'node:fs';
import path from 'node:path';
function load(file){
 if(!fs.existsSync(file))throw new Error('Missing phase file: '+file);
 const rows=fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean).map((line,i)=>{
  try{return JSON.parse(line);}catch{throw new Error('Malformed JSON in '+file+' line '+(i+1));}
 });
 if(!rows.length)throw new Error('Empty phase file: '+file);
 return rows;
}
export function assessObserverSamples({baseline,spectator,camera='dyl_is_here',agent='Turesla'}){
 const checks=[];
 for(const [phase,rows,expectedCamera] of [['baseline',baseline,false],['spectator',spectator,true]]){
  checks.push({name:phase+'_sample_count',pass:rows.length===24,observed:rows.length});
  const ids=rows.map(r=>r.sample);
  checks.push({name:phase+'_sample_sequence',pass:ids.length===new Set(ids).size&&ids.every((v,i)=>v===i),observed:ids});
  checks.push({name:phase+'_player_presence',pass:rows.every(r=>{
   const s=r.responses?.list??'';
   const matched=s.match(/players online:\s*(.*)$/i);
   if(!matched)return false;
   const players=matched[1].split(',').map(x=>x.trim());
   return players.includes(agent)&&players.includes(camera)===expectedCamera;
  }),observed:[...new Set(rows.map(r=>r.responses?.list??'missing'))]});
  checks.push({name:phase+'_spectatorsGenerateChunks_false',
   pass:rows.every(r=>String(r.responses?.['gamerule spectatorsGenerateChunks']??'').endsWith('false')),
   observed:[...new Set(rows.map(r=>r.responses?.['gamerule spectatorsGenerateChunks']??'missing'))]});
 }
 const mobTypes=['zombie','skeleton','creeper','cow','pig','sheep'];
 const means=rows=>Object.fromEntries(mobTypes.map(mob=>{
  const k='execute at '+agent+' if entity @e[type=minecraft:'+mob+',distance=..64]';
  const numbers=rows.map(r=>{const s=String(r.responses?.[k]??'');const m=s.match(/count:\s*(\d+)/);return m?Number(m[1]):0;});
  return [mob,Number((numbers.reduce((a,b)=>a+b,0)/numbers.length).toFixed(2))];
 }));
 const before=means(baseline),after=means(spectator);
 const mobComparison=mobTypes.map(mob=>({mob,baseline:before[mob],spectator:after[mob],
  delta:Number((after[mob]-before[mob]).toFixed(2))}));
 const sampleChecksPassed=checks.every(c=>c.pass);
 return {schema:'craftle.observer-hud-gate.v1',readOnly:true,
  conditionsValid:sampleChecksPassed,
  verdict:sampleChecksPassed?'observational_conditions_valid_causality_unverified':'invalid_conditions',
  promotion:{readOnlyLogHud:'eligible_for_separate_functional_test',nativeClientHud:'requires_version_and_render_verification',
   fullHotbarHunger:'requires_server_support_not_available_on_vanilla',
   liveObserverOnPersistent:'blocked_pending_replicated_isolation_evidence'},
  checks,mobComparison,limitations:[
   'Sequential trials use a changing world and agent location; mob differences are not spectator effects.',
   'No loaded-chunk, tick, packet or spawn-attempt instrumentation in these RCON samples.',
   'Unit tests do not verify Minecraft client rendering or SpectatorPlus mod compatibility.',
   'No code here issues RCON commands or modifies the running agent or server.'
  ]};
}
export function runObserverHudGate(dir){
 return assessObserverSamples({baseline:load(path.join(dir,'baseline.jsonl')),spectator:load(path.join(dir,'spectator.jsonl'))});
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:\/)/,''))){
 try{
  const dir=process.argv[2];
  if(!dir)throw new Error('Usage: node scripts/check-spectator-hud-gate.js <phase-directory>');
  const result=runObserverHudGate(path.resolve(dir));
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
  if(!result.conditionsValid)process.exitCode=1;
 }catch(e){process.stderr.write(e.message+'\n');process.exitCode=1;}
}
