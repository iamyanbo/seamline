import * as THREE from './vendor/three.module.js';
import {THEMES} from './illusion-themes.js';
import {MORE} from './illusion-themes-more.js';
import {LIFT_THEMES} from './illusion-themes-lifts.js';
import {softBox,arcadeSpan} from './illusion-art.js';
import {sheetHitsBox,sheetTriangleInterval} from './illusion-visibility.js';
const themes={...THEMES,...MORE,...LIFT_THEMES},names=['castle','kyoto','desert','venice','stars',null,'beach','santorini','lantern','ice','snow','glow','cloud','space'];
export const railTheme=L=>themes[L.theme??names[L.palette??5]];
const barGeometry=new THREE.CylinderGeometry(.035,.035,1.02,20),postGeometry=new THREE.CylinderGeometry(.03,.035,.3,20),lampGeometry=softBox(.11,.1,.11,.012),plain=new THREE.MeshBasicMaterial();
for(const g of [barGeometry,postGeometry,lampGeometry])g.userData.artShared=true;
const at=c=>`${c.x},${c.y},${c.z}`;

// The renderer and visibility rules build the same rail geometry, including themed parapets.
export function railMeshes(c,L,around,{rail=plain,cap=plain,lamp=plain,glow=null,themed=true}={}){
 const out=[],theme=railTheme(L);if(c.shape!=='rail')return out;
 const k=at(c),busy=L.goal?.join()===k||(L.movers??[]).some(m=>m.trigger?.slice(0,3).join()===k);
 let closed=false;
 if(!c.turn&&themed&&c.mover<0&&theme?.walkway&&!busy){out.push(...theme.walkway({...c,gate:L.composition?.gates?.some(p=>p.join()===k)},cap,around));closed=!theme.walkwayDecoration;}
 if(!c.turn&&!closed){
  const [ax,az]=c.s;
  for(const side of [-1,1]){
   const x=c.x+az*side*.42,z=c.z+ax*side*.42,bar=new THREE.Mesh(barGeometry,rail);bar.position.set(x,c.y+.8,z);if(ax)bar.rotation.z=Math.PI/2;else bar.rotation.x=Math.PI/2;out.push(bar);
   for(const e of [0,-1,1]){
    const n=e&&around?.get(`${c.x+ax*e},${c.y},${c.z+az*e}`);if(e&&n?.shape==='rail'&&n.s[0]===ax&&n.s[1]===az)continue;
    const post=new THREE.Mesh(postGeometry,rail);post.position.set(x+ax*e*.47,c.y+.65,z+az*e*.47);out.push(post);
    if(e&&lamp){const light=new THREE.Mesh(lampGeometry,lamp);light.position.set(x+ax*e*.47,c.y+.83,z+az*e*.47);out.push(light);if(glow){const halo=new THREE.Sprite(glow);halo.position.copy(light.position);halo.scale.setScalar(.32);out.push(halo);}}
   }
  }
 }
 if(c.end){
  const [ax,az]=c.s,x=c.x-ax*.42,z=c.z-az*.42,bar=new THREE.Mesh(barGeometry,rail);bar.position.set(x,c.y+.8,z);if(az)bar.rotation.z=Math.PI/2;else bar.rotation.x=Math.PI/2;out.push(bar);
  for(const side of [-1,1]){const post=new THREE.Mesh(postGeometry,rail);post.position.set(x+az*side*.42,c.y+.65,z+ax*side*.42);out.push(post);}
 }
 if(c.turn)for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
  if([c.s,c.turn].some(d=>d[0]===dx&&d[1]===dz))continue;
  const x=c.x+dx*.42,z=c.z+dz*.42,bar=new THREE.Mesh(barGeometry,rail);bar.position.set(x,c.y+.8,z);if(dz)bar.rotation.z=Math.PI/2;else bar.rotation.x=Math.PI/2;out.push(bar);
  for(const side of [-1,1]){const post=new THREE.Mesh(postGeometry,rail);post.position.set(x+dz*side*.42,c.y+.65,z+dx*side*.42);out.push(post);}
 }
 const setback=L.railSetback??.08;
 if(L.railScale&&L.railScale!==1||setback){
  const floor=c.y+.5,lo=[-.5,-.5],hi=[.5,.5],open=c.end?[c.s]:[c.s,c.turn??c.s.map(v=>-v)];
  for(const d of open)if(setback&&!around?.has(`${c.x+d[0]},${c.y},${c.z+d[1]}`)){const i=d[0]?0:1;if(d[i]>0)hi[i]-=setback;else lo[i]+=setback;}
  const matrix=new THREE.Matrix4().makeTranslation(c.x+(lo[0]+hi[0])/2,floor,c.z+(lo[1]+hi[1])/2).multiply(new THREE.Matrix4().makeScale(hi[0]-lo[0],L.railScale??1,hi[1]-lo[1])).multiply(new THREE.Matrix4().makeTranslation(-c.x,-floor,-c.z));
  for(const mesh of out)mesh.applyMatrix4(matrix);
 }
 return out;
}

