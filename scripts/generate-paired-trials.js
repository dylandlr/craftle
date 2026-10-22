// Paired-world trial manifest: seed is a blocking factor, never the treatment.
import fs from 'node:fs';
const seeds=[12091,24083,36187,48109,60217];
const config=JSON.parse(fs.readFileSync('config.json','utf8'));
const treatments=[
 {id:'scripted_block_control',kind:'scripted',observation:'block_state',behavior:'navigate',agentCore:'goal_directed',policyFamily:'deterministic_rules'},
 ...config.agents.map(a=>({id:a.id,kind:'learned',observation:'first_person_rgb',behavior:'learned',agentCore:'goal_directed',policyFamily:'learned',cognition:a.cognition}))
];
const trials=seeds.flatMap(seed=>treatments.map(t=>({
 trialId:`seed_${seed}__${t.id}`,seed,treatment:t.id,kind:t.kind,
 observation:t.observation,behavior:t.behavior,agentCore:t.agentCore,policyFamily:t.policyFamily,worldMode:'isolated',
 worldVersion:config.version,spawn:{x:0,y:null,z:0,policy:'fixed_safe_spawn_to_be_resolved'},
 difficulty:'normal',gamemode:'survival',timeOfDay:1000,weather:'clear',
 durationSeconds:600,startingInventory:[],cognition:t.cognition??null,
 status:'planned',policyImplementationAvailable:t.kind==='scripted'
})));
const manifest={schemaVersion:1,design:'paired_seed_isolated',notes:[
 'Each trial requires a fresh Minecraft world; reusing a modified world invalidates matching.',
 'Seed equality alone does not fix spawn position, mob RNG, weather or terrain changes.',
 'All treatments must implement the same goal-directed agent interface (observe, updateBeliefs, selectGoal, plan, act, reflect).',
 'Learned-policy trials are planned only; no visual learner has been implemented.',
 'The scripted control uses privileged block-state observations and must be labeled as such.'
],seeds,treatments,trials};
fs.mkdirSync('experiments',{recursive:true});
fs.writeFileSync('experiments/paired-seeds.v1.json',JSON.stringify(manifest,null,2)+'\n');
console.log(`Planned ${trials.length} trials over ${seeds.length} seeds, ${treatments.length} treatments`);
