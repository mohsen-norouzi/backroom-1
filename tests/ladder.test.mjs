import test from 'node:test';
import assert from 'node:assert/strict';
import { LadderController, LADDER_CAMERA_Z, LADDER_Z, LADDER_SPEED, ladderCameraZ, ladderZAt } from '../src/scene/ladder.ts';
import { EYE_HEIGHT, FLOOR, TOP, NOTCH_END, terrainHeight, notchBackZ, NOTCH_SLOPE, solidAt } from '../src/scene/physics.ts';

test('climbing attaches in front of the rungs and holds height without input',()=>{
 const ladder=new LadderController(),p={x:.6,y:30,z:ladderCameraZ(30)+.3};
 assert.ok(ladder.update(p,1,.02));assert.ok(ladder.attached);
 assert.equal(p.x,0);assert.equal(p.z,ladderCameraZ(p.y));assert.ok(p.z>ladderZAt(p.y)+1);
 const y=p.y;
 for(let i=0;i<600;i++)assert.ok(ladder.update(p,0,1/60));
 assert.equal(p.y,y);assert.equal(ladder.speed,0);assert.ok(ladder.attached);
 ladder.update(p,-1,.1);assert.ok(Math.abs(p.y-(y-LADDER_SPEED*.1))<1e-8);
});
test('top and bottom dismounts end on solid ground',()=>{
 const up=new LadderController(),p={x:0,y:TOP+EYE_HEIGHT-.05,z:LADDER_CAMERA_Z};
 up.update(p,1,.1,true);assert.equal(up.attached,false);assert.ok(p.z<NOTCH_END);assert.equal(terrainHeight(p.x,p.z),TOP);
 const down=new LadderController(),q={x:0,y:FLOOR+EYE_HEIGHT+.05,z:ladderCameraZ(FLOOR+EYE_HEIGHT+.05)};
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

test('the entire climb follows the leaning wall with safe camera clearance',()=>{
 const ladder=new LadderController(),p={x:0,y:FLOOR+EYE_HEIGHT,z:ladderCameraZ(FLOOR+EYE_HEIGHT)};
 const startZ=p.z;
 for(let i=0;i<12200;i++){
  assert.ok(ladder.update(p,1,1/60));
  assert.equal(p.z,ladderCameraZ(p.y));
  assert.ok(p.z>notchBackZ(p.y-EYE_HEIGHT)+1.4);
  assert.equal(solidAt(p.x,p.y-1,p.z),false);
 }
 assert.ok(startZ-p.z>29,'The base must visibly lean forward of the top');
 const y=p.y,z=p.z;ladder.update(p,-1,1);
 assert.ok(Math.abs(p.z-z-NOTCH_SLOPE*LADDER_SPEED)<1e-8);
 ladder.update(p,0,1);assert.equal(p.y,y-LADDER_SPEED);assert.equal(p.z,ladderCameraZ(p.y));
});
