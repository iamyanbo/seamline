// Finds the shortest solution to an illusion level, and any dead ends, for designing levels and for tests.
//
// The player's moves are: place a frame, remove a frame, or send the walker somewhere it can reach
// (along real steps and through joins). Sending it onto a switch plate turns that plate's beam;
// anything standing on a turning beam rides along. The view is flat, so a frame is modelled by the
// direction it was made looking along: it joins every seam that lines up, unblocked, along that
// direction, in whatever state the world is in. The whole world fits on screen at once, so a frame
// may as well take in everything (joining more never hurts). Every pair of facing edges is a seam, so
// a frame joins everything that looks joined, as in the game. Candidate directions are every seam's
// line plus the best direction for every pair of seams, in every state the movers can reach, so
// frames made ahead of time or serving two states are found too.
//
// Shy stones (L.shy) vanish in a photo that cannot see them, for as long as that photo is up. So the
// world is the beams' positions plus which stones are gone (a bit mask, one bit per stone), and each
// frame remembers the stones it hid when it was taken. A frame direction that hides stones comes in
// two kinds: taking them in (they vanish) or leaving them out of the box (they stay). A photo can't be
// dropped while a stone would come back where the traveller is or where a beam now is.
//
//   node illusion-solver.mjs [level number]      prints the shortest solution and any dead ends
import {SEEN,reachable,key,worldCells,stoneHidden,dirOf,seamsIn,seamLine,seamEdges,sightClear,bothAlong,linesUp,pitchOf,MIN_PITCH,MAX_PITCH,positionsOf,nextPosition,levelCells,plateOf,riding,tilesIn,stepsIn,actuation} from './illusion-geometry.js';
import {eyePose,eyeBounds,photographedEyes,photoBox,boxContains,boxCorners,seamPhotoPoints} from './illusion-photo-mechanisms.js';

// The planner and the game use the same exact-join epsilon. Camera assistance never grants a link.
const SURE=SEEN;

