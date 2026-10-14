export const TOP = 105;
// Render edges are well beyond the far clip plane from every reachable position.
export const EDGE = 30000;
export const FIELD_DEPTH = 60000;
export const FLOOR = -150;
export const EYE_HEIGHT = 1.72;
export const NOTCH = 4.8;
export const NOTCH_END = -37;
export function terrainHeight(x: number, z: number) {
  return z <= 0 && !(Math.abs(x) < NOTCH && z > NOTCH_END) ? TOP : FLOOR;
}
export function solidAt(x:number,y:number,z:number) {
  if(y<TOP-.1&&terrainHeight(x,z)===TOP)return true;
  // House, including roof: conservatively solid rather than entering an unbuilt interior.
  return Math.abs(x)<7.1&&z>-62.3&&z<-48.9&&y>TOP&&y<TOP+12.4;
}
export function resolveHorizontal(x:number,y:number,z:number,dx:number,dz:number,radius=.35) {
  const valid=(nx:number,nz:number)=> !solidAt(nx-radius,y,nz)&&!solidAt(nx+radius,y,nz)&&!solidAt(nx,y,nz-radius)&&!solidAt(nx,y,nz+radius);
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.3));
  for(let i=0;i<steps;i++) {if(valid(x+dx/steps,z))x+=dx/steps;if(valid(x,z+dz/steps))z+=dz/steps;}
  return {x,z};
}
export function safeLanding(x:number,z:number) {
  if(terrainHeight(x,z)!==TOP||solidAt(x,TOP+EYE_HEIGHT,z))return {x:15,y:TOP+EYE_HEIGHT,z:-26};
  return {x,y:TOP+EYE_HEIGHT,z};
}
