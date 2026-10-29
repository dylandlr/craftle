// Execution-only goal lifecycle. Stable navigation goals must survive DQN decision ticks.
export function shouldReplaceNavigationGoal({current,requested,now,stalls=0,timeoutMs=15000}={}){
 if(!requested)return {replace:false,reason:'no_requested_goal'};
 if(!current)return {replace:true,reason:'no_active_goal'};
 if(stalls>=3&&now-current.at>=5000)return {replace:true,reason:'movement_stalled'};
 if(now-current.at>=timeoutMs)return {replace:true,reason:'goal_expired'};
 // A change in objective is meaningful, but different retreat destinations are not.
 if(current.key!==requested.key)return {replace:true,reason:'objective_changed'};
 return {replace:false,reason:'active_goal_in_progress'};
}