export function analyse(L,dense=false,align=SURE){
  const movers=L.movers??[],sizes=movers.map(positionsOf),configs=[],index=new Map(),shy=L.shy??[];
  const walk=(i,ks)=>{
    if(i===sizes.length){for(let mask=0;mask<1<<shy.length;mask++){index.set(ks.join()+'/'+mask,configs.length);configs.push({ks,mask,i:configs.length});}return;}
    for(let k=0;k<sizes[i];k++)walk(i+1,[...ks,k]);
  };
  walk(0,[]);
  for(const c of configs){
    const gone=new Set(shy.filter((_,b)=>c.mask>>b&1).map(b=>key(...b)));
    const {cells,ok}=worldCells(L,c.ks,gone),tiles=tilesIn(cells);Object.assign(c,{cells,ok,tiles});
    c.adj=new Map([...stepsIn(tiles)].map(([k,v])=>[k,v.map(s=>s.to)]));
    c.seams=ok?seamsIn(cells,tiles):[];
    c.plates=movers.map((m,i)=>{const p=plateOf(L,c.ks,i);return p?key(...p):null;});
  }
  // Candidate directions: along each seam, and the best direction for each pair that can share one.
  const lines=new Map();for(const c of configs)for(const s of c.seams)lines.set(s.id,s);
  // A direction out of reach is replaced by the nearest one in reach.
  const all=[...lines.values()],dirs=all.map(s=>reachable(seamLine(s).u));
  for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
    const b=bothAlong(all[i],all[j]);if(b.angle>0&&b.angle<30&&b.off<align)dirs.push(reachable(b.dir));
  }
  // Views for hiding shy stones: all around, at many heights.
  if(shy.length)for(let y=0;y<360;y+=15)for(const p of [14,22,30,40,50,60,70,80,88])dirs.push(dirOf(y*Math.PI/180,p*Math.PI/180));
  if(L.eyes?.length)for(const c of configs)for(const eye of L.eyes){
    const f=eyePose(L,c.ks,eye).face,yaw=Math.atan2(f[0],f[2]);
    for(const offset of [-Math.PI/4,0,Math.PI/4])for(const pitch of [20,35,55])dirs.push(dirOf(yaw+offset,pitch*Math.PI/180));
  }
  // Group directions that join the same seams in every state.
  const classes=new Map();
  for(const dir of dirs){
    const p=pitchOf(dir);if(p<MIN_PITCH-1e-6||p>MAX_PITCH+1e-6)continue;
    const lined=new Set(all.filter(s=>linesUp(s,dir,align)).map(s=>s.id));
    const links=configs.map(c=>c.seams.filter(s=>lined.has(s.id)&&sightClear(s,dir,c.cells)));
    // The stones (there in that world) this view cannot see.
    // A stone counts as hidden only if it stays hidden a few degrees either way, as a player is never exactly on a view.
    const yw=Math.atan2(dir[0],dir[2]),pt=Math.asin(dir[1]),D=3*Math.PI/180,lo=MIN_PITCH*Math.PI/180,hi=MAX_PITCH*Math.PI/180;
    const near=[dir,dirOf(yw+D,pt),dirOf(yw-D,pt),dirOf(yw,Math.min(hi,pt+D)),dirOf(yw,Math.max(lo,pt-D))];
    const hides=configs.map(c=>shy.reduce((m,b,i)=>c.mask>>i&1||!near.every(v=>stoneHidden(c.cells,b,v))?m:m|1<<i,0));
    const joins=links.some(l=>l.length),hiding=hides.some(m=>m);
    if(L.eyes?.length){
      // Cropping matters around an orb: including one can turn a bridge. Enumerate
      // useful rectangular crops, then keep only distinct physical outcomes.
      const boxes=new Map(),poses=configs.map(c=>L.eyes.map(e=>eyePose(L,c.ks,e).point));
      const put=points=>{const b=photoBox(points,dir);if(b)boxes.set(b.map(v=>v.toFixed(5)).join(),b);};
      put([...links.flat().flatMap(seamPhotoPoints),...poses.flat().flatMap(eyeBounds),...shy]);
      for(const [ci,ss] of links.entries()){
        const ends=ss.flatMap(seamPhotoPoints);put(ends);
        for(const s of ss)put(seamPhotoPoints(s));
        for(const point of poses[ci]){put(eyeBounds(point));put([...ends,...eyeBounds(point)]);}
      }
      for(const box of boxes.values()){
        const inside=boxContains(box,dir),cut=links.map(ss=>ss.filter(s=>seamPhotoPoints(s).every(inside))),vanish=hides.map(mask=>shy.reduce((m,b,i)=>mask>>i&1&&inside(b)?m|1<<i:m,0));
        const fire=configs.map(c=>photographedEyes(L,c.ks,dir,c.cells,inside));
        if(!cut.some(ss=>ss.length)&&!vanish.some(Boolean)&&!fire.some(Boolean))continue;
        const sig=cut.map(ss=>ss.map(s=>s.id).join('+')).join('|')+'#'+vanish.join()+'#'+fire.join();if(classes.has(sig))continue;
        const stones=shy.filter((_,i)=>vanish.some(m=>m>>i&1)).map(b=>b.slice(0,3));
        classes.set(sig,{dir,tags:fire.some(Boolean)?' [blink]':'',points:cut.flat().flatMap(seamPhotoPoints),stones,links:cut,vanish,fire,eyePoints:poses,cropCorners:boxCorners(box,dir)});
      }
      continue;
    }
    if(!joins&&!hiding)continue;
    // Tags for reading solutions: [pair] joins two seams at once; [shifts] joins different seams as the world changes.
    const sets=new Set(links.filter(l=>l.length).map(l=>l.map(s=>s.id).join('+')));
    const tags=(links.some(l=>l.length>1)?' [pair]':'')+(sets.size>1?' [shifts]':'');
    // The middle of every end edge this frame can join, so a test can draw a frame around them.
    const points=[...new Map(links.flat().map(s=>[s.id,seamEdges(s)[0][0]])).values()];
    const sig=links.map(l=>l.map(s=>s.id).join('+')).join('|');
    for(const takeIn of hiding?(joins?[true,false]:[true]):[false]){
      const vanish=takeIn?hides:configs.map(()=>0),stones=shy.filter((_,i)=>vanish.some(m=>m>>i&1)).map(b=>b.slice(0,3));
      const k=sig+'#'+vanish.join();if(classes.has(k))continue;
      classes.set(k,{dir,tags:tags+(takeIn?' [hides]':''),points:takeIn?[...points,...stones]:points,stones,links,vanish});
    }
  }
  return {configs,index,classes:[...classes.values()]};
}

