import test from 'node:test';
import assert from 'node:assert/strict';
import {TREATMENT_CONTRACTS,validateTreatmentSpec,comparableTreatments} from '../src/experiment-contract.js';
const make=(treatment,more={})=>({treatment,...TREATMENT_CONTRACTS[treatment],checkpointId:'none',datasetId:'none',worldSeed:'19',minecraftServer:'PAPER',minecraftVersion:'1.21.1',gitSha:'abcd',...more});
test('scratch learning contract accepts no imported weights',()=>{assert.equal(validateTreatmentSpec(make('scratch-targeted')).origin,'random-initialization');assert.throws(()=>validateTreatmentSpec(make('scratch-targeted',{pretrainedCheckpoint:true})),/pretrained/);});
test('human demos require dataset sha and separate prior label',()=>{assert.throws(()=>validateTreatmentSpec(make('video-bc')),/dataset provenance/);assert.equal(validateTreatmentSpec(make('video-bc',{datasetManifestSha256:'sha'})).origin,'human-demonstrations');});
test('LLM and Voyager require model and token allowance',()=>{assert.throws(()=>validateTreatmentSpec(make('llm-visual')),/token budget/);assert.throws(()=>validateTreatmentSpec(make('voyager-native',{modelId:'x',tokenBudget:100,matchedInterface:true})),/cannot be represented/);});
test('matched comparisons flag sensors and actions instead of equating unlike controls',()=>{const a=make('scratch-options'),b=make('scripted');assert.equal(comparableTreatments(a,b).matched,true);assert.deepEqual(comparableTreatments(a,make('video-bc',{datasetManifestSha256:'sha'})).mismatches,['sensors','actions']);});
