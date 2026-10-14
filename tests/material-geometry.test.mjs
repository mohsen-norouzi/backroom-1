import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCottage} from '../src/scene/house.ts';
import {createLivingGrass} from '../src/scene/grass.ts';
import {atmosphereUniforms} from '../src/scene/atmosphere.ts';
import {standingHeight} from '../src/scene/physics.ts';

test('roof collision follows both cottage gables and the porch canopy',()=>{
 const cottage=createCottage();cottage.group.updateMatrixWorld(true);
 for(const [x,z] of [[-5,-59],[5,-53],[0,-52],[2,-51],[0,-48.5]]){
  const hits=new THREE.Raycaster(new THREE.Vector3(x,160,z),new THREE.Vector3(0,-1,0)).intersectObject(cottage.group,true);
  assert.ok(hits.length>0,`Missing roof at ${x},${z}`);
  assert.ok(Math.abs(hits[0].point.y-standingHeight(x,z))<.16,`Rendered roof and standing surface differ at ${x},${z}`);
 }
 cottage.group.traverse(mesh=>{
  if(!mesh.geometry)return;
  for(const attribute of ['position','normal'])assert.ok(mesh.geometry.getAttribute(attribute).array.every(Number.isFinite));
 });
 cottage.dispose();
});

test('tapered grass tips remain finite and visible at walking height',()=>{
 const scene=new THREE.Scene(),grass=createLivingGrass(scene,atmosphereUniforms());
 const mesh=scene.children[0];assert.ok(mesh.geometry.attributes.position.array.every(Number.isFinite));
 grass.update(new THREE.Vector3(20,106.72,-40));assert.equal(mesh.visible,true);
 grass.update(new THREE.Vector3(20,160,-40));assert.equal(mesh.visible,false);
 grass.dispose();assert.equal(scene.children.length,0);
});
