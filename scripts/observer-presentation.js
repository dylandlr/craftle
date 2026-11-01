// Pure observer-only formatting. Never import into the Mineflayer agent.
export const C={muted:'gray',title:'aqua',good:'green',danger:'red',food:'gold',warn:'yellow',info:'white'};
export const part=(text,color='white',bold=false)=>({text:String(text),color,bold});
export function formatHud(s={}){
 const hp=Number.isFinite(s.health)?Math.max(0,Math.round(s.health*10)/10):'?';
 const food=Number.isFinite(s.food)?Math.max(0,Math.round(s.food*10)/10):'?';
 const action=String(s.action??'Observing').replaceAll('_',' ').slice(0,20);
 return {text:'',extra:[part('CRAFTLE  ',C.title,true),part('Turesla',C.info),part('  ·  ',C.muted),
  part(action,C.title),part('   ♥ ',C.danger),part(hp+'/20',C.danger),
  part('   🍗 ',C.food),part(food+'/20',C.food)]};
}
export function formatEvent(e){
 if(!e||typeof e.type!=='string')return null;
 const pieces=[];
 const lead=(label,color)=>pieces.push(part('CRAFTLE ',C.muted,true),part('› ',color),part(label,color,true));
 const detail=t=>pieces.push(part('  '+t,C.muted));
 switch(e.type){
  case 'target_decision':{
   if(!['explore','retreat','eat'].includes(e.action))return null;
   lead('Intent',C.title);
   detail(e.action==='explore'?'Looking for a way forward':e.action==='retreat'?'Trying to move away from danger':'Looking for food');
   break;
  }
  case 'connected_exploration_audit':
  case 'connected_retreat_audit':
   if(e.reason!=='no_known_connected_route')return null;
   lead('Path blocked',C.warn);detail('No connected route found; objective may need reconsideration');break;
  case 'navigation_requires_nonwalking_recovery':
   lead('Recovery needed',C.warn);detail('Walking routes did not succeed');break;
  case 'navigation_impossibility_observed':
   lead('Navigation stalled',C.warn);detail('Current planner cannot reach a safe destination');break;
  case 'navigation_recovery_attempt':
   lead('Testing alternative',C.title);detail(String(e.method??'recovery').replaceAll('_',' '));break;
  case 'navigation_recovery_outcome':
   lead(e.result==='observed_recovery_progress'?'Progress observed':'Still blocked',e.result==='observed_recovery_progress'?C.good:C.warn);
   detail(e.result==='observed_recovery_progress'?'A new route or movement was observed':'Recovery did not restore movement');break;
  case 'target_consumed':
   lead('Ate food',C.good);detail(String(e.item??'item'));break;
  case 'target_verified_recovery':
   lead('Hunger recovered',C.good);break;
  case 'death_screen_observed':
   lead('Turesla died',C.danger);break;
  case 'target_runtime_error':
   lead('Action error',C.danger);detail(String(e.message??'unknown').slice(0,72));break;
  case 'target_navigation_stall':
   lead('No progress',C.warn);detail('Movement has stopped; checking routes');break;
  default:return null;
 }
 return {text:'',extra:pieces};
}
export function observerCommand(viewer,component,channel='chat'){
 if(!/^[a-zA-Z0-9_]{3,16}$/.test(viewer)||viewer==='Turesla')throw Error('Unsafe spectator recipient');
 if(!['chat','actionbar'].includes(channel))throw Error('Invalid channel');
 return channel==='chat'?'tellraw '+viewer+' '+JSON.stringify(component):
  'title '+viewer+' actionbar '+JSON.stringify(component);
}
export function recommendedLevel(event){
 if(['death_screen_observed','target_consumed','navigation_impossibility_observed','navigation_recovery_outcome'].includes(event?.type))return 'minimal';
 if(['connected_exploration_audit','connected_retreat_audit','navigation_requires_nonwalking_recovery','target_navigation_stall','target_runtime_error'].includes(event?.type))return 'normal';
 return 'verbose';
}
