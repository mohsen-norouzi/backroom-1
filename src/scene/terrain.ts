import * as THREE from 'three';
import { TOP, FLOOR, NOTCH, NOTCH_END, EDGE, FIELD_DEPTH } from './physics';

export const TURF_RIM=.28;
// The grass-covered lip rolls over the cliff instead of ending in a razor-sharp cube.
export function turfSurfaceHeight(x:number,z:number){
  const notchDistance=Math.hypot(Math.max(Math.abs(x)-NOTCH,0),Math.max(NOTCH_END-z,0));
  const distance=Math.min(-z,notchDistance);
  if(distance>=TURF_RIM)return TOP;
  const d=Math.max(0,distance);
  return TOP-TURF_RIM+Math.sqrt(Math.max(0,TURF_RIM*TURF_RIM-(TURF_RIM-d)**2));
}
export function createTerrainGeometry(){
  const geometry=new THREE.BufferGeometry(),vertices:number[]=[],uv:number[]=[],normals:number[]=[];
  function topNormal(x:number,z:number){
    const e=.001,n=new THREE.Vector3(turfSurfaceHeight(x-e,z)-turfSurfaceHeight(x+e,z),e*2,turfSurfaceHeight(x,z-e)-turfSurfaceHeight(x,z+e));return n.normalize().toArray();
  }
  function quad(points:number[][],material:number,smooth=false){
    const start=vertices.length/3;
    const normal=new THREE.Vector3().fromArray(points[1]).sub(new THREE.Vector3().fromArray(points[0])).cross(new THREE.Vector3().fromArray(points[2]).sub(new THREE.Vector3().fromArray(points[0]))).normalize().toArray();
    for(const i of [0,1,2,0,2,3]){const p=points[i];vertices.push(...p);uv.push(i===1||i===2?1:0,i>=2?1:0);normals.push(...(smooth?topNormal(p[0],p[2]):normal));}
    geometry.addGroup(start,6,material);
  }
  const xs=[-EDGE,NOTCH,-NOTCH,EDGE],zs=[-FIELD_DEPTH,NOTCH_END,0];
  for(let i=1;i<=6;i++){
    const d=TURF_RIM*(1-Math.cos(i/6*Math.PI/2));xs.push(-NOTCH-d,NOTCH+d);zs.push(-d,NOTCH_END-d);
  }
  xs.sort((a,b)=>a-b);zs.sort((a,b)=>a-b);
  for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++){
    const x0=xs[i],x1=xs[i+1],z0=zs[j],z1=zs[j+1];
    if(Math.abs((x0+x1)/2)<NOTCH&&(z0+z1)/2>NOTCH_END)continue;
    quad([[x0,turfSurfaceHeight(x0,z1),z1],[x1,turfSurfaceHeight(x1,z1),z1],[x1,turfSurfaceHeight(x1,z0),z0],[x0,turfSurfaceHeight(x0,z0),z0]],0,true);
  }
  quad([[-EDGE,FLOOR,FIELD_DEPTH/2],[EDGE,FLOOR,FIELD_DEPTH/2],[EDGE,FLOOR,-FIELD_DEPTH/2],[-EDGE,FLOOR,-FIELD_DEPTH/2]],0);
  const lip=TOP-TURF_RIM;
  for(const [x0,x1] of [[-EDGE,-NOTCH],[NOTCH,EDGE]])quad([[x0,FLOOR,0],[x1,FLOOR,0],[x1,lip,0],[x0,lip,0]],1);
  quad([[-NOTCH,FLOOR,NOTCH_END],[NOTCH,FLOOR,NOTCH_END],[NOTCH,lip,NOTCH_END],[-NOTCH,lip,NOTCH_END]],2);
  quad([[-NOTCH,FLOOR,0],[-NOTCH,FLOOR,NOTCH_END],[-NOTCH,lip,NOTCH_END],[-NOTCH,lip,0]],2);
  quad([[NOTCH,FLOOR,NOTCH_END],[NOTCH,FLOOR,0],[NOTCH,lip,0],[NOTCH,lip,NOTCH_END]],2);
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  // Contiguous material groups avoid one draw per small bevel strip.
  const byMaterial=[0,1,2].map(()=>({position:[] as number[],normal:[] as number[],uv:[] as number[]}));
  for(const g of geometry.groups)for(let i=g.start;i<g.start+g.count;i++){
    const target=byMaterial[g.materialIndex??0];target.position.push(...vertices.slice(i*3,i*3+3));target.normal.push(...normals.slice(i*3,i*3+3));target.uv.push(...uv.slice(i*2,i*2+2));
  }
  geometry.clearGroups();let offset=0;
  for(let i=0;i<3;i++){geometry.addGroup(offset,byMaterial[i].position.length/3,i);offset+=byMaterial[i].position.length/3;}
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(byMaterial.flatMap(x=>x.position),3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(byMaterial.flatMap(x=>x.normal),3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(byMaterial.flatMap(x=>x.uv),2));
  return geometry;
}
