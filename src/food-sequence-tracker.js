// Evidence-only tracking for attempted food-acquisition chains.
// This observes policy intent and verified observations; it never picks actions.
export function createFoodSequenceTracker({log=()=>{},clock=Date.now,timeoutMs=120000}={}){
 let current=null,serial=0;
 const emit=(type,extra={})=>log({type,sequenceId:current?.id??null,...extra});
 const clear=(reason)=>{if(current){emit('food_sequence_finished',{status:reason,stages:current.stages.slice(),targetId:current.targetId});current=null;}};
 return {
  decision(choice){
   const skill=choice?.skill,targetId=choice?.targetId??null;
   if(current&&clock()-current.started>timeoutMs)clear('timeout');
   if(skill==='approach'&&targetId){
    if(!current||current.targetId!==targetId){
     clear('target_changed');
     current={id:++serial,targetId,started:clock(),stages:['approach'],foodObserved:false};
     emit('food_sequence_started',{targetId,decisionId:choice.decisionId});
    }
   }else if(current&&['harvest','attack'].includes(skill)&&targetId===current.targetId){
    if(!current.stages.includes(skill))current.stages.push(skill);
    emit('food_sequence_attempt',{skill,targetId,decisionId:choice.decisionId});
   }else if(current&&skill==='eat'){
    if(!current.stages.includes('eat'))current.stages.push('eat');
   }
  },
  inventory({before,after}={}){
   if(!current||!Number.isFinite(before)||!Number.isFinite(after)||after<=before)return;
   current.foodObserved=true;
   if(!current.stages.includes('inventory_gain'))current.stages.push('inventory_gain');
   emit('food_sequence_inventory_gain',{before,after,delta:after-before,evidence:'observed_not_causal_proof'});
  },
  consumed({before,after,decisionId}={}){
   if(!current||!Number.isFinite(before)||!Number.isFinite(after)||after<=before)return;
   emit('food_sequence_recovery',{decisionId,beforeFood:before,afterFood:after,
      status:current.foodObserved?'sequence_with_observed_inventory_gain':'sequence_without_observed_inventory_gain',
      stages:[...current.stages],evidence:'verified_hunger_recovery_not_complete_causal_chain'});
   clear('recovery_observed');
  },
  death(){clear('death');},
  stop(){clear('stopped');}
 };
}
