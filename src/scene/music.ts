import { TOP } from './physics';
import { HOUSE_Z } from './houseShape';
import { createWorldEcho } from './ambience';

type Point={x:number;y:number;z:number};
export const HOUSE_SONG_POSITION={x:0,y:TOP+3.8,z:HOUSE_Z};

export function songMixAtDistance(distance:number){
  const proximity=1/(1+Math.pow(Math.max(0,distance)/130,1.1));
  return {
    // Keep a faint, still-directional signal at the far reaches of the field.
    gain:.024+.396*proximity,
    cutoff:1250+6250*proximity,
  };
}

// One physical emitter. Every route, including the faint outdoor echo,
// passes through this panner; nothing plays directly into the listener's headphones.
export function createHouseEmitter(ctx:BaseAudioContext,source:AudioNode,output:AudioNode){
  const mono=ctx.createGain();mono.channelCount=1;mono.channelCountMode='explicit';mono.channelInterpretation='speakers';
  const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.Q.value=.45;
  const dry=ctx.createGain();dry.gain.value=.94;
  const panner=ctx.createPanner();panner.panningModel='HRTF';panner.distanceModel='inverse';
  panner.channelCount=1;panner.channelCountMode='explicit';
  // Distance has a gentle floor for audibility; it never changes the source's position.
  panner.rolloffFactor=0;panner.refDistance=1;panner.maxDistance=60000;
  panner.positionX.value=HOUSE_SONG_POSITION.x;panner.positionY.value=HOUSE_SONG_POSITION.y;panner.positionZ.value=HOUSE_SONG_POSITION.z;
  const level=ctx.createGain();level.gain.value=0;
  source.connect(mono);mono.connect(filter);
  filter.connect(dry);dry.connect(panner);
  const echo=createWorldEcho(ctx,filter,panner,.16);
  panner.connect(level);level.connect(output);
  return {panner,level,filter,dispose(){echo.dispose();for(const node of [mono,filter,dry,panner,level])node.disconnect();}};
}

export class HouseSong {
  readonly element:HTMLAudioElement;
  private source:MediaElementAudioSourceNode;
  private emitter:ReturnType<typeof createHouseEmitter>;
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
    this.emitter=createHouseEmitter(ctx,this.source,output);
  }

  async play(){
    if(this.disposed)return;
    clearTimeout(this.pauseTimer);this.pauseTimer=undefined;
    await this.element.play();
  }

  update(position:Point,forward:Point,up:Point){
    if(this.disposed)return;
    const t=this.ctx.currentTime;
    if(t-this.lastUpdate<.015)return;this.lastUpdate=t;
    const listener=this.ctx.listener;
    for(const [param,value] of [
      [listener.positionX,position.x],[listener.positionY,position.y],[listener.positionZ,position.z],
      [listener.forwardX,forward.x],[listener.forwardY,forward.y],[listener.forwardZ,forward.z],
      [listener.upX,up.x],[listener.upY,up.y],[listener.upZ,up.z],
    ] as const)param.setTargetAtTime(value,t,.015);
    const distance=Math.hypot(position.x-HOUSE_SONG_POSITION.x,position.y-HOUSE_SONG_POSITION.y,position.z-HOUSE_SONG_POSITION.z);
    const mix=songMixAtDistance(distance);
    this.emitter.level.gain.setTargetAtTime(mix.gain,t,.22);
    this.emitter.filter.frequency.setTargetAtTime(mix.cutoff,t,.35);
  }

  pause(){
    clearTimeout(this.pauseTimer);
    // Let the master fade finish before stopping the stream; preserve its playhead.
    this.pauseTimer=setTimeout(()=>{this.element.pause();this.pauseTimer=undefined;},450);
  }

  dispose(){
    this.disposed=true;clearTimeout(this.pauseTimer);this.element.pause();
    this.element.removeAttribute('src');this.element.load();this.element.remove();
    this.source.disconnect();this.emitter.dispose();
  }
}
