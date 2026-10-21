import test from 'node:test';
import assert from 'node:assert/strict';
import {AUDIO_CUES,loadPreferences,savePreferences,PREF_KEY,soundEnabled} from '../preferences.mjs';
function memory(initial={}){const data=new Map([[PREF_KEY,JSON.stringify(initial)]]);return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};}
test('existing settings retain master mute and crowd choice while new cue toggles default on',()=>{
 const prefs=loadPreferences(memory({sounds:false,crowd:true}));
 assert.deepEqual(prefs.audioCues,{start:true,minute:true,thirty:true,ten:true,whistle:true,countdown:true,lineup:true});
 for(const cue of [...AUDIO_CUES,'crowd'])assert.equal(soundEnabled(prefs,cue),false);
 prefs.sounds=true;assert.equal(soundEnabled(prefs,'crowd'),true);
});
test('each cue can be independently muted and the choices survive reopening',()=>{
 for(const muted of AUDIO_CUES){
  const storage=memory(),prefs=loadPreferences(storage);prefs.audioCues[muted]=false;prefs.crowd=true;
  savePreferences(storage,prefs);const restored=loadPreferences(storage);
  for(const cue of AUDIO_CUES)assert.equal(soundEnabled(restored,cue),cue!==muted);
  assert.equal(soundEnabled(restored,'crowd'),true);
  restored.sounds=false;assert.equal(soundEnabled(restored,'crowd'),false);
  restored.sounds=true;assert.equal(soundEnabled(restored,muted),false);
 }
});
test('invalid cue preferences recover safely and unknown sounds are disabled',()=>{
 const prefs=loadPreferences(memory({audioCues:{start:false,minute:'false',whistle:null,countdown:0}}));
 assert.deepEqual(prefs.audioCues,{start:false,minute:true,thirty:true,ten:true,whistle:true,countdown:true,lineup:true});
 assert.equal(soundEnabled(prefs,'unknown'),false);assert.equal(soundEnabled(prefs,'crowd'),true);
});

test('end time settings and lineup mute survive reopening and malformed modes recover',()=>{
 const storage=memory(),prefs=loadPreferences(storage);prefs.endEnabled=true;prefs.endTime='21:30';prefs.endMode='full';prefs.minGameMs=90000;prefs.audioCues.lineup=false;
 savePreferences(storage,prefs);assert.deepEqual(loadPreferences(storage),prefs);
 const invalid=loadPreferences(memory({endTime:'25:00',endMode:'bad',minGameMs:0}));assert.equal(invalid.endTime,'23:59');assert.equal(invalid.endMode,'hard');assert.equal(invalid.minGameMs,120000);
});

test('fresh installs enable all optional settings while explicit saved off choices remain off',()=>{
 const prefs=loadPreferences(memory());
 for(const key of ['sounds','crowd','startCountdown','keepAwake','endEnabled'])assert.equal(prefs[key],true);
 assert.ok(Object.values(prefs.audioCues).every(Boolean));
 const disabled={sounds:false,crowd:false,startCountdown:false,keepAwake:false,endEnabled:false,audioCues:Object.fromEntries(AUDIO_CUES.map(cue=>[cue,false]))};
 const restored=loadPreferences(memory(disabled));
 for(const key of Object.keys(disabled))assert.deepEqual(restored[key],disabled[key]);
});