const fmt=v=>`yaw ${Math.round(Math.atan2(v[0],v[2])*180/Math.PI)}° pitch ${Math.round(pitchOf(v))}°`;
// Everything the walker can reach in config ci with the given frames up.
function reachFrom(c,ci,classes,f,w){
  const adj=new Map([...c.adj].map(([k,v])=>[k,[...v]]));
  for(const fi of f)for(const sm of classes[fi].links[ci]){adj.get(sm.ea.tile)?.push(sm.eb.tile);adj.get(sm.eb.tile)?.push(sm.ea.tile);}
  const out=new Set([w]),q=[w];
  for(let i=0;i<q.length;i++)for(const n of adj.get(q[i])??[])if(!out.has(n)){out.add(n);q.push(n);}
  return out;
}
// Where the walker ends up after being sent to n: on a plate the beam turns (if it can) and may carry it.
function arrive(L,configs,index,ci,n){
  const c=configs[ci],i=c.plates.indexOf(n),to=n.split(',').map(Number);
  if(i<0)return {ci,w:n,kind:'walk'};
  const move=actuation(L,c.ks,i,c.cells),ks=move.ks,ci2=index.get(ks.join()+'/'+c.mask);
  if(!move.ok||!configs[ci2].ok)return {ci,w:n,kind:'stuck',i};
  const rider=move.ids.find(j=>c.cells.get(n)?.mover===j);
  return {ci:ci2,w:rider===undefined?n:key(...riding(L,rider,c.ks[rider],ks[rider],to)),kind:'press',i,k:ks[i]};
}

