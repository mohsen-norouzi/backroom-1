import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TOP } from './physics';
import { HOUSE_Z,HOUSE_BASE,ROOF_EAVE,ROOF_RIDGE,ROOF_HALF_DEPTH,ROOF_HALF_WIDTH,FRONT_GABLE_HALF,FRONT_GABLE_RIDGE,FRONT_GABLE_Z } from './houseShape';
import { random } from './materials';

// All surface detail is static: merge architecture by material and instance foliage.
export function createCottage(){
  const group=new THREE.Group(),rng=random(6721),geometries:THREE.BufferGeometry[]=[],materials:THREE.Material[]=[],textures:THREE.Texture[]=[];
  const parts=new Map<THREE.Material,THREE.BufferGeometry[]>();
  const base=TOP+HOUSE_BASE;
  function mat(color:string,roughness=.85,extra:THREE.MeshStandardMaterialParameters={}){
    const m=new THREE.MeshStandardMaterial({color,roughness,...extra});materials.push(m);return m;
  }
  // A small procedural micro-relief map provides actual grazing-light response.
  function grainTexture(){
    const data=new Uint8Array(256*256*4);
    for(let i=0;i<256*256;i++){const v=125+Math.floor((rng()-.5)*75);data.set([v,v,v,255],i*4);}
    const t=new THREE.DataTexture(data,256,256);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;textures.push(t);return t;
  }
  const grain=grainTexture();
  function surface(m:THREE.MeshStandardMaterial,scale:number,strength:number){
    m.bumpMap=grain;m.bumpScale=strength;
    m.onBeforeCompile=s=>{
      s.vertexShader='varying vec3 vSurface;\n'+s.vertexShader;
      s.vertexShader=s.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvSurface=(modelMatrix*vec4(transformed,1.)).xyz;');
      s.fragmentShader='varying vec3 vSurface;\n'+s.fragmentShader;
      s.fragmentShader=s.fragmentShader.replace('#include <bumpmap_pars_fragment>',THREE.ShaderChunk.bumpmap_pars_fragment.replaceAll('vBumpMapUv',`(vSurface.xy+vSurface.zy)*${scale.toFixed(3)}`));
      s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\nfloat fleck=texture2D(bumpMap,(vSurface.xy+vSurface.zy)*${(scale*.24).toFixed(3)}).r;diffuseColor.rgb*=.97+fleck*.06;`);
    };
    m.customProgramCacheKey=()=>`cottage-surface-${scale}`;
  }
  const plaster=mat('#dcb1b2'),trim=mat('#e4e0d0'),stone=mat('#b9b5a4'),paint=mat('#b6c8c0'),metal=mat('#6f7776',.5,{metalness:.55}),inside=mat('#526364');
  surface(plaster,.43,.018);surface(trim,.8,.006);surface(stone,.6,.022);surface(paint,.6,.006);
  const tileMat=mat('#ffffff',.82,{vertexColors:true});surface(tileMat,.55,.012);
  function add(g:THREE.BufferGeometry,m:THREE.Material,x=0,y=0,z=0,rx=0,ry=0,rz=0){
    const matrix=new THREE.Matrix4().compose(new THREE.Vector3(x,base+y,HOUSE_Z+z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)),new THREE.Vector3(1,1,1));
    const geo=(g.index?g.toNonIndexed():g.clone()).applyMatrix4(matrix);g.dispose();
    if(!parts.has(m))parts.set(m,[]);parts.get(m)!.push(geo);
  }
  function box(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material,r=.025,rx=0,ry=0,rz=0){
    add(r?new RoundedBoxGeometry(w,h,d,1,Math.min(r,w/4,h/4,d/4)):new THREE.BoxGeometry(w,h,d),m,x,y,z,rx,ry,rz);
  }
  function beam(a:THREE.Vector3,b:THREE.Vector3,width:number,depth:number,m:THREE.Material){
    const d=b.clone().sub(a),g=new RoundedBoxGeometry(width,d.length(),depth,1,.016);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));const c=a.clone().add(b).multiplyScalar(.5);add(g,m,c.x,c.y,c.z);
  }
  function gable(width:number,rise:number,depth:number,x:number,y:number,z:number,rotation=0,wallHeight=0){
    const s=new THREE.Shape();s.moveTo(-width/2,-wallHeight);s.lineTo(width/2,-wallHeight);s.lineTo(width/2,0);s.lineTo(0,rise);s.lineTo(-width/2,0);s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth,steps:1,bevelEnabled:true,bevelSize:.035,bevelThickness:.035,bevelSegments:2});g.translate(0,0,-depth/2);add(g,plaster,x,y,z,0,rotation);
  }
  // Lower, wider cross-gabled silhouette, with a shallow projecting entrance bay.
  box(13.2,.5,11.4,0,.05,0,stone,.06);
  gable(10.5,2.70,12.6,0,5.95,0,Math.PI/2,5.8);
  gable(5.95,3.10,1.42,0,5.95,5.52,0,5.8);
  // A thin plinth and corner returns cast small contact shadows instead of slab outlines.
  box(12.85,.22,.18,0,.42,5.3,trim);
  for(const side of [-1,1]){
    box(.13,.22,10.6,side*6.33,.42,0,trim);
    box(.13,4.75,.16,side*6.31,2.9,5.26,trim,.015);
    box(.14,5,.16,side*3,2.9,6.25,trim,.015);
  }
  // Roof tiles are curved pieces with a raised nose, not painted grid lines.
  const roofPositions:number[]=[],roofColors:number[]=[];
  const roofUnderlay=mat('#ad827a');
  function roofSurface(half:number,rise:number,depth:number,y:number,cx:number,cz:number,turn=false,clip?: (x:number,z:number,h:number)=>boolean){
    const slope=Math.hypot(half,rise),rowCount=Math.ceil(slope/.30),colCount=Math.ceil(depth/.24),row=slope/rowCount,col=depth/colCount;
    const slopeY=rise/slope,slopeX=half/slope;
    function point(side:number,d:number,u:number,lift:number){
      const x=side*(half-d*slopeX),h=y+d*slopeY+lift,z=u;
      return turn?new THREE.Vector3(cx+z,base+h,HOUSE_Z+cz+x):new THREE.Vector3(cx+x,base+h,HOUSE_Z+cz+z);
    }
    for(const side of [-1,1])for(let r=0;r<rowCount;r++)for(let c=0;c<colCount;c++){
      const start=r*row,u=-depth/2+c*col,center=point(side,start+row/2,u+col/2,0);
      if(clip?.(center.x,center.z-HOUSE_Z,center.y-base))continue;
      const tint=new THREE.Color('#c68f85').lerp(new THREE.Color('#e1aca0'),rng()*.72);tint.multiplyScalar(.92+rng()*.13);
      const p:THREE.Vector3[]=[];
      for(let iy=0;iy<2;iy++)for(let ix=0;ix<=4;ix++){
        const t=ix/4,arch=Math.sin(t*Math.PI)*.036;
        p.push(point(side,start+iy*(row+.026),u+t*(col-.009),.025+arch+(1-iy)*.018));
      }
      for(let i=0;i<4;i++)for(const triangle of [[i,i+5,i+1],[i+1,i+5,i+6]]){
        const [a,b,c]=triangle.map(k=>p[k]);
        if(new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a)).y<0)[triangle[1],triangle[2]]=[triangle[2],triangle[1]];
        for(const k of triangle){roofPositions.push(...p[k].toArray());roofColors.push(...tint.toArray());}
      }
    }
    // Continuous underlay closes the small tile joints.
    for(const side of [-1,1]){
      const length=Math.hypot(half,rise),angle=Math.atan2(rise,half);
      const under=roofUnderlay;
      const g=new THREE.BoxGeometry(length,.07,depth);g.rotateZ(-side*angle);if(turn)g.rotateY(Math.PI/2);
      add(g,under,turn?cx:cx+side*half/2,y+rise/2,turn?cz-side*half/2:cz);
    }
  }
  const gableY=(x:number)=>FRONT_GABLE_RIDGE-Math.abs(x)*(FRONT_GABLE_RIDGE-ROOF_EAVE)/FRONT_GABLE_HALF;
  roofSurface(ROOF_HALF_DEPTH,ROOF_RIDGE-ROOF_EAVE,ROOF_HALF_WIDTH*2,ROOF_EAVE,0,0,true,(x,z,h)=>z>0&&z<FRONT_GABLE_Z&&Math.abs(x)<FRONT_GABLE_HALF&&gableY(x)>h+.02);
  roofSurface(FRONT_GABLE_HALF,FRONT_GABLE_RIDGE-ROOF_EAVE,FRONT_GABLE_Z,ROOF_EAVE,0,FRONT_GABLE_Z/2,false,(_x,z,h)=>z<ROOF_HALF_DEPTH&&ROOF_RIDGE-z*(ROOF_RIDGE-ROOF_EAVE)/ROOF_HALF_DEPTH>h+.02);
  roofSurface(1.7,.9,1.9,3.75,0,7.15);
  const roofGeometry=new THREE.BufferGeometry();roofGeometry.setAttribute('position',new THREE.Float32BufferAttribute(roofPositions,3));roofGeometry.setAttribute('color',new THREE.Float32BufferAttribute(roofColors,3));roofGeometry.computeVertexNormals();
  // Both slopes face outward, so shadow bias follows the correct tile normal.
  parts.set(tileMat,[roofGeometry]);
  const ridge=mat('#d3a299');
  function ridgeCaps(from:THREE.Vector3,to:THREE.Vector3){
    const length=from.distanceTo(to),count=Math.ceil(length/.32);
    const dir=to.clone().sub(from).normalize();
    for(let i=0;i<count;i++){
      const p=from.clone().lerp(to,(i+.5)/count);
      const g=new THREE.CylinderGeometry(.105,.12,length/count+.016,8,1,true,0,Math.PI);g.rotateX(Math.PI/2);
      if(Math.abs(dir.x)>.5)g.rotateY(Math.PI/2);add(g,ridge,p.x,p.y,p.z);
    }
  }
  ridgeCaps(new THREE.Vector3(-7.15,8.73,0),new THREE.Vector3(7.15,8.73,0));
  ridgeCaps(new THREE.Vector3(0,9.13,0),new THREE.Vector3(0,9.13,6.92));
  ridgeCaps(new THREE.Vector3(0,4.74,6.2),new THREE.Vector3(0,4.74,8.1));
  for(const side of [-1,1]){
    beam(new THREE.Vector3(side*3.49,5.48,6.93),new THREE.Vector3(0,9.08,6.93),.18,.17,trim);
    beam(new THREE.Vector3(side*1.74,3.72,8.12),new THREE.Vector3(0,4.69,8.12),.14,.14,trim);
    for(const x of [-7.16,7.16])beam(new THREE.Vector3(x,5.49,side*6.19),new THREE.Vector3(x,8.68,0),.17,.17,trim);
    if(side<0)box(14.35,.16,.16,0,5.45,side*6.16,trim,.03);
    else for(const end of [-1,1])box(3.68,.16,.16,end*5.33,5.45,6.16,trim,.03);
    box(.15,.14,6.9,side*3.48,5.45,3.45,trim,.03);
  }
  // Chimney, flashing, terracotta cap and a recessed skylight on the right slope.
  box(.94,2.8,.9,-4.25,8.05,-1.35,plaster,.035);
  box(1.13,.18,1.1,-4.25,9.5,-1.35,stone,.035);
  box(.67,.03,.62,-4.25,9.6,-1.35,inside,.02);
  box(1.12,.12,1.12,-4.25,7.35,-1.35,metal,.015);
  const skylightAngle=Math.atan2(ROOF_RIDGE-ROOF_EAVE,ROOF_HALF_DEPTH);
  box(1.02,.14,1.42,4.35,7.04,3.32,metal,.035,skylightAngle);
  box(.84,.035,1.24,4.35,7.13,3.30,paint,.02,skylightAngle);

  // Window panes have a lit sky reflection and a darker interior behind pale curtains.
  const glass=mat('#7e999f',.21,{metalness:.25});
  glass.onBeforeCompile=s=>{
    s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>',`vec3 v=normalize(vViewPosition);float fresnel=pow(1.-abs(dot(normal,v)),3.);vec3 reflection=inverseTransformDirection(reflect(-v,normal),viewMatrix);vec3 reflectedSky=mix(vec3(.14,.23,.25),vec3(.32,.43,.52),smoothstep(-.12,.55,reflection.y));outgoingLight=mix(outgoingLight,reflectedSky,.36+fresnel*.40);#include <opaque_fragment>` .replace(';#include',';\n#include'));
  };glass.customProgramCacheKey=()=> 'cottage-glass-sky-v1';
  const curtain=mat('#d9d6c7');
  function window(x:number,y:number,z:number,w:number,h:number,rotation=0){
    const frame=new THREE.Group(); // Transform each local part about the opening, then merge.
    const before=new Map([...parts].map(([m,p])=>[m,p.length]));
    box(w+.22,h+.22,.055,0,0,0,inside,.012);
    box(w,h,.045,0,0,.045,glass,.009);
    for(const side of [-1,1]){
      box(.09,h+.22,.14,side*(w/2+.045),0,.09,trim,.012);
      for(let i=0;i<4;i++)box(.055,h-.08,.016,side*(w*.31+i*.024),0,.08,curtain,.005);
    }
    for(const row of [-1,1])box(w+.22,.09,.14,0,row*(h/2+.045),.09,trim,.012);
    box(.055,h,.10,0,0,.12,trim,.009);
    for(const f of [-.17,.17])box(w,.045,.10,0,h*f,.13,trim,.007);
    box(w+.38,.095,.30,0,-h/2-.16,.11,stone,.025);
    frame.position.set(x,base+y,HOUSE_Z+z);frame.rotation.y=rotation;frame.updateMatrix();
    const reset=new THREE.Matrix4().makeTranslation(0,-base,-HOUSE_Z);
    for(const [m,p] of parts)for(let i=before.get(m)??0;i<p.length;i++)p[i].applyMatrix4(reset).applyMatrix4(frame.matrix);
  }
  window(-4.72,2.85,5.29,1.58,2.12);window(4.72,2.85,5.29,1.58,2.12);
  window(0,6.85,6.26,.66,1.02);
  for(const side of [-1,1])for(const z of [-2.85,2.15])window(side*6.34,2.85,z,1.66,2.12,side*Math.PI/2);
  // Recessed door, raised timber panels, brass hardware, porch posts and worn treads.
  box(1.66,3.08,.065,0,1.83,6.25,inside,.01);
  box(1.38,2.91,.10,0,1.80,6.31,paint,.02);
  for(const x of [-.77,.77])box(.11,3.16,.19,x,1.85,6.36,trim,.015);
  box(1.65,.13,.20,0,3.43,6.36,trim);
  for(const x of [-.32,.32])box(.51,.89,.035,x,1.18,6.38,trim,.018);
  box(.86,.84,.045,0,2.62,6.38,glass,.012);
  box(.045,.84,.04,0,2.62,6.42,trim,.006);box(.86,.045,.04,0,2.62,6.42,trim,.006);
  const brass=mat('#978269',.38,{metalness:.65});box(.055,.19,.08,.54,1.75,6.45,brass,.02);
  box(2.84,.32,1.55,0,.18,7.1,stone,.04);
  for(let i=0;i<4;i++)box(2.85,.15*(4-i),.43,0,-.05-.075*i,7.95+i*.37,stone,.035);
  for(const x of [-1.35,1.35]){
    box(.12,3.55,.12,x,1.93,7.83,trim,.02);box(.22,.10,.22,x,.3,7.83,stone);
    box(.22,.1,.22,x,3.61,7.83,trim);
  }
  // Small porch lamp and a wall light are quiet architectural detail, with no extra UI.
  box(.16,.27,.11,-1.12,2.85,6.36,metal,.02);
  box(.10,.18,.08,-1.12,2.85,6.43,curtain,.01);

  for(const [material,p] of parts){
    const geometry=mergeGeometries(p);p.forEach(g=>g.dispose());if(!geometry)continue;
    geometries.push(geometry);const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
  return {group,dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}
