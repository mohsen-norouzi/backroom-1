import { FLOOR, TOP } from './physics.ts';

export type CloudLayer = 'valley' | 'sky';
export const CLOUD_CLEARANCE = 18;

export function clearCloudPosition(position: {x: number; y: number; z: number}, radius: number, layer: CloudLayer) {
  if (layer === 'sky') {
    return {...position, y: Math.max(position.y, TOP + radius + CLOUD_CLEARANCE)};
  }
  return {
    ...position,
    y: Math.max(position.y, FLOOR + radius + CLOUD_CLEARANCE),
    z: Math.max(position.z, radius + CLOUD_CLEARANCE),
  };
}

// Cloud boxes never rotate; axis bounds give exact clearance without moving a wide
// cloud unnecessarily high above the field or far away from the cliff.
export function clearCloudBounds(position:{x:number;y:number;z:number},size:{x:number;y:number;z:number},layer:CloudLayer){
  return {
    ...position,
    y:Math.max(position.y,(layer==='sky'?TOP:FLOOR)+size.y+CLOUD_CLEARANCE),
    z:layer==='valley'?Math.max(position.z,size.z+CLOUD_CLEARANCE):position.z,
  };
}
