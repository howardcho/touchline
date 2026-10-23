import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,toggle,settle,move,restartGame,adjustTime,changeTeamRoster,boardGames,matchup} from '../engine.mjs';
import {timerCue,changeoverCount} from '../sounds.mjs';
const opening=()=>({...fresh(5),startCountdown:true});
test('initial countdown lasts five seconds then starts game one with its full configured time',()=>{
 const s=opening();toggle(s,0);assert.equal(s.phase,'countdown');assert.equal(s.remaining,5000);
 for(let n=4;n>=1;n--){const before={...s};settle(s,(5-n)*1000);assert.equal(changeoverCount(before,s,(5-n)*1000),n);}
 const before={...s};settle(s,5000);assert.equal(s.game,1);assert.equal(s.phase,'game');assert.equal(s.remaining,s.gameMs);assert.equal(s.countdownDone,true);assert.equal(timerCue(before,s,5000),'start');
});
test('countdown pauses, survives serialization, resumes, and cannot be extended by timer adjustments',()=>{
 let s=opening();toggle(s,0);toggle(s,1600);assert.equal(s.remaining,3400);s=JSON.parse(JSON.stringify(s));
 const old=structuredClone(s);adjustTime(s,30000,5000);assert.deepEqual(s,old);
 toggle(s,10000);settle(s,13399);assert.equal(s.phase,'countdown');settle(s,13400);assert.equal(s.remaining,s.gameMs);assert.equal(s.phase,'game');
});
test('disabling initial countdown starts immediately and restarting an underway game does not repeat it',()=>{
 const off={...fresh(5),startCountdown:false};toggle(off,0);assert.equal(off.phase,'game');assert.equal(off.remaining,off.gameMs);
 const s=opening();toggle(s,0);settle(s,5000);restartGame(s);toggle(s,6000);assert.equal(s.phase,'game');assert.equal(s.game,1);
});
test('queued roster change during countdown is previewed and applies at first kickoff without a fake completed game',()=>{
 const s=opening();toggle(s,0);changeTeamRoster(s,'remove','Blue',1000);
 const before=boardGames(s);assert.equal(before[0].teams,4);assert.deepEqual(Object.values(before[0].colors),['Red','Green','Black','Yellow']);
 settle(s,5000);assert.equal(s.game,1);assert.equal(s.teams,4);assert.equal(s.teamHistory.length,0);assert.deepEqual(boardGames(s)[0].colors,before[0].colors);
});
test('changeover advances both displayed matchups; kickoff keeps them and flips titles',()=>{
 const s=fresh(5);toggle(s,0);settle(s,s.gameMs);
 const waiting=boardGames(s);assert.deepEqual(waiting.map(m=>m.title),['UP NEXT','AFTER THAT']);assert.deepEqual(waiting.map(m=>m.game),[2,3]);
 settle(s,s.gameMs+s.changeMs);const playing=boardGames(s);assert.deepEqual(playing.map(m=>m.title),['NOW PLAYING','UP NEXT']);assert.deepEqual(playing.map(m=>m.match),waiting.map(m=>m.match));
});
test('changeover cards agree with queued roster kickoff, including loop boundaries',()=>{
 const s=fresh(5);s.game=20;toggle(s,0);changeTeamRoster(s,'remove','Blue',1000);settle(s,s.gameMs);
 const waiting=boardGames(s);assert.deepEqual(waiting.map(m=>m.game),[1,2]);assert.equal(waiting[0].teams,4);assert.deepEqual(waiting.map(m=>m.match),[1,2].map(n=>matchup(4,n)));
 settle(s,s.gameMs+s.changeMs);assert.deepEqual(boardGames(s).map(m=>m.colors),waiting.map(m=>m.colors));assert.deepEqual(boardGames(s).map(m=>m.match),waiting.map(m=>m.match));
});
test('end-time fit includes opening countdown; hard cutoff and background catch-up stay exact',()=>{
 const tooShort={...opening(),endAt:124999,endMode:'hard',minGameMs:120000};toggle(tooShort,0);assert.equal(tooShort.finished,true);
 const a={...opening(),endAt:650000,endMode:'hard',minGameMs:60000},b=structuredClone(a);toggle(a,0);toggle(b,0);settle(a,1000000);
 for(let now=1000;now<=1000000;now+=1000)settle(b,now);assert.deepEqual(a,b);assert.equal(a.finishedAt,650000);
 const paused={...opening(),endAt:180000,endMode:'hard',minGameMs:120000};toggle(paused,0);toggle(paused,1000);toggle(paused,170000);assert.equal(paused.finished,true);
});
