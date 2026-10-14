import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {HouseSong,HOUSE_SONG_POSITION,songMixAtDistance} from '../src/scene/music.ts';

test('house music fades smoothly with distance while a quiet world layer remains',()=>{
 const distances=[0,10,50,150,500,1500,6000,30000];
 let previousDirect=Infinity,previousCutoff=Infinity,previousTotal=Infinity;
 for(const distance of distances){
  const mix=songMixAtDistance(distance),total=mix.direct+mix.ambient+mix.reverb;
  assert.ok(mix.direct<previousDirect);assert.ok(mix.cutoff<previousCutoff);assert.ok(total<previousTotal);
  assert.ok(mix.ambient>=.025&&mix.ambient<=.09);assert.ok(mix.reverb>0);
  previousDirect=mix.direct;previousCutoff=mix.cutoff;previousTotal=total;
 }
 assert.ok(songMixAtDistance(30000).direct<.001);
 assert.ok(previousTotal<songMixAtDistance(0).direct*.4);
});

test('one streamed song follows the listener, loops, and resumes without restarting',async()=>{
 const originalAudio=globalThis.Audio;
 const param=()=>({value:0,setTargetAtTime(value){this.value=value;}});
 const node=()=>({connections:[],connect(target){this.connections.push(target);},disconnect(){this.disconnected=true;}});
 const gains=[],filters=[],panners=[],sources=[];
 const listener=Object.fromEntries(['positionX','positionY','positionZ','forwardX','forwardY','forwardZ','upX','upY','upZ'].map(name=>[name,param()]));
 const ctx={currentTime:0,sampleRate:1000,listener,
  createGain(){const n={...node(),gain:param()};gains.push(n);return n;},
  createBiquadFilter(){const n={...node(),frequency:param(),Q:param()};filters.push(n);return n;},
  createPanner(){const n={...node(),positionX:param(),positionY:param(),positionZ:param()};panners.push(n);return n;},
  createConvolver(){return node();},createBuffer(channels,length){return {getChannelData:()=>new Float32Array(length)};},
  createMediaElementSource(element){const n={...node(),element};sources.push(n);return n;},
 };
 globalThis.Audio=class {
  constructor(src){this.src=src;this.paused=true;this.currentTime=0;this.plays=0;}
  async play(){this.paused=false;this.plays++;}pause(){this.paused=true;}
  removeAttribute(name){delete this[name];}load(){}remove(){this.removed=true;}
 };
 const song=new HouseSong(ctx,node());
 try {
  assert.equal(song.element.src,'/audio/house-song.mp3');assert.equal(song.element.loop,true);
  assert.equal(panners[0].panningModel,'HRTF');assert.equal(panners[0].positionZ.value,-56);
  assert.equal(panners[0].positionY.value,HOUSE_SONG_POSITION.y);
  song.update(HOUSE_SONG_POSITION,{x:0,y:0,z:-1},{x:0,y:1,z:0});
  const nearGain=gains[0].gain.value,nearCutoff=filters[0].frequency.value;
  ctx.currentTime=1;
  song.update({x:2500,y:800,z:3000},{x:1,y:0,z:0},{x:0,y:1,z:0});
  assert.equal(listener.positionX.value,2500);assert.equal(listener.forwardX.value,1);
  assert.ok(gains[0].gain.value<nearGain*.03);assert.ok(gains[1].gain.value>.08);
  assert.ok(filters[0].frequency.value<nearCutoff*.2);
  await song.play();song.element.currentTime=123;song.pause();await song.play();
  await delay(480);assert.equal(song.element.paused,false,'Resume must cancel a pending pause');
  song.pause();await delay(480);assert.equal(song.element.paused,true);
  await song.play();assert.equal(song.element.currentTime,123);assert.equal(sources.length,1);
  assert.equal(sources[0].connections.length,2,'Both layers must share a single synchronized stream');
 } finally {
  song.dispose();assert.equal(song.element.paused,true);assert.equal(song.element.removed,true);
  assert.ok(sources[0].disconnected);
  if(originalAudio===undefined)delete globalThis.Audio;else globalThis.Audio=originalAudio;
 }
});
