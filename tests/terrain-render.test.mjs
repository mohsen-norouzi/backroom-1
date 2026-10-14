import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createTerrainGeometry} from '../src/scene/terrain.ts';
import {TOP,FLOOR,terrainHeight} from '../src/scene/physics.ts';

test('terrain renders one surface at each elevation, with an open ladder cut',()=>{
 const geometry=createTerrainGeometry();
 const mesh=new THREE.Mesh(geometry,[0,1,2].map(()=>new THREE.MeshBasicMaterial()));mesh.updateMatrixWorld();
 for(const [x,z] of [[12,-4],[-12,-4],[0,-50],[0,-12],[20,20],[4200,-4200]]){
  const ray=new THREE.Raycaster(new THREE.Vector3(x,500,z),new THREE.Vector3(0,-1,0));
  const hits=ray.intersectObject(mesh);
  assert.ok(hits.length>0);assert.equal(hits[0].point.y,terrainHeight(x,z));
  // The old caps overlapped full box tops just 12 cm apart.
  const heights=[...new Set(hits.map(hit=>hit.point.y))];
  assert.ok(heights.every(y=>Math.abs(y-TOP)<1e-6||Math.abs(y-FLOOR)<1e-6));
 }
 const front=new THREE.Raycaster(new THREE.Vector3(12,20,100),new THREE.Vector3(0,0,-1));
 assert.equal(front.intersectObject(mesh)[0].point.z,0);
 const cut=new THREE.Raycaster(new THREE.Vector3(0,20,100),new THREE.Vector3(0,0,-1));
 assert.equal(cut.intersectObject(mesh)[0].point.z,-37);
 geometry.dispose();mesh.material.forEach(material=>material.dispose());
});
