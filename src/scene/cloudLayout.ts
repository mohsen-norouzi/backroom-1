export const SKY_GRID = 24;
export const SKY_CELL = 500;
export const SKY_SPAN = SKY_GRID * SKY_CELL;
export const VALLEY_CLOUD_COUNT = 18;

// A world-fixed lattice only recycles beyond the visible, fully hazed distance.
export function wrapCloudCoordinate(value:number,eye:number) {
  return eye+((value-eye+SKY_SPAN/2)%SKY_SPAN+SKY_SPAN)%SKY_SPAN-SKY_SPAN/2;
}
