import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,toggle,settle,applySettings,GAME_MS,CHANGE_MS,MAX_DURATION_MS} from '../engine.mjs';
import {loadPreferences,savePreferences,PREF_KEY,durationOK} from '../preferences.mjs';
import {timerCue,changeoverCount,SOUND_PLANS,MatchSounds} from '../sounds.mjs';
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
test('preferences retain five ordered colors, durations and mute across reload',()=>{
 const storage=memory(), prefs=loadPreferences(storage);
 prefs.colors={A:'White',B:'Blue',C:'Pink',D:'Black',E:'Yellow'};
 prefs.gameMs=90000;prefs.changeMs=45000;prefs.sounds=false;
 assert.equal(savePreferences(storage,prefs),true);assert.deepEqual(loadPreferences(storage),prefs);
});
test('preferences accept normalized 61-second and 61-minute timers',()=>{
 assert.equal(durationOK(61000),true);assert.equal(durationOK(61*60000),true);assert.equal(durationOK(MAX_DURATION_MS+1000),false);
 const storage=memory(),prefs=loadPreferences(storage);prefs.gameMs=61000;prefs.changeMs=61*60000;savePreferences(storage,prefs);
 const restored=loadPreferences(storage);assert.equal(restored.gameMs,61000);assert.equal(restored.changeMs,61*60000);
});
test('malformed preferences, storage denial and old duration migrate safely',()=>{
 const storage=memory();storage.setItem('touchline-game-duration','150000');assert.equal(loadPreferences(storage).gameMs,150000);
 storage.setItem(PREF_KEY,JSON.stringify({gameMs:-1,changeMs:0,sounds:'yes',colorsByTeams:{4:{A:'Red',B:'Red'}}}));
 const prefs=loadPreferences(storage);assert.equal(prefs.gameMs,150000);assert.equal(prefs.changeMs,CHANGE_MS);assert.equal(prefs.sounds,true);assert.equal(new Set(Object.values(prefs.colors)).size,5);
 storage.setItem(PREF_KEY,'{');assert.equal(loadPreferences(storage).gameMs,GAME_MS);
 const denied={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};assert.equal(savePreferences(denied,prefs),false);assert.equal(loadPreferences(denied).gameMs,GAME_MS);
});
test('custom changeover boundaries, pause and catch-up use selected duration',()=>{
 const a=fresh(5,undefined,90000,45000), b=structuredClone(a);toggle(a,0);toggle(b,0);
 settle(a,90000);assert.equal(a.phase,'changeover');assert.equal(a.remaining,45000);
 toggle(a,100000);assert.equal(a.remaining,35000);toggle(a,100000);
 settle(a,135000);assert.equal(a.game,2);assert.equal(a.remaining,90000);
 const now=100*135000+100000;settle(a,now);for(let t=10000;t<now;t+=10000)settle(b,t);settle(b,now);assert.deepEqual(a,b);
});
test('invalid changeover never mutates state and editing it pauses and resets current game',()=>{
 const s=fresh(4), before=structuredClone(s);for(const time of [0,999,1001,MAX_DURATION_MS+1000,NaN]){assert.throws(()=>applySettings(s,s.colors,s.gameMs,0,time));assert.deepEqual(s,before);}
 toggle(s,0);settle(s,GAME_MS+5000);applySettings(s,s.colors,s.gameMs,GAME_MS+5000,45000);
 assert.equal(s.phase,'game');assert.equal(s.remaining,GAME_MS);assert.equal(s.running,false);assert.equal(s.changeMs,45000);
});
test('one-minute announcement triggers only on crossing one minute and never repeats or sounds in changeover',()=>{
 const s=fresh(5);toggle(s,0);settle(s,179800);let before={...s};settle(s,180000);assert.equal(timerCue(before,s,180000),'minute');
 before={...s};settle(s,180200);assert.equal(timerCue(before,s,180200),null);
 const short=fresh(4,undefined,60000);toggle(short,0);let old={...short};settle(short,200);assert.equal(timerCue(old,short,200),null);
});
test('full-time whistle, automatic kickoff whistle and background suppression',()=>{
 const s=fresh(5);toggle(s,0);let before={...s};settle(s,GAME_MS);assert.equal(timerCue(before,s,GAME_MS),'whistle');
 before={...s};settle(s,GAME_MS+CHANGE_MS);assert.equal(timerCue(before,s,GAME_MS+CHANGE_MS),'start');
 before={...s};settle(s,2*(GAME_MS+CHANGE_MS)+10000);assert.equal(timerCue(before,s,2*(GAME_MS+CHANGE_MS)+10000),null);
 const late=fresh(5);toggle(late,0);before={...late};settle(late,200000);assert.equal(timerCue(before,late,200000),null);
});
test('whistle has two separated short blasts followed by a longer third blast',()=>{
 const p=SOUND_PLANS.whistle;assert.equal(p.length,3);assert.ok(p[1].at>p[0].at+p[0].duration);assert.ok(p[2].at>p[1].at+p[1].duration);assert.ok(p[2].duration>3*p[1].duration);
});
test('audio schedules the full whistle and stop cancels all active voices',async()=>{
 const started=[], stopped=[];
 const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}});
 const context={currentTime:0,state:'running',createGain:()=>({gain:param(),connect(){},disconnect(){}}),createBiquadFilter:()=>({frequency:param(),connect(){},disconnect(){}}),createOscillator:()=>({frequency:param(),connect(){},disconnect(){},start:t=>started.push(t),stop:t=>stopped.push(t)})};
 const sounds=new MatchSounds();sounds.context=context;assert.equal(sounds.play('whistle'),true);assert.equal(started.length,6);assert.equal(sounds.active.size,6);assert.ok(Math.max(...stopped)>1.5);sounds.play('start');assert.equal(sounds.active.size,8);sounds.stop();assert.equal(sounds.active.size,0);
});

