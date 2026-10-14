import * as THREE from 'three';
import { SHADOW_DIRECTION, SHADOW_RIGHT, SHADOW_UP, SHADOW_EXTENT } from './atmosphere';

// Each RGB channel holds a cloud's sun-facing density projection. One filtered
// lookup replaces the old analytic oval without adding live volume sampling.
export function createCloudShadowAtlas(volumes:THREE.Data3DTexture[],size=128){
  const bytes=new Uint8Array(size*size*4),steps=80,step=3.6/steps;
  volumes.forEach((volume,variant)=>{
    const source=volume.image.data as Uint8Array,n=volume.image.width;
    const sample=(px:number,py:number,pz:number)=>{
      const x=Math.round((px*.5+.5)*(n-1)),y=Math.round((py*.5+.5)*(n-1)),z=Math.round((pz*.5+.5)*(n-1));
      return x<0||y<0||z<0||x>=n||y>=n||z>=n?0:source[(x+n*(y+n*z))*4]/255;
    };
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const sx=(x/(size-1)*2-1)*SHADOW_EXTENT,sy=(y/(size-1)*2-1)*SHADOW_EXTENT;
      const px=SHADOW_RIGHT.x*sx+SHADOW_UP.x*sy,py=SHADOW_RIGHT.y*sx+SHADOW_UP.y*sy,pz=SHADOW_RIGHT.z*sx+SHADOW_UP.z*sy;
      let optical=0;
      for(let j=0;j<steps;j++){
        const d=-1.8+(j+.5)*step;
        optical+=sample(px+SHADOW_DIRECTION.x*d,py+SHADOW_DIRECTION.y*d,pz+SHADOW_DIRECTION.z*d)*step;
      }
      bytes[(x+y*size)*4+variant]=Math.round((1-Math.exp(-optical*7))*255);
      bytes[(x+y*size)*4+3]=255;
    }
  });
  return cloudShadowTexture(bytes,size);
}
export function cloudShadowTexture(bytes:Uint8Array,size=128){
  const texture=new THREE.DataTexture(bytes,size,size,THREE.RGBAFormat);
  texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
  texture.generateMipmaps=true;texture.needsUpdate=true;return texture;
}
