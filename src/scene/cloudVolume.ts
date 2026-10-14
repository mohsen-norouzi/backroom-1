import * as THREE from 'three';
import { random } from './materials';
import { createCloudDensity } from './cloudDensity';
import { packCloudVolumes } from './cloudAtlas';
import { loadCloudDensity, loadCloudShadows } from './cloudAssets';
import { createCloudShadowAtlas } from './cloudShadow';
import { createFieldShadows } from './fieldShadows';
import { clearCloudBounds } from './clouds';
import { horizonGLSL } from './horizon';
import { SKY_GRID, SKY_CELL, SKY_SPAN, VALLEY_CLOUD_COUNT, wrapCloudCoordinate } from './cloudLayout';
import { CLOUD_SHADOW_COUNT } from './atmosphere';
import type { AtmosphereUniforms } from './atmosphere';
export function createCloudField(scene:THREE.Scene,atmosphere:AtmosphereUniforms,loadAssets=true){
  const seeds=[713,1949,3571],textures=seeds.map(seed=>createCloudDensity(seed,24));
  let shadowMap=createCloudShadowAtlas(textures,48);atmosphere.uCloudShadowMap.value=shadowMap;
  let volumeTexture=packCloudVolumes(textures);textures.forEach(texture=>texture.dispose());
  let disposed=false,lastSort=-1;
  const rng=random(821),group=new THREE.Group();scene.add(group);
  const clouds:THREE.Object3D[]=[];
  const fragment=`
    precision highp float;
    precision highp sampler3D;
    uniform sampler3D uVolume;
    varying vec3 vCenter;
    varying vec3 vSize;
    varying float vVariant;
    ${horizonGLSL}
    varying vec3 vWorld;
    void main(){
      vec3 ray=normalize(vWorld-cameraPosition);
      vec3 origin=(cameraPosition-vCenter)/vSize;
      vec3 direction=ray/vSize;
      vec3 invDir=1./direction;
      vec3 t0=(-vec3(1.)-origin)*invDir,t1=(vec3(1.)-origin)*invDir;
      vec3 lo=min(t0,t1),hi=max(t0,t1);
      float enter=max(max(lo.x,lo.y),lo.z),leave=min(min(hi.x,hi.y),hi.z);
      enter=max(enter,0.);
      if(leave<=enter)discard;
      const float steps=40.;
      float stepSize=(leave-enter)/steps;
      // Fixed sample positions: no distance-triggered shape or noise transitions.
      float t=enter+stepSize*.5;
      vec4 accum=vec4(0.);
      float variant=floor(vVariant+.5);
      vec2 tile=vec2(mod(variant,2.),floor(variant/2.));
      for(int i=0;i<40;i++){
        vec3 uv=(origin+direction*t)*.5+.5;
        vec2 volume=texture(uVolume,vec3((uv.xy+tile)*.5,uv.z)).rg;
        float density=smoothstep(.035,.5,volume.r);
        float alpha=1.-exp(-density*stepSize*.105);
        vec3 light=mix(vec3(.22,.30,.46),vec3(2.5,2.41,2.30),pow(volume.g,1.1));
        accum.rgb+=(1.-accum.a)*alpha*light;
        accum.a+=(1.-accum.a)*alpha;
        if(accum.a>.985)break;
        t+=stepSize;
      }
      if(accum.a<.005)discard;
      vec3 color=accum.rgb/max(accum.a,.001);
      float distanceToEye=length(vCenter-cameraPosition);
      float haze=1.-exp(-pow(distanceToEye*.00035,1.5));
      color=mix(color,atmosphereColor(ray),haze);
      // Only recycle beyond the pale horizon, where the cloud is already invisible.
      float visibility=1.-smoothstep(4400.,5900.,distanceToEye);
      gl_FragColor=vec4(color,accum.a*visibility);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  for(let i=0;i<VALLEY_CLOUD_COUNT+SKY_GRID*SKY_GRID;i++){
    const valley=i<VALLEY_CLOUD_COUNT,lowLayer=!valley&&(i-VALLEY_CLOUD_COUNT)%3===0;
    const size=valley?new THREE.Vector3(42+rng()*28,25+rng()*16,30+rng()*20):lowLayer?new THREE.Vector3(34+rng()*31,21+rng()*17,28+rng()*27):new THREE.Vector3(48+rng()*64,35+rng()*37,38+rng()*49);
    let position:THREE.Vector3;
    if(valley){
      const heroes=[[-72,-4,88],[86,48,105],[-245,70,125],[260,-35,140],[-105,-96,150],[45,-101,135]];
      const heroSizes=[[76,40,43],[88,47,48],[85,45,48],[75,32,48],[95,35,58],[61,29,40]];
      if(i<heroSizes.length)size.set(...heroSizes[i] as [number,number,number]);
      position=i<heroes.length?new THREE.Vector3(...heroes[i] as [number,number,number]):new THREE.Vector3((rng()-.5)*4200,-60+rng()*210,120+rng()*2400);
    }else {
      const cell=i-VALLEY_CLOUD_COUNT;
      const x=(cell%SKY_GRID+.12+rng()*.76)*SKY_CELL-SKY_SPAN/2;
      const z=(Math.floor(cell/SKY_GRID)+.12+rng()*.76)*SKY_CELL-SKY_SPAN/2;
      position=new THREE.Vector3(x,lowLayer?200+rng()*70:310+rng()*170,z);
    }
    const bounds=size.clone();if(valley)bounds.z=Math.max(size.x,size.z);
    const clear=clearCloudBounds(position,bounds,valley?'valley':'sky');position.set(clear.x,clear.y,clear.z);

    const cloud=new THREE.Object3D();cloud.position.copy(position);cloud.scale.copy(size);
    // A slow shared breeze; higher clouds cover more ground to remain perceptibly in motion.
    const drift=rng();cloud.userData.speed=valley?.28+drift*.12:.72;cloud.userData.initialPosition=position.clone();cloud.userData.layer=valley?'valley':'sky';cloud.userData.variant=i%seeds.length;
    cloud.userData.distance=Infinity;clouds.push(cloud);group.add(cloud);
  }
  let fieldShadows=createFieldShadows(clouds,shadowMap);atmosphere.uFieldShadows.value=fieldShadows;
  // All clouds retain their own world-fixed density volume. One instanced draw
  // replaces camera-facing cards and the nearest-eight representation swap.
  const box=new THREE.BoxGeometry(2,2,2),geometry=new THREE.InstancedBufferGeometry();
  geometry.index=box.index;geometry.attributes=box.attributes;
  const centers=new THREE.InstancedBufferAttribute(new Float32Array(clouds.length*3),3);
  const sizes=new THREE.InstancedBufferAttribute(new Float32Array(clouds.length*3),3);
  const variants=new THREE.InstancedBufferAttribute(new Float32Array(clouds.length),1);
  centers.setUsage(THREE.DynamicDrawUsage);sizes.setUsage(THREE.DynamicDrawUsage);variants.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aCenter',centers);geometry.setAttribute('aSize',sizes);geometry.setAttribute('aVariant',variants);
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.BackSide,
    uniforms:{uVolume:{value:volumeTexture}},
    vertexShader:`attribute vec3 aCenter;attribute vec3 aSize;attribute float aVariant;
      varying vec3 vWorld;varying vec3 vCenter;varying vec3 vSize;varying float vVariant;
      void main(){
        vCenter=aCenter;vSize=aSize;vVariant=aVariant;
        vWorld=aCenter+position*aSize;
        gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);
      }`,fragmentShader:fragment});
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=2;scene.add(mesh);
  const volumesReady=loadAssets?Promise.allSettled(seeds.map(loadCloudDensity)).then(results=>{
    const loaded=results.flatMap(result=>result.status==='fulfilled'?[result.value]:[]);
    if(!disposed&&loaded.length===seeds.length){
      const atlas=packCloudVolumes(loaded);volumeTexture.dispose();volumeTexture=atlas;material.uniforms.uVolume.value=atlas;
    }else if(!disposed){console.warn('Cloud detail fallback: some volume assets could not load');}
    loaded.forEach(texture=>texture.dispose());
  }):Promise.resolve();
  const shadowsReady=loadAssets?loadCloudShadows().then(texture=>{
    if(disposed){texture.dispose();return;}
    shadowMap.dispose();shadowMap=texture;atmosphere.uCloudShadowMap.value=texture;
    fieldShadows.dispose();fieldShadows=createFieldShadows(clouds,texture);atmosphere.uFieldShadows.value=fieldShadows;
  }).catch(error=>console.warn('Cloud shadow fallback:',error)):Promise.resolve();
  const ready=Promise.all([volumesReady,shadowsReady]).then(()=>{});
  const origin=new THREE.Vector3(),lastSortEye=new THREE.Vector3(Infinity,Infinity,Infinity),sorted=[...clouds];let nearest:THREE.Object3D[]=[];
  const frustum=new THREE.Frustum(),viewProjection=new THREE.Matrix4(),bounds=new THREE.Sphere();
  function update(time:number,delta:number,eye:THREE.Vector3=origin,camera?:THREE.Camera){
    atmosphere.uAtmosTime.value=time;atmosphere.uSkyShadowOffset.value+=delta*.72;
    for(const cloud of clouds){
      cloud.position.x+=delta*cloud.userData.speed;
      if(cloud.userData.layer==='sky'){
        cloud.position.x=wrapCloudCoordinate(cloud.position.x,eye.x);cloud.position.z=wrapCloudCoordinate(cloud.position.z,eye.z);
      }
      cloud.userData.distance=cloud.position.distanceToSquared(eye);
    }
    // Sorting four times per second is enough for slow drift; avoid allocations in the render loop.
    if(time-lastSort>.25||lastSort<0||lastSortEye.distanceToSquared(eye)>144){
      sorted.sort((a,b)=>b.userData.distance-a.userData.distance);nearest=sorted.slice(-CLOUD_SHADOW_COUNT).reverse();lastSort=time;lastSortEye.copy(eye);
    }
    if(camera){
      camera.updateMatrixWorld();viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(viewProjection);
    }
    let count=0;
    for(const cloud of sorted){
      // Culling changes only submission, never a cloud's density, axes, or silhouette.
      if(cloud.userData.distance>=5900*5900)continue;
      bounds.center.copy(cloud.position);bounds.radius=cloud.scale.length();
      if(camera&&!frustum.intersectsSphere(bounds))continue;
      centers.setXYZ(count,cloud.position.x,cloud.position.y,cloud.position.z);
      sizes.setXYZ(count,cloud.scale.x,cloud.scale.y,cloud.scale.z);variants.setX(count,cloud.userData.variant);count++;
    }
    geometry.instanceCount=count;
    centers.needsUpdate=sizes.needsUpdate=variants.needsUpdate=true;
    for(let i=0;i<CLOUD_SHADOW_COUNT;i++){
      atmosphere.uCloudCenters.value[i].copy(nearest[i].position);atmosphere.uCloudSizes.value[i].copy(nearest[i].scale);
      atmosphere.uCloudVariants.value[i]=nearest[i].userData.variant;
    }
  }
  update(0,0);
  return {update,ready,get volumeCount(){return geometry.instanceCount;},dispose(){
    disposed=true;scene.remove(group,mesh);geometry.dispose();material.dispose();shadowMap.dispose();fieldShadows.dispose();
    volumeTexture.dispose();
  }};
}
