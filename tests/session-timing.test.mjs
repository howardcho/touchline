import test from 'node:test';
import assert from 'node:assert/strict';
import {MAX_DURATION_MS,fresh,toggle,settle,move,restartGame,updateSessionTiming} from '../engine.mjs';
import {loadPreferences,savePreferences,profileFor,selectProfile,PREF_KEY} from '../preferences.mjs';
import {timerCue} from '../sounds.mjs';
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};};

test('running game retains its deadline and gets new durations at future boundaries',()=>{
 const s=fresh(5);toggle(s,0);updateSessionTiming(s,180000,45000,30000);
 assert.equal(s.remaining,210000);assert.equal(s.deadline,240000);assert.equal(s.phaseMs,240000);assert.equal(s.running,true);
 settle(s,240000);assert.equal(s.phase,'changeover');assert.equal(s.remaining,45000);
 settle(s,285000);assert.equal(s.game,2);assert.equal(s.remaining,180000);
});
test('paused game and current changeover retain remaining time; restart uses new full time',()=>{
 const s=fresh(4);toggle(s,0);toggle(s,60000);updateSessionTiming(s,300000,15000,90000);
 assert.equal(s.remaining,180000);assert.equal(s.running,false);assert.equal(s.deadline,null);
 toggle(s,100000);settle(s,280000);updateSessionTiming(s,120000,60000,285000);
 assert.equal(s.phase,'changeover');assert.equal(s.remaining,10000);assert.equal(s.deadline,295000);assert.equal(s.phaseMs,15000);
 settle(s,295000);assert.equal(s.remaining,120000);
 restartGame(s);assert.equal(s.remaining,120000);assert.equal(s.running,false);
});
test('ready game updates immediately; opening countdown retains its deadline and uses new game length',()=>{
 const s=fresh(3);s.startCountdown=true;updateSessionTiming(s,300000,20000,0);
 assert.equal(s.remaining,300000);toggle(s,0);updateSessionTiming(s,180000,10000,2000);
 assert.equal(s.phase,'countdown');assert.equal(s.deadline,5000);assert.equal(s.remaining,3000);
 settle(s,5000);assert.equal(s.remaining,180000);assert.equal(s.game,1);
});
test('new timing respects a hard cutoff and full-games-only admission',()=>{
 const s={...fresh(5),endAt:300000,endMode:'hard',minGameMs:1000};toggle(s,0);
 updateSessionTiming(s,300000,10000,30000);settle(s,250000);
 assert.equal(s.game,2);assert.equal(s.deadline,300000);settle(s,300000);assert.equal(s.finished,true);
 const full={...fresh(4),endAt:500000,endMode:'full'};toggle(full,0);
 updateSessionTiming(full,300000,30000,30000);settle(full,240000);assert.equal(full.finished,true);
});
test('duration edits validate before mutation and settle overdue phases before applying',()=>{
 const s=fresh(2);toggle(s,0);const snapshot=structuredClone(s);
 for(const bad of [0,1001,MAX_DURATION_MS+1000,NaN])assert.throws(()=>updateSessionTiming(s,bad,30000,1000));
 assert.throws(()=>updateSessionTiming(s,60000,0,1000));assert.deepEqual(s,snapshot);
 updateSessionTiming(s,60000,10000,245000);assert.equal(s.phase,'changeover');assert.equal(s.remaining,25000);
 settle(s,270000);assert.equal(s.remaining,60000);
 s.finished=true;assert.throws(()=>updateSessionTiming(s,60000,10000,270000));
});
test('one-minute warning uses actual game length after future-duration edit',()=>{
 const s=fresh(5);toggle(s,0);updateSessionTiming(s,30000,10000,0);settle(s,179000);
 const before={...s};settle(s,180000);assert.equal(timerCue(before,s,180000),'minute');
});
test('old preferences seed four independent profiles without losing explicit choices',()=>{
 const storage=memory();storage.setItem(PREF_KEY,JSON.stringify({setupTeams:3,gameMs:300000,changeMs:45000,sounds:false,endEnabled:false,colors:{A:'Purple',B:'Blue',C:'Green',D:'White',E:'Yellow'}}));
 const p=loadPreferences(storage);
 for(const teams of [2,3,4,5]){const profile=profileFor(p,teams);assert.equal(profile.gameMs,300000);assert.equal(profile.sounds,false);assert.equal(profile.colors.A,'Purple');}
 p.profiles[2].colors.A='Red';p.profiles[2].audioCues.minute=false;
 assert.equal(p.profiles[5].colors.A,'Purple');assert.equal(p.profiles[5].audioCues.minute,true);
});
test('separate defaults survive reload and session edits never replace them',()=>{
 const storage=memory(),p=loadPreferences(storage);
 for(const teams of [2,3,4,5]){selectProfile(p,teams);p.gameMs=teams*60000;p.changeMs=teams*10000;p.sounds=teams!==3;savePreferences(storage,p);}
 let loaded=loadPreferences(storage);
 for(const teams of [2,3,4,5]){selectProfile(loaded,teams);assert.equal(loaded.gameMs,teams*60000);assert.equal(loaded.changeMs,teams*10000);assert.equal(loaded.sounds,teams!==3);}
 const session=fresh(5,undefined,loaded.gameMs,loaded.changeMs);toggle(session,0);updateSessionTiming(session,90000,7000,1000);
 const resumed=JSON.parse(JSON.stringify(session));savePreferences(storage,loaded);loaded=loadPreferences(storage);
 assert.equal(resumed.gameMs,90000);assert.equal(loaded.gameMs,300000);assert.equal(loaded.changeMs,50000);
 move(resumed,1);assert.equal(resumed.remaining,90000);assert.throws(()=>selectProfile(loaded,6));
});
