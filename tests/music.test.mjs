import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {HouseSong,HOUSE_SONG_POSITION,songMixAtDistance} from '../src/scene/music.ts';
import {HOUSE_REFLECTIONS,HOUSE_ECHO_DELAYS,houseAcousticMix} from '../src/scene/houseAcoustics.ts';

test('one house source fades smoothly but remains audible at world-scale distances',()=>{
 const distances=[0,10,50,150,500,1500,6000,30000];
 let previousGain=Infinity,previousCutoff=Infinity;
 for(const distance of distances){
  const mix=songMixAtDistance(distance);
  assert.ok(mix.gain<previousGain);assert.ok(mix.cutoff<previousCutoff);
  assert.ok(mix.gain>=.024&&mix.gain<=.420000001);
  previousGain=mix.gain;previousCutoff=mix.cutoff;
 }
 assert.ok(previousGain<songMixAtDistance(0).gain*.07);
 assert.equal(songMixAtDistance(-1).gain,songMixAtDistance(0).gain);
});

function setup(){
 const param=()=>({value:0,automation:[],setTargetAtTime(value,...args){this.value=value;this.automation.push([value,...args]);}});
 const node=()=>({connections:[],connect(target){this.connections.push(target);},disconnect(){this.disconnected=true;}});
 const filters=[],panners=[],sources=[],nodes=[];
 const listener=Object.fromEntries(['positionX','positionY','positionZ','forwardX','forwardY','forwardZ','upX','upY','upZ'].map(name=>[name,param()]));
 const ctx={currentTime:0,sampleRate:1000,listener,
  createGain(){const n={...node(),gain:param()};nodes.push(n);return n;},
  createBiquadFilter(){const n={...node(),frequency:param(),Q:param()};filters.push(n);nodes.push(n);return n;},
  createPanner(){const n={...node(),positionX:param(),positionY:param(),positionZ:param()};panners.push(n);nodes.push(n);return n;},
  createDelay(){const n={...node(),delayTime:param()};nodes.push(n);return n;},
  createConvolver(){const n=node();nodes.push(n);return n;},createBuffer(channels,length){return {numberOfChannels:channels,getChannelData:()=>new Float32Array(length)};},
  createMediaElementSource(element){const n={...node(),element};sources.push(n);return n;},
 };
 const originalAudio=globalThis.Audio;
 globalThis.Audio=class {
  constructor(src){this.src=src;this.paused=true;this.currentTime=0;this.plays=0;}
  async play(){this.paused=false;this.plays++;}pause(){this.paused=true;}
  removeAttribute(name){delete this[name];}load(){}remove(){this.removed=true;}
 };
 const output=node(),song=new HouseSong(ctx,output);
 return {song,output,ctx,filters,panners,sources,nodes,cleanup(){song.dispose();if(originalAudio===undefined)delete globalThis.Audio;else globalThis.Audio=originalAudio;}};
}

