// Seam geometry shared by the game, solver and tests. Points are [x,y,z] arrays;
// a world is a Map of "x,y,z" keys to pieces {x,y,z,shape,s,mover}, with level metadata.
// Rail visibility uses the same Three.js geometry builders as the renderer, without a DOM.
//
// Pieces: a cube [x,y,z]; a walkway [x,y,z,'rail',dx,dz], a cube with low rails on the two sides
// across (dx,dz), so it can only be stepped on or off at its two ends; a stair [x,y,z,'stair',dx,dz]
// that climbs one level towards (dx,dz), from the top of the cube below-behind it to the top of the
// cube level-ahead (its sides are closed too); a column [x,y,z,'column'] (round, not walkable, but it
// blocks the view); a wall block [x,y,z,'wall',ux,uy,uz], a cube whose walkable face is the side facing
// (ux,uy,uz) instead of its top. Gravity there points into that face: the traveller walks on it standing
// sideways (or upside down), and steps onto it from a floor at an inside corner.
//
// Every walkable surface (a cube, walkway or stair with nothing on top) has open sides, its edges. Two edges that meet in space
// are a real step. Two edges that meet on screen are a seam: from the right spot the two surfaces look
// joined, and a frame made there makes the join real. Any two edges count, whatever beams they belong
// to, so whatever looks joined can be joined.
//
// The view is flat (orthographic), as in Monument Valley: things far away look as big as things up
// close, so two edges that line up match exactly in size and the join is seamless. A view is just a
// direction v (a unit vector pointing from the world toward the viewer); how far away you are
// changes nothing. A seam lines up when you look along the line through its two edges.

import {decorativeBlockers} from './illusion-rails.js';
import {sheetHitsBox,sheetHitsCylinder} from './illusion-visibility.js';
export const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
const AXES=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]],UP=[0,1,0];
export const MIN_PITCH=12, MAX_PITCH=90;
// Snapping can help a nearby view, but only coincident edges create a connection.
// SEEN is a floating-point epsilon in tile widths, not a visible gap allowance.
export const SEEN=.00001, SNAP_WINDOW=.12;
// Numerical slack at the camera limits, using the same exact-join epsilon.
export const SNUG=SEEN;
export const key=(x,y,z)=>`${x},${y},${z}`;
export const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
export const scale=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];
export const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const len=a=>Math.hypot(...a);
export const norm=a=>scale(a,1/(len(a)||1));
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const same=(a,b)=>a[0]===b[0]&&a[1]===b[1]&&a[2]===b[2];
const spot=p=>p.map(v=>v.toFixed(2)).join();

// A level entry as a piece.
export function pieceOf(e,mover=-1){
  const [x,y,z,shape='cube',dx=0,dz=0]=e;
  return {x,y,z,shape,s:shape==='stair'||shape==='rail'?[dx,dz]:null,end:shape==='rail'&&e[6]==='end',turn:shape==='rail'&&e[6]==='turn'?e.slice(7,9):null,up:shape==='wall'?e.slice(4,7):UP,mover};
}

