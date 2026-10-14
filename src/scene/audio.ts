import { windSettings } from './tuning';

// Samples are supplied locally; audio only starts after entering the scene.
export class Soundscape {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private wind: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private nodes: AudioScheduledSourceNode[] = [];
  private samples = new Map<string, AudioBuffer>();
  private footsteps = new Set<AudioBufferSourceNode>();
  private stepDistance = 0;
  private previousTime = 0;
  private wasClimbing = false;
  private rightFoot = false;

  async start() {
    if (this.ctx) { await this.ctx.resume(); this.master?.gain.setTargetAtTime(.65,this.ctx.currentTime,.7); return; }
    const ctx=new AudioContext(); this.ctx=ctx;
    const master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);this.master=master;
    const buffer=ctx.createBuffer(1,ctx.sampleRate*4,ctx.sampleRate), data=buffer.getChannelData(0);
    let last=0;
    for(let i=0;i<data.length;i++){const white=Math.random()*2-1;last=(last+.025*white)/1.025;data[i]=last*6;}
    const noise=ctx.createBufferSource();noise.buffer=buffer;noise.loop=true;
    const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=270;filter.Q.value=.3;this.windFilter=filter;
    const wind=ctx.createGain();wind.gain.value=.065;this.wind=wind;noise.connect(filter);filter.connect(wind);wind.connect(master);noise.start();this.nodes.push(noise);
    const low=ctx.createOscillator();low.type='sine';low.frequency.value=54;
    const lowGain=ctx.createGain();lowGain.gain.value=.009;low.connect(lowGain);lowGain.connect(master);low.start();this.nodes.push(low);
    const lfo=ctx.createOscillator();lfo.frequency.value=.09;const lfoGain=ctx.createGain();lfoGain.gain.value=.004;lfo.connect(lfoGain);lfoGain.connect(wind.gain);lfo.start();this.nodes.push(lfo);
    master.gain.setTargetAtTime(.65,ctx.currentTime,1.8);
    await ctx.resume();
    await Promise.all(['walk-on-grass','footstep-ladder-left','footstep-ladder-right'].map(async name=>{
      try {
        const response=await fetch(`/audio/${name}.mp3`);
        if(!response.ok)return;
        const sample=await ctx.decodeAudioData(await response.arrayBuffer());
        if(this.ctx===ctx)this.samples.set(name,sample);
      } catch { /* Ambience remains available if a local sample fails to load. */ }
    }));
  }

  update(speed:number,altitude:number,walking:boolean,grounded:boolean,time:number,climbing=false) {
    if(!this.ctx||!this.wind||!this.windFilter)return;
    const t=this.ctx.currentTime,dt=this.previousTime?Math.min(.05,time-this.previousTime):0;
    this.previousTime=time;
    const wind=windSettings(speed,altitude);
    this.wind.gain.setTargetAtTime(wind.gain,t,2);
    this.windFilter.frequency.setTargetAtTime(wind.cutoff,t,2);
    if(this.wasClimbing!==climbing)this.stepDistance=0;
    this.wasClimbing=climbing;
    if(!walking||(!grounded&&!climbing)||speed<.1){this.stepDistance=0;return;}
    this.stepDistance+=speed*dt;
    const stride=climbing?.5:speed>3?1.9:1.15;
    if(this.stepDistance>=stride){this.stepDistance%=stride;this.step(climbing);}
  }

  private step(climbing:boolean) {
    if(!this.ctx||!this.master)return;
    this.rightFoot=!this.rightFoot;
    const buffer=this.samples.get(climbing?`footstep-ladder-${this.rightFoot?'right':'left'}`:'walk-on-grass');
    if(!buffer)return;
    const ctx=this.ctx,source=ctx.createBufferSource();source.buffer=buffer;
    source.playbackRate.value=climbing?1: .96+Math.random()*.08;
    const gain=ctx.createGain();gain.gain.value=climbing?.24:.22;
    const pan=ctx.createStereoPanner();pan.pan.value=this.rightFoot?.12:-.12;
    source.connect(gain);gain.connect(pan);pan.connect(this.master);source.start();this.footsteps.add(source);
    source.onended=()=>{source.disconnect();gain.disconnect();pan.disconnect();this.footsteps.delete(source);};
  }
  pause(){
    if(this.ctx&&this.master)this.master.gain.setTargetAtTime(0,this.ctx.currentTime,.15);
    this.stepDistance=0;this.previousTime=0;
  }
  dispose(){this.nodes.forEach(n=>n.stop());this.footsteps.forEach(n=>n.stop());void this.ctx?.close();this.ctx=null;}
}
