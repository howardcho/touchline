export const SUBSTITUTION_PREF_KEY='touchline-substitution-preferences-v1';
export const SUBSTITUTION_SESSION_KEY='touchline-substitution-session-v1';
export const MAX_GROUPS=6;
export const MIN_DURATION_MS=1000;
export const MAX_DURATION_MS=24*60*60*1000;

const clean=value=>String(value??'').trim();
const duration=(value,fallback)=>Number.isInteger(value)&&value>=MIN_DURATION_MS&&value<=MAX_DURATION_MS?value:fallback;
const count=(value,fallback,min=0,max=99)=>Number.isInteger(value)&&value>=min&&value<=max?value:fallback;
const idFor=(prefix,index)=>`${prefix}-${index+1}`;
export const playerLabel=player=>clean(player?.name)||clean(player?.number)?[clean(player?.number)&&`#${clean(player.number)}`,clean(player?.name)].filter(Boolean).join(' '):'Unnamed player';

export function defaultSubstitutionPreferences(){
  return {fieldPlayers:7,periods:2,periodMs:25*60*1000,minimumMs:60*1000,groups:[{id:'group-1',name:'All Players',onField:7,rotateCount:1,intervalMs:5*60*1000,offsetMs:0,random:false,playerIds:[]}],players:[]};
}

export function normalizeSubstitutionPreferences(raw={}){
  const defaults=defaultSubstitutionPreferences(),seenGroups=new Set();
  const groups=(Array.isArray(raw.groups)?raw.groups:defaults.groups).slice(0,MAX_GROUPS).map((item,index)=>{
    let id=clean(item?.id)||idFor('group',index);while(seenGroups.has(id))id=`${idFor('group',index)}-${seenGroups.size+1}`;seenGroups.add(id);
    return {id,name:clean(item?.name)||`Rotation Group ${index+1}`,onField:count(item?.onField,index?0:defaults.fieldPlayers,0,30),rotateCount:count(item?.rotateCount,1,1,30),intervalMs:duration(item?.intervalMs,5*60*1000),offsetMs:count(item?.offsetMs,0,0,MAX_DURATION_MS),random:item?.random===true,playerIds:[]};
  });
  if(!groups.length)groups.push({...defaults.groups[0],playerIds:[]});
  const groupIds=new Set(groups.map(group=>group.id)),seenPlayers=new Set();
  const players=(Array.isArray(raw.players)?raw.players:[]).map((item,index)=>{
    let id=clean(item?.id)||idFor('player',index);while(seenPlayers.has(id))id=`${idFor('player',index)}-${seenPlayers.size+1}`;seenPlayers.add(id);
    const groupId=groupIds.has(item?.groupId)?item.groupId:null;
    return {id,name:clean(item?.name),number:clean(item?.number),groupId,active:item?.active!==false};
  });
  const playersById=new Map(players.map(player=>[player.id,player]));
  const claimed=new Set();
  for(const group of groups){
    const source=Array.isArray(raw.groups)?raw.groups.find(item=>clean(item?.id)===group.id):null;
    for(const playerId of Array.isArray(source?.playerIds)?source.playerIds:[]){
      const player=playersById.get(playerId);if(player&&player.active&&player.groupId===group.id&&!claimed.has(playerId)){group.playerIds.push(playerId);claimed.add(playerId);}
    }
    for(const player of players)if(player.active&&player.groupId===group.id&&!claimed.has(player.id)){group.playerIds.push(player.id);claimed.add(player.id);}
  }
  return {fieldPlayers:count(raw.fieldPlayers,defaults.fieldPlayers,1,30),periods:[2,4].includes(raw.periods)?raw.periods:defaults.periods,periodMs:duration(raw.periodMs,defaults.periodMs),minimumMs:duration(raw.minimumMs,defaults.minimumMs),groups,players};
}

