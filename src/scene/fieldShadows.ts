import * as THREE from 'three';
import { SUN_DIRECTION,SHADOW_RIGHT,SHADOW_UP,SHADOW_EXTENT } from './atmosphere';
import { SKY_SPAN } from './cloudLayout';
import { TOP } from './physics';

// A finite sun and scattered sky light widen the penumbra with receiver distance.
export function cloudShadowSoftness(height:number){return 3+Math.max(0,height)*.045;}

function softenProjection(source:Uint8Array,size:number,sigma:number){
  const radius=Math.ceil(sigma*3),weights=new Float32Array(radius*2+1);
  let sum=0;
  for(let i=-radius;i<=radius;i++){const w=Math.exp(-i*i/(2*sigma*sigma));weights[i+radius]=w;sum+=w;}
  for(let i=0;i<weights.length;i++)weights[i]/=sum;
  const horizontal=new Float32Array(source.length),result=new Float32Array(source.length);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)for(let c=0;c<3;c++){
    let value=0;
    for(let i=-radius;i<=radius;i++)if(x+i>=0&&x+i<size)value+=source[((x+i)+y*size)*4+c]*weights[i+radius];
    horizontal[(x+y*size)*4+c]=value;
  }
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)for(let c=0;c<3;c++){
    let value=0;
    for(let i=-radius;i<=radius;i++)if(y+i>=0&&y+i<size)value+=horizontal[(x+(y+i)*size)*4+c]*weights[i+radius];
    result[(x+y*size)*4+c]=value;
  }
  return result;
}

// Bake height-dependent softness once. All upper clouds share a breeze, so the
// whole field still uses one filtered texture lookup and one drifting UV offset.
export function createFieldShadows(clouds:THREE.Object3D[],source:THREE.DataTexture,size=2048){
  const data=new Uint8Array(size*size),pixels=source.image.data as Uint8Array,n=source.image.width,step=SKY_SPAN/size;
  const projections=new Map<number,Float32Array>();
  const world=new THREE.Vector3(),q=new THREE.Vector3(),d=new THREE.Vector3(),near=new THREE.Vector3();
  for(const cloud of clouds){
    if(cloud.userData.layer!=='sky')continue;
    const center=cloud.userData.initialPosition as THREE.Vector3,scale=cloud.scale;
    const softness=cloudShadowSoftness(center.y-TOP);
    const sigma=softness*n/(SHADOW_EXTENT*2*(scale.x+scale.z)*.5);
    const blur=[1.5,3,5,8,12,18].find(value=>value>=sigma)??18;
    if(!projections.has(blur))projections.set(blur,softenProjection(pixels,n,blur));
    const projection=projections.get(blur)!;
    const cx=center.x-(center.y-TOP)*SUN_DIRECTION.x/SUN_DIRECTION.y,cz=center.z-(center.y-TOP)*SUN_DIRECTION.z/SUN_DIRECTION.y;
    const rx=scale.x+scale.y*Math.abs(SUN_DIRECTION.x/SUN_DIRECTION.y)+softness*3;
    const rz=scale.z+scale.y*Math.abs(SUN_DIRECTION.z/SUN_DIRECTION.y)+softness*3;
    d.copy(SUN_DIRECTION).divide(scale);
    const minX=Math.floor((cx-rx+SKY_SPAN/2)/step),maxX=Math.ceil((cx+rx+SKY_SPAN/2)/step),minZ=Math.floor((cz-rz+SKY_SPAN/2)/step),maxZ=Math.ceil((cz+rz+SKY_SPAN/2)/step);
    for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){
      world.set((x+.5)*step-SKY_SPAN/2,TOP,(z+.5)*step-SKY_SPAN/2);q.copy(world).sub(center).divide(scale);
      near.copy(q).addScaledVector(d,-q.dot(d)/d.lengthSq());
      const u=(near.dot(SHADOW_RIGHT)/(SHADOW_EXTENT*2)+.5)*(n-1),v=(near.dot(SHADOW_UP)/(SHADOW_EXTENT*2)+.5)*(n-1);
      if(u<0||v<0||u>=n-1||v>=n-1)continue;
      const ix=Math.floor(u),iy=Math.floor(v),fx=u-ix,fy=v-iy,variant=cloud.userData.variant;
      const at=(dx:number,dy:number)=>projection[((ix+dx)+(iy+dy)*n)*4+variant];
      const value=THREE.MathUtils.lerp(THREE.MathUtils.lerp(at(0,0),at(1,0),fx),THREE.MathUtils.lerp(at(0,1),at(1,1),fx),fy);
      const index=((x%size+size)%size)+((z%size+size)%size)*size;
      data[index]=Math.round(255-(255-data[index])*(1-value/255));
    }
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RedFormat);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;return texture;
}
