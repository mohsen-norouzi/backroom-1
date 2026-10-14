import { SUN_DIRECTION } from './atmosphere';

// The same linear-light atmosphere is used by land, clouds and sky.
export const SKY_RADIUS=7500;
export const HAZE_END=7200;
export const horizonGLSL=`
const vec3 sunDirection=vec3(${SUN_DIRECTION.toArray().map(value=>value.toFixed(7)).join(',')});
vec3 atmosphereColor(vec3 direction){
  vec3 dir=normalize(direction);
  vec3 horizon=vec3(.33,.48,.52),zenith=vec3(.10,.33,.58);
  float elevation=1.-exp(-max(dir.y,0.)*14.);
  vec3 sky=mix(horizon,zenith,elevation);
  float sun=max(dot(dir,sunDirection),0.);
  sky+=vec3(.95,.88,.73)*pow(sun,18.)*.04;
  return sky;
}
float terrainHaze(vec3 viewRay){
  // Real distance, never angle to the camera: a near wall cannot become a blue stripe.
  float distanceToEye=length(viewRay);
  float air=1.-exp(-pow(distanceToEye*.00043,1.45));
  return mix(air,1.,smoothstep(4800.,7200.,distanceToEye));
}
float fieldHaze(vec3 viewRay){
  // A shallow ground mist is denser at walking height, but never applied to cliff faces.
  float distanceToEye=length(viewRay);
  float extinction=.00043+.0045*exp(-abs(viewRay.y)/9.);
  float air=1.-exp(-pow(distanceToEye*extinction,1.45));
  return mix(air,1.,smoothstep(4800.,7200.,distanceToEye));
}
`;