// What a frame step shows the player: which way to look, and every seam the frame joins in any state of
// the beams, each as its two edges ([middle, half-length offset]). The frame must take them all in.
// now marks the ones that line up already; soon means none do yet (it is made ahead of time).
function frameStep(classes,k,ci){
  const c=classes[k],now=c.links[ci],nowIds=new Set(now.map(x=>x.id)),all=new Map();
  for(const l of c.links)for(const x of l)all.set(x.id,x);
  return {type:'frame',k,world:ci,dir:c.dir,seams:c.points,stones:c.stones??[],hides:c.vanish?.[ci]??0,joins:now.length,ids:now.map(x=>x.id),here:now.map(x=>seamEdges(x)[0][0]),
    soon:!now.length,orbs:c.eyePoints?.[ci]?.filter((_,i)=>(c.fire?.[ci]??0)>>i&1)??[],cropCorners:c.cropCorners,
    edges:[...all.values()].map(x=>({a:[x.ea.mid,x.ea.half],b:[x.eb.mid,x.eb.half],now:nowIds.has(x.id)}))};
}
// A state: the world (config ci), the walker's tile w, the frames up (class indices f, oldest first)
// and the stones each of them hid (m). Every move from it, as [state, description, step]; reaching the
// goal is [null, ...].
const or=m=>m.reduce((a,b)=>a|b,0);
function movesFrom(L,{configs,index,classes},s,goal){
  const c=configs[s.ci],F=L.frames,shy=L.shy??[],out=[];
  const world=(m,ks=c.ks)=>configs[index.get(ks.join()+'/'+or(m))];
  // A world the walker can be in: nothing overlaps, and its tile is still a tile (no stone came back on it).
  const fine=w=>w.ok&&w.adj.has(s.w);
  // Replace the oldest removable photo. A photo holding a stone out of a moving
  // path's occupied space stays in its slot; the next safe slot is reused.
  for(let k=0;k<classes.length;k++){
    if(classes[k].heldOnly)continue;
    if(s.f.includes(k)&&!classes[k].fire?.some(Boolean))continue;
    const full=s.f.length>=F,replace=full?s.m.findIndex((_,j)=>fine(world(s.m.filter((_,i)=>i!==j)))):-1;
    if(full&&replace<0)continue;
    const f=s.f.filter((_,i)=>i!==replace),m=s.m.filter((_,i)=>i!==replace),before=world(m);
    if(!fine(before))continue;
    // The stones this photo hides, never the one the walker stands on.
    const hid=(classes[k].vanish?.[before.i]??0)&~shy.reduce((a,b,i)=>key(...b)===s.w?a|1<<i:a,0);
    const t={...s,f:[...f,k],m:[...m,hid]};t.ci=world(t.m).i;
    const fires=classes[k].fire?.[t.ci]??0;
    if(fires){
      const indices=(L.eyes??[]).flatMap((e,i)=>fires>>i&1?[e.beam]:[]),w=configs[t.ci],action=actuation(L,w.ks,indices,w.cells);
      if(action.ok){
        const rider=action.ids.find(i=>w.cells.get(t.w)?.mover===i);
        if(rider!==undefined)t.w=key(...riding(L,rider,w.ks[rider],action.ks[rider],t.w.split(',').map(Number)));
        t.ci=index.get(action.ks.join()+'/'+or(t.m));
      }
    }
    out.push([t,`frame looking along ${fmt(classes[k].dir)}${classes[k].tags}`,{type:'frame',k,ci:before.i}]);
  }
  s.f.forEach((k,j)=>{
    const m=s.m.filter((_,x)=>x!==j),after=world(m);if(!fine(after))return;
    out.push([{...s,ci:after.i,f:s.f.filter((_,x)=>x!==j),m},`remove frame ${fmt(classes[k].dir)}`,{type:'remove',dir:classes[k].dir}]);
  });
  for(const n of reachFrom(c,s.ci,classes,s.f,s.w)){
    if(n===s.w)continue;
    const to=n.split(',').map(Number);
    if(n===goal){out.push([null,`walk to goal ${n}`,{type:'walk',to}]);continue;}
    const r=arrive(L,configs,index,s.ci,n);
    if(r.kind==='walk')out.push([{...s,w:n},`walk to ${n}`,{type:'walk',to}]);
    else if(r.kind==='stuck')out.push([{...s,w:n},`walk to plate ${n} (beam ${r.i} is stuck)`,{type:'walk',to}]);
    else out.push([{...s,ci:r.ci,w:r.w},`press plate ${n}: beam ${r.i} to position ${r.k}${r.w!==n?' (rides to '+r.w+')':''}`,{type:'press',to,ends:r.w.split(',').map(Number)}]);
  }
  if(L.lessonFirst==='press'&&!s.f.length)out.sort((a,b)=>(b[2].type==='press')-(a[2].type==='press'));
  if(L.lessonFirst==='hide'&&!s.f.length){
    const hides=step=>step.type==='frame'&&!!classes[step.k].vanish?.[c.i];
    out.sort((a,b)=>Number(hides(b[2]))-Number(hides(a[2])));
  }
  return out;
}
const stateId=s=>`${s.ci}|${s.w}|${s.f.join(',')}|${s.m.join(',')}`;
function startOf(L,index,from){
  const f=from?.frames??[],m=from?.masks??f.map(()=>0);
  return {ci:index.get((from?.ks??(L.movers??[]).map(()=>0)).join()+'/'+or(m)),w:key(...(from?.walker??L.start)),f,m};
}
// from: {ks, walker, frames, masks} starts from a given state (beam positions, walker spot, the indices
// of the classes standing for the frames already up, oldest first, and the stones each hid), for hints.
export function solve(L,{maxStates=4e6,dense=false,align=SURE,analysis,from}={}){
  const a=analysis??analyse(L,dense,align),{index,classes}=a,goal=key(...L.goal);
  const start=startOf(L,index,from);
  const seen=new Map([[stateId(start),null]]);let layer=[start],depth=0;
  while(layer.length&&seen.size<maxStates){
    depth++;const next=[];
    for(const s of layer){
      for(const [t,move,step] of movesFrom(L,a,s,goal)){
        if(!t){
          const path=[move],steps=[step];
          for(let p=stateId(s);seen.get(p);p=seen.get(p).from){path.unshift(seen.get(p).move);steps.unshift(seen.get(p).step);}
          return {moves:depth,path,steps:steps.map(st=>st.type==='frame'?frameStep(classes,st.k,st.ci):st),states:seen.size,classes:classes.length};
        }
        const k=stateId(t);if(seen.has(k))continue;seen.set(k,{from:stateId(s),move,step});next.push(t);
      }
    }
    layer=next;
  }
  return {moves:Infinity,path:[],steps:[],states:seen.size,classes:classes.length};
}
// Dead ends with shy stones: the world depends on the frames too, so every state is explored.
function deadStates(L,a,maxStates=2e6){
  const goal=key(...L.goal),start=startOf(L,a.index),order=[start],ids=new Map([[stateId(start),0]]),back=[[]],wins=new Set();
  for(let i=0;i<order.length&&order.length<maxStates;i++){
    for(const [t] of movesFrom(L,a,order[i],goal)){
      if(!t){wins.add(i);continue;}
      const k=stateId(t);if(!ids.has(k)){ids.set(k,order.length);order.push(t);back.push([]);}
      back[ids.get(k)].push(i);
    }
  }
  const alive=new Set(wins),q=[...wins];
  for(let i=0;i<q.length;i++)for(const j of back[q[i]])if(!alive.has(j)){alive.add(j);q.push(j);}
  return {places:order.length,dead:order.filter((_,i)=>!alive.has(i)).map(s=>({ks:a.configs[s.ci].ks,walker:s.w,frames:s.f.length}))};
}