test('the room stays inside the house while delayed echoes come from fixed cliff edges',()=>{
 const f=setup();
 try{
  const {song,sources,panners,output,ctx}=f,panner=panners[0];
  assert.equal(panners.length,3);assert.equal(panners[0].panningModel,'HRTF');assert.ok(panners.slice(1).every(p=>p.panningModel==='equalpower'));
  assert.deepEqual(panners.slice(1).map(p=>[p.positionX.value,p.positionY.value,p.positionZ.value]),HOUSE_REFLECTIONS.map(p=>[p.x,p.y,p.z]));
  const mono=sources[0].connections[0];assert.equal(mono.channelCount,1);assert.equal(mono.channelCountMode,'explicit');
  const paths=[];
  function trace(node,path=[]){if(node===output){paths.push(path);return;}for(const next of node.connections)trace(next,[...path,node]);}
  trace(sources[0]);assert.equal(paths.length,6);
  for(const path of paths){assert.equal(path.filter(n=>panners.includes(n)).length,1,'Every route must cross exactly one fixed spatial emitter');
   if(!path.includes(panner))assert.ok(path.some(n=>n.delayTime),'Outdoor reflections must arrive after the house source');assert.ok(path.includes(mono),'A stereo bed bypassed the point-source downmix');}
  const fixedPositions=panners.map(p=>[p.positionX.value,p.positionY.value,p.positionZ.value]);
  const fixedPosition=fixedPositions[0];
  assert.deepEqual(fixedPosition,[HOUSE_SONG_POSITION.x,HOUSE_SONG_POSITION.y,HOUSE_SONG_POSITION.z]);
  for(const [position,forward] of [
   [{x:250,y:110,z:-56},{x:0,y:0,z:-1}],
   [{x:-250,y:110,z:-56},{x:0,y:0,z:-1}],
   [{x:250,y:110,z:-56},{x:0,y:0,z:1}],
   [{x:6000,y:1500,z:3000},{x:1,y:0,z:0}],
  ]){
   ctx.currentTime+=1;song.update(position,forward,{x:0,y:1,z:0});
   assert.deepEqual(panners.map(p=>[p.positionX.value,p.positionY.value,p.positionZ.value]),fixedPositions);
   assert.equal(ctx.listener.positionX.value,position.x);assert.equal(ctx.listener.forwardZ.value,forward.z);
   assert.equal(panner.connections[0].gain.value,houseAcousticMix(position).directGain);
  }
 }finally{f.cleanup();assert.ok(f.nodes.every(n=>n.disconnected));}
});

test('one streamed song loops, attenuates with distance, and resumes without restarting',async()=>{
 const f=setup();
 try {
  const {song,ctx,filters,panners,sources}=f,level=panners[0].connections[0];
  assert.equal(song.element.src,'/audio/house-song.mp3');assert.equal(song.element.loop,true);
  song.update(HOUSE_SONG_POSITION,{x:0,y:0,z:-1},{x:0,y:1,z:0});
  const nearGain=level.gain.value,nearCutoff=filters[0].frequency.value;
  ctx.currentTime=1;song.update({x:2500,y:800,z:3000},{x:1,y:0,z:0},{x:0,y:1,z:0});
  assert.ok(level.gain.value<nearGain*.1);assert.ok(level.gain.value>.004);
  assert.ok(filters[0].frequency.value<nearCutoff*.25);
  await song.play();song.element.currentTime=123;song.pause();await song.play();
  await delay(480);assert.equal(song.element.paused,false,'Resume must cancel a pending pause');
  song.pause();await delay(480);assert.equal(song.element.paused,true);
  await song.play();assert.equal(song.element.currentTime,123);assert.equal(sources.length,1);
  assert.equal(sources[0].connections.length,1);
 } finally {
  f.cleanup();assert.equal(f.song.element.paused,true);assert.equal(f.song.element.removed,true);assert.ok(f.sources[0].disconnected);
 }
});


test('movement updates gain and direction without ever retuning the audio delay lines',()=>{
 const f=setup();
 try{
  const delays=f.nodes.filter(node=>node.delayTime);
  assert.deepEqual(delays.map(node=>node.delayTime.value),HOUSE_ECHO_DELAYS);
  for(let frame=0;frame<240;frame++){
   f.ctx.currentTime=frame/30;
   const angle=frame*.03,radius=frame<120?450:15;
   f.song.update({x:Math.cos(angle)*radius,y:110,z:-56+Math.sin(angle)*radius},{x:Math.sin(angle),y:0,z:-Math.cos(angle)},{x:0,y:1,z:0});
  }
  assert.ok(delays.every(node=>node.delayTime.automation.length===0),'Automating delay time bends pitch during flight');
  assert.deepEqual(delays.map(node=>node.delayTime.value),HOUSE_ECHO_DELAYS);
 }finally{f.cleanup();}
});
