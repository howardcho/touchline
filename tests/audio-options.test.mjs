import test from 'node:test';
import assert from 'node:assert/strict';
import {AUDIO_CUES,loadPreferences,savePreferences,PREF_KEY,soundEnabled} from '../preferences.mjs';
function memory(initial={}){const data=new Map([[PREF_KEY,JSON.stringify(initial)]]);return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};}
test('existing settings retain master mute and crowd choice while new cue toggles default on',()=>{
 const prefs=loadPreferences(memory({sounds:false,crowd:true}));
 assert.deepEqual(prefs.audioCues,{start:true,minute:true,whistle:true,countdown:true});
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
 assert.deepEqual(prefs.audioCues,{start:false,minute:true,whistle:true,countdown:true});
 assert.equal(soundEnabled(prefs,'unknown'),false);assert.equal(soundEnabled(prefs,'crowd'),false);
});
