import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {MatchSounds,AUDIO_FILES} from '../sounds.mjs';
import {NativeMatchSounds,createMatchSounds} from '../native-audio.mjs';
const fixture=()=>{
 const commands=[],durations=Object.fromEntries(Object.keys(AUDIO_FILES).map(key=>[key,key==='referee'?1.9:key==='crowd'?6:1.3]));
 const bridge={postMessage:async command=>{commands.push(command);return command.action==='prepare'?durations:null;}};
 return {sounds:new NativeMatchSounds(bridge),bridge,commands};
};
test('native audio prepares bundled recordings without a browser AudioContext',async()=>{
 const {sounds,commands,bridge}=fixture();assert.equal(await sounds.unlock(),true);
 assert.equal(sounds.context,null);assert.deepEqual(sounds.failedAssets,[]);
 assert.deepEqual(commands,[{action:'prepare'}]);
 assert.ok(createMatchSounds({webkit:{messageHandlers:{touchlineAudio:bridge}}}) instanceof NativeMatchSounds);
 assert.ok(createMatchSounds({touchlineNative:{audio:bridge}}) instanceof NativeMatchSounds);
 assert.equal(createMatchSounds({}).constructor,MatchSounds);
});
test('native whistle and crowd retain the existing full-time timing and mix',async()=>{
 const {sounds,commands}=fixture();await sounds.unlock();sounds.play('whistle',{crowd:true,crowdVolume:0.15});
 const clips=commands.filter(command=>command.action==='play');
 assert.deepEqual(clips.map(({name,at,duration,volume,group})=>({name,at,duration,volume,group})),[
  {name:'referee',at:0,duration:0.4,volume:0.8,group:'whistle'},
  {name:'referee',at:0.85,duration:0.45,volume:0.8,group:'whistle'},
  {name:'referee',at:1.75,duration:1.6,volume:0.8,group:'whistle'},
  {name:'crowd',at:3.35,duration:6,volume:0.15,group:'crowd'}
 ]);
});
test('native team speech uses complete clips and countdown cancels competing cues',async()=>{
 const {sounds,commands}=fixture();await sounds.unlock();sounds.sayTeams(['Blue','Red'],['Purple','Black'],{delay:3.55});
 const clips=commands.filter(command=>command.action==='play');
 assert.equal(clips[0].name,'up-Red-Blue');assert.equal(clips[0].at,3.55);
 assert.equal(clips[1].name,'deck-Black-Purple');assert.equal(clips[1].at,5.1);
 sounds.sayCount(5);assert.deepEqual(commands.slice(-4).map(command=>command.group),['whistle','crowd','voice','voice']);
 assert.equal(commands.at(-1).name,'count-5');
 sounds.previewCountdown();sounds.stop();assert.equal(sounds.previewTimers.size,0);assert.equal(commands.at(-1).action,'stop');assert.ok(sounds.generation>0);
});
test('native bridge failure does not start browser audio',async()=>{
 const sounds=new NativeMatchSounds({postMessage:async()=>{throw new Error('unavailable');}});
 assert.equal(await sounds.unlock(),false);assert.equal(sounds.context,null);
});
test('native pre-duck can be canceled before its queued cue plays',async()=>{
 const {sounds,commands}=fixture();await sounds.unlock();
 assert.equal(sounds.prime(),true);sounds.stop();
 const actions=commands.slice(1).map(({action})=>action);
 assert.equal(actions[0],'prime');assert.equal(actions.at(-1),'stop');assert.ok(actions.indexOf('prime')<actions.indexOf('stop'));
});
test('offline packaged UI boots with native audio and preserves shared settings/session separation',()=>{
 execFileSync('python3',['ios/prepare_web.py'],{cwd:new URL('..',import.meta.url)});
 const elements=new Map(),stored=new Map(),element=id=>{
  if(!elements.has(id))elements.set(id,{checked:false,hidden:false,style:{},textContent:'',setAttribute(){},addEventListener(){},querySelectorAll(){return [];}});
  return elements.get(id);
 };
 const context=vm.createContext({console,structuredClone,setInterval(){},setTimeout,clearTimeout,
  localStorage:{getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)},
  document:{getElementById:element,querySelectorAll:()=>[],addEventListener(){},visibilityState:'visible'},
  navigator:{},webkit:{messageHandlers:{touchlineAudio:{postMessage:async()=>({})},touchlineHost:{postMessage(){}}}},
  window:{addEventListener(){}}});
 const bundle=readFileSync(new URL('../ios/Touchline/Web/touchline.js',import.meta.url),'utf8');
 vm.runInContext(bundle,context);
 assert.equal(element('setup-time').textContent,'04:00');assert.equal(element('setup-changeover').textContent,'00:30');
 assert.equal(element('setup').hidden,false);assert.equal(element('install-button').hidden,true);
 assert.equal(JSON.parse(stored.get('touchline-preferences-v1')).profiles[5].gameMs,240000);
 const html=readFileSync(new URL('../ios/Touchline/Web/index.html',import.meta.url),'utf8');
 assert.ok(html.includes('<script src="touchline.js"></script>'));assert.ok(!html.includes('type="module"'));
});
