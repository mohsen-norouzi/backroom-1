import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {HouseSong,HOUSE_SONG_POSITION,songMixAtDistance} from '../src/scene/music.ts';

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
 const param=()=>({value:0,setTargetAtTime(value){this.value=value;}});
 const node=()=>({connections:[],connect(target){this.connections.push(target);},disconnect(){this.disconnected=true;}});
 const filters=[],panners=[],sources=[],nodes=[];
 const listener=Object.fromEntries(['positionX','positionY','positionZ','forwardX','forwardY','forwardZ','upX','upY','upZ'].map(name=>[name,param()]));
 const ctx={currentTime:0,sampleRate:1000,listener,
  createGain(){const n={...node(),gain:param()};nodes.push(n);return n;},
  createBiquadFilter(){const n={...node(),frequency:param(),Q:param()};filters.push(n);nodes.push(n);return n;},
  createPanner(){const n={...node(),positionX:param(),positionY:param(),positionZ:param()};panners.push(n);nodes.push(n);return n;},
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

test('every music route is mono and passes through the fixed house panner, including room reflections',()=>{
 const f=setup();
 try{
  const {song,sources,panners,output,ctx}=f,panner=panners[0];
  assert.equal(panners.length,1);assert.equal(panner.panningModel,'HRTF');
  const mono=sources[0].connections[0];assert.equal(mono.channelCount,1);assert.equal(mono.channelCountMode,'explicit');
  const paths=[];
  function trace(node,path=[]){if(node===output){paths.push(path);return;}for(const next of node.connections)trace(next,[...path,node]);}
  trace(sources[0]);assert.equal(paths.length,2);
  for(const path of paths){assert.ok(path.includes(panner),'A soundtrack route bypassed spatialization');assert.ok(path.includes(mono),'A stereo bed bypassed the point-source downmix');}
  const fixedPosition=[panner.positionX.value,panner.positionY.value,panner.positionZ.value];
  assert.deepEqual(fixedPosition,[HOUSE_SONG_POSITION.x,HOUSE_SONG_POSITION.y,HOUSE_SONG_POSITION.z]);
  for(const [position,forward] of [
   [{x:250,y:110,z:-56},{x:0,y:0,z:-1}],
   [{x:-250,y:110,z:-56},{x:0,y:0,z:-1}],
   [{x:250,y:110,z:-56},{x:0,y:0,z:1}],
   [{x:6000,y:1500,z:3000},{x:1,y:0,z:0}],
  ]){
   ctx.currentTime+=1;song.update(position,forward,{x:0,y:1,z:0});
   assert.deepEqual([panner.positionX.value,panner.positionY.value,panner.positionZ.value],fixedPosition);
   assert.equal(ctx.listener.positionX.value,position.x);assert.equal(ctx.listener.forwardZ.value,forward.z);
   assert.ok(panner.connections[0].gain.value>=.024);
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
  assert.ok(level.gain.value<nearGain*.1);assert.ok(level.gain.value>=.024);
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