// Dead ends: places (beam positions + walker spot) the player can get to but never win from.
// Frames can always be taken down and put up elsewhere without moving anything, so whether a place
// is dead depends only on the beams and the walker, and what the walker can reach from a place is
// what it can reach with the best set of frames. Returns the dead places reachable from the start.
export function deadEnds(L,{dense=false,align=SURE,analysis}={}){
  if(L.shy?.length||L.eyes?.length)return deadStates(L,analysis??analyse(L,dense,align));
  const {configs,index,classes}=analysis??analyse(L,dense,align),goal=key(...L.goal);
  // Per config: for each walker spot, the union over frame sets of what it reaches.
  const reachCache=new Map();
  const reachable=(ci,w)=>{
    const k=ci+'|'+w;if(reachCache.has(k))return reachCache.get(k);
    const c=configs[ci];
    if(!c.comps){
      // Only frames that join something here matter, and frames that join the same seams are the same.
      // Every set of as many of those as the level allows (more frames never join less).
      const distinct=[],sigs=new Set();
      classes.forEach((cl,i)=>{const sig=cl.links[ci].map(s=>s.id).join('+');if(sig&&!sigs.has(sig)){sigs.add(sig);distinct.push(i);}});
      const F=Math.min(L.frames,distinct.length),sets=[];
      const pick=(from,cur)=>{if(cur.length===F){sets.push(cur);return;}for(let i=from;i<distinct.length;i++)pick(i+1,[...cur,distinct[i]]);};
      pick(0,[]);
      // For each frame set, the connected groups of tiles (union-find over the groups real steps make);
      // then for each tile, the union over sets, as bit masks.
      const tiles=[...c.adj.keys()],at=new Map(tiles.map((t,i)=>[t,i])),n=tiles.length,words=Math.ceil(n/32)||1;
      const find=(p,x)=>{while(p[x]!==x)x=p[x]=p[p[x]];return x;};
      const base=tiles.map((_,i)=>i);
      tiles.forEach((t,i)=>{for(const u of c.adj.get(t)){const a=find(base,i),b=find(base,at.get(u));if(a!==b)base[a]=b;}});
      const root=tiles.map((_,i)=>find(base,i));
      const acc=tiles.map((_,i)=>{const m=new Uint32Array(words);m[i>>5]|=1<<(i&31);return m;});
      const seenParts=new Set();
      for(const f of sets){
        const p=root.slice();
        for(const fi of f)for(const s of classes[fi].links[ci]){const a=at.get(s.ea.tile),b=at.get(s.eb.tile);if(a===undefined||b===undefined)continue;const x=find(p,root[a]),y=find(p,root[b]);if(x!==y)p[x]=y;}
        const r=tiles.map((_,i)=>find(p,root[i])),part=r.join();
        if(seenParts.has(part))continue;seenParts.add(part);
        const masks=new Map();
        r.forEach((g,i)=>{if(!masks.has(g))masks.set(g,new Uint32Array(words));masks.get(g)[i>>5]|=1<<(i&31);});
        r.forEach((g,i)=>{const m=masks.get(g);for(let wd=0;wd<words;wd++)acc[i][wd]|=m[wd];});
      }
      c.comps=new Map(tiles.map((t,i)=>[t,new Set(tiles.filter((_,j)=>acc[i][j>>5]>>>(j&31)&1))]));
    }
    const out=c.comps.get(w)??new Set([w]);reachCache.set(k,out);return out;
  };
  const start=index.get((L.movers??[]).map(()=>0).join()+'/0')+'|'+key(...L.start);
  const edges=new Map(),order=[start];edges.set(start,[]);
  const wins=new Set();
  for(let i=0;i<order.length;i++){
    const [ci,w]=[+order[i].split('|')[0],order[i].split('|')[1]];
    const R=reachable(ci,w);
    if(R.has(goal))wins.add(order[i]);
    for(const n of R){
      const r=arrive(L,configs,index,ci,n),t=r.ci+'|'+r.w;
      edges.get(order[i]).push(t);
      if(!edges.has(t)){edges.set(t,[]);order.push(t);}
    }
  }
  // Walk backwards from the winning places.
  const back=new Map(order.map(s=>[s,[]]));
  for(const [s,ts] of edges)for(const t of ts)back.get(t).push(s);
  const alive=new Set(wins),q=[...wins];
  for(let i=0;i<q.length;i++)for(const s of back.get(q[i]))if(!alive.has(s)){alive.add(s);q.push(s);}
  return {places:order.length,dead:order.filter(s=>!alive.has(s)).map(s=>{const [ci,w]=s.split('|');return {ks:configs[+ci].ks,walker:w};})};
}

if(typeof process!=='undefined'&&process.argv?.[1]&&import.meta.url.endsWith(process.argv[1].replace(/\\/g,'/').split('/').pop())){
  const {LEVELS}=await import('./illusion-levels.js');
  const {campaignOrder,campaignNumber}=await import('./illusion-campaign.js'),order=campaignOrder(LEVELS);
  const which=process.argv[2]?[order[Number(process.argv[2])-1]]:order;
  for(const i of which){
    const t=Date.now(),analysis=analyse(LEVELS[i],true),r=solve(LEVELS[i],{analysis}),lax=solve(LEVELS[i],{dense:true,align:SEEN}),d=deadEnds(LEVELS[i],{analysis});
    console.log(`\n${campaignNumber(order,i)}. ${LEVELS[i].title??LEVELS[i].name}: ${r.moves} moves (${lax.moves} at the game's exact tolerance; ${r.states} states, ${r.classes} frame directions, ${d.places} places, ${d.dead.length} dead ends, ${Date.now()-t} ms)`);
    r.path.forEach((p,j)=>console.log(`   ${j+1}. ${p}`));
    d.dead.slice(0,5).forEach(x=>console.log(`   dead end: beams ${x.ks} walker ${x.walker}`));
  }
}
