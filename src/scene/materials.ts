import * as THREE from 'three';
import { cloudShadowGLSL } from './atmosphere';
import { horizonGLSL, SKY_RADIUS } from './horizon';
import type { AtmosphereUniforms } from './atmosphere';
import { recessLightingGLSL, withoutLocalShadowMap } from './recessLighting';

export function random(seed: number) {
  let state = seed >>> 0;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
}

export function grassTexture() {
  const texture = new THREE.TextureLoader().load('/textures/meadow-turf.png');
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

const noise = `
float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
float noise2(vec2 p) {
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash21(i),hash21(i+vec2(1.,0.)),f.x),mix(hash21(i+vec2(0.,1.)),hash21(i+vec2(1.,1.)),f.x),f.y);
}
float fbm2(vec2 p) { return noise2(p)*.5+noise2(p*2.03)*.25+noise2(p*4.01)*.125+noise2(p*8.03)*.0625; }
`;

export function grassMaterial(texture: THREE.Texture, wall = false, dark = false, atmosphere?: AtmosphereUniforms) {
  const mat = new THREE.MeshStandardMaterial({
    map: texture, roughness: 1, bumpMap: texture, bumpScale: wall ? .024 : .018,
    color: dark ? '#e6ece1' : wall ? '#edf0e8' : '#f0f0e6',
  });
  mat.onBeforeCompile = shader => {
    if(atmosphere)Object.assign(shader.uniforms,atmosphere);
    shader.vertexShader = 'varying vec3 vWorld;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
    const grassUV=wall?'vec2(p.x+p.z,p.y)*.68':'p.xz*.68';
    shader.fragmentShader = 'varying vec3 vWorld;\n' + noise + horizonGLSL + (atmosphere?cloudShadowGLSL:'') + `vec2 grassUVWorld(vec3 p){return ${grassUV};}\n` + shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <bumpmap_pars_fragment>',THREE.ShaderChunk.bumpmap_pars_fragment.replaceAll('vBumpMapUv','grassUVWorld(vWorld)'));
    if(wall)shader.fragmentShader=withoutLocalShadowMap(shader.fragmentShader);
    if(dark)shader.fragmentShader=recessLightingGLSL+shader.fragmentShader;
    // Fog is blended in linear light with the exact same sky color as the background.
    shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>','');
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      outgoingLight -= reflectedLight.directDiffuse * (1.-${atmosphere?'cloudShade(vWorld)':'1.'}${dark?'*recessSunVisibility(vWorld)':''});
      ${dark?'outgoingLight -= reflectedLight.indirectDiffuse * (1.-recessSkyVisibility(vWorld));':''}
      vec3 viewRay=vWorld-cameraPosition;
      outgoingLight=mix(outgoingLight,atmosphereColor(viewRay),${wall?'terrainHaze':'fieldHaze'}(viewRay));
      #include <opaque_fragment>
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      vec2 grassUV = grassUVWorld(vWorld);
      vec4 a=texture2D(map,grassUV);
      vec4 b=texture2D(map,mat2(.8,-.6,.6,.8)*grassUV+vec2(.73,.28));
      vec4 sampledDiffuseColor=mix(a,b,smoothstep(.25,.75,noise2(grassUV*.09)));
      // A second physical scale retains the fibrous character on the immense cliff.
      float detailDistance=smoothstep(18.,160.,distance(vWorld,cameraPosition));
      vec3 middleScale=texture2D(map,grassUV*${wall?'.045':'.16'}+vec2(.17,.31)).rgb;
      sampledDiffuseColor.rgb=mix(sampledDiffuseColor.rgb,middleScale,${wall?'.72':'.36'}*detailDistance);
      // Preserve blade-scale detail; large black noise used to look like voxel terrain.
      sampledDiffuseColor.rgb=pow(max(sampledDiffuseColor.rgb,vec3(.001)),vec3(.91));
      sampledDiffuseColor.rgb*=vec3(.89,1.,1.10);
      ${wall?'sampledDiffuseColor.rgb*=vec3(.81,1.,1.27);':''}
      diffuseColor*=sampledDiffuseColor;
      float meadow=fbm2(vWorld.xz*.012+vec2(vWorld.y*.007,8.));
      diffuseColor.rgb*=mix(vec3(.91,.96,.96),vec3(1.04,1.025,.96),smoothstep(.22,.74,meadow));
      ${wall?`float streak=fbm2(vec2((vWorld.x+vWorld.z)*.11,vWorld.y*.025));
      diffuseColor.rgb*=.94+streak*.12;`:''}
    `);
  };
  mat.customProgramCacheKey = () => `grass-v9-${wall}-${dark}-${!!atmosphere}`;
  return mat;
}

export function createSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false,
    vertexShader: `varying vec3 vDir; void main(){vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `${horizonGLSL}
      varying vec3 vDir;
      void main(){
        vec3 direction=normalize(vDir);
        float angle=length(direction-sunDirection);
        float edge=max(fwidth(angle),.0012);
        float disc=1.-smoothstep(.008-edge,.008+edge,angle);
        float corona=exp(-angle*angle/.0018)*.19;
        float halo=exp(-angle*angle/.018)*.045;
        // Only the sky draws the sun; terrain haze must never paint it across walls.
        vec3 sunlight=vec3(3.2,2.9,2.35)*disc+vec3(1.,.91,.73)*(corona+halo);
        gl_FragColor=vec4(atmosphereColor(direction)+sunlight,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 32, 20), mat);
  // Draw the sky first, without depth testing: it must never cut off distant land.
  mesh.renderOrder=-1000;
  mesh.frustumCulled = false;
  return { mesh, material: mat };
}

// Fine surface variation keeps the landmark from looking like clean plastic.
export function weatherMaterial(material:THREE.MeshStandardMaterial,roof=false){
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vWeatherWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvWeatherWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader='varying vec3 vWeatherWorld;\n'+noise+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float mottling=fbm2(vWeatherWorld.xy*2.1+vWeatherWorld.z*.7);
      diffuseColor.rgb*=.86+mottling*.24;
      ${roof?`vec2 tiles=vWeatherWorld.xz*vec2(1.25,1.65);
      tiles.x+=mod(floor(tiles.y),2.)*.5;
      vec2 edge=min(fract(tiles),1.-fract(tiles));vec2 footprint=fwidth(tiles);
      float seam=smoothstep(0.,max(.025,footprint.x),edge.x)*smoothstep(0.,max(.025,footprint.y),edge.y);
      float detail=1.-smoothstep(.08,.4,max(footprint.x,footprint.y));
      diffuseColor.rgb*=mix(1.,mix(.6,1.,seam),detail);`:''}
    `);
  };
  material.customProgramCacheKey=()=>`weather-${roof}`;
}
