import * as THREE from 'three';
import { random } from './materials';
import { clearCloudPosition } from './clouds';
import { horizonGLSL } from './horizon';
import { SKY_GRID, SKY_CELL, SKY_SPAN, VALLEY_CLOUD_COUNT, wrapCloudCoordinate } from './cloudLayout';
import { SUN_DIRECTION, CLOUD_SHADOW_COUNT } from './atmosphere';
import type { AtmosphereUniforms } from './atmosphere';

function densityVolume(){
  const size=72, density=new Float32Array(size**3);
  const hash=(x:number,y:number,z:number)=>{let n=(x*374761393+y*668265263+z*2147483647)|0;n=(n^(n>>>13))*1274126177;return ((n^(n>>>16))>>>0)/4294967295;};
  const noise=(x:number,y:number,z:number)=>{
    const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);let fx=x-ix,fy=y-iy,fz=z-iz;
    fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);fz=fz*fz*(3-2*fz);
    const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
    return mix(mix(mix(hash(ix,iy,iz),hash(ix+1,iy,iz),fx),mix(hash(ix,iy+1,iz),hash(ix+1,iy+1,iz),fx),fy),mix(mix(hash(ix,iy,iz+1),hash(ix+1,iy,iz+1),fx),mix(hash(ix,iy+1,iz+1),hash(ix+1,iy+1,iz+1),fx),fy),fz);
  };
  const lobes=[[-.5,-.1,.05,.42,.34,.5],[-.18,.18,-.08,.46,.56,.51],[.25,.22,.07,.42,.51,.52],[.54,-.05,-.05,.36,.32,.43],[.04,-.2,.18,.67,.22,.5]];
  for(let z=0;z<size;z++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const px=x/(size-1)*2-1,py=y/(size-1)*2-1,pz=z/(size-1)*2-1;
    let shape=-1;
    for(const [cx,cy,cz,rx,ry,rz] of lobes)shape=Math.max(shape,1-Math.hypot((px-cx)/rx,(py-cy)/ry,(pz-cz)/rz));
    if(shape<-.15)continue;
    const n=noise(px*6+20,py*6+20,pz*6+20)*.6+noise(px*15+30,py*15+30,pz*15+30)*.28+noise(px*32+50,py*32+50,pz*32+50)*.12;
    density[x+size*(y+size*z)]=Math.max(0,Math.min(1,(shape+(n-.5)*.5-.035)*2.4));
  }
  const bytes=new Uint8Array(size**3*4);
  const sample=(x:number,y:number,z:number)=>{x=Math.round(x);y=Math.round(y);z=Math.round(z);return x<0||y<0||z<0||x>=size||y>=size||z>=size?0:density[x+size*(y+size*z)];};
  for(let z=0;z<size;z++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=x+size*(y+size*z);let optical=0;
    for(let j=1;j<=12;j++)optical+=sample(x+SUN_DIRECTION.x*j*2.4,y+SUN_DIRECTION.y*j*2.4,z+SUN_DIRECTION.z*j*2.4)*.32;
    bytes[i*4]=Math.round(density[i]*255);bytes[i*4+1]=Math.round(Math.exp(-optical)*255);bytes[i*4+2]=0;bytes[i*4+3]=255;
  }
  const texture=new THREE.Data3DTexture(bytes,size,size,size);texture.format=THREE.RGBAFormat;texture.type=THREE.UnsignedByteType;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.unpackAlignment=1;texture.needsUpdate=true;
  return texture;
}

