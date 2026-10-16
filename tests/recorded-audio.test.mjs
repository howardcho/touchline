import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MatchSounds,AUDIO_FILES,calloutKey,TEAM_CALLOUTS} from '../sounds.mjs';
import {loadPreferences,savePreferences,PREF_KEY} from '../preferences.mjs';
function fixture(){
 const sounds=new MatchSounds(),sources=[];
 sounds.speech={cancel(){},speak(){throw Error('Recorded voice should be used');}};
 sounds.context={state:'running',currentTime:10,destination:{},createGain:()=>({gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}}),createBufferSource:()=>{
  const source={connect(){},disconnect(){},start(...args){this.startArgs=args;},stop(){this.stopped=true;}};sources.push(source);return source;
 }};
 for(const name of Object.keys(AUDIO_FILES))sounds.buffers.set(name,{duration:name==='crowd'?6:name==='referee'?1.9:0.6,name});
 return {sounds,sources};
}
test('recorded whistle has three distinct blasts; optional crowd follows the last blast',()=>{
 const {sounds,sources}=fixture();sounds.play('whistle');assert.equal(sources.length,3);
 assert.deepEqual(sources.map(s=>s.startArgs[2]),[0.4,0.45,1.6]);
 sounds.stop();sources.length=0;sounds.play('whistle',{crowd:true});assert.equal(sources.length,4);
 assert.equal(sources[3].buffer.name,'crowd');assert.ok(sources[3].startArgs[0]>=sources[2].startArgs[0]+sources[2].startArgs[2]);
 sounds.stop();assert.ok(sources.every(s=>s.stopped));assert.equal(sounds.active.size,0);
});
test('recorded countdown cancels crowd and previous voices, and kickoff clears effects',()=>{
 const {sounds,sources}=fixture();sounds.play('whistle',{crowd:true});sounds.sayCount(5);
 assert.ok(sources.slice(0,4).every(s=>s.stopped));assert.equal(sources[4].buffer.name,'count-5');
 sounds.sayCount(4);assert.ok(sources[4].stopped);assert.equal(sources[5].buffer.name,'count-4');
 sounds.play('start');assert.ok(sources[5].stopped);assert.equal(sources[6].buffer.name,'referee');assert.equal(sources[6].startArgs[2],1.25);
 sounds.play('minute');assert.equal(sources[7].buffer.name,'minute');sounds.stop();assert.ok(sources[7].stopped);
});
test('crowd choice defaults on and persists independently of master mute',()=>{
 let raw=null;const storage={getItem:k=>k===PREF_KEY?raw:null,setItem:(k,v)=>{raw=v;}};
 const prefs=loadPreferences(storage);assert.equal(prefs.crowd,true);prefs.crowd=true;prefs.sounds=false;
 savePreferences(storage,prefs);assert.equal(loadPreferences(storage).crowd,true);assert.equal(loadPreferences(storage).sounds,false);
});
test('all bundled audio and credits are present in the offline cache list',async()=>{
 const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');
 for(const file of [...Object.values(AUDIO_FILES),'CREDITS.txt']){
  const bytes=await readFile(new URL(`../audio/${file}`,import.meta.url));assert.ok(bytes.length>100);assert.ok(sw.includes(`./audio/${file}`));
 }
});
test('decode failures preserve other recordings and are reported without rejecting audio readiness',async()=>{
 const savedFetch=globalThis.fetch;
 try {
  globalThis.fetch=async url=>({ok:!url.pathname.endsWith('/crowd.mp3'),arrayBuffer:async()=>new ArrayBuffer(16)});
  const sounds=new MatchSounds();let decodes=0;sounds.context={decodeAudioData:async()=>{decodes++;return {duration:1};}};
  await sounds.load();await sounds.load();assert.deepEqual(sounds.failedAssets,['crowd']);assert.equal(sounds.buffers.size,Object.keys(AUDIO_FILES).length-1);assert.equal(decodes,Object.keys(AUDIO_FILES).length-1);
 } finally {globalThis.fetch=savedFetch;}
});

test('lineup recordings play the requested pairs in order and kickoff cancels both complete sentences',()=>{
 const {sounds,sources}=fixture();assert.equal(sounds.sayTeams(['Red','Blue'],['Purple','Black'],{delay:3.55}),true);
 assert.deepEqual(sources.map(s=>s.buffer.name),['up-Red-Blue','deck-Black-Purple']);
 assert.ok(sources[0].startArgs[0]>=13.55);
 for(let i=1;i<sources.length;i++)assert.ok(sources[i].startArgs[0]>sources[i-1].startArgs[0]);
 sounds.play('start');assert.ok(sources.slice(0,2).every(s=>s.stopped));
 assert.equal(sounds.sayTeams(['Invalid','Blue'],['Purple','Black']),false);
});

test('complete callouts cover both instructions for every distinct color pairing in either order',()=>{
 const colors=['Red','Blue','Green','Black','Yellow','Orange','Purple','Pink','White','Gray'];
 assert.equal(TEAM_CALLOUTS.length,90);
 for(const a of colors)for(const b of colors)for(const role of ['up','deck']){
  const key=calloutKey([a,b],role);
  if(a===b)assert.equal(key,null);
  else{assert.ok(AUDIO_FILES[key]);assert.equal(key,calloutKey([b,a],role));}
 }
});
