// Eight factorial cognition configurations plus a replicated baseline.
// Features are implemented as auditable prompt/memory interventions, not trained weights.
export const FACTORS=['foveatedVision','cognitiveMap','knowledgeGraph'];
export function cognitionFor(index){
 if(!Number.isInteger(index)||index<0||index>8)throw Error('Invalid factorial index');
 if(index===8)return {foveatedVision:false,cognitiveMap:false,knowledgeGraph:false};
 return Object.fromEntries(FACTORS.map((key,bit)=>[key,Boolean(index&(1<<bit))]));
}
export function describeCognition(cognition){
 return FACTORS.filter(f=>cognition?.[f]).join('+')||'baseline';
}
export function validateCognition(cognition){
 if(!cognition||FACTORS.some(k=>typeof cognition[k]!=='boolean'))throw Error('Cognition must contain three boolean factors');
 return cognition;
}
