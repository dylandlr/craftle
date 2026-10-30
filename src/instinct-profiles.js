// Declarative, auditable initial-knowledge treatments. This module does NOT
// autonomously execute Minecraft actions or secretly provide recipes to the policy.
// Separate "knowledge available" from "learned behavior" in all experiments.
export const INSTINCT_SCHEMA='craftle.instinct-profile.v1';
const profiles={
 tabula_rasa:{facts:[],affordances:[],goals:[]},
 survival:{facts:['hunger_changes_with_time','health_loss_is_undesirable','some_items_are_consumable'],
   affordances:['consume_inventory_item','avoid_local_hazard'],goals:['maintain_food','maintain_health']},
 crafting:{facts:['crafting_combines_inventory_inputs','recipes_have_input_output_relationships'],
   affordances:['inspect_crafting_interface','attempt_recipe'],goals:[]},
 pickaxe:{facts:['crafting_combines_inventory_inputs','recipes_have_input_output_relationships',
   'pickaxe_recipe_known','pickaxe_is_a_tool'],
   affordances:['inspect_crafting_interface','attempt_recipe'],goals:['obtain_pickaxe']},
 survival_pickaxe:{facts:['hunger_changes_with_time','health_loss_is_undesirable','some_items_are_consumable',
  'crafting_combines_inventory_inputs','recipes_have_input_output_relationships',
  'pickaxe_recipe_known','pickaxe_is_a_tool'],
  affordances:['consume_inventory_item','avoid_local_hazard','inspect_crafting_interface','attempt_recipe'],
  goals:['maintain_food','maintain_health','obtain_pickaxe']}
};
export const INSTINCT_PROFILES=Object.freeze(Object.keys(profiles));
export function makeInstinctProfile(name='tabula_rasa'){
 if(!Object.hasOwn(profiles,name))throw Error('Unsupported instinct profile: '+name);
 const p=profiles[name];
 return Object.freeze({schema:INSTINCT_SCHEMA,id:name,knowledgeSource:'inherited_initial_knowledge',
  facts:Object.freeze([...p.facts]),affordances:Object.freeze([...p.affordances]),goals:Object.freeze([...p.goals])});
}
export function validateInstinctTreatment({profile,observationSchema,actionSchema,seed,policyCheckpoint}){
 if(!INSTINCT_PROFILES.includes(profile))throw Error('Unknown instinct profile');
 if(!observationSchema||!actionSchema)throw Error('Record observation and action schema');
 if(!Number.isInteger(seed))throw Error('Seed must be integer');
 if(!policyCheckpoint)throw Error('Record the starting policy checkpoint');
 return {schema:'craftle.instinct-treatment.v1',profile:makeInstinctProfile(profile),
  observationSchema,actionSchema,seed,policyCheckpoint,
  implementationStatus:'contract_only_not_connected_to_learning_policy'};
}