// ---------- Walkable surfaces and their edges ----------
// Each edge knows its middle, half its length, which way it faces, which way is up on its surface, the
// cell a level neighbour would fill (front), and a point on the surface just inside it (inside) for
// line-of-sight checks.
function edgeOf(tile,up,d,mid,front,inside){return {tile,up,d,mid,half:scale(cross(up,d),.5),front,inside};}
export function tilesIn(cells){
  const tiles=new Map();
  for(const c of cells.values()){
    const u=c.up??UP,p=[c.x,c.y,c.z];
    if(c.shape==='column'||cells.has(key(...add(p,u))))continue;
    const k=key(c.x,c.y,c.z),t={k,x:c.x,y:c.y,z:c.z,up:u,mover:c.mover,shape:c.shape,edges:[]};
    if(c.shape==='stair'){
      const [sx,sz]=c.s;
      t.surface=[c.x,c.y+.25,c.z];
      t.edges.push(edgeOf(k,u,[sx,0,sz],[c.x+sx*.5,c.y+.5,c.z+sz*.5],key(c.x+sx,c.y,c.z+sz),[c.x+sx*.35,c.y+.52,c.z+sz*.35]));
      t.edges.push(edgeOf(k,u,[-sx,0,-sz],[c.x-sx*.5,c.y-.5,c.z-sz*.5],key(c.x-sx,c.y-1,c.z-sz),[c.x-sx*.35,c.y-.23,c.z-sz*.35]));
    }else{
      // The face toward up, and an edge each way across it (a walkway's only along its length).
      t.surface=add(p,scale(u,.5));
      for(const d of c.shape==='rail'?(c.end?[[c.s[0],0,c.s[1]]]:[[c.s[0],0,c.s[1]],c.turn?[c.turn[0],0,c.turn[1]]:[-c.s[0],0,-c.s[1]]]):AXES.filter(d=>dot(d,u)===0))
        t.edges.push(edgeOf(k,u,d,add(t.surface,scale(d,.5)),key(...add(p,d)),add(add(p,scale(d,.4)),scale(u,.52))));
    }
    tiles.set(k,t);
  }
  return tiles;
}
// Real steps: two surfaces whose edges meet. Returns a Map from tile key to [{to, via}] where via is
// the shared edge's middle (stairs step through it). Edges meet when they face each other on surfaces
// with the same up, or at an inside corner: a floor running into a wall's walkable face, where each
// edge faces down the other surface (the traveller walks up the corner and gravity turns with them).
export function stepsIn(tiles){
  const at=new Map(),steps=new Map([...tiles.keys()].map(k=>[k,[]]));
  for(const t of tiles.values())for(const e of t.edges){const s=spot(e.mid);if(!at.has(s))at.set(s,[]);at.get(s).push(e);}
  for(const list of at.values())for(const a of list)for(const b of list)
    if(a.tile!==b.tile&&(same(a.up,b.up)&&dot(a.d,b.d)===-1||same(a.d,scale(b.up,-1))&&same(b.d,scale(a.up,-1))))steps.get(a.tile).push({to:b.tile,via:a.mid});
  return steps;
}
// Open edges: nothing meets them, and the space in front is empty.
function openEdges(cells,tiles){
  const at=new Map();
  for(const t of tiles.values())for(const e of t.edges){const s=spot(e.mid);at.set(s,(at.get(s)??0)+1);}
  const out=[];
  for(const t of tiles.values())for(const e of t.edges)if(at.get(spot(e.mid))===1&&!cells.has(e.front))out.push(e);
  return out;
}

// ---------- Seams ----------
// Two open edges that face each other, the second not behind the first, that line up from some view
// you can reach (between MIN_PITCH and MAX_PITCH above the horizon). The top view reaches 90 degrees;
// there is no visible allowance for a direction outside the camera's range.
export function seamsIn(cells,tiles=tilesIn(cells)){
  const opens=openEdges(cells,tiles),seams=[];
  for(let i=0;i<opens.length;i++)for(let j=i+1;j<opens.length;j++){
    const ea=opens[i],eb=opens[j];
    if(ea.tile===eb.tile||dot(ea.d,eb.d)!==-1||!same(ea.up,eb.up))continue;
    const gap=sub(eb.mid,ea.mid);
    if(dot(gap,ea.d)<-1e-9||len(gap)<1e-6)continue;
    const seam={a:ea.tile.split(',').map(Number),b:eb.tile.split(',').map(Number),d:ea.d,ea,eb,id:`${ea.tile}>${eb.tile}@${spot(ea.mid)}`};
    const p=pitchOf(seamLine(seam).u);
    if(p>=MIN_PITCH&&p<=MAX_PITCH||linesUp(seam,reachable(seamLine(seam).u),SNUG))seams.push(seam);
  }
  return seams;
}
// The two edges of a seam, each as [middle, half-length offset].
export function seamEdges(seam){return [[seam.ea.mid,seam.ea.half],[seam.eb.mid,seam.eb.half]];}
// A dot or a cropped corner is not a photographed crossing: keep both complete edges in the print.
export function seamWithin(seam,inside){
  return [seam.ea,seam.eb].every(e=>inside(add(e.mid,e.half))&&inside(sub(e.mid,e.half))&&inside(e.inside));
}
// The seam's line: through both edge middles, pointing up toward the viewer (u). Looking along u
// puts one edge exactly on the other.
export function seamLine(seam){
  const fa=seam.ea.mid,fb=seam.eb.mid;let u=norm(sub(fa,fb)),origin=fa;
  if(u[1]<0){u=scale(u,-1);origin=fb;}
  return {origin,u,gap:len(sub(fa,fb))};
}
// The view you can reach that is nearest to direction v: the same way round, with the pitch kept in range.
export function reachable(v){
  const p=Math.max(MIN_PITCH,Math.min(MAX_PITCH,pitchOf(v)))*Math.PI/180,h=Math.hypot(v[0],v[2]);
  const yaw=h<1e-9?0:Math.atan2(v[0],v[2]);
  return [Math.sin(yaw)*Math.cos(p),Math.sin(p),Math.cos(yaw)*Math.cos(p)];
}
export const pitchOf=v=>Math.asin(Math.max(-1,Math.min(1,v[1])))*180/Math.PI;
export const angleBetween=(a,b)=>Math.acos(Math.max(-1,Math.min(1,dot(norm(a),norm(b)))))*180/Math.PI;
// How far a view direction is from a seam's line, in degrees.
export function offLine(seam,v){return angleBetween((seam.line??=seamLine(seam)).u,v);}
// How far apart the two edges look along view direction v, in edge lengths. In a flat view both
// edges are drawn the same size, so the only error is the part of the gap that runs across the view.
export function misalignAlong(seam,v){
  const {u}=seam.line??=seamLine(seam),direction=norm(v);
  // A cross product avoids subtracting nearly equal numbers at an exact alignment.
  return dot(u,direction)<=0?Infinity:len(cross(sub(seam.eb.mid,seam.ea.mid),direction));
}
export const linesUp=(seam,v,align)=>misalignAlong(seam,v)<align;
// The one direction that lines up two seams best: on the arc between their lines, nearer the seam
// with the longer gap (its tolerance is tighter). off is the worse of the two misalignments there.
export function bothAlong(s1,s2){
  const u1=(s1.line??=seamLine(s1)).u,u2=(s2.line??=seamLine(s2)).u,g1=s1.line.gap,g2=s2.line.gap;
  const a=Math.acos(Math.max(-1,Math.min(1,dot(u1,u2))));
  if(a<1e-6)return {dir:u1,off:0,angle:0};
  const t=g2/(g1+g2),k1=Math.sin((1-t)*a)/Math.sin(a),k2=Math.sin(t*a)/Math.sin(a),dir=norm(add(scale(u1,k1),scale(u2,k2)));
  return {dir,off:Math.max(misalignAlong(s1,dir),misalignAlong(s2,dir)),angle:a*180/Math.PI};
}
// A view direction from yaw and pitch (radians), as the game's camera uses them.
export const dirOf=(yaw,pitch)=>[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)];

