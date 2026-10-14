import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createTerrainGeometry } from './terrain';
import { grassTexture, grassMaterial, createSky, random, weatherMaterial } from './materials';

import { atmosphereUniforms } from './atmosphere';
import { createCloudField } from './cloudVolume';
import { createLivingGrass } from './grass';
import { TOP, FLOOR, NOTCH_END } from './physics';
const HOUSE_Z = -56;

export function buildWorld(scene: THREE.Scene) {
  const rng = random(42);
  const grassMap = grassTexture();
  const atmosphere=atmosphereUniforms();
  const clouds=createCloudField(scene,atmosphere);
  const livingGrass=createLivingGrass(scene,atmosphere);
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

  const plaster=material('#baa7a3'), white=material('#c9c6b6'), roof=material('#a77f7c');
  weatherMaterial(plaster);weatherMaterial(roof,true);
  const glass=material('#243b38',{roughness:.18,metalness:.12});
  const wood=material('#a39573'), door=material('#a8b6a0'), step=material('#c4c3a7');
  const dark=material('#3d5148');
  const baseY=TOP+.35;
  // Small, solitary rose-coloured house, with a real gabled silhouette.
  box(13.4,.65,11.8,0,baseY,HOUSE_Z,step,true);
  box(12.6,7.1,10.5,0,baseY+3.85,HOUSE_Z,plaster,true);
  function gable(cx: number, y: number, z: number, width: number, rise: number, depth: number, mat: THREE.Material) {
    const shape = new THREE.Shape(); shape.moveTo(-width/2,0); shape.lineTo(width/2,0); shape.lineTo(0,rise); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false}); geometries.push(geometry);
    const mesh=new THREE.Mesh(geometry,mat); mesh.position.set(cx,y,z-depth/2); mesh.castShadow=true; mesh.receiveShadow=true; group.add(mesh); return mesh;
  }
  gable(0,baseY+7.4,HOUSE_Z,12.6,4.32,10.5,plaster);
  function pitchedRoof(cx:number, y:number, z:number, width:number, rise:number, depth:number) {
    const length=Math.hypot(width/2,rise), angle=Math.atan2(rise,width/2);
    for(const side of [-1,1]) {
      const panel=box(length,.25,depth,cx+side*width/4,y+rise/2,z,roof,true); panel.rotation.z=-side*angle;
      const fascia=box(length,.27,.19,cx+side*width/4,y+rise/2,z+depth/2,white,true); fascia.rotation.z=-side*angle;

    }
  }
  pitchedRoof(0,baseY+6.95,HOUSE_Z,14.3,4.9,12.4);
  box(1.1,3.4,1.1,3.8,baseY+10.1,HOUSE_Z-2.4,plaster,true);
  box(1.4,.28,1.4,3.8,baseY+11.9,HOUSE_Z-2.4,white,true);
  box(1,.06,.95,3.8,baseY+12.06,HOUSE_Z-2.4,dark);
  // Front porch and pediment.
  box(3.1,4.65,1.6,0,baseY+2.45,HOUSE_Z+5.5,plaster,true);
  gable(0,baseY+4.75,HOUSE_Z+5.7,3.7,1.43,2.2,plaster);
  pitchedRoof(0,baseY+4.75,HOUSE_Z+5.7,4,1.6,2.5);
  box(1.6,3.45,.12,0,baseY+2.1,HOUSE_Z+6.35,door,true);
  box(.7,.95,.035,0,baseY+2.95,HOUSE_Z+6.42,glass);
  box(.08,.12,.12,.56,baseY+1.85,HOUSE_Z+6.48,wood);
  for(let i=0;i<4;i++) box(3.2-i*.1,.19*(4-i),.65,0,TOP+.095*(4-i),HOUSE_Z+7.8+i*.55,step,true);
  for(const side of [-1,1]) {
    box(.15,3.7,.15,side*1.6,baseY+1.98,HOUSE_Z+6.55,white,true);
    box(.13,.8,2.3,side*1.58,baseY+.85,HOUSE_Z+5.5,white);
  }
  function frontWindow(x:number,y:number,z:number,w=1.9,h=2.6) {
    box(w+.25,h+.25,.15,x,y,z,white,true); box(w,h,.17,x,y,z+.07,glass);
    box(.065,h,.035,x,y,z+.17,white); box(w,.065,.035,x,y,z+.17,white);
    box(w+.4,.13,.38,x,y-h/2-.12,z+.06,white,true);
  }
  frontWindow(-4,baseY+3.3,HOUSE_Z+5.31,2.3,2.7);
  frontWindow(4,baseY+3.3,HOUSE_Z+5.31,2.3,2.7);
  frontWindow(0,baseY+8.1,HOUSE_Z+5.31,.85,1.3);
  for(const side of [-1,1]) for(const z of [-2.6,2.6]) {
    box(.16,2.8,2.15,side*6.36,baseY+3.3,HOUSE_Z+z,white,true);
    box(.18,2.5,1.85,side*6.42,baseY+3.3,HOUSE_Z+z,glass);
    box(.21,2.5,.065,side*6.46,baseY+3.3,HOUSE_Z+z,white);
    box(.21,.065,1.85,side*6.46,baseY+3.3,HOUSE_Z+z,white);
  }


  const ladderMat=material('#c8bc91',{roughness:.76});
  for(const side of [-1,1]) box(.23,height+2,.23,side*.76,(TOP+FLOOR)/2+.5,NOTCH_END+.5,ladderMat,true);
  const rungGeo=new THREE.CylinderGeometry(.095,.095,1.66,7); geometries.push(rungGeo);
  const rungs=new THREE.InstancedMesh(rungGeo,ladderMat,510);
  const dummy=new THREE.Object3D();
  for(let i=0;i<510;i++){dummy.position.set(0,FLOOR+.5+i*.5,NOTCH_END+.5); dummy.rotation.z=Math.PI/2; dummy.updateMatrix(); rungs.setMatrixAt(i,dummy.matrix);}
  rungs.castShadow=true; group.add(rungs);
  // A faint worn route connects the front door to the ladder.
  const pathMat=material('#827e65',{transparent:true,opacity:.22,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  box(1.8,.012,10.8,0,TOP+.012,-42.5,pathMat);

  const bushGeo=new THREE.IcosahedronGeometry(1,2); geometries.push(bushGeo);
  const bushMat=material('#5b703b');
  const bushes=new THREE.InstancedMesh(bushGeo,bushMat,64);
  for(let i=0;i<64;i++) {
    const angle=rng()*Math.PI*2, x=Math.cos(angle)*(6.9+rng()*.9), z=HOUSE_Z+Math.sin(angle)*6;
    if(z>HOUSE_Z+4&&Math.abs(x)<2) { dummy.scale.setScalar(.01); } else { dummy.scale.set(.35+rng()*.65,.4+rng()*.8,.4+rng()*.6); }
    dummy.position.set(x,TOP+.5,z); dummy.rotation.set(rng(),rng(),rng()); dummy.updateMatrix(); bushes.setMatrixAt(i,dummy.matrix);
    bushes.setColorAt(i,new THREE.Color().setHSL(.19+rng()*.08,.22+rng()*.18,.2+rng()*.17));
  }
  bushes.castShadow=true; bushes.receiveShadow=true; group.add(bushes);

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
      clouds.update(time,delta,camera.position);livingGrass.update(camera.position);sky.mesh.position.copy(camera.position);
    },
    dispose(){
      group.traverse(object=>{if(object instanceof THREE.InstancedMesh)object.dispose();});
      geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());clouds.dispose();livingGrass.dispose();
      grassMap.dispose();sky.mesh.geometry.dispose();sky.material.dispose();
      scene.remove(group,sky.mesh);
    },
  };
}
