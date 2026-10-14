import test from 'node:test';
import assert from 'node:assert/strict';
import {terrainHeight,solidAt,resolveHorizontal,TOP,FLOOR} from '../src/scene/physics.ts';
test('the notch is a real drop with a solid back wall',()=>{
 assert.equal(terrainHeight(0,-10),FLOOR);assert.equal(terrainHeight(0,-38),TOP);assert.equal(terrainHeight(5,-10),TOP);assert.equal(terrainHeight(0,10),FLOOR);
});
test('walkers cannot cross the house, including with large frame steps',()=>{
 const p=resolveHorizontal(15,TOP+1,-56,-30,0);assert.ok(p.x>=7.1);assert.equal(p.z,-56);
 assert.equal(solidAt(0,TOP+2,-56),true);assert.equal(solidAt(0,TOP+15,-56),false);
});
test('flying below the plateau cannot tunnel through its walls',()=>{
 const p=resolveHorizontal(0,30,20,0,-80);assert.ok(p.z>-37);assert.equal(terrainHeight(p.x,p.z),FLOOR);
});
test('the upper field continues beyond the former side and back edges',()=>{
 for(const [x,z] of [[1000,-50],[-1000,-50],[0,-1600],[4800,-4800],[-4800,-4800]]) {
  assert.equal(terrainHeight(x,z),TOP);
  assert.equal(solidAt(x,TOP-1,z),true);
 }
});