export function validateSubstitutionConfig(source,{requireRoster=true}={}){
  const config=normalizeSubstitutionPreferences(source),errors=[];
  if(config.groups.length>MAX_GROUPS)errors.push('Use no more than six rotation groups.');
  const slots=config.groups.reduce((total,group)=>total+group.onField,0);
  if(slots!==config.fieldPlayers)errors.push(`Group field slots total ${slots}; they must total ${config.fieldPlayers}.`);
  const active=config.players.filter(player=>player.active);
  if(requireRoster&&!active.length)errors.push('Add at least one player.');
  for(const group of config.groups){
    const available=group.playerIds.filter(id=>active.some(player=>player.id===id)).length;
    if(requireRoster&&available<group.onField)errors.push(`${group.name} needs ${group.onField} on the field but has ${available} ${available===1?'player':'players'}.`);
  }
  if(requireRoster&&active.some(player=>!player.groupId))errors.push('Assign every available player to a rotation group.');
  return {valid:errors.length===0,errors,config};
}

export function loadSubstitutionPreferences(storage){
  try{return normalizeSubstitutionPreferences(JSON.parse(storage.getItem(SUBSTITUTION_PREF_KEY))||{});}catch{return defaultSubstitutionPreferences();}
}
export function saveSubstitutionPreferences(storage,preferences){
  try{storage.setItem(SUBSTITUTION_PREF_KEY,JSON.stringify(normalizeSubstitutionPreferences(preferences)));return true;}catch{return false;}
}

function shuffled(items,random){
  const result=[...items];for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;
}
function groupState(group,random){
  const order=group.random?shuffled(group.playerIds,random):[...group.playerIds];
  return {id:group.id,queue:order,dueMs:group.intervalMs+group.offsetMs,alerted:false};
}
export function createSubstitutionSession(source,{now=Date.now(),random=Math.random}={}){
  const {valid,errors,config}=validateSubstitutionConfig(source);if(!valid)throw new Error(errors.join(' '));
  return {version:1,config,groups:config.groups.map(group=>groupState(group,random)),period:1,remaining:config.periodMs,running:false,phase:'lineup',lastTick:null,startedAt:null,finishedAt:null,finished:false,pendingGroups:[],playMs:Object.fromEntries(config.players.map(player=>[player.id,0])),departed:[],createdAt:now};
}
export const sessionGroup=(state,id)=>state.groups.find(group=>group.id===id);
export const configGroup=(state,id)=>state.config.groups.find(group=>group.id===id);
export const onFieldIds=(state,id)=>{const live=sessionGroup(state,id),group=configGroup(state,id);return live&&group?live.queue.slice(0,group.onField):[];};
export const benchIds=(state,id)=>{const live=sessionGroup(state,id),group=configGroup(state,id);return live&&group?live.queue.slice(group.onField):[];};
export const currentLineup=state=>state.config.groups.flatMap(group=>onFieldIds(state,group.id));

function addPlayingTime(state,ms){if(ms<=0)return;for(const id of currentLineup(state))state.playMs[id]=(state.playMs[id]??0)+ms;}
export function advanceSubstitutionSession(state,now=Date.now()){
  const events=[];if(!state?.running||state.finished)return events;
  let elapsed=Math.max(0,now-state.lastTick);const activeGroups=state.config.groups.filter(group=>benchIds(state,group.id).length>0);
  const untilDue=activeGroups.length?Math.min(...activeGroups.map(group=>Math.max(0,sessionGroup(state,group.id).dueMs))):Infinity;
  const step=Math.min(elapsed,state.remaining,untilDue);addPlayingTime(state,step);state.remaining=Math.max(0,state.remaining-step);
  for(const group of activeGroups){const live=sessionGroup(state,group.id),before=live.dueMs;live.dueMs=Math.max(0,before-step);if(!live.alerted&&before>10000&&live.dueMs<=10000){live.alerted=true;events.push({type:'soon',groupId:group.id});}}
  state.lastTick=now;
  if(state.remaining<=0){state.running=false;state.phase=state.period>=state.config.periods?'finished':'period-break';if(state.phase==='finished'){state.finished=true;state.finishedAt=now;}events.push({type:state.finished?'finished':'period-end',period:state.period});return events;}
  const due=activeGroups.filter(group=>sessionGroup(state,group.id).dueMs<=0).map(group=>group.id);
  if(due.length){state.running=false;state.phase='substitution';state.pendingGroups=[...new Set([...state.pendingGroups,...due])];events.push({type:'due',groupIds:due});return events;}
  return events;
}