// ---------- Line of sight ----------
// The solid parts of a piece: boxes as [centre, half sizes], and columns as upright cylinders.
export function solidsOf(c){
  if(c.shape==='stair'){
    const [sx,sz]=c.s;
    // Rendering and occlusion use the same four treads; oversized collision halves hid visible joins.
    return [0,1,2,3].map(i=>{const h=(i+1)*.25,o=-.375+i*.25;return {box:[[c.x+sx*o,c.y-.5+h/2,c.z+sz*o],[sx?.125:.5,h/2,sz?.125:.5]]};});
  }
  if(c.shape==='column')return [{cyl:[c.x,c.z,.38,c.y-.5,c.y+.5]}];
  return [{box:[[c.x,c.y,c.z],[.5,.5,.5]]}];
}
function segmentHitsBox(p,q,[c,h]){
  let lo=0,hi=1;
  for(let i=0;i<3;i++){
    const d=q[i]-p[i],min=c[i]-h[i],max=c[i]+h[i];
    if(Math.abs(d)<1e-9){if(p[i]<=min||p[i]>=max)return false;continue;}
    let t0=(min-p[i])/d,t1=(max-p[i])/d;if(t0>t1)[t0,t1]=[t1,t0];
    lo=Math.max(lo,t0);hi=Math.min(hi,t1);if(hi-lo<1e-6)return false;
  }
  return true;
}
function segmentHitsCylinder(p,q,[cx,cz,r,y0,y1]){
  const dx=q[0]-p[0],dz=q[2]-p[2],fx=p[0]-cx,fz=p[2]-cz,a=dx*dx+dz*dz,b=2*(fx*dx+fz*dz),c=fx*fx+fz*fz-r*r;
  let lo=0,hi=1;
  if(a<1e-12){if(c>0)return false;}
  else{const disc=b*b-4*a*c;if(disc<=0)return false;const s=Math.sqrt(disc);lo=Math.max(lo,(-b-s)/(2*a));hi=Math.min(hi,(-b+s)/(2*a));}
  const dy=q[1]-p[1];
  if(Math.abs(dy)<1e-9){if(p[1]<=y0||p[1]>=y1)return false;}
  else{let t0=(y0-p[1])/dy,t1=(y1-p[1])/dy;if(t0>t1)[t0,t1]=[t1,t0];lo=Math.max(lo,t0);hi=Math.min(hi,t1);}
  return hi-lo>1e-6;
}
const hits=(p,q,s)=>s.box?segmentHitsBox(p,q,s.box):segmentHitsCylinder(p,q,s.cyl);
// Clip the complete edge's ray sheet against a solid. Sampling three rays can miss a
// block covering only a corner, or a thin obstruction between those rays.
function edgeBlocked(seam,v,solids){
  for(const e of [seam.ea,seam.eb]){
    if(!e.mid)continue;
    const mid=add(e.mid,scale(e.up,1e-6));
    for(const s of solids){
      if(s.box&&sheetHitsBox(mid,e.half,v,s.box))return true;
      if(s.cyl&&sheetHitsCylinder(mid,e.half,v,s.cyl))return true;
    }
  }
  return false;
}
// Can both edges of a seam be seen, looking along v? Rays run from points on each surface just inside
// its edge out toward the viewer; anything solid in the way (the two surfaces' own pieces too: a far
// surface can hide behind its partner) blocks the view.
function seamTargets(seam){
  const targets=[];
  for(const e of [seam.ea,seam.eb])for(const k of [-.6,0,.6])targets.push(add(e.inside,scale(e.half,k)));
  return targets;
}
export function terrainSightClear(seam,v,cells){
  const targets=seamTargets(seam);
  for(const c of cells.values()){
    const solids=solidsOf(c);if(edgeBlocked(seam,v,solids))return false;
    for(const s of solids)for(const t of targets)if(hits(t,add(t,scale(v,80)),s))return false;
  }
  return true;
}
const sightCache=new WeakMap();
export function sightClear(seam,v,cells){
  let cache=sightCache.get(cells);if(!cache){cache=new Map();sightCache.set(cells,cache);}
  const id=seam.id&&seam.id+'|'+v.join();if(id&&cache.has(id))return cache.get(id);
  const clear=terrainSightClear(seam,v,cells)&&!decorativeBlockers([seam.ea,seam.eb].map(e=>({mid:add(e.mid,scale(e.up,1e-6)),half:seam.ea.half})),v,cells).length;
  if(id){if(cache.size>=1024)cache.clear();cache.set(id,clear);}return clear;
}
// Diagnostics use the very same solid/ray tests as acceptance, so the highlighted obstruction
// is a real cause. Keep this separate from the fast boolean path used by the solver.
export function sightBlockers(seam,v,cells){
  const targets=seamTargets(seam);
  const decor=new Set(decorativeBlockers([seam.ea,seam.eb].map(e=>({mid:add(e.mid,scale(e.up,1e-6)),half:seam.ea.half})),v,cells));
  return [...cells.values()].filter(c=>decor.has(key(c.x,c.y,c.z))||edgeBlocked(seam,v,solidsOf(c))||solidsOf(c).some(s=>targets.some(t=>hits(t,add(t,scale(v,80)),s)))).map(c=>[c.x,c.y,c.z]);
}
// Whether extra solids (decoration, not part of the world) stay out of a seam's line of sight along v.
export function sightClearOf(seam,v,solids){
  const targets=seamTargets(seam);
  return !edgeBlocked(seam,v,solids)&&!solids.some(s=>targets.some(t=>hits(t,add(t,scale(v,80)),s)));
}

