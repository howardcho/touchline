import {MatchSounds,AUDIO_FILES} from './sounds.mjs';
// Native hosts own playback and audio focus; the browser stays silent.
export class NativeMatchSounds extends MatchSounds {
  constructor(bridge) {super();this.bridge=bridge;}
  async unlock() {
    try {
      const durations=await this.bridge.postMessage({action:'prepare'});
      this.buffers=new Map(Object.entries(durations).map(([key,duration])=>[key,{duration}]));
      this.failedAssets=Object.keys(AUDIO_FILES).filter(key=>!this.buffers.has(key));
      return this.buffers.size>0;
    }catch {return false;}
  }
  send(command) {
    try {
      Promise.resolve(this.bridge.postMessage(command)).catch(error=>this.report(error));return true;
    }catch(error){this.report(error);return false;}
  }
  report(error) {
    console.error('Native audio unavailable:',error);
    const status=globalThis.document?.getElementById('sound-status');
    if(status)status.textContent='Audio unavailable. Check your device audio output and try again.';
  }
  recorded(name,{at=0,duration,volume=1,group='effect'}={}) {
    if(!this.buffers.has(name))return false;
    return this.send({action:'play',name,at,duration:duration??this.buffers.get(name).duration,volume,group});
  }
  prime() {return this.send({action:'prime'});}
  stopGroup(group) {this.send({action:'stopGroup',group});}
  stopSpeech() {this.stopGroup('voice');}
  stop() {super.stop();this.send({action:'stop'});}
  speak() {return false;} // All shipped speech is bundled and played natively.
}
export function createMatchSounds(host=globalThis) {
  const bridge=host.touchlineNative?.audio ?? host.webkit?.messageHandlers?.touchlineAudio;
  return bridge?new NativeMatchSounds(bridge):new MatchSounds();
}
