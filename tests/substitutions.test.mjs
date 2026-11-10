import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultSubstitutionPreferences,normalizeSubstitutionPreferences,validateSubstitutionConfig,createSubstitutionSession,currentLineup,onFieldIds,benchIds,startOrResumeSubstitutionSession,advanceSubstitutionSession,rotateSubstitutionGroup,forcePlayerSubstitution,prepareNextPeriod,addSessionPlayer,moveSessionPlayer,removeSessionPlayer,reconfigureSubstitutionSession,finishSubstitutionSession,substitutionSummary,loadSubstitutionPreferences,saveSubstitutionPreferences,SUBSTITUTION_PREF_KEY} from '../substitutions.mjs';

const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),values};};
const configured=()=>({fieldPlayers:3,periods:2,periodMs:600000,minimumMs:60000,groups:[
 {id:'strikers',name:'Strikers',onField:1,rotateCount:1,intervalMs:120000,offsetMs:0,random:false,playerIds:['a','b']},
 {id:'midfield',name:'Midfield',onField:2,rotateCount:1,intervalMs:180000,offsetMs:30000,random:false,playerIds:['c','d','e']}
],players:[
 {id:'a',name:'Alex',number:'9',groupId:'strikers'},{id:'b',name:'Blair',number:'11',groupId:'strikers'},
 {id:'c',name:'Casey',number:'6',groupId:'midfield'},{id:'d',name:'Drew',number:'8',groupId:'midfield'},{id:'e',name:'Emery',number:'10',groupId:'midfield'}
]});

test('fresh defaults start with one editable All Players group',()=>{
 const prefs=defaultSubstitutionPreferences();assert.equal(prefs.groups.length,1);assert.equal(prefs.groups[0].name,'All Players');assert.equal(prefs.fieldPlayers,7);assert.equal(prefs.periods,2);assert.equal(prefs.minimumMs,60000);assert.equal(prefs.pauseForSubstitutions,true);
});

test('configuration requires group slots to equal the field and enough assigned players',()=>{
 const good=validateSubstitutionConfig(configured());assert.equal(good.valid,true);
 const bad=configured();bad.groups[0].onField=2;assert.match(validateSubstitutionConfig(bad).errors.join(' '),/total 4/);
 bad.groups[0].onField=3;assert.match(validateSubstitutionConfig(bad).errors.join(' '),/needs 3/);
});

test('saved substitution defaults normalize and persist independently',()=>{
 const local=storage(),prefs=configured();prefs.pauseForSubstitutions=false;assert.equal(saveSubstitutionPreferences(local,prefs),true);assert.ok(local.values.has(SUBSTITUTION_PREF_KEY));
 const restored=loadSubstitutionPreferences(local);assert.equal(restored.groups[1].offsetMs,30000);assert.deepEqual(restored.groups[0].playerIds,['a','b']);assert.equal(restored.pauseForSubstitutions,false);
 const malformed=normalizeSubstitutionPreferences({periods:3,groups:[],players:[]});assert.equal(malformed.periods,2);assert.equal(malformed.groups[0].name,'All Players');
});

test('ordered queues produce the starting lineup and equal cyclic substitutions',()=>{
 const state=createSubstitutionSession(configured(),{now:0});assert.deepEqual(currentLineup(state),['a','c','d']);assert.deepEqual(benchIds(state,'midfield'),['e']);
 assert.deepEqual(rotateSubstitutionGroup(state,'strikers',0),{out:['a'],in:['b']});assert.deepEqual(onFieldIds(state,'strikers'),['b']);
 assert.deepEqual(rotateSubstitutionGroup(state,'strikers',0),{out:['b'],in:['a']});assert.deepEqual(onFieldIds(state,'strikers'),['a']);
});

