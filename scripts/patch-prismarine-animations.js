import fs from 'node:fs';
import path from 'node:path';
// Animation-only browser patch; stock camera and socket protocol unchanged.
const entry=path.resolve('node_modules/prismarine-viewer/lib/index.js');
let source=fs.readFileSync(entry,'utf8');
const creation="        botMesh = new Entity('1.16.4', 'player', viewer.scene).mesh";
const render="  renderer.render(viewer.scene, viewer.camera)";
if(!source.includes(creation)||!source.includes(render)||source.includes('craftleAnimateBot('))
 throw Error('Unsupported or already patched Prismarine Viewer browser entry');
const helper=`
let craftleBotMesh=null,craftlePrev=null,craftlePhase=0,craftleStrength=0,craftleLastFrame=performance.now();
function craftleAnimateBot(){
 const now=performance.now(),dt=Math.min(.1,Math.max(.001,(now-craftleLastFrame)/1000));
 craftleLastFrame=now;
 const mesh=craftleBotMesh,bones=mesh?.userData.craftleBones;
 if(!bones)return;
 const prev=craftlePrev;craftlePrev=mesh.position.clone();
 if(!prev)return;
 const speed=Math.min(1,Math.hypot(mesh.position.x-prev.x,mesh.position.z-prev.z)/dt/4.3);
 craftleStrength+=(speed-craftleStrength)*(1-Math.exp(-9*dt));
 craftlePhase+=dt*(3+9*speed);
 const swing=Math.cos(craftlePhase)*craftleStrength;
 bones.leftArm.rotation.x=-swing*.85;
 bones.rightArm.rotation.x=swing*.85;
 bones.leftLeg.rotation.x=swing*1.1;
 bones.rightLeg.rotation.x=-swing*1.1;
}
`;
source=source.replace('let firstPositionUpdate = true',helper+'\nlet firstPositionUpdate = true');
source=source.replace(render,'  craftleAnimateBot();\n'+render);
source=source.replace(creation,creation+`
        const bones={};
        for(const name of ['leftArm','rightArm','leftLeg','rightLeg'])
          bones[name]=botMesh.getObjectByName(name);
        if(Object.values(bones).every(Boolean)){
          botMesh.userData.craftleBones=bones;
          craftleBotMesh=botMesh;
        }
`);
fs.writeFileSync(entry,source);
console.log('Craftle animation-only patch installed');
