import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createFieldShadows} from '../src/scene/fieldShadows.ts';
import {SUN_DIRECTION} from '../src/scene/atmosphere.ts';
import {TOP} from '../src/scene/physics.ts';

test('higher clouds cast broader penumbras instead of hard dark stamps',()=>{
 const n=64,bytes=new Uint8Array(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(Math.hypot(x-n/2,y-n/2)<n*.19)bytes[(x+y*n)*4]=255;
 const source=new THREE.DataTexture(bytes,n,n);
 const bake=(height,layer='sky')=>{
  const cloud=new THREE.Object3D();cloud.scale.set(90,35,65);
  cloud.position.set(height*SUN_DIRECTION.x/SUN_DIRECTION.y,TOP+height,height*SUN_DIRECTION.z/SUN_DIRECTION.y);
  cloud.userData={layer,initialPosition:cloud.position,variant:0};
  return createFieldShadows([cloud],source,1024);
 };
 const low=bake(65),high=bake(450),valley=bake(65,'valley');
 const metrics=texture=>{
  let edge=0,peak=0,total=0;
  for(const value of texture.image.data){if(value>3&&value<200)edge++;peak=Math.max(peak,value);total+=value;}
  return {edge,peak,total};
 };
 const l=metrics(low),h=metrics(high);
 assert.ok(h.edge>l.edge*1.3,`Upper cloud needs a broader transition: ${JSON.stringify({l,h})}`);
 assert.ok(h.peak<l.peak,'Scattered light should soften the opaque core');
 assert.ok(l.peak>200&&h.peak>90,'Shadows must retain readable cores');
 assert.ok(Math.abs(h.total/l.total-1)<.15,'Softness should spread the shadow, not erase it');
 assert.equal(metrics(valley).total,0,'Valley clouds must not darken the upper field map');
 for(const texture of [low,high,valley,source])texture.dispose();
});