test('random groups shuffle once at game creation while ordered groups stay fixed',()=>{
 const prefs=configured();prefs.groups[0].random=true;const sequence=[.1,.9];let i=0;
 const state=createSubstitutionSession(prefs,{now:0,random:()=>sequence[i++%sequence.length]});assert.notDeepEqual(sessionOrder(state,'strikers'),['a','b']);assert.deepEqual(sessionOrder(state,'midfield'),['c','d','e']);
});
const sessionOrder=(state,id)=>state.groups.find(group=>group.id===id).queue;

test('timer stops exactly when a group is due and records only live playing time',()=>{
 const state=createSubstitutionSession(configured(),{now:0});startOrResumeSubstitutionSession(state,1000);
 let events=advanceSubstitutionSession(state,111000);assert.ok(events.some(event=>event.type==='soon'&&event.groupId==='strikers'));assert.equal(state.running,true);
 events=advanceSubstitutionSession(state,130000);assert.ok(events.some(event=>event.type==='due'));assert.equal(state.running,false);assert.equal(state.remaining,480000);assert.equal(state.playMs.a,120000);assert.equal(state.playMs.c,120000);
});

test('clock can continue while multiple substitutions remain pending',()=>{
 const prefs=configured();prefs.pauseForSubstitutions=false;prefs.groups[1].offsetMs=0;prefs.groups[1].intervalMs=180000;const state=createSubstitutionSession(prefs,{now:0});startOrResumeSubstitutionSession(state,0);
 let events=advanceSubstitutionSession(state,120000);assert.ok(events.some(event=>event.type==='due'&&event.groupIds.includes('strikers')));assert.equal(state.running,true);assert.deepEqual(state.pendingGroups,['strikers']);assert.equal(state.remaining,480000);
 events=advanceSubstitutionSession(state,180000);assert.ok(events.some(event=>event.type==='due'&&event.groupIds.includes('midfield')));assert.equal(state.running,true);assert.deepEqual(state.pendingGroups,['strikers','midfield']);assert.equal(state.playMs.a,180000);
 const change=rotateSubstitutionGroup(state,'strikers',190000);assert.deepEqual(change,{out:['a'],in:['b']});assert.equal(state.running,true);assert.deepEqual(state.pendingGroups,['midfield']);assert.equal(state.remaining,410000);
 events=advanceSubstitutionSession(state,600000);assert.ok(events.some(event=>event.type==='period-end'));assert.equal(state.running,false);assert.equal(state.phase,'period-break');assert.equal(state.remaining,0);
});

test('a period boundary takes priority over a substitution due at the same instant',()=>{
 const prefs=configured();prefs.periodMs=120000;const state=createSubstitutionSession(prefs,{now:0});startOrResumeSubstitutionSession(state,0);
 const events=advanceSubstitutionSession(state,120000);assert.ok(events.some(event=>event.type==='period-end'));assert.ok(!events.some(event=>event.type==='due'));assert.equal(state.phase,'period-break');
});

test('a forced group or player change pauses play and resets only that group clock',()=>{
 const state=createSubstitutionSession(configured(),{now:0});startOrResumeSubstitutionSession(state,0);advanceSubstitutionSession(state,30000);
 const change=rotateSubstitutionGroup(state,'strikers',30000);assert.deepEqual(change,{out:['a'],in:['b']});assert.equal(state.running,false);assert.equal(state.groups[0].dueMs,120000);assert.equal(state.groups[1].dueMs,180000);
 startOrResumeSubstitutionSession(state,30000);const forced=forcePlayerSubstitution(state,'c',40000);assert.deepEqual(forced,{out:'c',in:'e',groupId:'midfield'});assert.deepEqual(onFieldIds(state,'midfield'),['e','d']);
});

test('period restart rotates groups with less than the minimum stint remaining',()=>{
 const prefs=configured(),state=createSubstitutionSession(prefs,{now:0});state.phase='period-break';state.remaining=0;state.groups[0].dueMs=45000;state.groups[1].dueMs=90000;
 const changes=prepareNextPeriod(state,600000);assert.equal(state.period,2);assert.equal(state.remaining,600000);assert.deepEqual(changes.map(change=>change.groupId),['strikers']);assert.deepEqual(onFieldIds(state,'strikers'),['b']);assert.deepEqual(onFieldIds(state,'midfield'),['c','d']);
});

