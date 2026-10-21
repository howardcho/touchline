import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,toggle,settle,boardGames,jumpToBoardGame,changeTeamRoster} from '../engine.mjs';
import {timerCue,MatchSounds,AUDIO_FILES} from '../sounds.mjs';
import {loadPreferences,soundEnabled} from '../preferences.mjs';

test('30 and 10 second warnings cross once during a game and stay quiet in changeover',()=>{
 const s=fresh(5);toggle(s,0);
 for(const [now,cue] of [[179800,null],[180000,'minute'],[180200,null],[209800,null],[210000,'thirty'],[210200,null],[229800,null],[230000,'ten'],[230200,null],[240000,'whistle'],[250000,null]]){
  const before={...s};settle(s,now);assert.equal(timerCue(before,s,now),cue,`at ${now}`);
 }
});
test('short games skip warnings at kickoff; paused and stale transitions never warn',()=>{
 for(const [duration,at,expected] of [[30000,0,null],[30000,20000,'ten'],[10000,0,null]]){
  const s=fresh(4,undefined,duration);toggle(s,0);const before={...s};settle(s,at);assert.equal(timerCue(before,s,at),expected);
 }
 const s=fresh(4);toggle(s,0);let before={...s};settle(s,235000);assert.equal(timerCue(before,s,235000),null);
 toggle(s,235000);before={...s};settle(s,240000);assert.equal(timerCue(before,s,240000),null);
 const late=fresh(5,undefined,40000,1000);toggle(late,0);before={...late};settle(late,71500);assert.equal(timerCue(before,late,71500),null);
});
test('new warnings default on independently and play the matching recordings',()=>{
 const p=loadPreferences({getItem:()=>null});assert.equal(soundEnabled(p,'thirty'),true);assert.equal(soundEnabled(p,'ten'),true);
 p.audioCues.thirty=false;assert.equal(soundEnabled(p,'thirty'),false);assert.equal(soundEnabled(p,'ten'),true);
 const sounds=new MatchSounds(),played=[];sounds.buffers=new Map([['thirty',{}],['ten',{}]]);sounds.stopSpeech=()=>{};sounds.recorded=name=>played.push(name);
 sounds.play('thirty');sounds.play('ten');assert.deepEqual(played,['thirty','ten']);assert.equal(AUDIO_FILES.thirty,'thirty.mp3');
});
test('jump selects the exact displayed match, pauses at full duration, and skips opening countdown',()=>{
 for(const phase of ['game','changeover','countdown'])for(const card of [1,2]){
  const s=fresh(5);s.startCountdown=phase==='countdown';toggle(s,0);if(phase==='changeover')settle(s,s.gameMs);
  const target=boardGames(s)[card];jumpToBoardGame(s,card);
  assert.equal(s.game,target.game);assert.equal(s.phase,'game');assert.equal(s.running,false);assert.equal(s.remaining,s.gameMs);
  assert.deepEqual(boardGames(s)[0].match,target.match);assert.equal(s.countdownDone,true);toggle(s,300000);assert.equal(s.phase,'game');
 }
});
test('jumps respect pending roster and numeric game-number collisions across a fresh cycle',()=>{
 for(const card of [1,2])for(const changing of [false,true]){
  const s=fresh(5);s.game=card;toggle(s,0);changeTeamRoster(s,'remove','Blue',1000);if(changing)settle(s,s.gameMs);
  const target=boardGames(s)[card];jumpToBoardGame(s,card);
  assert.equal(s.teams,4);assert.equal(s.game,target.game);assert.deepEqual(s.colors,target.colors);assert.deepEqual(boardGames(s)[0].match,target.match);assert.equal(s.pendingTeams,undefined);
 }
 const opening={...fresh(5),startCountdown:true};toggle(opening,0);changeTeamRoster(opening,'remove','Blue',1000);jumpToBoardGame(opening,1);assert.equal(opening.teamHistory.length,0);
});
test('jump wraps schedules normally, keeps cutoff/settings, and cannot change finished sessions',()=>{
 const s={...fresh(5,undefined,300000,45000),game:20,endAt:900000,endMode:'hard',minGameMs:60000};
 const target=boardGames(s)[2];jumpToBoardGame(s,2);assert.equal(s.game,22);assert.equal(boardGames(s)[0].match,target.match);assert.equal(s.endAt,900000);assert.equal(s.changeMs,45000);
 assert.throws(()=>jumpToBoardGame(s,3));s.finished=true;const original=structuredClone(s);jumpToBoardGame(s,1);assert.deepEqual(s,original);
});
