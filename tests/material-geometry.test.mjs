import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCottage} from '../src/scene/house.ts';
import {createLivingGrass,GRASS_RANGES} from '../src/scene/grass.ts';
import {atmosphereUniforms} from '../src/scene/atmosphere.ts';
import {standingHeight,notchBackZ,NOTCH_SLOPE} from '../src/scene/physics.ts';

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

test('grass has continuous distance coverage and outward growth on every cliff face',()=>{
 const scene=new THREE.Scene(),grass=createLivingGrass(scene,atmosphereUniforms());
 assert.equal(scene.children.length,15);
 for(const mesh of scene.children){
  assert.ok(mesh.geometry.attributes.position.array.every(Number.isFinite));
  assert.ok(mesh.geometry.attributes.aOffset.array.every(Number.isFinite));
  assert.equal(mesh.material.transparent,false,'Grass should not add sorted alpha layers');
 }
 const ground=scene.children.filter(mesh=>mesh.name.startsWith('grass-ground'));
 for(const eye of [new THREE.Vector3(20,106.72,-40),new THREE.Vector3(20,160,-40),new THREE.Vector3(0,-148.28,300)]){
  grass.update(eye);assert.ok(ground.some(mesh=>mesh.visible),'Flying and walking should both retain visible ground tufts');
 }
 assert.ok(GRASS_RANGES.at(-1).outer[0]>=140,'Keep visible geometry well past the old 12-metre patch');
 for(let i=1;i<GRASS_RANGES.length;i++)assert.ok(GRASS_RANGES[i].inner[0]<GRASS_RANGES[i-1].outer[0],'Detail ranges need a broad overlap');
 const wallCases=[
  ['cliff',new THREE.Vector3(20,20,1),[0,0,1]],
  ['recess-back',new THREE.Vector3(0,20,notchBackZ(20)+1.5),new THREE.Vector3(0,NOTCH_SLOPE,1).normalize().toArray()],
  ['recess-left',new THREE.Vector3(-3.6,20,-20),[1,0,0]],
  ['recess-right',new THREE.Vector3(3.6,20,-20),[-1,0,0]],
 ];
 for(const [name,eye,normal] of wallCases){
  grass.update(eye);
  const patch=scene.children.find(mesh=>mesh.name===`grass-${name}-near`);
  assert.equal(patch.visible,true);
  assert.deepEqual(patch.material.uniforms.uNormal.value.toArray(),normal,'Blades must grow out of the surface');
  assert.ok(patch.geometry.instanceCount>10000,'Cliff needs dense living grass, not only its top fringe');
 }
 const camera=new THREE.PerspectiveCamera(52,1.6,.3,8000);
 camera.position.set(36,108,4);camera.lookAt(200,105,0);
 grass.update(camera.position,camera);
 assert.ok(scene.children.filter(mesh=>mesh.name.includes('recess')).every(mesh=>!mesh.visible),'Wall patches behind the view should not be submitted');
 camera.position.set(0,30,notchBackZ(30)+2);camera.lookAt(0,30,notchBackZ(30));grass.update(camera.position,camera);
 assert.ok(scene.children.find(mesh=>mesh.name==='grass-recess-back-near').visible,'Visible grass in the ladder recess must survive frustum culling');
 grass.update(new THREE.Vector3(0,1100,0));assert.ok(scene.children.every(mesh=>!mesh.visible),'Distant geometry must still be culled');
 grass.dispose();assert.equal(scene.children.length,0);
});
