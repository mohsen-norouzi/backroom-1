// Deterministic buffers keep ambience stable across restarts and avoid live DSP work.
function noise(seed:number){
  return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
}

export function breezeSamples(sampleRate:number){
  const length=Math.round(sampleRate*16),blend=Math.round(sampleRate*2);
  const samples=new Float32Array(length+blend),random=noise(7319);
  let slow=0,middle=0,fast=0;
  for(let i=-sampleRate;i<samples.length;i++){
    const white=random();
    slow=.99765*slow+white*.099046;
    middle=.963*middle+white*.2965164;
    fast=.57*fast+white*1.0526913;
    if(i>=0)samples[i]=slow+middle+fast+white*.1848;
  }
  // Wrap into the continuation of the noise, then crossfade back to its beginning.
  // The loop boundary is an ordinary adjacent sample, not an abrupt restart.
  for(let i=0;i<blend;i++){
    const phase=i/blend*Math.PI*.5;
    samples[i]=samples[length+i]*Math.cos(phase)+samples[i]*Math.sin(phase);
  }
  const result=samples.slice(0,length);
  let mean=0;for(const value of result)mean+=value;mean/=length;
  let energy=0;for(let i=0;i<length;i++){result[i]-=mean;energy+=result[i]*result[i];}
  const scale=.20/Math.sqrt(energy/length);
  for(let i=0;i<length;i++)result[i]*=scale;
  return result;
}

export function worldEchoSamples(sampleRate:number){
  const length=Math.round(sampleRate*1.85),samples=new Float32Array(length),random=noise(4983);
  const onset=Math.round(sampleRate*.10);
  let smooth=0,energy=0;
  for(let i=onset;i<length;i++){
    const t=i/sampleRate;
    smooth=smooth*.65+random()*.35;
    const fade=Math.min(1,(t-.1)/.07);
    samples[i]=smooth*fade*Math.exp(-(t-.1)*3.7)*Math.pow(1-i/length,2);
    energy+=samples[i]*samples[i];
  }
  // Explicit energy makes the tail equally quiet at different device sample rates.
  const scale=.32/Math.sqrt(energy);
  for(let i=0;i<length;i++)samples[i]*=scale;
  for(const [time,level] of [[.145,1],[.315,.43],[.575,.19]])samples[Math.round(sampleRate*time)]+=level;
  return samples;
}

// A finite mono reflection, with no feedback loop and no route around spatial audio.
export function createWorldEcho(ctx:BaseAudioContext,input:AudioNode,output:AudioNode,amount:number){
  const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=2100;filter.Q.value=.4;
  const convolver=ctx.createConvolver();convolver.normalize=false;
  const data=worldEchoSamples(ctx.sampleRate),impulse=ctx.createBuffer(1,data.length,ctx.sampleRate);
  impulse.getChannelData(0).set(data);convolver.buffer=impulse;
  const wet=ctx.createGain();wet.gain.value=amount;
  input.connect(filter);filter.connect(convolver);convolver.connect(wet);wet.connect(output);
  return {dispose(){filter.disconnect();convolver.disconnect();wet.disconnect();}};
}
