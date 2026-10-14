import test from 'node:test';
import assert from 'node:assert/strict';
import {houseTransmission,houseAcousticMix,houseRoomSamples,landscapeEchoSamples,HOUSE_SONG_POSITION,HOUSE_REFLECTIONS,HOUSE_ECHO_DELAYS} from '../src/scene/houseAcoustics.ts';
const energy=a=>a.reduce((s,v)=>s+v*v,0);

test('closed walls, windows, door and roof share one consistent enclosure sound',()=>{
 const positions=[{x:0,y:106.72,z:-36},{x:0,y:106.72,z:-76},{x:15,y:107.5,z:-51},{x:15,y:107.5,z:-56},{x:0,y:130,z:-56},{x:0,y:-100,z:60}];
 const outside=houseTransmission(positions[0]);
 for(const position of positions)assert.deepEqual(houseTransmission(position),outside);
 assert.ok(outside.cutoff<2200,'Keep the feeling of a source behind closed walls');
 assert.ok(outside.gain<.8);
 assert.equal(houseTransmission(HOUSE_SONG_POSITION).gain,1);
 // Even if the visitor eventually gains interior access, crossing the shell is smooth.
 const before=houseTransmission({x:6.301,y:108.8,z:-56}),after=houseTransmission({x:6.299,y:108.8,z:-56});
 assert.ok(Math.abs(before.gain-after.gain)<.00001);
 assert.ok(Math.abs(before.cutoff-after.cutoff)<.1);
});

test('world reflections keep fixed arrival times and remain smooth with movement',()=>{
 const eye={x:0,y:106.72,z:-36},mix=houseAcousticMix(eye);
 assert.ok(mix.reflections[0].delay>.45&&mix.reflections[0].delay<.55);
 assert.ok(mix.reflections[1].delay>.68&&mix.reflections[1].delay<.8);
 assert.ok(mix.reflections.every(r=>r.gain===0),'No outdoor echo at the house');
 const next=houseAcousticMix({...eye,x:eye.x+.03});
 for(let i=0;i<2;i++)assert.ok(Math.abs(next.reflections[i].delay-mix.reflections[i].delay)<.001);
 assert.ok(HOUSE_REFLECTIONS[0].x<0&&HOUSE_REFLECTIONS[1].x>0);
 for(const p of [eye,{x:-500,y:600,z:900},{x:6000,y:-140,z:6000},{x:0,y:1100,z:0}]){
  const value=houseAcousticMix(p);
  assert.ok(value.directGain>0&&value.directGain<=.42);
  for(const r of value.reflections){assert.ok(r.delay>=.12&&r.delay<=2.5);assert.ok(r.gain>=0&&r.gain<.09);assert.ok(Number.isFinite(r.cutoff));}
 }
});

test('the enclosed room and long outdoor decay are finite, sample-rate stable impulses',()=>{
 let previous;
 for(const rate of [24000,44100,48000]){
  const room=houseRoomSamples(rate),outdoor=landscapeEchoSamples(rate);
  assert.equal(room.length,Math.round(rate*.72));assert.equal(outdoor.length,Math.round(rate*3.2));
  assert.ok(room.every(Number.isFinite)&&outdoor.every(Number.isFinite));
  assert.ok(room[Math.round(rate*.018)]>.98);assert.equal(outdoor[0],1);
  assert.ok(energy(outdoor.subarray(rate,2*rate))>.00003,'The outdoor tail must remain audible after the first repeat');
  assert.ok(energy(outdoor.subarray(Math.round(rate*2.8)))<.00001,'Tail must fade out without feedback');
  const total=energy(outdoor);assert.ok(total<1.5);
  if(previous)assert.ok(Math.abs(total-previous)<.025);
  previous=total;
 }
});


test('outdoor echoes fade in with distance, while nearby music stays intimate',()=>{
 const source=HOUSE_SONG_POSITION;
 for(const d of [0,10,25,39,40]){
  const mix=houseAcousticMix({...source,z:source.z+d});
  assert.ok(mix.reflections.every(r=>r.gain===0),`Unexpected distant echo ${d}m from the house`);
 }
 let previousRatio=0;
 for(const d of [41,60,90,130,180,220]){
  const mix=houseAcousticMix({...source,z:source.z+d});
  const ratio=mix.reflections.reduce((s,r)=>s+r.gain,0)/mix.directGain;
  assert.ok(ratio>previousRatio);previousRatio=ratio;
 }
 const far=houseAcousticMix({...source,z:source.z+450});
 assert.ok(far.reflections.every(r=>r.gain>.005),'Audible distant reflections must remain');
 const a=houseAcousticMix({...source,z:source.z+40}),b=houseAcousticMix({...source,z:source.z+40.01});
 assert.ok(Math.abs(a.reflections[0].gain-b.reflections[0].gain)<1e-7,'No threshold pop');
});


test('circling the house at a fixed distance cannot pump volume, tone or echo timing',()=>{
 for(const radius of [15,80,160,450,1500]){
  const baseline=houseAcousticMix({...HOUSE_SONG_POSITION,x:radius});
  for(let angle=0;angle<Math.PI*2;angle+=.025){
   const mix=houseAcousticMix({x:Math.cos(angle)*radius,y:HOUSE_SONG_POSITION.y,z:HOUSE_SONG_POSITION.z+Math.sin(angle)*radius});
   assert.ok(Math.abs(mix.directGain-baseline.directGain)<1e-12);
   assert.ok(Math.abs(mix.directCutoff-baseline.directCutoff)<1e-8);
   mix.reflections.forEach((reflection,i)=>{
    assert.equal(reflection.delay,HOUSE_ECHO_DELAYS[i]);
    assert.ok(Math.abs(reflection.gain-baseline.reflections[i].gain)<1e-12);
    assert.ok(Math.abs(reflection.cutoff-baseline.reflections[i].cutoff)<1e-8);
   });
  }
 }
});
