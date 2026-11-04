// Reward contract v3 candidate. Pure calculations for counterfactual evaluation.
// The existing v1/v2 calculation remains untouched in the controller.
export const REWARD_V3_SCHEMA='craftle.targeted.reward.v3.candidate';
export const REWARD_V3_WEIGHTS=Object.freeze({
 timeCost:-0.03,healthLoss:0.8,hungerLoss:0.02,
 novelty:0.025,inventoryPerUnit:0.12,inventoryCap:0.36,
 verifiedEat:2.0,terminalDeath:-5
});
export function rewardV3({previous,next,firstVisit=false,verifiedEat=false,
 weights=REWARD_V3_WEIGHTS}={}){
 if(!previous||!next)throw Error('Reward v3 requires consecutive observations');
 const healthDelta=next.health-previous.health;
 const foodDelta=next.food-previous.food;
 const inventoryDelta=next.foodUnits-previous.foodUnits;
 if(![healthDelta,foodDelta,inventoryDelta].every(Number.isFinite))throw Error('Non-finite reward input');
 // When hungry, don't reinforce opening new cells over pursuing food.
 const novelty=firstVisit&&next.food>8?weights.novelty:0;
 const inventoryProgress=Math.min(weights.inventoryCap,Math.max(0,inventoryDelta)*weights.inventoryPerUnit);
 const components={
  time:weights.timeCost,
  health:Math.min(0,healthDelta)*weights.healthLoss,
  hunger:Math.min(0,foodDelta)*weights.hungerLoss,
  novelty,
  inventoryProgress,
  verifiedConsumption:verifiedEat?weights.verifiedEat:0
 };
 const total=Object.values(components).reduce((a,b)=>a+b,0);
 return {schema:REWARD_V3_SCHEMA,total,components,
  evidence:'observational inventory/hunger, only verified consumption is explicitly credited'};
}
