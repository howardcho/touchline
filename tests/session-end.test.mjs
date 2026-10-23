import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,toggle,settle,adjustTime,changeTeamRoster} from '../engine.mjs';
import {resolveSessionEnd} from '../session.mjs';
function session(mode='hard',endAt=650000,minGameMs=60000){return {...fresh(5),endMode:mode,endAt,minGameMs};}
test('hard stop plays a qualifying partial last game, soft finishes it, full-only skips it',()=>{
 const expectations={hard:[3,650000],soft:[3,780000],full:[2,510000]};
 for(const mode of Object.keys(expectations)){
  const s=session(mode);toggle(s,0);settle(s,2000000);
  assert.equal(s.finished,true);assert.equal(s.running,false);assert.equal(s.remaining,0);
  assert.deepEqual([s.game,s.finishedAt],expectations[mode]);
 }
});
test('minimum partial duration is inclusive and shorter final slots are skipped',()=>{
 const yes=session('hard',120000,120000);toggle(yes,0);assert.equal(yes.remaining,120000);assert.equal(yes.phaseMs,120000);settle(yes,120000);assert.equal(yes.finishedAt,120000);
 const no=session('hard',119999,120000);toggle(no,0);assert.equal(no.finished,true);assert.equal(no.phaseStarted,false);assert.equal(no.finishReason,'insufficient-time');
 const future=session('hard',650000,120000);toggle(future,0);settle(future,650000);assert.equal(future.game,2);assert.equal(future.finishedAt,510000);
});
test('hard final game timer and progress use its shortened duration',()=>{
 const s=session();toggle(s,0);settle(s,540000);assert.equal(s.game,3);assert.equal(s.phase,'game');assert.equal(s.remaining,110000);assert.equal(s.phaseMs,110000);
});
test('full games exactly fitting the end time are played, with no trailing changeover',()=>{
 const s=session('full',510000);toggle(s,0);settle(s,510000);assert.equal(s.game,2);assert.equal(s.phase,'game');assert.equal(s.finishedAt,510000);
});
test('pause does not shift hard end time; resume and added time remain capped',()=>{
 const s=session('hard',300000);toggle(s,0);toggle(s,60000);assert.equal(s.remaining,180000);
 toggle(s,180000);assert.equal(s.remaining,120000);adjustTime(s,30000,200000);assert.equal(s.deadline,300000);
 settle(s,300000);assert.equal(s.finished,true);assert.equal(s.finishedAt,300000);adjustTime(s,30000,310000);assert.equal(s.remaining,0);
});
test('hard and manual sessions expire while paused, but soft can resume an underway game',()=>{
 const hard=session();settle(hard,650000);assert.equal(hard.finished,true);
 const soft=session('soft',300000);toggle(soft,0);toggle(soft,100000);settle(soft,350000);assert.equal(soft.finished,undefined);toggle(soft,350000);settle(soft,500000);assert.equal(soft.finished,true);assert.equal(soft.finishedAt,490000);
 const unstarted=session('soft',300000);settle(unstarted,300000);assert.equal(unstarted.finished,true);
});
test('background catch-up agrees with stepped time for end rules and queued rosters',()=>{
 for(const mode of ['hard','soft','full']){
  const a=session(mode),b=session(mode);toggle(a,0);toggle(b,0);
  changeTeamRoster(a,'remove','Blue',100000);changeTeamRoster(b,'remove','Blue',100000);
  settle(a,2000000);for(let now=100000;now<=2000000;now+=1000)settle(b,now);
  assert.deepEqual(a,b);assert.equal(a.teams,4);assert.equal(a.finished,true);
 }
});
test('end settings resolve to later today only; untimed sessions stay unlimited',()=>{
 const now=new Date(2026,9,16,18,0).getTime();
 const prefs={endEnabled:true,endTime:'20:30',endMode:'hard',minGameMs:120000,gameMs:240000};
 assert.equal(resolveSessionEnd(prefs,now).endAt,new Date(2026,9,16,20,30).getTime());
 assert.throws(()=>resolveSessionEnd({...prefs,endTime:'17:00'},now));assert.deepEqual(resolveSessionEnd({...prefs,endTime:'17:00'},now,true),{});assert.throws(()=>resolveSessionEnd({...prefs,endTime:'25:00'},now));assert.deepEqual(resolveSessionEnd({...prefs,endEnabled:false},now),{});
});

test('short final kickoff and final whistle are detected once and stale final cues are skipped',async()=>{
 const {timerCue}=await import('../sounds.mjs');
 const s=session();toggle(s,0);settle(s,539800);let before={...s};settle(s,540000);assert.equal(timerCue(before,s,540000),'start');
 before={...s};settle(s,650000);assert.equal(timerCue(before,s,650000),'whistle');assert.equal(timerCue({...s},s,650200),null);
 const late=session();toggle(late,0);before={...late};settle(late,900000);assert.equal(timerCue(before,late,900000),null);
});
test('lineup colors follow the next cycle after a queued chosen-team removal',async()=>{
 const {lineupFor}=await import('../sounds.mjs');
 const s=fresh(5);toggle(s,0);changeTeamRoster(s,'remove','Blue',100000);settle(s,240000);
 assert.deepEqual(lineupFor(s).up,['Red','Green']);assert.deepEqual(lineupFor(s).deck,['Black','Yellow']);
 assert.match(lineupFor(s).text,/Team Red and team Green, you're up!/);
});