export function startOrResumeSubstitutionSession(state,now=Date.now()){
  if(state.finished||state.phase==='period-break')return false;
  if(state.running){advanceSubstitutionSession(state,now);state.running=false;state.phase='paused';return false;}
  state.running=true;state.phase='play';state.lastTick=now;state.startedAt??=now;return true;
}

export function rotateSubstitutionGroup(state,groupId,now=Date.now()){
  advanceSubstitutionSession(state,now);const group=configGroup(state,groupId),live=sessionGroup(state,groupId);if(!group||!live)return {out:[],in:[]};
  const bench=Math.max(0,live.queue.length-group.onField),amount=Math.min(group.rotateCount,group.onField,bench);if(!amount){live.dueMs=group.intervalMs;live.alerted=false;state.pendingGroups=state.pendingGroups.filter(id=>id!==groupId);return {out:[],in:[]};}
  const out=live.queue.slice(0,amount),incoming=live.queue.slice(group.onField,group.onField+amount),staying=live.queue.slice(amount,group.onField),rest=live.queue.slice(group.onField+amount);
  live.queue=[...staying,...incoming,...rest,...out];live.dueMs=group.intervalMs;live.alerted=false;state.pendingGroups=state.pendingGroups.filter(id=>id!==groupId);state.running=false;state.phase='substitution';state.lastTick=now;return {out,in:incoming};
}

export function forcePlayerSubstitution(state,playerId,now=Date.now()){
  advanceSubstitutionSession(state,now);const player=state.config.players.find(item=>item.id===playerId&&item.active);if(!player)return null;
  const group=configGroup(state,player.groupId),live=sessionGroup(state,player.groupId);if(!group||!live)return null;
  const outgoing=live.queue.indexOf(playerId);if(outgoing<0||outgoing>=group.onField||live.queue.length<=group.onField)return null;
  const incoming=live.queue[group.onField],lineup=live.queue.slice(0,group.onField),rest=live.queue.slice(group.onField+1);lineup[outgoing]=incoming;live.queue=[...lineup,...rest,playerId];live.dueMs=group.intervalMs;live.alerted=false;state.pendingGroups=state.pendingGroups.filter(id=>id!==group.id);state.running=false;state.phase='substitution';state.lastTick=now;return {out:playerId,in:incoming,groupId:group.id};
}

export function prepareNextPeriod(state,now=Date.now()){
  if(state.finished||state.phase!=='period-break')return [];
  const changes=[];for(const group of state.config.groups){const live=sessionGroup(state,group.id);if(live.dueMs<=state.config.minimumMs){const change=rotateSubstitutionGroup(state,group.id,now);if(change.out.length)changes.push({groupId:group.id,...change});}}
  state.period++;state.remaining=state.config.periodMs;state.running=false;state.phase='lineup';state.pendingGroups=[];state.lastTick=null;return changes;
}

export function swapStartingPlayer(state,groupId,benchPlayerId,outPlayerId=null){
  if(state.running||!['lineup','paused','substitution'].includes(state.phase))return false;const group=configGroup(state,groupId),live=sessionGroup(state,groupId);if(!group||!live)return false;
  const incoming=live.queue.indexOf(benchPlayerId);if(incoming<group.onField)return false;let outgoing=outPlayerId?live.queue.indexOf(outPlayerId):group.onField-1;if(outgoing<0||outgoing>=group.onField)return false;
  [live.queue[outgoing],live.queue[incoming]]=[live.queue[incoming],live.queue[outgoing]];return true;
}

