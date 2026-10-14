import * as THREE from 'three';
import { NOTCH, TOP } from './physics';
import { SUN_DIRECTION } from './atmosphere';

// The cottage's small static shadow map cannot cover a 255 m deep recess.
// Ray/plane visibility gives the cut one continuous shadow, at every height.
export const recessLightingGLSL = `
float recessSunVisibility(vec3 p){
  const vec3 light=vec3(${SUN_DIRECTION.toArray().map(n=>n.toFixed(8)).join(',')});
  if(p.z>=0.||p.y>=${TOP}.)return 1.;
  float travel=max(0.,(${-NOTCH}-p.x)/light.x);
  vec3 hit=p+light*travel;
  float penumbra=.3+travel*.035;
  float front=smoothstep(-penumbra,penumbra,hit.z);
  float rim=smoothstep(-penumbra,penumbra,hit.y-${TOP}.);
  return max(front,rim);
}
float recessSkyVisibility(vec3 p){
  float front=${NOTCH}/(${NOTCH}+max(-p.z,0.));
  float rim=${NOTCH}/(${NOTCH}+max(${TOP}.-p.y,0.));
  return .50+.50*max(front,rim);
}
`;

export function withoutLocalShadowMap(fragment: string){
  return fragment.replace('#include <lights_fragment_begin>',
    THREE.ShaderChunk.lights_fragment_begin.replaceAll('&& receiveShadow','&& false'));
}

export function shadeRecessMaterial(material: THREE.MeshStandardMaterial){
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vRecessWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',
      `#include <worldpos_vertex>
      vec4 recessPosition=vec4(transformed,1.);
      #ifdef USE_INSTANCING
        recessPosition=instanceMatrix*recessPosition;
      #endif
      vRecessWorld=(modelMatrix*recessPosition).xyz;
    `);
    shader.fragmentShader='varying vec3 vRecessWorld;\n'+recessLightingGLSL+withoutLocalShadowMap(shader.fragmentShader);
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      outgoingLight-=reflectedLight.directDiffuse*(1.-recessSunVisibility(vRecessWorld));
      outgoingLight-=reflectedLight.indirectDiffuse*(1.-recessSkyVisibility(vRecessWorld));
      #include <opaque_fragment>
    `);
  };
  material.customProgramCacheKey=()=> 'recess-ladder-v1';
}
