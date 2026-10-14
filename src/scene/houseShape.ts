// Shared roof dimensions keep the walkable surface aligned with the cottage.
export const HOUSE_Z=-56;
export const HOUSE_BASE=.35;
export const ROOF_EAVE=5.5;
export const ROOF_RIDGE=8.65;
export const ROOF_HALF_DEPTH=6.15;
export const ROOF_HALF_WIDTH=7.15;
export const FRONT_GABLE_HALF=3.45;
export const FRONT_GABLE_RIDGE=9.05;
export const FRONT_GABLE_Z=6.9;
export function cottageRoofHeight(x:number,z:number){
  let h=0;
  if(Math.abs(x)<=ROOF_HALF_WIDTH&&Math.abs(z)<=ROOF_HALF_DEPTH)
    h=ROOF_RIDGE-Math.abs(z)*(ROOF_RIDGE-ROOF_EAVE)/ROOF_HALF_DEPTH;
  if(Math.abs(x)<=FRONT_GABLE_HALF&&z>=0&&z<=FRONT_GABLE_Z)
    h=Math.max(h,FRONT_GABLE_RIDGE-Math.abs(x)*(FRONT_GABLE_RIDGE-ROOF_EAVE)/FRONT_GABLE_HALF);
  if(Math.abs(x)<=1.7&&z>=6.2&&z<=8.1)h=Math.max(h,4.65-Math.abs(x)*.9/1.7);
  return h?HOUSE_BASE+h+.13:0;
}
