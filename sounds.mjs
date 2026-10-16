import {PALETTE,upcomingGame,matchup} from './engine.mjs';
// Recorded assets are decoded once per page, then scheduled with Web Audio offline.
// Synthesized cues and device speech remain a fallback if an asset cannot load.
export const AUDIO_FILES = Object.freeze({
  ...Object.fromEntries(PALETTE.map(color=>[`team-${color}`,`callout-team-${color.toLowerCase()}.mp3`])),
  and:'callout-and.mp3',up:'callout-up.mp3',deck:'callout-deck.mp3',
  referee:'referee.mp3', crowd:'crowd.mp3', minute:'minute.mp3',
  ...Object.fromEntries([1,2,3,4,5].map(n=>[`count-${n}`,`count-${n}.mp3`]))
});
export const SOUND_PLANS = {
  start: [{at:0, duration:1.25, frequency:2600, type:'sine', volume:0.17}],
  count: [{at:0, duration:0.12, frequency:880, type:'sine', volume:0.14}],
  whistle: [{at:0, duration:0.4}, {at:0.85, duration:0.45}, {at:1.75, duration:1.6}].map(p=>({...p, frequency:2600, type:'sine', volume:0.17}))
};
export function lineupFor(state, offset=1) {
  const colorsAt=offset=>{const game=upcomingGame(state,offset);return [...matchup(game.teams,game.game)].map(t=>game.colors[t]);};
  const up=colorsAt(offset),deck=colorsAt(offset+1);
  return {up,deck,text:`Team ${up[0]} and team ${up[1]}, you're up! Team ${deck[0]} and team ${deck[1]}, you're on deck!`};
}
export function timerCue(before, after, now) {
  if(!before.finished && after.finished && before.running && now>=after.finishedAt && now-after.finishedAt<=1500)return 'whistle';
  if (!before.running || !after.running) return null;
  const gameMs=after.gameMs, changeMs=after.changeMs;
  const recent = at => now >= at && now-at <= 1500;
  if (after.phase==='changeover' && (before.phase!=='changeover'||before.game!==after.game||before.segment!==after.segment)) return recent(after.deadline-changeMs) ? 'whistle' : null;
  if (after.phase==='game' && (before.phase!=='game'||before.game!==after.game||before.segment!==after.segment)) return recent(after.deadline-(after.phaseMs??gameMs)) ? 'start' : null;
  if (after.phase==='game' && gameMs>60000 && before.remaining>60000 && after.remaining<=60000 && recent(after.deadline-60000)) return 'minute';
  return null;
}
export function changeoverCount(before, after, now) {
  if(!before.running || !after.running || after.phase!=='changeover') return null;
  const n=Math.ceil(after.remaining/1000);
  if(n<1 || n>5) return null;
  const entered=before.phase!=='changeover' || before.game!==after.game||before.segment!==after.segment;
  const crossed=entered || Math.ceil(before.remaining/1000)>n;
  const lateness=now-(after.deadline-n*1000);
  return crossed && lateness>=0 && lateness<=350 ? n : null;
}
export class MatchSounds {
  constructor() {
    this.generation=0;this.context=null; this.active=new Set();this.previewTimers=new Set();
    this.buffers=new Map();this.groups=new Map();this.failedAssets=[];this.loadPromise=null;
    this.speech=globalThis.speechSynthesis;this.Utterance=globalThis.SpeechSynthesisUtterance;
  }
  async unlock() {
    try {
      // Prime device speech from a user tap as well as the Web Audio context.
      if(this.speech && this.Utterance && !this.speechPrimed) {
        this.speech.speak(new this.Utterance(''));this.speechPrimed=true;
      }
      this.context ||= new (window.AudioContext||window.webkitAudioContext)(); await this.context.resume(); await this.load(); return this.context.state==='running';} catch {return false;}
  }
  async load() {
    this.loadPromise ||= Promise.all(Object.entries(AUDIO_FILES).map(async([name,file])=>{
      try {
        const response=await fetch(new URL(`./audio/${file}`,import.meta.url));
        if(!response.ok)throw new Error('Audio request failed');
        const buffer=await this.context.decodeAudioData(await response.arrayBuffer());
        this.buffers.set(name,buffer);
      } catch {this.failedAssets.push(name);}
    }));
    return this.loadPromise;
  }
  stopGroup(group) {
    for(const [node,label] of this.groups)if(label===group){
      try{node.stop();}catch{}this.active.delete(node);this.groups.delete(node);
    }
  }
  recorded(name,{at=0,duration,volume=1,group='effect'}={}) {
    const buffer=this.buffers.get(name),ctx=this.context;
    if(!buffer || !ctx || ctx.state!=='running')return false;
    const source=ctx.createBufferSource(),gain=ctx.createGain();
    source.buffer=buffer;source.connect(gain);gain.connect(ctx.destination);
    const start=ctx.currentTime+0.02+at,length=Math.min(duration??buffer.duration,buffer.duration);
    gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume,start+0.01);
    gain.gain.setValueAtTime(volume,Math.max(start+0.01,start+length-0.025));gain.gain.linearRampToValueAtTime(0,start+length);
    this.active.add(source);this.groups.set(source,group);
    source.onended=()=>{this.active.delete(source);this.groups.delete(source);source.disconnect();gain.disconnect();};
    source.start(start,0,length);return true;
  }
  stopSpeech() {this.stopGroup('voice'); try {this.speech?.cancel();} catch {} }
  stop() { this.generation++;for(const timer of this.previewTimers) clearTimeout(timer);this.previewTimers.clear();this.stopSpeech(); for(const node of this.active) {try {node.stop();} catch {}} this.active.clear();this.groups.clear(); }
  sayCount(number) {
    if(!Number.isInteger(number) || number<1 || number>5) return false;
    this.stopGroup('whistle');this.stopGroup('crowd');
    if(this.buffers.has(`count-${number}`)){this.stopSpeech();return this.recorded(`count-${number}`,{group:'voice'});}
    return this.speak(String(number),1.25);
  }
  speak(text,rate=1) {
    if(!this.speech || !this.Utterance) return this.play('count');
    try {
      this.stopSpeech();
      const utterance=new this.Utterance(text);
      utterance.lang='en-US';utterance.rate=rate;utterance.volume=1;
      const voices=this.speech.getVoices();
      const voice=voices.find(v=>v.localService && /^en(-|$)/i.test(v.lang)) || voices.find(v=>/^en(-|$)/i.test(v.lang));
      if(voice)utterance.voice=voice;
      // If device speech fails, retain an audible tick alongside the visible alert.
      utterance.onerror=event=>{if(!['canceled','interrupted'].includes(event.error))this.play('count');};
      this.speech.speak(utterance);return true;
    } catch {return this.play('count');}
  }
  sayTeams(up,deck,{delay=0}={}) {
    if(![up,deck].every(pair=>Array.isArray(pair)&&pair.length===2&&pair.every(c=>PALETTE.includes(c))))return false;
    this.stopSpeech();
    const tokens=[`team-${up[0]}`,'and',`team-${up[1]}`,'up',`team-${deck[0]}`,'and',`team-${deck[1]}`,'deck'];
    if(tokens.every(key=>this.buffers.has(key))) {
      let at=delay;
      for(const key of tokens){this.recorded(key,{at,group:'voice'});at+=this.buffers.get(key).duration+(key==='up'?0.3:0.055);}
      return true;
    }
    const text=`Team ${up[0]} and team ${up[1]}, you're up! Team ${deck[0]} and team ${deck[1]}, you're on deck!`;
    if(!delay)return this.speak(text);
    const timer=setTimeout(()=>{this.previewTimers.delete(timer);this.speak(text);},delay*1000);this.previewTimers.add(timer);return true;
  }
  previewCountdown() {
    this.stop();this.sayCount(5);
    for(let i=1;i<=5;i++) {
      const timer=setTimeout(()=>{this.previewTimers.delete(timer);if(i===5)this.play('start');else this.sayCount(5-i);},i*1000);
      this.previewTimers.add(timer);
    }
  }
  play(name,{crowd=false,crowdVolume=0.45}={}) {
    if(name==='minute') {
      if(this.buffers.has('minute')){this.stopSpeech();return this.recorded('minute',{group:'voice'});}
      return this.speak('One minute remaining');
    }
    if(name==='crowd')return this.recorded('crowd',{volume:0.45,group:'crowd'});
    if(name==='start'){this.stopGroup('crowd');this.stopGroup('whistle');this.stopSpeech();}
    if((name==='start'||name==='whistle') && this.buffers.has('referee')) {
      this.stopGroup('whistle');
      for(const p of SOUND_PLANS[name])this.recorded('referee',{at:p.at,duration:p.duration,volume:0.8,group:'whistle'});
      if(name==='whistle' && crowd)this.recorded('crowd',{at:3.35,volume:crowdVolume,group:'crowd'});
      return true;
    }
    if (!this.context || this.context.state!=='running') return false;
    const ctx=this.context, base=ctx.currentTime+0.02;
    for(const p of SOUND_PLANS[name] || []) {
      const osc=ctx.createOscillator(), gain=ctx.createGain(), filter=ctx.createBiquadFilter();
      osc.type=p.type;osc.frequency.value=p.frequency;filter.type='lowpass';filter.frequency.value=6000;
      osc.connect(filter);filter.connect(gain);gain.connect(ctx.destination);
      const start=base+p.at, end=start+p.duration;
      gain.gain.setValueAtTime(0.0001,start);gain.gain.exponentialRampToValueAtTime(p.volume,start+0.015);
      {gain.gain.setValueAtTime(p.volume,Math.max(start+0.02,end-0.035));gain.gain.exponentialRampToValueAtTime(0.0001,end);}
      if(name==='whistle' || name==='start') {
        const wobble=ctx.createOscillator(), depth=ctx.createGain();wobble.frequency.value=34;depth.gain.value=65;
        wobble.connect(depth);depth.connect(osc.frequency);wobble.start(start);wobble.stop(end);this.active.add(wobble);
        wobble.onended=()=>{this.active.delete(wobble);wobble.disconnect();depth.disconnect();};
      }
      this.active.add(osc);osc.onended=()=>{this.active.delete(osc);osc.disconnect();filter.disconnect();gain.disconnect();};osc.start(start);osc.stop(end);
    }
    return true;
  }
}
