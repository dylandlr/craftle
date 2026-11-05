// Pure conservative duration bounds from asynchronously sampled Minecraft clocks.
// No exact tick is inferred from RCON wall-clock observation.
export function durationBounds(start,end){
 if(start?.status!=='bracketed'||end?.status!=='bracketed')return {status:'insufficient_clock_evidence'};
 if(start.worldId!==end.worldId||start.epoch!==end.epoch)return {status:'clock_discontinuity'};
 const minimum=Math.max(0,end.minTick-start.maxTick);
 const maximum=end.maxTick-start.minTick;
 if(!Number.isSafeInteger(minimum)||!Number.isSafeInteger(maximum)||maximum<minimum)return {status:'invalid_bounds'};
 return {status:'bounded',minimumTicks:minimum,maximumTicks:maximum,exact:minimum===maximum};
}
export function trainingTickGate(start,end){
 const bounds=durationBounds(start,end);
 if(bounds.status!=='bounded')return {...bounds,trainable:false};
 if(!bounds.exact||bounds.minimumTicks<1)return {...bounds,trainable:false,reason:'non_exact_option_duration'};
 return {...bounds,trainable:true,duration:bounds.minimumTicks};
}
export function discountedBootstrapRange({gamma,minimumTicks,maximumTicks,nextQ}){
 if(!(gamma>0&&gamma<=1)||!Number.isFinite(gamma)||!Number.isFinite(nextQ)||!Number.isSafeInteger(minimumTicks)||minimumTicks<0||!Number.isSafeInteger(maximumTicks)||maximumTicks<minimumTicks)throw Error('invalid discount interval');
 const a=gamma**minimumTicks*nextQ,b=gamma**maximumTicks*nextQ;
 return {minimum:Math.min(a,b),maximum:Math.max(a,b),width:Math.abs(a-b)};
}
