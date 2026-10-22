// Shared agent contract for every Craftle treatment, including scripted controls.
// Decision mechanism may be deterministic or learned; the life-cycle is common.
export const AGENT_STAGES=Object.freeze(['observe','updateBeliefs','selectGoal','plan','act','reflect']);
export function validateAgent(agent){
  for(const stage of AGENT_STAGES)if(typeof agent?.[stage]!=='function')throw Error(`Agent missing ${stage}()`);
  return agent;
}
export async function stepAgent(agent,worldInput){
  validateAgent(agent);
  const observation=await agent.observe(worldInput);
  const beliefs=await agent.updateBeliefs(observation);
  const goal=await agent.selectGoal(beliefs);
  const plan=await agent.plan(goal,beliefs);
  const action=await agent.act(plan);
  await agent.reflect({observation,beliefs,goal,plan,action});
  return {goal,action};
}
// Example goal-directed scripted control (not a trained visual policy).
export function createScriptedControl(){
  const state={steps:0,stuckCount:0,lastGoal:null};
  return validateAgent({
    observe:input=>input,
    updateBeliefs:obs=>{state.stuckCount=obs.displacement<0.15?state.stuckCount+1:0;return {...obs,stuckCount:state.stuckCount};},
    selectGoal:beliefs=>beliefs.danger?'survive':beliefs.stuckCount>=2?'recover':'explore',
    plan:(goal,beliefs)=>({goal,turn:goal!=='explore'||beliefs.forwardBlocked||!beliefs.groundAhead,jump:goal==='explore'&&beliefs.forwardBlocked&&beliefs.groundAhead}),
    act:plan=>({forward:!plan.turn,turn:plan.turn,jump:plan.jump}),
    reflect:({goal})=>{state.steps++;state.lastGoal=goal;},
    state
  });
}
