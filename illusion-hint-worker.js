// Plans hints off the main thread: the shortest way to the goal from where the player is now,
// counting the frames they already have up.
import {analyse,solve} from './illusion-solver.mjs';
import {linesUp,sightClear,seamWithin,stoneHidden,SEEN} from './illusion-geometry.js';
import {photographedEyes,eyePose} from './illusion-photo-mechanisms.js';
import {pointInPolygon} from './frame-gesture.js';
import {levelRevision} from './illusion-checkpoints.js';
const ALIGN=SEEN;
let cached=null;
// A frame the player made, as the solver sees it: in every state of the beams, the seams that line
// up along its direction, can be seen, and sit inside it on screen (the same test the game uses).
function frameClass({configs},f,L){
  const m=f.viewProjection,inside=([x,y,z])=>{
    const w=m[3]*x+m[7]*y+m[11]*z+m[15];if(w<=0)return false;
    const px=(m[0]*x+m[4]*y+m[8]*z+m[12])/w,py=(m[1]*x+m[5]*y+m[9]*z+m[13])/w;
    return pointInPolygon(f.poly,{x:(px+1)/2*f.w,y:(1-py)/2*f.h});
  };
  return {dir:f.dir,tags:'',points:[],heldOnly:!!L.eyes?.length,links:configs.map(c=>c.seams.filter(s=>linesUp(s,f.dir,ALIGN)&&sightClear(s,f.dir,c.cells)&&seamWithin(s,inside))),
    vanish:configs.map(c=>(L.shy??[]).reduce((mask,b,i)=>!(c.mask>>i&1)&&inside(b)&&stoneHidden(c.cells,b,f.dir)?mask|1<<i:mask,0)),
    fire:configs.map(c=>photographedEyes(L,c.ks,f.dir,c.cells,inside)),eyePoints:configs.map(c=>(L.eyes??[]).map(e=>eyePose(L,c.ks,e).point))};
}
onmessage=({data:{id,key,L,ks,walker,frames}})=>{
  const revision=[L.name,levelRevision(L),L.palette,L.theme??''].join('|');
  if(cached?.revision!==revision)cached={revision,analysis:analyse(L,true)};
  const a=cached.analysis,own=frames.map(f=>frameClass(a,f,L));
  const analysis={...a,classes:[...a.classes,...own]};
  // The stones each photo hid, as the solver's bit masks.
  const masks=frames.map(f=>(L.shy??[]).reduce((m,b,i)=>f.vanished?.includes(b.slice(0,3).join())?m|1<<i:m,0));
  const r=solve(L,{analysis,from:{ks,walker,frames:own.map((_,i)=>a.classes.length+i),masks},maxStates:300000});
  postMessage({id,key,moves:r.steps.length,step:r.steps[0]??null});
};
