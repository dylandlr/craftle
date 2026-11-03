import {auditSurvivalActionSpace,SURVIVAL_SKILLS} from '../src/survival-action-contract-v2.js';
import {availableSurvivalActions} from '../src/survival-action-mask-v2.js';
import {TARGET_ACTIONS} from '../src/target-opportunities.js';
const audit=auditSurvivalActionSpace();
const mask=availableSurvivalActions();
console.log(JSON.stringify({schema:'craftle.survival-action-audit.v2',readOnly:true,
 existingDqnActions:TARGET_ACTIONS,proposedSkillCount:SURVIVAL_SKILLS.length,
 statuses:Object.fromEntries([...new Set(SURVIVAL_SKILLS.map(s=>s.status))].map(status=>
  [status,SURVIVAL_SKILLS.filter(s=>s.status===status).map(s=>s.id)])),
 requirements:audit.capabilityChecks,fullyExecutable:audit.fullyExecutable,
 safeDefaultMask:mask.mask,warning:'No expanded DQN has been connected; unwired actions are not executable.'},null,2));
