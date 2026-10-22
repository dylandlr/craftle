// Immutable demonstration recorder for visual imitation-learning datasets.
// Stores exactly what the visual policy consumed, with no privileged world state.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {policyInput} from './vision-observation.js';
import {validateAction} from './visual-policy.js';
export function createVisualDatasetWriter(root){
  if(!root)throw Error('Dataset directory required');
  fs.mkdirSync(root,{recursive:true});
  const frames=path.join(root,'frames');
  fs.mkdirSync(frames,{recursive:true});
  const manifest=path.join(root,'decisions.jsonl');
  let lastFrame=-1;
  return {
    append(observation,action,{policy='unknown',episode='single-agent'}={}){
      const image=policyInput(observation);
      validateAction(action);
      if(image.frameId<=lastFrame)throw Error('Frame IDs must increase within dataset');
      lastFrame=image.frameId;
      const sha256=createHash('sha256').update(image.rgb).digest('hex');
      const filename=`frame_${String(image.frameId).padStart(7,'0')}_${sha256.slice(0,12)}.rgb`;
      fs.writeFileSync(path.join(frames,filename),image.rgb,{flag:'wx'});
      const entry={schemaVersion:1,episode,frameId:image.frameId,capturedAt:image.capturedAt,
        image:`frames/${filename}`,pixelFormat:'RGB24',width:image.width,height:image.height,
        sha256,action,policy,observationSource:'first_person_rgb'};
      fs.appendFileSync(manifest,JSON.stringify(entry)+'\n');
      return entry;
    }
  };
}
