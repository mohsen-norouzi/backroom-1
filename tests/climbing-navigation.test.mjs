import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Navigation } from '../src/scene/navigation.ts';
import { LADDER_CAMERA_Z } from '../src/scene/ladder.ts';

test('actual movement holds a ladder grip during mouse look, strafe, pause and resume',()=>{
 const previous={document:globalThis.document,window:globalThis.window,matchMedia:globalThis.matchMedia};
 const doc=new EventTarget(),win=new EventTarget(),canvas=new EventTarget();
 doc.pointerLockElement=canvas;doc.hidden=false;
 globalThis.document=doc;globalThis.window=win;globalThis.matchMedia=()=>({matches:false});
 const camera=new THREE.PerspectiveCamera();camera.position.set(.2,20,LADDER_CAMERA_Z+.3);
 const states=[],nav=new Navigation(camera,canvas,()=>{},()=>{},()=>{},value=>states.push(value));
 const event=(type,properties)=>{const e=new Event(type);for(const [key,value] of Object.entries(properties))Object.defineProperty(e,key,{value});doc.dispatchEvent(e);};
 const key=(type,code)=>event(type,{code,repeat:false});
 const advance=(frames)=>{for(let i=0;i<frames;i++)nav.update(1/60);};
 try {
  nav.mode='walk';nav.activate();key('keydown','KeyW');advance(60);key('keyup','KeyW');
  assert.ok(nav.climbing);assert.deepEqual(states,[true]);
  const held=camera.position.clone(),beforeRotation=camera.quaternion.clone();
  event('mousemove',{movementX:1500,movementY:-700});key('keydown','KeyD');advance(240);key('keyup','KeyD');
  assert.ok(camera.position.equals(held));assert.ok(camera.quaternion.angleTo(beforeRotation)>1);
  assert.equal(nav.speed,0);
  nav.pause();advance(60);nav.activate();advance(120);assert.ok(camera.position.equals(held));assert.ok(nav.climbing);
  key('keydown','KeyW');advance(60);key('keyup','KeyW');
  assert.ok(Math.abs(camera.position.y-held.y-1.25)<1e-8);assert.equal(camera.position.z,LADDER_CAMERA_Z);
  key('keydown','KeyE');key('keyup','KeyE');assert.equal(nav.climbing,false);
  const releasedY=camera.position.y;advance(5);assert.ok(camera.position.y<releasedY);assert.ok(camera.position.z>LADDER_CAMERA_Z);
 } finally {
  nav.dispose();
  for(const [name,value] of Object.entries(previous)){if(value===undefined)delete globalThis[name];else globalThis[name]=value;}
 }
});
