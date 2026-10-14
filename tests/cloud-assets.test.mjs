import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createCloudDensity} from '../src/scene/cloudDensity.ts';

function inspectVolume(bytes,n){
 let occupied=0;
 for(let z=0;z<n;z++)for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const density=bytes[(x+n*(y+n*z))*4];
  if(density){occupied++;assert.ok(x>1&&y>1&&z>1&&x<n-2&&y<n-2&&z<n-2,'Cloud density reaches its clipping bounds');}
 }
 assert.ok(occupied>n*n,'Cloud should contain a visible formation');
}
test('all baked clouds and fallback volumes have transparent space on every side',()=>{
 for(const seed of [713,1949,3571]){
  const volume=gunzipSync(readFileSync(new URL(`../public/clouds/formation-${seed}.volume.bin`,import.meta.url)));
  assert.equal(volume.length,128**3*4);inspectVolume(volume,128);
  const fallback=createCloudDensity(seed,24);inspectVolume(fallback.image.data,24);fallback.dispose();
  const card=gunzipSync(readFileSync(new URL(`../public/clouds/formation-${seed}.card.bin`,import.meta.url)));
  assert.equal(card.length,256*192*4);
  for(let y=0;y<192;y++)for(let x=0;x<256;x++)if(x<2||y<2||x>=254||y>=190)
   assert.equal(card[(x+y*256)*4],0,'Cloud card opacity must end before the rectangle edge');
 }
});

test('baked sun projections contain distinct soft silhouettes with clear borders',()=>{
 const bytes=gunzipSync(readFileSync(new URL('../public/clouds/sun-footprints.bin',import.meta.url)));
 assert.equal(bytes.length,128*128*4);
 const formations=Array.from({length:3},()=>[]);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++)for(let variant=0;variant<3;variant++){
  const value=bytes[(x+y*128)*4+variant];formations[variant].push(value);
  if(x<2||y<2||x>=126||y>=126)assert.equal(value,0,'Shadow must not expose the texture rectangle');
 }
 for(const formation of formations){
  assert.ok(formation.some(value=>value>230),'Dense cores should cast a shadow');
  assert.ok(formation.filter(value=>value>5&&value<220).length>100,'Edges must retain partial transmission');
  assert.ok(formation.filter(value=>value===0).length>8192,'Clear sky must transmit light');
 }
 assert.notDeepEqual(formations[0],formations[1]);assert.notDeepEqual(formations[1],formations[2]);
});
