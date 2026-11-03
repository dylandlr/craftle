// Versioned proposed survival skill contract. This is an audit/architecture artifact:
// do NOT silently add these labels to the v1 15-way DQN head.
// Status distinguishes wired execution from available Mineflayer APIs and gaps.
export const SURVIVAL_ACTION_SCHEMA='craftle.survival-actions.v2.proposal';
export const SURVIVAL_SKILLS=Object.freeze([
 {id:'explore',domain:'navigation',status:'wired_v1',effect:'discover region'},
 {id:'approach_entity',domain:'navigation',status:'wired_v1',effect:'move toward visible entity'},
 {id:'approach_block',domain:'navigation',status:'partially_wired',effect:'move to block reach'},
 {id:'retreat',domain:'navigation',status:'wired_v1',effect:'move away from detected threat'},
 {id:'look_scan',domain:'perception',status:'scripted_only',effect:'change view to gather observations'},
 {id:'jump',domain:'navigation',status:'unwired',effect:'jump over obstacle'},
 {id:'descend',domain:'navigation',status:'auxiliary_experimental',effect:'choose fall/step-down'},
 {id:'swim',domain:'navigation',status:'unwired',effect:'stay afloat and move in water'},
 {id:'climb',domain:'navigation',status:'unwired',effect:'ascend/descend climbable surface'},
 {id:'dig_block',domain:'resources',status:'partially_wired',effect:'mine or harvest a reachable block'},
 {id:'attack_entity',domain:'combat',status:'wired_v1',effect:'hit selected animal'},
 {id:'attack_hostile',domain:'combat',status:'unwired',effect:'defend against hostile mob'},
 {id:'collect_drop',domain:'resources',status:'partially_wired',effect:'approach and pick up dropped item'},
 {id:'eat_item',domain:'survival',status:'wired_v1',effect:'consume inventory food'},
 {id:'equip_item',domain:'inventory',status:'scripted_only',effect:'select tool, armor, or held item'},
 {id:'craft_item',domain:'technology',status:'unwired',effect:'craft eligible recipe using inventory/table'},
 {id:'place_block',domain:'construction',status:'unwired',effect:'place block at verified site'},
 {id:'use_block',domain:'interaction',status:'partially_wired',effect:'activate block or container'},
 {id:'open_container',domain:'inventory',status:'unwired',effect:'inspect container inventory'},
 {id:'transfer_item',domain:'inventory',status:'unwired',effect:'move items between inventories'},
 {id:'smelt_item',domain:'technology',status:'unwired',effect:'load fuel and input; collect output'},
 {id:'build_shelter',domain:'construction',status:'unwired',effect:'sequence block placements'},
 {id:'place_light',domain:'survival',status:'unwired',effect:'place light source'},
 {id:'sleep',domain:'survival',status:'unwired',effect:'use safe bed'},
 {id:'set_spawn',domain:'survival',status:'unwired',effect:'set local respawn point'},
 {id:'recover_stuck',domain:'navigation',status:'scripted_only',effect:'use local recovery primitives'},
 {id:'wait',domain:'control',status:'unwired',effect:'wait safely without unnecessary movement'}
]);
export const SURVIVAL_CAPABILITIES=Object.freeze({
 food:['explore','approach_entity','approach_block','dig_block','attack_entity','collect_drop','eat_item'],
 basicTools:['dig_block','collect_drop','craft_item','equip_item'],
 stoneAge:['dig_block','collect_drop','craft_item','equip_item','place_block'],
 overnight:['build_shelter','place_block','place_light','attack_hostile','eat_item','sleep'],
 traversal:['jump','descend','swim','climb','recover_stuck'],
 sustainedSurvival:['eat_item','attack_hostile','build_shelter','sleep','set_spawn']
});
export function auditSurvivalActionSpace(skills=SURVIVAL_SKILLS){
 const byId=new Map(skills.map(s=>[s.id,s]));
 const duplicateIds=skills.map(s=>s.id).filter((id,i,a)=>a.indexOf(id)!==i);
 const capabilityChecks=Object.fromEntries(Object.entries(SURVIVAL_CAPABILITIES).map(([name,requires])=>[
  name,{required:requires,missing:requires.filter(k=>!byId.has(k)),
   unwired:requires.filter(k=>byId.has(k)&&byId.get(k).status!=='wired_v1'),
   executable:requires.every(k=>byId.get(k)?.status==='wired_v1')}
 ]));
 return {schema:SURVIVAL_ACTION_SCHEMA,skillCount:skills.length,duplicateIds,
  capabilityChecks,fullyExecutable:Object.values(capabilityChecks).every(c=>c.executable),
  warning:'Proposed action contract; NOT plugged into the current DQN or guaranteed executable on Minecraft.'};
}
