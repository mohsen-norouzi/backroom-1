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
