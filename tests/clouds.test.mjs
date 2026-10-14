import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {clearCloudPosition,CLOUD_CLEARANCE} from '../src/scene/clouds.ts';
import {createCloudField} from '../src/scene/cloudVolume.ts';
import {atmosphereUniforms} from '../src/scene/atmosphere.ts';
import {SKY_GRID,SKY_SPAN,VALLEY_CLOUD_COUNT} from '../src/scene/cloudLayout.ts';
import {TOP,FLOOR,terrainHeight} from '../src/scene/physics.ts';

test('valley cloud bounds stay outside the cliff and above the lower field',()=>{
 const radius=Math.hypot(41,28,36);
 for(const center of [{x:0,y:-125,z:10},{x:230,y:48,z:10},{x:-115,y:-12,z:32}]){
  const p=clearCloudPosition(center,radius,'valley');
  assert.ok(p.z-radius>=CLOUD_CLEARANCE-1e-9);assert.ok(p.y-radius>=FLOOR+CLOUD_CLEARANCE-1e-9);
  for(const drift of [-15000,0,15000])assert.equal(terrainHeight(p.x+drift,p.z-radius),FLOOR);
 }
});
test('actual 3D cloud instances and their shadows remain clear after hours of drift',()=>{
 const scene=new THREE.Scene(),atmosphere=atmosphereUniforms(),field=createCloudField(scene,atmosphere,false);
 field.update(86400,86400);
 const clouds=scene.children[0].children;assert.equal(clouds.length,VALLEY_CLOUD_COUNT+SKY_GRID*SKY_GRID);
 clouds.forEach((cloud,i)=>{
  if(i<VALLEY_CLOUD_COUNT){assert.ok(cloud.position.z-cloud.scale.z>=CLOUD_CLEARANCE-1e-9);assert.ok(cloud.position.y-cloud.scale.y>=FLOOR+CLOUD_CLEARANCE-1e-9);}
  else assert.ok(cloud.position.y-cloud.scale.y>=TOP+CLOUD_CLEARANCE-1e-9);

 });
 for(const center of atmosphere.uCloudCenters.value)assert.ok(clouds.some(cloud=>cloud.position.equals(center)));
 // Every compass direction stays populated after crossing the world in either direction.
 for(const eye of [new THREE.Vector3(0,107,0),new THREE.Vector3(4800,107,-4800),new THREE.Vector3(-4800,107,4800)]){
  field.update(86400,0,eye);
  const sectors=Array(12).fill(0);
  for(const cloud of clouds.slice(VALLEY_CLOUD_COUNT)){
   const dx=cloud.position.x-eye.x,dz=cloud.position.z-eye.z,distance=Math.hypot(dx,dz);
   assert.ok(Math.abs(dx)<=SKY_SPAN/2);assert.ok(Math.abs(dz)<=SKY_SPAN/2);
   if(distance>700&&distance<4200)sectors[Math.min(11,Math.floor((Math.atan2(dz,dx)+Math.PI)/(Math.PI*2)*12))]++;
  }
  assert.ok(sectors.every(count=>count>=8),`Sparse compass sectors: ${sectors}`);
 }
 field.dispose();assert.equal(scene.children.length,0);
});

test('a cloud keeps its 3D density and world axes across old switch distances and viewing angles',()=>{
 const scene=new THREE.Scene(),field=createCloudField(scene,atmosphereUniforms(),false);
 const clouds=scene.children[0].children,target=clouds[0],center=target.position.clone();
 const mesh=scene.children.find(child=>child.geometry?.getAttribute('aCenter'));
 const density=mesh.material.uniforms.uVolume.value,dimensions=target.scale.clone();
 const camera=new THREE.PerspectiveCamera(65,1,.3,8000);
 for(const distance of [120,549,551,700,899,901,1500])for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
  camera.position.copy(center).add(new THREE.Vector3(Math.sin(angle)*distance,40,Math.cos(angle)*distance));
  camera.lookAt(center);field.update(10,0,camera.position,camera);
  const centers=mesh.geometry.getAttribute('aCenter'),sizes=mesh.geometry.getAttribute('aSize'),variants=mesh.geometry.getAttribute('aVariant');
  let instance=-1;
  for(let i=0;i<mesh.geometry.instanceCount;i++)if(Math.hypot(centers.getX(i)-center.x,centers.getY(i)-center.y,centers.getZ(i)-center.z)<.001)instance=i;
  assert.ok(instance>=0,`Cloud disappeared at distance ${distance}, angle ${angle}`);
  assert.equal(sizes.itemSize,3,'Cloud must retain depth instead of becoming a flat image');
  assert.deepEqual([sizes.getX(instance),sizes.getY(instance),sizes.getZ(instance)],dimensions.toArray());
  assert.equal(variants.getX(instance),target.userData.variant);
  assert.equal(mesh.material.uniforms.uVolume.value,density,'The density must not change when nearby-cloud rankings change');
  assert.deepEqual(target.quaternion.toArray(),[0,0,0,1]);
  assert.ok(target.position.equals(center));
 }
 field.dispose();
});

test('cloud motion only translates slowly, retaining each density variant and orientation',()=>{
 const scene=new THREE.Scene(),field=createCloudField(scene,atmosphereUniforms(),false);
 const clouds=scene.children[0].children;
 const initial=clouds.map(cloud=>({position:cloud.position.clone(),size:cloud.scale.clone(),variant:cloud.userData.variant}));
 for(let frame=1;frame<=120;frame++)field.update(frame/60,1/60,new THREE.Vector3(0,140,440));
 clouds.forEach((cloud,i)=>{
  const before=initial[i],wrapped=cloud.position.x-before.position.x-cloud.userData.speed*2;
  assert.ok(Math.abs(wrapped/SKY_SPAN-Math.round(wrapped/SKY_SPAN))<1e-8);
  assert.equal(cloud.position.y,before.position.y);
  assert.ok(cloud.scale.equals(before.size));assert.equal(cloud.userData.variant,before.variant);
  assert.deepEqual(cloud.quaternion.toArray(),[0,0,0,1]);
  assert.ok(cloud.userData.speed<=.85);
 });
 field.dispose();
});