function removeFromGroup(state,player){
  const live=sessionGroup(state,player.groupId);if(live)live.queue=live.queue.filter(id=>id!==player.id);const group=configGroup(state,player.groupId);if(group)group.playerIds=group.playerIds.filter(id=>id!==player.id);
}
export function addSessionPlayer(state,{name='',number='',groupId,firstRotation=false},now=Date.now()){
  advanceSubstitutionSession(state,now);const group=configGroup(state,groupId);if(!group)throw new Error('Choose a rotation group.');
  const id=`player-${now}-${state.config.players.length+1}`,player={id,name:clean(name),number:clean(number),groupId,active:true};if(!player.name&&!player.number)throw new Error('Enter a player name or number.');
  state.config.players.push(player);group.playerIds.push(id);const live=sessionGroup(state,groupId);if(firstRotation)live.queue.splice(group.onField,0,id);else live.queue.push(id);state.playMs[id]=0;state.running=false;if(state.phase==='play')state.phase='paused';return player;
}
export function moveSessionPlayer(state,playerId,groupId,{firstRotation=false,now=Date.now()}={}){
  advanceSubstitutionSession(state,now);const player=state.config.players.find(item=>item.id===playerId&&item.active),target=configGroup(state,groupId);if(!player||!target)return false;if(player.groupId===groupId)return true;
  removeFromGroup(state,player);player.groupId=groupId;target.playerIds.push(player.id);const live=sessionGroup(state,groupId);if(firstRotation)live.queue.splice(target.onField,0,player.id);else live.queue.push(player.id);state.running=false;if(state.phase==='play')state.phase='paused';return true;
}
export function removeSessionPlayer(state,playerId,now=Date.now()){
  advanceSubstitutionSession(state,now);const player=state.config.players.find(item=>item.id===playerId&&item.active);if(!player)return false;removeFromGroup(state,player);player.active=false;state.departed.push(player.id);state.running=false;if(state.phase==='play')state.phase='paused';return true;
}

export function reconfigureSubstitutionSession(state,source,now=Date.now()){
  advanceSubstitutionSession(state,now);const priorConfig=state.config,priorPhase=state.phase,elapsedInPeriod=Math.max(0,priorConfig.periodMs-state.remaining),{valid,errors,config}=validateSubstitutionConfig(source);if(!valid)throw new Error(errors.join(' '));
  const configuredIds=new Set(config.players.map(player=>player.id));
  for(const oldPlayer of priorConfig.players){if(configuredIds.has(oldPlayer.id))continue;config.players.push({...oldPlayer,active:false});state.departed.push(oldPlayer.id);}
  const previous=new Map(state.groups.map(group=>[group.id,group])),activeIds=new Set(config.players.filter(player=>player.active).map(player=>player.id));
  state.config=config;state.groups=config.groups.map(group=>{const old=previous.get(group.id),ordered=[];for(const id of old?.queue??[])if(group.playerIds.includes(id)&&activeIds.has(id)&&!ordered.includes(id))ordered.push(id);for(const id of group.playerIds)if(activeIds.has(id)&&!ordered.includes(id))ordered.push(id);return {id:group.id,queue:ordered,dueMs:old?Math.min(old.dueMs,group.intervalMs):group.intervalMs+group.offsetMs,alerted:false};});
  for(const player of config.players)state.playMs[player.id]??=0;
  state.remaining=Math.max(0,config.periodMs-elapsedInPeriod);state.running=false;state.pendingGroups=[];state.lastTick=now;
  if(priorPhase==='lineup'||priorPhase==='period-break')state.phase=priorPhase;
  else if(state.remaining<=0){state.phase=state.period>=config.periods?'finished':'period-break';state.finished=state.phase==='finished';if(state.finished)state.finishedAt=now;}
  else state.phase='paused';
  return state;
}

export function finishSubstitutionSession(state,now=Date.now()){advanceSubstitutionSession(state,now);state.running=false;state.finished=true;state.phase='finished';state.finishedAt=now;return state;}
export function substitutionSummary(state){
  const elapsed=Math.max(0,(state.finishedAt??Date.now())-(state.startedAt??state.createdAt));
  const groups=state.config.groups.map(group=>({id:group.id,name:group.name,players:state.config.players.filter(player=>player.groupId===group.id).map(player=>({...player,playingMs:state.playMs[player.id]??0})),averageMs:0}));
  for(const group of groups)group.averageMs=group.players.length?group.players.reduce((sum,player)=>sum+player.playingMs,0)/group.players.length:0;
  const players=groups.flatMap(group=>group.players),averageMs=players.length?players.reduce((sum,player)=>sum+player.playingMs,0)/players.length:0;
  return {elapsedMs:elapsed,averageMs,periodsCompleted:state.finished?state.period:Math.max(0,state.period-1),groups,players};
}
