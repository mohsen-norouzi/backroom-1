import * as THREE from 'three';
import { FLOOR, TOP, NOTCH, NOTCH_END, NOTCH_SLOPE, notchBackZ } from './physics';
import { TURF_RIM } from './terrain';
import { random } from './materials';
import { cloudShadowGLSL } from './atmosphere';
import { horizonGLSL } from './horizon';
import { recessLightingGLSL } from './recessLighting';
import type { AtmosphereUniforms } from './atmosphere';

// Each range overlaps its neighbours. Fine curved blades give way to small tufts
// before they become subpixel, rather than exposing a bare circle around the viewer.
export const GRASS_RANGES = [
  {name:'near',span:32,inner:[-2,-1],outer:[10,16],ground:80000,wall:42000},
  {name:'middle',span:160,inner:[6,14],outer:[52,80],ground:44000,wall:28000},
  {name:'far',span:440,inner:[44,68],outer:[145,215],ground:32000,wall:18000},
] as const;
const surfaces=[
  {name:'ground',kind:0,origin:[0,0,0],u:[1,0,0],v:[0,0,1],normal:[0,1,0],width:Infinity},
  {name:'cliff',kind:1,origin:[0,0,.012],u:[1,0,0],v:[0,1,0],normal:[0,0,1],width:Infinity},
  {name:'recess-back',kind:2,origin:[0,0,notchBackZ(0)+.012],u:[1,0,0],v:[0,1,-NOTCH_SLOPE],normal:[0,NOTCH_SLOPE,1],width:NOTCH*2},
  {name:'recess-left',kind:2,origin:[-NOTCH+.012,0,NOTCH_END/2],u:[0,0,1],v:[0,1,0],normal:[1,0,0],width:-NOTCH_END},
  {name:'recess-right',kind:2,origin:[NOTCH-.012,0,NOTCH_END/2],u:[0,0,1],v:[0,1,0],normal:[-1,0,0],width:-NOTCH_END},
] as const;

function bladeGeometry(level:number){
  if(level===0){
    // One shared tip: a subdivided plane adds a fourth, zero-area triangle.
    const half=.023/2,mid=half*Math.pow(.5,.7),blade=new THREE.BufferGeometry();
    blade.setAttribute('position',new THREE.Float32BufferAttribute([
      -half,0,0,half,0,0,-mid,.085,.01625,mid,.085,.01625,0,.17,.065,
    ],3));
    blade.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,.5,1,.5,.5,1],2));
    blade.setIndex([0,1,2,1,3,2,2,3,4]);return blade;
  }
  const rng=random(214+level),vertices:number[]=[],uv:number[]=[];
  const count=5,spread=level===1?.105:.26,width=level===1?.035:.068;
  for(let i=0;i<count;i++){
    const angle=rng()*Math.PI*2,c=Math.cos(angle),s=Math.sin(angle);
    const x=(rng()-.5)*spread*2,z=(rng()-.5)*spread*2,h=.16+rng()*(level===1?.08:.12),lean=(rng()-.5)*.11;
    vertices.push(x-width*c/2,0,z-width*s/2,x+width*c/2,0,z+width*s/2,x+lean,h,z+.055);
    uv.push(0,0,1,0,.5,1);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return geometry;
}

