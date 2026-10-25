import {createHash} from 'node:crypto';
export const DEMONSTRATION_SCHEMA='craftle.demonstration.v1';
const hash=v=>createHash('sha256').update(v).digest('hex');
export function validateDemonstrationSample(sample){
 if(!sample||sample.schema!==DEMONSTRATION_SCHEMA)throw Error('Invalid demonstration schema');
 if(!['measured-human-input','inverse-dynamics-pseudo','video-only'].includes(sample.labelSource))throw Error('Invalid action-label provenance');
 for(const key of ['datasetId','sessionId','playerPseudonym','worldId','videoSha256'])if(typeof sample[key]!=='string'||!sample[key])throw Error('Missing '+key);
 if(!Number.isSafeInteger(sample.frameId)||sample.frameId<0||!Number.isFinite(sample.frameTimestampMs)||sample.frameTimestampMs<0)throw Error('Invalid frame clock');
 if(sample.labelSource==='video-only'&&sample.action!==null)throw Error('Unlabeled video must not assert a measured action');
 if(sample.labelSource!=='video-only'&&(!sample.action||typeof sample.action!=='object'))throw Error('Action-labeled sample needs action');
 if(sample.labelSource==='inverse-dynamics-pseudo'&&(!Number.isFinite(sample.confidence)||sample.confidence<0||sample.confidence>1))throw Error('Pseudo label requires calibrated confidence');
 if(sample.labelSource==='measured-human-input'&&(!Number.isFinite(sample.actionTimestampMs)||Math.abs(sample.actionTimestampMs-sample.frameTimestampMs)>1000))throw Error('Measured input requires nearby synchronized timestamp');
 return Object.freeze({...sample,provenanceHash:hash(JSON.stringify(sample))});
}
export function partitionHumanDemonstrations(samples,{heldoutPlayers=[],heldoutWorlds=[]}={}){
 const train=[],heldout=[];
 for(const sample of samples){
  const item=validateDemonstrationSample(sample);
  (heldoutPlayers.includes(item.playerPseudonym)||heldoutWorlds.includes(item.worldId)?heldout:train).push(item);
 }
 const trainSessions=new Set(train.map(x=>x.sessionId));
 const heldoutSessions=new Set(heldout.map(x=>x.sessionId));
 for(const id of heldoutSessions)if(trainSessions.has(id))throw Error('Recording session contamination');
 const trainVideos=new Set(train.map(x=>x.videoSha256));
 for(const item of heldout)if(trainVideos.has(item.videoSha256))throw Error('Video overlap across train and evaluation');
 return {train,heldout};
}
export function behaviorCloningSamples(samples,{allowPseudo=false}={}){
 return samples.map(validateDemonstrationSample).filter(s=>s.labelSource==='measured-human-input'||(allowPseudo&&s.labelSource==='inverse-dynamics-pseudo'));
}
