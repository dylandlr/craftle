import fs from 'node:fs';
const [configFile,id]=process.argv.slice(2);
if(!configFile||!id)throw Error('Usage: node scripts/verify-agent-preset.js config.json agent_001|agent_008');
const config=JSON.parse(fs.readFileSync(configFile,'utf8'));
const agent=config.agents.find(a=>a.id===id);
if(!agent||!['agent_001','agent_008'].includes(id))throw Error('Unknown supported experimental treatment');
const expected=id==='agent_001'?{foveatedVision:false,cognitiveMap:false,knowledgeGraph:false}:{foveatedVision:true,cognitiveMap:true,knowledgeGraph:true};
if(Object.keys(expected).some(key=>agent.cognition[key]!==expected[key]))throw Error('Unexpected cognition configuration: '+id);
console.log(JSON.stringify({treatment:id,agentName:agent.name,cognition:agent.cognition,worldMode:'single-agent isolated run',note:'Run treatments on matched seed; not in same world'}));
