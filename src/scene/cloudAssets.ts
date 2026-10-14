import * as THREE from 'three';
import { cloudCardTexture } from './cloudCard';
import { cloudShadowTexture } from './cloudShadow';
export const CLOUD_VOLUME_SIZE=128;
async function unpack(path:string,length:number){
  const response=await fetch(path);
  if(!response.ok||!response.body)throw new Error(`Cloud asset: ${response.status}`);
  const bytes=new Uint8Array(await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  if(bytes.length!==length)throw new Error(`Invalid cloud data: ${path}`);
  return bytes;
}
export async function loadCloudDensity(seed:number){
  const bytes=await unpack(`/clouds/formation-${seed}.volume.bin`,CLOUD_VOLUME_SIZE**3*4);
  const texture=new THREE.Data3DTexture(bytes,CLOUD_VOLUME_SIZE,CLOUD_VOLUME_SIZE,CLOUD_VOLUME_SIZE);
  texture.format=THREE.RGBAFormat;texture.type=THREE.UnsignedByteType;
  texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.unpackAlignment=1;texture.needsUpdate=true;return texture;
}
export async function loadCloudCard(seed:number){
  return cloudCardTexture(await unpack(`/clouds/formation-${seed}.card.bin`,256*192*4));
}

export async function loadCloudShadows(){
  return cloudShadowTexture(await unpack('/clouds/sun-footprints.bin',128*128*4));
}
