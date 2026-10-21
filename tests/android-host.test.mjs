import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {AUDIO_FILES,MatchSounds} from '../sounds.mjs';
import {createMatchSounds,NativeMatchSounds} from '../native-audio.mjs';
const adapter=readFileSync(new URL('../android/host.js',import.meta.url),'utf8');

test('Android bridge uses native audio, preserving payloads and reported failures',async()=>{
 const commands=[];
 const context=vm.createContext({window:{TouchlineAndroid:{request(raw){
  const command=JSON.parse(raw);commands.push(command);
  if(command.action==='prepare')return JSON.stringify({value:Object.fromEntries(Object.keys(AUDIO_FILES).map(key=>[key,2]))});
  if(command.action==='bad')return JSON.stringify({error:'Native playback failed'});
  return JSON.stringify({value:null});
 }}}});
 vm.runInContext(adapter,context);
 const host=context.window.touchlineNative;
 const sounds=createMatchSounds({touchlineNative:host});
 assert.ok(sounds instanceof NativeMatchSounds);
 assert.equal(await sounds.unlock(),true);assert.equal(sounds.context,null);assert.deepEqual(sounds.failedAssets,[]);
 sounds.play('start');
 assert.equal(commands.find(c=>c.action==='play').name,'referee');
 host.postMessage({keepAwake:true});assert.deepEqual(commands.at(-1),{action:'keepAwake',enabled:true});
 host.postMessage({keepAwake:false});assert.deepEqual(commands.at(-1),{action:'keepAwake',enabled:false});
 host.setClockView(true);host.setClockView(true);host.setClockView(false);
 assert.deepEqual(commands.filter(c=>c.action==='fullscreen'),[{action:'fullscreen',enabled:true},{action:'fullscreen',enabled:false}]);
 await assert.rejects(host.audio.postMessage({action:'bad'}),/Native playback failed/);
 sounds.stop();assert.equal(commands.at(-1).action,'stop');
 assert.equal(createMatchSounds({}).constructor,MatchSounds);
});

test('Android offline bundle boots the shared UI and ships the exact audio catalog',()=>{
 execFileSync('python3',['android/prepare_web.py'],{cwd:new URL('..',import.meta.url)});
 const root=new URL('../android/app/src/main/assets/',import.meta.url);
 const catalog=JSON.parse(readFileSync(new URL('audio-catalog.json',root)));
 assert.deepEqual(catalog,AUDIO_FILES);
 for(const file of Object.values(catalog))assert.ok(existsSync(new URL(`audio/${file}`,root)));
 const elements=new Map(),stored=new Map(),commands=[];
 const element=id=>{
  if(!elements.has(id))elements.set(id,{checked:false,hidden:false,style:{},textContent:'',setAttribute(){},addEventListener(){},querySelectorAll(){return [];}});
  return elements.get(id);
 };
 const context=vm.createContext({console,structuredClone,setInterval(){},setTimeout,clearTimeout,
  localStorage:{getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)},
  document:{getElementById:element,querySelectorAll:()=>[],addEventListener(){},visibilityState:'visible'},
  navigator:{serviceWorker:{register(){throw new Error('Native app must not register a service worker');}}},
  window:{addEventListener(){},TouchlineAndroid:{request(raw){commands.push(JSON.parse(raw));return '{"value":null}';}}}
 });
 vm.runInContext(adapter,context);
 context.touchlineNative=context.window.touchlineNative;
 vm.runInContext(readFileSync(new URL('touchline.js',root),'utf8'),context);
 assert.equal(element('setup').hidden,false);assert.equal(element('install-button').hidden,true);
 assert.deepEqual(commands.filter(c=>c.action==='fullscreen'),[{action:'fullscreen',enabled:false}]);
 assert.equal(element('setup-time').textContent,'04:00');assert.equal(element('wake').disabled,undefined);
 assert.equal(JSON.parse(stored.get('touchline-preferences-v1')).profiles[5].gameMs,240000);
 const html=readFileSync(new URL('index.html',root),'utf8');
 assert.ok(html.indexOf('android-host.js')<html.indexOf('touchline.js'));
 assert.ok(!html.includes('type="module"'));
});
