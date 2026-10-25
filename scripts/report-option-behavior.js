import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
export function summarizeOptionBehavior(events){
 const decisions=events.filter(e=>e.type==='option_decision');
 const transitions=events.filter(e=>e.type==='option_transition');
 const continuations=events.filter(e=>e.type==='option_continued');
 const actionCounts=Object.fromEntries(['eat','forage','explore','retreat'].map(a=>[a,decisions.filter(d=>d.action===a).length]));
 const endReasons={};
 for(const e of transitions)endReasons[e.reason??'unspecified']=(endReasons[e.reason??'unspecified']??0)+1;
 const choicesWithFoodInInventory=decisions.filter(e=>Array.isArray(e.features)&&e.features[2]===1).length;
 const choicesWithoutFoodInInventory=decisions.filter(e=>Array.isArray(e.features)&&e.features[2]===0).length;
 const foragesWhileEmpty=decisions.filter(e=>e.action==='forage'&&Array.isArray(e.features)&&e.features[2]===0).length;
 const exploresWhileEmpty=decisions.filter(e=>e.action==='explore'&&Array.isArray(e.features)&&e.features[2]===0).length;
 const observedMeals=events.filter(e=>e.type==='survival_reference_consumed').length;
 const actualFoodGains=events.filter(e=>e.type==='survival_reference_hunger_recovered').length;
 const hunts=events.filter(e=>e.type==='survival_reference_hunt').length;
 const deaths=events.filter(e=>e.type==='survival_reference_death').length;
 return {schema:'craftle.option-behavior.v1',decisions:decisions.length,transitions:transitions.length,continuations:continuations.length,actionCounts,transitionReasons:endReasons,foodDecisionContext:{choicesWithFoodInInventory,choicesWithoutFoodInInventory,foragesWhileEmpty,exploresWhileEmpty},observedMeals,actualFoodGains,hunts,deaths,competenceCaveat:'Action choices/hunts are attempts, not independently verified resource or survival success.'};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const events=fs.readFileSync(process.argv[2],'utf8').split('\n').filter(l=>l.startsWith('{"timestamp":')).map(l=>JSON.parse(l));
 console.log(JSON.stringify(summarizeOptionBehavior(events),null,2));
}
