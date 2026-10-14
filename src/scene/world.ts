import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createTerrainGeometry } from './terrain';
import { grassTexture, grassMaterial, createSky } from './materials';

import { atmosphereUniforms } from './atmosphere';
import { createCloudField } from './cloudVolume';
import { createLivingGrass } from './grass';
import { TOP, FLOOR, NOTCH_SLOPE } from './physics';
import { ladderZAt } from './ladder';
import { shadeRecessMaterial } from './recessLighting';
import { createCottage } from './house';
import { createGarden } from './garden';
import { createTurfRim } from './turfRim';

export function buildWorld(scene: THREE.Scene) {
  const grassMap = grassTexture();
  const atmosphere=atmosphereUniforms();
  const clouds=createCloudField(scene,atmosphere);
  const livingGrass=createLivingGrass(scene,atmosphere,grassMap);
  const topMat = grassMaterial(grassMap,false,false,atmosphere);
  const sideMat = grassMaterial(grassMap, true,false,atmosphere);
  const darkMat = grassMaterial(grassMap, true, true,atmosphere);
  const group = new THREE.Group(); scene.add(group);
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [topMat, sideMat, darkMat];
  function box(w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, shadows = false) {
    const geometry = new THREE.BoxGeometry(w,h,d); geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry,mat); mesh.position.set(x,y,z);
    mesh.castShadow = shadows; mesh.receiveShadow = true; group.add(mesh); return mesh;
  }
  function material(color: string, extra: THREE.MeshStandardMaterialParameters = {}) {
    const m = new THREE.MeshStandardMaterial({color, roughness:.88, ...extra}); materials.push(m); return m;
  }
  // The cut is actual open geometry: a 255-metre ladder lies at its far wall.
  const height=TOP-FLOOR;
  const terrainGeometry=createTerrainGeometry();geometries.push(terrainGeometry);
  const terrain=new THREE.Mesh(terrainGeometry,[topMat,sideMat,darkMat]);terrain.receiveShadow=true;group.add(terrain);

  const cottage=createCottage();scene.add(cottage.group);
  const garden=createGarden();scene.add(garden.group);
  const turfRim=createTurfRim();scene.add(turfRim.mesh);

  const ladderMat=material('#c8bc91',{roughness:.76});shadeRecessMaterial(ladderMat);
  for(const side of [-1,1]) {
    const rail=box(.23,(height+2)*Math.hypot(1,NOTCH_SLOPE),.23,side*.76,(TOP+FLOOR)/2+.5,ladderZAt((TOP+FLOOR)/2+.5),ladderMat,true);
    rail.rotation.x=-Math.atan(NOTCH_SLOPE);
  }
  const rungGeo=new THREE.CylinderGeometry(.095,.095,1.66,7); geometries.push(rungGeo);
  const rungs=new THREE.InstancedMesh(rungGeo,ladderMat,510);
  const dummy=new THREE.Object3D();
  for(let i=0;i<510;i++){const y=FLOOR+.5+i*.5;dummy.position.set(0,y,ladderZAt(y)); dummy.rotation.z=Math.PI/2; dummy.updateMatrix(); rungs.setMatrixAt(i,dummy.matrix);}
  rungs.castShadow=true; group.add(rungs);
  // A faint worn route connects the front door to the ladder.
  const pathMat=material('#827e65',{transparent:true,opacity:.22,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  box(1.8,.012,10.8,0,TOP+.012,-42.5,pathMat);

  // Static architecture shares materials; batch it instead of submitting every trim strip.
  const batches=new Map<string,{material:THREE.Material;cast:boolean;parts:THREE.BufferGeometry[];meshes:THREE.Mesh[]}>();
  for(const object of [...group.children]){
    if(!(object instanceof THREE.Mesh)||object instanceof THREE.InstancedMesh||Array.isArray(object.material)||object.material.transparent)continue;
    object.updateMatrix();const key=object.material.uuid+'-'+object.castShadow;
    if(!batches.has(key))batches.set(key,{material:object.material,cast:object.castShadow,parts:[],meshes:[]});
    const batch=batches.get(key)!;batch.parts.push((object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone()).applyMatrix4(object.matrix));batch.meshes.push(object);
  }
  for(const batch of batches.values()){
    const merged=mergeGeometries(batch.parts);batch.parts.forEach(part=>part.dispose());
    if(!merged)continue;geometries.push(merged);
    const mesh=new THREE.Mesh(merged,batch.material);mesh.castShadow=batch.cast;mesh.receiveShadow=true;
    group.add(mesh);batch.meshes.forEach(old=>group.remove(old));
  }

  const sky=createSky(); scene.add(sky.mesh);
  return {
    ready:clouds.ready,
    get volumeCount(){return clouds.volumeCount;},
    update(time:number,delta:number,camera:THREE.Camera){
      clouds.update(time,delta,camera.position,camera);livingGrass.update(camera.position,camera);turfRim.update(camera.position);sky.mesh.position.copy(camera.position);
    },
    dispose(){
      group.traverse(object=>{if(object instanceof THREE.InstancedMesh)object.dispose();});
      geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());clouds.dispose();livingGrass.dispose();
      cottage.dispose();garden.dispose();turfRim.dispose();scene.remove(cottage.group,garden.group,turfRim.mesh);
      grassMap.dispose();sky.mesh.geometry.dispose();sky.material.dispose();
      scene.remove(group,sky.mesh);
    },
  };
}
