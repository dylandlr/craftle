// Deterministic outcome bookkeeping. Attribution means 'observed during the
// registered option interval', NOT proof an option caused an entity event.
export function createOutcomeLedger({emit=()=>{}}={}){
 let life=0,sequence=0,active=null;
 const seen=new Set();
 const report=(kind,details)=>{const event={schema:'craftle.outcome.v1',kind,life,sequence:++sequence,...details};emit(event);return event;};
 return {
  begin(option){
   if(!['eat','forage','explore','retreat'].includes(option))throw Error('Invalid option');
   if(active?.option===option)return active.id;
   if(active)report('option_ended',{optionId:active.id,option:active.option,reason:'switched'});
   active={id:`${life}:${++sequence}`,option};
   report('option_started',{optionId:active.id,option});
   return active.id;
  },
  observe(type,data={}){
   if(!active)return null;
   const allowed={
    survival_reference_hunt:'attack_issued',
    survival_reference_food_damage_observed:'target_damaged',
    survival_reference_food_death_observed:'target_death_observed',
    survival_reference_item_pickup_observed:'item_pickup_observed',
    survival_reference_consumed:'food_consumed_observed',
    survival_reference_plant_harvest:'plant_interaction_issued',
    survival_reference_navigation_outcome:'navigation_result'
   };
   const stage=allowed[type];if(!stage)return null;
   // An attempted attack, an unknown-source death, or a generic item pickup
   // does not prove that the selected option caused the outcome.
   const evidence=stage==='food_consumed_observed'
      ?Number(data.afterFood)>Number(data.beforeFood)?'verified_hunger_recovery':'consumption_without_verified_recovery'
      :stage==='target_damaged'&&data.attribution!=='self'?'unattributed_damage'
      :stage==='target_death_observed'?'unattributed_death'
      :stage==='item_pickup_observed'?'inventory_pickup_observed_not_source_proven'
      :stage==='attack_issued'||stage==='plant_interaction_issued'?'attempt_only'
      :'observed_event';
   const key=[life,active.id,stage,data.entityId??'',data.item??'',data.beforeFood??'',data.afterFood??''].join(':');
   if(seen.has(key))return null;
   seen.add(key);
   return report('option_outcome',{optionId:active.id,option:active.option,stage,evidence,sourceEvent:type,entityId:data.entityId??null});
  },
  end(reason='completed'){if(!active)return null;const result=report('option_ended',{optionId:active.id,option:active.option,reason});active=null;return result;},
  death(){this.end('death');life++;seen.clear();},
  respawn(){this.end('respawn');life++;seen.clear();},
  snapshot(){return {life,active:active?{...active}:null};}
 };
}