const vertexShader=`
  attribute vec2 aOffset;attribute vec3 aShape;attribute vec3 aTint;
  uniform vec2 uSpan;uniform vec2 uAnchor;uniform vec2 uScroll;
  uniform vec3 uOrigin;uniform vec3 uTangent;uniform vec3 uBitangent;uniform vec3 uNormal;
  uniform float uSurface;uniform float uWidth;uniform vec4 uRange;uniform sampler2D uTurf;
  uniform float uAtmosTime;varying vec2 vUv;varying vec3 vTint;varying vec3 vWorld;
  void main(){
    vec2 stable=aOffset*uSpan;
    vec2 rootUV=mix(stable,mod(stable-uAnchor+uSpan*.5,uSpan)-uSpan*.5+uAnchor,uScroll);
    vec3 root=uOrigin+uTangent*rootUV.x+uBitangent*rootUV.y;
    bool hidden=false;
    if(uSurface<.5){
      root.y=root.z<=0.&&!(abs(root.x)<${NOTCH}&&root.z>${NOTCH_END}.)?${TOP}.006:${FLOOR+.006};
      hidden=root.y<0.&&abs(root.x)<${NOTCH}&&root.z<${notchBackZ(FLOOR)}.;
      hidden=hidden||abs(root.x)<7.8&&abs(root.z+56.)<6.8;
      if(abs(root.x)<1.1&&root.z>-51.&&root.z<-37.)hidden=true;
      float notchDistance=length(vec2(max(abs(root.x)-${NOTCH},0.),max(${NOTCH_END}.-root.z,0.)));
      float edgeDistance=min(-root.z,notchDistance);
      if(root.y>0.&&edgeDistance<${TURF_RIM})root.y-=${TURF_RIM}-sqrt(max(0.,${TURF_RIM*TURF_RIM}-pow(${TURF_RIM}-max(0.,edgeDistance),2.)));
    }else{
      hidden=root.y<${FLOOR+.015}||root.y>${TOP-TURF_RIM-.012}||abs(rootUV.x)>uWidth*.5;
      if(uSurface<1.5&&abs(root.x)<${NOTCH})hidden=true;
      if(uSurface>1.5&&root.z<${NOTCH_END}.+(${TOP}.-root.y)*${NOTCH_SLOPE}-.025)hidden=true;
    }
    // Reject offscreen roots before the more expensive bend and turf sampling.
    vec4 rootClip=projectionMatrix*viewMatrix*vec4(root,1.);
    float margin=.9*max(projectionMatrix[0][0],projectionMatrix[1][1]);
    if(rootClip.w<.01||abs(rootClip.x)>rootClip.w+margin||abs(rootClip.y)>rootClip.w+margin)hidden=true;
    float distanceToEye=distance(root,cameraPosition);
    float coverage=smoothstep(uRange.x,uRange.y,distanceToEye)*(1.-smoothstep(uRange.z,uRange.w,distanceToEye));
    float threshold=.1+aShape.z*.8;
    // Each rooted tuft retires at a different point through the overlap. No
    // synchronized ring, alpha sorting, or camera-facing grass cards.
    float presence=smoothstep(threshold-.09,threshold+.09,coverage);
    if(hidden||presence<.001){gl_Position=vec4(2.,2.,2.,1.);vWorld=root;vTint=vec3(0.);vUv=uv;return;}
    vec3 p=position*aShape.y*presence;
    float bend=sin(uAtmosTime*.85+root.x*.7+root.z*.42+root.y*.18)*.018*uv.y*uv.y;
    p.x+=bend*presence;
    float c=cos(aShape.x),s=sin(aShape.x);
    vec2 tangent=vec2(p.x*c+p.z*s,-p.x*s+p.z*c);
    vWorld=root+uTangent*tangent.x+uBitangent*tangent.y+uNormal*p.y;
    if(uSurface>.5)vWorld.y-=p.y*.85;
    vec2 turfUV=uSurface<.5?root.xz*.68:vec2(root.x+root.z,root.y)*.68;
    vec3 turf=pow(max(textureLod(uTurf,turfUV,6.).rgb,vec3(.001)),vec3(.91))*vec3(.89,1.,1.10);
    if(uSurface>.5)turf*=vec3(.81,1.,1.27);
    vTint=mix(turf,aTint,.30)*(.98+aShape.z*.10);
    vUv=uv;
    gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);
  }`;
