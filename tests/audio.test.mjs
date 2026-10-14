import test from 'node:test';
import assert from 'node:assert/strict';
import { Soundscape } from '../src/scene/audio.ts';

test('local grass and alternating ladder recordings only trigger during movement',async()=>{
 const previousAudio=globalThis.AudioContext,previousMedia=globalThis.Audio,previousFetch=globalThis.fetch;
 const played=[],requested=[];
 const param=()=>({value:0,setTargetAtTime(){}});
 const node=()=>({connect(){},disconnect(){},start(){},stop(){},gain:param(),frequency:param(),Q:param(),pan:param(),playbackRate:param()});
 globalThis.Audio=class {async play(){}pause(){}removeAttribute(){}load(){}remove(){}};
 globalThis.AudioContext=class {
  currentTime=0;sampleRate=44100;destination={};
  createMediaElementSource(){return node();}createConvolver(){return node();}
  createPanner(){return {...node(),positionX:param(),positionY:param(),positionZ:param()};}
  createGain(){return node();}createBiquadFilter(){return node();}createOscillator(){return node();}createStereoPanner(){return node();}
  createBuffer(channels,length){return {getChannelData:()=>new Float32Array(length)};}
  createBufferSource(){const source=node();source.start=()=>{if(source.buffer?.sample)played.push(source.buffer.sample);};return source;}
  async decodeAudioData(value){return {sample:value};}async resume(){}async close(){}
 };
 globalThis.fetch=async url=>{requested.push(url);return {ok:true,arrayBuffer:async()=>url};};
 const sound=new Soundscape();let time=0;
 const move=(speed,walking,grounded,climbing,frames=60)=>{for(let i=0;i<frames;i++){time+=1/60;sound.update(speed,30,walking,grounded,time,climbing);}};
 try {
  await sound.start();assert.equal(requested.length,3);
  move(0,true,true,false);assert.equal(played.length,0);
  move(1.8,true,true,false);assert.ok(played.includes('/audio/walk-on-grass.mp3'));
  played.length=0;move(0,true,false,true);assert.equal(played.length,0);
  move(1.25,true,false,true,90);assert.equal(played.length,3);
  assert.ok(played.every(name=>name.includes('footstep-ladder')));assert.notEqual(played[0],played[1]);assert.equal(played[0],played[2]);
  played.length=0;move(0,true,false,true,180);assert.equal(played.length,0);
  move(4.5,false,false,false,120);assert.equal(played.length,0);
 } finally {
  sound.dispose();
  if(previousAudio===undefined)delete globalThis.AudioContext;else globalThis.AudioContext=previousAudio;
  if(previousMedia===undefined)delete globalThis.Audio;else globalThis.Audio=previousMedia;
  globalThis.fetch=previousFetch;
 }
});
