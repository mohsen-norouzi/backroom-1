import * as THREE from 'three';
import { random } from './materials';
import { createCloudDensity } from './cloudDensity';
import { createCloudCard } from './cloudCard';
import { loadCloudDensity, loadCloudCard, loadCloudShadows } from './cloudAssets';
import { createCloudShadowAtlas } from './cloudShadow';
import { clearCloudBounds } from './clouds';
import { horizonGLSL } from './horizon';
import { SKY_GRID, SKY_CELL, SKY_SPAN, VALLEY_CLOUD_COUNT, wrapCloudCoordinate } from './cloudLayout';
import { CLOUD_SHADOW_COUNT } from './atmosphere';
import type { AtmosphereUniforms } from './atmosphere';
export const MAX_CLOUD_VOLUMES=8;
export function createCloudField(scene:THREE.Scene,atmosphere:AtmosphereUniforms,loadAssets=true){
  const seeds=[713,1949,3571],textures=seeds.map(seed=>createCloudDensity(seed,24));
  const cards=textures.map(volume=>createCloudCard(volume,128,96));
  let shadowMap=createCloudShadowAtlas(textures,48);atmosphere.uCloudShadowMap.value=shadowMap;
  let disposed=false,lastSort=-1;
  const rng=random(821),group=new THREE.Group(),volumeGroup=new THREE.Group();scene.add(group,volumeGroup);
  const geometry=new THREE.BoxGeometry(2,2,2),clouds:THREE.Object3D[]=[];
  const fragment=`
    precision highp float;
    precision highp sampler3D;
    uniform sampler3D uVolume;
    uniform vec3 uCenter;
    uniform vec3 uSize;
    uniform float uOpacity;
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
      float steps=mix(40.,24.,smoothstep(350.,900.,length(uCenter-cameraPosition)));
      float stepSize=(leave-enter)/steps;
      float jitter=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
      float t=enter+stepSize*jitter;
      vec4 accum=vec4(0.);
      for(int i=0;i<40;i++){
        if(float(i)>=steps)break;
        vec3 uv=(origin+direction*t)*.5+.5;
        vec2 volume=texture(uVolume,uv).rg;
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
      float distanceToEye=length(uCenter-cameraPosition);
      float haze=1.-exp(-pow(distanceToEye*.00035,1.5));
      color=mix(color,atmosphereColor(ray),haze);
      // Only recycle beyond the pale horizon, where the cloud is already invisible.
      float visibility=1.-smoothstep(4400.,5900.,distanceToEye);
      gl_FragColor=vec4(color,accum.a*visibility*uOpacity);
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
    cloud.userData.speed=valley?.28+rng()*.12:.6+rng()*.25;cloud.userData.layer=valley?'valley':'sky';cloud.userData.variant=i%seeds.length;
    cloud.userData.distance=Infinity;cloud.userData.mix=0;clouds.push(cloud);group.add(cloud);
  }
  const volumeMaterials:THREE.ShaderMaterial[]=[],volumes:THREE.Mesh[]=[];
  for(let i=0;i<MAX_CLOUD_VOLUMES;i++){
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.BackSide,
      uniforms:{uVolume:{value:textures[0]},uCenter:{value:new THREE.Vector3()},uSize:{value:new THREE.Vector3()},uOpacity:{value:1}},
      vertexShader:'varying vec3 vWorld;void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}',fragmentShader:fragment});
    const mesh=new THREE.Mesh(geometry,material);mesh.visible=false;mesh.renderOrder=2;
    volumeMaterials.push(material);volumes.push(mesh);volumeGroup.add(mesh);
  }
  const cardGeometry=new THREE.InstancedBufferGeometry(),plane=new THREE.PlaneGeometry(2,2);
  cardGeometry.index=plane.index;cardGeometry.attributes=plane.attributes;
  const centers=new THREE.InstancedBufferAttribute(new Float32Array(clouds.length*3),3),sizes=new THREE.InstancedBufferAttribute(new Float32Array(clouds.length*2),2);
  const variants=new THREE.InstancedBufferAttribute(new Float32Array(clouds.length),1),opacities=new THREE.InstancedBufferAttribute(new Float32Array(clouds.length),1);
  cardGeometry.setAttribute('aCenter',centers);cardGeometry.setAttribute('aSize',sizes);cardGeometry.setAttribute('aVariant',variants);cardGeometry.setAttribute('aOpacity',opacities);cardGeometry.instanceCount=clouds.length;
  const cardMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{uCard0:{value:cards[0]},uCard1:{value:cards[1]},uCard2:{value:cards[2]}},
    vertexShader:`attribute vec3 aCenter;attribute vec2 aSize;attribute float aVariant;attribute float aOpacity;
      varying vec2 vUv;varying float vVariant;varying float vOpacity;varying vec3 vRay;
      void main(){
        vec3 right=normalize(vec3(viewMatrix[0][0],0.,viewMatrix[2][0]));
        vec3 world=aCenter+right*position.x*aSize.x+vec3(0.,position.y*aSize.y,0.);
        vUv=uv;vVariant=aVariant;vOpacity=aOpacity;vRay=aCenter-cameraPosition;
        gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);
      }`,
    fragmentShader:`uniform sampler2D uCard0;uniform sampler2D uCard1;uniform sampler2D uCard2;
      varying vec2 vUv;varying float vVariant;varying float vOpacity;varying vec3 vRay;
      ${horizonGLSL}
      void main(){
        vec2 sampleData=vVariant<.5?texture2D(uCard0,vUv).rg:vVariant<1.5?texture2D(uCard1,vUv).rg:texture2D(uCard2,vUv).rg;
        float distanceToEye=length(vRay),visibility=1.-smoothstep(4400.,5900.,distanceToEye);
        float alpha=sampleData.r*vOpacity*visibility;if(alpha<.004)discard;
        vec3 color=mix(vec3(.22,.30,.46),vec3(2.5,2.41,2.30),sampleData.g);
        color=mix(color,atmosphereColor(vRay),1.-exp(-pow(distanceToEye*.00035,1.5)));
        gl_FragColor=vec4(color,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const cardMesh=new THREE.Mesh(cardGeometry,cardMaterial);cardMesh.frustumCulled=false;cardMesh.renderOrder=1;scene.add(cardMesh);
  const volumesReady=loadAssets?Promise.all(seeds.map(async(seed,index)=>{
    const results=await Promise.allSettled([loadCloudDensity(seed),loadCloudCard(seed)]);
    results.forEach((result,kind)=>{
      if(result.status==='rejected'){console.warn('Cloud detail fallback:',result.reason);return;}
      if(disposed){result.value.dispose();return;}
      if(kind===0){textures[index].dispose();textures[index]=result.value as THREE.Data3DTexture;}
      else {cards[index].dispose();cards[index]=result.value as THREE.DataTexture;cardMaterial.uniforms[`uCard${index}`].value=result.value;}
    });
  })).then(()=>{}):Promise.resolve();
  const shadowsReady=loadAssets?loadCloudShadows().then(texture=>{
    if(disposed){texture.dispose();return;}
    shadowMap.dispose();shadowMap=texture;atmosphere.uCloudShadowMap.value=texture;
  }).catch(error=>console.warn('Cloud shadow fallback:',error)):Promise.resolve();
  const ready=Promise.all([volumesReady,shadowsReady]).then(()=>{});
  const origin=new THREE.Vector3(),lastSortEye=new THREE.Vector3(Infinity,Infinity,Infinity),sorted=[...clouds];let nearest:THREE.Object3D[]=[];
  function update(time:number,delta:number,eye:THREE.Vector3=origin){
    atmosphere.uAtmosTime.value=time;
    for(const cloud of clouds){
      cloud.position.x+=delta*cloud.userData.speed;
      if(cloud.userData.layer==='sky'){
        cloud.position.x=wrapCloudCoordinate(cloud.position.x,eye.x);cloud.position.z=wrapCloudCoordinate(cloud.position.z,eye.z);
      }
      cloud.userData.distance=cloud.position.distanceToSquared(eye);cloud.userData.mix=0;
    }
    // Sorting twice per second is enough for slow drift; avoid allocations in the render loop.
    if(time-lastSort>.25||lastSort<0||lastSortEye.distanceToSquared(eye)>144){
      sorted.sort((a,b)=>b.userData.distance-a.userData.distance);nearest=sorted.slice(-Math.max(MAX_CLOUD_VOLUMES,CLOUD_SHADOW_COUNT)).reverse();lastSort=time;lastSortEye.copy(eye);
    }
    volumes.forEach((mesh,i)=>{
      const cloud=nearest[i],distance=Math.sqrt(cloud?.userData.distance??Infinity);
      const mix=1-THREE.MathUtils.smoothstep(distance,550,900);mesh.visible=mix>.001;
      if(!cloud||!mesh.visible)return;cloud.userData.mix=mix;
      mesh.position.copy(cloud.position);mesh.scale.copy(cloud.scale);
      const uniforms=volumeMaterials[i].uniforms;uniforms.uCenter.value.copy(cloud.position);uniforms.uSize.value.copy(cloud.scale);
      uniforms.uVolume.value=textures[cloud.userData.variant];uniforms.uOpacity.value=mix;
    });
    for(let i=0;i<sorted.length;i++){
      const cloud=sorted[i];centers.setXYZ(i,cloud.position.x,cloud.position.y,cloud.position.z);sizes.setXY(i,cloud.scale.x,cloud.scale.y);
      variants.setX(i,cloud.userData.variant);opacities.setX(i,1-cloud.userData.mix);
    }
    centers.needsUpdate=sizes.needsUpdate=variants.needsUpdate=opacities.needsUpdate=true;
    for(let i=0;i<CLOUD_SHADOW_COUNT;i++){
      atmosphere.uCloudCenters.value[i].copy(nearest[i].position);atmosphere.uCloudSizes.value[i].copy(nearest[i].scale);
      atmosphere.uCloudVariants.value[i]=nearest[i].userData.variant;
    }
  }
  update(0,0);
  return {update,ready,get volumeCount(){return volumes.filter(mesh=>mesh.visible).length;},dispose(){
    disposed=true;scene.remove(group,volumeGroup,cardMesh);geometry.dispose();cardGeometry.dispose();cardMaterial.dispose();
    shadowMap.dispose();volumeMaterials.forEach(material=>material.dispose());textures.forEach(texture=>texture.dispose());cards.forEach(texture=>texture.dispose());
  }};
}
