import * as THREE from 'three';
import { TOP, NOTCH, NOTCH_END } from './physics';
import { turfSurfaceHeight } from './terrain';
import { random } from './materials';

// A narrow, static fringe follows the softened edge, including the ladder recess.
export function createTurfRim(){
  const rng=random(550),count=28000,geometry=new THREE.PlaneGeometry(.024,.16,1,2);geometry.translate(0,.08,0);
  const p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){const t=p.getY(i)/.16;p.setX(i,p.getX(i)*(1-t));p.setZ(i,t*t*.075);}
  geometry.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({color:'white',roughness:1,side:THREE.DoubleSide});
  const mesh=new THREE.InstancedMesh(geometry,material,count),dummy=new THREE.Object3D();
  for(let i=0;i<count;i++){
    let x:number,z:number;
    const edge=rng()*410,d=.012+rng()*.43;
    if(edge<320){x=-160+edge;z=-d;if(Math.abs(x)<NOTCH){x=Math.sign(x||1)*(NOTCH+d);z=-rng()*37;}}
    else if(edge<394){x=(edge<357?-1:1)*(NOTCH+d);z=-rng()*37;}
    else{x=(rng()-.5)*9.6;z=NOTCH_END-d;}
    dummy.position.set(x,turfSurfaceHeight(x,z)-.025,z);dummy.rotation.set((rng()-.5)*.7,rng()*Math.PI*2,(rng()-.5)*.5);dummy.scale.setScalar(.45+rng()*.8);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
    mesh.setColorAt(i,new THREE.Color('#728665').lerp(new THREE.Color('#a1af7c'),rng()));
  }
  mesh.receiveShadow=true;
  return {mesh,update(eye:THREE.Vector3){mesh.visible=Math.abs(eye.y-TOP)<90&&Math.abs(eye.x)<400&&eye.z>-130&&eye.z<160;},dispose(){mesh.dispose();geometry.dispose();material.dispose();}};
}
