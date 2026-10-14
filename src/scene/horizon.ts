// Sky, terrain and distant clouds share linear-light atmospheric colors.
export const SKY_RADIUS = 8500;
export const HAZE_END = 7200;
export const horizonGLSL = `
vec3 atmosphereColor(vec3 direction) {
  vec3 dir=normalize(direction);
  vec3 horizon=vec3(.47,.61,.65);
  vec3 zenith=vec3(.055,.27,.50);
  float elevation=pow(smoothstep(.012,.85,max(dir.y,0.)),.65);
  vec3 sky=mix(horizon,zenith,elevation);
  float sun=max(dot(dir,normalize(vec3(-.48,.67,.55))),0.);
  float aboveHaze=smoothstep(.025,.16,dir.y);
  sky+=vec3(1.,.89,.74)*pow(sun,12.)*.075*aboveHaze;
  sky+=vec3(1.,.94,.83)*pow(sun,500.)*.22;
  return sky;
}
float terrainHaze(vec3 viewRay) {
  float distanceToEye=length(viewRay);
  float air=1.-exp(-pow(distanceToEye*.00034,1.8));
  // At eye level a flat field compresses kilometres into a single pixel.
  // A shallow atmospheric band keeps that silhouette from becoming a hard seam.
  float elevation=abs(viewRay.y)/max(distanceToEye,.001);
  float horizon=(1.-smoothstep(.002,.08,elevation))*smoothstep(40.,240.,distanceToEye);
  air=1.-(1.-air)*(1.-horizon*.995);
  return mix(air,1.,smoothstep(4800.,7200.,distanceToEye));
}
`;
