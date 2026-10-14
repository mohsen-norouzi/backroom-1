import { TOP } from './physics';

type Point={x:number;y:number;z:number};
export const HOUSE_SONG_POSITION={x:0,y:TOP+3.8,z:-56};

export function songMixAtDistance(distance:number){
  const proximity=1/(1+Math.pow(Math.max(0,distance)/110,1.15));
  return {
    direct:.36*proximity,
    ambient:.025+.065*(1-proximity),
    reverb:.018+.022*(1-proximity),
    cutoff:1000+7500*proximity,
    ambientCutoff:950+2200*proximity,
  };
}

export class HouseSong {
  readonly element:HTMLAudioElement;
  private source:MediaElementAudioSourceNode;
  private panner:PannerNode;
  private direct:GainNode;
  private ambient:GainNode;
  private reverb:GainNode;
  private directFilter:BiquadFilterNode;
  private ambientFilter:BiquadFilterNode;
  private space:ConvolverNode;
  private pauseTimer:ReturnType<typeof setTimeout>|undefined;
  private lastUpdate=-Infinity;
  private disposed=false;

  constructor(private ctx:AudioContext,output:AudioNode,host?:HTMLElement){
    // Stream the compressed copy; decoding the six-minute WAV would retain 144 MB.
    this.element=new Audio('/audio/house-song.mp3');
    this.element.id='house-song';this.element.hidden=true;
    this.element.loop=true;this.element.preload='auto';
    host?.appendChild(this.element);
    this.source=ctx.createMediaElementSource(this.element);
    this.directFilter=ctx.createBiquadFilter();this.directFilter.type='lowpass';this.directFilter.Q.value=.45;
    this.ambientFilter=ctx.createBiquadFilter();this.ambientFilter.type='lowpass';this.ambientFilter.Q.value=.3;
    this.direct=ctx.createGain();this.ambient=ctx.createGain();this.reverb=ctx.createGain();
    this.direct.gain.value=0;this.ambient.gain.value=0;this.reverb.gain.value=0;
    this.panner=ctx.createPanner();this.panner.panningModel='HRTF';this.panner.distanceModel='inverse';
    // Distance is mixed explicitly so a quiet diffuse layer can reach the entire world.
    this.panner.rolloffFactor=0;this.panner.refDistance=1;this.panner.maxDistance=60000;
    this.panner.positionX.value=HOUSE_SONG_POSITION.x;
    this.panner.positionY.value=HOUSE_SONG_POSITION.y;
    this.panner.positionZ.value=HOUSE_SONG_POSITION.z;
    this.source.connect(this.directFilter);this.directFilter.connect(this.panner);
    this.panner.connect(this.direct);this.direct.connect(output);
    // Keep the distant layer stereo; only the clear house signal is positional.
    this.source.connect(this.ambientFilter);this.ambientFilter.connect(this.ambient);this.ambient.connect(output);
    this.space=ctx.createConvolver();
    const length=Math.floor(ctx.sampleRate*2.2),impulse=ctx.createBuffer(2,length,ctx.sampleRate);
    for(let channel=0;channel<2;channel++){
      const data=impulse.getChannelData(channel),delay=Math.floor(ctx.sampleRate*(.035+channel*.012));
      for(let i=delay;i<length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/length,2.8);
    }
    this.space.buffer=impulse;
    this.ambientFilter.connect(this.space);this.space.connect(this.reverb);this.reverb.connect(output);
  }

  async play(){
    if(this.disposed)return;
    clearTimeout(this.pauseTimer);this.pauseTimer=undefined;
    await this.element.play();
  }

  update(position:Point,forward:Point,up:Point){
    if(this.disposed)return;
    const t=this.ctx.currentTime;
    if(t-this.lastUpdate<.04)return;this.lastUpdate=t;
    const listener=this.ctx.listener;
    for(const [param,value] of [
      [listener.positionX,position.x],[listener.positionY,position.y],[listener.positionZ,position.z],
      [listener.forwardX,forward.x],[listener.forwardY,forward.y],[listener.forwardZ,forward.z],
      [listener.upX,up.x],[listener.upY,up.y],[listener.upZ,up.z],
    ] as const)param.setTargetAtTime(value,t,.045);
    const distance=Math.hypot(position.x-HOUSE_SONG_POSITION.x,position.y-HOUSE_SONG_POSITION.y,position.z-HOUSE_SONG_POSITION.z);
    const mix=songMixAtDistance(distance);
    this.direct.gain.setTargetAtTime(mix.direct,t,.3);
    this.ambient.gain.setTargetAtTime(mix.ambient,t,.6);
    this.reverb.gain.setTargetAtTime(mix.reverb,t,.6);
    this.directFilter.frequency.setTargetAtTime(mix.cutoff,t,.5);
    this.ambientFilter.frequency.setTargetAtTime(mix.ambientCutoff,t,.5);
  }

  pause(){
    clearTimeout(this.pauseTimer);
    // Let the master fade finish before stopping the stream; preserve its playhead.
    this.pauseTimer=setTimeout(()=>{this.element.pause();this.pauseTimer=undefined;},450);
  }

  dispose(){
    this.disposed=true;clearTimeout(this.pauseTimer);this.element.pause();
    this.element.removeAttribute('src');this.element.load();this.element.remove();
    for(const node of [this.source,this.panner,this.direct,this.ambient,this.reverb,this.directFilter,this.ambientFilter,this.space])node.disconnect();
  }
}
