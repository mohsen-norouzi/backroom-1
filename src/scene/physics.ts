import { cottageRoofHeight, HOUSE_Z } from './houseShape';
export const TOP = 105;
// Render edges are well beyond the far clip plane from every reachable position.
export const EDGE = 30000;
export const FIELD_DEPTH = 60000;
export const FLOOR = -150;
export const EYE_HEIGHT = 1.72;
export const NOTCH = 4.8;
export const NOTCH_END = -37;
// A 30 m run over the 255 m descent gives the recess a gentle 6.7° lean.
export const NOTCH_RUN = 30;
export const NOTCH_SLOPE = NOTCH_RUN / (TOP - FLOOR);
export function notchBackZ(y: number) {
  return NOTCH_END + (TOP - Math.max(FLOOR, Math.min(TOP, y))) * NOTCH_SLOPE;
}
export function terrainHeight(x: number, z: number) {
  if (z > 0) return FLOOR;
  if (Math.abs(x) >= NOTCH || z <= NOTCH_END) return TOP;
  return Math.max(FLOOR, TOP - (z - NOTCH_END) / NOTCH_SLOPE);
}
// Walkers fall onto the surface below them, including the sloping house roof.
export function standingHeight(x:number,z:number){
  let height=terrainHeight(x,z);
  const roof=cottageRoofHeight(x,z-HOUSE_Z);
  if(roof)height=Math.max(height,TOP+roof);
  return height;
}
export function solidAt(x:number,y:number,z:number) {
  if(y<terrainHeight(x,z)-.1)return true;
  return y>TOP&&y<standingHeight(x,z);
}
export function resolveHorizontal(x:number,y:number,z:number,dx:number,dz:number,radius=.35) {
  const valid=(nx:number,nz:number)=> !solidAt(nx-radius,y,nz)&&!solidAt(nx+radius,y,nz)&&!solidAt(nx,y,nz-radius)&&!solidAt(nx,y,nz+radius);
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.3));
  for(let i=0;i<steps;i++) {if(valid(x+dx/steps,z))x+=dx/steps;if(valid(x,z+dz/steps))z+=dz/steps;}
  return {x,z};
}
