import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { Experience } from './scene/Experience';
import type { Mode } from './scene/navigation';

export default function App(){
  const host=useRef<HTMLDivElement>(null),experience=useRef<Experience|null>(null),overlay=useRef<HTMLDivElement>(null);
  const [ready,setReady]=useState(false),[active,setActive]=useState(false),[visited,setVisited]=useState(false);
  const [dragLook,setDragLook]=useState(false),[mode,setMode]=useState<Mode>('fly'),[error,setError]=useState(''),[climbing,setClimbing]=useState(false);
  const coarse=matchMedia('(pointer: coarse)').matches;
  useEffect(()=>{
    let disposed=false;
    const timer=window.setTimeout(()=>{
      if(!host.current||disposed)return;
      try{experience.current=new Experience(host.current,{onReady:()=>setReady(true),onMode:setMode,onClimb:setClimbing,onPause:()=>setActive(false),onError:setError});}
      catch(e){setError(e instanceof Error?e.message:'This experience needs a browser with WebGL 2.');}
    },40);
    return()=>{disposed=true;clearTimeout(timer);experience.current?.dispose();experience.current=null;};
  },[]);
  useEffect(()=>{
    if(!overlay.current)return;
    const tween=gsap.to(overlay.current,{opacity:active?0:1,y:active?12:0,duration:active?.8:1.2,ease:'power2.out'});
    return()=>{tween.kill();};
  },[active]);
  async function enter(){
    if(!ready||!experience.current||active)return;
    try{await experience.current.enter();setError('');setDragLook(!document.pointerLockElement);setActive(true);setVisited(true);}
    catch(e){setError(e instanceof Error?e.message:'Click again to enter.');}
  }
  return <main className="relative h-dvh w-full overflow-hidden bg-[#a8c0bd] text-[#f4f2df]">
    <div ref={host} className="absolute inset-0" />
    <div className={`arrival ${ready?'arrival--ready':''}`} aria-hidden="true" />
    <div ref={overlay} className={`entrance absolute inset-0 ${active?'pointer-events-none':''}`} aria-hidden={active}>
      <header className="absolute inset-x-0 top-0 flex items-start justify-between px-7 py-7 md:px-12 md:py-10">
        <div className="identity flex items-center gap-3"><span className="place-symbol" aria-hidden="true"><i/><i/><i/></span><span>FIELD NO. 001</span></div>
        <div className="text-right">
          <span className="edition hidden sm:block">A PLACE OUTSIDE OF TIME</span>
          <p className="creator-credit sm:mt-2">made by <a href="https://itsmohsen.com" target="_blank" rel="noopener noreferrer" tabIndex={active?-1:0}>mohsenized</a></p>
        </div>
      </header>
      <div className="title-block absolute left-7 bottom-[22%] md:left-12 md:bottom-[19%]">
        <p className="eyebrow mb-5">YOU HAVE BEEN HERE BEFORE.</p>
        <h1>The Quiet<span className="title-period">.</span></h1>
        <p className="subtitle mt-5">Nothing is waiting for you.<br/>Stay as long as you like.</p>
      </div>
      <footer className="absolute bottom-7 inset-x-7 flex items-end justify-between gap-6 md:bottom-10 md:inset-x-12">
        <div>
          <p className={`enter-prompt ${ready&&!error?'enter-prompt--ready':''}`}>{error?'A MOMENT OF STILLNESS':ready?(visited?'RETURN TO THE FIELD':'CLICK ANYWHERE TO ENTER'):'FINDING SOMEWHERE QUIET'}<span className="enter-arrow" aria-hidden="true">↗</span></p>
          <p className="controls mt-3">{coarse?'Left thumb to move · right thumb to look · double tap to walk':'WASD move · mouse look · F walk / fly'}</p>
        </div>
        <div className="sound-note hidden sm:flex items-center gap-2.5"><span className="sound-wave" aria-hidden="true"><i/><i/><i/><i/></span><span>BEST WITH SOUND</span></div>
      </footer>
      <button type="button" className="enter-target absolute inset-0 h-full w-full cursor-pointer" onClick={enter} disabled={!ready||active} tabIndex={active?-1:0} aria-label={visited?'Resume exploring The Quiet':'Enter The Quiet. WASD to move, mouse to look, F to walk or fly.'}/>
    </div>
    {active&&<>
      <button type="button" className="session-status mode-toggle absolute bottom-7 left-7 flex items-center gap-2.5 md:bottom-10 md:left-12" onClick={()=>experience.current?.navigation.toggleMode()} onKeyDown={e=>{if(e.code==='Space'||e.code==='Enter')e.stopPropagation();}} aria-label={mode==='fly'?'Switch to walking mode':'Switch to flying mode'} aria-keyshortcuts="F"><span className="status-dot"/>{climbing?'CLIMB':mode==='fly'?'FLY':'WALK'}<span className="mode-switch-hint">{climbing?'W / S · E LET GO':coarse?'TAP TO SWITCH':<><kbd className="mode-key">F</kbd><span>{mode==='fly'?'WALK':'FLY'}</span></>}</span></button>
      <div className="session-hint pointer-events-none absolute bottom-7 right-7 text-right md:bottom-10 md:right-12">{coarse?'DRAG TO EXPLORE · DOUBLE TAP TO WALK':dragLook?'DRAG look · WASD move · SHIFT faster · ESC pause':mode==='fly'?'SPACE / E rise · Q descend · SHIFT faster · F walk · ESC pause':'E ladder · W / S climb · SHIFT run · F fly · ESC pause'}</div>
    </>}
    {error&&<p role="alert" className="error-message absolute left-1/2 top-7 z-20 max-w-[90%] -translate-x-1/2 rounded bg-[#263c36]/80 px-5 py-3 text-center text-sm">{error}</p>}
    <p className="sr-only" aria-live="polite">{active?`${climbing?'Climbing. W and S climb, E lets go':mode==='fly'?'Flying':'Walking'}. Press F to switch movement mode. Escape to pause.`:ready?'The scene is ready. Activate Enter to explore.':'Loading the landscape.'}</p>
  </main>;
}
