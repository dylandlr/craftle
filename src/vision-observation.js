// Strict RGB observation boundary for first-person learned policies.
// Renderer/decoder supplies frames. Never insert Mineflayer world or block objects.
export function makeVisualObservation({rgb,width,height,frameId,capturedAt,health=null,hunger=null}){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>1920||height>1920)throw Error('Invalid frame dimensions');
  if(!(rgb instanceof Uint8Array)||rgb.length!==width*height*3)throw Error('Expected packed RGB24 Uint8Array');
  if(!Number.isSafeInteger(frameId)||frameId<0)throw Error('Invalid frameId');
  if(typeof capturedAt!=='string'||!Number.isFinite(Date.parse(capturedAt)))throw Error('Invalid capturedAt');
  for(const [name,value] of [['health',health],['hunger',hunger]])if(value!==null&&(!Number.isFinite(value)||value<0))throw Error(`Invalid ${name}`);
  return Object.freeze({source:'first_person_rgb',frameId,capturedAt,width,height,rgb:Uint8Array.from(rgb),
    proprioception:Object.freeze({health,hunger})});
}
export function policyInput(observation){
  if(observation?.source!=='first_person_rgb')throw Error('Policy requires rendered RGB observation');
  const {rgb,width,height,frameId,capturedAt,proprioception}=observation;
  return Object.freeze({rgb:Uint8Array.from(rgb),width,height,frameId,capturedAt,proprioception});
}
