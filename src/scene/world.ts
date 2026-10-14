import * as THREE from 'three';
import { grassTexture, grassMaterial, createSky, random } from './materials';

import { atmosphereUniforms } from './atmosphere';
import { createCloudField } from './cloudVolume';
import { createLivingGrass } from './grass';
import { TOP, FLOOR, NOTCH, NOTCH_END, EDGE, FIELD_DEPTH } from './physics';
const HOUSE_Z = -56;

export function buildWorld(scene: THREE.Scene) {
  const rng = random(42);
  const grassMap = grassTexture();
  const atmosphere=atmosphereUniforms();
  const clouds=createCloudField(scene,atmosphere);
  const livingGrass=createLivingGrass(scene,atmosphere);
  const topMat = grassMaterial(grassMap,false,false,atmosphere);
  const sideMat = grassMaterial(grassMap, true,false,atmosphere);
  const darkMat = grassMaterial(grassMap, true, true,atmosphere);
  const group = new THREE.Group(); scene.add(group);
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [topMat, sideMat, darkMat];
  function box(w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, shadows = false) {
    const geometry = new THREE.BoxGeometry(w,h,d); geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry,mat); mesh.position.set(x,y,z);
    mesh.castShadow = shadows; mesh.receiveShadow = true; group.add(mesh); return mesh;
  }
  function material(color: string, extra: THREE.MeshStandardMaterialParameters = {}) {
    const m = new THREE.MeshStandardMaterial({color, roughness:.88, ...extra}); materials.push(m); return m;
  }
  // The cut is actual open geometry: a 255-metre ladder lies at its far wall.
  const midY=(TOP+FLOOR)/2, height=TOP-FLOOR;
  box(EDGE-NOTCH,height,FIELD_DEPTH,-(EDGE+NOTCH)/2,midY,-FIELD_DEPTH/2,sideMat);
  box(EDGE-NOTCH,height,FIELD_DEPTH,(EDGE+NOTCH)/2,midY,-FIELD_DEPTH/2,sideMat);
  box(NOTCH*2,height,FIELD_DEPTH+NOTCH_END,0,midY,(-FIELD_DEPTH+NOTCH_END)/2,darkMat);
  box(EDGE-NOTCH,.16,FIELD_DEPTH,-(EDGE+NOTCH)/2,TOP+.04,-FIELD_DEPTH/2,topMat);
  box(EDGE-NOTCH,.16,FIELD_DEPTH,(EDGE+NOTCH)/2,TOP+.04,-FIELD_DEPTH/2,topMat);
  box(NOTCH*2,.16,FIELD_DEPTH+NOTCH_END,0,TOP+.04,(-FIELD_DEPTH+NOTCH_END)/2,topMat);
  box(EDGE*2,2,FIELD_DEPTH,0,FLOOR-1,0,topMat);

  const plaster=material('#c7a39d'), white=material('#c9c6b6'), roof=material('#a67173');
  const roofEdge=material('#d29291'), glass=material('#243b38',{roughness:.18,metalness:.12});
  const wood=material('#a39573'), door=material('#a8b6a0'), step=material('#c4c3a7');
  const dark=material('#3d5148');
  const baseY=TOP+.35;
  // Small, solitary rose-coloured house, with a real gabled silhouette.
  box(13.4,.65,11.8,0,baseY,HOUSE_Z,step,true);
  box(12.6,6.7,10.5,0,baseY+3.65,HOUSE_Z,plaster,true);
  function gable(cx: number, y: number, z: number, width: number, rise: number, depth: number, mat: THREE.Material) {
    const shape = new THREE.Shape(); shape.moveTo(-width/2,0); shape.lineTo(width/2,0); shape.lineTo(0,rise); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false}); geometries.push(geometry);
    const mesh=new THREE.Mesh(geometry,mat); mesh.position.set(cx,y,z-depth/2); mesh.castShadow=true; mesh.receiveShadow=true; group.add(mesh); return mesh;
  }
  gable(0,baseY+7,HOUSE_Z,12.6,4.4,10.5,plaster);
  function pitchedRoof(cx:number, y:number, z:number, width:number, rise:number, depth:number) {
    const length=Math.hypot(width/2,rise), angle=Math.atan2(rise,width/2);
    for(const side of [-1,1]) {
      const panel=box(length,.25,depth,cx+side*width/4,y+rise/2,z,roof,true); panel.rotation.z=-side*angle;
      const fascia=box(length,.27,.19,cx+side*width/4,y+rise/2,z+depth/2,white,true); fascia.rotation.z=-side*angle;
      for(let i=1;i<11;i++) {
        const t=i/11; const ridge=box(.055,.045,depth,cx+side*width/2*t,y+rise*(1-t)+.15,z,roofEdge);
        ridge.rotation.z=-side*angle;
      }
      for(let i=1;i<24;i++) {
        const line=box(length,.04,.025,cx+side*width/4,y+rise/2+.15,z-depth/2+depth*i/24,roofEdge);
        line.rotation.z=-side*angle;
      }
    }
  }
  pitchedRoof(0,baseY+6.95,HOUSE_Z,14.3,4.9,12.4);
  box(1.1,3.4,1.1,3.8,baseY+10.1,HOUSE_Z-2.4,plaster,true);
  box(1.4,.28,1.4,3.8,baseY+11.9,HOUSE_Z-2.4,white,true);
  box(1,.06,.95,3.8,baseY+12.06,HOUSE_Z-2.4,dark);
  // Front porch and pediment.
  box(3.1,4.65,1.6,0,baseY+2.45,HOUSE_Z+5.5,plaster,true);
  gable(0,baseY+4.75,HOUSE_Z+5.7,3.7,1.6,2.2,plaster);
  pitchedRoof(0,baseY+4.75,HOUSE_Z+5.7,4,1.6,2.5);
  box(1.6,3.45,.12,0,baseY+2.1,HOUSE_Z+6.35,door,true);
  box(.7,.95,.035,0,baseY+2.95,HOUSE_Z+6.42,glass);
  box(.08,.12,.12,.56,baseY+1.85,HOUSE_Z+6.48,wood);
  for(let i=0;i<4;i++) box(3.2-i*.1,.19*(4-i),.65,0,TOP+.095*(4-i),HOUSE_Z+7.8+i*.55,step,true);
  for(const side of [-1,1]) {
    box(.15,3.7,.15,side*1.6,baseY+1.98,HOUSE_Z+6.55,white,true);
    box(.13,.8,2.3,side*1.58,baseY+.85,HOUSE_Z+5.5,white);
  }
  function frontWindow(x:number,y:number,z:number,w=1.9,h=2.6) {
    box(w+.25,h+.25,.15,x,y,z,white,true); box(w,h,.17,x,y,z+.07,glass);
    box(.065,h,.035,x,y,z+.17,white); box(w,.065,.035,x,y,z+.17,white);
    box(w+.4,.13,.38,x,y-h/2-.12,z+.06,white,true);
  }
  frontWindow(-4,baseY+3.3,HOUSE_Z+5.31,2.3,2.7);
  frontWindow(4,baseY+3.3,HOUSE_Z+5.31,2.3,2.7);
  frontWindow(0,baseY+8.1,HOUSE_Z+5.31,.85,1.3);
  for(const side of [-1,1]) for(const z of [-2.6,2.6]) {
    box(.16,2.8,2.15,side*6.36,baseY+3.3,HOUSE_Z+z,white,true);
    box(.18,2.5,1.85,side*6.42,baseY+3.3,HOUSE_Z+z,glass);
    box(.21,2.5,.065,side*6.46,baseY+3.3,HOUSE_Z+z,white);
    box(.21,.065,1.85,side*6.46,baseY+3.3,HOUSE_Z+z,white);
  }


  const ladderMat=material('#c8bc91',{roughness:.76});
  for(const side of [-1,1]) box(.23,height+2,.23,side*.76,(TOP+FLOOR)/2+.5,NOTCH_END+.5,ladderMat,true);
  const rungGeo=new THREE.CylinderGeometry(.095,.095,1.66,7); geometries.push(rungGeo);
  const rungs=new THREE.InstancedMesh(rungGeo,ladderMat,510);
  const dummy=new THREE.Object3D();
  for(let i=0;i<510;i++){dummy.position.set(0,FLOOR+.5+i*.5,NOTCH_END+.5); dummy.rotation.z=Math.PI/2; dummy.updateMatrix(); rungs.setMatrixAt(i,dummy.matrix);}
  rungs.castShadow=true; group.add(rungs);
  // A faint worn route connects the front door to the ladder.
  const pathMat=material('#9c9a6b',{transparent:true,opacity:.35});
  box(1.8,.012,10.8,0,TOP+.133,-42.5,pathMat);

  const bushGeo=new THREE.IcosahedronGeometry(1,2); geometries.push(bushGeo);
  const bushMat=material('#5b703b');
  const bushes=new THREE.InstancedMesh(bushGeo,bushMat,64);
  for(let i=0;i<64;i++) {
    const angle=rng()*Math.PI*2, x=Math.cos(angle)*(6.9+rng()*.9), z=HOUSE_Z+Math.sin(angle)*6;
    if(z>HOUSE_Z+4&&Math.abs(x)<2) { dummy.scale.setScalar(.01); } else { dummy.scale.set(.35+rng()*.65,.4+rng()*.8,.4+rng()*.6); }
    dummy.position.set(x,TOP+.5,z); dummy.rotation.set(rng(),rng(),rng()); dummy.updateMatrix(); bushes.setMatrixAt(i,dummy.matrix);
    bushes.setColorAt(i,new THREE.Color().setHSL(.19+rng()*.08,.22+rng()*.18,.2+rng()*.17));
  }
  bushes.castShadow=true; bushes.receiveShadow=true; group.add(bushes);

  const sky=createSky(); scene.add(sky.mesh);
  return {
    update(time:number,delta:number,camera:THREE.Camera){
      clouds.update(time,delta,camera.position);sky.mesh.position.copy(camera.position);
    },
    dispose(){
      group.traverse(object=>{if(object instanceof THREE.InstancedMesh)object.dispose();});
      geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());clouds.dispose();livingGrass.dispose();
      grassMap.dispose();sky.mesh.geometry.dispose();sky.material.dispose();
      scene.remove(group,sky.mesh);
    },
  };
}
