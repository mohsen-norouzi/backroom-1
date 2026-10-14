import * as THREE from 'three';
import gsap from 'gsap';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildWorld } from './world';
import { Navigation } from './navigation';
import type { Mode } from './navigation';
import { Soundscape } from './audio';

export class Experience {
  readonly renderer:THREE.WebGLRenderer;
  readonly scene=new THREE.Scene();
  readonly camera=new THREE.PerspectiveCamera(52,1,.1,9000);
  readonly navigation:Navigation;
  private composer:EffectComposer;
  private film:ShaderPass;
  private world:ReturnType<typeof buildWorld>;
  private audio=new Soundscape();
  private frame=0;private lastTime=0;private elapsed=0;private entered=false;private disposed=false;
  private resizeObserver:ResizeObserver;
  private idleTime=0;private intro:gsap.core.Tween;
  constructor(private container:HTMLElement,callbacks:{onReady:()=>void;onMode:(mode:Mode)=>void;onClimb:(climbing:boolean)=>void;onPause:()=>void;onTransition:(fading:boolean)=>void;onError:(message:string)=>void}){
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute('aria-label','An endless green plateau, a pink house, and a ladder into the clouds.');
    container.appendChild(this.renderer.domElement);
    this.scene.background=new THREE.Color('#a3c6d0');this.scene.fog=new THREE.FogExp2('#b7c6c4',.00030);
    const ambient=new THREE.HemisphereLight('#c6d6db','#444a36',1.25);this.scene.add(ambient);
    const sun=new THREE.DirectionalLight('#fff1d5',2.7);sun.position.set(-160,330,130);sun.target.position.set(0,105,-55);this.scene.add(sun,sun.target);
    sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-55;sun.shadow.camera.right=55;sun.shadow.camera.top=55;sun.shadow.camera.bottom=-55;sun.shadow.camera.near=1;sun.shadow.camera.far=600;sun.shadow.normalBias=.035;sun.shadow.bias=-.0001;
    this.world=buildWorld(this.scene);
    this.camera.position.set(24,164,410);this.camera.lookAt(0,2,-34);
    this.navigation=new Navigation(this.camera,this.renderer.domElement,callbacks.onMode,()=>{this.audio.pause();callbacks.onPause();},callbacks.onTransition,callbacks.onClimb);
    this.composer=new EffectComposer(this.renderer);this.composer.addPass(new RenderPass(this.scene,this.camera));
    this.film=new ShaderPass({
      uniforms:{tDiffuse:{value:null},uTime:{value:0}},
      vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`uniform sampler2D tDiffuse;uniform float uTime;varying vec2 vUv;
        void main(){vec3 color=texture2D(tDiffuse,vUv).rgb;
        float vignette=1.-smoothstep(.26,.85,distance(vUv,vec2(.5)))*.2;color*=vignette;
        float grain=fract(sin(dot(vUv+fract(uTime),vec2(12.9898,78.233)))*43758.5453)-.5;
        color+=grain*.012;
        color=pow(max(color,vec3(0.)),vec3(1.035));
        color=mix(color,vec3(dot(color,vec3(.2126,.7152,.0722))),.13);
        gl_FragColor=vec4(color,1.);}`,
    });
    this.composer.addPass(this.film);this.composer.addPass(new OutputPass());
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.intro=gsap.to(this.camera.position,{x:12,y:148,z:365,duration:reduced?0:32,ease:'sine.out',onUpdate:()=>{if(!this.entered)this.camera.lookAt(0,2,-34);}});
    this.resizeObserver=new ResizeObserver(this.resize);this.resizeObserver.observe(container);this.resize();
    this.renderer.domElement.addEventListener('webglcontextlost',this.contextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored',this.contextRestored);
    this.renderer.domElement.addEventListener('webglcontextlost',()=>callbacks.onError('The scene lost its graphics connection. Refresh to return.'),{once:true});
    this.frame=requestAnimationFrame(this.tick);
    // Let the first complete render land before fading in the entrance.
    requestAnimationFrame(()=>{if(!this.disposed)callbacks.onReady();});
  }
  private resize=()=>{
    const w=this.container.clientWidth,h=this.container.clientHeight;
    this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);this.composer.setSize(w,h);
  };
  private contextLost=(e:Event)=>{e.preventDefault();cancelAnimationFrame(this.frame);this.audio.pause();};
  private contextRestored=()=>{this.lastTime=0;this.frame=requestAnimationFrame(this.tick);};
  async enter(){
    if(this.disposed)return;
    if(!matchMedia('(pointer: coarse)').matches){
      try{await this.renderer.domElement.requestPointerLock();}catch{
        // Some embedded browsers do not allow pointer lock. Do not trap the user in a noninteractive view.
        // Drag-to-look remains available when pointer capture is unsupported.
      }
      
    }
    this.entered=true;this.intro.kill();this.navigation.activate();
    void this.audio.start().catch(()=>{/* The world remains usable if audio is unavailable. */});
  }
  private tick=(now:number)=>{
    if(this.disposed)return;
    this.frame=requestAnimationFrame(this.tick);
    const dt=this.lastTime?Math.min((now-this.lastTime)/1000,.05):0;this.lastTime=now;
    if(document.hidden)return;
    this.elapsed+=dt;
    if(!this.entered&&this.intro.progress()===1&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
      this.idleTime+=dt;this.camera.position.x=12+Math.sin(this.idleTime*.045)*3;this.camera.position.y=148+Math.sin(this.idleTime*.12)*.7;this.camera.lookAt(0,2,-34);
    }
    this.navigation.update(dt);this.world.update(this.elapsed,dt,this.camera);
    if(this.navigation.active)this.audio.update(this.navigation.speed,this.camera.position.y,this.navigation.mode==='walk',this.navigation.grounded,this.elapsed,this.navigation.climbing);
    this.film.uniforms.uTime.value=this.elapsed;this.composer.render();
  };
  dispose(){
    this.disposed=true;cancelAnimationFrame(this.frame);this.intro.kill();this.resizeObserver.disconnect();
    if(document.pointerLockElement===this.renderer.domElement)document.exitPointerLock();
    this.navigation.dispose();this.audio.dispose();this.world.dispose();
    for(const pass of this.composer.passes)pass.dispose();this.composer.dispose();
    this.renderer.domElement.removeEventListener('webglcontextlost',this.contextLost);this.renderer.domElement.removeEventListener('webglcontextrestored',this.contextRestored);
    this.renderer.dispose();this.renderer.domElement.remove();
  }
}