// ---------- Moving beams ----------
// A mover turns about a vertical axis through its pivot by `angle` degrees per press. With 2 positions
// a press flips it between home and turned; with more it keeps turning the same way (4 = a full circle).
export function turned([x,y,z,...rest],[px,,pz],deg){
  const a=deg*Math.PI/180,c=Math.round(Math.cos(a)),s=Math.round(Math.sin(a)),dx=x-px,dz=z-pz;
  const out=[px+dx*c+dz*s,y,pz-dx*s+dz*c];
  if(rest[0]==='stair'||rest[0]==='rail')return [...out,rest[0],rest[1]*c+rest[2]*s,-rest[1]*s+rest[2]*c,...(rest[3]==='turn'?['turn',rest[4]*c+rest[5]*s,-rest[4]*s+rest[5]*c]:rest.slice(3))];
  if(rest[0]==='wall')return [...out,'wall',rest[1]*c+rest[3]*s,rest[2],-rest[1]*s+rest[3]*c];
  return [...out,...rest];
}
export const positionsOf=m=>m.positions??2;
export const nextPosition=(m,k)=>positionsOf(m)===2?1-k:(k+1)%positionsOf(m);
// A lift/shuttle keeps its orientation and translates one travel vector per stop.
// This is shared by rendering, riding, switches, visibility and the solver.
export const movedPoint=(m,k,p)=>m.travel?[...p.slice(0,3).map((v,i)=>v+m.travel[i]*k),...p.slice(3)]:turned(p,m.pivot,(m.angle??0)*k);
export const moverBlocks=(m,k)=>m.blocks.map(b=>movedPoint(m,k,b));
const at3=b=>b.slice(0,3).join();
// All the pieces of a level with each mover at position ks[i]. ok is false if two pieces overlap.
export function levelCells(L,ks){
  const cells=new Map();cells.level=L;let ok=true;
  for(const e of L.blocks){const c=pieceOf(e);cells.set(key(c.x,c.y,c.z),c);}
  (L.movers??[]).forEach((m,i)=>{for(const e of moverBlocks(m,ks[i])){const c=pieceOf(e,i),k=key(c.x,c.y,c.z);if(cells.has(k))ok=false;cells.set(k,c);}});
  return {cells,ok};
}
// The world with shy stones too: L.shy are plain stones, except the ones in gone (photos made them vanish).
// A stone where a beam is makes the world impossible (ok false), as two beams crossing do.
export function worldCells(L,ks,gone=new Set()){
  const r=levelCells(L,ks);
  for(const b of L.shy??[]){const k=key(...b);if(gone.has(k))continue;if(r.cells.has(k))r.ok=false;const c=pieceOf(b);c.shy=true;r.cells.set(k,c);}
  return r;
}
// Whether a point is out of sight from view v: the line from it toward the viewer runs into a block.
export function hiddenAlong(cells,p,v,skip){
  for(let t=.55;t<40;t+=.1){const k=key(Math.round(p[0]+v[0]*t),Math.round(p[1]+v[1]*t),Math.round(p[2]+v[2]*t));if(k!==skip&&cells.has(k))return true;}
  return false;
}
// A shy stone vanishes in a photo that cannot see any of it: its middle and every corner are hidden.
export function stoneHidden(cells,b,v){
  const k=key(...b),pts=[b];
  for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])pts.push([b[0]+x*.42,b[1]+y*.42,b[2]+z*.42]);
  return pts.every(p=>hiddenAlong(cells,p,v,k));
}
// Where a mover's switch plate is now. A plate can sit on a moving beam (its own or another) and ride along.
export function plateOf(L,ks,i){
  if(!L.movers[i].trigger)return null;
  const t=L.movers[i].trigger.slice(0,3),j=L.movers.findIndex(m=>m.blocks.some(b=>at3(b)===t.join()));
  return j<0?t:movedPoint(L.movers[j],ks[j],t).slice(0,3);
}
// Linked pads move a small group atomically. Collision checks consider the whole
// destination, so two linked platforms may vacate each other's old spaces.
export function actuation(L,ks,indices,cells=worldCells(L,ks).cells){
  const ids=[...new Set(Array.isArray(indices)?indices:[indices])];
  for(let j=0;j<ids.length;j++)for(const i of L.movers[ids[j]]?.linked??[])if(!ids.includes(i))ids.push(i);
  const next=ks.slice(),out=new Map();out.level=L;let ok=true;
  for(const [k,c] of cells)if(!ids.includes(c.mover))out.set(k,c);
  for(const i of ids){
    const m=L.movers[i];if(!m){ok=false;continue;}next[i]=nextPosition(m,ks[i]);
    for(const b of moverBlocks(m,next[i])){const c=pieceOf(b,i),k=key(c.x,c.y,c.z);if(out.has(k))ok=false;out.set(k,c);}
  }
  return {ids,ks:next,cells:out,ok};
}
// A spot after mover i goes from position k to k2: pieces on that mover ride along, others stay.
export function riding(L,i,k,k2,place){
  const m=L.movers[i],idx=moverBlocks(m,k).findIndex(b=>at3(b)===place.join());
  return idx<0?place:moverBlocks(m,k2)[idx].slice(0,3);
}
// The same world with one moving beam at other positions (for seams that will exist).
export function swungCells(cells,mover,blocks){
  const out=new Map();out.level=cells.level;
  for(const [k,c] of cells)if(c.mover!==mover.i)out.set(k,c);
  for(const e of blocks){const c=pieceOf(e,mover.i);out.set(key(c.x,c.y,c.z),c);}
  return out;
}
