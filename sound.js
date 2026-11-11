// Recorded chapter music and small synthesized interaction effects.
import {musicForChapter} from './illusion-music.js';
let audio=null,bus=null,wet=null,master=null;
const volumes={music:.65,effects:.8};
function destination(){if(!master){master=audio.createGain();master.connect(audio.destination);master.gain.value=document.hidden?0:1;}return master;}
export function setAudioLevels(levels){
  for(const key of Object.keys(volumes))if(Number.isFinite(levels[key]))volumes[key]=Math.max(0,Math.min(1,levels[key]));
  if(!audio)return;
  bus?.gain.setTargetAtTime(volumes.effects,audio.currentTime,.04);
  music?.out.gain.setTargetAtTime(VOLUME*volumes.music,audio.currentTime,.1);
}
export const audioState=()=>({levels:{...volumes},track:music?.info.title??null,file:music?.info.file??null,music:!!music,playing:!!music&&!music.element.paused,chapter:musicChapter,muted:document.hidden,error:musicError,time:music?.element.currentTime??0,voices:voices.size});
if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>{
  if(audio&&master)master.gain.setTargetAtTime(document.hidden?0:1,audio.currentTime,.1);
  for(const m of voices){if(document.hidden)m.element.pause();else if(m===music)m.element.play().catch(()=>{});}
});
export function unlockSound(){
  try{audio??=new AudioContext();if(audio.state==='suspended')audio.resume();}catch{audio=null;}
}
// Every effect goes through one bus with a little room on it: a soft reverb made from decaying noise,
// so the small sounds feel like they happen in the same quiet, airy place.
function out(){
  if(bus)return bus;
  bus=audio.createGain();bus.gain.value=volumes.effects;bus.connect(destination());
  const verb=audio.createConvolver(),n=audio.sampleRate*2.4,ir=audio.createBuffer(2,n,audio.sampleRate);
  for(let c=0;c<2;c++){const d=ir.getChannelData(c);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,3.2);}
  verb.buffer=ir;wet=audio.createGain();wet.gain.value=.32;bus.connect(verb).connect(wet).connect(destination());
  return bus;
}
function tone(freq,start,length,{type='sine',volume=.12,slide=0,attack=.015,pan=0}={}){
  const t=audio.currentTime+start,osc=audio.createOscillator(),gain=audio.createGain();
  osc.type=type;osc.frequency.setValueAtTime(freq,t);if(slide)osc.frequency.exponentialRampToValueAtTime(freq*slide,t+length);
  gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(volume,t+attack);gain.gain.exponentialRampToValueAtTime(.0001,t+length);
  let node=osc.connect(gain);if(pan&&audio.createStereoPanner){const p=audio.createStereoPanner();p.pan.value=pan;node=node.connect(p);}
  node.connect(out());osc.start(t);osc.stop(t+length+.05);
}
// A bell: a few inharmonic partials that die away at different rates, like a small glass chime.
function bell(freq,start,{volume=.07,length=1.6,pan=0}={}){
  [[1,1],[2.76,.35],[5.4,.12],[8.93,.05]].forEach(([k,v],i)=>tone(freq*k,start,length/(1+i*.8),{volume:volume*v,attack:.004,pan}));
}
// Filtered noise: footsteps, the shutter, air.
function noise(start,length,{volume=.1,freq=1200,q=1,type='bandpass',slide=0,attack=.005}={}){
  const t=audio.currentTime+start,n=Math.ceil(audio.sampleRate*length),buf=audio.createBuffer(1,n,audio.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<n;i++)d[i]=Math.random()*2-1;
  const src=audio.createBufferSource(),f=audio.createBiquadFilter(),gain=audio.createGain();
  src.buffer=buf;f.type=type;f.Q.value=q;f.frequency.setValueAtTime(freq,t);if(slide)f.frequency.exponentialRampToValueAtTime(freq*slide,t+length);
  gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(volume,t+attack);gain.gain.exponentialRampToValueAtTime(.0001,t+length);
  src.connect(f).connect(gain).connect(out());src.start(t);src.stop(t+length+.05);
}
// Notes from D major's pentatonic scale, so the effects sit with the Gymnopédie under them.
const SCALE=[293.66,329.63,369.99,440,493.88,587.33,659.25,739.99,880,987.77,1174.66];
let joins=0;
const SOUNDS={
  place:()=>{bell(SCALE[5],0,{volume:.06,length:1.2});noise(0,.08,{volume:.05,freq:900});},
  remove:()=>{tone(520,0,.22,{slide:.55,volume:.06});noise(0,.18,{volume:.03,freq:2000,slide:.4});},
  // Soft footsteps on stone: a short thud and a scuff, slightly different every time.
  step:()=>{noise(0,.07,{volume:.07,freq:380+Math.random()*120,q:1.4,type:'lowpass'});noise(.005,.05,{volume:.018,freq:2600+Math.random()*800,q:.8});},
  stuck:()=>{tone(196,0,.16,{type:'triangle',volume:.06});tone(185,.15,.2,{type:'triangle',volume:.05});},
  fall:()=>{tone(620,0,.9,{slide:.22,volume:.06});noise(0,.9,{volume:.04,freq:1600,slide:.2});},
  // The shutter: a click, the curtain, and a breath of the film winding on.
  shutter:()=>{noise(0,.025,{volume:.16,freq:3800,q:2});noise(.05,.04,{volume:.12,freq:2400,q:2});noise(.1,.22,{volume:.035,freq:1200,q:.7,slide:1.6});},
  // A join coming true: a chord that blooms, then bells climbing the scale. Each join of a level
  // climbs a little higher than the last, so a run of them sounds like a phrase.
  join:()=>{
    const r=Math.min(joins++,3);[0,2,4].forEach((k,i)=>tone(SCALE[k+r]/2,i*.03,1.8,{volume:.05,attack:.08}));
    [4,5,7].forEach((k,i)=>bell(SCALE[Math.min(k+r,SCALE.length-1)],.14+i*.11,{volume:.05,pan:(i-1)*.4}));
    noise(0,1.2,{volume:.025,freq:5000,q:.5,slide:.5,attack:.3});
  },
  // Crossing a join: air rushing past, and a rising note.
  cross:()=>{noise(0,.7,{volume:.05,freq:500,q:.9,slide:4,attack:.25});tone(SCALE[3],0,.7,{type:'triangle',volume:.04,slide:1.5,attack:.2});},
  // Home: a little music-box phrase that comes to rest.
  win:()=>{joins=0;[[5,0],[7,.16],[6,.32],[8,.48],[10,.72]].forEach(([k,t],i)=>bell(SCALE[k],t,{volume:.075,length:i===4?2.6:1.4,pan:(i%2?.25:-.25)}));
    [0,2,4].forEach((k,i)=>tone(SCALE[k],.72+i*.02,2.4,{volume:.045,attack:.1}));},
  mechanism:()=>{noise(0,.75,{volume:.035,freq:180,q:1.2,type:'lowpass',slide:2,attack:.1});tone(73.42,0,.9,{volume:.012,type:'triangle',attack:.12,slide:1.03});noise(.75,.08,{volume:.04,freq:700});},
  // A crossing lines up in VR: one soft, high bell.
  align:()=>{bell(SCALE[8],0,{volume:.035,length:1.4});},
  level:()=>{joins=0;}
};
export function play(name){if(audio&&audio.state==='running')SOUNDS[name]?.();}

