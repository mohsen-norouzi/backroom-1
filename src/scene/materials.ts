import * as THREE from 'three';
import { cloudShadowGLSL } from './atmosphere';
import { horizonGLSL, SKY_RADIUS } from './horizon';
import type { AtmosphereUniforms } from './atmosphere';

export function random(seed: number) {
  let state = seed >>> 0;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
}

export function grassTexture() {
  const texture = new THREE.TextureLoader().load('/textures/grass-turf.png');
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
    map: texture, roughness: 1, bumpMap: texture, bumpScale: wall ? .07 : .025,
    color: dark ? '#97a486' : wall ? '#b1b8a0' : '#b3b9a2',
  });
  mat.onBeforeCompile = shader => {
    if(atmosphere)Object.assign(shader.uniforms,atmosphere);
    shader.vertexShader = 'varying vec3 vWorld;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
    const grassUV=wall?'vec2(p.x+p.z,p.y)*.5':'p.xz*.5';
    shader.fragmentShader = 'varying vec3 vWorld;\n' + noise + horizonGLSL + (atmosphere?cloudShadowGLSL:'') + `vec2 grassUVWorld(vec3 p){return ${grassUV};}\n` + shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <bumpmap_pars_fragment>',THREE.ShaderChunk.bumpmap_pars_fragment.replaceAll('vBumpMapUv','grassUVWorld(vWorld)'));
    // Fog is blended in linear light with the exact same sky color as the background.
    shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>','');
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      vec3 viewRay=vWorld-cameraPosition;
      outgoingLight=mix(outgoingLight,atmosphereColor(viewRay),terrainHaze(viewRay));
      #include <opaque_fragment>
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      vec2 grassUV = grassUVWorld(vWorld);
      vec4 a = texture2D(map, grassUV);
      vec4 b = texture2D(map, mat2(.8,-.6,.6,.8)*grassUV*.93+vec2(.37,.71));
      vec4 c = texture2D(map, mat2(-.6,-.8,.8,-.6)*grassUV*1.07+vec2(.51,.19));
      float blend = smoothstep(.2,.8,noise2(grassUV*.14));
      vec4 sampledDiffuseColor = mix(mix(a,b,blend),c,.24);
      diffuseColor *= sampledDiffuseColor;
      float mottling = fbm2(vWorld.xz*.018+vWorld.y*.008);
      diffuseColor.rgb *= .88 + mottling*.27;
      ${atmosphere?'diffuseColor.rgb *= cloudShade(vWorld);':''}
      ${wall ? `float streak = fbm2(vec2((vWorld.x+vWorld.z)*3.2,vWorld.y*.12));
      float fine = noise2(vec2((vWorld.x+vWorld.z)*.7,vWorld.y*.9));
      diffuseColor.rgb *= .86+streak*.18+fine*.13;
      diffuseColor.rgb *= mix(.73,1.05,smoothstep(-150.,105.,vWorld.y));` : `
      float variation=fbm2(vWorld.xz*.17);
      diffuseColor.rgb*=mix(.90,1.05,variation);`}
    `);
  };
  mat.customProgramCacheKey = () => `grass-v4-${wall}-${dark}-${!!atmosphere}`;
  return mat;
}

export function createSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false,
    vertexShader: `varying vec3 vDir; void main(){vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `${horizonGLSL}
      varying vec3 vDir;
      void main(){
        gl_FragColor=vec4(atmosphereColor(vDir),1.);
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