export function createCloudField(scene:THREE.Scene,atmosphere:AtmosphereUniforms){
  const texture=densityVolume(),rng=random(821),group=new THREE.Group();scene.add(group);
  const geometry=new THREE.BoxGeometry(2,2,2);
  const materials:THREE.ShaderMaterial[]=[];
  const clouds:THREE.Mesh[]=[];
  const fragment=`
    precision highp float;
    precision highp sampler3D;
    uniform sampler3D uVolume;
    uniform vec3 uCenter;
    uniform vec3 uSize;
    ${horizonGLSL}
    varying vec3 vWorld;
    void main(){
      vec3 ray=normalize(vWorld-cameraPosition);
      vec3 origin=(cameraPosition-uCenter)/uSize;
      vec3 direction=ray/uSize;
      vec3 invDir=1./direction;
      vec3 t0=(-vec3(1.)-origin)*invDir,t1=(vec3(1.)-origin)*invDir;
      vec3 lo=min(t0,t1),hi=max(t0,t1);
      float enter=max(max(lo.x,lo.y),lo.z),leave=min(min(hi.x,hi.y),hi.z);
      enter=max(enter,0.);
      if(leave<=enter)discard;
      float steps=mix(40.,24.,smoothstep(900.,3500.,length(uCenter-cameraPosition)));
      float stepSize=(leave-enter)/steps;
      float jitter=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
      float t=enter+stepSize*jitter;
      vec4 accum=vec4(0.);
      for(int i=0;i<40;i++){
        if(float(i)>=steps)break;
        vec3 uv=(origin+direction*t)*.5+.5;
        vec2 volume=texture(uVolume,uv).rg;
        float alpha=1.-exp(-volume.r*stepSize*.12);
        vec3 light=mix(vec3(.24,.31,.36),vec3(1.58,1.51,1.38),pow(volume.g,.7));
        accum.rgb+=(1.-accum.a)*alpha*light;
        accum.a+=(1.-accum.a)*alpha;
        if(accum.a>.985)break;
        t+=stepSize;
      }
      if(accum.a<.005)discard;
      vec3 color=accum.rgb/max(accum.a,.001);
      float distanceToEye=length(uCenter-cameraPosition);
      float haze=1.-exp(-pow(distanceToEye*.00018,1.5));
      color=mix(color,atmosphereColor(ray),haze);
      // Only recycle beyond the pale horizon, where the cloud is already invisible.
      float visibility=1.-smoothstep(4400.,5900.,distanceToEye);
      gl_FragColor=vec4(color,accum.a*visibility);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  for(let i=0;i<VALLEY_CLOUD_COUNT+SKY_GRID*SKY_GRID;i++){
    const valley=i<VALLEY_CLOUD_COUNT,lowLayer=!valley&&(i-VALLEY_CLOUD_COUNT)%3===0;
    const size=valley?new THREE.Vector3(24+rng()*17,17+rng()*11,21+rng()*15):lowLayer?new THREE.Vector3(34+rng()*31,12+rng()*10,28+rng()*27):new THREE.Vector3(48+rng()*64,22+rng()*27,38+rng()*49);
    let position:THREE.Vector3;
    if(valley){
      const heroes=[[-57,5,82],[63,58,87],[-200,90,140],[230,-35,150],[10,-85,180]];
      position=i<heroes.length?new THREE.Vector3(...heroes[i] as [number,number,number]):new THREE.Vector3((rng()-.5)*4200,-60+rng()*210,120+rng()*2400);
    }else {
      const cell=i-VALLEY_CLOUD_COUNT;
      const x=(cell%SKY_GRID+.12+rng()*.76)*SKY_CELL-SKY_SPAN/2;
      const z=(Math.floor(cell/SKY_GRID)+.12+rng()*.76)*SKY_CELL-SKY_SPAN/2;
      position=new THREE.Vector3(x,lowLayer?200+rng()*70:310+rng()*170,z);
    }
    const clear=clearCloudPosition(position,size.length(),valley?'valley':'sky');position.set(clear.x,clear.y,clear.z);
    const mat=new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,side:THREE.BackSide,
      uniforms:{uVolume:{value:texture},uCenter:{value:position},uSize:{value:size}},
      vertexShader:'varying vec3 vWorld; void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}',fragmentShader:fragment,
    });
    const cloud=new THREE.Mesh(geometry,mat);cloud.position.copy(position);cloud.scale.copy(size);cloud.userData.speed=.16+rng()*.16;cloud.userData.layer=valley?'valley':'sky';
    materials.push(mat);clouds.push(cloud);group.add(cloud);
  }
  const origin=new THREE.Vector3();
  function update(time:number,delta:number,eye:THREE.Vector3=origin){
    atmosphere.uAtmosTime.value=time;
    clouds.forEach((cloud,i)=>{
      cloud.position.x+=delta*cloud.userData.speed;
      if(cloud.userData.layer==='sky'){
        cloud.position.x=wrapCloudCoordinate(cloud.position.x,eye.x);
        cloud.position.z=wrapCloudCoordinate(cloud.position.z,eye.z);
      }
      materials[i].uniforms.uCenter.value.copy(cloud.position);
    });
    // Use nearby clouds for terrain shadows as the visitor explores either field.
    const nearest=[...clouds].sort((a,b)=>a.position.distanceToSquared(eye)-b.position.distanceToSquared(eye));
    for(let i=0;i<CLOUD_SHADOW_COUNT;i++){
      atmosphere.uCloudCenters.value[i].copy(nearest[i].position);
      atmosphere.uCloudSizes.value[i].copy(nearest[i].scale).multiplyScalar(.8);
    }
  }
  update(0,0);
  return {update,dispose(){scene.remove(group);geometry.dispose();materials.forEach(m=>m.dispose());texture.dispose();}};
}
