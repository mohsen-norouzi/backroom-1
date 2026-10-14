import { windSettings } from './tuning';
import { HouseSong } from './music';
import { breezeSamples, createWorldEcho } from './ambience';

// Samples are supplied locally; audio only starts after entering the scene.
export class Soundscape {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private wind: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private stepEchoInput: GainNode | null = null;
  private stepEcho: ReturnType<typeof createWorldEcho> | null = null;
  private nodes: AudioScheduledSourceNode[] = [];
  private samples = new Map<string, AudioBuffer>();
  private footsteps = new Set<AudioBufferSourceNode>();
  private stepDistance = 0;
  private previousTime = 0;
  private wasClimbing = false;
  private rightFoot = false;
  private song: HouseSong | null = null;

  constructor(private host?:HTMLElement){}

  async start() {
    if (this.ctx) {
      const resumed=this.ctx.resume();
      void this.song?.play().catch(error=>console.warn('House song could not resume:',error));
      this.master?.gain.setTargetAtTime(.65,this.ctx.currentTime,.7);await resumed;return;
    }
    const ctx=new AudioContext(); this.ctx=ctx;
    const master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);this.master=master;
    this.song=new HouseSong(ctx,master,this.host);
    void this.song.play().catch(error=>console.warn('House song could not play:',error));
    const data=breezeSamples(ctx.sampleRate),buffer=ctx.createBuffer(1,data.length,ctx.sampleRate);
    buffer.getChannelData(0).set(data);
    const noise=ctx.createBufferSource();noise.buffer=buffer;noise.loop=true;
    const lowCut=ctx.createBiquadFilter();lowCut.type='highpass';lowCut.frequency.value=95;lowCut.Q.value=.5;
    const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=650;filter.Q.value=.4;this.windFilter=filter;
    const wind=ctx.createGain();wind.gain.value=0;this.wind=wind;
    noise.connect(lowCut);lowCut.connect(filter);filter.connect(wind);wind.connect(master);noise.start();this.nodes.push(noise);
    this.stepEchoInput=ctx.createGain();
    this.stepEcho=createWorldEcho(ctx,this.stepEchoInput,master,.065);
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

  updateListener(position:{x:number;y:number;z:number},forward:{x:number;y:number;z:number},up:{x:number;y:number;z:number}){
    this.song?.update(position,forward,up);
  }

  update(speed:number,altitude:number,walking:boolean,grounded:boolean,time:number,climbing=false) {
    if(!this.ctx||!this.wind||!this.windFilter)return;
    const t=this.ctx.currentTime,dt=this.previousTime?Math.min(.05,time-this.previousTime):0;
    this.previousTime=time;
    const wind=windSettings(speed,altitude,time);
    this.wind.gain.setTargetAtTime(wind.gain,t,3);
    this.windFilter.frequency.setTargetAtTime(wind.cutoff,t,3);
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
    source.connect(gain);gain.connect(pan);pan.connect(this.master);if(this.stepEchoInput)pan.connect(this.stepEchoInput);source.start();this.footsteps.add(source);
    source.onended=()=>{source.disconnect();gain.disconnect();pan.disconnect();this.footsteps.delete(source);};
  }
  pause(){
    if(this.ctx&&this.master)this.master.gain.setTargetAtTime(0,this.ctx.currentTime,.15);
    this.song?.pause();
    this.stepDistance=0;this.previousTime=0;
  }
  dispose(){this.stepEcho?.dispose();this.stepEchoInput?.disconnect();this.song?.dispose();this.song=null;this.nodes.forEach(n=>n.stop());this.footsteps.forEach(n=>n.stop());void this.ctx?.close();this.ctx=null;}
}
