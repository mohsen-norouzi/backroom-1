import * as THREE from 'three';
export const SUN_DIRECTION = new THREE.Vector3(-.48,.67,.55).normalize();
export const CLOUD_SHADOW_COUNT = 24;
export function atmosphereUniforms(){
  return {
    uCloudCenters:{value:Array.from({length:CLOUD_SHADOW_COUNT},()=>new THREE.Vector3())},
    uCloudSizes:{value:Array.from({length:CLOUD_SHADOW_COUNT},()=>new THREE.Vector3())},
    uSunDirection:{value:SUN_DIRECTION.clone()},
    uAtmosTime:{value:0},
  };
}
export type AtmosphereUniforms=ReturnType<typeof atmosphereUniforms>;
export const cloudShadowGLSL=`
uniform vec3 uCloudCenters[24];
uniform vec3 uCloudSizes[24];
uniform vec3 uSunDirection;
uniform float uAtmosTime;
float cloudShade(vec3 p){
  float shade=1.;
  for(int i=0;i<24;i++){
    if(uCloudSizes[i].x<.1)continue;
    vec3 q=(p-uCloudCenters[i])/uCloudSizes[i];
    vec3 d=uSunDirection/uCloudSizes[i];
    float t=-dot(q,d)/dot(d,d);
    if(t<=0.)continue;
    vec3 nearPoint=q+d*t;
    float silhouette=1.-dot(nearPoint,nearPoint);
    // A soft, irregular penumbra rather than a hard circular decal.
    silhouette+=sin(nearPoint.x*12.+nearPoint.z*8.)*sin(nearPoint.y*13.-nearPoint.x*7.)*.09;
    shade*=1.-smoothstep(-.08,.5,silhouette)*.42;
  }
  return max(.28,shade);
}
`;