const fragmentShader=`
  varying vec2 vUv;varying vec3 vTint;varying vec3 vWorld;uniform float uSurface;uniform vec3 uNormal;
  ${cloudShadowGLSL}
  ${horizonGLSL}
  ${recessLightingGLSL}
  void main(){
    float direct=max(dot(uNormal,uSunDirection),0.);
    if(uSurface>1.5)direct*=recessSunVisibility(vWorld);
    float ambient=uSurface<.5?.5:uSurface<1.5?.38:.38*recessSkyVisibility(vWorld);
    float light=ambient+direct*.97*cloudShade(vWorld);
    vec3 color=vTint*mix(.69,1.13,vUv.y)*light;
    vec3 ray=vWorld-cameraPosition;
    color=mix(color,atmosphereColor(ray),uSurface<.5?fieldHaze(ray):terrainHaze(ray));
    gl_FragColor=vec4(color,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export function createLivingGrass(scene:THREE.Scene,atmosphere:AtmosphereUniforms,turf?:THREE.Texture){
  const ownedTexture=!turf;
  if(!turf){turf=new THREE.DataTexture(new Uint8Array([95,118,76,255]),1,1);turf.colorSpace=THREE.SRGBColorSpace;turf.needsUpdate=true;}
  const bases=GRASS_RANGES.map((_,i)=>bladeGeometry(i));
  const patches=surfaces.flatMap((surface,surfaceIndex)=>GRASS_RANGES.map((range,level)=>{
    const rng=random(926+surfaceIndex*313+level*729),width=Math.min(range.span,surface.width);
    const count=Math.ceil((surface.kind===0?range.ground:range.wall)*width/range.span);
    const geometry=new THREE.InstancedBufferGeometry();geometry.index=bases[level].index;geometry.attributes.position=bases[level].attributes.position;geometry.attributes.uv=bases[level].attributes.uv;
    const offsets=new Float32Array(count*2),shape=new Float32Array(count*3),tints=new Float32Array(count*3);
    const dark=new THREE.Color('#506747'),light=new THREE.Color('#7b936b'),tint=new THREE.Color();
    for(let i=0;i<count;i++){
      offsets[i*2]=rng()-.5;offsets[i*2+1]=rng()-.5;
      shape[i*3]=rng()*Math.PI*2;shape[i*3+1]=.55+rng()*.95;shape[i*3+2]=rng();
      tint.copy(dark).lerp(light,rng()).toArray(tints,i*3);
    }
    geometry.setAttribute('aOffset',new THREE.InstancedBufferAttribute(offsets,2));geometry.setAttribute('aShape',new THREE.InstancedBufferAttribute(shape,3));geometry.setAttribute('aTint',new THREE.InstancedBufferAttribute(tints,3));geometry.instanceCount=count;
    const origin=new THREE.Vector3(...surface.origin),u=new THREE.Vector3(...surface.u),v=new THREE.Vector3(...surface.v),normal=new THREE.Vector3(...surface.normal).normalize();
    const material=new THREE.ShaderMaterial({side:THREE.DoubleSide,uniforms:{...atmosphere,
      uSpan:{value:new THREE.Vector2(width,range.span)},uAnchor:{value:new THREE.Vector2()},
      uScroll:{value:new THREE.Vector2(surface.width>range.span?1:0,1)},
      uOrigin:{value:origin},uTangent:{value:u},uBitangent:{value:v},uNormal:{value:normal},
      uSurface:{value:surface.kind},uWidth:{value:Number.isFinite(surface.width)?surface.width:100000},
      uRange:{value:new THREE.Vector4(...range.inner,...range.outer)},uTurf:{value:turf},
    },vertexShader,fragmentShader});
    const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.name=`grass-${surface.name}-${range.name}`;scene.add(mesh);
    return {mesh,material,geometry,surface,range,origin,u,v,normal};
  }));
  const relative=new THREE.Vector3(),corner=new THREE.Vector3(),box=new THREE.Box3();
  const frustum=new THREE.Frustum(),viewProjection=new THREE.Matrix4();
  function update(eye:THREE.Vector3,camera?:THREE.Camera){
    if(camera){camera.updateMatrixWorld();viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(viewProjection);}
    const groundDistance=Math.min(Math.abs(eye.y-FLOOR),Math.hypot(eye.y-TOP,
      Math.min(Math.hypot(Math.max(eye.x+NOTCH,0),Math.max(eye.z,0)),Math.hypot(Math.max(NOTCH-eye.x,0),Math.max(eye.z,0)),Math.max(eye.z-NOTCH_END,0))));
    for(const patch of patches){
      const {mesh,material,surface,range,origin,u,v,normal}=patch;
      relative.copy(eye).sub(origin);material.uniforms.uAnchor.value.set(relative.dot(u)/u.lengthSq(),relative.dot(v)/v.lengthSq());
      let distance=groundDistance;
      if(surface.kind!==0){
        const outsideWidth=Math.max(Math.abs(relative.dot(u))-surface.width*.5,0);
        const outsideHeight=Math.max(FLOOR-eye.y,eye.y-(TOP-TURF_RIM),0);
        const gap=surface.kind===1?Math.max(NOTCH-Math.abs(eye.x),0):0;
        distance=Math.hypot(relative.dot(normal),Math.max(outsideWidth,gap),outsideHeight);
      }
      // A generous margin avoids a visible change at the CPU culling boundary.
      mesh.visible=distance<range.outer[1]+2;
      if(mesh.visible&&camera&&surface.kind!==0){
        const span=material.uniforms.uSpan.value,anchor=material.uniforms.uAnchor.value;
        const centerU=surface.width>range.span?anchor.x:0;
        const minU=Math.max(-surface.width*.5,centerU-span.x*.5),maxU=Math.min(surface.width*.5,centerU+span.x*.5);
        const minV=Math.max(FLOOR,anchor.y-span.y*.5),maxV=Math.min(TOP-TURF_RIM,anchor.y+span.y*.5);
        box.makeEmpty();
        for(const x of [minU,maxU])for(const y of [minV,maxV]){
          corner.copy(origin).addScaledVector(u,x).addScaledVector(v,y);box.expandByPoint(corner);
        }
        box.expandByScalar(.6);mesh.visible=minU<=maxU&&minV<=maxV&&frustum.intersectsBox(box);
      }
    }
  }
  return {update,dispose(){
    for(const {mesh,geometry,material} of patches){scene.remove(mesh);geometry.dispose();material.dispose();}
    bases.forEach(g=>g.dispose());if(ownedTexture)turf.dispose();
  }};
}
