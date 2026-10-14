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
 const scene=new THREE.Scene(),atmosphere=atmosphereUniforms(),field=createCloudField(scene,atmosphere);
 field.update(86400,86400);
 const clouds=scene.children[0].children;assert.equal(clouds.length,VALLEY_CLOUD_COUNT+SKY_GRID*SKY_GRID);
 clouds.forEach((cloud,i)=>{
  const radius=cloud.scale.length();
  if(i<VALLEY_CLOUD_COUNT){assert.ok(cloud.position.z-radius>=CLOUD_CLEARANCE-1e-9);assert.ok(cloud.position.y-radius>=FLOOR+CLOUD_CLEARANCE-1e-9);}
  else assert.ok(cloud.position.y-radius>=TOP+CLOUD_CLEARANCE-1e-9);

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
