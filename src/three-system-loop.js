// Offline three-system coordinator. Does not import Minecraft, write checkpoints,
// or issue actions. The caller supplies observed outcomes from a simulated world.
import {DualLearningCoordinator,AffordanceEvidence} from './dual-learning-core.js';
import {GoalPortfolio} from './executive-goal-portfolio.js';
const results=new Set(['verified_success','verified_failure','no_observable_change','unknown','interrupted','timed_out']);
export class ThreeSystemLoop {
 constructor({valueLearner,chooseAction,goals=new GoalPortfolio(),knowledge=new AffordanceEvidence(),onTransition=()=>{}}={}){
  if(typeof chooseAction!=='function')throw Error('Missing action selector');
  this.goals=goals;this.chooseAction=chooseAction;
  this.dual=new DualLearningCoordinator({valueLearner,knowledge,onTransition});
  this.nextId=1;
 }
 get knowledge(){return this.dual.knowledge;}
 start(goalId,{observation,tick,maxTicks=400}={}){
  if(this.dual.active)throw Error('Finish current action first');
  if(this.goals.activeId!==goalId)this.goals.activate(goalId,{reason:'selected_by_executive'});
  const action=this.chooseAction({goal:this.goals.goal(goalId),observation:structuredClone(observation)});
  if(typeof action!=='string'||!action)throw Error('Invalid chosen action');
  const id=String(this.nextId++);
  this.dual.begin({id,option:action,observation,tick,maxTicks});
  return {goalId,decisionId:id,action,startTick:tick};
 }
 observe({tick,result,observation,reward,evidence=null,goalDisposition='continue',reason=null,resumeWhen=null}={}){
  if(!this.dual.active||!results.has(result))throw Error('Invalid or absent action episode');
  const id=this.goals.activeId;
  if(!id)throw Error('No active executive goal');
  const transition=this.dual.settle({tick,result,finalObservation:observation,reward,evidence});
  if(result==='verified_success')this.goals.noteProgress(id,{description:'action completed: '+transition.option,evidence:{decisionId:transition.id,result}});
  if(goalDisposition!=='continue'){
   if(!['completed','tabled','blocked','abandoned'].includes(goalDisposition))throw Error('Invalid goal disposition');
   this.goals.transition(id,goalDisposition,{reason:reason??result,evidence:{decisionId:transition.id,result},resumeWhen});
  }
  return {transition,goal:this.goals.goal(id),knowledge:this.knowledge.snapshot()};
 }
 snapshot(){return {schema:'craftle.three-system-loop.v1',nextId:this.nextId,goals:this.goals.snapshot(),knowledge:this.knowledge.snapshot(),activeEpisode:this.dual.active!==null};}
}
