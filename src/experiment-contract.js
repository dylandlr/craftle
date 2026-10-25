// Cross-treatment research boundaries. Does not execute models or expose Mineflayer internals.
export const EXPERIMENT_CONTRACT_VERSION='craftle.experiment-contract.v1';
export const KNOWLEDGE_ORIGINS=Object.freeze(['random-initialization','human-demonstrations','pretrained-language-prior','hand-coded-controller']);
export const SENSOR_CONTRACTS=Object.freeze(['rgb-self-v1','structured-options7-v1','targeted44-v1','privileged-mineflayer-v1']);
export const ACTION_CONTRACTS=Object.freeze(['motor-controls-v1','assisted-options4-v1','targeted-actions15-v1','voyager-code-v1']);
export const TREATMENT_CONTRACTS=Object.freeze({
  'scratch-options':{origin:'random-initialization',sensors:'structured-options7-v1',actions:'assisted-options4-v1',learning:'online-rl'},
  'scratch-targeted':{origin:'random-initialization',sensors:'targeted44-v1',actions:'targeted-actions15-v1',learning:'online-rl'},
  'video-bc':{origin:'human-demonstrations',sensors:'rgb-self-v1',actions:'motor-controls-v1',learning:'supervised-imitation'},
  'video-bc-rl':{origin:'human-demonstrations',sensors:'rgb-self-v1',actions:'motor-controls-v1',learning:'imitation-plus-online-rl'},
  'scripted':{origin:'hand-coded-controller',sensors:'structured-options7-v1',actions:'assisted-options4-v1',learning:'none'},
  'llm-visual':{origin:'pretrained-language-prior',sensors:'rgb-self-v1',actions:'motor-controls-v1',learning:'in-context'},
  'voyager-native':{origin:'pretrained-language-prior',sensors:'privileged-mineflayer-v1',actions:'voyager-code-v1',learning:'in-context'}
});
const str=v=>typeof v==='string'&&v.trim().length>0;
export function validateTreatmentSpec(spec){
 if(!spec||typeof spec!=='object'||Array.isArray(spec))throw Error('Treatment spec must be object');
 const expected=TREATMENT_CONTRACTS[spec.treatment];
 if(!expected)throw Error('Unknown treatment '+String(spec.treatment));
 for(const [key,value] of Object.entries(expected))if(spec[key]!==value)throw Error('Treatment '+spec.treatment+' incompatible '+key);
 for(const key of ['checkpointId','datasetId','worldSeed','minecraftServer','minecraftVersion','gitSha'])if(!str(spec[key]))throw Error('Missing '+key);
 if(spec.treatment==='voyager-native'&&spec.matchedInterface===true)throw Error('Native Voyager cannot be represented as matched experiment');
 if(spec.origin==='human-demonstrations'&&!str(spec.datasetManifestSha256))throw Error('Human video policy requires dataset provenance');
 if(spec.origin==='pretrained-language-prior'&&(!str(spec.modelId)||!Number.isFinite(spec.tokenBudget)||spec.tokenBudget<=0))throw Error('Pretrained language model requires model and token budget');
 if(spec.origin==='random-initialization'&&spec.pretrainedCheckpoint===true)throw Error('Random initialization cannot import pretrained checkpoint');
 return Object.freeze({...spec,contractVersion:EXPERIMENT_CONTRACT_VERSION});
}
export function comparableTreatments(a,b){
 const x=validateTreatmentSpec(a),y=validateTreatmentSpec(b);
 const fields=['sensors','actions','minecraftServer','minecraftVersion','worldSeed'];
 const mismatches=fields.filter(field=>x[field]!==y[field]);
 return {matched:mismatches.length===0,mismatches,knowledgePriorDifferent:x.origin!==y.origin};
}
