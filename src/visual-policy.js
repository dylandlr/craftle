// Policy transport independent of Minecraft internals.
// The only sensory input allowed at this boundary is a validated RGB observation.
import {policyInput} from './vision-observation.js';
export const ACTIONS=Object.freeze(['idle','forward','back','left','right','jump','look_left','look_right']);
export function validateAction(action){
  if(!ACTIONS.includes(action))throw Error(`Unsupported visual policy action: ${action}`);
  return action;
}
export async function evaluateVisualPolicy(policy,observation){
  if(typeof policy?.predict!=='function')throw Error('Visual policy requires predict(input)');
  const input=policyInput(observation);
  const action=validateAction(await policy.predict(input));
  return Object.freeze({frameId:input.frameId,capturedAt:input.capturedAt,action,source:input.source??'first_person_rgb'});
}
export function applyVisualAction(bot,action){
  validateAction(action);
  bot.clearControlStates();
  const controls={forward:'forward',back:'back',left:'left',right:'right',jump:'jump'};
  if(controls[action])bot.setControlState(controls[action],true);
  if(action==='look_left'||action==='look_right'){
    if(!bot.entity)throw Error('Cannot look before spawn');
    const delta=action==='look_left'?-Math.PI/12:Math.PI/12;
    return bot.look(bot.entity.yaw+delta,bot.entity.pitch);
  }
}
