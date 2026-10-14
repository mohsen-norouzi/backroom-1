import * as THREE from 'three';
export const SUN_DIRECTION = new THREE.Vector3(-.48,.67,.55).normalize();
export const CLOUD_SHADOW_COUNT = 8;
// A sun-facing projection of the density, using the typical cumulus proportions.
export const SHADOW_DIRECTION=SUN_DIRECTION.clone().divide(new THREE.Vector3(1.7,1,1.15)).normalize();
export const SHADOW_RIGHT=new THREE.Vector3().crossVectors(SHADOW_DIRECTION,new THREE.Vector3(0,1,0)).normalize();
export const SHADOW_UP=new THREE.Vector3().crossVectors(SHADOW_RIGHT,SHADOW_DIRECTION).normalize();
export const SHADOW_EXTENT=1.65;
export function atmosphereUniforms(){
  return {
    uCloudCenters:{value:Array.from({length:CLOUD_SHADOW_COUNT},()=>new THREE.Vector3())},
    uCloudSizes:{value:Array.from({length:CLOUD_SHADOW_COUNT},()=>new THREE.Vector3())},
    uCloudVariants:{value:new Float32Array(CLOUD_SHADOW_COUNT)},
    uCloudShadowMap:{value:null as THREE.DataTexture|null},
    uSunDirection:{value:SUN_DIRECTION.clone()},
    uAtmosTime:{value:0},
    uFieldShadows:{value:null as THREE.DataTexture|null},
    uSkyShadowOffset:{value:0},
  };
}
export type AtmosphereUniforms=ReturnType<typeof atmosphereUniforms>;
export const cloudShadowGLSL=`
uniform vec3 uCloudCenters[8];
uniform vec3 uCloudSizes[8];
uniform float uCloudVariants[8];
uniform sampler2D uCloudShadowMap;
uniform vec3 uSunDirection;
uniform float uAtmosTime;
uniform sampler2D uFieldShadows;
uniform float uSkyShadowOffset;
float cloudShade(vec3 p){
  float fieldWeight=1.-smoothstep(106.,160.,p.y);
  vec2 fieldPosition=p.xz+(105.-p.y)*uSunDirection.xz/uSunDirection.y;
  fieldPosition.x-=uSkyShadowOffset;
  float fieldOptical=texture2D(uFieldShadows,fieldPosition/12000.+.5,1.).r;
  float shade=1.-fieldOptical*.82*fieldWeight;
  for(int i=0;i<8;i++){
    if(uCloudSizes[i].x<.1)continue;
    vec3 q=(p-uCloudCenters[i])/uCloudSizes[i];
    vec3 d=uSunDirection/uCloudSizes[i];
    float t=-dot(q,d)/dot(d,d);
    if(t<=0.)continue;
    vec3 nearPoint=q+d*t;
    vec2 uv=vec2(dot(nearPoint,vec3(${SHADOW_RIGHT.toArray().join(',')})),dot(nearPoint,vec3(${SHADOW_UP.toArray().join(',')})))/${SHADOW_EXTENT*2}+.5;
    if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))continue;
    // Mip filtering widens the penumbra as the cloud moves away from the receiver.
    vec3 footprint=texture2D(uCloudShadowMap,uv,clamp(.4+log2(1.+t*.025),.8,3.8)).rgb;
    float variant=uCloudVariants[i];
    float optical=variant<.5?footprint.r:variant<1.5?footprint.g:footprint.b;
    float localWeight=uCloudCenters[i].y>190.?1.-fieldWeight:1.;
    shade*=1.-optical*.91*localWeight;
  }
  return max(.12,shade);
}
`;
