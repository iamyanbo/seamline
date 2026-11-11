import {tilesIn,seamsIn,seamEdges,misalignAlong,sightClear,terrainSightClear,sightBlockers,SEEN} from './illusion-geometry.js';

// Shared crossings survive removing one of their photographs. Explain ownership using
// the live links, including stones that another photograph also keeps hidden.
export function photoDependents(frames,photo){
  const others=frames.filter(f=>f!==photo),kept=new Set(others.flatMap(f=>f.links.map(p=>p.id))),hiddenElsewhere=new Set(others.flatMap(f=>[...(f.vanished??[])]));
  const links=[...new Map(photo.links.map(p=>[p.id,p])).values()],hidden=[...(photo.vanished??[])];
  return {links,exclusive:links.filter(p=>!kept.has(p.id)),hidden,exclusiveHidden:hidden.filter(k=>!hiddenElsewhere.has(k))};
}

// Inspect only edges inside the player's attempted photo. This explains their attempt;
// it does not ask the solver for the answer or change the connection rules.
export function diagnoseConnection(cells,dir,inside){
  const actual=seamsIn(cells),visible=s=>inside(s.ea.mid)&&inside(s.eb.mid);
  const near=actual.filter(visible).map(s=>({s,off:misalignAlong(s,dir)})).filter(x=>x.off<.8).sort((a,b)=>a.off-b.off);
  for(const {s,off} of near)if(off<SEEN&&!sightClear(s,dir,cells))return {kind:'blocked',edges:seamEdges(s),blocks:sightBlockers(s,dir,cells)};
  // Open the rails in a diagnostic copy. A matching edge removed by the real rail is closed.
  const bare=new Map([...cells].map(([k,c])=>[k,c.shape==='rail'?{...c,shape:'cube'}:c]));
  const ids=new Set(actual.map(s=>s.id));
  const rail=seamsIn(bare).filter(s=>!ids.has(s.id)&&visible(s)&&misalignAlong(s,dir)<.16&&terrainSightClear(s,dir,cells))
    .sort((a,b)=>misalignAlong(a,dir)-misalignAlong(b,dir))[0];
  if(rail){const tiles=tilesIn(cells),closed=[rail.ea,rail.eb].map((e,i)=>tiles.get(e.tile)?.edges.some(real=>real.mid.every((v,j)=>Math.abs(v-e.mid[j])<1e-8))?-1:i).filter(i=>i>=0);return {kind:'rail',edges:seamEdges(rail),closed,blocks:[]};}
  const miss=near.find(x=>x.off>=SEEN&&sightClear(x.s,dir,cells));
  return miss?{kind:'offset',edges:seamEdges(miss.s),blocks:[]} : null;
}
