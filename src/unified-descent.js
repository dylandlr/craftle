// Unified, local-observation descent decision contract.
// No teleports, hidden map information, or claim that an identified route is executable.
// Coordinates describe block cells; projected fall risk is deliberately conservative.
const DIRECTIONS=[[1,0],[-1,0],[0,1],[0,-1]];
const HAZARD=/lava|fire|magma|cactus|campfire|powder_snow|sweet_berry_bush/;
const UNSTABLE=/sand|gravel|concrete_powder|scaffolding/;
const liquid=b=>Boolean(b?.name?.includes('water'));
const empty=b=>Boolean(b&&b.boundingBox==='empty'&&!HAZARD.test(b.name??'')&&!liquid(b));
const solid=b=>Boolean(b&&b.boundingBox==='block'&&!HAZARD.test(b.name??'')&&!UNSTABLE.test(b.name??''));
const climbable=b=>Boolean(b&&/ladder|vine|scaffolding/.test(b.name??'')&&!HAZARD.test(b.name??''));
const water=b=>liquid(b)&&!HAZARD.test(b?.name??'');
function riskForDrop(drop,{waterLanding=false,mitigation=false}={}){
 // Vanilla approximate loss: max(0, fallDistance-3); conservative margin below.
 if(waterLanding)return 0;
 if(mitigation)return Math.max(0,drop-3);
 return Math.max(0,drop-2);
}
export const DESCENT_PLAN_SCHEMA='craftle.descent-plan.v1';
export function planDescent({position,health=20,blockAt,maxDrop=12,
 allowRisk=false,inventory=[],failed=new Set()}={}){
 if(!position||![position.x,position.y,position.z,health].every(Number.isFinite)||
   health<=0||typeof blockAt!=='function')return {schema:DESCENT_PLAN_SCHEMA,selected:null,reason:'missing_observation'};
 const x=Math.floor(position.x),y=Math.floor(position.y),z=Math.floor(position.z);
 const at=(a,b,c)=>blockAt(a,b,c);
 const originFooting=at(x,y-1,z);
 if(!originFooting)return {schema:DESCENT_PLAN_SCHEMA,selected:null,reason:'unknown_origin_footing'};
 const options=[],rejections={unknown:0,hazard:0,blocked:0,unsafeFall:0,failed:0};
 const add=(o)=>{const key=[o.kind,o.x,o.y,o.z].join(':');if(failed.has(key))rejections.failed++;else options.push({...o,key});};
 for(const [dx,dz] of DIRECTIONS){
  const nx=x+dx,nz=z+dz;
  const neighborFeet=at(nx,y,nz),neighborHead=at(nx,y+1,nz);
  if(!neighborFeet||!neighborHead){rejections.unknown++;continue;}
  if(HAZARD.test(neighborFeet.name??'')||HAZARD.test(neighborHead.name??'')){
   rejections.hazard++;continue;
  }
  if(climbable(neighborFeet)||climbable(at(nx,y-1,nz))){
   const lower=at(nx,y-1,nz),lowerHead=at(nx,y,nz);
   if(lower&&lowerHead&&climbable(lower)&&!HAZARD.test(lowerHead.name??''))
    add({kind:'climb_down',x:nx,y:y-1,z:nz,dx,dz,expectedDamage:0,verified:true,requires:'climb_executor'});
  }
  // A truly one-block lower solid standable floor. This is a safe locomotion primitive,
  // not proof that the live Minecraft pathfinder can reach the coordinate.
  const floor=at(nx,y-2,nz),landingFeet=at(nx,y-1,nz);
  if(solid(floor)&&empty(landingFeet)&&empty(neighborFeet)&&empty(neighborHead)){
   add({kind:'step_down',x:nx,y:y-1,z:nz,dx,dz,drop:1,
    expectedDamage:0,verified:true,requires:'short_step_executor'});
  }
  if(!empty(neighborFeet)||!empty(neighborHead)){
   rejections.blocked++;continue;
  }
  // Full drop candidates: require an observed shaft and floor; never infer unknown
  // chunk terrain. Water and climb require separate actuators and outcome checks.
  let traversed=true;
  for(let drop=2;drop<=maxDrop;drop++){
   const landingY=y-drop,feet=at(nx,landingY,nz),
     head=at(nx,landingY+1,nz),base=at(nx,landingY-1,nz);
   if(!feet||!head||!base){rejections.unknown++;break;}
   if(HAZARD.test(feet.name??'')||HAZARD.test(base.name??'')){
    rejections.hazard++;break;
   }
   if(water(feet)&&solid(base)){
    // Water landing only when the column can be traced from the edge.
    add({kind:'water_drop',x:nx,y:landingY,z:nz,dx,dz,drop,
     expectedDamage:0,verified:true,requires:'water_descent_executor'});
    break;
   }
   if(solid(base)&&empty(feet)&&empty(head)){
    const damage=riskForDrop(drop);
    if(damage>=health||(!allowRisk&&damage>0))rejections.unsafeFall++;
    else add({kind:damage>0?'risky_drop':'short_drop',x:nx,y:landingY,z:nz,
     dx,dz,drop,expectedDamage:damage,verified:true,
     requires:damage>0?'risk_choice_executor':'short_step_executor'});
    break;
   }
   if(!empty(feet)||!empty(head)){rejections.blocked++;traversed=false;break;}
  }
 }
 // If terrain has no observed safe exit, identify requirements instead of
 // pretending that dig/place/bucket operations have been executed.
 const capabilities=[];
 if(inventory.some(i=>i.name==='water_bucket'&&i.count>0))capabilities.push('water_bucket_possible_requires_verified_placement');
 if(inventory.some(i=>i.name?.includes('ladder')&&i.count>0))capabilities.push('ladder_possible_requires_verified_placement');
 capabilities.push('dig_or_bridge_requires_separate_executor');
 const rank={step_down:0,climb_down:1,short_drop:2,water_drop:3,risky_drop:4};
 options.sort((a,b)=>rank[a.kind]-rank[b.kind]||a.expectedDamage-b.expectedDamage||a.drop-b.drop);
 return {schema:DESCENT_PLAN_SCHEMA,selected:options[0]??null,options,
  reason:options.length?'verified_candidate':'no_verified_executable_descent',
  rejections,capabilities,health,allowRisk,
  caveat:'Planning is not movement. Only a bound executor with observed outcome establishes success.'};
}
