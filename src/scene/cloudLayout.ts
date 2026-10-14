export const SKY_GRID = 24;
export const SKY_CELL = 500;
export const SKY_SPAN = SKY_GRID * SKY_CELL;
export const VALLEY_CLOUD_COUNT = 18;
// A few low formations establish scale around the house; the distant lattice
// supplies the middle and high sky without multiplying the render passes.
export const PLATEAU_CLOUDS = [
  [-210,-180,18], [190,-260,24], [-420,-540,28], [460,-620,32],
  [-80,-780,21], [780,-320,35], [-860,-200,24], [80,-1200,28],
  [-620,-1150,30], [720,-1280,25], [-1100,-870,32], [1100,-870,22],
  [-200,-1680,36], [410,-2050,31], [-1200,-1750,29], [1350,-1830,38],
  [-340,-340,130], [400,-920,160], [-900,-680,185], [1100,-470,140],
  [-650,-1950,170], [780,-2100,210], [-1500,-2200,150], [1600,-2100,220],
] as const; // x, z, minimum clearance above the upper field
export const PLATEAU_CLOUD_COUNT = PLATEAU_CLOUDS.length;

// A world-fixed lattice only recycles beyond the visible, fully hazed distance.
export function wrapCloudCoordinate(value:number,eye:number) {
  return eye+((value-eye+SKY_SPAN/2)%SKY_SPAN+SKY_SPAN)%SKY_SPAN-SKY_SPAN/2;
}
