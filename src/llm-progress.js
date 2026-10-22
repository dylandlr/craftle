// Lightweight experiment instrumentation: distinguish commands, observed effects,
// and repeated failed attempts. This is not model-weight learning.
export function createProgressTracker({stuckThreshold=3}={}){
 let stagnantMoves=0;
 let previousGoal=null;
 const outcomes=[];
 return {
  observe({goal,action,effect}){
   if(action==='forward'||action==='back'||action==='left'||action==='right'){
     stagnantMoves=effect?.moved===false?stagnantMoves+1:0;
   }else if(effect?.moved===true)stagnantMoves=0;
   const feedback={
     goalChanged:previousGoal!==null&&previousGoal!==goal,
     consecutiveFailedMoves:stagnantMoves,
     movementStalled:stagnantMoves>=stuckThreshold,
     recommendation:stagnantMoves>=stuckThreshold?'Reconsider your plan; try changing camera orientation or navigating around the obstacle.':''
   };
   previousGoal=goal;
   outcomes.push({goal,action,moved:effect?.moved??null});
   if(outcomes.length>30)outcomes.shift();
   return feedback;
  },
  summary(){return {recentActions:outcomes.length,consecutiveFailedMoves:stagnantMoves,goals:[...new Set(outcomes.map(x=>x.goal))]};}
 };
}
