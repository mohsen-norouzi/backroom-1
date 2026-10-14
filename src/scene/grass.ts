import * as THREE from 'three';
import { random } from './materials';
import { cloudShadowGLSL } from './atmosphere';
import type { AtmosphereUniforms } from './atmosphere';

export function createLivingGrass(scene:THREE.Scene,atmosphere:AtmosphereUniforms){
  const rng=random(926),count=105000;
  const blade=new THREE.PlaneGeometry(.012,.14,1,3);blade.translate(0,.07,0);
  const position=blade.attributes.position;
  for(let i=0;i<position.count;i++){
    const t=position.getY(i)/.14;position.setX(i,position.getX(i)*(1-t));position.setZ(i,t*t*.035);
  }
  const geometry=new THREE.InstancedBufferGeometry();geometry.index=blade.index;geometry.attributes.position=blade.attributes.position;geometry.attributes.uv=blade.attributes.uv;
  const offsets=new Float32Array(count*2),shape=new Float32Array(count*3),tints=new Float32Array(count*3);
  for(let i=0;i<count;i++){
    offsets[i*2]=(rng()-.5)*48;offsets[i*2+1]=(rng()-.5)*48;
    shape[i*3]=rng()*Math.PI*2;shape[i*3+1]=.45+rng()*1.1;shape[i*3+2]=rng();
    const tint=new THREE.Color('#354c29').lerp(new THREE.Color('#708453'),rng());tint.toArray(tints,i*3);
  }
  geometry.setAttribute('aOffset',new THREE.InstancedBufferAttribute(offsets,2));geometry.setAttribute('aShape',new THREE.InstancedBufferAttribute(shape,3));geometry.setAttribute('aTint',new THREE.InstancedBufferAttribute(tints,3));geometry.instanceCount=count;
  const material=new THREE.ShaderMaterial({
    side:THREE.DoubleSide,uniforms:{...atmosphere,uFog:{value:new THREE.Color('#b7c6c4')}},
    vertexShader:`
      attribute vec2 aOffset;attribute vec3 aShape;attribute vec3 aTint;
      uniform float uAtmosTime;varying vec2 vUv;varying vec3 vTint;varying vec3 vWorld;
      void main(){
        vec2 root=mod(aOffset-cameraPosition.xz+24.,48.)-24.+cameraPosition.xz;
        float ground=root.y<=0.&&!(abs(root.x)<4.8&&root.y>-37.)?105.12:-149.99;
        float hidden=abs(root.x)<7.8&&abs(root.y+56.)<6.8?1.:0.;
        if(abs(root.x)<1.1&&root.y>-51.&&root.y<-37.)hidden=1.;
        vec3 p=position*aShape.y;
        float bend=sin(uAtmosTime*.85+root.x*.7+root.y*.42)*.018*uv.y*uv.y;
        p.x+=bend;
        float c=cos(aShape.x),s=sin(aShape.x);
        vWorld=vec3(root.x+p.x*c+p.z*s,ground+p.y-hidden*500.,root.y-p.x*s+p.z*c);
        vUv=uv;vTint=aTint*(.88+aShape.z*.24);
        gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);
      }`,
    fragmentShader:`
      varying vec2 vUv;varying vec3 vTint;varying vec3 vWorld;uniform vec3 uFog;
      ${cloudShadowGLSL}
      void main(){
        float distanceToEye=distance(vWorld,cameraPosition);
        float coverage=1.-smoothstep(14.,23.,distanceToEye);
        if(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)>coverage)discard;
        vec3 color=vTint*mix(.48,1.18,vUv.y)*cloudShade(vWorld);
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;scene.add(mesh);
  return {dispose(){scene.remove(mesh);geometry.dispose();material.dispose();}};
}