test('late arrivals can enter first rotation without catch-up and players can move or leave',()=>{
 const state=createSubstitutionSession(configured(),{now:0});const late=addSessionPlayer(state,{name:'Finley',number:'14',groupId:'strikers',firstRotation:true},1000);
 assert.equal(state.playMs[late.id],0);assert.equal(benchIds(state,'strikers')[0],late.id);
 assert.equal(moveSessionPlayer(state,late.id,'midfield',{firstRotation:true,now:2000}),true);assert.equal(benchIds(state,'midfield')[0],late.id);
 assert.equal(removeSessionPlayer(state,'a',3000),true);assert.equal(state.config.players.find(player=>player.id==='a').active,false);assert.ok(!sessionOrder(state,'strikers').includes('a'));
});

test('live reconfiguration preserves accumulated time and current players where possible',()=>{
 const state=createSubstitutionSession(configured(),{now:0});startOrResumeSubstitutionSession(state,0);advanceSubstitutionSession(state,30000);const changed=configured();changed.groups[0].name='Forwards';changed.groups[0].intervalMs=90000;
 reconfigureSubstitutionSession(state,changed,30000);assert.equal(state.config.groups[0].name,'Forwards');assert.equal(state.playMs.a,30000);assert.equal(state.groups[0].dueMs,90000);assert.equal(state.running,false);
});

test('live reconfiguration preserves period breaks and departed players in reports',()=>{
 const state=createSubstitutionSession(configured(),{now:0});state.phase='period-break';state.remaining=0;const changed=configured();changed.periodMs=720000;changed.players=changed.players.filter(player=>player.id!=='a');changed.groups[0].playerIds=['b'];
 reconfigureSubstitutionSession(state,changed,600000);assert.equal(state.phase,'period-break');assert.equal(state.config.players.find(player=>player.id==='a').active,false);assert.ok(state.departed.includes('a'));
 finishSubstitutionSession(state,600000);assert.equal(substitutionSummary(state).players.find(player=>player.id==='a').active,false);
});

test('changing the period length keeps elapsed play and recalculates time remaining',()=>{
 const state=createSubstitutionSession(configured(),{now:0});startOrResumeSubstitutionSession(state,0);advanceSubstitutionSession(state,60000);const changed=configured();changed.periodMs=480000;
 reconfigureSubstitutionSession(state,changed,60000);assert.equal(state.remaining,420000);assert.equal(state.groups[0].dueMs,60000);assert.equal(state.phase,'paused');
});

test('final summary reports actual playing time by player and group',()=>{
 const state=createSubstitutionSession(configured(),{now:0});startOrResumeSubstitutionSession(state,0);advanceSubstitutionSession(state,60000);finishSubstitutionSession(state,60000);const summary=substitutionSummary(state);
 assert.equal(summary.elapsedMs,60000);assert.equal(summary.groups.length,2);assert.equal(summary.groups[0].players[0].playingMs,60000);assert.equal(summary.players.find(player=>player.id==='b').playingMs,0);assert.equal(summary.averageMs,36000);
});

test('summary excludes overnight wall-clock time while the game is paused',()=>{
 const state=createSubstitutionSession(configured(),{now:1000});startOrResumeSubstitutionSession(state,1000);advanceSubstitutionSession(state,61000);startOrResumeSubstitutionSession(state,61000);finishSubstitutionSession(state,24*60*60*1000+61000);
 assert.equal(substitutionSummary(state).elapsedMs,60000);
});

test('older saved games derive actual clock time without using timestamps',()=>{
 const state=createSubstitutionSession(configured(),{now:0});state.period=2;state.remaining=420000;delete state.elapsedPlayMs;state.startedAt=1000;state.finishedAt=24*60*60*1000;
 assert.equal(substitutionSummary(state).elapsedMs,780000);
});
