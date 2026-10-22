// Single-flight inference bridge from the RGB-only Node boundary to Python PyTorch.
import {spawn} from 'node:child_process';
import readline from 'node:readline';
import {policyInput} from './vision-observation.js';
import {validateAction} from './visual-policy.js';
export async function openTorchPolicy({checkpoint,python='python3'}){
  if(!checkpoint)throw Error('Checkpoint path required');
  const child=spawn(python,['-m','training.serve_visual_policy','--checkpoint',checkpoint],{stdio:['pipe','pipe','pipe']});
  const lines=readline.createInterface({input:child.stdout});
  const pending=[];
  let closed=false,ready=false;
  const failAll=error=>{closed=true;for(const p of pending.splice(0))p.reject(error);};
  child.on('error',failAll);child.on('exit',(code)=>failAll(Error('Policy process exited: '+code)));
  const waitReady=new Promise((resolve,reject)=>{
    pending.push({kind:'ready',resolve,reject});
  });
  lines.on('line',line=>{
    let message;
    try{message=JSON.parse(line);}catch{failAll(Error('Malformed policy response'));return;}
    const next=pending.shift();
    if(!next)return;
    if(message.error){next.reject(Error(message.error));return;}
    if(next.kind==='ready'){
      if(message.ready!==true){next.reject(Error('Policy did not become ready'));return;}
      ready=true;next.resolve();
    }else{
      try{
        if(message.frameId!==next.frameId)throw Error('Frame ID mismatch');
        next.resolve(validateAction(message.action));
      }catch(e){next.reject(e);}
    }
  });
  await waitReady;
  return {
    async predict(observation){
      if(closed||!ready)throw Error('Policy unavailable');
      if(pending.length)throw Error('Only one visual inference at a time');
      const input=observation?.source==='first_person_rgb'?policyInput(observation):observation;
      if(!(input?.rgb instanceof Uint8Array)||input.rgb.length!==input.width*input.height*3)throw Error('RGB24 policy input required');
      const response=new Promise((resolve,reject)=>pending.push({kind:'infer',frameId:input.frameId,resolve,reject}));
      child.stdin.write(JSON.stringify({frameId:input.frameId,width:input.width,height:input.height,rgbBase64:Buffer.from(input.rgb).toString('base64')})+'\n');
      return response;
    },
    close(){child.kill('SIGTERM');lines.close();}
  };
}
