import { TOP } from './physics';
import { HOUSE_Z, HOUSE_BASE, cottageRoofHeight } from './houseShape';

export type Point={x:number;y:number;z:number};
export const HOUSE_SONG_POSITION:Point={x:0,y:TOP+3.8,z:HOUSE_Z};
// Fixed cliff-edge reflection/diffraction points. They never follow the listener.
export const HOUSE_REFLECTIONS:readonly Point[]=[
  {x:-80,y:TOP+1.5,z:-.3},
  {x:125,y:TOP+1.5,z:-.3},
];
export const HOUSE_ECHO_DELAYS=[.48,.76] as const;
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};

export function songMixAtDistance(distance:number){
  const proximity=1/(1+Math.pow(Math.max(0,distance)/130,1.1));
  return {gain:.024+.396*proximity,cutoff:1250+6250*proximity};
}

// A closed cottage has one acoustic envelope. There are no louder window/door
// hotspots or per-face switches as the listener circles it. Only a listener well
// inside the room hears the unmuffled signal; the boundary blends continuously.
export function houseTransmission(listener:Point){
  const x=listener.x,z=listener.z-HOUSE_Z,y=listener.y-TOP;
  const mainClearance=Math.min(6.3-Math.abs(x),5.25-Math.abs(z));
  const bayClearance=Math.min(2.975-Math.abs(x),z-4.8,6.23-z);
  const clearance=Math.min(Math.max(mainClearance,bayClearance),y-HOUSE_BASE,cottageRoofHeight(x,z)-y);
  const inside=smooth(0,1,clearance);
  return {gain:.64+.36*inside,cutoff:1800+5700*inside};
}

export function houseAcousticMix(position:Point){
  const directDistance=distance(position,HOUSE_SONG_POSITION),base=songMixAtDistance(directDistance),wall=houseTransmission(position);
  // At the house, hear the enclosed source. The broad landscape only answers
  // after walking/flying away; a smooth transition avoids an audible switch.
  const outdoorEcho=smooth(40,220,directDistance);
  return {
    directGain:base.gain*wall.gain,
    directCutoff:Math.min(base.cutoff,wall.cutoff),
    reflections:HOUSE_REFLECTIONS.map((_point,index)=>({
      // Never modulate delay time: moving a delay read head pitch-bends the song.
      // Radial gain/tone also avoids circling the house changing the echo balance.
      delay:HOUSE_ECHO_DELAYS[index],
      gain:outdoorEcho*base.gain*(index===0?.16:.12),
      cutoff:Math.max(850,2200/(1+directDistance/1400)),
    })),
  };
}

function impulse(sampleRate:number,duration:number,seed:number,tailEnergy:number,decay:number,taps:number[][]){
  const result=new Float32Array(Math.round(sampleRate*duration));let smoothNoise=0,energy=0;
  for(let i=Math.ceil(sampleRate*.012);i<result.length;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    smoothNoise=smoothNoise*.62+(seed/2147483648-1)*.38;
    const t=i/sampleRate;
    result[i]=smoothNoise*Math.min(1,t/.045)*Math.exp(-t*decay)*Math.pow(1-t/duration,2);
    energy+=result[i]*result[i];
  }
  const scale=tailEnergy/Math.sqrt(energy);
  for(let i=0;i<result.length;i++)result[i]*=scale;
  for(const [time,level] of taps)result[Math.round(sampleRate*time)]+=level;
  return result;
}
export const houseRoomSamples=(rate:number)=>impulse(rate,.72,5617,.27,3.8,[[.018,1],[.033,.63],[.057,.37],[.091,.22]]);
export const landscapeEchoSamples=(rate:number)=>impulse(rate,3.2,9113,.58,1.25,[[0,1],[.093,.24],[.217,.14],[.391,.08]]);