// Stream local files: a long orchestral recording must not allocate a full decoded buffer on Quest.
const VOLUME=.72,voices=new Set();
let music=null,musicChapter=-1,musicError=null;
function retire(m){
  if(!m||m.retiring)return;m.retiring=true;
  m.out.gain.cancelScheduledValues(audio.currentTime);m.out.gain.setTargetAtTime(0,audio.currentTime,.45);
  setTimeout(()=>{m.element.pause();m.element.removeAttribute('src');m.element.load();m.source.disconnect();m.out.disconnect();voices.delete(m);},2400);
}
export async function setMusic(on,chapter=0){
  musicChapter=chapter;
  if(!on){const old=music;music=null;retire(old);return;}
  if(!audio)return;
  const info=musicForChapter(chapter);
  if(music?.info===info){if(music.element.paused&&!document.hidden)music.element.play().catch(()=>{});return;}
  const old=music,element=new Audio(new URL(`./music/${info.file}.mp3`,import.meta.url));
  element.preload='auto';element.loop=true;
  const m={info,element,out:audio.createGain(),source:audio.createMediaElementSource(element)};
  m.out.gain.value=0;m.source.connect(m.out).connect(destination());voices.add(m);music=m;musicError=null;
  try{await element.play();}catch(error){
    if(music===m){musicError=`Could not play ${info.title}`;music=null;}
    retire(m);retire(old);return;
  }
  if(music!==m){retire(m);retire(old);return;}
  if(document.hidden)element.pause();
  m.out.gain.setTargetAtTime(VOLUME*volumes.music,audio.currentTime,.7);retire(old);
}
