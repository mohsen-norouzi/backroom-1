import * as THREE from 'three';
import gsap from 'gsap';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildWorld } from './world';
import { SUN_DIRECTION } from './atmosphere';
import { Navigation } from './navigation';
import type { Mode } from './navigation';
import { Soundscape } from './audio';

export class Experience {
  readonly renderer:THREE.WebGLRenderer;
  readonly scene=new THREE.Scene();
  readonly camera=new THREE.PerspectiveCamera(52,1,.3,8000);
  readonly navigation:Navigation;
  private composer:EffectComposer;
  private film:ShaderPass;
  private world:ReturnType<typeof buildWorld>;
  private audio:Soundscape;
  private audioForward=new THREE.Vector3();
  private audioUp=new THREE.Vector3();
  private frame=0;private lastTime=0;private elapsed=0;private entered=false;private disposed=false;
  private resizeObserver:ResizeObserver;
  private probeFrames:number[]=[];private probeLast=0;private probeReport=0;private qualityChange=0;private pixelRatio=1;
  private idleTime=0;private intro:gsap.core.Tween;
  constructor(private container:HTMLElement,callbacks:{onReady:()=>void;onMode:(mode:Mode)=>void;onClimb:(climbing:boolean)=>void;onPause:()=>void;onError:(message:string)=>void}){
    this.audio=new Soundscape(container);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(1);
    this.renderer.info.autoReset=false;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.0;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute('aria-label','An endless green plateau, a pink house, and a ladder into the clouds.');
    container.appendChild(this.renderer.domElement);
    this.scene.background=new THREE.Color('#a3c6d0');this.scene.fog=new THREE.FogExp2('#b7c6c4',.00030);
    const ambient=new THREE.HemisphereLight('#b9cfe3','#6d7b5e',1.20);this.scene.add(ambient);
    const sun=new THREE.DirectionalLight('#fff2dc',3.35);sun.target.position.set(0,105,-55);sun.position.copy(sun.target.position).addScaledVector(SUN_DIRECTION,330);this.scene.add(sun,sun.target);
    sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-55;sun.shadow.camera.right=55;sun.shadow.camera.top=55;sun.shadow.camera.bottom=-55;sun.shadow.camera.near=1;sun.shadow.camera.far=600;sun.shadow.normalBias=.035;sun.shadow.bias=-.0001;
    this.world=buildWorld(this.scene);
    this.renderer.shadowMap.autoUpdate=false;this.renderer.shadowMap.needsUpdate=true;
    this.camera.position.set(10,139,445);this.camera.lookAt(0,-13,-34);
    this.navigation=new Navigation(this.camera,this.renderer.domElement,callbacks.onMode,()=>{this.audio.pause();callbacks.onPause();},callbacks.onClimb);
    this.composer=new EffectComposer(this.renderer);this.composer.renderTarget1.samples=2;this.composer.renderTarget2.samples=2;this.composer.addPass(new RenderPass(this.scene,this.camera));
    this.film=new ShaderPass({
      uniforms:{tDiffuse:{value:null},uTime:{value:0}},
      vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`uniform sampler2D tDiffuse;uniform float uTime;varying vec2 vUv;
        void main(){vec3 color=texture2D(tDiffuse,vUv).rgb;
        float vignette=1.-smoothstep(.26,.85,distance(vUv,vec2(.5)))*.06;color*=vignette;
        float grain=fract(sin(dot(vUv+fract(uTime),vec2(12.9898,78.233)))*43758.5453)-.5;
        float luminance=dot(color,vec3(.2126,.7152,.0722));
        color=mix(vec3(luminance),color,.97);
        color+=grain*.0025;
        color=pow(max(color,vec3(0.)),vec3(1.));

        gl_FragColor=vec4(color,1.);}`,
    });
    this.composer.addPass(this.film);this.composer.addPass(new OutputPass());
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.intro=gsap.to(this.camera.position,{x:5,y:130,z:410,duration:reduced?0:32,ease:'sine.out',onUpdate:()=>{if(!this.entered)this.camera.lookAt(0,-13,-34);}});
    this.resizeObserver=new ResizeObserver(this.resize);this.resizeObserver.observe(container);this.resize();
    this.renderer.domElement.addEventListener('webglcontextlost',this.contextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored',this.contextRestored);
    this.renderer.domElement.addEventListener('webglcontextlost',()=>callbacks.onError('The scene lost its graphics connection. Refresh to return.'),{once:true});
    this.frame=requestAnimationFrame(this.tick);
    // Let the first complete render land before fading in the entrance.
    void this.world.ready.then(()=>requestAnimationFrame(()=>{if(!this.disposed)callbacks.onReady();}));
  }
  private resize=()=>{
    const w=this.container.clientWidth,h=this.container.clientHeight;
    this.pixelRatio=Math.min(devicePixelRatio,1.35,Math.sqrt(2000000/(w*h)));
    this.renderer.setPixelRatio(this.pixelRatio);this.composer.setPixelRatio(this.pixelRatio);
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
      this.idleTime+=dt;this.camera.position.x=5+Math.sin(this.idleTime*.045)*3;this.camera.position.y=130+Math.sin(this.idleTime*.12)*.7;this.camera.lookAt(0,-13,-34);
    }
    this.navigation.update(dt);this.world.update(this.elapsed,dt,this.camera);
    if(this.navigation.active){
      this.camera.getWorldDirection(this.audioForward);this.audioUp.set(0,1,0).applyQuaternion(this.camera.quaternion);
      this.audio.updateListener(this.camera.position,this.audioForward,this.audioUp);
      this.audio.update(this.navigation.speed,this.camera.position.y,this.navigation.mode==='walk',this.navigation.grounded,this.elapsed,this.navigation.climbing);
    }
    this.film.uniforms.uTime.value=this.elapsed;
    this.renderer.info.reset();this.composer.render();
    const interval=now-this.probeLast;
    if(this.probeLast&&interval<250){this.probeFrames.push(interval);if(this.probeFrames.length>90)this.probeFrames.shift();}
    this.probeLast=now;
    if(this.probeFrames.length>=30&&now-this.probeReport>1000){
      const sorted=[...this.probeFrames].sort((a,b)=>a-b);
      const mean=this.probeFrames.reduce((a,b)=>a+b,0)/this.probeFrames.length;
      this.renderer.domElement.dataset.sceneStats=JSON.stringify({fps:Math.round(1000/mean),p95:Math.round(sorted[Math.floor(sorted.length*.95)]),calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,pixelRatio:this.renderer.getPixelRatio(),volumes:this.world.volumeCount,camera:this.camera.position.toArray().map(v=>Math.round(v)),rotation:[this.camera.rotation.x,this.camera.rotation.y].map(v=>Math.round(v*100)/100)});
      this.probeReport=now;
      if(mean>23&&now-this.qualityChange>4000&&this.pixelRatio>.8){
        this.pixelRatio=Math.max(.8,this.pixelRatio-.1);this.renderer.setPixelRatio(this.pixelRatio);this.composer.setPixelRatio(this.pixelRatio);this.qualityChange=now;this.probeFrames=[];
      }
    }
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
