import test from 'node:test';
import assert from 'node:assert/strict';
import {AUDIO_CUES,WARNING_CUES,WEEKDAYS,audioFor,endScheduleFor,endSettingsForDate,loadPreferences,savePreferences,PREF_KEY,soundEnabled,warningCalloutEnabled} from '../preferences.mjs';
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
test('warning callouts preserve the existing ten-second behavior and can move to any warning',()=>{
 const storage=memory(),prefs=loadPreferences(storage);
 assert.deepEqual(prefs.warningCallouts,{minute:false,thirty:false,ten:true});
 assert.deepEqual(WARNING_CUES.filter(cue=>warningCalloutEnabled(prefs,cue)),['ten']);
 prefs.warningCallouts={minute:true,thirty:true,ten:false};savePreferences(storage,prefs);
 const restored=loadPreferences(storage);assert.deepEqual(restored.warningCallouts,{minute:true,thirty:true,ten:false});
 assert.deepEqual(WARNING_CUES.filter(cue=>warningCalloutEnabled(restored,cue)),['minute','thirty']);
 restored.audioCues.lineup=false;assert.ok(WARNING_CUES.every(cue=>!warningCalloutEnabled(restored,cue)));
});
test('session audio copies are independent from saved defaults and normalize malformed values',()=>{
 const prefs=loadPreferences(memory()),session=audioFor(prefs);session.audioCues.minute=false;session.warningCallouts.ten=false;
 assert.equal(prefs.audioCues.minute,true);assert.equal(prefs.warningCallouts.ten,true);
 assert.deepEqual(audioFor({sounds:false,warningCallouts:{minute:true,thirty:'yes'}}).warningCallouts,{minute:true,thirty:false,ten:true});
});
test('weekday end times migrate from the daily default and resolve in local time',()=>{
 const storage=memory({endEnabled:true,endTime:'20:30'}),prefs=loadPreferences(storage);
 assert.equal(prefs.endSchedule.enabled,false);assert.equal(WEEKDAYS.length,7);
 assert.ok(Object.values(prefs.endSchedule.days).every(day=>day.enabled&&day.time==='20:30'));
 prefs.endSchedule.enabled=true;
 prefs.endSchedule.days[1]={enabled:true,time:'19:15'};
 prefs.endSchedule.days[2]={enabled:false,time:'21:00'};
 savePreferences(storage,prefs);const restored=loadPreferences(storage);
 const monday=new Date(2026,10,9,12,0).getTime(),tuesday=new Date(2026,10,10,12,0).getTime();
 assert.deepEqual(endScheduleFor(restored.profiles[4]).days[1],{enabled:true,time:'19:15'});
 assert.equal(endSettingsForDate(restored,monday).endTime,'19:15');
 assert.equal(endSettingsForDate(restored,monday).endEnabled,true);
 assert.equal(endSettingsForDate(restored,tuesday).endEnabled,false);
});
test('malformed weekday entries recover without changing the valid schedule',()=>{
 const prefs=loadPreferences(memory({endEnabled:false,endTime:'22:00',endSchedule:{enabled:true,days:{1:{enabled:true,time:'18:45'},2:{enabled:'yes',time:'29:00'}}}}));
 assert.deepEqual(prefs.endSchedule.days[1],{enabled:true,time:'18:45'});
 assert.deepEqual(prefs.endSchedule.days[2],{enabled:false,time:'22:00'});
});
test('weekday schedules remain independent for each team-count profile',()=>{
 const storage=memory(),prefs=loadPreferences(storage);
 prefs.profiles[3].endSchedule.enabled=true;
 prefs.profiles[3].endSchedule.days[5]={enabled:true,time:'18:30'};
 prefs.profiles[5].endSchedule.enabled=true;
 prefs.profiles[5].endSchedule.days[5]={enabled:true,time:'21:15'};
 savePreferences(storage,prefs);
 const restored=loadPreferences(storage);
 assert.equal(restored.profiles[3].endSchedule.days[5].time,'18:30');
 assert.equal(restored.profiles[5].endSchedule.days[5].time,'21:15');
});
