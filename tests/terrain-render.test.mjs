import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createTerrainGeometry} from '../src/scene/terrain.ts';
import {TOP,FLOOR,terrainHeight,notchBackZ} from '../src/scene/physics.ts';

test('terrain renders one surface at each elevation, with an open ladder cut',()=>{
 const geometry=createTerrainGeometry();
 const mesh=new THREE.Mesh(geometry,[0,1,2].map(()=>new THREE.MeshBasicMaterial()));mesh.updateMatrixWorld();
 for(const [x,z] of [[12,-4],[-12,-4],[0,-50],[0,-12],[20,20],[4200,-4200]]){
  const ray=new THREE.Raycaster(new THREE.Vector3(x,500,z),new THREE.Vector3(0,-1,0));
  const hits=ray.intersectObject(mesh);
  assert.ok(hits.length>0);assert.ok(Math.abs(hits[0].point.y-terrainHeight(x,z))<1e-4);
  // The old caps overlapped full box tops just 12 cm apart.
  const heights=[...new Set(hits.map(hit=>hit.point.y))];
  assert.ok(heights.every(y=>Math.abs(y-terrainHeight(x,z))<1e-4||Math.abs(y-FLOOR)<1e-6));
 }
 const front=new THREE.Raycaster(new THREE.Vector3(12,20,100),new THREE.Vector3(0,0,-1));
 assert.ok(Math.abs(front.intersectObject(mesh)[0].point.z)<1e-6);
 const cut=new THREE.Raycaster(new THREE.Vector3(0,20,100),new THREE.Vector3(0,0,-1));
 assert.ok(Math.abs(cut.intersectObject(mesh)[0].point.z-notchBackZ(20))<1e-5);
 geometry.dispose();mesh.material.forEach(material=>material.dispose());
});

 test('the turf rim is rounded without a second coplanar surface or a closed ladder gap',()=>{
 const geometry=createTerrainGeometry(),materials=[0,1,2].map(()=>new THREE.MeshBasicMaterial());
 const mesh=new THREE.Mesh(geometry,materials);mesh.updateMatrixWorld();
 let previous=0;
 for(const z of [-.001,-.02,-.08,-.16,-.28,-.5]){
  const hits=new THREE.Raycaster(new THREE.Vector3(12,200,z),new THREE.Vector3(0,-1,0)).intersectObject(mesh);
  const upper=hits.filter(hit=>hit.point.y>TOP-1);assert.equal(upper.length,1);
  assert.ok(upper[0].point.y>=previous);assert.ok(upper[0].point.y<=TOP+1e-6);previous=upper[0].point.y;
 }
 const gap=new THREE.Raycaster(new THREE.Vector3(0,200,-5),new THREE.Vector3(0,-1,0)).intersectObject(mesh);
 assert.ok(gap.every(hit=>Math.abs(hit.point.y-FLOOR)<1e-6));
 geometry.dispose();materials.forEach(m=>m.dispose());
});

test('rendered back wall and both side walls meet the tilted ladder at every height',()=>{
 const geometry=createTerrainGeometry(),materials=[0,1,2].map(()=>new THREE.MeshBasicMaterial());
 const mesh=new THREE.Mesh(geometry,materials);mesh.updateMatrixWorld();
 for(const y of [-149,-100,-20,30,104]){
  const back=new THREE.Raycaster(new THREE.Vector3(0,y,10),new THREE.Vector3(0,0,-1)).intersectObject(mesh)[0];
  assert.ok(Math.abs(back.point.z-notchBackZ(y))<1e-5);
  assert.ok(back.face.normal.y>.1 && back.face.normal.z>.98);
  for(const direction of [-1,1]){
   const ray=new THREE.Raycaster(new THREE.Vector3(0,y,notchBackZ(y)+.1),new THREE.Vector3(direction,0,0));
   assert.ok(Math.abs(Math.abs(ray.intersectObject(mesh)[0].point.x)-4.8)<1e-5);
  }
 }
 geometry.dispose();materials.forEach(m=>m.dispose());
});
