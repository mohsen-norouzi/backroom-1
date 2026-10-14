import * as THREE from 'three';
import { TOP, FLOOR, NOTCH, NOTCH_END, EDGE, FIELD_DEPTH } from './physics';

// A single exterior shell: no stacked boxes, hidden top faces, or coplanar caps.
export function createTerrainGeometry(){
  const geometry=new THREE.BufferGeometry(),vertices:number[]=[],uv:number[]=[];
  function quad(points:number[][],material:number){
    const start=vertices.length/3;
    for(const i of [0,1,2,0,2,3]){vertices.push(...points[i]);uv.push(i===1||i===2?1:0,i>=2?1:0);}
    geometry.addGroup(start,6,material);
  }
  function field(x0:number,x1:number,z0:number,z1:number,y:number){
    quad([[x0,y,z1],[x1,y,z1],[x1,y,z0],[x0,y,z0]],0);
  }
  field(-EDGE,-NOTCH,-FIELD_DEPTH,0,TOP);
  field(NOTCH,EDGE,-FIELD_DEPTH,0,TOP);
  field(-NOTCH,NOTCH,-FIELD_DEPTH,NOTCH_END,TOP);
  field(-EDGE,EDGE,-FIELD_DEPTH/2,FIELD_DEPTH/2,FLOOR);
  for(const [x0,x1] of [[-EDGE,-NOTCH],[NOTCH,EDGE]])
    quad([[x0,FLOOR,0],[x1,FLOOR,0],[x1,TOP,0],[x0,TOP,0]],1);
  quad([[-NOTCH,FLOOR,NOTCH_END],[NOTCH,FLOOR,NOTCH_END],[NOTCH,TOP,NOTCH_END],[-NOTCH,TOP,NOTCH_END]],2);
  quad([[-NOTCH,FLOOR,0],[-NOTCH,FLOOR,NOTCH_END],[-NOTCH,TOP,NOTCH_END],[-NOTCH,TOP,0]],2);
  quad([[NOTCH,FLOOR,NOTCH_END],[NOTCH,FLOOR,0],[NOTCH,TOP,0],[NOTCH,TOP,NOTCH_END]],2);
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();
  return geometry;
}
