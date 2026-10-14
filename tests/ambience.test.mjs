import test from 'node:test';
import assert from 'node:assert/strict';
import {breezeSamples,worldEchoSamples} from '../src/scene/ambience.ts';
import {windSettings} from '../src/scene/tuning.ts';

const energy=data=>data.reduce((sum,value)=>sum+value*value,0);
test('wind stays restrained and never surges with movement speed',()=>{
 for(const altitude of [-150,0,105,1100])for(let time=0;time<180;time+=.25){
  const quiet=windSettings(0,altitude,time);
  assert.deepEqual(windSettings(28,altitude,time),quiet);
  assert.ok(quiet.gain>=.012&&quiet.gain<=.019);
  assert.ok(Math.abs(windSettings(0,altitude,time+1/60).gain-quiet.gain)<.00001);
 }
});

test('the long breeze loop has stable energy, no DC offset, and no seam spike',()=>{
 const data=breezeSamples(24000),rms=Math.sqrt(energy(data)/data.length);
 assert.equal(data.length,24000*16);assert.ok(data.every(Number.isFinite));
 assert.ok(Math.abs(rms-.2)<1e-6);
 assert.ok(Math.abs(data.reduce((a,b)=>a+b,0)/data.length)<1e-6);
 let differenceEnergy=0;for(let i=1;i<data.length;i++)differenceEnergy+=(data[i]-data[i-1])**2;
 assert.ok(Math.abs(data[0]-data.at(-1))<4*Math.sqrt(differenceEnergy/data.length),'Loop seam should resemble an ordinary noise sample');
});

test('the echo has quiet separated arrivals and a finite fading tail at any device rate',()=>{
 let previousEnergy;
 for(const rate of [24000,44100,48000]){
  const data=worldEchoSamples(rate);
  assert.ok(data.subarray(0,Math.floor(rate*.1)).every(value=>value===0));
  assert.ok(data[Math.round(rate*.145)]>.95);
  assert.ok(data[Math.round(rate*.315)]>.40);
  assert.ok(data[Math.round(rate*.575)]>.17);
  assert.ok(energy(data.subarray(Math.floor(rate*1.5)))<1e-5);
  const sum=energy(data);assert.ok(sum<1.4,'Echo must not build up uncontrolled energy');
  if(previousEnergy)assert.ok(Math.abs(sum-previousEnergy)<.04);
  previousEnergy=sum;
 }
});
