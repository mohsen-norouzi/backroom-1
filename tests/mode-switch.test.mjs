import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Navigation} from '../src/scene/navigation.ts';
import {standingHeight,EYE_HEIGHT} from '../src/scene/physics.ts';

function withNavigation(position,check){
 const previous={document:globalThis.document,window:globalThis.window,matchMedia:globalThis.matchMedia};
 const doc=new EventTarget(),canvas=new EventTarget();doc.pointerLockElement=canvas;doc.hidden=false;
 globalThis.document=doc;globalThis.window=new EventTarget();globalThis.matchMedia=()=>({matches:false});
 const camera=new THREE.PerspectiveCamera();camera.position.fromArray(position);camera.rotation.set(.23,-.7,0,'YXZ');
 const nav=new Navigation(camera,canvas,()=>{},()=>{});nav.activate();
 const toggle=()=>{for(const type of ['keydown','keyup']){const e=new Event(type);Object.defineProperties(e,{code:{value:'KeyF'},repeat:{value:false}});doc.dispatchEvent(e);}};
 const advance=frames=>{for(let i=0;i<frames;i++)nav.update(1/60);};
 try{check({camera,nav,toggle,advance});}finally{
  nav.dispose();for(const [key,value] of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
 }
}

test('F keeps exact position and view, then falls onto the surface directly underneath',()=>{
 for(const start of [[30,180,-90],[7,150,180],[0,140,-10],[0,160,-56],[4,150,-56]]){
  withNavigation(start,({camera,nav,toggle,advance})=>{
   const original=camera.position.clone(),look=camera.quaternion.clone();
   toggle();assert.equal(nav.mode,'walk');assert.ok(camera.position.equals(original));assert.ok(camera.quaternion.equals(look));assert.equal(nav.grounded,false);
   advance(1);assert.ok(camera.position.y<original.y);assert.equal(camera.position.x,original.x);assert.equal(camera.position.z,original.z);
   advance(900);assert.equal(camera.position.y,standingHeight(original.x,original.z)+EYE_HEIGHT);
   assert.equal(camera.position.x,original.x);assert.equal(camera.position.z,original.z);assert.ok(nav.grounded);
  });
 }
});
test('switching back to flight arrests a fall without relocating or rotating the camera',()=>{
 withNavigation([50,200,80],({camera,nav,toggle,advance})=>{
  toggle();advance(60);const falling=camera.position.clone(),look=camera.quaternion.clone();
  assert.ok(falling.y<200);toggle();assert.equal(nav.mode,'fly');advance(120);
  assert.ok(camera.position.equals(falling));assert.ok(camera.quaternion.angleTo(look)<1e-7);
 });
});
test('switching to walk while already on the ground does not jump or fade',()=>{
 const start=[30,standingHeight(30,-90)+EYE_HEIGHT,-90];
 withNavigation(start,({camera,nav,toggle,advance})=>{
  toggle();assert.ok(nav.grounded);advance(120);assert.deepEqual(camera.position.toArray(),start);
 });
});
