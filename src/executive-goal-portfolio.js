// Persistent, deterministic executive goal portfolio. No Minecraft knowledge injected.
// Policy selection and action execution are deliberately outside this module.
import fs from 'node:fs';
import path from 'node:path';
const STATES=new Set(['proposed','active','blocked','tabled','completed','abandoned']);
const str=x=>typeof x==='string'&&x.length>0&&x.length<=160;
export class GoalPortfolio {
 constructor({maxGoals=256}={}){if(!Number.isInteger(maxGoals)||maxGoals<1)throw Error('Invalid capacity');this.maxGoals=maxGoals;this.goals=new Map();this.activeId=null;this.revision=0;}
 propose({id,objective,priority=0,context={},dependencies=[]}){
  if(!str(id)||!str(objective)||!Number.isFinite(priority)||this.goals.has(id)||this.goals.size>=this.maxGoals||!Array.isArray(dependencies)||dependencies.includes(id))throw Error('Invalid goal');
  const goal={id,objective,priority,state:'proposed',context:structuredClone(context),dependencies:[...new Set(dependencies)],progress:[],history:[{event:'proposed',reason:'created'}],resumeWhen:null};
  this.goals.set(id,goal);this.revision++;return structuredClone(goal);
 }
 goal(id){const g=this.goals.get(id);return g?structuredClone(g):null;}
 activate(id,{reason='selected',evidence=null}={}){
  const g=this.goals.get(id);if(!g||!['proposed','tabled','blocked'].includes(g.state)||!str(reason))throw Error('Goal cannot activate');
  if(g.dependencies.some(dep=>this.goals.get(dep)?.state!=='completed'))throw Error('Unmet dependencies');
  if(this.activeId)throw Error('Another goal is active; table or complete it first');
  g.state='active';g.history.push({event:'activated',reason,evidence:structuredClone(evidence)});
  this.activeId=id;this.revision++;return this.goal(id);
 }
 noteProgress(id,{description,evidence=null}){
  const g=this.goals.get(id);if(!g||g.state!=='active'||!str(description))throw Error('No active goal');
  g.progress.push({description,evidence:structuredClone(evidence)});this.revision++;return this.goal(id);
 }
 transition(id,to,{reason,evidence=null,resumeWhen=null}={}){
  const g=this.goals.get(id);
  if(!g||g.state!=='active'||!['tabled','blocked','completed','abandoned'].includes(to)||!str(reason))throw Error('Invalid transition');
  if((to==='tabled'||to==='blocked')&&!str(resumeWhen))throw Error('Deferral needs a resumption condition');
  g.state=to;g.resumeWhen=to==='tabled'||to==='blocked'?resumeWhen:null;
  g.history.push({event:to,reason,evidence:structuredClone(evidence),progressCount:g.progress.length});
  this.activeId=null;this.revision++;return this.goal(id);
 }
 eligible(){return [...this.goals.values()].filter(g=>['proposed','tabled','blocked'].includes(g.state)&&g.dependencies.every(d=>this.goals.get(d)?.state==='completed')).map(g=>({id:g.id,state:g.state,priority:g.priority,resumeWhen:g.resumeWhen}));}
 snapshot(){return structuredClone({schema:'craftle.goal-portfolio.v1',revision:this.revision,activeId:this.activeId,goals:[...this.goals.values()]});}
 static restore(s){
  if(s?.schema!=='craftle.goal-portfolio.v1'||!Array.isArray(s.goals)||!Number.isSafeInteger(s.revision)||s.revision<0)throw Error('Invalid snapshot');
  const p=new GoalPortfolio({maxGoals:Math.max(256,s.goals.length)});
  for(const g of s.goals){
   if(!str(g?.id)||!str(g.objective)||!STATES.has(g.state)||p.goals.has(g.id)||!Array.isArray(g.progress)||!Array.isArray(g.history)||!Array.isArray(g.dependencies))throw Error('Corrupt goal');
   p.goals.set(g.id,structuredClone(g));
  }
  if(s.activeId!==null&&p.goals.get(s.activeId)?.state!=='active')throw Error('Invalid active goal');
  if([...p.goals.values()].filter(g=>g.state==='active').length!==(s.activeId===null?0:1))throw Error('Conflicting active goals');
  p.activeId=s.activeId;p.revision=s.revision;return p;
 }
 save(file){const dest=path.resolve(file);fs.mkdirSync(path.dirname(dest),{recursive:true});const tmp=dest+'.tmp';fs.writeFileSync(tmp,JSON.stringify(this.snapshot()),{flag:'w'});fs.renameSync(tmp,dest);}
 static load(file){return GoalPortfolio.restore(JSON.parse(fs.readFileSync(file,'utf8')));}
}
