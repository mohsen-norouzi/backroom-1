import test from 'node:test';
import assert from 'node:assert/strict';
import { LadderController, LADDER_CAMERA_Z, LADDER_Z, LADDER_SPEED } from '../src/scene/ladder.ts';
import { EYE_HEIGHT, FLOOR, TOP, NOTCH_END, terrainHeight } from '../src/scene/physics.ts';

test('climbing attaches in front of the rungs and holds height without input',()=>{
 const ladder=new LadderController(),p={x:.6,y:30,z:LADDER_CAMERA_Z+.3};
 assert.ok(ladder.update(p,1,.02));assert.ok(ladder.attached);
 assert.equal(p.x,0);assert.equal(p.z,LADDER_CAMERA_Z);assert.ok(p.z>LADDER_Z+1);
 const y=p.y;
 for(let i=0;i<600;i++)assert.ok(ladder.update(p,0,1/60));
 assert.equal(p.y,y);assert.equal(ladder.speed,0);assert.ok(ladder.attached);
 ladder.update(p,-1,.1);assert.ok(Math.abs(p.y-(y-LADDER_SPEED*.1))<1e-8);
});
test('top and bottom dismounts end on solid ground',()=>{
 const up=new LadderController(),p={x:0,y:TOP+EYE_HEIGHT-.05,z:LADDER_CAMERA_Z};
 up.update(p,1,.1,true);assert.equal(up.attached,false);assert.ok(p.z<NOTCH_END);assert.equal(terrainHeight(p.x,p.z),TOP);
 const down=new LadderController(),q={x:0,y:FLOOR+EYE_HEIGHT+.05,z:LADDER_CAMERA_Z};
 down.update(q,-1,.1,true);assert.equal(down.attached,false);assert.equal(terrainHeight(q.x,q.z),FLOOR);
});
test('backing toward the top attaches and releasing deliberately stays released',()=>{
 const ladder=new LadderController(),p={x:0,y:TOP+EYE_HEIGHT,z:NOTCH_END-.6};
 assert.equal(ladder.update(p,-1,.05),true);assert.equal(ladder.attached,true);
 ladder.release(p);assert.equal(ladder.attached,false);
 assert.equal(ladder.update(p,1,.05),false);assert.ok(p.z>LADDER_CAMERA_Z);
});
test('movement away from the ladder cannot grab it',()=>{
 for(const p of [{x:4,y:10,z:LADDER_CAMERA_Z},{x:0,y:10,z:-20}]){
  const ladder=new LadderController();assert.equal(ladder.update(p,1,.1,true),false);assert.equal(ladder.attached,false);
 }
});
