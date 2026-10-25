import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
export const TREATMENTS=['random','scripted','broad-dqn','targeted-dqn','craftle-llm','voyager-native','voyager-adapted'];
export function validateComparisonManifest(m){
 if(!m||m.schema!=='craftle.comparison.v1')throw Error('Invalid comparison schema');
 if(!TREATMENTS.includes(m.treatment))throw Error('Unknown treatment');
 for(const key of ['runId','gitSha','serverType','minecraftVersion','observationContract','actionContract','worldSeed','startingStateHash','policyProvenance']){
  if(typeof m[key]!=='string'||!m[key].trim())throw Error('Missing '+key);
 }
 if(!['PAPER','VANILLA','FABRIC','NEOFORGE'].includes(m.serverType))throw Error('Unknown server type');
 if(!Number.isFinite(m.episodeSeconds)||m.episodeSeconds<=0)throw Error('Invalid duration');
 const llm=['craftle-llm','voyager-native','voyager-adapted'].includes(m.treatment);
 if(llm&&(!m.modelIdentifier||m.pretrainingDisclosure!=='pretrained-language-prior'||!Number.isFinite(m.maxTokens)||m.maxTokens<=0))throw Error('Incomplete LLM provenance/budget');
 if(m.treatment==='voyager-native'&&m.matchedInterface===true)throw Error('Unmodified Voyager is external reference, not matched interface');
 if(m.treatment==='voyager-adapted'&&(!m.portCommit||!Array.isArray(m.portDeviations)))throw Error('Adapted Voyager requires explicit port provenance');
 if(!llm&&m.pretrainingDisclosure==='pretrained-language-prior')throw Error('Contaminated non-LLM treatment');
 return {valid:true,treatment:m.treatment,comparisonFamily:m.treatment==='voyager-native'?'native-external':m.matchedInterface?'matched':'asymmetric'};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const value=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
 console.log(JSON.stringify(validateComparisonManifest(value)));
}
