import * as THREE from 'three';

// Integrate a distant cloud once, instead of marching through it for every pixel every frame.
export function createCloudCard(volume:THREE.Data3DTexture,width=256,height=192){
  const source=volume.image.data as Uint8Array,resolution=volume.image.width;
  const bytes=new Uint8Array(width*height*4),steps=resolution;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const vx=Math.round(x/(width-1)*(resolution-1)),vy=Math.round(y/(height-1)*(resolution-1));
    let opacity=0,light=0;
    for(let z=resolution-1;z>=0;z--){
      const i=(vx+resolution*(vy+resolution*z))*4;
      const raw=Math.max(0,Math.min(1,(source[i]/255-.035)/.465));
      const density=raw*raw*(3-2*raw),alpha=1-Math.exp(-density*80/steps*.105);
      const contribution=(1-opacity)*alpha;
      light+=contribution*Math.pow(source[i+1]/255,1.1);opacity+=contribution;
      if(opacity>.985)break;
    }
    const index=(x+y*width)*4;
    bytes[index]=Math.round(opacity*255);bytes[index+1]=Math.round(light/Math.max(opacity,.001)*255);bytes[index+3]=255;
  }
  return cloudCardTexture(bytes,width,height);
}
export function cloudCardTexture(bytes:Uint8Array,width=256,height=192){
  const texture=new THREE.DataTexture(bytes,width,height,THREE.RGBAFormat);
  texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
  texture.generateMipmaps=true;texture.needsUpdate=true;return texture;
}