const cache=new WeakMap(),ray=new THREE.Ray(),origin=new THREE.Vector3(),direction=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
function obstacles(cells){
 if(cache.has(cells))return cache.get(cells);
 const L=cells.level??{},out=[];
 function add(mesh,key){
  if(!mesh.isMesh)return;
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];if(materials.some(m=>m.transparent))return;
  mesh.updateMatrixWorld(true);mesh.geometry.computeBoundingBox();
  out.push({geometry:mesh.geometry,bounds:mesh.geometry.boundingBox.clone().expandByScalar(-1e-6),inverse:mesh.matrixWorld.clone().invert(),key});
 }
 for(const cell of cells.values())for(const mesh of railMeshes(cell,L,cells)){mesh.updateMatrixWorld(true);mesh.traverse(m=>add(m,at(cell)));}
 const kit={mover:plain,trim:plain};
 for(const {a,b} of L.composition?.spans??[])for(const m of arcadeSpan(kit,a,b))add(m,'architecture');
 if(L.composition?.kind==='paired-bridges'||L.composition?.archMovers)for(let i=0;i<(L.movers?.length??0);i++){
  const mover=L.movers[i],blocks=[...cells.values()].filter(c=>c.mover===i&&c.y===mover.pivot[1]&&c.shape!=='stair').map(c=>[c.x,c.y,c.z]);
  if(blocks.length)for(const m of arcadeSpan(kit,blocks[0],blocks.at(-1),true))add(m,'architecture');
 }
 cache.set(cells,out);return out;
}
export function decorativeBlockers(openings,v,cells){
 // Both edges need a shared visible opening at least .3 tiles wide. Thin corner posts
 // may trim an entrance, but a parapet or beam spanning the entrance closes it.
 const blocked=new Set(),intervals=[];
 for(const o of obstacles(cells))for(const {mid:t,half} of openings){
  ray.origin.copy(origin.fromArray(t)).applyMatrix4(o.inverse);ray.direction.copy(direction.fromArray(v)).transformDirection(o.inverse);
  const h=new THREE.Vector3(...t).add(new THREE.Vector3(...half)).applyMatrix4(o.inverse).sub(ray.origin),mid=ray.origin.toArray(),span=h.toArray(),dir=ray.direction.toArray(),center=o.bounds.getCenter(new THREE.Vector3()).toArray(),extent=o.bounds.getSize(new THREE.Vector3()).multiplyScalar(.5).toArray();
  if(!sheetHitsBox(mid,span,dir,[center,extent]))continue;
  const {position}=o.geometry.attributes,index=o.geometry.index,count=index?index.count:position.count;
  for(let i=0;i<count;i+=3){
   a.fromBufferAttribute(position,index?index.getX(i):i);b.fromBufferAttribute(position,index?index.getX(i+1):i+1);c.fromBufferAttribute(position,index?index.getX(i+2):i+2);
   const interval=sheetTriangleInterval(mid,span,dir,a.toArray(),b.toArray(),c.toArray());if(interval){blocked.add(o.key);intervals.push(interval);}
  }
 }
 let end=-1,gap=0;for(const [a,b] of intervals.sort((a,b)=>a[0]-b[0])){gap=Math.max(gap,a-end);end=Math.max(end,b);}gap=Math.max(gap,1-end);
 return gap>=.6?[]:[...blocked];
}
