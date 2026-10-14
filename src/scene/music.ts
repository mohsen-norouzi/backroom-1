import { HOUSE_SONG_POSITION, HOUSE_REFLECTIONS, HOUSE_ECHO_DELAYS, houseAcousticMix, houseRoomSamples, landscapeEchoSamples } from './houseAcoustics';
import type { Point } from './houseAcoustics';
export { HOUSE_SONG_POSITION, songMixAtDistance } from './houseAcoustics';

export function createHouseEmitter(ctx:BaseAudioContext,source:AudioNode,output:AudioNode){
  const owned:AudioNode[]=[];
  const own=<T extends AudioNode>(node:T)=>{owned.push(node);return node;};
  function convolution(samples:Float32Array){
    const convolver=own(ctx.createConvolver());convolver.normalize=false;
    const buffer=ctx.createBuffer(1,samples.length,ctx.sampleRate);buffer.getChannelData(0).set(samples);convolver.buffer=buffer;
    return convolver;
  }
  function lowpass(cutoff:number){const node=own(ctx.createBiquadFilter());node.type='lowpass';node.frequency.value=cutoff;node.Q.value=.45;return node;}
  function spatial(position:Point,reflection=false){
    const panner=own(ctx.createPanner());panner.panningModel=reflection?'equalpower':'HRTF';panner.distanceModel='inverse';
    panner.channelCount=1;panner.channelCountMode='explicit';
    panner.rolloffFactor=0;panner.refDistance=1;panner.maxDistance=60000;
    panner.positionX.value=position.x;panner.positionY.value=position.y;panner.positionZ.value=position.z;
    return panner;
  }
  const mono=own(ctx.createGain());mono.channelCount=1;mono.channelCountMode='explicit';mono.channelInterpretation='speakers';
  const room=own(ctx.createGain()),dry=own(ctx.createGain());dry.gain.value=.88;
  const roomConvolver=convolution(houseRoomSamples(ctx.sampleRate)),roomWet=own(ctx.createGain());roomWet.gain.value=.18;
  source.connect(mono);mono.connect(dry);dry.connect(room);
  mono.connect(roomConvolver);roomConvolver.connect(roomWet);roomWet.connect(room);

  // Early room reflections and the direct signal both leave the same interior source.
  // One consistent enclosure filter covers the closed walls, door and windows.
  const filter=lowpass(1000),panner=spatial(HOUSE_SONG_POSITION),level=own(ctx.createGain());level.gain.value=0;
  room.connect(filter);filter.connect(panner);panner.connect(level);level.connect(output);

  // Outdoor sound escapes the front of the house and reaches two fixed cliff edges.
  // Reflections are spatialized separately, so the landscape feels large without
  // adding an unlocated stereo soundtrack or moving the original sound source.
  const escapeFilter=lowpass(2600),tail=convolution(landscapeEchoSamples(ctx.sampleRate));
  room.connect(escapeFilter);escapeFilter.connect(tail);
  const reflections=HOUSE_REFLECTIONS.map((position,index)=>{
    const delay=own(ctx.createDelay(1)),filter=lowpass(2100),panner=spatial(position,true),level=own(ctx.createGain());
    level.gain.value=0;delay.delayTime.value=HOUSE_ECHO_DELAYS[index];
    tail.connect(delay);delay.connect(filter);filter.connect(panner);panner.connect(level);level.connect(output);
    return {delay,filter,panner,level};
  });
  function update(position:Point,t=ctx.currentTime){
    const mix=houseAcousticMix(position);
    level.gain.setTargetAtTime(mix.directGain,t,.3);
    filter.frequency.setTargetAtTime(mix.directCutoff,t,.45);
    reflections.forEach((reflection,i)=>{
      const setting=mix.reflections[i];
      reflection.level.gain.setTargetAtTime(setting.gain,t,.65);
      reflection.filter.frequency.setTargetAtTime(setting.cutoff,t,.6);
    });
  }
  return {panner,level,filter,reflections,update,dispose(){owned.forEach(node=>node.disconnect());}};
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
    this.emitter.update(position,t);
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
