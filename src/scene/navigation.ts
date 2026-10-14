import * as THREE from 'three';
import gsap from 'gsap';
import { EYE_HEIGHT, FLOOR, terrainHeight, resolveHorizontal, safeLanding, solidAt } from './physics';
import { movementSpeed } from './tuning';
import { LadderController } from './ladder';
export type Mode='fly'|'walk';
export class Navigation {
  mode:Mode='fly'; active=false; grounded=false; speed=0;
  readonly ladder=new LadderController();
  private grabRequested=false;
  get climbing(){return this.ladder.attached;}
  private keys=new Set<string>();private velocity=new THREE.Vector3();private yaw=0;private pitch=0;
  private modeTransition:gsap.core.Timeline|null=null;
  private vertical=0;private transitioning=false;private stepPhase=0;
  private pointers=new Map<number,{x:number;y:number;startX:number;startY:number;side:'move'|'look'}>();
  private touchMove={x:0,y:0};private lastTap=0;
  constructor(private camera:THREE.PerspectiveCamera,private canvas:HTMLCanvasElement,private onMode:(mode:Mode)=>void,private onPause:()=>void,private onTransition:(fading:boolean)=>void,private onClimb:(climbing:boolean)=>void=()=>{}){
    this.syncAngles();
    document.addEventListener('keydown',this.keyDown);document.addEventListener('keyup',this.keyUp);document.addEventListener('mousemove',this.mouseMove);
    document.addEventListener('pointerlockchange',this.lockChange);window.addEventListener('blur',this.blur);
    document.addEventListener('visibilitychange',this.visibility);
    canvas.addEventListener('pointerdown',this.pointerDown);canvas.addEventListener('pointermove',this.pointerMove);canvas.addEventListener('pointerup',this.pointerUp);canvas.addEventListener('pointercancel',this.pointerUp);
  }
  syncAngles(){const e=new THREE.Euler().setFromQuaternion(this.camera.quaternion,'YXZ');this.yaw=e.y;this.pitch=e.x;}
  activate(){this.active=true;this.syncAngles();}
  pause(){this.active=false;this.keys.clear();this.velocity.set(0,0,0);this.touchMove={x:0,y:0};this.pointers.clear();this.onPause();}
  private blur=()=>{if(this.active){if(document.pointerLockElement)document.exitPointerLock();this.pause();}};
  private visibility=()=>{if(document.hidden)this.blur();};
  private lockChange=()=>{if(document.pointerLockElement!==this.canvas&&this.active&&!matchMedia('(pointer: coarse)').matches)this.pause();};
  private keyDown=(e:KeyboardEvent)=>{
    if(!this.active)return;
    if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ControlLeft'].includes(e.code))e.preventDefault();
    this.keys.add(e.code);
    if(e.code==='KeyF'&&!e.repeat)this.toggleMode();
    if(e.code==='Escape'&&!document.pointerLockElement)this.pause();
    if(this.mode==='walk'&&!e.repeat){
      if(e.code==='KeyE'){
        if(this.climbing){this.ladder.release(this.camera.position);this.onClimb(false);this.vertical=0;}
        else this.grabRequested=true;
      }
      if(e.code==='Space'){
        if(this.climbing){this.ladder.release(this.camera.position);this.onClimb(false);this.vertical=1.5;}
        else if(this.grounded){this.vertical=6.2;this.grounded=false;}
      }
    }
  };
  private keyUp=(e:KeyboardEvent)=>{this.keys.delete(e.code);};
  private mouseMove=(e:MouseEvent)=>{if(this.active&&document.pointerLockElement===this.canvas){this.yaw-=e.movementX*.001;this.pitch=THREE.MathUtils.clamp(this.pitch-e.movementY*.001,-1.5,1.5);}};
  private pointerDown=(e:PointerEvent)=>{
    if(!this.active||document.pointerLockElement===this.canvas)return;
    this.canvas.setPointerCapture(e.pointerId);
    const now=performance.now();if(e.pointerType!=='mouse'&&now-this.lastTap<280&&this.pointers.size===0)this.toggleMode();this.lastTap=now;
    this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,side:e.pointerType==='mouse'?'look':e.clientX<innerWidth*.45?'move':'look'});
  };
  private pointerMove=(e:PointerEvent)=>{
    const p=this.pointers.get(e.pointerId);if(!p)return;
    if(p.side==='look'){const sensitivity=e.pointerType==='mouse'?.0017:.0025;this.yaw-=(e.clientX-p.x)*sensitivity;this.pitch=THREE.MathUtils.clamp(this.pitch-(e.clientY-p.y)*sensitivity,-1.45,1.45);}
    else {this.touchMove.x=THREE.MathUtils.clamp((e.clientX-p.startX)/65,-1,1);this.touchMove.y=THREE.MathUtils.clamp((e.clientY-p.startY)/65,-1,1);}
    p.x=e.clientX;p.y=e.clientY;
  };
  private pointerUp=(e:PointerEvent)=>{const p=this.pointers.get(e.pointerId);if(p?.side==='move')this.touchMove={x:0,y:0};this.pointers.delete(e.pointerId);};
  toggleMode(){
    if(this.transitioning)return;
    this.ladder.reset();this.onClimb(false);
    this.mode=this.mode==='fly'?'walk':'fly';this.onMode(this.mode);this.velocity.set(0,0,0);this.vertical=0;
    if(this.mode==='walk'){
      this.transitioning=true;
      const landing=safeLanding(this.camera.position.x,this.camera.position.z);
      const relocated=Math.hypot(landing.x-this.camera.position.x,landing.z-this.camera.position.z)>2;
      this.onTransition(true);
      // A gentle fade avoids racing the camera hundreds of metres to the field.
      this.modeTransition=gsap.timeline()
        .call(()=>{
          this.camera.position.set(landing.x,landing.y,landing.z);
          if(relocated){this.yaw=Math.atan2(landing.x,landing.z+56);this.pitch=Math.atan2(2.3,Math.hypot(landing.x,landing.z+56));}
          this.camera.rotation.set(this.pitch,this.yaw,0,'YXZ');
        },[],.45)
        .call(()=>this.onTransition(false),[],.55)
        .call(()=>{this.transitioning=false;this.grounded=true;},[],1);
    }
  }

  update(dt:number){
    if(!this.active||this.transitioning){this.speed=0;return;}
    const forward=new THREE.Vector3(-Math.sin(this.yaw),0,-Math.cos(this.yaw));
    if(this.mode==='fly')forward.set(-Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),-Math.cos(this.yaw)*Math.cos(this.pitch));
    const right=new THREE.Vector3(Math.cos(this.yaw),0,-Math.sin(this.yaw));
    const f=Number(this.keys.has('KeyW')||this.keys.has('ArrowUp'))-Number(this.keys.has('KeyS')||this.keys.has('ArrowDown'))-this.touchMove.y;
    const r=Number(this.keys.has('KeyD')||this.keys.has('ArrowRight'))-Number(this.keys.has('KeyA')||this.keys.has('ArrowLeft'))+this.touchMove.x;
    if(this.mode==='walk'){
      const previouslyAttached=this.climbing;
      const controlled=this.ladder.update(this.camera.position,f,dt,this.grabRequested);
      this.grabRequested=false;
      if(previouslyAttached!==this.climbing)this.onClimb(this.climbing);
      if(controlled){
        this.velocity.set(0,0,0);this.vertical=0;this.speed=this.ladder.speed;
        this.grounded=!this.climbing;
        this.camera.rotation.set(this.pitch,this.yaw,0,'YXZ');
        return;
      }
    }
    const direction=forward.multiplyScalar(f).addScaledVector(right,r);
    if(this.mode==='fly')direction.y+=Number(this.keys.has('Space')||this.keys.has('KeyE'))-Number(this.keys.has('ControlLeft')||this.keys.has('KeyQ'));
    if(direction.lengthSq()>1)direction.normalize();
    const fast=this.keys.has('ShiftLeft')||this.keys.has('ShiftRight');
    const targetSpeed=movementSpeed(this.mode,fast);
    const target=direction.multiplyScalar(targetSpeed);
    this.velocity.lerp(target,1-Math.exp(-dt*(this.mode==='fly'?6:12)));
    // Releasing Shift immediately restores the gentle pace, including residual velocity.
    if(!fast&&this.velocity.length()>targetSpeed)this.velocity.setLength(targetSpeed);
    this.speed=this.velocity.length();
    const position=this.camera.position;
    const resolved=resolveHorizontal(position.x,position.y-1,position.z,this.velocity.x*dt,this.velocity.z*dt);
    position.x=resolved.x;position.z=resolved.z;
    if(this.mode==='fly'){
      const nextY=position.y+this.velocity.y*dt;
      if(!solidAt(position.x,nextY-.7,position.z))position.y=Math.max(terrainHeight(position.x,position.z)+EYE_HEIGHT,nextY);
      this.grounded=false;
    }else{
      this.vertical-=18*dt;position.y+=this.vertical*dt;
      const floor=terrainHeight(position.x,position.z)+EYE_HEIGHT;
      if(position.y<=floor){position.y=floor;this.vertical=0;this.grounded=true;}else this.grounded=false;
    }
    position.y=THREE.MathUtils.clamp(position.y,FLOOR+EYE_HEIGHT,1100);position.x=THREE.MathUtils.clamp(position.x,-5000,5000);position.z=THREE.MathUtils.clamp(position.z,-5000,5000);
    this.stepPhase+=dt*this.speed*1.8;
    const bob=this.mode==='walk'&&this.grounded?Math.sin(this.stepPhase)*Math.min(this.speed*.0028,.022):0;
    this.camera.rotation.set(this.pitch+bob,this.yaw,this.mode==='fly'?-this.velocity.dot(right)*.00025:0,'YXZ');
  }
  dispose(){
    this.modeTransition?.kill();gsap.killTweensOf(this.camera.position);gsap.killTweensOf(this);
    document.removeEventListener('keydown',this.keyDown);document.removeEventListener('keyup',this.keyUp);document.removeEventListener('mousemove',this.mouseMove);document.removeEventListener('pointerlockchange',this.lockChange);window.removeEventListener('blur',this.blur);document.removeEventListener('visibilitychange',this.visibility);
    this.canvas.removeEventListener('pointerdown',this.pointerDown);this.canvas.removeEventListener('pointermove',this.pointerMove);this.canvas.removeEventListener('pointerup',this.pointerUp);this.canvas.removeEventListener('pointercancel',this.pointerUp);
  }
}