test('kickoff stays one long whistle and full-time blasts are slower and longer',()=>{
 assert.equal(SOUND_PLANS.start.length,1);assert.ok(SOUND_PLANS.start[0].duration>=0.8);
 const p=SOUND_PLANS.whistle;
 assert.ok(p[0].duration>=0.4);assert.ok(p[1].duration>=0.4);assert.ok(p[2].duration>=1.5);
 assert.ok(p[1].at-p[0].duration>=0.4);assert.ok(p[2].at-p[1].at-p[1].duration>=0.4);
 assert.ok(p[2].at+p[2].duration>=3);
});
test('changeover speaks each of 5 to 1 once at its threshold, then kickoff whistle',()=>{
 const s=fresh(5);toggle(s,0);settle(s,GAME_MS+CHANGE_MS-5200);
 for(let n=5;n>=1;n--) {
  let before={...s}, now=GAME_MS+CHANGE_MS-n*1000;settle(s,now);assert.equal(changeoverCount(before,s,now),n);
  before={...s};settle(s,now+200);assert.equal(changeoverCount(before,s,now+200),null);
 }
 const before={...s};settle(s,GAME_MS+CHANGE_MS);assert.equal(changeoverCount(before,s,GAME_MS+CHANGE_MS),null);assert.equal(timerCue(before,s,GAME_MS+CHANGE_MS),'start');
});
test('countdown handles short changeovers, paused timers and skips stale digits',()=>{
 const s=fresh(4,undefined,10000,3000);toggle(s,0);let before={...s};settle(s,10000);assert.equal(changeoverCount(before,s,10000),3);
 before={...s};settle(s,11500);assert.equal(changeoverCount(before,s,11500),null);
 before={...s};settle(s,12000);assert.equal(changeoverCount(before,s,12000),1);
 const paused={...s,running:false};assert.equal(changeoverCount(paused,paused,12000),null);
});
test('spoken numbers replace queued speech and stop cancels speech',()=>{
 const said=[], canceled=[];class Utterance {constructor(text){this.text=text;}}
 const sounds=new MatchSounds();sounds.Utterance=Utterance;sounds.speech={cancel:()=>canceled.push(true),speak:u=>said.push(u),getVoices:()=>[{lang:'en-US',localService:true}]};
 sounds.sayCount(5);sounds.sayCount(4);assert.deepEqual(said.map(u=>u.text),['5','4']);assert.ok(said[0].voice.localService);assert.equal(sounds.sayCount(0),false);sounds.stop();assert.equal(canceled.length,3);
});

test('one-minute cue speaks exact message at a clear rate and can be canceled',()=>{
 const said=[];let canceled=0;class Utterance {constructor(text){this.text=text;}}
 const sounds=new MatchSounds();sounds.Utterance=Utterance;
 sounds.speech={cancel:()=>canceled++,speak:u=>said.push(u),getVoices:()=>[{lang:'en-US',localService:true}]};
 assert.equal(sounds.play('minute'),true);assert.equal(said[0].text,'One minute remaining');assert.equal(said[0].rate,1);assert.ok(said[0].voice.localService);
 sounds.stop();assert.equal(canceled,2);
});
