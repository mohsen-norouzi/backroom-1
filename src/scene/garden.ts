import * as THREE from 'three';
import { TOP } from './physics';
import { HOUSE_Z } from './houseShape';
import { random } from './materials';

export function createGarden(){
  const group=new THREE.Group(),rng=random(901),geometries:THREE.BufferGeometry[]=[],materials:THREE.Material[]=[];
  const soil=new THREE.MeshStandardMaterial({color:'#74715b',roughness:1});materials.push(soil);
  const vertices:number[]=[];
  for(let i=0;i<160;i++){
    const a=i/160*Math.PI*2,b=(i+1)/160*Math.PI*2;
    if(Math.sin(a)>.7&&Math.abs(Math.cos(a)*8)<2.15)continue;
    const ring=(angle:number,outer:boolean)=>{
      const r=outer?1+.025*Math.sin(angle*17)+.015*Math.cos(angle*29):.75;
      return [Math.cos(angle)*8.25*r,TOP+.022,HOUSE_Z+Math.sin(angle)*7.55*r];
    };
    for(const p of [ring(a,false),ring(b,true),ring(a,true),ring(a,false),ring(b,false),ring(b,true)])vertices.push(...p);
  }
  const bedGeo=new THREE.BufferGeometry();bedGeo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));bedGeo.computeVertexNormals();geometries.push(bedGeo);
  const bed=new THREE.Mesh(bedGeo,soil);bed.receiveShadow=true;group.add(bed);
  // Each shrub is thousands of small leaves; no opaque sphere silhouette underneath.
  const leafGeo=new THREE.BufferGeometry();leafGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-.45,.48,.08,0,1,.0,0,0,0,0,1,0,.45,.48,.08],3));leafGeo.computeVertexNormals();geometries.push(leafGeo);
  const leafMat=new THREE.MeshStandardMaterial({color:'white',roughness:.86,side:THREE.DoubleSide});materials.push(leafMat);
  const shrubCount=42,perShrub=440;
  const leaves=new THREE.InstancedMesh(leafGeo,leafMat,shrubCount*perShrub),dummy=new THREE.Object3D();
  const flowerGeo=new THREE.SphereGeometry(.045,5,3);geometries.push(flowerGeo);
  const flowerMat=new THREE.MeshStandardMaterial({color:'#ece5ce',roughness:.88});materials.push(flowerMat);
  const flowers=new THREE.InstancedMesh(flowerGeo,flowerMat,1100);let flowersUsed=0;
  const shrubs:{x:number,z:number,r:number,h:number}[]=[];
  for(let i=0;i<shrubCount;i++){
    let a=(i+.35)/shrubCount*Math.PI*2;
    if(Math.sin(a)>.7&&Math.abs(Math.cos(a)*7.6)<2.3)a+=.34;
    const x=Math.cos(a)*(7.25+rng()*.3),z=HOUSE_Z+Math.sin(a)*(6.6+rng()*.3),r=.45+rng()*.42,h=.45+rng()*.7;
    shrubs.push({x,z,r,h});
    const flowering=i%3===0;
    for(let j=0;j<perShrub;j++){
      const theta=rng()*Math.PI*2,up=rng(),radius=Math.sqrt(1-up*up)*r*(.68+rng()*.32);
      const px=x+Math.cos(theta)*radius,py=TOP+.10+up*h,pz=z+Math.sin(theta)*radius;
      dummy.position.set(px,py,pz);dummy.rotation.set((rng()-.5)*2.4,theta,rng()*Math.PI*2);dummy.scale.set(.065+rng()*.045,.12+rng()*.075,1);dummy.updateMatrix();leaves.setMatrixAt(i*perShrub+j,dummy.matrix);
      const tint=new THREE.Color(i%4===0?'#697f64':'#425e43').lerp(new THREE.Color(i%4===0?'#a2aa76':'#79916c'),rng());leaves.setColorAt(i*perShrub+j,tint);
      if(flowering&&j%6===0&&flowersUsed<1100&&up>.25){
        dummy.position.set(px,py+.045,pz);dummy.rotation.set(rng(),rng(),rng());dummy.scale.setScalar(.8+rng()*.6);dummy.updateMatrix();flowers.setMatrixAt(flowersUsed++,dummy.matrix);
      }
    }
  }
  flowers.count=flowersUsed;leaves.castShadow=true;leaves.receiveShadow=true;flowers.castShadow=true;flowers.receiveShadow=true;group.add(leaves,flowers);
  // Loose low stones and ground-cover leaves make the border irregular at eye level.
  const pebbleGeo=new THREE.IcosahedronGeometry(1,1);geometries.push(pebbleGeo);
  const pebbleMat=new THREE.MeshStandardMaterial({color:'white',roughness:1});materials.push(pebbleMat);
  const pebbles=new THREE.InstancedMesh(pebbleGeo,pebbleMat,650);
  for(let i=0;i<650;i++){
    const s=shrubs[i%shrubs.length],a=rng()*Math.PI*2,d=rng()*.9;
    dummy.position.set(s.x+Math.cos(a)*d,TOP+.045,s.z+Math.sin(a)*d);dummy.scale.set(.04+rng()*.06,.025+rng()*.035,.04+rng()*.07);dummy.rotation.set(rng(),rng()*6,rng());dummy.updateMatrix();pebbles.setMatrixAt(i,dummy.matrix);
    pebbles.setColorAt(i,new THREE.Color('#888573').lerp(new THREE.Color('#c3bda7'),rng()));
  }
  pebbles.receiveShadow=true;group.add(pebbles);
  return {group,dispose(){for(const o of [leaves,flowers,pebbles])o.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
