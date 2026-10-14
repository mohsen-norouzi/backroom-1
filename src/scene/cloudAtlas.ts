import * as THREE from 'three';

// Three density/light volumes in a 2×2 atlas. RG uses half the bytes of RGBA,
// and every ray step needs only one sampler regardless of the cloud variant.
export function packCloudVolumes(volumes:THREE.Data3DTexture[]){
  const size=volumes[0].image.width,width=size*2,height=size*2;
  const bytes=new Uint8Array(width*height*size*2);
  for(let variant=0;variant<volumes.length;variant++){
    const volume=volumes[variant];
    if(volume.image.width!==size)throw new Error('Cloud volume sizes must match');
    const source=volume.image.data as Uint8Array,ox=(variant%2)*size,oy=Math.floor(variant/2)*size;
    for(let z=0;z<size;z++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const input=(x+size*(y+size*z))*4,output=(x+ox+width*(y+oy+height*z))*2;
      bytes[output]=source[input];bytes[output+1]=source[input+1];
    }
  }
  const texture=new THREE.Data3DTexture(bytes,width,height,size);
  texture.format=THREE.RGFormat;texture.type=THREE.UnsignedByteType;
  texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.unpackAlignment=1;texture.needsUpdate=true;
  return texture;
}
