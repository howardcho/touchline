// Web Audio synthesis keeps all cues available offline without external assets.
export const SOUND_PLANS = {
  start: [{at:0, duration:0.9, frequency:2600, type:'sine', volume:0.17}],
  count: [{at:0, duration:0.12, frequency:880, type:'sine', volume:0.14}],
  whistle: [{at:0, duration:0.4}, {at:0.85, duration:0.45}, {at:1.75, duration:1.6}].map(p=>({...p, frequency:2600, type:'sine', volume:0.17}))
};
export function timerCue(before, after, now) {
  if (!before.running || !after.running) return null;
  const gameMs=after.gameMs, changeMs=after.changeMs;
  const recent = at => now >= at && now-at <= 1500;
  if (after.phase==='changeover' && (before.phase!=='changeover'||before.game!==after.game||before.segment!==after.segment)) return recent(after.deadline-changeMs) ? 'whistle' : null;
  if (after.phase==='game' && (before.phase!=='game'||before.game!==after.game||before.segment!==after.segment)) return recent(after.deadline-gameMs) ? 'start' : null;
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
    this.context=null; this.active=new Set();this.previewTimers=new Set();
    this.speech=globalThis.speechSynthesis;this.Utterance=globalThis.SpeechSynthesisUtterance;
  }
  async unlock() {
    try {
      // Prime device speech from a user tap as well as the Web Audio context.
      if(this.speech && this.Utterance && !this.speechPrimed) {
        this.speech.speak(new this.Utterance(''));this.speechPrimed=true;
      }
      this.context ||= new (window.AudioContext||window.webkitAudioContext)(); await this.context.resume(); return this.context.state==='running';} catch {return false;}
  }
  stopSpeech() { try {this.speech?.cancel();} catch {} }
  stop() { for(const timer of this.previewTimers) clearTimeout(timer);this.previewTimers.clear();this.stopSpeech(); for(const node of this.active) {try {node.stop();} catch {}} this.active.clear(); }
  sayCount(number) {
    if(!Number.isInteger(number) || number<1 || number>5) return false;
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
  previewCountdown() {
    this.stop();this.sayCount(5);
    for(let i=1;i<=5;i++) {
      const timer=setTimeout(()=>{this.previewTimers.delete(timer);if(i===5)this.play('start');else this.sayCount(5-i);},i*1000);
      this.previewTimers.add(timer);
    }
  }
  play(name) {
    if(name==='minute')return this.speak('One minute remaining');
    if (!this.context || this.context.state!=='running') return false;
    if(name==='start')this.stopSpeech();
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
