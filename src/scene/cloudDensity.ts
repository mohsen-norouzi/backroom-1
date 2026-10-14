import * as THREE from 'three';
import { SUN_DIRECTION } from './atmosphere';

// Three different, connected cumulus formations, with small torn-off wisps.
// Both density and sunlight transmission are baked into the volume.
export function createCloudDensity(seed:number,resolution=88){
  const density=new Float32Array(resolution**3);
  let state=seed>>>0;
  const random=()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296;};
  const hash=(x:number,y:number,z:number)=>{
    let n=(x*374761393+y*668265263+z*2147483647+seed*1013)|0;
    n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;
  };
  const noise=(x:number,y:number,z:number)=>{
    const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);
    let fx=x-ix,fy=y-iy,fz=z-iz;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);fz=fz*fz*(3-2*fz);
    const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
    return mix(mix(mix(hash(ix,iy,iz),hash(ix+1,iy,iz),fx),mix(hash(ix,iy+1,iz),hash(ix+1,iy+1,iz),fx),fy),mix(mix(hash(ix,iy,iz+1),hash(ix+1,iy,iz+1),fx),mix(hash(ix,iy+1,iz+1),hash(ix+1,iy+1,iz+1),fx),fy),fz);
  };
  const lobes:number[][]=[[0,-.14,0,.48,.20,.36]];
  // Irregular connected towers, instead of a row of equally sized puffs.
  const towers=5+Math.floor(random()*3);
  for(let i=0;i<towers;i++){
    const x=(i/(towers-1)-.5)*1.3+(random()-.5)*.18;
    const radius=.24+random()*.19;
    lobes.push([x,-.06+random()*.25,(random()-.5)*.4,radius,radius*(.8+random()*.5),radius*(.75+random()*.3)]);
  }
  lobes.push([(random()-.5)*.4,.3,(random()-.5)*.2,.28,.33+random()*.10,.28]);
  for(let i=0;i<11;i++){
    const parent=lobes[1+Math.floor(random()*towers)],radius=.07+random()*.10;
    lobes.push([parent[0]+(random()-.5)*parent[3]*2,parent[1]-.14+(random()-.5)*.28,parent[2]+(random()-.5)*parent[5]*1.8,radius,radius*(.7+random()*.5),radius]);
  }
  // Fit the complete density support, including erosion, inside a transparent guard band.
  // Fading the edge of an already clipped cloud would still leave a flat silhouette.
  const lower=[Infinity,Infinity,Infinity],upper=[-Infinity,-Infinity,-Infinity];
  for(const lobe of lobes)for(let axis=0;axis<3;axis++){
    lower[axis]=Math.min(lower[axis],lobe[axis]-lobe[axis+3]*1.4);
    upper[axis]=Math.max(upper[axis],lobe[axis]+lobe[axis+3]*1.4);
  }
  for(const lobe of lobes)for(let axis=0;axis<3;axis++){
    const center=(upper[axis]+lower[axis])*.5,scale=1.8/(upper[axis]-lower[axis]);
    lobe[axis]=(lobe[axis]-center)*scale;lobe[axis+3]*=scale;
  }
  for(let z=0;z<resolution;z++)for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){
    const px=x/(resolution-1)*2-1,py=y/(resolution-1)*2-1,pz=z/(resolution-1)*2-1;
    let shape=-1;
    for(const [cx,cy,cz,rx,ry,rz] of lobes){
      const dx=(px-cx)/rx,dy=(py-cy)/ry,dz=(pz-cz)/rz;
      if(Math.abs(dx)>1.3||Math.abs(dy)>1.3||Math.abs(dz)>1.3)continue;
      const lobe=1-Math.sqrt(dx*dx+dy*dy+dz*dz);
      const blend=Math.max(0,.17-Math.abs(shape-lobe));
      shape=Math.max(shape,lobe)+blend*blend/(4*.17);
    }
    if(shape<-.24)continue;
    const n=noise(px*7+20,py*7+20,pz*7+20)*.54+noise(px*19+30,py*19+30,pz*19+30)*.3+noise(px*41+50,py*41+50,pz*41+50)*.16;
    const d=(shape+(n-.52)*.62-.035)*3.1;
    const edge=Math.max(Math.abs(px),Math.abs(py),Math.abs(pz));
    const guard=Math.max(0,Math.min(1,(.97-edge)/.09));
    density[x+resolution*(y+resolution*z)]=Math.max(0,Math.min(1,d))*guard*guard*(3-2*guard);
  }
  const bytes=new Uint8Array(resolution**3*4);
  const sample=(x:number,y:number,z:number)=>{
    x=Math.round(x);y=Math.round(y);z=Math.round(z);
    return x<0||y<0||z<0||x>=resolution||y>=resolution||z>=resolution?0:density[x+resolution*(y+resolution*z)];
  };
  for(let z=0;z<resolution;z++)for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){
    const i=x+resolution*(y+resolution*z);let optical=0;
    if(density[i]>.001)for(let j=1;j<=18;j++)optical+=sample(x+SUN_DIRECTION.x*j*2*resolution/88,y+SUN_DIRECTION.y*j*2*resolution/88,z+SUN_DIRECTION.z*j*2*resolution/88)*.38;
    bytes[i*4]=Math.round(density[i]*255);bytes[i*4+1]=Math.round(Math.exp(-optical)*255);bytes[i*4+3]=255;
  }
  const texture=new THREE.Data3DTexture(bytes,resolution,resolution,resolution);
  texture.format=THREE.RGBAFormat;texture.type=THREE.UnsignedByteType;
  texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.unpackAlignment=1;texture.needsUpdate=true;
  return texture;
}
