import * as THREE from './vendor/three.module.js';
import {tuning,readHand,frameFromHands,frameCorners,pointInPolygon,isPinching,FrameTracker} from './frame-gesture.js';
import {LEVELS} from './illusion-levels.js';
import {campaignOrder,campaignNumber} from './illusion-campaign.js';
// Retired optional routes are no longer loaded into the campaign.
const EXTRA_LEVELS=[];
const EXTRA_PREVIEWS={};
import {eyePose,photographedEyes,eyeBounds} from './illusion-photo-mechanisms.js';
import {fitView,worldFramePoints} from './illusion-view.js';
import {previewSegments,drawPreviewEdges} from './illusion-previews.js';
import {ALBUM_PREVIEWS} from './illusion-album-previews.js';
import {conversationFor,PEOPLE} from './illusion-story.js';
import {createStoryUI} from './illusion-story-ui.js';
import {createVRGuide} from './illusion-vr-guide.js';
import {drawPanel,drawButton,drawTool,drawToolbar,drawLevelTile,drawSheet,drawSettingRow,drawPhotoTile,drawFrameLabel} from './illusion-vr-ui.js';
import {createHandModel} from './illusion-vr-hands.js';
import {LESSON_LEVELS,AUTO_LESSONS,LESSON_CUES,lessonMilestone,lessonFor,drawDemoPointer} from './illusion-tutorial.js';
import {SEEN,SNAP_WINDOW,reachable,MIN_PITCH,MAX_PITCH,seamsIn,seamEdges,seamWithin,seamLine,sightClear,offLine,bothAlong,angleBetween,dirOf,swungCells,misalignAlong,linesUp,positionsOf,nextPosition,moverBlocks,levelCells,plateOf,riding,pieceOf,solidsOf,tilesIn,stepsIn,stoneHidden,hiddenAlong,actuation} from './illusion-geometry.js';
import {unlockSound,play,setMusic,setAudioLevels,audioState} from './sound.js';
import {comfortSettings,makeProgressBackup,readProgressBackup,writeBackupStorage} from './illusion-comfort.js';
import {createFinale,chapterFinales} from './illusion-finales.js';
import {musicForChapter} from './illusion-music.js';
import {THEMES,waveFlags} from './illusion-themes.js';
import {MORE} from './illusion-themes-more.js';
import {LIFT_THEMES} from './illusion-themes-lifts.js';
import {createArt,dressLandmark,batchArchitecture,facadeAsset,arcadeSpan} from './illusion-art.js';
import {createDestinationHouse,refineDestination} from './illusion-landmarks.js';
import {createNightAir} from './illusion-atmosphere.js';
import {PersistentCheckpointStore,TemporalTrail,blendPose,levelRevision} from './illusion-checkpoints.js';
import {diagnoseConnection,photoDependents} from './illusion-feedback.js';
import {railMeshes} from './illusion-rails.js';
Object.assign(THEMES,MORE,LIFT_THEMES);
const LEVEL_ORDER=campaignOrder(LEVELS);
const FINALE_LEVELS=chapterFinales(LEVELS,LEVEL_ORDER);
const settings={twoL:true,skeleton:true,debug:false,hints:true,follow:true,music:true,...comfortSettings()};
try{
  const shared=JSON.parse(localStorage.getItem('frameshift-settings')||'{}'),own=JSON.parse(localStorage.getItem('frameshift-illusion')||'{}');
  for(const k of ['twoL','skeleton','debug'])if(typeof shared?.[k]==='boolean')settings[k]=shared[k];
  for(const k of ['hints','follow','music','vrGuideDone','vrRoom'])if(typeof own?.[k]==='boolean')settings[k]=own[k];
  Object.assign(settings,comfortSettings(own));
}catch{}
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
const reducedMotion=()=>settings.motion==='reduced'||settings.motion==='system'&&motionPreference.matches;
let finale=null,finishCelebration=null;
let maker=null;

const $=id=>document.getElementById(id), V3=THREE.Vector3, DEG=Math.PI/180;
// Which way is up on a surface, as a turn from the usual up (for wall blocks and the traveller on them).
const Y_UP=new V3(0,1,0),tiltOf=up=>new THREE.Quaternion().setFromUnitVectors(Y_UP,up);
const overlay=$('overlay'),ctx=overlay.getContext('2d'),video=$('cam');
const renderer=new THREE.WebGLRenderer({canvas:$('world'),antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0,0);
// A flat (orthographic) view, as in Monument Valley: far things look as big as near ones, so two edges
// that line up match exactly and the join looks seamless. Only the direction you look along matters;
// zooming changes nothing. The camera sits FAR back along that direction.
const FAR=300,camera=new THREE.OrthographicCamera(-1,1,1,-1,1,FAR*2);
const BONES=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
const ALIGN=SEEN;        // only numerical rounding is allowed in an actual connection
const SNAP_DEG=9;      // stopping within this many degrees of a seam's line eases the view onto it
const VR_SNAP_DEG=3.5;  // in a headset the head has to come this close
const PALM_TURN=.3;    // degrees of turn per pixel an open palm moves
const STEP_SECONDS=.32, LINK_SECONDS=.6, MIN_DRAG=24;

// ---------- Scene ----------
const scene=new THREE.Scene();
const art=createArt(renderer,scene);
// Each level has its own time of day: a sky, a fog that matches the horizon, and stone colours.
// Faces are coloured by the way they face (flat, like Monument Valley); sides darken toward the bottom.
// Chapters are the places the photographer travels to. A level's palette is an index here: it says which
// place the level belongs to, and with it the sky, the stone and the place's look (see illusion-themes.js;
// a place without a theme is plain floating stone). LEVEL_ORDER gives the route; LEVELS keeps save identities stable.
const PLACES=[
  {name:'Castle',theme:'castle'},
  {name:'Kyoto',theme:'kyoto'},
  {name:'Desert',theme:'desert'},
  {name:'Venice',theme:'venice'},
  {name:'The stars',theme:'stars'},
  {name:'Home'},
  {name:'The beach',theme:'beach'},
  {name:'Santorini',theme:'santorini'},
  {name:'Lantern night',theme:'lantern'},
  {name:'Ice palace',theme:'ice'},
  {name:'Snowy mountains',theme:'snow'},
  {name:'Glow forest',theme:'glow'},
  {name:'Cloud kingdom',theme:'cloud'},
  {name:'Space',theme:'space'}
];
const CHAPTERS=PLACES.map(p=>p.name);
const LEVEL_TITLES={'First Light':'Alignment','Two at Once':'Two Connections','Look Down':'Overhead','The Photo Waits':'Delayed Connection',"Bird's Eye":'Overhead Crossing','Out of Sight':'Hidden Stone','Round and Round':'Rotation','Long Way Home':'Final Crossing'};
const levelTitle=L=>L.title??LEVEL_TITLES[L.name]??L.name;
const themeOf=L=>THEMES[L.theme??PLACES[(L.palette??0)%PLACES.length].theme]??null;
const PALETTES=[
  {sky:['#f6cdb8','#e9b7c4','#a9b6e0'],fog:0xdcbfd0,faces:[0xeaa97d,0xd88c66,0xf6e7d2,0x8c4a3d,0xc77157,0xb4604c],edge:0x7a3f33,cloud:0xfff3f0},
  {sky:['#e9e7da','#c2d4c9','#86aaa5'],fog:0xd3e5dc,faces:[0x95ceb8,0x76b6a2,0xf4f2e4,0x3b6660,0x5f9c8c,0x4f8579],edge:0x2f5550,cloud:0xf2fffb},
  {sky:['#fde9b8','#f4c48e','#d98d6c'],fog:0xf0c79a,faces:[0xeec67f,0xd9a865,0xfff4dc,0x7c5232,0xc58b4f,0xa8723f],edge:0x6b4425,cloud:0xfff8e8},
  {dark:true,sky:['#41336a','#8a6290','#eea08f'],fog:0x9b7095,faces:[0xe2989a,0xc9798b,0xffe4cb,0x5a3555,0xa45f82,0x854c73],edge:0x3c2340,cloud:0xf7d9e6},
  {dark:true,sky:['#141b3c','#2c3672','#5d6cab'],fog:0x2e3870,faces:[0x8f9edc,0x7584c6,0xe2e8ff,0x232a55,0x5c69aa,0x4a5793],edge:0x1a2048,cloud:0xaab5e8},
  // First light: the soft, pale sky of the teaching levels.
  {sky:['#fff3e4','#fbe0dc','#d4e2f3'],fog:0xf3e2e2,faces:[0xf2c6aa,0xe3ad90,0xfdf3e8,0x9c6d5e,0xdc9e84,0xc78a72],edge:0x8d5c4e,cloud:0xffffff},
  // The beach: a bright morning over the sea, warm sand.
  {sky:['#fdf6e3','#d6eff2','#b4dfe8'],fog:0xd3ecef,faces:[0xf1d6a8,0xe2c08c,0xfff6e2,0x8a6a45,0xd4ad78,0xc39c68],edge:0x7a5a3a,cloud:0xffffff},
  // Santorini: whitewash under a deep blue sky.
  {sky:['#f4fbff','#bfdcf5','#5f95d6'],fog:0xcfe2f4,faces:[0xf4f1ec,0xe2ddd6,0xffffff,0x6d7b95,0xd3cdc6,0xc5bfb8],edge:0x4f5d7a,cloud:0xffffff},
  // Lantern night: plum dark, warm wood and red lacquer.
  {dark:true,sky:['#1b1035','#47285e','#c46a6a'],fog:0x4a2c5c,faces:[0xd98a6a,0xc4705a,0xffe0c0,0x4a2238,0xa85a55,0x8f4a4c],edge:0x2e1428,cloud:0xe8b8c8},
  // Ice palace: deep blue night, pale ice.
  {dark:true,sky:['#0b1a33','#14385a','#2e7b8a'],fog:0x1f4a66,faces:[0xbfe6f5,0x9fd0e6,0xf0fbff,0x2a4f70,0x7fb8d4,0x6aa4c2],edge:0x1c3954,cloud:0xbfe8f0},
  // The snowy mountains: a clear cold morning, the snow bright.
  {sky:['#f4f8ff','#d6e4f4','#a4bede'],fog:0xdbe6f2,faces:[0xb4805a,0xa0704e,0xffffff,0x5a4030,0x94684a,0x845c40],edge:0x3e2c22,cloud:0xffffff},
  // The glow forest: deep teal night under the trees.
  {dark:true,sky:['#08161a','#123034','#2f6a5e'],fog:0x1c3a3a,faces:[0x7fa88e,0x6a907a,0xa8d4b4,0x1e3228,0x5e8a72,0x4f7a64],edge:0x1a2a22,cloud:0x9fd8c0},
  // The cloud kingdom: high, warm afternoon light over the clouds.
  {sky:['#fff8ea','#fde6d6','#bcd6f2'],fog:0xf6eae6,faces:[0xffffff,0xf0ebf2,0xfbf6ec,0x8a84a6,0xe6e0ea,0xd8d2de],edge:0x6a6488,cloud:0xffffff},
  // Space: black sky, the stars sharp.
  {dark:true,sky:['#03040c','#0b1030','#1f2a5a'],fog:0x141a3a,faces:[0xe8ecf2,0xd6dbe2,0xdfe4ea,0x252a36,0xc4cad4,0xb4bac6],edge:0x252a36,cloud:0x8a96c8},
];
const shade=(()=>{const c=document.createElement('canvas');c.width=4;c.height=64;const g=c.getContext('2d'),grad=g.createLinearGradient(0,0,0,64);
  grad.addColorStop(0,'#ffffff');grad.addColorStop(1,'#b9b0b8');g.fillStyle=grad;g.fillRect(0,0,4,64);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;})();
// Painted stone, in grey so each palette tints it: a tile on every top, and on the sides a pale lip
// under the edge, two courses of masonry, and a shade that darkens toward the bottom.
const canvasTexture=(size,draw)=>{const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;};
const tileTexture=canvasTexture(128,(g,n)=>{
  const glow=g.createRadialGradient(n/2,n/2,n*.1,n/2,n/2,n*.75);glow.addColorStop(0,'#ffffff');glow.addColorStop(1,'#e9e3e6');g.fillStyle=glow;g.fillRect(0,0,n,n);
  g.strokeStyle='rgba(110,90,105,.22)';g.lineWidth=3;g.beginPath();g.roundRect(9,9,n-18,n-18,10);g.stroke();
  g.strokeStyle='rgba(255,255,255,.9)';g.lineWidth=2;g.beginPath();g.roundRect(12,12,n-24,n-24,8);g.stroke();
});
const sideTexture=canvasTexture(128,(g,n)=>{
  const grad=g.createLinearGradient(0,0,0,n);grad.addColorStop(0,'#ffffff');grad.addColorStop(1,'#bdb3bd');g.fillStyle=grad;g.fillRect(0,0,n,n);
  g.fillStyle='rgba(255,255,255,.5)';g.fillRect(0,0,n,9);g.fillStyle='rgba(60,40,60,.12)';g.fillRect(0,9,n,3);
});
// Arched windows on some outer walls, so the islands read as little buildings. Tinted per palette.
const windowMaterial=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,map:canvasTexture(128,(g,n)=>{
  g.fillStyle='#fff';g.beginPath();g.moveTo(44,104);g.lineTo(44,52);g.arc(64,52,20,Math.PI,0);g.lineTo(84,104);g.closePath();g.fill();
  g.fillStyle='rgba(255,255,255,.55)';g.fillRect(38,104,52,6);
})});
const windowGeometry=new THREE.PlaneGeometry(.92,.92);
const windowLitMaterial=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,color:0xffd98a,map:windowMaterial.map}),plainWindow=windowMaterial.map;
const faceMaterials=colors=>colors.map((color,i)=>new THREE.MeshBasicMaterial({color,map:i===2?tileTexture:i===3?null:sideTexture}));
const blockMaterials=faceMaterials(PALETTES[0].faces);
const startMaterials=blockMaterials.map((m,i)=>i===2?new THREE.MeshBasicMaterial({color:0xfff6c8,map:tileTexture}):m);
// A place can paint its blocks a few ways (beach huts in different colours), picked per column.
const variantMaterials=[0,1,2,3].map(()=>faceMaterials(PALETTES[0].faces));
const stoneMaterials=new Set([blockMaterials,startMaterials,...variantMaterials]);
const variantOf=c=>((Math.imul(c.x,73856093)^Math.imul(c.z,19349663))>>>0)%theme.variants.length;
// Lab blocks: ghosts (faint until a photo holds them), shy pearl stones, and crumbling sand.
const ghostBlockMaterial=new THREE.MeshBasicMaterial({color:0xeafcff,transparent:true,opacity:.22,depthWrite:false}),ghostBlockEdge=new THREE.LineBasicMaterial({color:0x3fb8a8,transparent:true,opacity:.75});
const ghostSolidMaterials=faceMaterials([0x9fe3da,0x84d3c9,0xe9fffb,0x3f8f86,0x76c6bb,0x67b4aa]);
const shyMaterials=faceMaterials([0xf7eef0,0xeadfe4,0xfffdfb,0x9a8a94,0xe2d4dc,0xd8c8d2]);
const crumbleMaterials=faceMaterials([0xe8c98f,0xd9b675,0xf6e6c2,0x8a6a3a,0xcfa967,0xc29b58]);
// Pieces that move are lavender, so they read as different from the stone.
const moverMaterials=faceMaterials([0xb7a6e0,0xa592d4,0xe6defa,0x6e5c9c,0x9884c8,0x8a76bb]);
const columnMaterial=new THREE.MeshBasicMaterial({color:0xf3ece4,map:shade});
const ghostMaterial=new THREE.MeshBasicMaterial({color:0xe6defa,transparent:true,opacity:.18,depthWrite:false}),ghostEdgeMaterial=new THREE.LineBasicMaterial({color:0x8a76bb,transparent:true,opacity:.5});
const blockGeometry=new THREE.BoxGeometry(1,1,1);
const lanternLitMaterial=new THREE.MeshBasicMaterial({color:0xffe2a0});
const softGlow=canvasTexture(64,(g,n)=>{const r=g.createRadialGradient(n/2,n/2,0,n/2,n/2,n/2);r.addColorStop(0,'rgba(255,255,255,.95)');r.addColorStop(.3,'rgba(255,255,255,.3)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,n,n);});
const lanternGlow=new THREE.SpriteMaterial({map:softGlow,color:0xffc870,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
const edgeGeometry=new THREE.EdgesGeometry(blockGeometry),edgeMaterial=new THREE.LineBasicMaterial({color:0x7a3f33,transparent:true,opacity:.35});
const columnGeometry=new THREE.CylinderGeometry(1,1,1,28),columnEdgeGeometry=new THREE.EdgesGeometry(columnGeometry,30);
const capGeometry=new THREE.BoxGeometry(1,1,1),capEdgeGeometry=new THREE.EdgesGeometry(capGeometry);
// Outlines (where a platform will move to, a stone hidden for now) are one-pixel lines on screen. In a
// headset a line stays one pixel however near it is, so it crawls and flickers; there the same edges are
// thin solid bars instead. Each line material has a bar twin, and only one of the two shows at a time.
const outlineBar=new THREE.CylinderGeometry(1,1,1,6,1),outlineRing=new THREE.TorusGeometry(1,.055,4,28).rotateX(Math.PI/2),outlineTwins=new Map();
function outlineTwin(lines){
  let m=outlineTwins.get(lines);
  if(!m){m=new THREE.MeshBasicMaterial({color:lines.color,transparent:true,opacity:Math.min(1,lines.opacity*1.1),depthWrite:false});m.visible=false;outlineTwins.set(lines,m);}
  return m;
}
function showOutlines(inHeadset){for(const [lines,bars] of outlineTwins){lines.visible=!inHeadset;bars.visible=inHeadset;}}
const OUTLINE_R=.022;
function outlineBars(h,mat){
  const g=new THREE.Group();
  for(const axis of [0,1,2])for(const u of [-1,1])for(const v of [-1,1]){
    const [p,q]=[0,1,2].filter(k=>k!==axis),a=new V3(),b=new V3();
    a.setComponent(axis,-h[axis]);b.setComponent(axis,h[axis]);for(const o of [a,b]){o.setComponent(p,u*h[p]);o.setComponent(q,v*h[q]);}
    const m=new THREE.Mesh(outlineBar,mat);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(Y_UP,b.clone().sub(a).normalize());m.scale.set(OUTLINE_R,a.distanceTo(b)+OUTLINE_R*2,OUTLINE_R);g.add(m);
  }
  return g;
}
const shared=new Set([windowGeometry,blockGeometry,edgeGeometry,columnGeometry,columnEdgeGeometry,capGeometry,capEdgeGeometry,outlineBar,outlineRing]);
// Drawing and line-of-sight checks use exactly the same solid pieces, including stair treads.
function pieceMeshes(c,materials,lines,around=null){
  const out=[];
  const opaque=Array.isArray(materials);
  if(opaque){
    const kind=materials===moverMaterials?'mover':materials===shyMaterials?'shy':materials===startMaterials?'start':'stone';
    const variant=theme?.variants&&stoneMaterials.has(materials)?variantOf(c):0;
    out.push(...art.piece(c,solidsOf(c),{kind,variant},around));
  }else for(const s of solidsOf(c)){
    if(s.box){const [at,h]=s.box;for(const m of [new THREE.Mesh(blockGeometry,materials),new THREE.LineSegments(edgeGeometry,lines)]){m.position.set(...at);m.scale.set(h[0]*2,h[1]*2,h[2]*2);if(c.shape==='wall')m.quaternion.copy(tiltOf(new V3(...c.up)));out.push(m);}
      const bars=outlineBars(h,outlineTwin(lines));bars.position.set(...at);if(c.shape==='wall')bars.quaternion.copy(tiltOf(new V3(...c.up)));out.push(bars);}
    else{const [x,z,r,y0,y1]=s.cyl;for(const m of [new THREE.Mesh(columnGeometry,materials),new THREE.LineSegments(columnEdgeGeometry,lines)]){m.position.set(x,(y0+y1)/2,z);m.scale.set(r*.96,y1-y0,r*.96);out.push(m);}
      for(const y of [y0,y1]){const ring=new THREE.Mesh(outlineRing,outlineTwin(lines));ring.position.set(x,y,z);ring.scale.setScalar(r*.96);out.push(ring);}}
  }
  out.push(...railMeshes(c,level,around,{rail:opaque?art.kit.rail:materials,cap:opaque?art.kit.cap:materials,lamp:opaque?(palette.dark?lanternLitMaterial:art.kit.accent):null,glow:opaque&&palette.dark?lanternGlow:null,themed:stoneMaterials.has(materials)}));
  return out;
}

// ---------- Level state ----------
// The world as the beams and your photos make it (and the spare mechanics no level uses yet): ghost blocks a photo holds are
// solid, shy stones a photo cannot see are gone, and crumbled blocks have fallen.
let fallen=new Set();
const at3=b=>key(b[0],b[1],b[2]);
function worldCells(held=frames){
  const out=levelCells(level,positions()).cells;
  for(const g of level.ghosts??[])if(held.some(f=>f.ghosts?.has(at3(g)))){const c=pieceOf(g);c.ghost=true;out.set(at3(g),c);}
  for(const b of level.shy??[])if(!held.some(f=>f.vanished?.has(at3(b)))){const c=pieceOf(b);c.shy=true;out.set(at3(b),c);}
  for(const k of fallen)out.delete(k);
  for(const b of level.crumble??[])if(out.has(at3(b)))out.get(at3(b)).crumble=true;
  return out;
}
const labWorld=()=>!!(level.ghosts||level.shy);
function photosChanged(fresh=null){cells=worldCells();buildWorld(fresh);}
let extraIndex=null;
let level=null,levelIndex=0,levelGroup=null,blockGroup=null,cells=new Map(),nodes=[],nodeAt=new Map(),pairs=[],frames=[],complete=false,graphVersion=0;
let movers=[],directing=false;
const key=(x,y,z)=>`${x},${y},${z}`;
const top=n=>n.surface?n.surface.clone():new V3(n.x,n.y+.5,n.z);
const nodeOf=c=>c&&nodeAt.get(key(...c));
const positions=()=>movers.map(m=>m.k);
let center=new V3(),radius=6,viewZoom=8,aspect=1,futures=[];
const extraSlug=L=>L.name.toLowerCase().replace(/[^a-z0-9]+/g,'-');
const restartLevel=()=>maker?.active?maker.restartTest():extraIndex===null?loadLevel(levelIndex):loadExtra(extraIndex);
const adjacentLevel=delta=>maker?.active?false:extraIndex===null?loadLevel(LEVEL_ORDER[(LEVEL_ORDER.indexOf(levelIndex)+delta+LEVEL_ORDER.length)%LEVEL_ORDER.length]):loadExtra(extraIndex+delta);
function loadExtra(){loadLevel(Number.isInteger(progress.at)&&progress.at>=0&&progress.at<LEVELS.length?progress.at:0);}
function loadLevel(i,data,extra=null){
  closeCard();if(vr.guide?.active)vr.guide.stop();// the guide belongs to the level it was started on
  finale?.dispose();finale=null;finishCelebration=null;$('finale-caption').hidden=true;$('page').hidden=true;
  story.reset();
  cancelCustomHint();
  extraIndex=null;
  setMobileTray(null);expandedPhoto=null;newestPhoto=null;photoInspection=null;practice.introShown=false;
  cancelRewind();winEpoch++;feedback=null;bursts=[];
  levelIndex=(i+LEVELS.length)%LEVELS.length;const L=data??LEVELS[levelIndex];level=L;if(!maker?.editing)play('level');sparks.forEach(s=>{s.m.removeFromParent();s.m.material.dispose();});sparks=[];
  if(mode!=='intro'){
    const url=new URL(location.href);
    if(extraIndex!==null){progress.route='extras';progress.extra=L.name;url.searchParams.set('extra',extraSlug(L));}
    else if(!data){progress.at=levelIndex;delete progress.route;url.searchParams.delete('extra');}
    if(extraIndex!==null||!data){saveProgress();window.history.replaceState(null,'',url);}
  }
  clearTimeout(snapTimer);pointers.clear();framing=null;touchGesture=null;frameTool=false;
  nightAir?.dispose();nightAir=null;
  for(const o of motes)o.m.material.dispose();flock?.mat.dispose();
  if(levelGroup){levelGroup.removeFromParent();levelGroup.traverse(o=>{if(o.geometry&&!shared.has(o.geometry)&&!o.geometry.userData.artShared)o.geometry.dispose();});}
  levelGroup=new THREE.Group();scene.add(levelGroup);blockGroup=null;
  for(const f of new Set([...frames,...retiredFrames]))removeFrameObject(f);frames=[];retiredFrames.clear();
  movers=(L.movers??[]).map((m,i)=>({...m,i,k:0,moving:false,t:0}));history=[];
  fallen=new Set();cells=worldCells();directing=false;walker.node=null;
  theme=themeOf(L);usePalette(PALETTES[(L.palette??levelIndex)%PALETTES.length]);
  buildMarkers();buildEyes();
  buildWorld();
  const box=new THREE.Box3();for(const c of cells.values())box.expandByPoint(new V3(c.x,c.y,c.z));
  for(const m of movers)for(let k=0;k<positionsOf(m);k++)for(const b of moverBlocks(m,k))box.expandByPoint(new V3(...b));
  box.expandByScalar(.9);box.getCenter(center);radius=box.getSize(new V3()).length()/2;
  art.fit(center,radius);
  fitCamera();homeView();snapCamera();
  buildClouds(box);
  if(!data&&FINALE_LEVELS.has(levelIndex))finale=createFinale(levelGroup,{chapter:L.palette,goal:L.goal,box,kit:art.kit,texture:glowTexture,yaw:openingView().yaw});
  complete=false;$('done').hidden=true;flashText='';flashUntil=0;resetWalker();Object.assign(hint,{key:'',plan:null,on:false,tier:0,sticky:false,prev:null,note:'',pending:false,asked:hint.asked+1});$('hint').setAttribute('aria-pressed','false');
  const checkpointLoad=++checkpointLoadId;checkpointLoading=true;checkpointSaving=false;checkpointSlots=[null,null,null];checkpointKey='';trail.reset();temporalPrints.clear();recordTemporal(true);
  if(maker?.editing)checkpointLoading=false;
  else checkpointStore.read(L).then(slots=>{if(checkpointLoad===checkpointLoadId){checkpointSlots=slots;checkpointLoading=false;checkpointKey='';}});
  const chapter=CHAPTERS[(L.palette??levelIndex)%CHAPTERS.length];
  $('level-num').textContent=extraIndex!==null?`Extra ${extraIndex+1}/${EXTRA_LEVELS.length}`:`${campaignNumber(LEVEL_ORDER,levelIndex)}/${LEVELS.length}`;$('level-name').textContent=levelTitle(L);$('chapter').textContent=chapter;
  if(maker?.active){$('level-num').textContent=maker.editing?'Building':'Playtest';$('chapter').textContent='Your levels';}
  // Brief chapter and level title, then it fades.
  const inChapter=LEVEL_ORDER.slice(0,campaignNumber(LEVEL_ORDER,levelIndex)).filter(i=>LEVELS[i].palette===L.palette).length;
  $('title-chapter').textContent=extraIndex!==null?`${chapter} · Extra ${extraIndex+1}`:`${chapter} · ${inChapter}`;$('title-name').textContent=levelTitle(L);$('title-hint').textContent=`${L.frames} active photo${L.frames===1?'':'s'}`;
  if($('title-subject'))$('title-subject').textContent='';
  const card=$('title-card');card.hidden=true;void card.offsetWidth;card.hidden=mode==='intro';lastHud='';
  $('story-replay').hidden=!levelConversation();
  if(mode!=='intro')showLevelDialogue();
}
let palette=PALETTES[0],theme=null,homeFlags=[];
// Stone in a palette's colours, or a theme's own (with its patterns on tops and sides). Beams and shy
// stones keep their own look everywhere, so they are always recognisable.
function paint(mats,colors,top,side){mats.forEach((m,i)=>{m.color.setHex(colors[i]);const map=i===2?top:i===3?null:side;if(m.map!==map){m.map=map;m.needsUpdate=true;}});}
function usePalette(P){
  palette=P;if(mode!=='intro')setMusic(settings.music,PALETTES.indexOf(P));
  const track=musicForChapter(PALETTES.indexOf(P));$('soundscape-name').textContent=`${track.composer} · ${track.title} — ${track.performer}`;
  const T=theme;
  const artPalette=art.select(T?.name??'Home');
  P.sky=artPalette.sky;P.dark=!!artPalette.night;
  paint(blockMaterials,T?.faces??P.faces,T?.top??tileTexture,T?.side??sideTexture);
  variantMaterials.forEach((m,i)=>paint(m,T?.variants?.[i%T.variants.length]??T?.faces??P.faces,T?.top??tileTexture,T?.side??sideTexture));
  {const m=startMaterials[2],map=T?.top??tileTexture;if(m.map!==map){m.map=map;m.needsUpdate=true;}}
  for(const m of [windowMaterial,windowLitMaterial]){const map=T?.window.map??plainWindow;if(m.map!==map){m.map=map;m.needsUpdate=true;}}
  windowMaterial.color.setHex(T?.window.color??P.faces[3]);edgeMaterial.color.setHex(T?.edge??P.edge);
  document.body.classList.toggle('dark',P.dark===true);
  document.body.style.background=`linear-gradient(180deg,${artPalette.sky[0]} 0%,${artPalette.sky[1]} 46%,${artPalette.sky[2]} 100%)`;
  scene.fog=null;walkerParts.dress(theme?.name);
}
let clouds=null;
function buildClouds(box){clouds=null;buildAir(box);}
// The air is alive: motes of light drift around the island (fireflies under a dark sky, or petals falling
// where a place has them), and now and then a few birds cross the sky, so a still puzzle never feels
// like a still picture.
const petalTexture=canvasTexture(32,(g,n)=>{g.fillStyle='#fff';g.beginPath();g.ellipse(n/2,n/2,n*.42,n*.26,.5,0,Math.PI*2);g.fill();g.globalCompositeOperation='destination-out';g.beginPath();g.arc(n*.9,n*.25,n*.14,0,Math.PI*2);g.fill();});
let motes=[],flock=null,flockAt=0,airBox=null,nightAir=null;
const wingGeometry=(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,.07,0,0,-.09,-.32,.04,-.03],3));return g;})();
function buildAir(box){
  airBox=box.clone().expandByScalar(1.5);motes=[];flock=null;flockAt=elapsed+4+Math.random()*6;
  const size=airBox.getSize(new V3()),dark=palette.dark===true,air=theme?.air,petals=air==='petals',snow=air==='snow',lanterns=air==='lanterns',fall=petals||snow;
  if(dark){nightAir=createNightAir(levelGroup,box,theme?.name,[...cells.values()].map(c=>[c.x,c.y,c.z]));return;}
  for(let i=0;i<(snow?70:lanterns?26:dark?46:petals?40:32);i++){
    const m=new THREE.Sprite(petals?new THREE.SpriteMaterial({map:petalTexture,color:i%3?0xf7c3d2:0xfbe1e8,transparent:true,depthWrite:false,fog:false,opacity:0})
      :snow?new THREE.SpriteMaterial({map:glowTexture,color:0xffffff,transparent:true,depthWrite:false,fog:false,opacity:0})
      :new THREE.SpriteMaterial({map:glowTexture,color:lanterns?(i%3?0xffa45a:0xffc878):theme?.mote??(dark?(i%3?0xfff1a8:0xc8ffd8):0xffffff),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false,opacity:0}));
    const home=new V3(airBox.min.x+Math.random()*size.x,airBox.min.y+Math.random()*size.y,airBox.min.z+Math.random()*size.z);
    m.position.copy(home);const sz=(lanterns?.42:snow?.12:dark?.22:petals?.13:.1)*(.6+Math.random());m.scale.setScalar(sz);levelGroup.add(m);
    motes.push({m,home,phase:Math.random()*Math.PI*2,speed:.2+Math.random()*.35,glow:lanterns?.9:snow?.85:dark?.95:petals?.9:.55,fall,spin:petals,rise:lanterns?.22:.06,steady:lanterns});
  }
}
function updateAir(dt){
  const still=reducedMotion()||settings.quality==='low';
  nightAir?.update(still?0:dt,camera,{reduced:still,low:settings.quality==='low'});
  if(still){for(const o of motes)o.m.visible=false;if(flock)flock.g.visible=false;return;}
  if(flock)flock.g.visible=true;
  for(const o of motes){
    o.m.visible=true;
    const t=elapsed*o.speed+o.phase;
    // Petals fall and turn, snow falls; motes of light (and sky lanterns, faster) rise.
    if(o.fall){o.home.y-=dt*.3;if(o.home.y<airBox.min.y)o.home.y=airBox.max.y;if(o.spin)o.m.material.rotation=t*1.5;}
    else{o.home.y+=dt*o.rise;if(o.home.y>airBox.max.y)o.home.y=airBox.min.y;}
    o.m.position.set(o.home.x+Math.sin(t*1.3)*.5,o.home.y+Math.sin(t*2.1)*.15,o.home.z+Math.cos(t)*.5);
    const edge=Math.min(1,(o.home.y-airBox.min.y)/1.2,(airBox.max.y-o.home.y)/1.2);
    o.m.material.opacity=o.glow*edge*(o.fall?1:o.steady?.8+.2*Math.sin(t*2)**2:.45+.55*Math.sin(t*3.1)**2);
  }
  // Birds: a small V crosses high over the island, wings beating, then glides off and is gone.
  if(!nightAir&&!flock&&elapsed>flockAt&&airBox&&!vr.on&&mode!=='intro'){
    const c=airBox.getCenter(new V3()),r=airBox.getSize(new V3()).length()*.9+6,a=Math.random()*Math.PI*2,dir=new V3(-Math.cos(a),0,-Math.sin(a));
    const g=new THREE.Group(),mat=new THREE.MeshBasicMaterial({color:theme?.birds??new THREE.Color(palette.edge).lerp(new THREE.Color(palette.fog),.25),side:THREE.DoubleSide,transparent:true,fog:false});
    const n=3+Math.floor(Math.random()*4),birds=[];
    for(let i=0;i<n;i++){const b=new THREE.Group(),l=new THREE.Mesh(wingGeometry,mat),r=new THREE.Mesh(wingGeometry,mat);r.scale.x=-1;b.add(l,r);const side=i%2?1:-1,row=Math.ceil(i/2);b.position.set(side*row*.7,Math.random()*.3,row*.8);b.userData.phase=Math.random()*6;g.add(b);birds.push(b);}
    g.position.copy(c).addScaledVector(dir,-r);g.position.y=airBox.max.y+4+Math.random()*3;g.lookAt(g.position.clone().add(dir));g.scale.setScalar(.9);levelGroup.add(g);
    flock={g,birds,dir,mat,born:elapsed,life:2*r/2.2};
  }
  if(flock){
    const t=elapsed-flock.born;flock.g.position.addScaledVector(flock.dir,dt*2.2);
    for(const b of flock.birds){const beat=Math.sin(elapsed*9+b.userData.phase);b.children[0].rotation.z=beat*.6;b.children[1].rotation.z=-beat*.6;b.position.y+=Math.sin(elapsed*2+b.userData.phase)*dt*.1;}
    flock.mat.opacity=Math.min(1,t/1.5,(flock.life-t)/1.5)*.8;
    if(t>flock.life){flock.g.removeFromParent();flock.mat.dispose();flock=null;flockAt=elapsed+12+Math.random()*16;}
  }
}

// Rebuild blocks, walkable spots and possible seams from the current cells. Runs again whenever something moves.
function buildWorld(fresh=null){
  const L=level,old=walker.node;
  if(blockGroup){blockGroup.removeFromParent();blockGroup.traverse(o=>{if(o.geometry&&!shared.has(o.geometry)&&!o.geometry.userData.artShared)o.geometry.dispose();});}
  blockGroup=new THREE.Group();levelGroup.add(blockGroup);
  for(const m of movers){m.group=new THREE.Group();m.group.position.set(...m.pivot);blockGroup.add(m.group);}
  for(const c of cells.values()){
    const m=c.mover>=0?movers[c.mover]:null,parent=m?m.group:blockGroup,at=new V3(c.x,c.y,c.z);if(m)at.sub(m.group.position);
    const isStart=c.x===L.start[0]&&c.y===L.start[1]&&c.z===L.start[2];
    const mats=c.ghost?ghostSolidMaterials:c.shy?shyMaterials:c.crumble?crumbleMaterials:m?moverMaterials:isStart?startMaterials:theme?.variants?variantMaterials[variantOf(c)]:blockMaterials;
    for(const mesh of pieceMeshes(c,mats,edgeMaterial,cells)){mesh.position.add(at).sub(new V3(c.x,c.y,c.z));if(!mesh.userData.decorative)mesh.userData.key=key(c.x,c.y,c.z);parent.add(mesh);}
  }
  for(const {a,b} of L.composition?.spans??[])for(const mesh of arcadeSpan(art.kit,a,b))blockGroup.add(mesh);
  if(L.composition?.kind==='paired-bridges'||L.composition?.archMovers)for(const m of movers){
    const blocks=moverBlocks(m,m.k).filter(b=>b[1]===m.pivot[1]&&b[3]!=='stair');
    for(const mesh of arcadeSpan(art.kit,blocks[0],blocks.at(-1),true)){mesh.position.sub(m.group.position);m.group.add(mesh);}
  }
  // Windows: on about a third of the outer walls of plain stone blocks, picked by position so they stay put.
  // Only for looks (no key, so picking and lines of sight ignore them).
  for(const c of cells.values()){
    if(c.mover>=0||c.ghost||c.shy||c.crumble||c.shape&&c.shape!=='cube'&&c.shape!=='rail')continue;
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      if(cells.has(key(c.x+dx,c.y,c.z+dz)))continue;
      const h=Math.abs(Math.sin(c.x*12.9898+c.z*78.233+c.y*3.7+dx*5.1+dz*9.3)*43758.5)%1;
      // A theme may hang a banner on some walls (just under the top edge) instead.
      const b=theme?.banner;
      const lantern=b&&h>.3&&h<.3+b.every&&['Kyoto','Lantern night'].includes(theme?.name);
      if(b&&h>.3&&h<.3+b.every&&!lantern){const m=new THREE.Mesh(b.geometry,b.material);m.position.set(c.x+dx*.506,c.y+.14,c.z+dz*.506);m.rotation.y=Math.atan2(dx,dz);blockGroup.add(m);continue;}
      if(!lantern&&h>(theme?.window.every??.3))continue;
      const rotation=new THREE.Quaternion().setFromAxisAngle(Y_UP,Math.atan2(dx,dz)),position=new V3(c.x+dx*.491,c.y,c.z+dz*.491);
      for(const w of facadeAsset(art.kit,{lit:palette.dark&&h<(theme?.window.lit??.17),lantern})){
        w.position.applyQuaternion(rotation).add(position);w.quaternion.premultiply(rotation);blockGroup.add(w);
      }
    }
  }
  // Ghost blocks no photo holds yet, and shy stones a photo has made vanish: faint outlines.
  for(const b of [...(level.ghosts??[]),...(level.shy??[])])if(!cells.has(at3(b)))for(const g of pieceMeshes(pieceOf(b),ghostBlockMaterial,ghostBlockEdge))blockGroup.add(g);
  // A faint outline of where each moving piece will swing to next.
  for(const m of movers){
    if(m.moving)continue;
    for(const b of moverBlocks(m,nextPosition(m,m.k))){if(cells.has(key(...b)))continue;for(const g of pieceMeshes(pieceOf(b),ghostMaterial,ghostEdgeMaterial)){g.userData.futureOutline=true;blockGroup.add(g);}}
  }
  // Switch plates. A plate on a moving beam is attached to it, so it rides along when the beam turns.
  plates=movers.map((m,i)=>{
    if(!m.trigger)return {at:null}; // a beam turned by something else (a stone eye)
    const at=plateOf(L,positions(),i),j=movers.findIndex(o=>o.blocks.some(b=>b.slice(0,3).join()===m.trigger.slice(0,3).join())),parent=j>=0?movers[j].group:blockGroup;
    const d=new THREE.Group();d.position.set(at[0],at[1]+.5,at[2]);if(j>=0)d.position.sub(parent.position);parent.add(d);
    const rim=new THREE.Mesh(plateRimGeometry,plateRimMaterial);rim.position.y=.025;d.add(rim);
    const pad=new THREE.Mesh(plateGeometry,[plateMaterial,plateGlyph(m.travel?(m.travel[1]?'lift':'slide'):m.linked?.length?'linked':m.positions===2?0:Math.sign(m.angle)),plateMaterial]);pad.position.y=.06;d.add(pad);
    const ring=new THREE.Mesh(plateRingGeometry,new THREE.MeshBasicMaterial({color:0xffd36b,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.02;d.add(ring);
    return {at,disc:d,pad,ring,spin:m.travel?0:m.positions===2?0:Math.sign(m.angle)};
  });
  // Walkable spots are cube and stair tops with nothing on them; real steps go through a shared edge.
  const tiles=tilesIn(cells),steps=stepsIn(tiles);
  nodes=[...tiles.values()].map((t,id)=>({x:t.x,y:t.y,z:t.z,mover:t.mover,id,surface:new V3(...t.surface),up:new V3(...t.up)}));
  nodeAt=new Map(nodes.map(n=>[key(n.x,n.y,n.z),n]));
  for(const n of nodes)n.real=steps.get(key(n.x,n.y,n.z)).map(s=>({m:nodeAt.get(s.to),via:new V3(...s.via)}));
  // Any two open edges facing each other can become a seam (see illusion-geometry.js).
  pairs=seamsIn(cells,tiles).map(s=>({...s,a:nodeAt.get(s.ea.tile),b:nodeAt.get(s.eb.tile),d:new V3(...s.d),seam:s}));
  aligned=[];ahead=[];blocked=[];vr.view=null;
  // Seams that will exist once a beam turns, so you can line them up (and frame them) ahead of time.
  futures=[];
  for(const m of movers){
    if(m.moving||!canTurn(m))continue;
    const world=actuation(level,positions(),m.i,cells).cells;
    // An existing seam can become visible when a beam moves out of its sightline, too.
    for(const s of seamsIn(world))futures.push({id:s.id,seam:s,world});
  }
  start=nodeOf(L.start);goal=nodeOf(L.goal);
  walker.node=old?nodeAt.get(key(old.x,old.y,old.z))??start:start;
  art.finish(blockGroup);
  for(const m of movers)batchArchitecture(m.group,shared);
  batchArchitecture(blockGroup,shared);
  relink(fresh);
}
let start=null,goal=null,goalSpin=null,smoke=[],plates=[];
const plateGeometry=new THREE.CylinderGeometry(.26,.28,.05,32),plateMaterial=new THREE.MeshStandardMaterial({color:0xf8cd72,metalness:.55,roughness:.3});
const plateRimGeometry=new THREE.CylinderGeometry(.34,.36,.05,32),plateRimMaterial=new THREE.MeshStandardMaterial({color:0xa07438,metalness:.7,roughness:.36});
const plateRingGeometry=new THREE.RingGeometry(.36,.42,40);
shared.add(plateGeometry);shared.add(plateRimGeometry);shared.add(plateRingGeometry);
// The top of a plate: gold, with a lavender arrow showing how its beam turns (spin 1 anticlockwise seen
// from above, -1 clockwise, 0 a beam that swings back and forth). The cap's texture is not mirrored.
const plateGlyphs=new Map();
function plateGlyph(spin){
  if(!plateGlyphs.has(spin))plateGlyphs.set(spin,new THREE.MeshBasicMaterial({map:canvasTexture(128,(g,n)=>{
    const c=n/2,r=n*.3;g.fillStyle='#ffd36b';g.fillRect(0,0,n,n);
    const glow=g.createRadialGradient(c,c,4,c,c,c);glow.addColorStop(0,'#fff1c4');glow.addColorStop(1,'#ffd36b');g.fillStyle=glow;g.beginPath();g.arc(c,c,c,0,7);g.fill();
    g.strokeStyle='#7a63b8';g.fillStyle='#7a63b8';g.lineWidth=10;g.lineCap='round';
    const head=(a,dir)=>{const x=c+r*Math.cos(a),y=c+r*Math.sin(a),tx=-Math.sin(a)*dir,ty=Math.cos(a)*dir,nx=Math.cos(a),ny=Math.sin(a);
      g.beginPath();g.moveTo(x+tx*16,y+ty*16);g.lineTo(x+nx*13-tx*4,y+ny*13-ty*4);g.lineTo(x-nx*13-tx*4,y-ny*13-ty*4);g.closePath();g.fill();};
    // Anticlockwise on screen is decreasing canvas angle (the canvas y axis points down).
    if(spin==='slide'){
      g.beginPath();g.moveTo(c-30,c);g.lineTo(c+30,c);g.moveTo(c-15,c-14);g.lineTo(c-30,c);g.lineTo(c-15,c+14);g.moveTo(c+15,c-14);g.lineTo(c+30,c);g.lineTo(c+15,c+14);g.stroke();
    }else if(spin==='lift'){
      g.beginPath();g.moveTo(c-16,c+27);g.lineTo(c-16,c-27);g.moveTo(c-29,c-12);g.lineTo(c-16,c-27);g.lineTo(c-3,c-12);g.moveTo(c+16,c-27);g.lineTo(c+16,c+27);g.moveTo(c+3,c+12);g.lineTo(c+16,c+27);g.lineTo(c+29,c+12);g.stroke();
    }else if(spin==='linked'){
      for(const x of [c-19,c+19]){g.beginPath();g.arc(x,c,21,.4,Math.PI*1.8);g.stroke();}g.beginPath();g.moveTo(c-7,c);g.lineTo(c+7,c);g.stroke();
    }else if(spin){const a0=spin>0?.6:-.6+Math.PI,a1=spin>0?-3.6:3.6+Math.PI;g.beginPath();g.arc(c,c,r,a0,a1,spin>0);g.stroke();head(a1,spin>0?-1:1);}
    else{g.beginPath();g.arc(c,c,r,-2.4,-.74);g.stroke();head(-.74,1);head(-2.4,-1);g.beginPath();g.arc(c,c,r,.74,2.4);g.stroke();head(2.4,1);head(.74,-1);}
  })}));
  return plateGlyphs.get(spin);
}
// Plates breathe a gold ring (strongly while the coach is pointing at them), sink while stood on, and spin with their beam.
function animatePlates(dt){
  const lesson=coach.lessonId==='plate'&&!$('coach').hidden;
  for(const [i,p] of plates.entries()){
    if(!p.pad)continue;
    const on=walker.node&&sameSpot(walker.node,p.at),k=reducedMotion()?.25:(elapsed*.8+i*.37)%1;
    p.pad.position.y+=((on?.035:.06)-p.pad.position.y)*Math.min(1,dt*12);
    p.ring.scale.setScalar(1+k*(lesson?1.4:.5));p.ring.material.opacity=(1-k)*(lesson?.85:.35);
    if(movers[i]?.moving&&!movers[i].travel)p.pad.rotation.y+=(p.spin||1)*dt*3;
  }
}
// Stone eyes: an eye on a stone that turns its beam when photographed from the front.
let eyes=[];
function buildEyes(){
  eyes=(level.eyes??[]).map(e=>{
    const g=new THREE.Group(),ball=new THREE.Group();g.position.set(e.at[0],e.at[1]+.85,e.at[2]);g.rotation.y=Math.atan2(e.face[0],e.face[1]);
    ball.add(new THREE.Mesh(new THREE.SphereGeometry(.26,24,18),surfaceMaterial('marble',{color:0xfdf8ef,roughness:.56})));
    const iris=new THREE.Mesh(new THREE.CircleGeometry(.13,24),new THREE.MeshBasicMaterial({color:0x3d3a6b}));iris.position.z=.255;ball.add(iris);
    const pupil=new THREE.Mesh(new THREE.CircleGeometry(.055,20),new THREE.MeshBasicMaterial({color:0xffd36b}));pupil.position.z=.258;ball.add(pupil);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(.3,.045,10,32),surfaceMaterial('metal',{color:0xc98f2e,metalness:.38,roughness:.42}));g.add(ball,rim);
    levelGroup.add(g);
    return {...e,g,ball,blinkAt:-9,point:g.position.clone()};
  });
}
function animateEyes(){
  for(const e of eyes){
    const pose=eyePose(level,positions(),e),host=movers.find(m=>m.blocks.some(b=>b.slice(0,3).join()===e.at.join()));
    e.point.fromArray(pose.point);e.g.position.copy(e.point);let turn=Math.atan2(pose.face[0],pose.face[2]);
    if(host?.moving){e.g.position.sub(new V3(...host.pivot)).applyEuler(host.group.rotation).add(host.group.position);if(!e.shy)turn+=host.group.rotation.y;}
    if(e.shy&&movers[e.beam]?.moving)turn+=movers[e.beam].group.rotation.y;
    e.g.rotation.y=turn;
    const blink=Math.max(0,1-Math.abs(elapsed-e.blinkAt-.15)/.15);e.ball.scale.y=1-.9*blink;
    if(!reducedMotion())e.g.position.y+=Math.sin(elapsed*1.6+e.at[0])*.035;
  }
}
// Home: a little doorway with a pitched roof and a warm light inside. The traveller walks into it.
let goalLight=null,goalLandmark=null;
function buildMarkers(){
  smoke=[];homeFlags=[];
  goalLight=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0xffd36b,transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false}));
  goalSpin=new THREE.Mesh(new THREE.OctahedronGeometry(.1),new THREE.MeshBasicMaterial({color:0xfff6d8}));
  const place=theme?.name??'Home',detailed=createDestinationHouse(place,{light:goalLight,spin:goalSpin});
  const g=detailed??(theme?.home?dressLandmark(theme.home(palette,{light:goalLight,spin:goalSpin}),place,{light:goalLight}):createDestinationHouse('Home',{light:goalLight,spin:goalSpin}));
  refineDestination(g,place,{light:goalLight,spin:goalSpin});goalLandmark=g;
  homeFlags=g.userData.flags??[];
  if(place==='Home')smoke=[0,1,2,3].map(i=>{const p=new THREE.Sprite(new THREE.SpriteMaterial({map:softGlow,color:palette.dark?0xb8bfe0:0xffffff,transparent:true,depthWrite:false,opacity:0}));p.userData.phase=i/4;g.add(p);return p;});
  const up=new V3(...pieceOf(level.blocks.find(b=>at3(b)===at3(level.goal))??level.goal).up);
  g.position.set(...level.goal).addScaledVector(up,.5);g.quaternion.copy(tiltOf(up));art.finish(g);levelGroup.add(g);
}

// ---------- Moving pieces: stepping onto a plate turns its beam about the pivot ----------
// A beam cannot turn into a spot something else already fills.
const canTurn=m=>actuation(level,positions(),m.i,cells).ok;
function startMove(m,others=[]){
  if(rewind||anyMoving())return false;
  const action=actuation(level,positions(),[m.i,...others],cells);
  if(!action.ok){flash('Something is in the path.');play('remove');return false;}
  for(const i of action.ids){const part=movers[i];part.moving=true;part.t=0;part.to=action.ks[i];part.turn=part.travel?0:positionsOf(part)===2&&part.k===1?-part.angle:part.angle;}
  buildWorld();play('mechanism');flash(action.ids.length>1?'The linked paths move together.':m.travel?(m.travel[1]?'Lift moving.':'Ferry moving.'):'Click!');
  const ride=action.ids.map(i=>movers[i]).find(part=>walker.node?.mover===part.i);
  if(ride){walker.ride=ride;ride.group.add(walkerMesh);walkerMesh.position.copy(top(walker.node)).sub(ride.group.position);}
  return true;
}
function updateMovers(dt){
  const finished=[];
  for(const m of movers){
    if(!m.moving)continue;
    m.t=Math.min(1,m.t+dt/1.1);const e=m.t*m.t*(3-2*m.t);
    if(m.travel)m.group.position.set(...m.pivot).addScaledVector(new V3(...m.travel),(m.to-m.k)*e);
    else m.group.rotation.y=m.turn*DEG*e;
    if(m.t>=1)finished.push(m);
  }
  if(!finished.length)return;
  let rideTo=null;
  if(walker.ride&&finished.includes(walker.ride)){
    const m=walker.ride;rideTo=riding(level,m.i,m.k,m.to,[walker.node.x,walker.node.y,walker.node.z]);walker.ride=null;scene.attach(walkerMesh);walkerTurn.rotation.y=walker.face+=(m.turn??0)*DEG;
  }
  for(const m of finished){m.moving=false;m.k=m.to;}
  cells=worldCells();buildWorld();if(rideTo)walker.node=nodeOf(rideTo)??walker.node;graphVersion++;
}
const sameSpot=(n,c)=>!!n&&!!c&&n.x===c[0]&&n.y===c[1]&&n.z===c[2];
const anyMoving=()=>movers.some(m=>m.moving);

// ---------- Seams: do two open ends line up from a given view? ----------
function screenOf(p,cam,w,h){const q=p.clone().project(cam);return {x:(q.x+1)/2*w,y:(1-q.y)/2*h,z:q.z};}
// The direction a camera looks from: a unit vector from the world toward the viewer.
const viewDir=cam=>cam.getWorldDirection(new V3()).negate().toArray();
// How far apart the end edge of one beam and the start edge of the other look, in edge widths
// (the same measure the solver uses). 0 means one continuous beam. Takes a pair or a seam.
function misalign(p,cam){return misalignAlong(p.seam??p,viewDir(cam));}
const seamPoint=p=>new V3(...seamEdges(p.seam??p)[0][0]);
// Lined up and seen without anything in the way, looking the way this camera looks.
const lined=(p,cam)=>linesUp(p.seam??p,viewDir(cam),ALIGN);
const joinsFrom=(p,cam,w=W,h=H,world=cells)=>lined(p,cam)&&sightClear(p.seam,viewDir(cam),world);
const photoContains=(p,poly,cam=camera,w=W,h=H)=>seamWithin(p.seam??p,v=>pointInPolygon(poly,screenOf(new V3(...v),cam,w,h)));
function linkedIds(){return new Set(frames.flatMap(f=>f.links.map(p=>p.id)));}
function photoPreview(poly,cam=camera,w=W,h=H){
  if(anyMoving())return {moving:true,ready:0,waiting:0,near:false,cropped:false,blocked:0};
  const inside=p=>photoContains(p,poly,cam,w,h);
  const candidates=pairs.filter(p=>inside(p)&&lined(p,cam));
  const ready=new Set(candidates.filter(p=>sightClear(p.seam,viewDir(cam),cells)).map(p=>p.id));
  const waiting=new Set(futures.filter(p=>!ready.has(p.id)&&inside(p)&&joinsFrom(p,cam,w,h,p.world)).map(p=>p.id));
  const near=[...pairs.map(p=>({...p,world:cells})),...futures].some(p=>inside(p)&&linesUp(p.seam,viewDir(cam),SNAP_WINDOW)&&sightClear(p.seam,reachable(seamLine(p.seam).u),p.world));
  const cropped=pairs.some(p=>!inside(p)&&pointInPolygon(poly,screenOf(seamPoint(p),cam,w,h))&&joinsFrom(p,cam,w,h));
  const includes=p=>{const q=screenOf(new V3(...p),cam,w,h);return q.z<1&&pointInPolygon(poly,q);};
  const mask=photographedEyes(level,positions(),viewDir(cam),cells,includes),reacting=(level.eyes??[]).filter((_,i)=>mask>>i&1);
  const hides=level.shy?.length?photoEffectData({poly,cam,w,h}).vanished.size:0;
  return {ready:ready.size,waiting:waiting.size,near,cropped,blocked:candidates.filter(p=>!ready.has(p.id)&&!waiting.has(p.id)).length,
    orbs:reacting.length,orbBlocked:reacting.length>0&&!actuation(level,positions(),reacting.map(e=>e.beam),cells).ok,hides};
}
function replacementPreview(poly){
  if(frames.length<level.frames)return null;
  const replace=frames.findIndex(canDrop),index=Math.max(0,replace),outgoing=frames[index],remaining=frames.filter(f=>f!==outgoing),kept=new Set(remaining.flatMap(f=>f.links.map(p=>p.id)));
  for(const p of pairs)if(joinsFrom(p,camera)&&photoContains(p,poly))kept.add(p.id);
  if(labWorld()){
    const held=remaining.slice(),before=worldCells(held),next={cam:camera,poly,w:W,h:H};Object.assign(next,photoEffectData(next,before));held.push(next);
    const after=worldCells(held),possible=seamsIn(after).map(seam=>({seam,id:seam.id}));kept.clear();
    for(const f of held)for(const p of possible)if(joinsFrom(p,f.cam,f.w,f.h,after)&&photoContains(p,f.poly,f.cam,f.w,f.h))kept.add(p.id);
  }
  return {outgoing,index,lost:[...new Map(frames.flatMap(f=>f.links).map(p=>[p.id,p])).values()].filter(p=>!kept.has(p.id)),blocked:replace<0};
}

// ---------- Frames: each keeps the view it was made from ----------
// A join that came true is marked by a fine line of light between the two edges it joins (the walker
// crosses along it). From its photo's view the line is a point and the two paths simply meet.
const ribbonMaterial=new THREE.MeshBasicMaterial({color:0xbff0fb,transparent:true,opacity:.5,depthWrite:false,fog:false}),seamMaterial=new THREE.MeshBasicMaterial({color:0x9fe3f2});
const bridgeEdgeMaterial=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.9,depthWrite:false,fog:false});
// Sparkles: soft points of light that drift and fade (joins, the way home, the air around the island).
const glowTexture=canvasTexture(64,(g,n)=>{const r=g.createRadialGradient(n/2,n/2,0,n/2,n/2,n/2);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.25,'rgba(255,255,255,.75)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,n,n);});
let sparks=[];
function sparkle(at,{count=14,spread=.35,speed=1.2,rise=.6,color=0xbff4ff,life=1.1,size=.22,along=null}={}){
  if(reducedMotion())return;
  if(settings.quality==='low')count=Math.min(count,4);
  for(let i=0;i<count;i++){
    const m=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture,color,transparent:true,depthWrite:false,fog:false,blending:THREE.AdditiveBlending}));
    const dir=new V3(Math.random()-.5,Math.random()*.6,Math.random()-.5).normalize();
    m.position.copy(at).addScaledVector(dir,Math.random()*spread);
    const vel=along?along.clone().multiplyScalar(.6+Math.random()*.8).add(dir.multiplyScalar(.25)):dir.multiplyScalar(speed*(.4+Math.random()*.6)).add(new V3(0,rise,0));
    const sz=size*(.5+Math.random());m.scale.setScalar(sz);scene.add(m);
    sparks.push({m,vel,born:elapsed,life:life*(.6+Math.random()*.6),size:sz});
  }
}
function updateSparks(dt){
  sparks=sparks.filter(s=>{
    const t=(elapsed-s.born)/s.life;
    if(t>=1){s.m.removeFromParent();s.m.material.dispose();return false;}
    s.m.position.addScaledVector(s.vel,dt);s.vel.multiplyScalar(1-dt*1.5);
    s.m.material.opacity=Math.sin(Math.PI*Math.min(1,t*1.4))*(1-t);s.m.scale.setScalar(s.size*(1+t*.5));return true;
  });
}
// The point under a screen position, depth in front of the camera.
function screenToWorld(p,depth){
  return new V3(p.x/W*2-1,1-p.y/H*2,-1).unproject(camera).addScaledVector(camera.getWorldDirection(new V3()),depth-camera.near);
}
// A frame joins every seam that lines up inside it, from its own view. This is checked again
// whenever the world moves, so a frame can wait for a beam that has not swung into place yet.
// A join that is new to its frame plays the lock-in: the thread zips across, the edges flare, the
// pane flashes, and a chord sounds. This also happens when a beam turns into a frame that was waiting.
let bursts=[];
function relink(fresh=null){
  const born=[];
  for(const f of frames){
    f.links=pairs.filter(p=>joinsFrom(p,f.cam,f.w,f.h)&&photoContains(p,f.poly,f.cam,f.w,f.h));
    f.thumbnailDirty=true;
    f.ribbons.children.slice().forEach(c=>{c.removeFromParent();c.traverse(o=>{o.geometry?.dispose();o.material?.dispose?.();});});
    for(const p of f.links){
      const r=ribbon(p),isNew=!f.shown.has(p.id);r.userData.born=isNew&&!rewind?elapsed:-9;f.ribbons.add(r);
      if(isNew){f.shown.add(p.id);f.flashAt=elapsed;born.push(p);}
    }
  }
  if(born.length&&!rewind){
    play('join');waveAt=elapsed;
    for(const p of born){const a=seamPoint(p),b=new V3(...p.seam.eb.mid);sparkle(a,{count:18});sparkle(b,{count:10});sparkle(a,{count:10,along:b.clone().sub(a),life:1.3,size:.18});}
    const glow=$('glow');glow.classList.remove('pop');void glow.offsetWidth;glow.classList.add('pop');
    for(const p of born)bursts.push({points:[seamPoint(p),new V3(...p.seam.eb.mid)],at:elapsed});
  }
  graphVersion++;
}
function animateJoins(){
  for(const f of frames){
    f.group.visible=vr.on;
    // From its own direction a photo fades away, so you see the live world through it exactly where it
    // lines up; from elsewhere it is a floating print. It develops (the haze clears) once it comes true.
    const off=angleBetween(viewDir(f.cam),viewDir(camera)),seen=Math.min(1,Math.max(0,(off-2)/18));
    const developed=f.flashAt>0?Math.min(1,(elapsed-f.flashAt)/1.4):0;
    const life=level.fade?Math.min(1,Math.max(0,(level.fade-(elapsed-f.born))/(level.fade*.4))):1;
    const v=viewDir(camera),n=viewDir(f.cam),facing=Math.abs(v[0]*n[0]+v[1]*n[1]+v[2]*n[2]),edgeOn=Math.min(1,Math.max(0,(facing-.18)/.25));
    // In a headset a print would hang in the air from every side. It shrinks away to a small faint card
    // and opens out again as you come round toward the view it was taken from (and just after the shot).
    let shown=1;
    if(vr.on){
      const want=Math.max(1-Math.min(1,Math.max(0,(off-10)/18)),Math.max(0,1-(elapsed-f.born)/2.5));
      f.vrShow??=want;f.vrShow+=(want-f.vrShow)*Math.min(1,Math.max(0,elapsed-(f.vrAt??elapsed))*5);f.vrAt=elapsed;
      shown=f.vrShow*f.vrShow*(3-2*f.vrShow);const k=.12+.88*shown,c=f.middle??=f.corners.reduce((a,p)=>a.add(p),new V3()).multiplyScalar(1/f.corners.length);
      f.group.scale.setScalar(k);f.group.position.copy(c).multiplyScalar(1-k);f.group.visible=shown>.02;
    }else if(f.vrShow!=null){f.vrShow=null;f.group.scale.setScalar(1);f.group.position.set(0,0,0);}
    f.photo.material.opacity=seen*.95*life*edgeOn*shown;f.border.material.opacity=(.25+seen*.75)*edgeOn*shown;f.haze.material.opacity=(seen*(.75-.65*developed)+Math.max(0,1-(elapsed-f.born)/.6)*.9)*edgeOn*shown;
    // The line is the illusion's secret: from its photo's view (and just around it) it is not there and
    // the two paths simply meet; turn away and it fades in.
    const reveal=Math.min(1,Math.max(0,(off-1.5)/6));
    for(const r of f.ribbons.children){
      const {thread}=r.userData,m=thread.material;m.opacity=ribbonMaterial.opacity*reveal;m.visible=reveal>0;
      thread.children[0].material.opacity=bridgeEdgeMaterial.opacity*reveal;
      const t=(elapsed-r.userData.born)/.7;if(t>1.6){r.userData.thread.userData.grow(1);continue;}
      const e=Math.min(1,t),ease=1-(1-e)**3,{edges}=r.userData;
      thread.userData.grow(ease);
      const flare=1+Math.max(0,Math.sin(Math.PI*Math.min(1,t/1.6)))*.9;for(const g of edges)g.scale.set(flare,1+(flare-1)*2,flare);
    }
  }
  bursts=bursts.filter(b=>elapsed-b.at<.9);
}
function addFrame(poly){
  if(story.open)return;
  if(complete||rewind)return;
  if(anyMoving()){flash('Wait for the beam to finish turning.');return;}
  const outgoing=frames.length>=level.frames?frames.find(canDrop):null;
  if(frames.length>=level.frames&&!outgoing){flash(NO_DROP());play('stuck');return;}
  remember('photo');
  clearTimeout(snapTimer);
  settlePhoto(poly);
  if(outgoing){const number=frames.indexOf(outgoing)+1;removeFrame(outgoing,false);flash(`Photo ${number} replaced.`);}
  // Keep the flat preview in the desktop tray. The world-space print is retained for VR.
  play('shutter');walkerFlashAt=elapsed;const bulb=$('flashbulb');bulb.classList.remove('pop');void bulb.offsetWidth;bulb.classList.add('pop');
  const frame=makeFrame(poly,camera,W,H,{target:target.clone(),yaw,pitch,zoom});
  if(vr.on){scene.updateMatrixWorld(true);frame.eye=scene.worldToLocal(vr.cam.position.clone());}
  frames.push(frame);photosTaken++;
  frameTool=false;feedback=null;
  photoEffects(frame);relink(frame);
  photoInspection={frame,action:'keep',until:elapsed+4};
  if(!frame.links.length&&!frame.ghosts.size&&!frame.vanished.size&&!frame.woke){
    const preview=photoPreview(poly);
    if(preview.waiting)flash('Photo waiting for a turn.');
    else if(preview.cropped)flash('Keep both edges inside the photo.');
    else{
      feedback=diagnoseConnection(cells,viewDir(camera),p=>pointInPolygon(poly,project(new V3(...p))));
      if(feedback)feedback.until=elapsed+4;
      flash(feedback?.kind==='rail'?'This edge has a railing.':feedback?.kind==='blocked'?'This block hides the crossing.':feedback?.kind==='offset'?'These edges are still apart.':'No open edges in this photo.',2800);
    }
  }
  if(practice.force!==level.name&&!lessonSeen.has(level.name)&&lessonMilestone(level.name,{links:frame.links.length,waiting:photoPreview(poly).waiting,hidden:frame.vanished.size})){
    skipPractice();
    if(level.name==='The Photo Waits')flash('Keep this photo. Click the plate to ride the lift.',6500);
    else if(level.name==='Out of Sight')flash('The stone stays hidden while you keep this photo.',5000);
  }
  recordTemporal(true);
}
function makeFrame(poly,cam,w,h,view){
  const forward=cam.getWorldDirection(new V3()),depth=FAR-radius-2;
  const corners=poly.map(p=>new V3(p.x/w*2-1,1-p.y/h*2,-1).unproject(cam).addScaledVector(forward,depth-cam.near));
  const thumbnail=photoThumbnail(poly,cam,w,h),print=snapshot(cam),group=new THREE.Group(),ribbons=new THREE.Group();
  const quad=(pts,uvs)=>{const g=new THREE.BufferGeometry().setFromPoints(pts);if(uvs)g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));return g;};
  const [a,b,c,d]=corners,uv=poly.map(p=>[p.x/w,1-p.y/h]);
  const photo=new THREE.Mesh(quad([a,b,c,a,c,d],[uv[0],uv[1],uv[2],uv[0],uv[2],uv[3]].flat()),new THREE.MeshBasicMaterial({map:print.texture,transparent:true,side:THREE.DoubleSide,depthWrite:false,fog:false}));
  // Until it comes true the photo is pale, as if still developing.
  const haze=new THREE.Mesh(photo.geometry,new THREE.MeshBasicMaterial({color:0xfffaf0,transparent:true,side:THREE.DoubleSide,depthWrite:false,fog:false}));
  // The white polaroid border, wider at the bottom.
  const r=b.clone().sub(a).normalize(),dn=d.clone().sub(a).normalize(),rim=view.zoom*.035,bw=rim*3.2;
  const O=[a.clone().addScaledVector(r,-rim).addScaledVector(dn,-rim),b.clone().addScaledVector(r,rim).addScaledVector(dn,-rim),c.clone().addScaledVector(r,rim).addScaledVector(dn,bw),d.clone().addScaledVector(r,-rim).addScaledVector(dn,bw)];
  const ring=[];for(let i=0;i<4;i++){const j=(i+1)%4;ring.push(O[i],O[j],corners[j],O[i],corners[j],corners[i]);}
  const border=new THREE.Mesh(quad(ring),new THREE.MeshBasicMaterial({color:0xfbf7ee,transparent:true,side:THREE.DoubleSide,depthWrite:false,fog:false}));
  group.add(photo,haze,border);scene.add(group);scene.add(ribbons);
  const frame={cam:cam.clone(),poly:structuredClone(poly),w,h,view,corners,links:[],group,ribbons,born:elapsed+(++photoSerial)*.00001,print,thumbnail,photo,haze,border,shown:new Set(),flashAt:-9};
  group.visible=vr.on;
  return frame;
}
let photoSerial=0,feedback=null;
// Finish the shutter on the closest valid alignment instead of freezing camera easing mid-join.
function settlePhoto(poly){
  // Check occlusion at the destination of the small camera correction. Before correction,
  // one edge may slightly cover its partner; that is exactly what the snap resolves.
  const captured=[...pairs.map(p=>({...p,world:cells})),...futures].filter(p=>photoContains(p,poly)&&linesUp(p.seam,viewDir(camera),SNAP_WINDOW)&&sightClear(p.seam,reachable(seamLine(p.seam).u),p.world));
  if(!captured.length)return;
  const unique=[...new Map(captured.map(p=>[p.id,p])).values()],v=viewDir(camera);
  // Preserve an already usable join, but finish a tiny correction if alignment
  // passes before visibility does. Nearby future joins cannot pull away a valid photo.
  if(unique.some(p=>linesUp(p.seam,v,ALIGN)&&sightClear(p.seam,v,p.world)))return;
  let best=v,count=0,off=Infinity,anchor=seamPoint(unique[0]);
  // Choose one exact direction. Two merely similar directions must never be averaged into
  // two visibly broken connections; another photo can hold the second direction.
  for(const d of unique.map(p=>reachable(seamLine(p.seam).u))){
    const hits=unique.filter(p=>linesUp(p.seam,d,ALIGN)&&sightClear(p.seam,d,p.world)),angle=angleBetween(v,d);
    if(hits.length>count||hits.length===count&&angle<off){best=d;count=hits.length;off=angle;anchor=seamPoint(hits[0]??unique[0]);}
  }
  if(!count)return;
  if(best===v)return;
  const before=project(anchor);
  lookAlong(best);snapCamera();const after=project(anchor);slide(before.x-after.x,before.y-after.y);snapCamera();
}
// The spare mechanics, decided when a photo is taken. Returns whether the world's blocks changed.
function photoEffectData(f,world=cells){
  const v=viewDir(f.cam),inPhoto=p=>{const q=screenOf(p,f.cam,f.w,f.h);return q.z<1&&pointInPolygon(f.poly,q);};
  // Ghost blocks inside the photo turn solid.
  const ghosts=new Set((level.ghosts??[]).filter(b=>inPhoto(new V3(...b))).map(at3));
  // Shy stones inside the photo that it cannot see (every corner hidden behind something) vanish.
  const vanished=new Set();
  const standing=walker.node&&key(walker.node.x,walker.node.y,walker.node.z);
  for(const b of level.shy??[]){
    const k=at3(b);if(!world.has(k)||k===standing||!inPhoto(new V3(...b)))continue;
    // In a headset, each stone is judged along the line from it to your eyes, as you saw it.
    if(stoneHidden(world,b,f.eye?f.eye.clone().sub(new V3(...b)).normalize().toArray():v))vanished.add(k);
  }
  return {ghosts,vanished};
}
function photoEffects(f){
  Object.assign(f,photoEffectData(f));
  if(f.vanished.size||f.ghosts.size)photosChanged(f);
  const v=viewDir(f.cam),inside=p=>{const q=screenOf(new V3(...p),f.cam,f.w,f.h);return q.z<1&&pointInPolygon(f.poly,q);};
  const mask=photographedEyes(level,positions(),v,cells,inside),beams=[];
  for(const [i,e] of eyes.entries())if(mask>>i&1){e.blinkAt=elapsed;f.woke=true;if(!beams.includes(e.beam))beams.push(e.beam);}
  if(beams.length){const moved=startMove(movers[beams[0]],beams.slice(1));flash(moved?'The orb blinked and turned the path.':'The orb blinked. Its path is blocked.');}
  else if(f.vanished.size)flash('Hidden stone removed.');
  else if(f.ghosts.size)flash('Path held by photo.');
}
// The scene as the camera sees it now, on an opaque sky, for printing on a photo.
function snapshot(cam=camera){
  const size=renderer.getDrawingBufferSize(new THREE.Vector2()),scale=Math.min(1,640/Math.max(size.x,size.y)),rt=new THREE.WebGLRenderTarget(Math.round(size.x*scale),Math.round(size.y*scale));
  const clear=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();
  renderer.setClearColor(new THREE.Color(palette.sky[1]),1);renderFlat(rt,cam);renderer.setClearColor(clear,alpha);
  return rt;
}
// A line of light across the gap. From the frame's view it shrinks to a point and the paths look whole.
function ribbon(p){
  const a=seamPoint(p),b=new V3(...p.seam.eb.mid),g=new THREE.Group();
  // A fine line of light from one edge to the other: a soft glow round a bright core. In its own space y
  // runs from a to b and x and z are square across it, so the line keeps its thickness at any length.
  const span=b.clone().sub(a),dir=span.clone().normalize(),x=new V3(0,1,0).cross(dir);
  if(x.lengthSq()<1e-4)x.set(1,0,0).cross(dir);
  x.normalize();const z=dir.clone().cross(x);
  // Its own materials, so each line can fade by itself (see animateJoins).
  const tube=r=>new THREE.CylinderGeometry(r,r,1,10,1,true).translate(0,.5,0);
  const thread=new THREE.Mesh(tube(.05),ribbonMaterial.clone());thread.matrixAutoUpdate=false;
  thread.add(new THREE.Mesh(tube(.018),bridgeEdgeMaterial.clone()));
  // grow(f): the line reaches f of the way across (it draws out from a when a join comes true)
  thread.userData.grow=f=>{thread.matrix.makeBasis(x,span.clone().multiplyScalar(Math.max(.001,f)),z).setPosition(a);thread.matrixWorldNeedsUpdate=true;};
  thread.userData.grow(1);g.add(thread);
  const edges=[];
  g.userData={a,b,thread,edges};
  return g;
}
function removeFrameObject(f){f.print?.dispose();for(const g of [f.group,f.ribbons]){g.removeFromParent();g.traverse(o=>{o.geometry?.dispose();o.material?.dispose?.();});}}
// Whether a photo can be dropped: the stones only it hides would come back, so their places must be clear.
function canDrop(f){
  if(!f.vanished?.size)return true;
  const w=walker.node,head=w&&key(w.x,w.y+1,w.z),still=new Set(frames.filter(o=>o!==f).flatMap(o=>[...(o.vanished??[])]));
  return [...f.vanished].every(k=>still.has(k)||k!==head&&!cells.has(k));
}
const NO_DROP=()=> 'Move away before removing this photo.';
function removeFrame(f,record=true){
  if(rewind)return;
  const i=frames.indexOf(f);if(i<0)return;
  if(record)remember('photo');frames.splice(i,1);f.group.removeFromParent();f.ribbons.removeFromParent();retiredFrames.add(f);releaseUnusedFrames();
  graphVersion++;if(f.ghosts?.size||f.vanished?.size)photosChanged();
}
function project(v){const p=v.clone().project(camera);return {x:(p.x+1)/2*W,y:(1-p.y)/2*H,z:p.z};}
function deleteSpot(f){
  if(!vr.on){const b=$('film').querySelector(`[data-remove="${frames.indexOf(f)}"]`);if(!b)return null;const r=b.getBoundingClientRect();return r.width?{x:r.x+r.width/2,y:r.y+r.height/2}:null;}
  const pts=f.corners.map(project);if(pts.some(p=>p.z>1||p.z<-1))return null;
  const cx=pts.reduce((s,p)=>s+p.x,0)/4,cy=pts.reduce((s,p)=>s+p.y,0)/4;
  const corner=pts.reduce((best,p)=>p.x-p.y>best.x-best.y?p:best),dx=corner.x-cx,dy=corner.y-cy,l=Math.hypot(dx,dy)||1;
  return {x:corner.x+dx/l*18,y:corner.y+dy/l*18};
}
function hitDelete(x,y,tol=1){for(let i=frames.length-1;i>=0;i--){const d=deleteSpot(frames[i]);if(d&&Math.hypot(x-d.x,y-d.y)<14*tol)return frames[i];}return null;}

// ---------- The walker: goes as far as it can, presses switches, and crosses joins ----------
// walkerMesh leans with the gravity of the surface underfoot; walkerTurn turns to face the way it walks.
const walkerMesh=new THREE.Group(),walkerTurn=new THREE.Group(),walkerBody=new THREE.Group(),walkerParts={};walkerMesh.add(walkerTurn);walkerTurn.add(walkerBody);
// Soft round shading from a painted light (a matcap), so the traveller looks smooth and lit without any
// lights in the scene; every part can fade, for going in through the door.
const softLight=canvasTexture(128,(g,n)=>{const r=g.createRadialGradient(n*.4,n*.32,n*.04,n*.5,n*.5,n*.52);r.addColorStop(0,'#ffffff');r.addColorStop(.55,'#f1ecf0');r.addColorStop(.85,'#e4d9dc');r.addColorStop(1,'#cdbfc6');g.fillStyle=r;g.fillRect(0,0,n,n);});
const walkerMaterials=[];
{const flat=(color,alpha=1,map=null)=>{const m=new THREE.MeshMatcapMaterial({color,matcap:softLight,transparent:true,map});m.userData.alpha=alpha;walkerMaterials.push(m);return m;},add=(mesh,x,y,z)=>{mesh.position.set(x,y,z);walkerBody.add(mesh);return mesh;};
 // A soft shadow on the ground, so you can tell which block the traveller stands on.
 const shadowMaterial=new THREE.MeshBasicMaterial({color:0x2b2140,transparent:true,opacity:.16,depthWrite:false});walkerParts.shadow=shadowMaterial;
 const shadow=new THREE.Mesh(new THREE.CircleGeometry(.2,40),shadowMaterial);shadow.rotation.x=-Math.PI/2;shadow.position.y=.012;walkerMesh.add(shadow);
 // A bell-shaped cloak (a smooth curve turned on a lathe), a round face, a wide-brimmed hat with a band.
 const outline=new THREE.SplineCurve([[0,0],[.185,0],[.18,.06],[.15,.2],[.115,.34],[.085,.43],[.04,.47],[0,.475]].map(([x,y])=>new THREE.Vector2(x,y))).getPoints(40);
 const cloak=flat(0xfffaf2);add(new THREE.Mesh(new THREE.LatheGeometry(outline,64),cloak),0,0,0);
 add(new THREE.Mesh(new THREE.SphereGeometry(.095,40,30),flat(0xffe6d2)),0,.55,0);
 const hat=new THREE.Group(),felt=flat(0x3d3a6b);walkerBody.add(hat);
 const brim=new THREE.Mesh(new THREE.CylinderGeometry(.17,.17,.018,64),felt);brim.position.y=.63;brim.rotation.x=-.12;hat.add(brim);
 const crown=new THREE.Mesh(new THREE.CapsuleGeometry(.075,.06,10,40),felt);crown.position.y=.7;hat.add(crown);
 const band=new THREE.Mesh(new THREE.CylinderGeometry(.083,.083,.03,64),flat(0xe2725b));band.position.y=.655;hat.add(band);
 // Two dark eyes, looking where it walks.
 for(const s of [-1,1])add(new THREE.Mesh(new THREE.SphereGeometry(.014,16,12),flat(0x2b2140)),s*.035,.56,.085);
 // A teal scarf, with a tail that streams out behind when walking.
 const scarf=add(new THREE.Mesh(new THREE.TorusGeometry(.075,.026,20,48),flat(0x3fb8a8)),0,.46,0);scarf.rotation.x=Math.PI/2;
 const tail=new THREE.Group();tail.position.set(.04,.46,-.07);walkerBody.add(tail);walkerParts.scarf=[scarf,tail];
 const tailMesh=new THREE.Mesh(new THREE.CapsuleGeometry(.024,.15,8,20),flat(0x35a596));tailMesh.scale.z=.45;tailMesh.position.y=-.1;tail.add(tailMesh);walkerParts.tail=tail;
 // The camera on its strap, with a lens that lights up when a photo is taken.
 const box=add(new THREE.Mesh(new THREE.CapsuleGeometry(.035,.06,8,24),flat(0x2b2140)),0,.3,.13);box.rotation.z=Math.PI/2;box.scale.z=.7;
 const lensMaterial=new THREE.MeshBasicMaterial({color:0xffd36b,transparent:true});lensMaterial.userData.alpha=1;walkerMaterials.push(lensMaterial);
 const lens=add(new THREE.Mesh(new THREE.CylinderGeometry(.024,.024,.03,32),lensMaterial),0,.3,.162);lens.rotation.x=Math.PI/2;walkerParts.lens=lens;
 // A short arm that rests against the cloak, for waving.
 const arm=new THREE.Group();arm.position.set(.105,.37,0);walkerBody.add(arm);
 const sleeveMaterial=flat(0xf3ece2),sleeve=new THREE.Mesh(new THREE.CapsuleGeometry(.03,.1,8,24),sleeveMaterial);sleeve.position.y=-.07;arm.add(sleeve);
 const mitten=new THREE.Mesh(new THREE.SphereGeometry(.033,24,18),flat(0xffe6d2));mitten.position.y=-.15;arm.add(mitten);
 arm.rotation.z=.18;walkerParts.arm=arm;
 // Clothes for some places, over the usual cloak and hat. Each is a group shown only there.
 const outfit=parts=>{const g=new THREE.Group();g.visible=false;for(const [mesh,x,y,z] of parts){mesh.position.set(x,y,z);g.add(mesh);}walkerBody.add(g);return g;};
 const ring=(r,t,material,y)=>{const m=new THREE.Mesh(new THREE.TorusGeometry(r,t,20,64),material);m.rotation.x=Math.PI/2;return [m,0,y,0];};
 // Space: a round glass helmet on a collar, and a pack on the back.
 const pack=new THREE.Mesh(new THREE.CapsuleGeometry(.07,.12,8,24),flat(0xdfe4ec));pack.scale.z=.6;
 const glint=new THREE.Mesh(new THREE.SphereGeometry(.022,16,12),flat(0xffffff,.8));
 const suit=outfit([[new THREE.Mesh(new THREE.SphereGeometry(.15,40,30),flat(0xd8ecff,.3)),0,.56,0],ring(.09,.022,flat(0xb3bbc8),.46),[pack,0,.33,-.15],[glint,.06,.64,.11]]);
 // Ice and snow: a fur trim at the hem and the collar, and a knitted hat with a bobble.
 const fur=flat(0xfdf9f2),knit=flat(0xf1e4cc);
 const beanie=new THREE.Mesh(new THREE.SphereGeometry(.1,32,16,0,Math.PI*2,0,Math.PI/2),knit);beanie.scale.y=.9;
 const coat=outfit([ring(.18,.028,fur,.03),ring(.08,.03,fur,.46),[beanie,0,.6,0],[new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,.03,40),knit),0,.6,0],[new THREE.Mesh(new THREE.SphereGeometry(.035,20,14),flat(0xc8483f)),0,.7,0]]);
 // The beach: a striped swim ring round the middle.
 const stripes=canvasTexture(128,(g,n)=>{for(let i=0;i<8;i++){g.fillStyle=i%2?'#ffffff':'#ef6b5a';g.fillRect(i*n/8,0,n/8,n);}});
 const floaty=outfit([ring(.19,.055,flat(0xffffff,1,stripes),.25)]);
 walkerParts.dress=place=>{
   const space=place==='Space',cold=place==='Ice palace'||place==='Snowy mountains',beach=place==='Beach';
   suit.visible=space;coat.visible=cold;floaty.visible=beach;
   hat.visible=!space&&!cold;for(const p of walkerParts.scarf)p.visible=!space&&!cold;
   cloak.color.setHex(space?0xeef1f6:cold?0xc4473f:0xfffaf2);sleeveMaterial.color.setHex(space?0xe2e6ee:cold?0xb53f38:0xf3ece2);
   // At the beach the hat is a wide straw sun hat.
   felt.color.setHex(beach?0xead29a:0x3d3a6b);brim.scale.set(beach?1.35:1,1,beach?1.35:1);
 };
}
// A crumbling block falls away (a copy tumbles down and fades while the real one is gone).
let falling=[];
function crumbleAway(n){
  const k=key(n.x,n.y,n.z);if(fallen.has(k))return;
  fallen.add(k);photosChanged();play('fall');
  const piece=new THREE.Mesh(blockGeometry,crumbleMaterials.map(m=>{const c=m.clone();c.transparent=true;return c;}));piece.position.set(n.x,n.y,n.z);levelGroup.add(piece);
  falling.push({piece,t:0});
}
function updateFalling(dt){
  for(const f of falling){f.t+=dt;f.piece.position.y-=dt*(1+f.t*6);f.piece.rotation.x+=dt*.8;f.piece.material.forEach(m=>{m.opacity=Math.max(0,1-f.t/1.2);});}
  falling=falling.filter(f=>{if(f.t<1.2)return true;f.piece.removeFromParent();f.piece.material.forEach(m=>m.dispose());return false;});
}
// Fading photos: in a level with fade, a photo lasts that many seconds (never mid-crossing).
function updateFade(){
  if(!level.fade)return;
  for(const f of frames.slice())if(elapsed-f.born>level.fade&&walker.state!=='walking'&&!directing&&canDrop(f)){removeFrame(f);flash('The photo faded.');play('remove');}
}
// Small life: breathing when still, a bounce and a lean when walking, the scarf trailing behind.
let walkerFlashAt=-9;
let idleSince=0,waveAt=-9,walkPhase=0,doorSide=1;
const ease=(v,to,k,dt)=>v+(to-v)*Math.min(1,dt*k);
const smooth=x=>{x=Math.min(1,Math.max(0,x));return x*x*(3-2*x);};
function animateWalker(dt){
  const moving=walker.state==='walking',t=elapsed,calm=reducedMotion();
  if(moving||complete||calm)idleSince=t;
  const idle=t-idleSince,home=complete?(calm?3:t-winAt):-1,sitting=idle>14;
  if(moving)walkPhase+=dt/STEP_SECONDS*Math.PI;
  // On a wall the traveller stands sideways; crossing an inside corner, they tip over halfway across.
  const upA=walker.node?.up??Y_UP,upB=moving&&walker.next?walker.next.n.up:upA;
  walkerMesh.quaternion.slerpQuaternions(tiltOf(upA),tiltOf(upB),moving?smooth((walker.t-.3)/.4):1);
  // A calm walk: a small rise and fall, a gentle sway side to side, and turning smoothly into each step.
  walkerBody.position.y=ease(walkerBody.position.y,sitting?-.035:0,4,dt)+(moving&&!calm?Math.abs(Math.sin(walkPhase))*.025:0);
  walkerBody.rotation.z=ease(walkerBody.rotation.z,moving?Math.sin(walkPhase)*.07:0,10,dt);
  walkerBody.rotation.x=ease(walkerBody.rotation.x,moving?.07:0,6,dt);
  walkerBody.scale.set(1,1+(moving||calm?0:Math.sin(t*2)*.012)-(sitting?.08:0),1);
  if(!complete&&!walker.ride)walkerTurn.rotation.y+=wrapAngle(walker.face-walkerTurn.rotation.y)*Math.min(1,dt*12);
  // Where to look: at you while you line up a photo; otherwise a glance around now and then.
  const toCamera=wrapAngle(yaw-walkerTurn.rotation.y);
  const glance=idle>3&&!sitting?Math.sin(Math.floor(t/3.2)*2.3)*.6:0;
  if(!complete)walkerBody.rotation.y=ease(walkerBody.rotation.y,moving?0:aligned.length?toCamera:glance,3,dt);
  // The arm swings a little while walking, and waves when a photo comes true.
  let wave=t-waveAt<1.3;
  // Home: step out in front of the door, turn and wave to you, then turn and walk in through the light.
  let fade=1;
  if(complete){
    const g=top(goal).clone(),front=g.clone().add(new V3(0,0,.34*doorSide)),inside=g.clone().add(new V3(0,0,-.3*doorSide));
    const out=smooth(home/.45),inward=smooth((home-1.75)/.8);
    walkerMesh.position.copy(g).lerp(front,out).lerp(inside,inward);
    const faceOut=doorSide>0?0:Math.PI,faceIn=faceOut+Math.PI;
    walkerTurn.rotation.y+=wrapAngle((home<1.5?faceOut:faceIn)-walkerTurn.rotation.y)*Math.min(1,dt*8);
    walkerBody.rotation.y=ease(walkerBody.rotation.y,home>.45&&home<1.5?wrapAngle(yaw-walkerTurn.rotation.y):0,7,dt);
    wave=home>.6&&home<1.45;fade=1-smooth((home-2)/.5);
    if(home>1.75&&home<2.55)walkerBody.position.y=Math.abs(Math.sin((home-1.75)/STEP_SECONDS*Math.PI))*.025;
  }
  if(calm)wave=false;
  walkerParts.arm.rotation.z=wave?2.4+Math.sin(t*9)*.32:ease(walkerParts.arm.rotation.z,moving?.18+Math.sin(walkPhase)*.15:.18,8,dt);
  for(const m of walkerMaterials)m.opacity=fade*m.userData.alpha;walkerParts.shadow.opacity=.16*fade;walkerMesh.visible=fade>.01;
  walkerParts.tail.rotation.x=ease(walkerParts.tail.rotation.x,moving?.9:.15+Math.sin(t*1.7)*.06,5,dt);
  walkerParts.tail.rotation.z=Math.sin(t*(moving?9:2))*(moving?.15:.05);
  if(goalLight){const flare=complete?Math.sin(smooth((home-1.6)/1.6)*Math.PI):0;goalLight.material.opacity=.7+flare*.3;goalLight.scale.set(1,1+flare*.15,1);}
  const glow=Math.max(0,1-(t-walkerFlashAt)/.5);walkerParts.lens.material.color.setRGB(1,.83+.17*glow,.42+.58*glow);walkerParts.lens.scale.setScalar(1+glow*.8);
  updateTapGlow();
}
// A tapped tile glows softly for a moment (warm if the traveller can go there, rosy if not).
const tapGlow=new THREE.Mesh(new THREE.PlaneGeometry(.92,.92),new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,fog:false,map:canvasTexture(128,(g,n)=>{
  const r=g.createRadialGradient(n/2,n/2,n*.1,n/2,n/2,n*.5);r.addColorStop(0,'rgba(255,255,255,.9)');r.addColorStop(.7,'rgba(255,255,255,.45)');r.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=r;g.beginPath();g.roundRect(n*.04,n*.04,n*.92,n*.92,n*.18);g.fill();})}));
const tapFlat=new THREE.Quaternion().setFromAxisAngle(new V3(1,0,0),-Math.PI/2);tapGlow.renderOrder=2;
function updateTapGlow(){
  const a=tapMark?1-(elapsed-tapMark.at)/.9:0;
  if(a<=0){tapGlow.removeFromParent();return;}
  if(!tapGlow.parent)scene.add(tapGlow);
  tapGlow.position.copy(top(tapMark.n)).addScaledVector(tapMark.n.up??Y_UP,.015);tapGlow.quaternion.copy(tiltOf(tapMark.n.up??Y_UP)).multiply(tapFlat);tapGlow.material.color.setHex(tapMark.ok?0xfff1c8:0xffb3b3);tapGlow.material.opacity=Math.sin(Math.min(1,a*1.4)*Math.PI*.5)*.8;
}
scene.add(walkerMesh);
const walker={node:null,from:new V3(),to:new V3(),next:null,t:0,dur:STEP_SECONDS,path:[],state:'idle',version:-1,face:0};
function resetWalker(){
  idleSince=elapsed;waveAt=-9;walkPhase=0;walkerBody.rotation.set(0,0,0);walkerBody.position.y=0;walkerBody.scale.set(1,1,1);walkerTurn.rotation.y=walker.face=0;
  Object.assign(walker,{node:start,next:null,path:[],state:'idle',version:-1,dest:null,ride:null,via:null,t:0,dur:STEP_SECONDS});
  scene.add(walkerMesh);walker.from.copy(top(start));walker.to.copy(walker.from);
  // Dialogue pauses simulation immediately. Place the rendered traveller now,
  // rather than waiting for updateWalker to replace the previous level's pose.
  walkerMesh.position.copy(walker.from);walkerMesh.quaternion.copy(tiltOf(start.up??Y_UP));walkerMesh.visible=true;
  for(const material of walkerMaterials)material.opacity=material.userData.alpha;
  walkerParts.shadow.opacity=.16;walkerMesh.updateMatrixWorld(true);directing=false;tapMark=null;
}
function neighbours(n){
  const out=n.real.map(r=>({m:r.m,link:false,via:r.via}));
  for(const f of frames)for(const p of f.links){if(p.a===n)out.push({m:p.b,link:true});else if(p.b===n)out.push({m:p.a,link:true});}
  return out;
}
const linkFrame=(a,b)=>frames.find(f=>f.links.some(p=>p.a===a&&p.b===b||p.a===b&&p.b===a));
// Head for the goal once there is a way; otherwise go where the player sent it.
function routes(){
  const prev=new Map([[walker.node,null]]),queue=[walker.node];
  for(let q=0;q<queue.length;q++)for(const {m,link} of neighbours(queue[q]))if(!prev.has(m)){prev.set(m,{n:queue[q],link});queue.push(m);}
  return prev;
}
function chooseRoute(){
  const prev=routes(),route=n=>{const path=[];for(let c=n;c!==walker.node;c=prev.get(c).n)path.unshift({n:c,link:prev.get(c).link});return path;};
  if(goal&&prev.has(goal))return route(goal);
  if(walker.dest&&walker.dest!==walker.node&&prev.has(walker.dest))return route(walker.dest);
  walker.dest=null;return [];
}
// Arriving: the goal wins; a plate the walker was sent to gets pressed.
function arrive(n){
  if(n===goal){win();return;}
  if(n!==walker.dest)return;
  walker.dest=null;
  const i=plates.findIndex(p=>sameSpot(n,p.at));if(i>=0){startMove(movers[i]);}
}
// Send the walker to a block top (a tap or a pinch on it).
function sendWalker(n){
  if(story.open)return false;
  if(maker?.editing)return false;
  if(!n||complete||anyMoving()||rewind)return false;
  if(n===walker.node){flash(plates.some(p=>sameSpot(n,p.at))?'Step off and back on.':'Already there.');return false;}
  if(!routes().has(n)){flash('Can\'t get there yet.');play('remove');tapMark={n,ok:false,at:elapsed};return false;}
  remember('walk');
  walker.dest=n;graphVersion++;tapMark={n,ok:true,at:elapsed};return true;
}
let tapMark=null,history=[];
const retiredFrames=new Set(),HISTORY_LIMIT=32;
function releaseUnusedFrames(){
  const kept=new Set([...frames,...history.flatMap(s=>s.frames)]);
  for(const f of retiredFrames)if(!kept.has(f)){removeFrameObject(f);retiredFrames.delete(f);}
}
function remember(kind){
  if(!walker.node||rewind)return;
  recordTemporal(true);
  history.push({kind,ks:positions(),node:key(walker.node.x,walker.node.y,walker.node.z),fallen:[...fallen],frames:frames.slice(),
    view:{target:target.clone(),yaw,pitch,zoom}});
  if(history.length>HISTORY_LIMIT)history.shift();releaseUnusedFrames();
}
// A photo capture/replacement/removal is one transaction, just like a walk or switch press.
// Keep immutable photo cameras/prints; rebuild their live links against the restored world.
function undo(){
  if(complete||rewind||anyMoving()||walker.state==='walking'||walker.state==='waiting')return false;
  const s=history.pop();if(!s){flash('Nothing to undo.');return false;}
  for(const f of frames){f.group.removeFromParent();f.ribbons.removeFromParent();retiredFrames.add(f);}
  frames=s.frames.slice();
  for(const f of frames){retiredFrames.delete(f);scene.add(f.group,f.ribbons);f.group.visible=vr.on;}
  releaseUnusedFrames();trayKey='';
  movers.forEach((m,i)=>{m.k=s.ks[i];});fallen=new Set(s.fallen??[]);cells=worldCells();walker.node=null;
  buildWorld();
  Object.assign(walker,{node:nodeAt.get(s.node)??start,next:null,path:[],state:'idle',dest:null,ride:null});
  scene.add(walkerMesh);walkerMesh.position.copy(top(walker.node));directing=false;graphVersion++;
  if(s.kind==='photo'){yawT=s.view.yaw;pitchT=s.view.pitch;zoomT=s.view.zoom;targetT.copy(s.view.target);snapCamera();}
  flash('Undone.');play('remove');return true;
}
const raycaster=new THREE.Raycaster(),TAP=8;
// ---------- Three saved checkpoints and a reversible visual timeline ----------
let checkpointStorage;try{checkpointStorage=indexedDB;}catch{checkpointStorage=null;}
const checkpointStore=new PersistentCheckpointStore(checkpointStorage),trail=new TemporalTrail();
const temporalPrints=new Map();
let checkpointSlots=[null,null,null],checkpointKey='',checkpointLoading=false,checkpointSaving=false,checkpointLoadId=0,rewind=null,lastTemporal=-1,lastPoseKey='',winEpoch=0;
let mobileTray=null,expandedPhoto=null,newestPhoto=null,photoInspection=null;
const PHOTO_COLORS=['#408f82','#8b64a4','#ac783f'];
function setMobileTray(which){
  mobileTray=which;document.body.classList.toggle('tray-open',!!which);
  for(const [name,tray] of [['photos','photo-tray'],['checkpoints','checkpoint-tray']]){
    $(name+'-toggle').setAttribute('aria-expanded',String(which===name));$(tray).classList.toggle('mobile-open',which===name);
  }
}
for(const name of ['photos','checkpoints'])$(name+'-toggle').addEventListener('click',()=>setMobileTray(mobileTray===name?null:name));
overlay.addEventListener('pointerdown',()=>{if(mobileTray)setMobileTray(null);});
const currentView=()=>({target:target.toArray(),yaw,pitch,zoom,aspect});
function temporalPose(){
  scene.updateMatrixWorld(true);
  const photoIds=frames.map(f=>{
    const id=f.born+'|'+positions().join()+'|'+f.links.map(p=>p.id).join();
    if(!temporalPrints.has(id))temporalPrints.set(id,{image:f.thumbnail,links:f.links.length});
    if(temporalPrints.size>160)temporalPrints.delete(temporalPrints.keys().next().value);
    return id;
  });
  return {at:walkerMesh.getWorldPosition(new V3()).toArray(),orientation:walkerMesh.getWorldQuaternion(new THREE.Quaternion()).toArray(),face:walkerTurn.rotation.y,
    angles:movers.map(m=>(m.angle??0)*m.k*DEG+(m.group?.rotation.y??0)),offsets:movers.map(m=>m.travel?m.travel.map((v,i)=>v*m.k+(m.group.position.getComponent(i)-m.pivot[i])):[0,0,0]),view:currentView(),photoIds};
}
function recordTemporal(force=false){
  if(rewind||mode==='intro'||!walker.node||!force&&elapsed-lastTemporal<.08)return;
  lastTemporal=elapsed;const pose=temporalPose(),sig=JSON.stringify(pose)+frames.map(f=>f.born).join();
  if(force||sig!==lastPoseKey){trail.push(pose);lastPoseKey=sig;}
}
function packFrame(f){
  const c=f.cam;
  return {poly:f.poly,w:f.w,h:f.h,view:{...f.view,target:f.view.target.toArray()},
    cam:{position:c.position.toArray(),quaternion:c.quaternion.toArray(),up:c.up.toArray(),left:c.left,right:c.right,top:c.top,bottom:c.bottom,near:c.near,far:c.far},
    ghosts:[...(f.ghosts??[])],vanished:[...(f.vanished??[])],woke:!!f.woke};
}
function unpackFrame(f){
  const d=f.cam,c=new THREE.OrthographicCamera(d.left,d.right,d.top,d.bottom,d.near,d.far);
  c.position.fromArray(d.position);c.quaternion.fromArray(d.quaternion);c.up.fromArray(d.up);c.updateMatrixWorld(true);
  return Object.assign(makeFrame(f.poly,c,f.w,f.h,{...f.view,target:new V3(...f.view.target)}),{ghosts:new Set(f.ghosts),vanished:new Set(f.vanished),woke:f.woke});
}
function checkpointState(){return {ks:positions(),node:[walker.node.x,walker.node.y,walker.node.z],fallen:[...fallen],frames:frames.map(packFrame),view:currentView(),face:walker.face};}
const checkpointStable=()=>!checkpointLoading&&!checkpointSaving&&!rewind&&!complete&&!anyMoving()&&walker.state==='idle'&&!directing&&!framing&&mode!=='intro';
async function saveCheckpoint(i){
  if(!Number.isInteger(i)||i<0||i>2||!checkpointStable())return false;
  recordTemporal(true);
  checkpointSlots[i]={state:checkpointState(),pose:temporalPose(),mark:trail.mark(),savedAt:Date.now(),image:flatCanvas(224,camera,140).toDataURL('image/jpeg',.7)};
  const generation=checkpointLoadId;checkpointSaving=true;checkpointKey='';flash('Saving checkpoint…',2000);
  const persisted=await checkpointStore.write(level,checkpointSlots);if(generation!==checkpointLoadId)return persisted;checkpointSaving=false;checkpointKey='';
  $('title-card').hidden=true;
  flash(persisted?`Checkpoint ${i+1} saved.`:`Checkpoint ${i+1} saved for this session. Browser storage is unavailable.`,persisted?1800:5000);play('shutter');return true;
}
async function deleteCheckpoint(i){
  if(rewind||checkpointSaving||!checkpointSlots[i])return false;
  const generation=checkpointLoadId;checkpointSlots[i]=null;checkpointSaving=true;checkpointKey='';
  const persisted=await checkpointStore.write(level,checkpointSlots);if(generation!==checkpointLoadId)return persisted;checkpointSaving=false;checkpointKey='';if(!persisted)flash('Deleted for this session. Browser storage is unavailable.',5000);return true;
}
function cancelRewind(){
  rewind=null;document.body.classList.remove('rewinding');$('rewind-status').hidden=true;
}
function restoreCheckpoint(i){
  const saved=checkpointSlots[i];if(!saved||checkpointLoading||checkpointSaving||rewind||mode==='intro')return false;
  finale?.reset();finishCelebration=null;$('finale-caption').hidden=true;
  setMobileTray(null);
  const current=temporalPose(),path=trail.backTo(saved.mark,current,saved.pose).map(p=>({...p,view:{...p.view,zoom:p.view.zoom*Math.max(1,(p.view.aspect??aspect)/aspect)}}));
  winEpoch++;complete=false;$('done').hidden=true;$('page').hidden=true;closeMenu();closeAlbum();
  clearTimeout(snapTimer);pointers.clear();framing=null;frameTool=false;resetLTracking();feedback=null;
  for(const s of sparks){s.m.removeFromParent();s.m.material.dispose();}sparks=[];bursts=[];tapMark=null;tapGlow.visible=false;$('film').classList.remove('hint-notice');
  scene.attach(walkerMesh);walkerMesh.position.fromArray(current.at);walkerMesh.visible=true;
  for(const m of walkerMaterials)m.opacity=m.userData.alpha;walkerParts.shadow.opacity=.16;
  movers.forEach(m=>{m.moving=false;});walker.ride=null;walker.path=[];walker.dest=null;walker.next=null;walker.state='rewinding';directing=false;
  hint.asked++;hint.pending=false;hint.plan=null;hint.key='';hint.on=false;hint.tier=0;
  const reduced=reducedMotion();
  rewind={i,saved,path,at:0,duration:reduced?.12:Math.min(3.6,1.1+path.length*.012),base:movers.map(m=>(m.angle??0)*m.k*DEG),retraced:path.length>2};
  document.body.classList.add('rewinding');$('rewind-status').hidden=false;$('rewind-label').textContent=`Checkpoint ${i+1}`;
  checkpointKey='';play('remove');if(reduced||vr.on)finishRewind();return true;
}
function applyCheckpoint(saved){
  for(const f of new Set([...frames,...retiredFrames]))removeFrameObject(f);
  history=[];retiredFrames.clear();frames=[];const s=saved.state;
  movers.forEach((m,i)=>{m.k=s.ks[i];m.moving=false;m.t=0;});fallen=new Set(s.fallen);
  frames=s.frames.map(unpackFrame);cells=worldCells();walker.node=null;buildWorld();resetWalker();
  walker.node=nodeOf(s.node)??start;walker.face=s.face;walkerTurn.rotation.y=s.face;walkerMesh.position.copy(top(walker.node));
  walkerMesh.quaternion.copy(tiltOf(walker.node.up));
  // Rebuild the prints only after the restored geometry and hidden stones are in place.
  for(const f of frames){f.print.dispose();f.print=snapshot(f.cam);f.photo.material.map=f.print.texture;f.thumbnailDirty=true;}
  yawT=s.view.yaw;pitchT=s.view.pitch;zoomT=s.view.zoom*Math.max(1,(s.view.aspect??aspect)/aspect);targetT.fromArray(s.view.target);snapCamera();
  complete=false;graphVersion++;trayKey='';lastHud='';practice.stage='';feedback=null;
}
function finishRewind(){
  if(!rewind)return;const {saved,i}=rewind;
  applyCheckpoint(saved);cancelRewind();trail.reset();recordTemporal(true);
  saved.mark=trail.mark();checkpointKey='';flash(`Checkpoint ${i+1} restored.`,1800);
}
function updateRewind(dt){
  if(!rewind)return;
  const r=rewind;r.at=Math.min(1,r.at+dt/r.duration);const ease=r.at*r.at*(3-2*r.at),index=ease*(r.path.length-1),i=Math.min(r.path.length-2,Math.floor(index));
  const pose=blendPose(r.path[i],r.path[i+1],index-i);
  movers.forEach((m,j)=>{if(m.travel)m.group.position.set(...m.pivot).add(new V3(...pose.offsets[j])).addScaledVector(new V3(...m.travel),-m.k);else m.group.rotation.y=pose.angles[j]-r.base[j];});
  walkerMesh.position.fromArray(pose.at);walkerMesh.quaternion.fromArray(pose.orientation);walkerTurn.rotation.y=pose.face;walkerBody.rotation.z=Math.sin(r.at*36)*.025;
  yawT=pose.view.yaw;pitchT=pose.view.pitch;zoomT=pose.view.zoom;targetT.fromArray(pose.view.target);snapCamera();
  const photos=r.path[Math.round(index)].photoIds??[],signature=photos.join();
  if(signature!==r.photos){r.photos=signature;$('film').innerHTML=photos.length?photos.map(id=>{const p=temporalPrints.get(id);return `<div class="photo-slot rewind-photo"><button class="photo-view" disabled>${p?`<img src="${p.image}" alt=""><span>${p.links} linked</span>`:'<span>Restoring…</span>'}</button></div>`;}).join(''):'<button class="photo-empty" disabled>＋</button>';}
  for(const f of frames)for(const ribbon of f.ribbons.children)ribbon.userData.thread.userData.grow(Math.max(0,1-ease*3));
  $('rewind-progress').style.transform=`scaleX(${ease})`;
  if(r.at>=1)finishRewind();
}
function updateCheckpoints(){
  const stable=checkpointStable(),busy=!!rewind||checkpointLoading||checkpointSaving,sig=checkpointSlots.map(s=>s?.savedAt??0).join()+'|'+stable+'|'+busy;
  if(sig===checkpointKey)return;checkpointKey=sig;
  const active=document.activeElement?.closest('#checkpoints button'),focused=active?{...active.dataset}:null;
  $('checkpoints-count').textContent=checkpointSlots.filter(Boolean).length+'/3';
  $('checkpoints').innerHTML=checkpointSlots.map((s,i)=>`<div class="checkpoint-slot${s?' occupied':''}">
    <button class="checkpoint-main" data-${s?'restore':'save'}="${i}" ${busy||!s&&!stable?'disabled':''} title="${s?'Restore':'Save'} checkpoint ${i+1} (${s?'':'Shift+'}${i+1})" aria-label="${s?'Restore':'Save'} checkpoint ${i+1}">${s?`<img src="${s.image}" alt=""><span><b>${i+1}</b> Restore</span>`:`<span class="checkpoint-plus">＋</span><span>Save ${i+1}</span>`}</button>
    ${s?`<div class="checkpoint-actions"><button data-save="${i}" ${!stable?'disabled':''} title="Replace checkpoint ${i+1} with the current state" aria-label="Update checkpoint ${i+1}">Update</button><button data-forget="${i}" ${busy?'disabled':''} title="Delete checkpoint ${i+1}" aria-label="Delete checkpoint ${i+1}">Delete</button></div>`:''}</div>`).join('');
  if(focused){const [action,i]=Object.entries(focused)[0]??[];$('checkpoints').querySelector(`[data-${action}="${i}"]`)?.focus({preventScroll:true});}
}
$('checkpoints').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(b.dataset.save!==undefined)saveCheckpoint(+b.dataset.save);else if(b.dataset.restore!==undefined)restoreCheckpoint(+b.dataset.restore);else if(b.dataset.forget!==undefined)deleteCheckpoint(+b.dataset.forget);});
$('rewind-skip').addEventListener('click',finishRewind);
const keyOfHit=h=>h.object.userData.key??h.object.userData.triangleKeys?.[h.faceIndex];
// What a tap means: the walkable tile under it. Only solid meshes count (outline lines would catch
// taps meant for the block next to them). A tap on a block's side, a rail, a column or a covered
// tile falls back to the visible walkable top nearest the tap on screen, so near misses still work.
function nodeAtScreen(x,y,tol=1){
  raycaster.setFromCamera(new THREE.Vector2(x/W*2-1,1-y/H*2),camera);
  const hit=raycaster.intersectObject(blockGroup,true).find(h=>h.object.isMesh&&keyOfHit(h));
  const direct=hit&&nodeAt.get(keyOfHit(hit));
  if(direct)return direct;
  let best=null,bd=(40*tol)**2;
  for(const n of nodes){
    const t=top(n),q=project(t);if(q.z>1)continue;
    const d=(q.x-x)**2+(q.y-y)**2;if(d>=bd)continue;
    // Only a top that can be seen: the first solid thing under its middle on screen is its own block.
    if(visibleTop(n,q)){bd=d;best=n;}
  }
  return best;
}
function visibleTop(n,q){
  raycaster.setFromCamera(new THREE.Vector2(q.x/W*2-1,1-q.y/H*2),camera);
  const h=raycaster.intersectObject(blockGroup,true).find(h=>h.object.isMesh&&keyOfHit(h));
  return !!h&&keyOfHit(h)===key(n.x,n.y,n.z);
}
function updateWalker(dt){
  if(walker.state==='walking'){
    walker.t=Math.min(1,walker.t+dt/walker.dur);
    const t=walker.t,v=walker.via,p=v?(t<.5?walker.from.clone().lerp(v,t*2):v.clone().lerp(walker.to,t*2-1)):walker.from.clone().lerp(walker.to,t);if(walker.next?.link)p.addScaledVector(walker.node.up,Math.sin(Math.PI*t)*.25);if(v&&t>=.5)walker.face=faceAlong(walker.to,v,walker.next.n.up);walkerMesh.position.copy(p);
    if(walker.t<1)return;
    const left=walker.node;walker.node=walker.next.n;walker.state='idle';
    if(left&&(level.crumble??[]).some(b=>sameSpot(left,b)))crumbleAway(left);
    if(walker.next.link)directing=false;
    walker.next=null;arrive(walker.node);
    if(complete)return;
  }
  if(complete)return;
  if(anyMoving())return;
  walkerMesh.position.copy(top(walker.node));
  if(walker.version!==graphVersion||!walker.path.length){walker.version=graphVersion;walker.path=chooseRoute();}
  const step=walker.path[0];
  if(!step){directing=false;walker.state='idle';return;}
  // A join can vanish if its frame was removed; check the step is still there.
  if(!neighbours(walker.node).some(x=>x.m===step.n)){walker.path=[];return;}
  // Before crossing a join, glide back to the view the frame was made with, so the crossing looks seamless.
  // In VR your head owns the view, so the island turns under you instead, without waiting.
  if(step.link&&settings.follow){
    const f=linkFrame(walker.node,step.n);
    if(f?.view&&vr.on){vr.align=f.view;const link=f.links.find(p=>p.a===walker.node&&p.b===step.n||p.b===walker.node&&p.a===step.n);vr.alignAt=link?seamPoint(link):null;}
    else if(f?.view){
      directing=true;const v=f.view;
      yawT=yaw+wrapAngle(v.yaw-yaw);pitchT=v.pitch;targetT.copy(v.target);zoomT=v.zoom;
      if(Math.abs(wrapAngle(v.yaw-yaw))>.8*DEG||Math.abs(v.pitch-pitch)>.8*DEG||target.distanceTo(v.target)>.05||Math.abs(zoom-v.zoom)>.05){walker.state='waiting';return;}
    }
  }
  walker.path.shift();
  walker.next=step;walker.via=step.via??null;walker.from.copy(top(walker.node));walker.to.copy(top(step.n));walker.t=0;walker.dur=step.link?LINK_SECONDS:STEP_SECONDS;walker.state='walking';if(step.link)play('cross');
  walker.face=faceAlong(walker.via??walker.to,walker.from,walker.node.up);
  play('step');
}
const wrapAngle=a=>a-Math.round(a/(2*Math.PI))*2*Math.PI;
// The heading (about the surface's up) of walking from one point to another.
function faceAlong(to,from,up){const d=to.clone().sub(from).applyQuaternion(tiltOf(up).invert());return Math.hypot(d.x,d.z)<1e-6?walker.face:Math.atan2(d.x,d.z);}
let winAt=-9;
// Plain words for the cards: how many levels a place has, and the line when a place is finished.
function countLevels(place){const n=LEVEL_ORDER.filter(j=>(LEVELS[j].palette??j)%CHAPTERS.length===place%CHAPTERS.length).length;return `${n} level${n===1?'':'s'}`;}
function placeDone(){const name=CHAPTERS[(level.palette??levelIndex)%CHAPTERS.length];return `You finished ${name.replace(/^The /,'the ')}.`;}
function win(){
  const epoch=++winEpoch;
  if(LESSON_LEVELS.has(level.name)||practice.force===level.name){
    lessonSeen.add(level.name);saveLessons();
  }
  complete=true;directing=false;play('win');winAt=elapsed;doorSide=Math.cos(yaw)>=0?1:-1;
  // Completion is durable immediately, even if the player opens the album before the keepsake.
  if(maker?.active)maker.completed();else{progress.done[level.name]??=1;saveProgress();}
  blockGroup.traverse(o=>{if(o.userData.futureOutline)o.visible=false;});
  const reveal=level.composition?.reveal;
  if(reveal&&!vr.on&&!reducedMotion())showReveal(reveal);
  if(finale){
    finale.start(reducedMotion());$('finale-line').textContent=placeDone();$('finale-caption').hidden=reducedMotion();
    if(!reveal&&!vr.on&&!reducedMotion()){
      const view=openingView();yawT=yaw+wrapAngle(view.yaw*DEG-yaw);pitchT=view.pitch*DEG;
      const fit=fitView([...framingPoints(false),...finale.framingPoints()],yawT,pitchT,W,H,fitInsets());targetT.fromArray(fit.target);zoomT=fit.zoom;
    }
  }
  const door=new V3(level.goal[0],level.goal[1]+.9,level.goal[2]);
  setTimeout(()=>{if(complete&&epoch===winEpoch)sparkle(door,{count:22,spread:.5,rise:1.2,speed:.4,color:0xfff0c8,life:2.6,size:.22});},2000);
  const last=extraIndex!==null?extraIndex===EXTRA_LEVELS.length-1:levelIndex===LEVEL_ORDER.at(-1);
  $('done-title').textContent=levelTitle(level);
  if($('done-location'))$('done-location').textContent=maker?.active?'Your creation':`${$('chapter').textContent} · ${$('level-num').textContent}`;
  $('done-text').textContent=last?(extraIndex!==null?'Extra levels complete':'All levels complete'):finale?placeDone():'Level complete';
  $('next').textContent=last?(extraIndex!==null?'Return to the album':'Begin again'):'Continue to next level';
  if(maker?.active){$('done-text').textContent='Playtest complete';$('next').textContent='Back to build';}
  // A keepsake: the moment the traveller got home, as a polaroid, kept in the album.
  let captured=false;
  const capture=()=>{if(!complete||epoch!==winEpoch||captured)return;captured=true;play('shutter');const shot=completionPhoto();$('done-photo').src=shot.toDataURL('image/jpeg',.92);$('done-photo').parentElement.style.background=palette.sky[1];if(!maker?.active)keepPhoto(level.name,shot);};
  finishCelebration=()=>{if(!complete||epoch!==winEpoch)return;finale?.update(4,true);capture();$('finale-caption').hidden=true;closeMenu();$('done').hidden=false;if($('album').hidden&&!vr.on)$('next').focus({preventScroll:true});finishCelebration=null;};
  setTimeout(capture,reducedMotion()?100:finale?3450:1050);
  setTimeout(()=>{if(complete&&epoch===winEpoch)finishCelebration?.();},reducedMotion()?250:finale?4200:3000);
}
function showReveal(reveal){
  const dir=new V3(...reveal.dir).normalize(),at=new V3(...reveal.at);
  lookAlong(dir.toArray(),at);
  if(Math.hypot(dir.x,dir.z)<1e-6&&reveal.yaw!==undefined)yawT=yaw+wrapAngle(reveal.yaw*DEG-yaw);
  if(reveal.focus){
    const right=new V3(Math.cos(yawT),0,-Math.sin(yawT)),up=new V3(-Math.sin(yawT)*Math.sin(pitchT),Math.cos(pitchT),-Math.cos(yawT)*Math.sin(pitchT));
    // Keep the whole built scene in view. A tight crop of the exit can cut an adjoining
    // bridge in half or put a foreground platform over the completed composition.
    const points=[...cells.values()].flatMap(c=>[-.65,.65].flatMap(x=>[-1.25,1.8].flatMap(y=>[-.65,.65].map(z=>new V3(c.x+x,c.y+y,c.z+z).sub(at)))));
    const xs=points.map(p=>p.dot(right)),ys=points.map(p=>p.dot(up)),loX=Math.min(...xs),hiX=Math.max(...xs),loY=Math.min(...ys),hiY=Math.max(...ys);
    targetT.copy(at).addScaledVector(right,(loX+hiX)/2).addScaledVector(up,(loY+hiY)/2);
    zoomT=Math.max((hiY-loY)/2,(hiX-loX)/(2*aspect),2.5)*(W<640?1.7:1.5);
    targetT.addScaledVector(up,zoomT*(W<640?.1:.075));
  }else zoomT=reveal.zoom*Math.max(1,1/aspect);
}

// ---------- Progress and the album ----------
// Saved in this browser: which levels are done (with a small copy of the photo you got) and where you were.
const progress={done:{},at:0};
try{Object.assign(progress,JSON.parse(localStorage.getItem('frameshift-progress')||'{}'));}catch{}
const saveProgress=()=>{try{localStorage.setItem('frameshift-progress',JSON.stringify(progress));}catch{}};
// Resume an unfinished introduction rather than replaying a lesson already completed.
// Album selections still load the exact requested level; this is only the startup destination.
function resumeLevelIndex(){
  const saved=Number.isInteger(progress.at)&&progress.at>=0&&progress.at<LEVELS.length?progress.at:LEVEL_ORDER[0];
  let position=LEVEL_ORDER.indexOf(saved);
  while(position<LEVEL_ORDER.length-1){
    const L=LEVELS[LEVEL_ORDER[position]];
    if(!L.intro||!progress.done?.[L.name])break;
    position++;
  }
  return LEVEL_ORDER[position];
}

// Drop retired demo metadata while preserving the campaign resume point and photos.
if('showcaseAt' in progress||'showcaseFinished' in progress){delete progress.showcaseAt;delete progress.showcaseFinished;saveProgress();}
const story=createStoryUI({onLayout:()=>{if(!vr.on)fitPuzzle();},onClose:()=>{
  if(mode==='intro'||story.open)return;
  if(!vr.on)fitPuzzle();
  if(complete)return;
  const card=$('title-card');card.hidden=true;void card.offsetWidth;card.hidden=false;
}});
const levelConversation=()=>{
  if(maker?.active)return null;
  if(extraIndex!==null)return level===EXTRA_LEVELS[extraIndex]?conversationFor(level.name,true):null;
  return level===LEVELS[levelIndex]?conversationFor(level.name):null;
};
function showLevelDialogue(){
  const scene=levelConversation();if(!scene)return;
  closeMenu();setMobileTray(null);pointers.clear();framing=null;touchGesture=null;resetLTracking();
  $('title-card').hidden=true;story.show(scene,levelTitle(level));
}
$('story-replay').addEventListener('click',showLevelDialogue);
// Retired side-puzzle saves resume in the corresponding campaign chapter.
if(progress.route==='bonus'){const destination=[36,17,56][progress.bonusAt];if(Number.isInteger(destination))progress.at=destination;}
if(progress.route||'bonusAt' in progress){delete progress.route;delete progress.extra;delete progress.bonusAt;saveProgress();}
// The album keeps a photo of each solved level. When the places change how they look, older photos no
// longer match, so they are let go (the level stays solved) and the next win takes a new one.
// Change LOOK whenever the look of the places changes.
const LOOK='places-2';
if(progress.look!==LOOK){for(const k in progress.done)progress.done[k]=1;progress.look=LOOK;saveProgress();}
// Refresh only keepsakes whose place changed; completion and layout checkpoints stay valid.
if(progress.liftLook!=='campaign-places-1'){
  for(const L of LEVELS.filter(L=>L.theme?.endsWith('-lifts')))if(typeof progress.done[L.name]==='string')progress.done[L.name]=1;
  progress.liftLook='campaign-places-1';saveProgress();
}
const photoOf=name=>typeof progress.done[name]==='string'?progress.done[name]:null;
function keepPhoto(name,src){
  const n=Math.min(src.width,src.height),c=document.createElement('canvas');c.width=c.height=440;
  c.getContext('2d').drawImage(src,(src.width-n)/2,(src.height-n)/2,n,n,0,0,440,440);
  progress.done[name]=c.toDataURL('image/jpeg',.72);saveProgress();
}
// Every level is open: play them in any order.
function openAlbum(){
  setMobileTray(null);
  const pages=$('album-pages');pages.textContent='';
  let row=null,chapter='';
  for(const i of LEVEL_ORDER){
    const L=LEVELS[i],name=CHAPTERS[(L.palette??i)%CHAPTERS.length];
    if(name!==chapter){
      chapter=name;const heading=document.createElement('h3');heading.textContent=name;
      const subject=document.createElement('p');subject.className='album-subject';subject.textContent=countLevels(L.palette??i);
      row=document.createElement('div');row.className='album-row';pages.append(heading,subject,row);
    }
    const current=i===levelIndex&&mode!=='intro',b=document.createElement('button'),pic=document.createElement('div'),cap=document.createElement('span'),meta=document.createElement('span');
    b.className='album-photo'+(current?' current':'');b.dataset.campaign=i;pic.className='pic';
    const preview=ALBUM_PREVIEWS[L.name];
    if(preview?.revision===levelRevision(L)){
      const img=document.createElement('img');img.src=preview.src;img.alt='';img.loading='lazy';img.decoding='async';img.width=960;img.height=720;pic.append(img);
    }else pic.textContent=String(campaignNumber(LEVEL_ORDER,i));
    const number=campaignNumber(LEVEL_ORDER,i);cap.className='album-name';cap.textContent=levelTitle(L);
    meta.className='album-meta';meta.textContent=`${String(number).padStart(2,'0')} \u00b7 ${progress.done[L.name]?'Complete':current?'Current level':'Play'} \u00b7 ${L.frames} photo${L.frames===1?'':'s'}`;
    b.append(pic,cap,meta);b.title=`Play ${levelTitle(L)}`;b.setAttribute('aria-label',`Play ${levelTitle(L)}, level ${number}${progress.done[L.name]?', complete':''}`);
    b.addEventListener('click',()=>{closeAlbum();loadLevel(i);});row.append(b);
  }
  $('album').hidden=false;
}
function closeAlbum(){$('album').hidden=true;}
$('finale-skip').addEventListener('click',()=>finishCelebration?.());

// ---------- View: the world stays put and you move around it ----------
// The camera looks at target along the direction given by yaw and pitch. zoom is half the view's
// height in blocks; in a flat view it changes how big things look, never what lines up.
let yaw=0,pitch=30*DEG,yawT=0,pitchT=30*DEG,zoom=8,zoomT=8;
const target=new V3(),targetT=new V3();
const openingView=()=>{const L=level??LEVELS[0];return W<=640&&H>W&&L.portraitView?L.portraitView:L.view;};
function fitCamera(){
  const old=viewZoom,v=openingView();viewZoom=cells?.size?fitView(framingPoints(true),v.yaw*DEG,v.pitch*DEG,W,H,fitInsets()).zoom:radius*1.05*Math.max(1,1/aspect);
  if(old&&old!==viewZoom){zoom*=viewZoom/old;zoomT*=viewZoom/old;}
}
function homeView(){
  const v=openingView();yawT=yaw+wrapAngle(v.yaw*DEG-yaw);pitchT=v.pitch*DEG;
  const fit=fitView(framingPoints(true),yawT,pitchT,W,H,fitInsets());targetT.fromArray(fit.target);zoomT=fit.zoom;
}
function framingPoints(includeFuture=!complete){
  const base=level.composition?.spans||level.composition?.archMovers||level.composition?.kind==='paired-bridges'?-1.45:-.6,points=worldFramePoints(cells,level.goal,base);
  if(includeFuture)for(const m of movers){const future=new Map(moverBlocks(m,nextPosition(m,m.k)).map(b=>{const c=pieceOf(b);return [key(c.x,c.y,c.z),c];}));points.push(...worldFramePoints(future,null,base));}
  return points;
}
const compactUI=()=>W<=640||H<=560;
function fitInsets(){
  if(maker?.editing)return maker.insets(W,H);
  if(mode==='intro'){
    const top=$('intro').querySelector('.title-top').getBoundingClientRect(),bottom=$('intro').querySelector('.title-bottom').getBoundingClientRect();
    if(W>640&&H<=560)return {left:24,right:W-bottom.left+20,top:top.bottom+14,bottom:24,padding:1.05};
    return {left:24,right:24,top:top.bottom+12,bottom:H-bottom.top+16,padding:1.05};
  }
  if(story.open&&!vr.on){
    const bounds=$('level-dialogue').querySelector('.dialogue-words').getBoundingClientRect();
    return W>=700&&H<=560?{left:20,right:W-bounds.left+20,top:64,bottom:36,padding:1.06}
      :{left:20,right:20,top:W<=640?94:110,bottom:H-bounds.top+24,padding:1.06};
  }
  const small=compactUI(),landscape=small&&W>640,viewButtons=!$('view-controls').hidden;
  const trayBottom=small&&mobileTray?$(mobileTray==='photos'?'photo-tray':'checkpoint-tray').getBoundingClientRect().bottom+12:0;
  return {left:small?18:26,right:Math.max(viewButtons?168:small?18:26,landscape&&mobileTray?370:0),top:landscape?84:small?Math.max(trayBottom,mobileTray==='photos'?360:mobileTray?284:132):158,bottom:landscape?92:small?116:W<=1050?290:250,padding:1.06};
}
function fitPuzzle(instant=false){
  if(directing||rewind||anyMoving())return false;
  clearTimeout(snapTimer);
  const fit=fitView(framingPoints(),yawT,pitchT,W,H,fitInsets());targetT.fromArray(fit.target);zoomT=fit.zoom;
  if(instant||reducedMotion())snapCamera();
  return true;
}
function snapCamera(){yaw=yawT;pitch=pitchT;zoom=zoomT;target.copy(targetT);updateCamera(0);}
const offsetOf=(y,p,d)=>new V3(Math.sin(y)*Math.cos(p)*d,Math.sin(p)*d,Math.cos(y)*Math.cos(p)*d);
// While the camera is following the walker across a join, the player's moves wait.
function turnView(dYaw,dPitch){if(directing||rewind)return;yawT+=dYaw*DEG;pitchT=Math.max(MIN_PITCH*DEG,Math.min(MAX_PITCH*DEG,pitchT+dPitch*DEG));}
// Zoom in (k < 1) or out (k > 1).
function moveCloser(k){if(directing||rewind)return;zoomT=Math.max(viewZoom*.2,Math.min(viewZoom*2.5,zoomT*k));}
function zoomAt(k,x,y){
  if(directing||rewind)return;
  const old=zoomT;moveCloser(k);
  const right=new V3(Math.cos(yawT),0,-Math.sin(yawT)),up=new V3().crossVectors(offsetOf(yawT,pitchT,1),right).normalize(),scale=2*(old-zoomT)/H;
  targetT.addScaledVector(right,(x-W/2)*scale).addScaledVector(up,(H/2-y)*scale);
}
// Slide the view across the screen (pixels).
function slide(dx,dy){
  if(directing||rewind)return;
  const per=2*zoomT/H,right=new V3(Math.cos(yawT),0,-Math.sin(yawT)),up=new V3().crossVectors(offsetOf(yawT,pitchT,1),right).normalize();
  targetT.addScaledVector(right,-dx*per).addScaledVector(up,dy*per);
}
function updateCamera(dt){
  const k=framing&&dt>0&&!vr.on?0:dt&&!reducedMotion()?1-Math.exp(-(directing?3.5:10)*dt):1;
  yaw+=(yawT-yaw)*k;pitch+=(pitchT-pitch)*k;zoom+=(zoomT-zoom)*k;target.lerp(targetT,k);
  // End the sub-pixel tail of rotation easing before it enters the gap between
  // alignment and visibility tolerances and briefly paints a clear seam red.
  if(Math.abs(yawT-yaw)<1e-4)yaw=yawT;
  if(Math.abs(pitchT-pitch)<1e-4)pitch=pitchT;
  camera.position.copy(target).add(offsetOf(yaw,pitch,FAR));
  // A stable camera basis also works at exactly 90 degrees. World-up alone is singular there.
  camera.up.set(-Math.sin(yaw)*Math.sin(pitch),Math.cos(pitch),-Math.cos(yaw)*Math.sin(pitch));
  camera.lookAt(target);
  Object.assign(camera,{left:-zoom*aspect,right:zoom*aspect,top:zoom,bottom:-zoom});camera.updateProjectionMatrix();camera.updateMatrixWorld();
  if(scene.fog){const d=camera.position.distanceTo(center);scene.fog.near=d+radius*.2;scene.fog.far=d+radius*3.2;}
}
// Look along a direction (a unit vector toward the viewer), optionally centring on a point.
function lookAlong(v,look=null){
  // Straight down has no way round: keep the current one. Out of reach is the nearest view in reach.
  const down=Math.hypot(v[0],v[2])<1e-6;v=reachable(v);if(!down)yawT=yaw+wrapAngle(Math.atan2(v[0],v[2])-yaw);pitchT=Math.asin(Math.max(-1,Math.min(1,v[1])));
  if(look)targetT.copy(look);
}
// After moving by hand, ease onto a nearby line-up, the way Monument Valley snaps: within SNAP_DEG of
// a seam's line, the view turns to look exactly along it, so the two edges meet with no gap at all.
// A direction that lines up two seams at once is favoured, and the trail's direction most of all.
// Seams that will exist after a swing count too.
function snapToAlignment(){
  if(directing||anyMoving())return;
  const taken=linkedIds(),v=dirOf(yawT,pitchT),SNAP=vr.on?VR_SNAP_DEG:SNAP_DEG;
  const candidates=[...pairs.map(p=>({...p,world:cells})),...futures].filter(p=>!taken.has(p.id)&&sightClear(p.seam,reachable(seamLine(p.seam).u),p.world));
  const unique=new Map();for(const p of candidates)if(!unique.has(p.id))unique.set(p.id,p);
  const open=[...unique.values()].map(p=>({p,off:angleBetween(reachable(seamLine(p.seam).u),v)})).filter(c=>c.off<SNAP*1.6);
  let best=null;
  for(const c of open)if(c.off<SNAP&&(!best||c.off<best.score))best={score:c.off,dir:seamLine(c.p.seam).u};
  for(let i=0;i<open.length;i++)for(let j=i+1;j<open.length;j++){
    const b=bothAlong(open[i].p.seam,open[j].p.seam);if(b.off>=ALIGN*.9)continue;
    const off=angleBetween(b.dir,v);if(off<SNAP*1.6&&(!best||off-Math.min(3,SNAP*.6)<best.score))best={score:off-Math.min(3,SNAP*.6),dir:b.dir};
  }
  // The trail's own direction wins when you are near it, so following the ring always lands there.
  const st=(hint.on&&hint.tier===3||practice.active)&&hint.key===hintKey()?hint.plan?.step:null;
  if(st?.type==='frame'&&angleBetween(st.dir,v)<SNAP*1.6)best={dir:st.dir};
  if(vr.on&&vr.view?.p){
    const selected=vr.view;
    if(selected.off>=VR_SNAP_DEG)return;
    // Use a combined seam direction only if it also lies close to the selected crossing.
    if(!best||angleBetween(best.dir,selected.v)>1)best={dir:selected.v};
  }
  if(best)lookAlong(best.dir);
}

// ---------- Pointers: one pointer moves you around the world, two pointers (or the frame tool) draw a frame ----------
const pointers=new Map();
let framing=null,frameTool=false,moveTool=false,snapTimer=0,touchGesture=null;
// Snap a moment after the last wheel or key move, so it does not fight the player mid-move.
function snapSoon(ms=250){clearTimeout(snapTimer);snapTimer=setTimeout(snapToAlignment,ms);}
function buttonAt(x,y){const el=document.elementFromPoint(x,y)?.closest('button,label,a[href]');return el&&!el.disabled&&!el.closest('[hidden]')?el:null;}
const rectPoly=(a,b)=>[{x:Math.min(a.x,b.x),y:Math.min(a.y,b.y)},{x:Math.max(a.x,b.x),y:Math.min(a.y,b.y)},{x:Math.max(a.x,b.x),y:Math.max(a.y,b.y)},{x:Math.min(a.x,b.x),y:Math.max(a.y,b.y)}];
function holdPhotoView(){
  // The frame's first corner belongs to the view on screen. Stop pending camera
  // easing and delayed snapping so the subject cannot drift out of that box.
  clearTimeout(snapTimer);yawT=yaw;pitchT=pitch;zoomT=zoom;targetT.copy(target);
}
function pointerDown(id,x,y,{frame=false,slide=false,tol=1,tapToo=false,touch=false}={}){
  if(rewind)return;
  const p={id,x,y,sx:x,sy:y,lx:x,ly:y,mode:'idle',moved:0,tol,tapToo,touch};pointers.set(id,p);
  if(touch&&touchGesture)return;
  if(id.startsWith('hand')){const el=buttonAt(x,y);if(el){p.mode='button';p.el=el;return;}}
  photoInspection=null;
  if(story.open)return;
  if(mode==='intro')return;
  if(!$('done').hidden){p.mode='turn';return;} // after a win you can still move around to admire it
  const del=hitDelete(x,y,tol);if(del){p.mode='delete';p.frame=del;return;}
  // A second pointer while the first is turning the world: stretch a frame between the two.
  const other=[...pointers.values()].find(q=>q!==p&&(q.mode==='turn'||q.mode==='frame'));
  if(other&&touch&&other.touch&&!frameTool&&!frame&&other.mode==='turn'){
    other.mode=p.mode='zoom';touchGesture={ids:[other.id,p.id],distance:Math.max(8,Math.hypot(x-other.x,y-other.y)),x:(x+other.x)/2,y:(y+other.y)/2};clearTimeout(snapTimer);return;
  }
  if(maker?.editing){p.mode=other?'idle':slide?'slide':'turn';return;}
  if(other){holdPhotoView();other.mode='pair';p.mode='pair';framing={a:other,b:p};return;}
  if(frame||frameTool){holdPhotoView();p.mode='frame';framing={a:{x,y},b:p};return;}
  p.mode=slide||moveTool?'slide':'turn';
}
function pointerMove(id,x,y){
  const p=pointers.get(id);if(!p)return;
  if(p.mode==='zoom'&&touchGesture){
    p.x=x;p.y=y;const [a,b]=touchGesture.ids.map(id=>pointers.get(id));if(!a||!b)return;
    const distance=Math.max(8,Math.hypot(a.x-b.x,a.y-b.y)),cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;
    zoomAt(touchGesture.distance/distance,touchGesture.x,touchGesture.y);slide(cx-touchGesture.x,cy-touchGesture.y);
    Object.assign(touchGesture,{distance,x:cx,y:cy});return;
  }
  // A little wobble during a click is still a click: the world only starts turning past TAP pixels.
  if(p.mode==='turn'||p.mode==='slide'){
    p.moved=Math.max(p.moved,Math.hypot(x-p.sx,y-p.sy));
    if(p.dragging||p.moved>TAP*p.tol){const dx=p.dragging?x-p.lx:x-p.sx,dy=p.dragging?y-p.ly:y-p.sy;p.dragging=true;if(p.mode==='turn')turnView(-dx*.35*settings.sensitivity,dy*.25*settings.sensitivity);else slide(dx,dy);}
  }
  p.lx=p.x=x;p.ly=p.y=y;
}
function pointerUp(id){
  const p=pointers.get(id);if(!p)return;
  if(p.mode==='zoom'){if(touchGesture)for(const other of touchGesture.ids){const q=pointers.get(other);if(q)q.mode='idle';}touchGesture=null;pointers.delete(id);return;}
  if(p.mode==='button'&&buttonAt(p.x,p.y)===p.el)p.el.click();
  if(p.mode==='delete'&&hitDelete(p.x,p.y)===p.frame&&!canDrop(p.frame)){flash(NO_DROP());play('stuck');}
  else if(p.mode==='delete'&&hitDelete(p.x,p.y)===p.frame){removeFrame(p.frame);flash('Photo dropped.');play('remove');}
  if((p.mode==='turn'||p.mode==='slide')&&p.dragging){if(!maker?.editing)snapToAlignment();}
  else if((p.mode==='turn'||p.mode==='slide')&&$('done').hidden){if(maker?.editing)maker.clickScreen(p.sx,p.sy);else sendWalker(nodeAtScreen(p.sx,p.sy,p.tol));}
  if((p.mode==='frame'||p.mode==='pair')&&framing){
    const poly=rectPoly(framing.a,framing.b);
    if(poly[2].x-poly[0].x>=MIN_DRAG&&poly[2].y-poly[0].y>=MIN_DRAG)addFrame(poly);
    // A pinch that hardly moved is a tap: send the walker to the block under it.
    else if(p.mode==='frame'&&p.tapToo&&Math.hypot(p.x-p.sx,p.y-p.sy)<TAP*p.tol*2)sendWalker(nodeAtScreen(p.sx,p.sy,p.tol));
    for(const q of pointers.values())if(q!==p&&q.mode==='pair')q.mode='idle';
    framing=null;
  }
  pointers.delete(id);
}
overlay.addEventListener('pointerdown',e=>{overlay.setPointerCapture(e.pointerId);pointerDown('p'+e.pointerId,e.clientX,e.clientY,{frame:e.button===2||e.shiftKey,slide:e.button===1||e.ctrlKey,tol:e.pointerType==='touch'?1.6:1,touch:e.pointerType==='touch'});if(e.button===1)e.preventDefault();});
// Wheel zoom keeps the current view center. Orthographic zoom cannot change alignment,
// so it must not pan toward the pointer or trigger an alignment snap.
overlay.addEventListener('wheel',e=>{e.preventDefault();if(mode==='intro')return;clearTimeout(snapTimer);moveCloser(Math.exp(Math.max(-1,Math.min(1,e.deltaY*.0015))));},{passive:false});
overlay.addEventListener('pointermove',e=>{
  if(maker?.editing)maker.screenHover(e.clientX,e.clientY);
  if(pointers.has('p'+e.pointerId))return pointerMove('p'+e.pointerId,e.clientX,e.clientY);
  overlay.style.cursor=maker?.editing?'crosshair':hitDelete(e.clientX,e.clientY)?'pointer':frameTool||e.shiftKey?'crosshair':moveTool||e.ctrlKey?'move':'grab';
});
overlay.addEventListener('pointerup',e=>pointerUp('p'+e.pointerId));
overlay.addEventListener('pointercancel',()=>{pointers.clear();framing=null;touchGesture=null;});
overlay.addEventListener('pointerleave',()=>{if(maker?.editing&&!vr.on)maker.hoverRay(null);});
overlay.addEventListener('contextmenu',e=>e.preventDefault());

// ---------- Hands: an open palm moves you around the world, a pinch draws a frame ----------
// Pinch and drag to stretch a frame from where the pinch started; a quick pinch that does not move is
// a tap (send the walker, press a button). Two pinches make a frame between them, and two L hands do
// too (a setting). The palm works the way your head would in a headset: move it right and you go
// round to the right, raise it and you look from higher. The world itself never moves.
let landmarker=null,lastVideoTime=-1,hands=[],readings=[],injected=null;
const handState=new Map();
function landmarksToScreen(landmarks){
  const vw=video.videoWidth||1280,vh=video.videoHeight||720,s=Math.max(W/vw,H/vh),dw=vw*s,dh=vh*s;
  return landmarks.map(p=>({x:(W-dw)/2+(1-p.x)*dw,y:(H-dh)/2+p.y*dh}));
}
function detect(now){
  if(injected){hands=injected.map((points,i)=>({id:String(i),points}));return;}
  if(!landmarker||video.readyState<2||video.currentTime===lastVideoTime)return;
  lastVideoTime=video.currentTime;
  const result=landmarker.detectForVideo(video,now),sides=result.handedness??result.handednesses??[];
  hands=result.landmarks.map((l,i)=>({id:sides[i]?.[0]?.categoryName??String(i),points:landmarksToScreen(l)}));
}
function updateHands(dt){
  if(rewind)return;
  const seen=new Set();
  hands.forEach((h,i)=>{
    const id='hand-'+h.id,r=readings[i];seen.add(id);
    let s=handState.get(id);if(!s){s={pinched:false,palm:false,x:r.pinchPoint.x,y:r.pinchPoint.y,px:r.palmPoint.x,py:r.palmPoint.y};handState.set(id,s);}
    const k=1-Math.exp(-25*dt);s.x+=(r.pinchPoint.x-s.x)*k;s.y+=(r.pinchPoint.y-s.y)*k;s.px+=(r.palmPoint.x-s.px)*k;s.py+=(r.palmPoint.y-s.py)*k;
    const now=isPinching(r,s.pinched);
    if(now&&!s.pinched)pointerDown(id,s.x,s.y,{frame:true,tapToo:true,tol:1.6});else if(now)pointerMove(id,s.x,s.y);else if(s.pinched)pointerUp(id);
    s.pinched=now;
    const palm=!now&&r.isPalm&&mode!=='intro'&&!story.open;
    if(palm&&s.palm)turnView((s.px-s.lx)*PALM_TURN*settings.sensitivity,-(s.py-s.ly)*PALM_TURN*.7*settings.sensitivity);
    else if(!palm&&s.palm)snapSoon();
    s.palm=palm;s.lx=s.px;s.ly=s.py;
  });
  for(const [id,s] of handState)if(!seen.has(id)){if(s.pinched)pointerUp(id);if(s.palm)snapSoon();handState.delete(id);}
  document.querySelectorAll('.hand-hover').forEach(el=>el.classList.remove('hand-hover'));
  for(const s of handState.values())if(!s.pinched)buttonAt(s.x,s.y)?.classList.add('hand-hover');
}
let tracker=new FrameTracker(),lHistory=[],lHeld=0,live=null;
function resetLTracking(){tracker=new FrameTracker();lHistory=[];lHeld=0;live=null;}
function updateL(now,dt){
  if(rewind)return;
  if(!settings.twoL||mode==='intro'||story.open){if(live||lHistory.length)resetLTracking();return;}
  const ls=readings.filter(r=>r.isL),raw=ls.length>=2?frameFromHands(ls[0],ls[1]):null,f=tracker.update(raw,now,dt);
  if(raw){lHeld+=dt;lHistory.push({t:now,frame:{...tracker.frame}});while(lHistory[0].t<now-1000)lHistory.shift();}
  live=f&&f.alpha>.05?f:null;
  if(!raw&&tracker.frame&&now-tracker.lastSeen>tuning.graceMs){
    const pick=[...lHistory].reverse().find(e=>e.t<=tracker.lastSeen-150)??lHistory[0];
    if(lHeld>=.5&&pick){const c=frameCorners(pick.frame),xs=c.map(p=>p.x),ys=c.map(p=>p.y);addFrame(rectPoly({x:Math.min(...xs),y:Math.min(...ys)},{x:Math.max(...xs),y:Math.max(...ys)}));}
    resetLTracking();
  }
}

// ---------- Show the way: ghost breadcrumbs for the next move ----------
// The solver plans from where the player is now (beams, walker, and the frames they have up), and
// the next move is drawn in the world:
//   walk or press: glowing footprints along the walker's route to a ghost walker. Tap the ghost.
//   frame: a trail of dots from the edges to join out to a ring. Bring the ring onto the edges: drag
//     the world (the ring follows the drag exactly) or move an open palm toward it. When it gets
//     there the edges meet, and a dashed outline shows where to draw the frame.
//   remove: the frame to take down pulses.
// It follows the player: after any change (a walk, a beam turn, a frame, an undo) it plans again from
// there and says whether that move helped, so getting lost never leaves a stale trail behind.
let hintWorker=new Worker(new URL('./illusion-hint-worker.js',import.meta.url),{type:'module'}),customHintTimer=null;
const hint={on:false,tier:0,sticky:false,key:'',plan:null,asked:0,pending:false,prev:null,note:''};
const hintKey=()=>walker.node?[level.name,positions().join(),key(walker.node.x,walker.node.y,walker.node.z),frames.map(f=>f.born.toFixed(3)).join()].join('|'):'';
const hintIdle=()=>!rewind&&!complete&&!anyMoving()&&walker.state==='idle'&&mode!=='intro'&&!!walker.node;
function cancelCustomHint(){
  if(customHintTimer===null)return;
  clearTimeout(customHintTimer);customHintTimer=null;
  const {onmessage,onerror}=hintWorker;hintWorker.terminate();hintWorker=new Worker(new URL('./illusion-hint-worker.js',import.meta.url),{type:'module'});hintWorker.onmessage=onmessage;hintWorker.onerror=onerror;
  hint.pending=false;hint.asked++;
}
hintWorker.onerror=e=>{clearTimeout(customHintTimer);customHintTimer=null;console.error('Hint planner failed:',e.message);hint.pending=false;flash('Hint unavailable.');};
hintWorker.onmessage=({data})=>{
  if(data.id!==hint.asked)return;clearTimeout(customHintTimer);customHintTimer=null;hint.pending=false;
  if(data.key!==hintKey()||!hint.on&&!practice.active)return; // things changed while it thought; followHint asks again
  const before=hint.prev;if(hint.key&&hint.key!==data.key&&!hint.sticky)hint.tier=1;
  hint.prev=data.moves;hint.plan=data;hint.key=data.key;
  hint.note=before==null||!data.step?'':`${data.moves} moves remaining. `;
  if(!practice.active)describeHint();
};
function planHint(){
  hint.pending=true;hint.asked++;
  if(maker?.active)customHintTimer=setTimeout(()=>{cancelCustomHint();hint.on=false;hint.tier=0;flash('The hint search took too long for this design. You can still play it.',5000);},8000);
  // Each frame the player has up, as the planner needs it: the way it looks, and its outline on screen.
  const own=frames.map(f=>({vanished:[...(f.vanished??[])],dir:viewDir(f.cam),poly:f.poly,w:f.w,h:f.h,viewProjection:new THREE.Matrix4().multiplyMatrices(f.cam.projectionMatrix,f.cam.matrixWorldInverse).toArray()}));
  hintWorker.postMessage({id:hint.asked,key:hintKey(),L:level,ks:positions(),walker:[walker.node.x,walker.node.y,walker.node.z],frames:own});
}
// H or the button turns the trail on and off.
function askHint(on){
  if(maker?.editing)return false;
  if(maker?.active&&((level.movers??[]).reduce((n,m)=>n*positionsOf(m),2**(level.shy?.length??0))>256||level.blocks.length+(level.movers??[]).reduce((n,m)=>n+m.blocks.length,0)>80)){flash('This custom level is too large for the quick hint planner.');return false;}
  if(rewind)return false;
  const explicit=typeof on==='boolean';hint.sticky=explicit;
  const tier=explicit?(on?3:0):(hint.tier+1)%4;on=tier>0;
  // The solver doesn't know the spare mechanics, so no trail in levels that use them.
  if(on&&(level.ghosts||level.fade||level.crumble)){flash('Hint unavailable.');return;}
  if(complete||mode==='intro')return false;
  hint.on=on;hint.tier=tier;$('hint').setAttribute('aria-pressed',String(on));
  if(!on){cancelCustomHint();$('film').classList.remove('hint-notice');flash('Hint hidden.',1500);return true;}
  hint.prev=null;hint.note='';
  if(hint.plan&&hint.key===hintKey())describeHint();
  else{flash('Planning…',8000);if(hintIdle()&&!hint.pending)planHint();}
  return true;
}
// Called every tick: after any change, plan again so the trail always fits the world as it is.
function followHint(){if((hint.on||practice.active)&&!hint.pending&&hintIdle()&&hint.key!==hintKey())planHint();}
function describeHint(){
  const {moves,step}=hint.plan;
  if(!step){flash(vr.on?'Stuck. Undo or restart.':'Stuck. Undo (Z) or restart (R).',5000);return;}
  if(hint.tier<3){flash(hint.tier===1?'Look at the pulsing structure.':'Look at the marked edges.',1800);return;}
  if(step.type==='remove'&&compactUI())setMobileTray('photos');
  if(vr.on){flash(step.type==='frame'?(step.orbs?.length?'Look through the gold ring at the marked orb.':step.hides?'Look through the gold ring so the wall hides the marked stone.':'Look through the gold ring to line up the marked edges.'):step.type==='remove'?'Press Drop photo to drop the photo in the way.':step.type==='press'?'Touch the plate.':'Touch the marked tile.',4000);return;}
  flash(step.type==='frame'?(step.orbs?.length?'Photograph the marked orb.':step.hides?'Hide the marked stone behind the wall.':'Align the highlighted edges.'):step.type==='remove'?'Remove the highlighted photo.':step.type==='press'?'Tap the plate.':'Tap the marked tile.',3000);
}
// A close crop can be thinner than a finger on a phone. Enlarge the guide only
// where it still excludes the same orbs; otherwise ask the player to zoom in.
function hintFrameRect(st){
  const points=st.cropCorners??[
    ...st.edges.flatMap(e=>[e.a,e.b].flatMap(([mid,half])=>[-1,1].map(s=>mid.map((v,i)=>v+half[i]*s)))),
    ...(st.hides?st.stones.flatMap(b=>[-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].map(z=>[b[0]+x*.5,b[1]+y*.5,b[2]+z*.5])))):[]),
    ...(st.orbs??[]).flatMap(eyeBounds)
  ];
  const qs=points.map(p=>project(new V3(...p))),pad=st.cropCorners?0:36;
  const raw=[Math.min(...qs.map(q=>q.x))-pad,Math.min(...qs.map(q=>q.y))-pad,Math.max(...qs.map(q=>q.x))+pad,Math.max(...qs.map(q=>q.y))+pad];
  if(!st.cropCorners){raw[0]=Math.max(8,raw[0]);raw[1]=Math.max(8,raw[1]);raw[2]=Math.min(W-8,raw[2]);raw[3]=Math.min(H-8,raw[3]);}
  const mask=b=>photographedEyes(level,positions(),viewDir(camera),cells,p=>{const q=project(new V3(...p));return q.x>=b[0]&&q.x<=b[2]&&q.y>=b[1]&&q.y<=b[3];});
  const dx=Math.max(0,MIN_DRAG+10-(raw[2]-raw[0])),dy=Math.max(0,MIN_DRAG+10-(raw[3]-raw[1]));
  if(dx||dy){
    const expected=mask(raw);
    for(const x of [.5,0,1])for(const y of [.5,0,1]){
      const box=[raw[0]-dx*x,raw[1]-dy*y,raw[2]+dx*(1-x),raw[3]+dy*(1-y)];
      if(box[0]>=8&&box[1]>=8&&box[2]<=W-8&&box[3]<=H-8&&mask(box)===expected)return {box,small:false};
    }
    return {box:raw,small:true};
  }
  return {box:raw,small:false};
}
// The middle of everything the next frame should join.
const hintLook=st=>{const pts=[...st.edges.flatMap(e=>[e.a[0],e.b[0]]),...(st.hides?st.stones:[]),...(st.orbs??[])];return new V3(...pts.reduce((a,p)=>a.map((v,i)=>v+p[i]/pts.length),[0,0,0]));};
// How far apart a pair of edges looks along a direction, in edge lengths (the game's line-up measure).
function edgeGap(e,v){const g=e.b[0].map((x,i)=>x-e.a[0][i]),along=g[0]*v[0]+g[1]*v[1]+g[2]*v[2];return Math.hypot(...g.map((x,i)=>x-along*v[i]));}
// Where the ring sits: offset from the edges by exactly the drag that would bring the view round to
// the hint's direction (a drag of dx turns by dx*0.35 degrees, dy tilts by dy*0.25), capped on screen.
function wayRing(st){
  const look=project(hintLook(st)),dYaw=wrapAngle(Math.atan2(st.dir[0],st.dir[2])-yaw)/DEG,dPitch=Math.asin(st.dir[1])/DEG-pitch/DEG;
  const palms=practice.active&&mode==='camera',ox=palms?-dYaw/(PALM_TURN*settings.sensitivity):dYaw/(.35*settings.sensitivity),oy=palms?dPitch/(PALM_TURN*.7*settings.sensitivity):-dPitch/(.25*settings.sensitivity),l=Math.hypot(ox,oy),cap=Math.min(W,H)*.42,f=l>cap?cap/l:1;
  const v=viewDir(camera);
  // A join can line up from both sides; only one may hide the required stone.
  // Keep guiding the camera until the actual hiding condition is satisfied too.
  const hidden=!(st.hides)||(level.shy??[]).every((b,i)=>!(st.hides>>i&1)||stoneHidden(cells,b,v));
  // Waiting photos need exact alignment too. Checking only today's joins could
  // show Ready while the camera was still easing toward tomorrow's crossing.
  const aligned=st.edges.length?st.edges.every(e=>edgeGap(e,v)<ALIGN):angleBetween(st.dir,v)<1.5;
  const there=hidden&&aligned&&(!st.orbs?.length||angleBetween(st.dir,v)<1.5);
  return {look,ring:{x:Math.max(28,Math.min(W-28,look.x+ox*f)),y:Math.max(28,Math.min(H-90,look.y+oy*f))},there,far:l>cap};
}
function wayRoute(to){
  const prev=routes(),n=nodeOf(to);if(!n||!prev.has(n))return null;
  const path=[];for(let c=n;c;c=prev.get(c)?.n)path.unshift(c);return path;
}
function drawGhost(n,pulse){
  const q=project(top(n)),u=Math.max(26,H/(2*zoom));
  ctx.fillStyle=`rgba(255,255,255,${.18+pulse*.1})`;ctx.beginPath();ctx.ellipse(q.x,q.y,u*.32,u*.14,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=`rgba(255,255,255,${.45+pulse*.2})`;ctx.shadowColor='#7fe6ff';ctx.shadowBlur=16;
  ctx.beginPath();ctx.moveTo(q.x-u*.17,q.y);ctx.lineTo(q.x+u*.17,q.y);ctx.lineTo(q.x,q.y-u*.5);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.arc(q.x,q.y-u*.55,u*.09,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
}
// The step the hint shows now, if any.
const hintStep=()=>(hint.on||practice.active)&&hint.plan?.step&&hint.key===hintKey()&&!directing&&mode!=='intro'?hint.plan.step:null;
// The photo a hint asks you to drop: the one taken nearest the way it points.
function hintedDrop(){const st=hintStep();return st?.type==='remove'?frames.slice().sort((a,b)=>angleBetween(viewDir(a.cam),st.dir)-angleBetween(viewDir(b.cam),st.dir))[0]:null;}
function drawHint(){
  if(!hintStep())return;
  const st=hint.plan.step,pulse=reducedMotion()?.8:.5+Math.sin(elapsed*5)*.5;
  ctx.save();
  const tier=practice.active?3:hint.tier;
  if(tier===1){
    const points=st.type==='frame'?(st.orbs?.length?st.orbs:st.hides?st.stones:st.edges.filter(e=>e.now).length?st.edges.filter(e=>e.now).flatMap(e=>[e.a[0],e.b[0]]):st.edges.flatMap(e=>[e.a[0],e.b[0]])):st.to?[st.to]:[];
    const seen=new Set();
    for(const p of points){const n=nodes.reduce((a,b)=>top(a).distanceToSquared(new V3(...p))<top(b).distanceToSquared(new V3(...p))?a:b),tile=[n.x,n.y,n.z],k=tile.join();if(seen.has(k))continue;seen.add(k);drawTilePulse(tile,.28+pulse*.22,'#f9d88a');}
    if(st.type==='remove')$('film').classList.add('hint-notice');else $('film').classList.remove('hint-notice');
    ctx.restore();return;
  }
  $('film').classList.remove('hint-notice');
  if(st.type==='frame'){
    const w=wayRing(st),v=viewDir(camera);
    // The edges to join glow cyan and gold; seams that only arrive after a beam turns are dimmer.
    const ends=[];
    for(const e of st.edges){
      const h=e.a[1],seg=m=>[m.map((x,i)=>x-h[i]),m.map((x,i)=>x+h[i])].map(p=>project(new V3(...p)));
      const A=seg(e.a[0]),B=seg(e.b[0]),met=edgeGap(e,v)<ALIGN,dim=e.now?1:.45;ends.push(...A,...B);
      for(const [Q,c] of [[A,'127,230,255'],[B,met?'140,255,170':'255,211,107']]){
        ctx.strokeStyle=`rgba(${c},${(.75+pulse*.25)*dim})`;ctx.lineWidth=e.now?6:4;ctx.lineCap='round';ctx.shadowColor=`rgb(${c})`;ctx.shadowBlur=12;
        ctx.beginPath();ctx.moveTo(Q[0].x,Q[0].y);ctx.lineTo(Q[1].x,Q[1].y);ctx.stroke();ctx.shadowBlur=0;
      }
    }
    // Shy stones this photo should hide: a pearl outline round each.
    if(st.hides)for(const b of st.stones){
      const qs=[-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].map(z=>project(new V3(b[0]+x*.5,b[1]+y*.5,b[2]+z*.5))))),xs=qs.map(q=>q.x),ys=qs.map(q=>q.y);
      ends.push(...qs);ctx.strokeStyle=`rgba(255,240,250,${.6+pulse*.4})`;ctx.lineWidth=3;ctx.shadowColor='#ffd6f0';ctx.shadowBlur=14;
      ctx.strokeRect(Math.min(...xs)-6,Math.min(...ys)-6,Math.max(...xs)-Math.min(...xs)+12,Math.max(...ys)-Math.min(...ys)+12);ctx.shadowBlur=0;
    }
    for(const orb of st.orbs??[]){const q=project(new V3(...orb)),r=Math.max(16,H/(2*zoom)*.42);ctx.strokeStyle='#ffd36b';ctx.lineWidth=3;ctx.beginPath();ctx.arc(q.x,q.y,r,0,Math.PI*2);ctx.stroke();ends.push(...eyeBounds(orb).map(p=>project(new V3(...p))));}
    if(tier<3){ctx.restore();return;}
    if(!w.there){
      // Breadcrumbs: dots flowing from the edges out to the ring.
      const {look:a,ring:b}=w,l=Math.hypot(b.x-a.x,b.y-a.y),n=Math.max(2,Math.floor(l/26));
      for(let i=1;i<n;i++){
        const t=i/n,glow=.35+.65*Math.max(0,Math.cos((t*n-elapsed*3)%n/n*Math.PI*2));
        ctx.fillStyle=`rgba(255,211,107,${.5+glow*.5})`;ctx.strokeStyle='rgba(29,23,51,.5)';ctx.lineWidth=1.5;
        ctx.beginPath();ctx.arc(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,3.5+glow*2,0,Math.PI*2);ctx.fill();ctx.stroke();
      }
      ctx.strokeStyle=`rgba(255,211,107,${.7+pulse*.3})`;ctx.lineWidth=3;ctx.shadowColor='#ffd36b';ctx.shadowBlur=14;
      ctx.beginPath();ctx.arc(b.x,b.y,20+pulse*4,0,Math.PI*2);ctx.stroke();
      ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(b.x,b.y,9,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;
      ctx.font='600 13px system-ui,sans-serif';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='rgba(29,23,51,.7)';
      if(practice.active)drawDemoPointer(ctx,b,a,elapsed,{hands:mode==='camera',reduced:reducedMotion()});
      else{ctx.strokeText('Drag',b.x,b.y+40);ctx.fillStyle='rgba(255,246,214,.98)';ctx.fillText('Drag',b.x,b.y+40);}
    }else{
      // There: the dashed outline of the frame to draw.
      const {box:[x0,y0,x1,y1],small}=hintFrameRect(st);
      ctx.strokeStyle=`rgba(255,211,107,${.65+pulse*.35})`;ctx.lineWidth=3;ctx.setLineDash([12,8]);ctx.lineDashOffset=-elapsed*30;
      ctx.strokeRect(x0,y0,x1-x0,y1-y0);ctx.setLineDash([]);
      ctx.fillStyle='rgba(255,246,214,.95)';ctx.font='600 13px system-ui,sans-serif';ctx.textAlign='center';if(practice.active)drawDemoPointer(ctx,{x:x0,y:y0},{x:x1,y:y1},elapsed,{hands:mode==='camera',box:true,reduced:reducedMotion()});
      else ctx.fillText(small?'Zoom in':'Frame',(x0+x1)/2,y0-10);
    }
  }else if(st.type==='remove'){
    const f=hintedDrop(),d=f&&deleteSpot(f);
    if(d){ctx.strokeStyle=`rgba(255,120,120,${.6+pulse*.4})`;ctx.lineWidth=3;ctx.beginPath();ctx.arc(d.x,d.y,16+pulse*8,0,Math.PI*2);ctx.stroke();}
  }else{
    // Footprints along the walker's route, travelling toward the ghost.
    const path=wayRoute(st.to),n=nodeOf(st.to);
    if(tier===3&&path)for(let i=0;i+1<path.length;i++){
      const a=top(path[i]),b=top(path[i+1]);
      for(const t of [.33,.66]){
        const q=project(a.clone().lerp(b,t)),k=(i+t)/path.length,glow=.3+.7*Math.max(0,Math.cos((k-elapsed*.6)%1*Math.PI*2));
        ctx.fillStyle=`rgba(127,230,255,${.5+glow*.5})`;ctx.strokeStyle='rgba(29,23,51,.55)';ctx.lineWidth=1.5;
        ctx.beginPath();ctx.ellipse(q.x,q.y,6+glow*2,3.5+glow,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      }
    }
    if(n){drawGhost(n,pulse);if(practice.active){const q=project(top(n));drawDemoPointer(ctx,q,q,elapsed,{hands:mode==='camera',reduced:reducedMotion()});}}
  }
  ctx.restore();
}

// ---------- Overlay ----------
function polyPath(poly){ctx.beginPath();poly.forEach((p,i)=>ctx[i?'lineTo':'moveTo'](p.x,p.y));ctx.closePath();}
let aligned=[],blocked=[],ahead=[];
function connectionGroups(){
  if(anyMoving()||complete)return {held:[],ready:[],waiting:[],blocked:[]};
  return {held:frames.flatMap(f=>f.links).filter(p=>joinsFrom(p,camera)),ready:aligned,waiting:ahead,blocked};
}
// What a frame would do if you let go now, and what it would replace: under the frame, on screen and in a headset.
function framingWords(poly,p=photoPreview(poly)){
  const label=p.moving?'Wait for the path to finish moving':p.orbs?(p.orbBlocked?'The orb’s path is blocked':`${p.orbs===1?'The orb will':`${p.orbs} orbs will`} turn the path`):p.hides?`${p.hides} shy stone${p.hides===1?'':'s'} will hide`:p.ready?`${p.ready} connection${p.ready===1?'':'s'} ready`:p.waiting?'Waiting for the beam':p.near?'Release to align edges':p.cropped?'Include both complete edges':p.blocked?'Join hidden by a block':'No connection in frame';
  const replacement=replacementPreview(poly);
  const extra=replacement?(replacement.blocked?'Clear the hidden stone’s space first':`Replaces photo ${replacement.index+1} · ${replacement.lost.length?`${replacement.lost.length} crossing${replacement.lost.length===1?' closes':'s close'}`:'Existing crossings stay'}`):'';
  return {label,extra,replacement,ready:!!p.ready};
}
function drawOverlay(){
  ctx.clearRect(0,0,W,H);
  if(rewind){
    ctx.save();ctx.strokeStyle='rgba(186,236,234,.4)';ctx.lineWidth=2;ctx.setLineDash([3,7]);ctx.beginPath();
    rewind.path.filter((_,i)=>i%Math.max(1,Math.floor(rewind.path.length/120))===0).forEach((p,i)=>{const q=project(new V3(...p.at));ctx[i?'lineTo':'moveTo'](q.x,q.y);});ctx.stroke();ctx.restore();return;
  }
  if(settings.skeleton)hands.forEach(({points:p},i)=>{
    ctx.strokeStyle=readings[i]?.isL?'rgba(125,240,201,.9)':'rgba(60,40,90,.5)';ctx.lineWidth=2;ctx.beginPath();
    for(const [a,b] of BONES){ctx.moveTo(p[a].x,p[a].y);ctx.lineTo(p[b].x,p[b].y);}ctx.stroke();
  });
  const groups=connectionGroups();
  if(settings.hints&&mode!=='intro'&&!complete&&!practice.active)drawPreviewEdges(ctx,previewSegments(groups,p=>project(new V3(...p))),elapsed,reducedMotion());
  drawHint();
  drawFeedback();
  if(!framing&&!live)drawPhotoInspection();
  for(const b of bursts){
    const t=(elapsed-b.at)/.9;
    for(const v of b.points){
      const q=project(v);if(q.z>1)continue;
      ctx.strokeStyle=`rgba(255,236,170,${1-t})`;ctx.lineWidth=3*(1-t)+1;ctx.beginPath();ctx.arc(q.x,q.y,10+t*46,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle=`rgba(255,251,230,${1-t})`;for(let i=0;i<8;i++){const a=i*Math.PI/4+t*2,r=14+t*40;ctx.beginPath();ctx.arc(q.x+Math.cos(a)*r,q.y+Math.sin(a)*r,2.5*(1-t)+.5,0,Math.PI*2);ctx.fill();}
    }
  }
  if(framing){ctx.save();ctx.strokeStyle='#ffd36b';ctx.lineWidth=3;ctx.setLineDash([10,6]);ctx.shadowColor='#ffd36b';ctx.shadowBlur=10;polyPath(rectPoly(framing.a,framing.b));ctx.stroke();ctx.restore();}
  if(framing||live){
    const poly=framing?rectPoly(framing.a,framing.b):frameCorners(live),p=photoPreview(poly);
    const {label,extra,replacement}=framingWords(poly,p);
    if(replacement){
      drawOwnedConnections(replacement.lost,replacement.index+1,'#d99a86',true);
    }
    ctx.save();ctx.font='600 12px system-ui,sans-serif';
    const width=Math.max(ctx.measureText(label).width,ctx.measureText(extra).width)+24,x=Math.max(12,Math.min(W-width-12,Math.min(...poly.map(q=>q.x)))),y=Math.max(16,Math.min(H-135,Math.max(...poly.map(q=>q.y))+12));
    ctx.fillStyle='rgba(43,33,64,.92)';ctx.beginPath();ctx.roundRect(x,y,width,extra?50:30,9);ctx.fill();
    ctx.fillStyle=p.ready?'#bff0dc':'#fff3dc';ctx.textAlign='left';ctx.fillText(label,x+12,y+20);
    if(extra){ctx.fillStyle='#f4bcaa';ctx.fillText(extra,x+12,y+39);}ctx.restore();
  }
  if(live){ctx.save();ctx.globalAlpha=live.alpha;ctx.strokeStyle='#ffd36b';ctx.lineWidth=3;ctx.shadowColor='#ffd36b';ctx.shadowBlur=10;polyPath(frameCorners(live));ctx.stroke();ctx.restore();}
  for(const f of vr.on?frames:[]){
    const d=deleteSpot(f);if(!d)continue;
    ctx.fillStyle='rgba(43,33,64,.9)';ctx.strokeStyle='#ffd36b';ctx.lineWidth=2;ctx.beginPath();ctx.arc(d.x,d.y,10,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(d.x-4,d.y-4);ctx.lineTo(d.x+4,d.y+4);ctx.moveTo(d.x+4,d.y-4);ctx.lineTo(d.x-4,d.y+4);ctx.stroke();
  }
  for(const s of handState.values()){
    if(s.palm){ctx.strokeStyle='rgba(79,191,168,.8)';ctx.lineWidth=2.5;ctx.setLineDash([5,5]);ctx.beginPath();ctx.arc(s.px,s.py,26,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
    ctx.strokeStyle='#4fbfa8';ctx.fillStyle='rgba(79,191,168,.55)';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(s.x,s.y,s.pinched?8:13,0,Math.PI*2);
    if(s.pinched)ctx.fill();ctx.stroke();
  }
}

// ---------- HUD ----------
let flashText='',flashUntil=0,lastHud='';
let hudStatus='';
function drawTilePulse(p,alpha,color){
  const qs=[[-.48,-.48],[.48,-.48],[.48,.48],[-.48,.48]].map(([x,z])=>project(new V3(p[0]+x,p[1]+.51,p[2]+z)));
  ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineWidth=3;polyPath(qs);ctx.fill();ctx.globalAlpha=Math.min(1,alpha+ .35);ctx.stroke();ctx.restore();
}
function drawFeedback(){
  if(!feedback||elapsed>feedback.until)return;
  const alpha=Math.min(1,(feedback.until-elapsed)*1.5),pulse=.6+Math.sin(elapsed*6)*.2;
  ctx.save();ctx.globalAlpha=alpha;ctx.lineCap='round';ctx.lineWidth=4;
  for(const [index,[mid,half]] of feedback.edges.entries()){
    const a=project(new V3(...mid).sub(new V3(...half))),b=project(new V3(...mid).add(new V3(...half)));
    ctx.strokeStyle=feedback.kind==='rail'?'#f6c37e':'#e9b6ae';ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=9;
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    if(feedback.kind==='rail'&&feedback.closed.includes(index)){const q=project(new V3(...mid).add(new V3(0,.18,0)));ctx.beginPath();ctx.moveTo(q.x-5,q.y-5);ctx.lineTo(q.x+5,q.y+5);ctx.moveTo(q.x+5,q.y-5);ctx.lineTo(q.x-5,q.y+5);ctx.stroke();}
  }
  ctx.shadowBlur=0;
  for(const p of feedback.blocks)drawTilePulse(p,alpha*pulse*.35,'#f1b8a4');
  if(feedback.kind==='offset'){
    const [a,b]=feedback.edges.map(([mid])=>project(new V3(...mid)));ctx.setLineDash([4,5]);ctx.lineWidth=2;ctx.strokeStyle='#edc9bb';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }
  ctx.restore();
}
function waitingConnections(f){
  const held=new Set(f.links.map(p=>p.id)),seen=new Set();
  return futures.filter(p=>!held.has(p.id)&&!seen.has(p.id)&&joinsFrom(p,f.cam,f.w,f.h,p.world)&&photoContains(p,f.poly,f.cam,f.w,f.h)&&seen.add(p.id));
}
function photoInspectionDetails(){
  const f=photoInspection?.frame,index=frames.indexOf(f);
  if(index<0||elapsed>photoInspection.until)return null;
  return {index,action:photoInspection.action,frame:f,...photoDependents(frames,f),waiting:waitingConnections(f),blocked:!canDrop(f)};
}
function drawOwnedConnections(links,number,color,dashed=false){
  const pulse=reducedMotion()?1:.82+Math.sin(elapsed*4)*.18;
  ctx.save();ctx.lineCap='round';ctx.globalAlpha=pulse;
  for(const p of links){
    const seam=p.seam??p,a=project(new V3(...seam.ea.mid)),b=project(new V3(...seam.eb.mid));
    if(a.z>1||b.z>1)continue;
    ctx.strokeStyle=color;ctx.lineWidth=2;ctx.setLineDash(dashed?[5,5]:[2,4]);
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash(dashed?[5,4]:[]);
    for(const [mid,half] of seamEdges(seam)){
      const x=project(new V3(...mid).sub(new V3(...half))),y=project(new V3(...mid).add(new V3(...half)));
      ctx.strokeStyle='rgba(30,25,45,.35)';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(x.x,x.y);ctx.lineTo(y.x,y.y);ctx.stroke();
      ctx.strokeStyle=color;ctx.lineWidth=5;ctx.stroke();
    }
    const x=(a.x+b.x)/2,y=(a.y+b.y)/2-14;
    if(x<14||x>W-14||y<14||y>H-14)continue;
    ctx.setLineDash([]);ctx.fillStyle='#fbf7ee';ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#2b2140';ctx.font='600 10px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(number),x,y+.5);
  }
  ctx.restore();
}
function drawPhotoInspection(){
  if(mode==='intro'||complete||rewind||vr.on||!$('menu').hidden||!$('album').hidden)return;
  const p=photoInspectionDetails();if(!p)return;
  const removing=p.action==='remove',color=removing?'#d99a86':PHOTO_COLORS[p.index%PHOTO_COLORS.length];
  drawOwnedConnections(removing?p.exclusive:p.links,p.index+1,color,removing);
  if(!removing)drawOwnedConnections(p.waiting,p.index+1,color,true);
  for(const k of removing?p.exclusiveHidden:p.hidden)drawTilePulse(k.split(',').map(Number),.2,color);
}
function photoInspectionText(p){
  if(!p)return 'Select a photo to see what it keeps.';
  const label=`Photo ${p.index+1}`;
  if(p.action==='remove'){
    if(p.blocked)return `${label} cannot be removed while its hidden stone would return on the traveller.`;
    const changes=[];
    if(p.exclusive.length)changes.push(`${p.exclusive.length} crossing${p.exclusive.length===1?' closes':'s close'}`);
    if(p.exclusiveHidden.length)changes.push(`${p.exclusiveHidden.length} hidden stone${p.exclusiveHidden.length===1?' returns':'s return'}`);
    return changes.length?`Remove ${label.toLowerCase()}: ${changes.join('; ')}.`:`Removing ${label.toLowerCase()} keeps the current crossings.`;
  }
  const kept=[];
  if(p.links.length)kept.push(`${p.links.length} crossing${p.links.length===1?'':'s'}`);
  if(p.hidden.length)kept.push(`${p.hidden.length} hidden stone${p.hidden.length===1?'':'s'}`);
  if(kept.length)return `${label} keeps ${kept.join(' and ')}${p.waiting.length?'; another crossing is waiting':''}.`;
  return p.waiting.length?`${label} is waiting for a path to move.`:`${label} holds no crossing.`;
}
let trayKey='';
function updatePhotoTray(){
  if(rewind)return;
  if(frames.at(-1)!==newestPhoto||!frames.includes(expandedPhoto))expandedPhoto=frames.at(-1)??null;
  newestPhoto=frames.at(-1);
  for(const f of frames)if(f.thumbnailDirty){f.thumbnail=photoThumbnail(f.poly,f.cam,f.w,f.h);f.thumbnailDirty=false;}
  const sig=level.name+'|'+positions().join()+'|'+level.frames+'|'+frames.map(f=>f.born+':'+f.links.length).join('|');
  if(sig!==trayKey){
    trayKey=sig;
    $('film').innerHTML=Array.from({length:level.frames},(_,i)=>{
      const f=frames[i];
      return f?`<div class="photo-slot" style="--photo-ink:${PHOTO_COLORS[i%PHOTO_COLORS.length]}"><button class="photo-view" data-view="${i}" title="Inspect photo ${i+1} and return to its view" aria-label="Inspect photo ${i+1} and return to its view"><img src="${f.thumbnail}" alt=""><span>${f.links.length?`${f.links.length} linked`:f.vanished?.size?`${f.vanished.size} hidden`:f.woke?'Orb blinked':photoPreview(f.poly,f.cam,f.w,f.h).waiting?'Waiting':'No link'}</span></button><b class="photo-number" aria-hidden="true">${i+1}</b><button class="photo-remove" data-remove="${i}" aria-label="Remove photo ${i+1}">×</button></div>`
        :`<button class="photo-empty" data-empty="${i}" title="Take photo ${i+1} of ${level.frames}" aria-label="Take a photo in slot ${i+1} of ${level.frames}">＋<small>Slot ${i+1}</small></button>`;
    }).join('');
  }
  for(const b of $('film').querySelectorAll('[data-view]')){
    b.closest('.photo-slot').classList.toggle('expanded',frames[+b.dataset.view]===expandedPhoto);
    b.classList.toggle('selected',angleBetween(viewDir(frames[+b.dataset.view].cam),viewDir(camera))<1);
    b.closest('.photo-slot').classList.toggle('replacing',+b.dataset.view===frames.findIndex(canDrop)&&frames.length>=level.frames&&!!(frameTool||framing||live));
    b.disabled=directing;
  }
  const inspection=photoInspectionDetails(),note=$('photo-inspect-note');
  for(const slot of $('film').querySelectorAll('.photo-slot')){const b=slot.querySelector('[data-view]');slot.classList.toggle('inspecting',!!inspection&&!!b&&inspection.frame===frames[+b.dataset.view]);}
  if(note){note.hidden=!frames.length;const text=photoInspectionText(inspection);if(note.textContent!==text)note.textContent=text;}
}
function inspectPhotoButton(button,hold=false){
  if(!button||button.disabled)return;
  const f=frames[Number(button.dataset.view??button.dataset.remove)];if(!f)return;
  photoInspection={frame:f,action:button.dataset.remove!==undefined?'remove':'keep',until:hold?Infinity:elapsed+6};
}
for(const event of ['pointerover','focusin'])$('film').addEventListener(event,e=>{if(e.pointerType==='touch')return;inspectPhotoButton(e.target.closest('[data-view],[data-remove]'),true);});
for(const event of ['pointerout','focusout'])$('film').addEventListener(event,e=>{if(photoInspection&&e.target.closest('[data-view],[data-remove]'))photoInspection.until=elapsed+2;});
$('film').addEventListener('click',e=>{
  if(rewind)return;
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.empty!==undefined){frameTool=true;moveTool=false;setMobileTray(null);return;}
  const i=Number(b.dataset.view??b.dataset.remove),f=frames[i];if(!f)return;
  if(b.dataset.remove!==undefined){if(canDrop(f)){removeFrame(f);play('remove');}else flash(NO_DROP());return;}
  if(directing)return;
  inspectPhotoButton(b);
  expandedPhoto=f;
  yawT=yaw+wrapAngle(f.view.yaw-yaw);pitchT=f.view.pitch;zoomT=f.view.zoom*Math.max(1,(f.w/f.h)/aspect);targetT.copy(f.view.target);
});
// Full slots never remove the entry point for taking the next photograph.
$('photo-new').addEventListener('click',()=>{if(rewind||complete)return;frameTool=true;moveTool=false;setMobileTray(null);});
function flash(text,ms=2600){flashText=text;flashUntil=performance.now()+ms;}
function updateHud(now){
  const status=now<flashUntil?flashText:mode==='camera'&&!landmarker?'Loading hand tracking…'
    :aligned.length&&settings.hints?'Ready to photograph'
    :ahead.length&&settings.hints?'Connection ready after rotation'
    :blocked.length&&settings.hints?'Connection blocked':'';
  hudStatus=practice.active?'':status;
  const canUndo=history.length>0&&!rewind&&!complete&&!anyMoving()&&walker.state!=='walking'&&walker.state!=='waiting';
  const replace=frames.findIndex(canDrop),hud=[status,practice.active,frames.length,level.frames,replace,frameTool,moveTool,canUndo,complete].join('|');
  if(hud!==lastHud){lastHud=hud;$('status').textContent=practice.active?'':status;$('frame-count').textContent=`${frames.length}/${level.frames}`;$('photos-count').textContent=`${frames.length}/${level.frames}`;
    $('frame-count').setAttribute('aria-label',`${frames.length} of ${level.frames} active photo slots used`);
    $('photo-limit').textContent=`${level.frames} active photo${level.frames===1?'':'s'}`;
    $('photos-limit').textContent=`Keeps ${level.frames} photo${level.frames===1?'':'s'}`;
    $('photos-toggle').setAttribute('aria-label',`Photos: ${frames.length} of ${level.frames} active. New photos replace older photos automatically.`);
    const full=frames.length>=level.frames;
    $('photo-rule').textContent=full?(replace<0?'Clear the hidden stone’s space first.':`Replaces photo ${replace+1} automatically.`):'New photos replace older photos automatically.';
    $('photo-new').textContent='＋ Take another photo';$('photo-new').hidden=!full||complete;
    $('photo-tray').classList.toggle('full',full);
    $('frame-tool').setAttribute('aria-pressed',String(frameTool));$('move-tool').setAttribute('aria-pressed',String(moveTool));$('clear').disabled=!frames.length;$('undo').disabled=!canUndo;}
  updatePhotoTray();
  updateCheckpoints();
  const groups=connectionGroups(),key=$('connection-key');key.hidden=!settings.hints||practice.active||complete||mode==='intro'||!Object.values(groups).some(a=>a.length);
  for(const item of key.children)item.hidden=!groups[item.dataset.kind]?.length;
  $('fit-tool').disabled=!!(directing||rewind||anyMoving());
  $('hint-label').textContent=['Hint','Notice','Edges','Guide'][hint.tier];
  $('hint').dataset.tier=hint.tier;$('hint').setAttribute('aria-pressed',String(hint.on));
  $('hint').title=['Hint: highlight a useful structure (H)','More help: highlight the edges (H)','More help: show the next action (H)','Hide hint (H)'][hint.tier];
  if(settings.debug){
    const lines=readings.map((r,i)=>`hand ${i+1}  L:${r.isL?'yes':'no '}  pinch gap:${r.tipGap.toFixed(2)}`);
    lines.push(`view  yaw ${Math.round(((yaw/DEG)%360+360)%360)}°  pitch ${Math.round(pitch/DEG)}°  zoom ${zoom.toFixed(1)}   ${Math.round(fps)} fps`);
    const near=pairs.map(p=>({p,m:misalign(p,camera)})).sort((a,b)=>a.m-b.m).slice(0,3);
    for(const {p,m} of near)lines.push(`seam ${p.id}  off by ${m.toFixed(2)} tiles, ${offLine(p.seam,viewDir(camera)).toFixed(1)}° off its line${sightClear(p.seam,viewDir(camera),cells)?'':', blocked'}`);
    $('debug').textContent=lines.join('\n');
  }
}

// ---------- VR (WebXR, hand tracking) ----------
// In a headset the island floats over a table in front of you and you walk round it. The flat camera
// becomes a viewfinder: it always looks from your head toward the island (snapping onto line-ups as on
// screen), so everything that lines up, joins and comes true works exactly as it does on screen.
//   Touch a path with a fingertip (or point at it from afar and pinch): the traveller walks there.
//   Make a fist by the island: pick it up, move and turn it; two fists make it bigger or smaller.
//   Pinch with both hands: the box between them shows the flat view. Let go to take the photo.
// A panel above the island says what is going on; a shelf of buttons at its near left undoes,
// restarts, drops the newest photo and goes to the next level.
const TABLE=new V3(0,1.05,-.6),ISLAND=.3; // where the island floats in the room (metres) and its radius
const PINCH_ON=.02,PINCH_OFF=.035;
// Holding the island: hold your open left palm up, still, for a moment and the island settles onto it.
// Tilt and twist the hand to look from any side, straight down included. Close the hand and the
// island stays in the air where you left it, so both hands are free to frame.
// Put back returns it to the table.
let photosTaken=0; // every photo taken, for the VR guide
const HOLD_SIZE=.22,HOLD_LIFT=.16,HOLD_CHARGE=.9,HOLD_SHOW=.2;
const vr={on:false,turn:0,hands:[],controllers:[],rig:new THREE.Group(),cam:new THREE.PerspectiveCamera(60,1,.02,100),fog:null,
  anchor:{pos:TABLE.clone(),quat:new THREE.Quaternion(),size:ISLAND},goal:{pos:TABLE.clone(),quat:new THREE.Quaternion(),size:ISLAND},
  hold:{state:'idle',charge:0,lost:0,closing:0,yaw:0,last:null,speed:0,mute:false,ring:null,spin:null,spun:0},align:null,rt:null,quad:null,outline:null,hover:null,panel:null,panelText:'',dock:new THREE.Group(),tray:new THREE.Group(),buttons:[],skyFor:null,sky:null};
renderer.xr.enabled=true;
// Things in the room (hands, panel, buttons, sky) hang off a rig that cancels the island's placement.
vr.rig.matrixAutoUpdate=false;vr.rig.visible=false;scene.add(vr.rig);vr.rig.add(vr.dock,vr.tray);
for(let i=0;i<2;i++){
  const hand=renderer.xr.getHand(i),h={hand,index:i,id:'h'+i,side:null,pinched:false,point:null,start:null,startAt:0,dragged:false,used:false,model:null};
  hand.addEventListener('connected',e=>{h.side=e.data.hand?e.data.handedness:null;});
  hand.addEventListener('disconnected',()=>{h.side=null;h.pinched=false;h.point=null;h.model?.hide();});
  vr.hands.push(h);
  const controller=renderer.xr.getController(i),c={controller,id:'c'+i,isHand:false,side:null,down:false,pinched:false,point:null,start:null,startAt:0,dragged:false,used:false,origin:new V3(),direction:new V3(),grabbing:false};
  const ray=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new V3(),new V3(0,0,-1)]),new THREE.LineBasicMaterial({color:0x79d0c0,transparent:true,opacity:.55}));ray.scale.z=1.5;controller.add(ray);c.rayLine=ray;vr.rig.add(controller);
  controller.addEventListener('connected',e=>{c.side=e.data.hand?null:e.data.handedness;c.isHand=!!e.data.hand;ray.visible=false;});
  controller.addEventListener('disconnected',()=>{c.side=null;c.isHand=false;c.down=c.pinched=c.grabbing=false;c.point=null;ray.visible=false;});
  controller.addEventListener('selectstart',()=>{if(c.side)c.down=true;});controller.addEventListener('selectend',()=>{c.down=false;});
  // A controller's grip button grabs the island, as a closed hand does.
  controller.addEventListener('squeezestart',()=>{if(c.side){c.grabbing=true;c.used=true;}});controller.addEventListener('squeezeend',()=>{c.grabbing=false;});
  vr.controllers.push(c);
}
// Where a point in the room sits on the viewfinder: along the line from your head through it, where
// that line meets the island's middle plane, seen by the flat camera.
function vrScreen(p){
  const h=scene.worldToLocal(vr.cam.position.clone()),q=scene.worldToLocal(p.clone()),n=new V3(...viewDir(camera)),d=q.sub(h);
  const t=target.clone().sub(h).dot(n)/(d.dot(n)||1e-6);return project(h.addScaledVector(d,t));
}
// The open left palm: where it is, which way it faces, where the fingers point and how open the hand is
// (fingertip reach over the wrist-to-knuckle length: about 1.9 open, under 1.2 in a fist).
function palmOf(h){
  const j=h?.hand.joints,need=['wrist','index-finger-metacarpal','pinky-finger-metacarpal','middle-finger-phalanx-proximal','index-finger-tip','middle-finger-tip','ring-finger-tip','thumb-tip'];
  if(!j||h.side!=='left'||h.trusted===false||need.some(n=>!j[n]?.visible))return null;
  const P=n=>j[n].position,w=P('wrist'),k=P('middle-finger-phalanx-proximal'),along=k.clone().sub(w),reach=along.length()||1;
  const normal=new V3().crossVectors(P('pinky-finger-metacarpal').clone().sub(w),P('index-finger-metacarpal').clone().sub(w)).normalize();
  const fingers=along.clone().addScaledVector(normal,-along.dot(normal)).normalize();
  const open=['index-finger-tip','middle-finger-tip','ring-finger-tip'].reduce((s,n)=>s+P(n).distanceTo(w),0)/3/reach;
  return {center:w.clone().lerp(k,.55),normal,fingers,open,pinched:P('thumb-tip').distanceTo(P('index-finger-tip'))<PINCH_OFF};
}
function palmQuat(p){const x=new V3().crossVectors(p.normal,p.fingers);return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,p.normal,p.fingers));}
// The island follows a goal pose (the table, the palm, or wherever it was let go), easing toward it.
function updateHold(dt){
  const H=vr.hold,a=vr.anchor,g=vr.goal,hand=vr.hands.find(h=>h.side==='left');
  const p=!story.open&&!maker?.editing&&!vr.framing?palmOf(hand):null;
  if(p){const v=H.last?p.center.distanceTo(H.last)/Math.max(dt,1e-3):0;H.speed+=(v-H.speed)*Math.min(1,dt*10);H.last=p.center.clone();if(H.mute&&!p.pinched)H.mute=false;}
  else H.last=null;
  // While it sits on your palm, pinch beside it with your right hand and drag round to spin it.
  const R=vr.hands.find(h=>h.side==='right');
  if(H.state==='held'&&R?.pinched&&R.point){
    const up=Y_UP.clone().applyQuaternion(a.quat),v=R.point.clone().sub(a.pos);v.addScaledVector(up,-v.dot(up));
    if(!H.spin){if(!R.was&&R.point.distanceTo(a.pos)<a.size*1.3+.08)H.spin={v};}
    else if(v.length()>.015&&H.spin.v.length()>.015){
      const turn=Math.atan2(up.dot(new V3().crossVectors(H.spin.v,v)),H.spin.v.dot(v));H.yaw+=turn;H.spun+=Math.abs(turn);H.spin.v=v;
    }
    if(H.spin)R.used=true;
  }else H.spin=null;
  if(H.state==='held'){
    if(!p){if((H.lost+=dt)>.4)letGoIsland();}
    else{
      // Closing the hand lets go. The island stops following as soon as the fingers start to curl,
      // so it stays exactly where it was seen, not where the closing hand drifts to.
      H.lost=0;H.closing=p.open<1.15?H.closing+dt:0;
      if(H.closing>.12)letGoIsland();
      else if(p.open>1.35){g.quat.copy(palmQuat(p)).multiply(new THREE.Quaternion().setFromAxisAngle(Y_UP,H.yaw));g.pos.copy(p.center).addScaledVector(p.normal,HOLD_LIFT);g.size=HOLD_SIZE;}
    }
  }else{
    const ready=p&&!H.mute&&p.normal.y>.5&&p.open>1.45&&!p.pinched&&H.speed<.35;
    H.charge=ready?H.charge+dt:Math.max(0,H.charge-dt*3);
    if(H.charge>=HOLD_CHARGE){
      // Keep the island's heading as it settles flat on the palm.
      const v=new V3(0,0,1).applyQuaternion(palmQuat(p).invert().multiply(a.quat));
      H.state='held';H.charge=H.lost=H.closing=0;H.yaw=Math.atan2(v.x,v.z);play('place');
      for(const h of [...vr.hands,...vr.controllers])h.grabbing=false;
    }
  }
  const k=1-Math.exp(-(H.state==='held'||grab.key?16:7)*dt);
  a.pos.lerp(g.pos,k);a.quat.slerp(g.quat,k);a.size+=(g.size-a.size)*k;
  // A ring fills on the palm while it is held out.
  const ring=H.ring,t=(H.charge-HOLD_SHOW)/(HOLD_CHARGE-HOLD_SHOW);ring.visible=!!p&&H.state!=='held'&&t>0;
  if(ring.visible){ring.position.copy(p.center).addScaledVector(p.normal,.015);ring.quaternion.setFromUnitVectors(new V3(0,0,1),p.normal);ring.geometry.setDrawRange(0,6*Math.ceil(48*Math.min(1,t)));}
}
function letGoIsland(){
  const H=vr.hold,a=vr.anchor,g=vr.goal;if(H.state!=='held')return;
  H.state='idle';H.charge=0;H.mute=true;play('place'); // the goal keeps the last open-palm pose
  // The hand that just closed to set the island down does not grab it straight back.
  for(const h of vr.hands)if(h.side==='left')h.gripBlocked=true;
}
function putIslandBack(){letGoIsland();vr.goal.pos.copy(TABLE);vr.goal.quat.identity();vr.goal.size=ISLAND;}
const islandAway=()=>vr.goal.pos.distanceTo(TABLE)>.02||vr.goal.quat.angleTo(new THREE.Quaternion())>.03||Math.abs(vr.goal.size-ISLAND)>.005;
function placeIsland(){
  const a=vr.anchor,sc=a.size/radius*(maker?.editing?maker.workspaceScale:1);scene.scale.setScalar(sc);
  scene.quaternion.copy(a.quat).multiply(new THREE.Quaternion().setFromAxisAngle(Y_UP,vr.turn));
  scene.position.copy(center).multiplyScalar(-sc).applyQuaternion(scene.quaternion).add(a.pos);
  scene.updateMatrix();scene.updateMatrixWorld(true);vr.rig.matrix.copy(scene.matrix).invert();vr.rig.matrixWorldNeedsUpdate=true;
}
// The flat view (the viewfinder's), rendered into a texture: the headset rendering is paused for it.
function renderFlat(rt,cam=camera){
  const xr=renderer.xr.enabled,pos=scene.position.clone(),rot=scene.rotation.clone(),sc=scene.scale.clone(),fog=scene.fog,rig=vr.rig.visible;
  renderer.xr.enabled=false;scene.position.set(0,0,0);scene.rotation.set(0,0,0);scene.scale.setScalar(1);art.scale(1);scene.fog=vr.on?vr.fog:fog;vr.rig.visible=false;const hints=vhint.group.visible;vhint.group.visible=false;
  nightAir?.update(0,cam);
  scene.updateMatrixWorld(true);
  const old=renderer.getRenderTarget();renderer.setRenderTarget(rt);renderer.render(scene,cam);renderer.setRenderTarget(old);
  renderer.xr.enabled=xr;scene.position.copy(pos);scene.rotation.copy(rot);scene.scale.copy(sc);art.scale(sc.x);scene.fog=fog;vr.rig.visible=rig;vhint.group.visible=hints;scene.updateMatrixWorld(true);
  nightAir?.update(0,camera);
}
// The flat view as a picture (for the album), on the level's sky.
function flatCanvas(w=1024,cam=camera,h=Math.round(w*H/W)){
  const rt=new THREE.WebGLRenderTarget(w,h);rt.texture.colorSpace=THREE.SRGBColorSpace;
  const clear=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();renderer.setClearColor(new THREE.Color(palette.sky[1]),1);
  renderFlat(rt,cam);renderer.setClearColor(clear,alpha);
  const px=new Uint8Array(w*h*4);renderer.readRenderTargetPixels(rt,0,0,w,h,px);rt.dispose();
  const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d'),img=g.createImageData(w,h);
  for(let y=0;y<h;y++)img.data.set(px.subarray((h-1-y)*w*4,(h-y)*w*4),y*w*4);g.putImageData(img,0,0);
  // In a headset that shows the room the render clears to clear, so the sky goes in behind.
  g.globalCompositeOperation='destination-over';g.fillStyle=palette.sky[1];g.fillRect(0,0,w,h);g.globalCompositeOperation='source-over';return c;
}
// Fit the finished crossing to its postcard, keeping the player's photographic angle.
function completionPhoto(){
  const w=1200,h=800,points=[...framingPoints(false),...(finale?finale.framingPoints():[])];
  const fit=fitView(points,yaw,pitch,w,h,{left:40,right:40,top:36,bottom:36,padding:1.12});
  const cam=camera.clone(),at=new V3(...fit.target);
  Object.assign(cam,{left:-fit.zoom*w/h,right:fit.zoom*w/h,top:fit.zoom,bottom:-fit.zoom});
  cam.position.copy(at).add(offsetOf(yaw,pitch,FAR));cam.lookAt(at);cam.updateProjectionMatrix();cam.updateMatrixWorld(true);
  return flatCanvas(w,cam,h);
}
// Build-time album covers use the real scene, without changing the player's camera or puzzle.
function albumPreview(){
  const w=960,h=720,y=level.view.yaw*DEG,p=level.view.pitch*DEG,fit=fitView(framingPoints(false),y,p,w,h,{left:20,right:20,top:18,bottom:18,padding:1.04});
  const cam=new THREE.OrthographicCamera(-fit.zoom*w/h,fit.zoom*w/h,fit.zoom,-fit.zoom,1,FAR*2),at=new V3(...fit.target);
  cam.position.copy(at).add(offsetOf(y,p,FAR));cam.lookAt(at);cam.updateMatrixWorld(true);
  const hidden=[];levelGroup.traverse(o=>{if(o.userData.futureOutline&&o.visible){hidden.push(o);o.visible=false;}});
  try{return flatCanvas(w,cam,h).toDataURL('image/webp',.92);}finally{for(const o of hidden)o.visible=true;}
}
// Show the part the player actually framed, from its saved camera, at thumbnail resolution.
function photoThumbnail(poly,cam=camera,w=W,h=H){
  const xs=poly.map(p=>p.x/w),ys=poly.map(p=>p.y/h),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),crop=cam.clone();
  crop.left=THREE.MathUtils.lerp(cam.left,cam.right,x0);crop.right=THREE.MathUtils.lerp(cam.left,cam.right,x1);
  crop.top=THREE.MathUtils.lerp(cam.top,cam.bottom,y0);crop.bottom=THREE.MathUtils.lerp(cam.top,cam.bottom,y1);crop.updateProjectionMatrix();
  const height=Math.max(24,Math.min(512,Math.round(256*(crop.top-crop.bottom)/(crop.right-crop.left))));
  return flatCanvas(256,crop,height).toDataURL('image/jpeg',.85);
}
function textTexture(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());t.userData.draw=()=>{draw(c.getContext('2d'),w,h);t.needsUpdate=true;};t.userData.draw();return t;}
function buildVR(){
  // The sky all round, in the level's colours.
  vr.sky=new THREE.Mesh(new THREE.SphereGeometry(40,32,16),new THREE.MeshBasicMaterial({side:THREE.BackSide,depthWrite:false,fog:false}));vr.rig.add(vr.sky);
  // The panel: the level's name and what to do.
  const panelTex=textTexture(1024,300,(g,w,h)=>drawPanel(g,w,h,vr.panelText));
  vr.panel=new THREE.Mesh(new THREE.PlaneGeometry(.48,.1406),new THREE.MeshBasicMaterial({map:panelTex,transparent:true,depthTest:false,depthWrite:true,alphaTest:.05,toneMapped:false}));vr.panel.renderOrder=20;vr.dock.add(vr.panel);
  vr.infoTexture=panelTex;
  vr.storyTexture=textTexture(1024,512,(g,w,h)=>{
    g.clearRect(0,0,w,h);const entry=story.current();if(!entry)return;
    g.save();g.translate(w/2,h/2);g.scale(w/2,h/2);
    const wash=g.createRadialGradient(0,0,.1,0,0,1);
    wash.addColorStop(0,palette.dark?'rgba(14,13,28,.22)':'rgba(255,248,236,.28)');wash.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=wash;g.fillRect(-1,-1,2,2);g.restore();g.textAlign='center';
    g.fillStyle=palette.dark?'#e0c7a0':PEOPLE[entry.speaker].color;g.font='28px Georgia,serif';g.fillText(entry.speaker,w/2,112);
    g.fillStyle=palette.dark?'#fff2df':'#433447';g.font='46px Georgia,serif';let line='';const lines=[];
    for(const word of entry.text.split(' ')){
      const next=line?line+' '+word:word;
      if(line&&g.measureText(next).width>w-120){lines.push(line);line=word;}else line=next;
    }
    lines.push(line);lines.forEach((text,i)=>g.fillText(text,w/2,254-(lines.length-1)*29+i*58));
    g.globalAlpha=.65;g.font='italic 25px Georgia,serif';g.fillText(entry.last?'pinch to begin':'pinch to continue',w/2,420);
    g.font='20px Georgia,serif';g.fillText('hold to skip',w/2,461);g.globalAlpha=1;
  });
  syncVRButtons();
  // The frame between two pinching hands: an outline, and the flat view inside it.
  vr.rt=new THREE.WebGLRenderTarget(1024,Math.round(1024*H/W));vr.rt.texture.colorSpace=THREE.SRGBColorSpace;
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(new Array(18).fill(0),3));g.setAttribute('uv',new THREE.Float32BufferAttribute(new Array(12).fill(0),2));
  vr.quad=new THREE.Mesh(g,new THREE.MeshBasicMaterial({map:vr.rt.texture,side:THREE.DoubleSide,transparent:true,opacity:.92,depthTest:false}));vr.quad.renderOrder=10;vr.quad.visible=false;vr.rig.add(vr.quad);
  vr.outline=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([new V3(),new V3(),new V3(),new V3()]),new THREE.LineBasicMaterial({color:0xffd36b,depthTest:false}));vr.outline.renderOrder=11;vr.outline.visible=false;vr.rig.add(vr.outline);
  vr.hold.ring=new THREE.Mesh(new THREE.RingGeometry(.03,.038,48,1,Math.PI/2,-Math.PI*2),new THREE.MeshBasicMaterial({color:0xffd36b,transparent:true,opacity:.85,side:THREE.DoubleSide,depthWrite:false}));
  vr.hold.ring.visible=false;vr.rig.add(vr.hold.ring);
  vr.guide=createVRGuide(THREE,{rig:vr.rig,scene,play,sparkle,top,now:()=>elapsed,
    head:()=>vr.cam.position,islandAt:()=>vr.anchor.pos,islandSize:()=>vr.anchor.size,center:()=>center.clone(),radius:()=>radius,
    toRoom:p=>scene.localToWorld(p.clone()),turn:()=>vr.turn,photos:()=>photosTaken,
    hands:()=>vr.hands.some(h=>h.side),controllers:()=>vr.controllers.some(c=>c.side),
    holding:()=>vr.hold.state==='held',grabbing:()=>!!grab.key,
    islandPose:()=>({pos:vr.anchor.pos.clone(),quat:vr.anchor.quat.clone(),size:vr.anchor.size}),
    islandFacingYou:()=>Y_UP.clone().applyQuaternion(vr.anchor.quat).dot(vr.cam.position.clone().sub(vr.anchor.pos).normalize()),
    walkerNode:()=>walker.node,walking:()=>walker.state==='walking',
    // A path a few steps away that is neither home nor a plate, so walking there changes nothing.
    walkTarget:()=>{
      const prev=routes(),depth=n=>{let d=0;for(let c=n;c!==walker.node;c=prev.get(c).n)d++;return d;};
      const options=[...prev.keys()].filter(n=>n!==walker.node&&n!==goal&&!plates.some(p=>p.at&&sameSpot(n,p.at)));
      return options.find(n=>depth(n)>=3)??options.at(-1)??null;
    },
    seen:()=>{settings.vrGuideDone=true;persistSettings();},spun:()=>vr.hold.spun
  });
  // What a pinch would walk to.
  vr.hover=new THREE.Mesh(new THREE.RingGeometry(.28,.4,32),new THREE.MeshBasicMaterial({color:0xffd36b,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false}));vr.hover.rotation.x=-Math.PI/2;vr.hover.visible=false;scene.add(vr.hover);
}
// ---------- VR buttons ----------
// A compact shelf follows the island, with buttons kept at a fixed physical size.
// Contextual actions (Next level, Skip guide) remain beside the island.
const TILE_W=.05,TILE_H=TILE_W*224/240,TILE_STEP_X=.055,TILE_STEP_Y=.052,POKE_DEPTH=.008,TIP=.006,SHELF_COLUMNS=3;
const menu={shown:0,poke:null};
function syncVRButtons(){
  const entry=story.current(),custom=maker?.vrControls();
  const context=custom||entry?[]:vr.guide?.active?[{label:'Skip guide',small:true,act:()=>vr.guide.skip()}]:[];
  const items=custom?.items??(entry?[]:[
    ...(complete?[{label:'Next level',primary:true,act:()=>{closeCard();nextLevel();}}]:[{label:['Hint','More help','Show me','Hide hint'][hint.tier],icon:'Hint',active:hint.on,act:()=>askHint()}]),
    {label:'Photos',act:()=>openCard('photos')},
    {label:'More',act:()=>openCard('menu')}
  ]);
  const signature=(custom?'maker':'play')+'|'+[...context,{label:'/'},...items].map(b=>[b.label,!!b.active,!!b.disabled,!!b.primary].join(':')).join('|');
  if(signature===vr.buttonsKey)return;vr.buttonsKey=signature;
  for(const b of [...vr.buttons,...(vr.trayBar?[vr.trayBar]:[])]){b.removeFromParent();b.geometry.dispose();b.material.map.dispose();b.material.dispose();}vr.buttons=[];vr.trayBar=null;
  const button=(item,tex,w,h)=>{
    const b=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide,toneMapped:false,depthTest:false,depthWrite:true,alphaTest:.05}));
    b.userData.act=()=>{if(!item.disabled)item.act();};b.userData.label=item.label;b.userData.disabled=!!item.disabled;vr.buttons.push(b);return b;
  };
  // By the island: a pill under the panel.
  for(const item of context){
    const w=.14,h=.17*144/512;let hover=false;const tex=textTexture(Math.round(144*w/h),144,(g,cw,ch)=>drawButton(g,cw,ch,item,hover)),b=button(item,tex,w,h);
    b.userData.setHover=on=>{if(on===hover)return;hover=on;tex.userData.draw();};
    // Pressed with a fingertip like the shelf keys: it needs its resting place and size.
    b.userData.where='island';b.renderOrder=22;b.position.set(item.small?.2:0,ISLAND+(item.small?.055:.07),-.02);b.userData.rest=b.position.clone();b.userData.size=[w,h];vr.dock.add(b);
  }
  if(custom){
    // The maker's many tools stay by the island.
    const columns=custom.columns??3;
    items.forEach((item,i)=>{
      let hover=false;const tex=textTexture(512,144,(g,w,h)=>drawButton(g,w,h,item,hover)),b=button(item,tex,.125,.043);
      b.userData.setHover=on=>{if(on===hover)return;hover=on;tex.userData.draw();};
      const row=Math.floor(i/columns),col=i%columns,count=Math.min(columns,items.length-row*columns);
      b.position.set((col-(count-1)/2)*.137,-.08-row*.049,.42+row*.02);b.rotation.x=-.45;vr.dock.add(b);
    });
    return;
  }
  if(!items.length)return;
  // Three essentials in one row; secondary actions live under More.
  const C=SHELF_COLUMNS,rows=Math.ceil(items.length/C),pad=.007,m=.006,px=2600;
  const w=C*TILE_STEP_X-(TILE_STEP_X-TILE_W)+2*pad,h=rows*TILE_STEP_Y-(TILE_STEP_Y-TILE_H)+2*pad;
  const plate=textTexture(Math.round((w+2*m)*px),Math.round((h+2*m)*px),(g,cw,ch)=>drawToolbar(g,cw,ch,m*px));
  vr.trayBar=new THREE.Mesh(new THREE.PlaneGeometry(w+2*m,h+2*m),new THREE.MeshBasicMaterial({map:plate,transparent:true,depthWrite:false,toneMapped:false}));
  Object.assign(vr.trayBar.material,{depthTest:false,depthWrite:true,alphaTest:.05});vr.trayBar.renderOrder=20;vr.tray.add(vr.trayBar);
  items.forEach((item,i)=>{
    let hover=false;const tex=textTexture(240,224,(g,w,h)=>drawTool(g,w,h,item,hover)),b=button(item,tex,TILE_W,TILE_H);
    b.userData.setHover=on=>{if(on===hover)return;hover=on;tex.userData.draw();};
    const row=Math.floor(i/C),col=i%C,count=Math.min(C,items.length-row*C);
    b.userData.rest=new V3((col-(count-1)/2)*TILE_STEP_X,((rows-1)/2-row)*TILE_STEP_Y,.003);b.userData.size=[TILE_W,TILE_H];b.position.copy(b.userData.rest);
    Object.assign(b.material,{depthTest:false,depthWrite:true,alphaTest:.05});b.userData.where='menu';b.renderOrder=21;vr.tray.add(b);
  });
}
// Buttons that can be pointed at: on screen, and not folded away.
const liveButtons=()=>[...vr.buttons,...vcard.buttons].filter(b=>{if(b.parent===vr.tray&&menu.shown<.85)return false;for(let o=b;o;o=o.parent)if(!o.visible)return false;return true;});
// Follow the island's position, with fixed room-space offsets independent of its size.
// Ease movement, and keep the target steady while a finger is pressing a button.
function updateShelf(dt){
  const g=vr.tray,a=vr.anchor,head=vr.cam.position;
  const toward=head.clone().sub(a.pos).setY(0);if(toward.lengthSq()<1e-6)toward.set(0,0,1);toward.normalize();
  const left=new V3(-toward.z,0,toward.x);
  const at=a.pos.clone().addScaledVector(left,ISLAND+.08).addScaledVector(toward,ISLAND*.65).add(new V3(0,ISLAND*.8+.06,0));
  const show=vr.hold.state!=='held'&&!grab.key&&!story.open&&!vcard.kind&&vr.buttons.some(b=>b.userData.where==='menu');
  menu.shown+=((show?1:0)-menu.shown)*Math.min(1,dt*10);
  if(menu.shown<.05)g.position.copy(at);else if(!menu.poke)g.position.lerp(at,1-Math.exp(-14*dt));
  g.lookAt(head);g.scale.setScalar(1);g.visible=menu.shown>.03;g.updateMatrixWorld(true);
}
// Pressing with an index fingertip, either hand, on the shelf or a card. A press counts when the finger
// comes in from the front and pushes the key in; it must come back out before it can press again. A
// closed hand never presses.
function updatePoke(){
  const keys=liveButtons().filter(b=>b.userData.rest);let over=null;
  for(const h of vr.hands){
    h.nearShelf=false;const tip=h.hand.joints['index-finger-tip'];
    if(!h.side||!tip?.visible||h.grip||h.grabbing){h.pokeArmed=null;continue;}
    let hit=null;
    for(const b of keys){
      const p=b.parent.worldToLocal(tip.position.clone()),[w,hh]=b.userData.size,r=b.userData.rest,x=p.x-r.x,y=p.y-r.y,z=p.z-r.z-TIP;
      if(Math.abs(x)<w/2+.02&&Math.abs(y)<hh/2+.02&&z<.06&&z>-.05)h.nearShelf=true;
      if(Math.abs(x)<w/2+.006&&Math.abs(y)<hh/2+.006&&z<.035&&z>-.035&&(!hit||z<hit.z))hit={b,z};
    }
    if(!hit){h.pokeArmed=null;continue;}
    if(hit.z>.005)h.pokeArmed=hit.b;
    if(h.pokeArmed===hit.b&&hit.z<-.002){h.pokeArmed=null;h.used=true;hit.b.userData.act();play('place');}
    if(!over||hit.z<over.z)over=hit;
  }
  for(const b of keys){const d=over?.b===b?Math.max(0,Math.min(POKE_DEPTH,-over.z)):0;b.position.z=b.userData.rest.z-d;}
  menu.poke=over?.b??null;
}
// ---------- VR cards ----------
// Two cards come up in front of you, a little below your eyes, facing you: the finish card once a level
// is done (its photo, where it was, its name and caption, and the way on), and the album, to play any
// level, a place at a time; the first places teach the game. Press their keys with a fingertip, or
// point and pinch. A card stays where it came up, unless you turn well away from it.
const vcard={group:new THREE.Group(),kind:null,buttons:[],chapter:0,doneFor:-1,place:null,sig:'',photoSrc:'',images:new Map(),placed:false,moving:false};
vcard.group.visible=false;vr.rig.add(vcard.group);
function albumChapters(){
  const out=[];
  for(const i of LEVEL_ORDER){
    const L=LEVELS[i],name=CHAPTERS[(L.palette??i)%CHAPTERS.length];
    if(out.at(-1)?.name!==name)out.push({name,subject:countLevels(L.palette??i),levels:[]});
    out.at(-1).levels.push(i);
  }
  return out;
}
function cardImage(src,redraw){
  let img=vcard.images.get(src);if(!img){img=new Image();img.decoding='async';img.src=src;vcard.images.set(src,img);}
  if(!img.complete)img.addEventListener('load',()=>redraw(),{once:true});
  return img;
}
function clearCard(){
  for(const o of [...vcard.group.children]){o.removeFromParent();o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose();}
  vcard.buttons=[];
}
function cardKey(item,{w,h,tw,th,draw},at){
  let hover=false;const tex=textTexture(tw,th,(g,cw,ch)=>draw(g,cw,ch,hover));
  const b=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,transparent:true,toneMapped:false,depthTest:false,depthWrite:true,alphaTest:.05}));
  b.userData={act:()=>{if(!item.disabled)item.act();},label:item.label,disabled:!!item.disabled,where:'card',rest:at.clone(),size:[w,h],redraw:()=>tex.userData.draw(),
    setHover:on=>{if(on===hover)return;hover=on;tex.userData.draw();}};
  b.position.copy(at);b.renderOrder=31;vcard.group.add(b);vcard.buttons.push(b);return b;
}
// Keys keep one height (that of a Settings key) however wide they are, so a wide key is longer, not taller.
const cardPill=(item,w,at)=>{const h=.17*144/512;return cardKey(item,{w,h,tw:Math.round(144*w/h),th:144,draw:(g,cw,ch,hover)=>drawButton(g,cw,ch,item,hover)},at);};
function cardBack(w,h,draw){
  const tw=1200,tex=textTexture(tw,Math.round(tw*h/w),draw);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,transparent:true,toneMapped:false,depthTest:false,depthWrite:true,alphaTest:.05}));
  m.renderOrder=30;vcard.group.add(m);return tex;
}
// Every card is laid out as the web settings are: the same width, the heading top left with a round close
// button in the corner, the content under it, and the keys along the bottom, two to a row (a wide key,
// the one thing to do next, gets a row of its own). Sizes are in metres.
const CARD_W=.4,KEY_ROW=.053,KEY_W=.17;
const headHeight=subtitle=>subtitle?.09:.08;
function keyRows(items){const rows=[];for(const it of items){const last=rows.at(-1);if(!it.wide&&last?.length===1&&!last[0].wide)last.push(it);else rows.push([it]);}return rows;}
const keysHeight=items=>keyRows(items).length*KEY_ROW+.02;
function placeKeys(items,h,close=true){
  const rows=keyRows(items),base=-h/2+.044;
  rows.forEach((row,r)=>{
    const y=base+(rows.length-1-r)*KEY_ROW;
    if(row.length===1)cardPill(row[0],row[0].wide?.35:KEY_W,new V3(0,y,.004));
    else row.forEach((it,i)=>cardPill(it,KEY_W,new V3((i-.5)*.18,y,.004)));
  });
  if(close){const d=.036;cardKey({label:'Close',round:true,act:()=>closeCard()},{w:d,h:d,tw:160,th:160,draw:(g,cw,ch,hover)=>drawButton(g,cw,ch,{label:'Close',round:true},hover)},new V3(CARD_W/2-.04,h/2-.036,.004));}
}
function buildCard(){
  clearCard();
  const w=CARD_W;
  if(vcard.kind==='done'){
    // As on screen: where it was, the level's name and caption, its photo, and the way on.
    const keys=[{label:$('next').textContent,primary:true,wide:true,act:()=>{closeCard();nextLevel();}},...(maker?.active?[]:[{label:'Album',wide:true,act:()=>openCard('album')}])];
    const caption=$('done-text').textContent,top=headHeight(caption),size=.09,body=size*1.16+.03,h=top+body+keysHeight(keys);
    const tex=cardBack(w,h,(g,cw,ch)=>drawSheet(g,cw,ch,{kicker:$('done-location')?.textContent??'',title:$('done-title').textContent,subtitle:caption,sky:palette.sky[1],
      photos:[{img:vcard.photoSrc?cardImage(vcard.photoSrc,()=>tex.userData.draw()):null,x:.5,y:(top+.015+size/2)/h,size:size/w,turn:-.03}]}));
    placeKeys(keys,h);
  }else if(vcard.kind==='place'){
    // Moving on to a new place: its name and how many levels it has, under the last place's photos.
    const p=vcard.place,keys=[{label:'Continue',primary:true,wide:true,act:()=>{closeCard();loadLevel(p.next);}}];
    const top=headHeight(p.line),size=.072,n=p.shots.length,body=n?size*1.16+.035:0,h=top+body+keysHeight(keys),turns=[-.06,.05,-.03,.07];
    const tex=cardBack(w,h,(g,cw,ch)=>drawSheet(g,cw,ch,{kicker:'Next place',title:p.title,subtitle:p.line,sky:palette.sky[1],
      photos:p.shots.map((src,i)=>({img:cardImage(src,()=>tex.userData.draw()),x:.5+(i-(n-1)/2)*.085/w,y:(top+.018+size/2)/h,size:size/w,turn:turns[i%4]}))}));
    placeKeys(keys,h,false);
  }else if(vcard.kind==='photos'){
    // Your photos, as the tray on screen: each one, what it keeps, and a key to drop it. Below them the
    // three checkpoints: save where you are, and go back to one later.
    const n=frames.length,tw=.12,th=.14,cw=.11,ch=.1,any=checkpointSlots.some(Boolean),top=headHeight('');
    const photoY=top+.012,labelY=photoY+(n?th+.05:.045),slotY=labelY+.018,h=slotY+ch+(any?.046:.012)+keysHeight([]);
    cardBack(w,h,(g,cw2,ch2)=>drawSheet(g,cw2,ch2,{kicker:`Photos · ${n} of ${level.frames}`,title:'Your photos',
      notes:n?[]:[{text:'No photos yet. Frame a line-up with both hands to take one.',y:(photoY+.022)/h}],labels:[{text:'Checkpoints',y:labelY/h}]}));
    frames.forEach((f,i)=>{
      const x=(i-(n-1)/2)*(tw+.008),y=h/2-photoY-th/2,details={index:i,action:'keep',frame:f,...photoDependents(frames,f),waiting:waitingConnections(f),blocked:!canDrop(f)};
      const tex=textTexture(300,Math.round(300*th/tw),(g,cw2,ch2)=>drawPhotoTile(g,cw2,ch2,{number:i+1,img:cardImage(f.thumbnail,()=>tex.userData.draw()),text:photoInspectionText(details).replace(/^Photo \d+ /,''),sky:palette.sky[1]}));
      const m=new THREE.Mesh(new THREE.PlaneGeometry(tw,th),new THREE.MeshBasicMaterial({map:tex,transparent:true,toneMapped:false,depthTest:false,depthWrite:true,alphaTest:.05}));m.position.set(x,y,.004);m.renderOrder=31;vcard.group.add(m);
      cardPill({label:`Drop photo ${i+1}`,disabled:!canDrop(f),act:()=>{removeFrame(f);flash('Photo dropped.');play('remove');}},.12,new V3(x,y-th/2-.022,.004));
    });
    const busy=!!rewind||checkpointLoading||checkpointSaving,stable=checkpointStable(),cy=h/2-slotY-ch/2;
    checkpointSlots.forEach((slot,i)=>{
      const x=(i-1)*(cw+.016);
      const b=cardKey({label:slot?`Restore ${i+1}`:`Save ${i+1}`,disabled:busy||!slot&&!stable,act:()=>{if(slot){closeCard();restoreCheckpoint(i);}else saveCheckpoint(i);}},{w:cw,h:ch,tw:300,th:Math.round(300*ch/cw),
        draw:(g,cw2,ch2,hover)=>drawLevelTile(g,cw2,ch2,{number:i+1,title:slot?'Go back here':'Save here',img:slot?.image?cardImage(slot.image,()=>b.userData.redraw()):null},hover)},new V3(x,cy,.004));
      if(slot)cardPill({label:`Save over ${i+1}`,disabled:busy||!stable,act:()=>saveCheckpoint(i)},.11,new V3(x,cy-ch/2-.021,.004));
    });
    placeKeys([],h);
  }else if(vcard.kind==='menu'){
    const action=fn=>()=>{closeCard();fn();};
    const items=[
      {label:'Undo',act:action(()=>undo())},
      {label:'Restart',act:action(()=>restartLevel())},
      {label:'Album',act:()=>openCard('album')},
      {label:'Settings',act:()=>openCard('settings')},
      ...(islandAway()?[{label:'Put back',act:action(()=>putIslandBack())}]:[]),
      ...(vr.ar?[{label:'Room',toggle:true,active:!!settings.vrRoom,act:()=>{settings.vrRoom=!settings.vrRoom;persistSettings();buildCard();}}]:[]),
      ...(levelConversation()?[{label:'Story',act:action(()=>showLevelDialogue())}]:[]),
      {label:'How to play',act:action(()=>vr.guide.start())}
    ];
    const h=headHeight('')+keysHeight(items);
    cardBack(w,h,(g,cw,ch)=>drawSheet(g,cw,ch,{kicker:'Seamline',title:'Menu'}));
    placeKeys(items,h);
  }else if(vcard.kind==='settings'){
    // The settings that matter in a headset, as on screen: sound, following the traveller, the
    // connection edges, motion and detail. Each key shows its state; press to change it.
    const pct=v=>Math.round(v*100),step=v=>Math.round(v*5)>=5?0:Math.min(1,Math.round(v*5+1)/5);
    const save=()=>{persistSettings();for(const [key,id] of [['hints','opt-hints'],['follow','opt-follow'],['music','opt-music']])$(id).checked=settings[key];buildCard();};
    const columns=[
      ['Sound',[
        {label:'Music',on:settings.music,act:()=>{settings.music=!settings.music;setMusic(settings.music&&mode!=='intro',PALETTES.indexOf(palette));save();}},
        {label:'Music volume',value:`${pct(settings.musicVolume)}%`,act:()=>{settings.musicVolume=step(settings.musicVolume);applyComfort();save();}},
        {label:'Sound effects',value:`${pct(settings.effectsVolume)}%`,act:()=>{settings.effectsVolume=step(settings.effectsVolume);applyComfort();save();play('place');}}
      ]],
      ['View & movement',[
        {label:'Follow the traveller',on:settings.follow,act:()=>{settings.follow=!settings.follow;save();}},
        {label:'Connection edges',on:settings.hints,act:()=>{settings.hints=!settings.hints;save();}},
        {label:'Reduced motion',on:reducedMotion(),act:()=>{settings.motion=reducedMotion()?'full':'reduced';applyComfort();save();}},
        {label:'Low detail',on:settings.quality==='low',act:()=>{settings.quality=settings.quality==='low'?'high':'low';applyComfort();save();}}
      ]]
    ];
    const RH=.044,RW=.18,top=headHeight('')+.012,first=top+.04,h=first+Math.max(...columns.map(c=>c[1].length))*RH+.022;
    cardBack(w,h,(g,cw2,ch2)=>drawSheet(g,cw2,ch2,{kicker:'Preferences',title:'Settings',columns:true,
      labels:columns.map(([name],c)=>({text:name,strong:true,x:c?.5+.06:.06,y:(top+.022)/h}))}));
    columns.forEach(([,rows],c)=>rows.forEach((item,r)=>cardKey(item,{w:RW,h:RH-.004,tw:600,th:Math.round(600*(RH-.004)/RW),draw:(g,cw2,ch2,hover)=>drawSettingRow(g,cw2,ch2,item,hover)},
      new V3((c-.5)*.198,h/2-first-RH/2-r*RH,.004))));
    placeKeys([],h);
  }else if(vcard.kind==='album'){
    // A place at a time: its levels as tiles, then the keys to turn the page.
    const chapters=albumChapters(),k=vcard.chapter=Math.max(0,Math.min(chapters.length-1,vcard.chapter)),c=chapters[k];
    const cols=5,tw=.07,th=.085,stepX=.075,stepY=.092,rows=Math.ceil(c.levels.length/cols),top=headHeight(c.subject)+.008;
    const keys=[{label:'Previous',disabled:k===0,act:()=>{vcard.chapter--;buildCard();}},{label:'Next',disabled:k===chapters.length-1,act:()=>{vcard.chapter++;buildCard();}},
      {label:'How to play',wide:true,act:()=>{closeCard();vr.guide.start();}}];
    const h=top+rows*stepY+.008+keysHeight(keys);
    cardBack(w,h,(g,cw,ch)=>drawSheet(g,cw,ch,{kicker:`Album · ${k+1} of ${chapters.length}`,title:c.name,subtitle:c.subject}));
    c.levels.forEach((i,n)=>{
      const L=LEVELS[i],preview=ALBUM_PREVIEWS[L.name],src=preview?.revision===levelRevision(L)?preview.src:null;
      const row=Math.floor(n/cols),col=n%cols,count=Math.min(cols,c.levels.length-row*cols);
      const b=cardKey({label:levelTitle(L),act:()=>{closeCard();loadLevel(i);}},{w:tw,h:th,tw:300,th:Math.round(300*th/tw),
        draw:(g,cw,ch,hover)=>drawLevelTile(g,cw,ch,{number:campaignNumber(LEVEL_ORDER,i),title:levelTitle(L),done:!!progress.done[L.name],current:i===levelIndex,img:src?cardImage(src,()=>b.userData.redraw()):null},hover)},
        new V3((col-(count-1)/2)*stepX,h/2-top-th/2-row*stepY,.004));
    });
    placeKeys(keys,h);
  }
}
function openCard(kind){
  if(kind==='album')vcard.chapter=Math.max(0,albumChapters().findIndex(c=>c.levels.includes(levelIndex)));
  if(kind==='done')vcard.photoSrc=$('done-photo').getAttribute('src')||'';
  vcard.kind=kind;vcard.placed=false;buildCard();play('place');
}
function closeCard(){vcard.kind=null;clearCard();vcard.group.visible=false;}
function updateCard(dt){
  // The finish card comes up once the level's photo is taken.
  if(complete&&!$('done').hidden&&vcard.doneFor!==winEpoch&&!story.open){vcard.doneFor=winEpoch;openCard('done');}
  if(vcard.kind==='done'&&!complete)closeCard();
  if(vcard.kind==='done'){const src=$('done-photo').getAttribute('src')||'';if(src!==vcard.photoSrc){vcard.photoSrc=src;buildCard();}}
  if(vcard.kind==='photos'){const sig=frames.map(f=>f.born+':'+f.links.length+':'+canDrop(f)).join()+'|'+checkpointSlots.map(c=>c?.savedAt??0).join()+'|'+checkpointStable()+checkpointSaving+checkpointLoading;if(sig!==vcard.sig){vcard.sig=sig;buildCard();}}
  const g=vcard.group;g.visible=!!vcard.kind&&!story.open;if(!g.visible)return;
  const head=vr.cam.position,f=new V3(0,0,-1).applyQuaternion(vr.cam.quaternion).setY(0);
  if(f.lengthSq()<1e-4)f.copy(vr.anchor.pos).sub(head).setY(0);f.normalize();
  const want=head.clone().addScaledVector(f,.45).add(new V3(0,-.13,0));
  if(!vcard.placed){g.position.copy(want);vcard.placed=true;vcard.moving=false;}
  else if(!menu.poke&&g.position.clone().sub(head).setY(0).normalize().dot(f)<.5)vcard.moving=true;
  if(vcard.moving){g.position.lerp(want,1-Math.exp(-5*dt));if(g.position.distanceTo(want)<.01)vcard.moving=false;}
  g.lookAt(head);g.updateMatrixWorld(true);
}
// ---------- VR line-up cues ----------
// The flat view marks crossings on screen; in a headset they are drawn on the island itself. The two
// edges of a crossing that lines up from where you stand glow gold; crossings your photos hold glow
// teal, ones waiting on a moving path lavender. Near a line-up, focus brackets gather round the
// crossing, closing in (with a small arrow for which way to lean) until it lines up, then turn gold.
// Only the opening five lessons get the broad search cue (angles are degrees).
const cueNear=()=>levelIndex<5&&extraIndex===null?28:Math.max(5,8-Math.max(0,LEVEL_ORDER.indexOf(levelIndex)-5)*.1);
const CUE_COLORS={ready:0xffe2a0,held:0xb7eee1,waiting:0xd4c7f1,blocked:0xdf9f93};
const cue={edges:[],ready:0,focus:null};
// Each edge is a coloured line over a soft dark one, as on screen, so it reads on pale paths and dark nights.
const cueShade=new THREE.MeshBasicMaterial({color:0x24203a,transparent:true,opacity:.3,depthWrite:false,fog:false});
function cueEdge(i){
  if(!cue.edges[i]){const geo=new THREE.CylinderGeometry(1,1,1,10,1),m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,fog:false,toneMapped:false})),shade=new THREE.Mesh(geo,cueShade);m.renderOrder=5;shade.renderOrder=4;shade.scale.set(1.9,1.02,1.9);m.add(shade);scene.add(m);cue.edges[i]=m;}
  return cue.edges[i];
}
function buildFocus(){
  const g=new THREE.Group(),mat=new THREE.MeshBasicMaterial({color:0xfff6e0,transparent:true,depthTest:false,depthWrite:false,fog:false,toneMapped:false,side:THREE.DoubleSide});
  const arm=.024,thick=.005,corners=[],shade=new THREE.MeshBasicMaterial({color:0x24203a,transparent:true,opacity:.45,depthTest:false,depthWrite:false,fog:false,side:THREE.DoubleSide});
  for(const [sx,sy] of [[-1,1],[1,1],[1,-1],[-1,-1]]){
    const c=new THREE.Group(),h=new THREE.Mesh(new THREE.PlaneGeometry(arm,thick),mat),v=new THREE.Mesh(new THREE.PlaneGeometry(thick,arm),mat);
    h.position.set(-sx*arm/2,0,0);v.position.set(0,-sy*arm/2,0);c.add(h,v);
    // A dark edge behind each arm.
    for(const [o,w,hh] of [[h,arm+.004,thick+.004],[v,thick+.004,arm+.004]]){const b=new THREE.Mesh(new THREE.PlaneGeometry(w,hh),shade);b.position.copy(o.position);b.position.z=-.001;b.userData.back=true;c.add(b);}c.userData.sign=[sx,sy];corners.push(c);g.add(c);
  }
  const chevron=new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(.012,0),new THREE.Vector2(-.006,.009),new THREE.Vector2(-.002,0),new THREE.Vector2(-.006,-.009)])),mat);
  const chevronBack=new THREE.Mesh(chevron.geometry,shade);chevronBack.scale.setScalar(1.45);chevronBack.position.z=-.001;chevronBack.userData.back=true;chevron.add(chevronBack);
  chevron.scale.setScalar(1.8);g.add(chevron);g.traverse(o=>o.renderOrder=o.userData.back?13:14);
  g.visible=false;vr.rig.add(g);return {g,mat,shade,corners,chevron,size:.1,shown:0};
}
function updateVRCues(dt){
  const show=!anyMoving()&&settings.hints&&!complete&&!practice.active&&!story.open&&!vcard.kind&&!maker?.editing&&!rewind;
  const groups=show?connectionGroups():{},seen=new Set();let used=0;
  for(const kind of ['ready','held','waiting','blocked'])for(const p of groups[kind]??[]){
    const seam=p.seam??p;
    for(const e of [seam.ea,seam.eb]){
      const a=new V3(...e.mid.map((v,i)=>v-e.half[i])),b=new V3(...e.mid.map((v,i)=>v+e.half[i])),len=a.distanceTo(b);
      const k=[a,b].map(v=>v.toArray().map(x=>x.toFixed(2)).join()).sort().join('|');if(len<1e-3||seen.has(k))continue;seen.add(k);
      const m=cueEdge(used++),r=kind==='ready'?.1:.07;
      m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(Y_UP,b.clone().sub(a).normalize());m.scale.set(r,len,r);
      m.material.color.setHex(CUE_COLORS[kind]);m.visible=true;
      m.material.opacity=reducedMotion()?.8:kind==='ready'?.75+.25*Math.sin(elapsed*5):kind==='waiting'?.45+.25*Math.sin(elapsed*2.5):kind==='held'?.65:.4;
    }
  }
  for(let i=used;i<cue.edges.length;i++)cue.edges[i].visible=false;
  const ready=(groups.ready??[]).length;if(ready&&!cue.ready)play('align');cue.ready=ready;
  updateFocus(show,dt);
}
function hideVRCues(){for(const m of cue.edges)m.visible=false;if(cue.focus)cue.focus.g.visible=false;cue.ready=0;vhint.group.visible=false;}
// ---------- VR hints ----------
// The Hint key on the shelf works like the Hint button on screen: press it again for more help, and
// once more to hide it. What the screen draws over the picture is drawn on the island: a soft pulse on
// the tiles to notice; the two edges to join (blue and gold, the gold one green once they meet); a pale
// box round a stone to hide or an orb to catch; and, at full help, a gold ring out in the air where
// your eyes should be for the photo, with dots leading out to it from the crossing. For a walk, a
// marker over the tile to touch and footprints along the way there.
const vhint={group:new THREE.Group(),pulses:[],edges:[],boxes:[],dots:[],prints:[],ghost:null,ring:null};
vhint.group.visible=false;scene.add(vhint.group);
const hintMat=color=>new THREE.MeshBasicMaterial({color,transparent:true,depthWrite:false,fog:false,toneMapped:false,side:THREE.DoubleSide});
const hintUnit={disc:new THREE.CircleGeometry(1,32),bar:new THREE.CylinderGeometry(1,1,1,8,1),dot:new THREE.SphereGeometry(1,10,8),ring:new THREE.TorusGeometry(1,.1,8,48),cone:new THREE.ConeGeometry(1,2.4,20)};
function hintPart(list,i,make){if(!list[i]){list[i]=make();vhint.group.add(list[i]);}const m=list[i];m.visible=true;return m;}
const hintBar=(m,a,b,r)=>{m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(Y_UP,b.clone().sub(a).normalize());m.scale.set(r,a.distanceTo(b),r);};
function hintBox(){
  // Twelve thin bars round a cube one block across.
  const g=new THREE.Group(),mat=hintMat(0xfff0fa);g.userData.mat=mat;
  for(const axis of [0,1,2])for(const u of [-.5,.5])for(const v of [-.5,.5]){
    const a=new V3(),b=new V3();a.setComponent(axis,-.5);b.setComponent(axis,.5);
    const [p,q]=[0,1,2].filter(k=>k!==axis);for(const o of [a,b]){o.setComponent(p,u);o.setComponent(q,v);}
    const m=new THREE.Mesh(hintUnit.bar,mat);hintBar(m,a,b,.025);m.renderOrder=6;g.add(m);
  }
  return g;
}
function updateVRHint(){
  const st=vr.on&&!story.open&&!vcard.kind&&!rewind?hintStep():null,used={pulses:0,edges:0,boxes:0,dots:0,prints:0};
  let ghost=false,ring=false;
  const fb=vr.on&&feedback&&elapsed<feedback.until&&!story.open?feedback:null;
  vhint.group.visible=!!st||!!fb;
  if(st){
    const tier=practice.active?3:hint.tier,pulse=reducedMotion()?.8:.5+Math.sin(elapsed*5)*.5,unit=scene.scale.x;
    const disc=(n,color,opacity)=>{const m=hintPart(vhint.pulses,used.pulses++,()=>{const d=new THREE.Mesh(hintUnit.disc,hintMat(0xffffff));d.renderOrder=6;return d;});
      const up=n.up??Y_UP;m.position.copy(top(n)).addScaledVector(up,.03);m.quaternion.setFromUnitVectors(new V3(0,0,1),up);m.scale.setScalar(.36+.06*pulse);m.material.color.setHex(color);m.material.opacity=opacity;};
    const box=(at,size,color,opacity)=>{const g=hintPart(vhint.boxes,used.boxes++,hintBox);g.position.copy(at);g.scale.setScalar(size);g.userData.mat.color.setHex(color);g.userData.mat.opacity=opacity;};
    if(tier===1){
      // Notice: a pulse on the tiles nearest what matters.
      const points=st.type==='frame'?(st.orbs?.length?st.orbs:st.hides?st.stones:st.edges.filter(e=>e.now).length?st.edges.filter(e=>e.now).flatMap(e=>[e.a[0],e.b[0]]):st.edges.flatMap(e=>[e.a[0],e.b[0]])):st.to?[st.to]:[];
      const seen=new Set();
      for(const p of points){const at=new V3(...p),n=nodes.reduce((a,b)=>top(a).distanceToSquared(at)<top(b).distanceToSquared(at)?a:b);if(seen.has(n))continue;seen.add(n);disc(n,0xffbf3a,.5+pulse*.35);}
    }else if(st.type==='frame'){
      const v=viewDir(camera);
      for(const e of st.edges){
        const met=edgeGap(e,v)<ALIGN,dim=e.now?1:.45;
        for(const [[mid,half],color] of [[e.a,0x7fe6ff],[e.b,met?0x8cffaa:0xffd36b]]){
          const m=hintPart(vhint.edges,used.edges++,()=>{const b=new THREE.Mesh(hintUnit.bar,hintMat(0xffffff));b.renderOrder=7;return b;});
          hintBar(m,new V3(...mid.map((x,i)=>x-half[i])),new V3(...mid.map((x,i)=>x+half[i])),e.now?.075:.05);m.material.color.setHex(color);m.material.opacity=(.75+pulse*.25)*dim;
        }
      }
      if(st.hides)for(const b of st.stones)box(new V3(...b),1.08,0xfff0fa,.6+pulse*.4);
      for(const orb of st.orbs??[])box(new V3(...orb),.7,0xffd36b,.7+pulse*.3);
      if(tier===3&&!wayRing(st).there){
        // Where your eyes go: out from the crossing along the photo's line, about as far as you are now.
        const look=hintLook(st),eye=scene.worldToLocal(vr.cam.position.clone()),dir=new V3(...st.dir).normalize();
        const D=Math.min(.8,Math.max(.35,eye.distanceTo(look)*unit))/unit,at=look.clone().addScaledVector(dir,D);
        // Faint as your head comes into it, so it never fills your eyes.
        const near=Math.min(1,Math.max(0,(eye.distanceTo(at)*unit-.05)/.1));
        const R=vhint.ring??=(()=>{const g=new THREE.Group(),m=new THREE.Mesh(hintUnit.ring,hintMat(0xffd36b)),c=new THREE.Mesh(hintUnit.ring,hintMat(0xffd36b));c.scale.setScalar(.35);m.renderOrder=c.renderOrder=8;g.add(m,c);vhint.group.add(g);return g;})();
        ring=true;R.visible=true;R.position.copy(at);R.quaternion.setFromUnitVectors(new V3(0,0,1),dir);R.scale.setScalar((.03+.004*pulse)/unit);
        R.children.forEach(m=>m.material.opacity=(.7+.3*pulse)*near);
        const n=9;
        for(let i=1;i<n;i++){
          const t=i/n,glow=.35+.65*Math.max(0,Math.cos((t*n-elapsed*3)%n/n*Math.PI*2));
          const m=hintPart(vhint.dots,used.dots++,()=>{const d=new THREE.Mesh(hintUnit.dot,hintMat(0xffd36b));d.renderOrder=8;return d;});m.material.color.setHex(0xffd36b);
          m.position.copy(look).lerp(at,t);m.scale.setScalar((.0035+.002*glow)/unit);m.material.opacity=(.5+.5*glow)*Math.min(1,near+.3);
        }
      }
    }else if(st.type!=='remove'){
      // A walk or a plate: footprints along the way at full help, and a marker over the tile.
      const path=tier===3?wayRoute(st.to):null,n=nodeOf(st.to);
      if(path)for(let i=0;i+1<path.length;i++){
        const a=top(path[i]),b=top(path[i+1]),up=path[i].up??Y_UP;
        for(const t of [.33,.66]){
          const k=(i+t)/path.length,glow=.3+.7*Math.max(0,Math.cos((k-elapsed*.6)%1*Math.PI*2));
          const m=hintPart(vhint.prints,used.prints++,()=>{const d=new THREE.Mesh(hintUnit.disc,hintMat(0x7fe6ff));d.renderOrder=6;return d;});
          m.position.copy(a).lerp(b,t).addScaledVector(up,.03);
          const along=b.clone().sub(a);along.addScaledVector(up,-along.dot(up));if(along.lengthSq()<1e-6)along.set(1,0,0);along.normalize();
          m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(along,up.clone().cross(along).multiplyScalar(-1),up));
          m.scale.set(.1+.03*glow,.06+.015*glow,1);m.material.opacity=.5+.5*glow;
        }
      }
      if(n){
        const G=vhint.ghost??=(()=>{const m=new THREE.Mesh(hintUnit.cone,hintMat(0xfffaf0));m.renderOrder=8;vhint.group.add(m);return m;})();
        const up=n.up??Y_UP,bob=reducedMotion()?0:Math.sin(elapsed*3)*.06;
        ghost=true;G.visible=true;G.position.copy(top(n)).addScaledVector(up,.5+bob);G.quaternion.setFromUnitVectors(Y_UP,up.clone().negate());G.scale.setScalar(.1);G.material.opacity=.75+.25*pulse;
        disc(n,0x7fe6ff,.3+pulse*.25);
      }
    }
  }
  if(fb){
    // A photo that did not join: its edges in rose (amber for a railing), the block in the way boxed,
    // and dots across the gap between edges still apart.
    const alpha=Math.min(1,(fb.until-elapsed)*1.5),unit=scene.scale.x;
    for(const [mid,half] of fb.edges){
      const m=hintPart(vhint.edges,used.edges++,()=>{const b=new THREE.Mesh(hintUnit.bar,hintMat(0xffffff));b.renderOrder=7;return b;});
      hintBar(m,new V3(...mid).sub(new V3(...half)),new V3(...mid).add(new V3(...half)),.07);m.material.color.setHex(fb.kind==='rail'?0xf6c37e:0xe9b6ae);m.material.opacity=alpha;
    }
    for(const p of fb.blocks){const g=hintPart(vhint.boxes,used.boxes++,hintBox);g.position.set(...p);g.scale.setScalar(1.04);g.userData.mat.color.setHex(0xf1b8a4);g.userData.mat.opacity=alpha*(.6+.3*Math.sin(elapsed*6));}
    if(fb.kind==='offset'&&fb.edges.length>1){
      const a=new V3(...fb.edges[0][0]),b=new V3(...fb.edges[1][0]);
      for(let i=1;i<8;i++){const m=hintPart(vhint.dots,used.dots++,()=>{const d=new THREE.Mesh(hintUnit.dot,hintMat(0xffd36b));d.renderOrder=8;return d;});m.position.copy(a).lerp(b,i/8);m.scale.setScalar(.003/unit);m.material.color.setHex(0xedc9bb);m.material.opacity=alpha;}
    }
  }
  for(const k of ['pulses','edges','boxes','dots','prints'])for(let i=used[k];i<vhint[k].length;i++)vhint[k][i].visible=false;
  if(vhint.ghost&&!ghost)vhint.ghost.visible=false;if(vhint.ring&&!ring)vhint.ring.visible=false;
}
// Which crossing your eyes are lining up. Two edges meet, from where you stand, when your eyes are on
// the line through their crossing, so the view is measured from that crossing rather than from the
// island's middle: at arm's length the two differ by many degrees. With no crossing near, the middle.
function vrViewPoint(eye){
  let best=null,previous=null;
  if(!anyMoving()&&!complete){
    const taken=linkedIds(),seen=new Set();
    for(const p of [...pairs.map(p=>({...p,world:cells})),...futures]){
      if(taken.has(p.id)||seen.has(p.id))continue;seen.add(p.id);
      const at=seamPoint(p),v=reachable(seamLine(p.seam).u),off=angleBetween(v,eye.clone().sub(at).normalize().toArray());
      if(off>cueNear()||!sightClear(p.seam,v,p.world))continue;
      const candidate={p,off,v,at};
      if(p.id===vr.view?.p?.id)previous=candidate;
      if(!best||off<best.off)best=candidate;
    }
    // Keep the selected crossing unless another is clearly closer. Never retain a missing seam.
    if(previous&&best&&previous.off<=best.off+.8)best=previous;
  }
  return best??{at:target.clone(),off:Infinity};
}
function updateFocus(show,dt){
  const F=cue.focus??=buildFocus();
  // Brackets only mark a crossing in the current world, never its future rotated position.
  // Follow the selected view instead of jumping to the first aligned seam in an array.
  let best=null;
  const selected=vr.view;
  if(show&&!anyMoving()&&selected?.p&&pairs.some(p=>p.seam===selected.p.seam)){
    best={...selected,off:aligned.some(p=>p.seam===selected.p.seam)?0:selected.off};
  }
  if(!best){F.g.visible=false;F.shown=0;F.target=null;return;}
  if(F.target!==best.p.seam){F.shown=0;F.target=best.p.seam;}
  const want=best?1-Math.max(0,best.off-VR_SNAP_DEG)/(cueNear()-VR_SNAP_DEG):0;
  F.shown+=((best?.35+.65*want:0)-F.shown)*Math.min(1,dt*6);
  F.g.visible=F.shown>.02;if(!F.g.visible||!best)return;
  const at=scene.localToWorld(seamPoint(best.p)),head=vr.cam.position,lined=best.off===0;
  // Brackets close in from wide to snug as the line-up nears, and pulse gently once it is there.
  const size=lined?.02+.003*Math.sin(elapsed*5):Math.min(.065,.022+.0025*best.off);F.size+=(size-F.size)*Math.min(1,dt*8);
  F.g.position.copy(at);F.g.lookAt(head);F.g.updateMatrixWorld(true);
  for(const c of F.corners){const [sx,sy]=c.userData.sign;c.position.set(sx*F.size,sy*F.size,0);}
  F.mat.color.setHex(lined?0xffd36b:0xfff6e0);F.mat.opacity=Math.min(1,F.shown)*(lined?1:.9);F.shade.opacity=Math.min(1,F.shown)*.45;
  // The arrow: which way to move your head, as seen from where you are.
  F.chevron.visible=!lined&&best.off>VR_SNAP_DEG*.6;
  if(F.chevron.visible){
    const head=scene.worldToLocal(vr.cam.position.clone()).sub(seamPoint(best.p)).normalize(),move=new V3(...best.v).sub(head);
    const world=move.transformDirection(scene.matrixWorld),inv=F.g.quaternion.clone().invert(),local=world.applyQuaternion(inv);
    const angle=Math.atan2(local.y,local.x),r=F.size*1.35+.006*Math.sin(elapsed*4);
    F.chevron.position.set(Math.cos(angle)*r,Math.sin(angle)*r,0);F.chevron.rotation.set(0,0,angle);
  }
}
// ---------- VR pointing and grabbing ----------
// Pointing: each hand (and controller) has a soft beam, the headset's own pointing ray. The tile it
// is on gets a ring, and a dotted trail shows the way the traveller would walk; a beam just off a
// reachable tile snaps to it. Pinch to walk there or press the button under the beam.
const ASSIST=3.5*DEG;
// Touching: at the island, the tile under your index fingertip lights up (with the way there), and a
// tap on it walks the traveller there, as a tap does on screen: the fingertip coming down onto its top,
// or pushing into its block from the side. Sliding from one top to the next does not count; the finger
// has to lift off first. The beam steps aside while a tile is under your finger.
const TOUCH_HOVER=.07,TOUCH_DOWN=.015,TOUCH_LIFT=.024;
function touchTile(h,prev){
  const tip=h.hand.joints['index-finger-tip'];
  if(maker?.editing||!tip?.visible||tip.position.distanceTo(vr.anchor.pos)>vr.anchor.size*1.3+.06){h.touchIn=false;return null;}
  const p=scene.worldToLocal(tip.position.clone()),unit=scene.scale.x;let best=null;
  // The top nearest the fingertip in its column: above it, on it, or inside the block under it.
  for(const n of nodes){
    if(Math.abs(p.x-n.x)>.56||Math.abs(p.z-n.z)>.56)continue;
    const above=(p.y-top(n).y)*unit;
    if(above<-.9*unit||above>TOUCH_HOVER)continue;
    if(!best||Math.abs(above)<Math.abs(best.above))best={n,above};
  }
  if(!best)return null;
  const target={node:best.n,point:scene.localToWorld(top(best.n)),reach:!!prev?.has(best.n),touch:true,height:best.above};
  if(best.above>TOUCH_LIFT)h.touchIn=false;
  else if(!h.touchIn&&best.above<TOUCH_DOWN){
    h.touchIn=true;h.used=true;
    if(sendWalker(best.n)){play('place');sparkle(top(best.n),{count:10,spread:.3,color:0xffe7a8,life:.7});}
  }
  return {target};
}
const pointer={trail:[],trailMaterial:null,beamMaterial:null};
function setVRRay(origin,dir){
  // World-space rays don't set a camera automatically. Decorative sprites need it
  // even though only tile meshes are selected; desktop picking may also replace it.
  raycaster.camera=vr.cam;
  raycaster.set(origin,dir);
}
function rayTarget(origin,dir,prev){
  setVRRay(origin,dir);
  try{
    const b=raycaster.intersectObjects(liveButtons(),false)[0];if(b)return {button:b.object,point:b.point};
    if(maker?.editing){const m=maker.pickRay(raycaster.ray);return m?{maker:m,ray:raycaster.ray.clone()}:{ray:raycaster.ray.clone()};}
    const hit=raycaster.intersectObject(blockGroup,true).find(h=>h.object.isMesh&&keyOfHit(h)),direct=hit&&nodeAt.get(keyOfHit(hit));
    if(direct&&prev?.has(direct))return {node:direct,point:hit.point,reach:true};
    let best=null,bestAngle=ASSIST;
    if(prev)for(const n of prev.keys()){
      if(n===walker.node)continue;
      const t=scene.localToWorld(top(n)),angle=t.clone().sub(origin).angleTo(dir);
      if(angle<bestAngle){bestAngle=angle;best={node:n,point:t,reach:true};}
    }
    if(best)return best;
    if(direct)return {node:direct,point:hit.point,reach:false};
    return null;
  }finally{raycaster.far=Infinity;}
}
function beamOf(h){
  if(!h.beam){
    pointer.beamMaterial??=new THREE.MeshBasicMaterial({color:0xfff6e0,transparent:true,opacity:.35,depthWrite:false,fog:false,toneMapped:false});
    h.beam=new THREE.Mesh(new THREE.CylinderGeometry(1,1,1,6,1,true),pointer.beamMaterial.clone());h.beam.renderOrder=15;
    h.cursor=new THREE.Mesh(new THREE.SphereGeometry(.006,12,8),h.beam.material);h.cursor.renderOrder=15;vr.rig.add(h.beam,h.cursor);
  }
  return h.beam;
}
function trailDot(i){
  if(!pointer.trail[i]){
    pointer.trailMaterial??=new THREE.MeshBasicMaterial({color:0xffe2a0,transparent:true,depthWrite:false,fog:false,toneMapped:false});
    const m=new THREE.Mesh(new THREE.SphereGeometry(.09,12,8),pointer.trailMaterial.clone());m.renderOrder=6;scene.add(m);pointer.trail[i]=m;
  }
  return pointer.trail[i];
}
function updatePointers(inputs){
  const prev=story.open||complete||anyMoving()||rewind?null:routes();
  let lead=null;
  for(const h of inputs){
    const free=h.side&&!vr.framing&&!h.grip&&!h.grabbing&&!(!h.controller&&h.side==='left'&&(vr.hold.state==='held'||vr.hold.charge>HOLD_SHOW))&&!h.nearShelf&&!(vr.hold.spin&&!h.controller&&h.side==='right');
    // A hand at the island touches; elsewhere it points.
    const touch=free&&!h.controller&&!story.open&&!h.pinched?touchTile(h,prev):null;
    const origin=free&&!touch?(h.controller?h.origin:h.hasRay?h.rayOrigin:null):null,dir=h.controller?h.direction:h.rayDir;
    // A hand without a beam falls back to aiming past the fingertips.
    h.target=touch?touch.target:origin?rayTarget(origin,dir,prev):free&&!h.controller&&h.point&&h.gap<.08?vrPick(h.point,h):null;
    if(h.target?.node&&h.target.reach===undefined)h.target.reach=!!prev?.has(h.target.node);
    // With nothing under it the beam stays short and faint, just enough to show where the hand points.
    const beam=origin?beamOf(h):h.beam,end=h.target?.point??(origin&&origin.clone().addScaledVector(dir,.3));
    if(beam){
      beam.visible=!!origin;h.cursor.visible=!!(origin&&h.target?.point);
      if(beam.visible){
        const length=origin.distanceTo(end);beam.position.copy(origin).lerp(end,.5);beam.quaternion.setFromUnitVectors(Y_UP,end.clone().sub(origin).normalize());
        beam.scale.set(.0012,length,.0012);h.cursor.position.copy(end);
        beam.material.color.setHex(h.target?.reach||h.target?.button?0xffe7a8:0xfff6e0);beam.material.opacity=h.target?.point?(h.pinched?.75:.35):.12;
      }
    }
    if(h.target&&(h.target.node||h.target.button||h.target.maker)&&(!lead||h.target.touch&&!lead.target.touch||h.pinched&&!lead.pinched||!lead.pinched&&h.side==='right'&&lead.side!=='right'))lead=h;
  }
  const t=lead?.target;
  if(maker?.editing)maker.hoverRay(t?.maker?t.ray:null);
  // The ring on the tile: gold if the traveller can get there, muted if not yet.
  vr.hover.visible=!!t?.node;
  if(t?.node){vr.hover.position.copy(top(t.node)).add(new V3(0,.03,0));vr.hover.material.color.setHex(t.reach?0xffd36b:0x9f97b4);vr.hover.scale.setScalar(t.reach?1.15+.08*Math.sin(elapsed*6):1);}
  // The way there, as a row of dots that brighten in turn toward the tile.
  let used=0;
  if(t?.node&&t.reach&&prev&&t.node!==walker.node){
    const path=[];for(let c=t.node;c&&c!==walker.node;c=prev.get(c)?.n)path.unshift(c);path.unshift(walker.node);
    for(let i=1;i<path.length;i++){
      const a=top(path[i-1]),b=top(path[i]),near=a.distanceTo(b)<1.6;
      for(const k of near?[.33,.66,1]:[1]){
        const m=trailDot(used++);m.position.copy(a).lerp(b,k).add(new V3(0,.06,0));m.visible=true;
        m.material.opacity=.45+.4*Math.max(0,Math.sin(elapsed*5-used*.6));
      }
    }
  }
  for(let i=used;i<pointer.trail.length;i++)pointer.trail[i].visible=false;
  for(const b of vr.buttons)b.userData.setHover?.(b===t?.button||b===menu.poke);
}
// Grabbing: close a hand near the island (or squeeze a controller's grip) and the island is in your
// grip: it moves and turns with your hand, tilting too. Grab with both hands to make it bigger or
// smaller and swing it round. Open the hand and it stays where it is.
const grab={key:'',base:null};
function gripOf(h){
  const j=h.hand.joints,need=['wrist','middle-finger-phalanx-proximal','index-finger-tip','middle-finger-tip','ring-finger-tip'];
  if(need.some(n=>!j[n]?.visible))return null;
  const w=j.wrist.position,k=j['middle-finger-phalanx-proximal'].position,reach=w.distanceTo(k)||1;
  // How open the hand is: the index on its own, or the middle and ring together, whichever is more
  // open. So a fist is every finger curled, and a pointing hand (index out, the rest curled) is not one.
  const d=n=>j[n].position.distanceTo(w),open=Math.max(d('index-finger-tip'),(d('middle-finger-tip')+d('ring-finger-tip'))/2)/reach;
  return {center:w.clone().lerp(k,.6),quat:j.wrist.quaternion.clone(),open};
}
const inGrabReach=p=>p.distanceTo(vr.anchor.pos)<vr.anchor.size*1.15+.1;
function gripPose(h){
  if(h.controller)return {p:h.controller.getWorldPosition(new V3()),q:h.controller.getWorldQuaternion(new THREE.Quaternion())};
  if(h.side==='right')return {p:h.point.clone(),q:h.shape?.quat.clone()??new THREE.Quaternion()};
  return {p:h.shape.center.clone(),q:h.shape.quat.clone()};
}
function updateGrab(){
  const allowed=!story.open&&!maker?.editing&&vr.hold.state!=='held'&&!vr.framing;
  // The left hand grabs, with a fist; the right hand is for pointing and touching, so a loosely curled
  // right hand never takes the island by mistake. While the left fist holds it, a right-hand pinch
  // beside it pulls it bigger or pushes it smaller.
  const left=vr.hands.find(h=>h.side==='left');
  for(const h of vr.hands){
    if(!allowed||!h.side||!h.shape)h.grabbing=false;
    else if(h.side==='left'){
      if(h.grabbing){if(!h.grip)h.grabbing=false;}
      // A grab starts as the hand closes near the island, not when a closed hand wanders close.
      else if(h.grip&&!h.gripWas&&!h.gripBlocked&&inGrabReach(h.shape.center))h.grabbing=true;
    }else if(h.grabbing){if(!h.pinched||!left?.grabbing)h.grabbing=false;}
    else if(left?.grabbing&&h.pinched&&!h.was&&h.point&&inGrabReach(h.point)){h.grabbing=true;h.used=true;}
    h.gripWas=h.grip;if(h.gripBlocked&&!h.grip)h.gripBlocked=false;
    // The left hand warms when it could grab; a hand turns gold while it holds the island.
    h.model?.setColor(h.grabbing?0xffd36b:allowed&&h.side==='left'&&h.shape&&!h.grip&&inGrabReach(h.shape.center)?0xffe7bd:0xf4ece0);
  }
  for(const c of vr.controllers)if(!allowed||!c.side)c.grabbing=false;
  const holding=[...vr.hands,...vr.controllers].filter(h=>h.grabbing),key=holding.map(h=>h.id).join('|');
  if(key!==grab.key){
    // Whenever the hands holding it change, start again from where the island is now.
    if(holding.length&&!grab.key)play('place');
    grab.key=key;const a=vr.anchor,g=vr.goal;
    grab.base=holding.length?{poses:holding.map(gripPose),pos:a.pos.clone(),quat:a.quat.clone(),size:a.size}:null;
    if(holding.length){g.pos.copy(a.pos);g.quat.copy(a.quat);g.size=a.size;}
  }
  if(!holding.length)return;
  const B=grab.base,now=holding.map(gripPose),g=vr.goal;
  if(holding.length===1){
    const turn=now[0].q.clone().multiply(B.poses[0].q.clone().invert());
    g.quat.copy(turn).multiply(B.quat);g.pos.copy(B.pos).sub(B.poses[0].p).applyQuaternion(turn).add(now[0].p);g.size=B.size;
  }else{
    const v0=B.poses[1].p.clone().sub(B.poses[0].p),v=now[1].p.clone().sub(now[0].p);
    const m0=B.poses[0].p.clone().lerp(B.poses[1].p,.5),m=now[0].p.clone().lerp(now[1].p,.5);
    const k=THREE.MathUtils.clamp(v.length()/Math.max(v0.length(),.05),.12/B.size,.6/B.size);
    const swing=new THREE.Quaternion().setFromAxisAngle(Y_UP,Math.atan2(v.x,v.z)-Math.atan2(v0.x,v0.z));
    g.quat.copy(swing).multiply(B.quat);// Scale about the island center. Only midpoint translation moves the island and its UI.
    g.pos.copy(B.pos).sub(m0).applyQuaternion(swing).add(m);g.size=B.size*k;
  }
}
// Hands point along the line past the fingertips; controllers use their tracked target ray.
function vrPick(p,input){
  const head=vr.cam.position,dir=input?.controller?input.direction:p.clone().sub(head).normalize();setVRRay(input?.controller?input.origin:head,dir);
  const b=raycaster.intersectObjects(liveButtons(),false)[0];if(b)return {button:b.object};
  if(maker?.editing)return {maker:maker.pickRay(raycaster.ray)};
  if(input?.controller){const hit=raycaster.intersectObject(blockGroup,true).find(h=>h.object.isMesh&&keyOfHit(h));return {node:hit?nodeAt.get(keyOfHit(hit)):null};}
  const q=vrScreen(p);return {node:q.z<1?flatPick(q):null};
}
// The flat camera's picking works in the island's own space, so the island leaves the room for a moment.
function flatPick(q){
  const pos=scene.position.clone(),rot=scene.quaternion.clone(),sc=scene.scale.clone();
  scene.position.set(0,0,0);scene.quaternion.identity();scene.scale.setScalar(1);scene.updateMatrixWorld(true);
  try{return nodeAtScreen(q.x,q.y);}
  finally{scene.position.copy(pos);scene.quaternion.copy(rot);scene.scale.copy(sc);scene.updateMatrixWorld(true);}
}
// A hand the headset cannot see is not trusted: out of view its joints can keep an old pose (a fist, an
// open palm) that is not what your hand is doing. It counts again as soon as it is back in view.
const HAND_VIEW=Math.cos(60*DEG);
function updateVRHands(dt=0){
  const inputs=[...vr.hands,...vr.controllers];
  // Sample both sources before deciding whether a two-hand frame is being made.
  for(const h of inputs){
    h.was=h.pinched;
    if(h.controller){
      if(!h.side||!h.controller.visible){h.point=null;h.pinched=false;h.rayLine.visible=false;continue;}
      h.controller.updateWorldMatrix(true,false);h.controller.getWorldPosition(h.origin);h.direction.set(0,0,-1).transformDirection(h.controller.matrixWorld);
      h.point=h.origin.clone().addScaledVector(h.direction,.08);h.pinched=h.down&&!h.grabbing;h.gap=h.down?0:.04;h.rayLine.visible=false;
    }else{
      const j=h.hand.joints,a=j['thumb-tip'],b=j['index-finger-tip'];
      // The hand itself: smooth and solid, its pinching fingertips warming to gold as they meet.
      if(h.side&&h.model?.side!==h.side){h.model?.group.removeFromParent();h.model=Object.assign(createHandModel(THREE,{side:h.side}),{side:h.side});vr.rig.add(h.model.group);}
      // With the real room showing, your real hands show too; otherwise the hand is drawn.
      h.model?.setCutout(!!(vr.ar&&settings.vrRoom));
      const w=j['middle-finger-phalanx-proximal'];
      if(h.side&&w?.visible){const to=w.position.clone().sub(vr.cam.position).normalize(),fwd=new V3(0,0,-1).applyQuaternion(vr.cam.quaternion);h.unseen=to.dot(fwd)>HAND_VIEW?0:(h.unseen??0)+dt;}
      else h.unseen=0;
      h.trusted=!h.side||h.unseen<.25;
      if(!h.trusted){h.model?.hide();h.hasRay=false;h.shape=null;h.grip=false;h.point=null;h.pinched=false;continue;}
      if(!h.side)h.model?.hide();
      else{const gap=a?.visible&&b?.visible?a.position.distanceTo(b.position):1;h.model.update(j,{tipMix:h.pinched?1:Math.min(1,Math.max(0,(.065-gap)/.045))});}
      // The hand's pointing beam is the headset's own (the controller of the same input source).
      const c=vr.controllers[h.index];h.hasRay=!!(h.side&&c?.isHand&&c.controller.visible);
      if(h.hasRay){c.controller.updateWorldMatrix(true,false);c.controller.getWorldPosition(h.rayOrigin??=new V3());(h.rayDir??=new V3()).set(0,0,-1).transformDirection(c.controller.matrixWorld);}
      // A closed hand grips; it opens again past a wider threshold, so the grip does not flicker.
      h.shape=h.side?gripOf(h):null;h.grip=!!h.shape&&(h.grip?h.shape.open<1.4:h.shape.open<1.2);
      if(!h.side||!a?.visible||!b?.visible){h.point=null;h.pinched=false;continue;}
      h.gap=a.position.distanceTo(b.position);h.point=a.position.clone().add(b.position).multiplyScalar(.5);h.pinched=!h.grip&&(h.was?h.gap<PINCH_OFF:h.gap<PINCH_ON);
    }
  }
  // The hand holding the island (or just letting it go) does not pinch.
  for(const h of vr.hands)if(h.side==='left'&&(vr.hold.state==='held'||vr.hold.mute)){h.pinched=false;h.was=false;}
  if(story.open){
    // Reading needs no pointing target. A relaxed pinch advances; holding skips.
    vr.framing=null;vr.quad.visible=vr.outline.visible=vr.hover.visible=false;if(vr.frameLabel)vr.frameLabel.visible=false;
    let advance=false,skip=false;
    for(const h of inputs){
      if(!h.side||!h.point)continue;
      if(h.pinched&&!h.was){h.storyPinch=true;h.startAt=elapsed;h.used=true;}
      if(h.storyPinch&&h.pinched&&elapsed-h.startAt>1.2)skip=true;
      if(h.storyPinch&&!h.pinched&&h.was)advance=true;
    }
    if(skip||advance){
      for(const h of inputs){h.storyPinch=false;h.used=true;}
      if(skip)story.finish();else story.advance();
    }
    return;
  }
  const both=!maker?.editing&&inputs.filter(h=>h.side&&h.point&&h.pinched).length===2;
  for(const h of inputs){
    if(!h.side||!h.point)continue;
    if(h.pinched&&!h.was){h.start=h.point.clone();h.startAt=elapsed;h.dragged=false;h.used=false;h.pinchTarget=h.target??null;}
    else if(!h.pinched&&h.was){
      if(vr.framing&&!h.used)takeVRPhoto();
      else if(!h.used&&!h.dragged&&(maker?.editing||h.controller||elapsed-h.startAt<.8)){
        const t=h.pinchTarget??(h.hasRay||h.controller?{}:vrPick(h.point,h));if(t.button){t.button.userData.act();play('place');}else if(t.maker)maker.activate(t.maker);else if(t.node&&!t.touch)sendWalker(t.node);
      }
    }
  }
  // Both hands pinching: the frame. Its corners, as seen from your head: the two pinch points and the
  // two corners between them, along your view's right and up.
  const [p,q]=inputs.filter(h=>h.side&&h.pinched).map(h=>h.point);
  if(both&&p&&q){
    const right=new V3(1,0,0).applyQuaternion(vr.cam.quaternion),up=new V3(0,1,0).applyQuaternion(vr.cam.quaternion),d=q.clone().sub(p);
    const corners=[p,p.clone().addScaledVector(right,d.dot(right)),q,p.clone().addScaledVector(up,d.dot(up))];
    vr.framing={corners,poly:corners.map(vrScreen)};
    renderFlat(vr.rt);
    const pos=vr.quad.geometry.attributes.position,uv=vr.quad.geometry.attributes.uv;
    [0,1,2,0,2,3].forEach((k,i)=>{pos.setXYZ(i,...corners[k].toArray());const s=vr.framing.poly[k];uv.setXY(i,s.x/W,1-s.y/H);});
    pos.needsUpdate=uv.needsUpdate=true;vr.quad.geometry.computeBoundingSphere();
    vr.outline.geometry.setFromPoints(corners);vr.quad.visible=vr.outline.visible=true;
    // Under the frame, as on screen: what the photo would do, and what it would replace.
    const words=framingWords(vr.framing.poly),L=vr.frameLabel??=(()=>{
      const tex=textTexture(768,236,(g,w,h)=>drawFrameLabel(g,w,h,vr.frameWords??{}));
      const m=new THREE.Mesh(new THREE.PlaneGeometry(.17,.17*236/768),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));m.renderOrder=40;vr.rig.add(m);return m;})();
    const key=words.label+'|'+words.extra+'|'+words.ready;if(key!==vr.frameWordsKey){vr.frameWordsKey=key;vr.frameWords=words;L.material.map.userData.draw();}
    const mid=corners.reduce((a,c)=>a.add(c),new V3()).multiplyScalar(.25),low=Math.min(...corners.map(c=>c.clone().sub(mid).dot(up)));
    L.position.copy(mid).addScaledVector(up,low-.035);L.quaternion.copy(vr.cam.quaternion);L.visible=true;
  }else{
    vr.quad.visible=vr.outline.visible=false;if(vr.frameLabel)vr.frameLabel.visible=false;
    if(inputs.every(h=>!h.pinched))vr.framing=null;
  }
  updatePointers(inputs);
}
function takeVRPhoto(){
  const f=vr.framing;vr.framing=null;for(const h of [...vr.hands,...vr.controllers])if(h.pinched||h.side)h.used=true;
  vr.quad.visible=vr.outline.visible=false;if(vr.frameLabel)vr.frameLabel.visible=false;
  if(!f||f.corners[0].distanceTo(f.corners[2])<.05)return;
  addFrame(f.poly);
}
function vrFrame(dt){
  if(scene.fog){vr.fog=scene.fog;scene.fog=null;}
  updateHold(dt);placeIsland();
  // The viewfinder looks from your head toward the island, then eases onto a nearby line-up.
  const eye=scene.worldToLocal(vr.cam.position.clone());vr.view=vrViewPoint(eye);const d=eye.clone().sub(vr.view.at);
  if(d.lengthSq()>1e-6){d.normalize();yawT=yaw+wrapAngle(Math.atan2(d.x,d.z)-yaw);pitchT=Math.max(MIN_PITCH*DEG,Math.min(MAX_PITCH*DEG,Math.asin(d.y)));if(!maker?.editing)snapToAlignment();snapCamera();}
  // While the traveller crosses a join, swing the island so the photo's view points straight at your
  // eyes: the photo's side, at the photo's height, however the island has been held or tilted since.
  if(vr.align!=null){
    if(walker.state==='walking'&&walker.next?.link){
      if(!grab.key&&vr.hold.state!=='held'){
        scene.updateMatrixWorld(true);
        const T=scene.localToWorld((vr.alignAt??target).clone()),eyes=vr.cam.position.clone().sub(T).normalize(),v=vr.align;
        const want=new V3(Math.sin(v.yaw)*Math.cos(v.pitch),Math.sin(v.pitch),Math.cos(v.yaw)*Math.cos(v.pitch)).transformDirection(scene.matrixWorld);
        const step=new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(want,eyes),Math.min(1,dt*4));
        for(const p of [vr.anchor,vr.goal]){p.quat.premultiply(step);p.pos.sub(T).applyQuaternion(step).add(T);}
        placeIsland();scene.updateMatrixWorld(true);
      }
    }else if(walker.state!=='walking')vr.align=null;
  }
  syncVRButtons();updateVRHands(dt);updateGrab();updateShelf(dt);updateCard(dt);updatePoke();
  if(vr.skyFor!==palette){vr.skyFor=palette;vr.sky.material.map?.dispose();vr.sky.material.map=textTexture(16,256,(g,w,h)=>{const s=g.createLinearGradient(0,0,0,h);s.addColorStop(0,palette.sky[0]);s.addColorStop(.5,palette.sky[1]);s.addColorStop(1,palette.sky[2]);g.fillStyle=s;g.fillRect(0,0,w,h);});vr.sky.material.needsUpdate=true;}
  vr.sky.visible=!(vr.ar&&settings.vrRoom);
  // The panel and buttons face you from the island's near side.
  const at=vr.anchor.pos,toward=vr.cam.position.clone().sub(at).setY(0);const a=Math.atan2(toward.x,toward.z),k=vr.anchor.size/ISLAND;
  // Gameplay UI keeps both its size and offset during resizing; moving it in depth would
  // change its apparent size. The level maker tools retain their workspace scaling.
  const fixed=!vr.buttonsKey?.startsWith('maker');
  vr.dock.visible=vr.hold.state!=='held';vr.dock.scale.setScalar(fixed?1:k);
  vr.dock.position.copy(at).add(new V3(Math.sin(a)*.05*(fixed?1:k),0,Math.cos(a)*.05*(fixed?1:k)));vr.dock.rotation.set(0,a,0);vr.panel.position.set(0,ISLAND+.12,-.05);
  const entry=story.current();
  if(entry){
    vr.panel.position.y=ISLAND+.22;vr.panel.scale.set(1.4,2.39,1);vr.panel.material.map=vr.storyTexture;
    const key=entry.scene.level+'|'+entry.index;
    if(key!==vr.storyKey){vr.storyKey=key;vr.storyChangedAt=elapsed;vr.storyTexture.userData.draw();}
    vr.panel.material.opacity=.4+.6*smooth((elapsed-vr.storyChangedAt)/.45);
  }else{vr.panel.scale.setScalar(maker?.editing?1.35:1);vr.panel.material.map=vr.infoTexture;vr.panel.material.opacity=1;vr.storyKey=null;}
  const guideText=entry?null:vr.guide.update();
  if(guideText&&guideText!==vr.panelText){vr.panelChangedAt=elapsed;}
  if(!entry)vr.panel.material.opacity=vr.guide.active?.35+.65*smooth((elapsed-(vr.panelChangedAt??0))/.5):1;
  const replace=frames.findIndex(canDrop),text=guideText??maker?.vrPanel()??`${levelTitle(level)}\n${hudStatus||(complete?'':level.hint)}\nPhotos ${frames.length}/${level.frames}`;
  if(text!==vr.panelText){vr.panelText=text;vr.infoTexture.userData.draw();}
  vr.panel.visible=!vcard.kind;
  // The first level is the intro: in the headset the guide starts by itself each time it opens there
  // or you enter VR there (not on a restart; Skip guide ends it). Anywhere else, How to play replays it.
  if(levelIndex!==LEVEL_ORDER[0]||extraIndex!==null||maker?.active)vr.guideShown=false;
  else if(!vr.guideShown&&!entry&&!vcard.kind&&!complete&&mode!=='intro'){vr.guideShown=true;if(!vr.guide.active)vr.guide.start();}
}
async function enterVR(){
  if(vr.on||vr.starting||!navigator.xr)return false;
  vr.starting=true;$('start-vr').disabled=true;$('vr-enter').disabled=true;
  let session,failure;
  try{
    for(const m of vr.canAR?['immersive-ar','immersive-vr']:['immersive-vr']){
      try{session=await navigator.xr.requestSession(m,{optionalFeatures:['local-floor','hand-tracking']});vr.ar=m==='immersive-ar';break;}catch(e){failure=e;}
    }
    if(!session){flash('VR did not start: '+failure?.message,5000);return false;}
    // Commit to play only after the headset accepts the session. Never carry the title demo into VR.
    if(mode==='intro')begin('mouse');
    if(!vr.sky)buildVR();
    closeCard();hideVRCues();vr.view=null;vr.align=null;vr.alignAt=null;vr.framing=null;
    grab.key='';grab.base=null;menu.shown=0;menu.poke=null;vr.turn=0;
    vr.anchor.pos.copy(TABLE);vr.anchor.quat.identity();vr.anchor.size=ISLAND;
    vr.goal.pos.copy(TABLE);vr.goal.quat.identity();vr.goal.size=ISLAND;
    Object.assign(vr.hold,{state:'idle',charge:0,lost:0,closing:0,last:null,speed:0,mute:false,spin:null});
    for(const h of [...vr.hands,...vr.controllers]){h.grabbing=false;h.pinched=false;h.was=false;h.used=false;h.pokeArmed=null;h.gripWas=false;}
    renderer.xr.setReferenceSpaceType('local-floor');await renderer.xr.setSession(session);
    vr.on=true;vr.rig.visible=true;placeIsland();document.body.classList.add('in-vr');
    session.addEventListener('end',()=>{
      vr.guide.stop();vr.guideShown=false;hideVRCues();closeCard();
      vr.on=false;vr.rig.visible=false;vr.hover.visible=false;vr.framing=null;vr.align=null;vr.view=null;
      grab.key='';grab.base=null;
      scene.position.set(0,0,0);scene.rotation.set(0,0,0);scene.scale.setScalar(1);scene.updateMatrixWorld(true);
      if(vr.fog&&!scene.fog)scene.fog=vr.fog;vr.fog=null;document.body.classList.remove('in-vr');resize();
    });
    return true;
  }catch(error){
    if(session)await session.end().catch(()=>{});
    flash('VR did not start: '+error.message,5000);return false;
  }finally{
    vr.starting=false;window.frameshiftXR?.apply();
  }
}
// The lightweight entry script has already started headset discovery.
const xrEntry=window.frameshiftXR;
if(xrEntry){xrEntry.room.then(ok=>{vr.canAR=ok;});xrEntry.ready=true;xrEntry.apply();}
$('start-vr').addEventListener('click',enterVR);
$('vr-enter').addEventListener('click',()=>{closeMenu();enterVR();});

// ---------- Settings ----------
function persistSettings(){
  try{localStorage.setItem('frameshift-illusion',JSON.stringify(settings));localStorage.setItem('frameshift-settings',JSON.stringify({...JSON.parse(localStorage.getItem('frameshift-settings')||'{}'),twoL:settings.twoL,skeleton:settings.skeleton,debug:settings.debug}));}
  catch{$('backup-status').textContent='Preferences apply for this session. Browser storage is unavailable.';}
}
function applyComfort(){
  document.body.classList.toggle('reduced-motion',reducedMotion());document.body.classList.toggle('full-motion',settings.motion==='full');document.body.classList.toggle('low-detail',settings.quality==='low');
  renderer.setPixelRatio(Math.min(devicePixelRatio,settings.quality==='low'?1:2));renderer.shadowMap.enabled=settings.quality!=='low';
  scene.traverse(o=>{if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.needsUpdate=true;});
  setAudioLevels({music:settings.musicVolume,effects:settings.effectsVolume});
  for(const [key,id] of [['musicVolume','music-volume'],['effectsVolume','effects-volume'],['sensitivity','sensitivity']]){
    $('opt-'+id).value=Math.round(settings[key]*100);$(id+'-value').value=key==='sensitivity'?settings[key].toFixed(1)+'\u00d7':Math.round(settings[key]*100)+'%';paintRange($('opt-'+id));
  }
  $('opt-motion').value=settings.motion;$('opt-quality').value=settings.quality;
}
for(const [name,id] of [['twoL','opt-l'],['skeleton','opt-skeleton'],['debug','opt-debug'],['hints','opt-hints'],['follow','opt-follow'],['music','opt-music']]){
  const input=$(id);input.checked=settings[name];
  input.addEventListener('change',()=>{settings[name]=input.checked;$('debug').hidden=!settings.debug;if(name==='music')setMusic(settings.music&&mode!=='intro',PALETTES.indexOf(palette));persistSettings();});
}
for(const [key,id] of [['musicVolume','music-volume'],['effectsVolume','effects-volume'],['sensitivity','sensitivity']]){
  $('opt-'+id).addEventListener('input',()=>{settings[key]=Number($('opt-'+id).value)/100;setAudioLevels({music:settings.musicVolume,effects:settings.effectsVolume});$(id+'-value').value=key==='sensitivity'?settings[key].toFixed(1)+'\u00d7':Math.round(settings[key]*100)+'%';paintRange($('opt-'+id));persistSettings();});
}
function paintRange(input){input.style.setProperty('--range-progress',`${100*(Number(input.value)-Number(input.min))/(Number(input.max)-Number(input.min))}%`);}
for(const key of ['motion','quality'])$('opt-'+key).addEventListener('change',()=>{settings[key]=$('opt-'+key).value;applyComfort();resize();persistSettings();});
motionPreference.addEventListener('change',applyComfort);
applyComfort();$('debug').hidden=!settings.debug;
$('menu-close').addEventListener('click',closeMenu);
$('title-settings').addEventListener('click',()=>toggleMenu());
$('backup-export').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify(makeProgressBackup(progress,settings,lessonSeen,LEVELS))],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='frameshift-progress-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  $('backup-status').textContent='Backup downloaded. Keep it somewhere safe.';
});
$('backup-import').addEventListener('click',()=>$('backup-file').click());
$('backup-file').addEventListener('change',async()=>{
  const file=$('backup-file').files[0];if(!file)return;
  try{
    if(file.size>24*1024*1024)throw Error('Choose a Seamline backup smaller than 24 MB.');
    const incoming=readProgressBackup(await file.text(),LEVELS),done={...progress.done};
    for(const [name,value] of Object.entries(incoming.done))if(!done[name]||done[name]===1)done[name]=value;
    const next={...progress,done,at:incoming.at},preferences={...settings,...incoming.preferences},lessons=new Set([...lessonSeen,...incoming.lessons]);
    writeBackupStorage(localStorage,[['frameshift-progress',next],['frameshift-illusion',preferences],['frameshift-lessons-v2',[...lessons]]]);
    Object.assign(progress,next);Object.assign(settings,preferences);for(const name of lessons)lessonSeen.add(name);
    for(const [key,id] of [['hints','opt-hints'],['follow','opt-follow'],['music','opt-music']])$(id).checked=settings[key];
    applyComfort();if(mode!=='intro')loadLevel(progress.at);resize();setMusic(settings.music&&mode!=='intro',PALETTES.indexOf(palette));
    $('backup-status').textContent='Backup imported. '+Object.keys(done).length+' completed levels kept.';
  }catch(error){$('backup-status').textContent=error.message;}
  finally{$('backup-file').value='';}
});

// ---------- Interactive practice ----------
const coach={lessonId:null};
const practice={active:false,force:null,stage:'',autoPhoto:false,step:null,introShown:false};
const lessonSeen=new Set();
try{const saved=JSON.parse(localStorage.getItem('frameshift-lessons-v2')||'[]');if(Array.isArray(saved))saved.forEach(name=>lessonSeen.add(name));}catch{}
const saveLessons=()=>{try{localStorage.setItem('frameshift-lessons-v2',JSON.stringify([...lessonSeen]));}catch{}};
let lessonTarget=null;
function highlightLesson(id){
  if(id===lessonTarget)return;
  if(lessonTarget)$(lessonTarget)?.classList.remove('tutorial-target');
  lessonTarget=id;if(id)$(id)?.classList.add('tutorial-target');
}
function updateCoach(){
  const el=$('coach'),available=(LESSON_LEVELS.has(level.name)||practice.force===level.name)&&!lessonSeen.has(level.name);
  const playing=mode!=='intro'&&!complete&&!rewind&&!vr.on&&!story.open&&$('album').hidden&&$('menu').hidden&&$('page').hidden;
  practice.active=available&&playing&&(practice.force===level.name||AUTO_LESSONS.has(level.name));
  if(!practice.active){
    el.hidden=true;coach.lessonId=null;practice.stage='';highlightLesson(null);
    if(practice.autoPhoto){frameTool=false;practice.autoPhoto=false;}
    if(available&&playing&&!practice.introShown&&!hint.on){practice.introShown=true;flash(LESSON_CUES[level.name]??level.hint,6500);}
    return;
  }
  practice.introShown=true;
  const ready=!!hint.plan&&hint.key===hintKey(),plan=ready?hint.plan.step:null;
  const c=lessonFor(level.name,{force:true,ready,plan,there:plan?.type==='frame'&&wayRing(plan).there,
    homeward:walker.next?.n===goal||walker.path.at(-1)?.n===goal||walker.node===goal,
    moving:walker.state!=='idle'||anyMoving()},mode==='camera');
  const stage=level.name+'|'+c.id+'|'+hint.key;
  if(stage!==practice.stage){
    practice.stage=stage;practice.step=c;
    if(practice.autoPhoto){frameTool=false;practice.autoPhoto=false;}
    if(c.id==='frame'&&mode!=='camera'){frameTool=true;moveTool=false;practice.autoPhoto=true;setMobileTray(null);}
    if(c.id==='remove'&&compactUI())setMobileTray('photos');
    $('coach-title').textContent=c.label;$('coach-text').textContent=c.description;
    for(const [i,icon] of [...$('coach-steps').children].entries())icon.classList.toggle('current',i===c.action);
  }
  coach.lessonId=c.id;el.dataset.lessonStep=c.id;el.hidden=false;$('title-card').hidden=true;highlightLesson(c.target);
}
function skipPractice(){
  lessonSeen.add(level.name);saveLessons();practice.force=null;practice.active=false;
  if(practice.autoPhoto){frameTool=false;practice.autoPhoto=false;}
  highlightLesson(null);$('coach').hidden=true;
}
$('coach-skip').addEventListener('click',skipPractice);
$('coach-again').addEventListener('click',()=>{
  lessonSeen.delete(level.name);saveLessons();practice.force=level.name;practice.stage='';closeMenu();
  if(complete)restartLevel();
});

// ---------- Main loop ----------
let W=1,H=1,mode='intro',elapsed=0,lastTime=performance.now(),fps=60;
function resize(){
  W=innerWidth;H=innerHeight;renderer.setSize(W,H,false);aspect=W/H;fitCamera();
  if(!vr.on&&cells?.size&&!framing){if(mode==='intro'){homeView();snapCamera();}else fitPuzzle(true);}
  updateCamera(0);
  const dpr=Math.min(devicePixelRatio,settings.quality==='low'?1:2);overlay.width=W*dpr;overlay.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
}
// The title screen shows the idea before you play: the island turns, then eases round until two paths
// line up, and for a moment a bridge of light joins them, as if a photo had been taken. Then it lets go.
const demo={next:6,phase:'turn',at:0,p:null,bridge:null};
function titleDemo(dt){
  const t=elapsed-demo.at;
  if(demo.phase==='turn'){yawT+=dt*.12;if(elapsed>demo.next&&pairs.length){demo.p=pairs[0];const u=seamLine(demo.p.seam).u;lookAlong(u);demo.phase='seek';demo.at=elapsed;}return;}
  if(demo.phase==='seek'&&(aligned.includes(demo.p)||t>4)){
    demo.phase='show';demo.at=elapsed;
    const r=ribbon(demo.p),mat=ribbonMaterial.clone();r.userData.thread.material=mat;r.userData.thread.children[0].material=bridgeEdgeMaterial.clone();r.userData.edges.forEach(e=>e.visible=false);r.userData.thread.userData.grow(0);scene.add(r);demo.bridge=r;
    const a=seamPoint(demo.p),b=new V3(...demo.p.seam.eb.mid);sparkle(a,{count:16});sparkle(b,{count:10});
    return;
  }
  if(demo.phase==='show'&&demo.bridge){
    const th=demo.bridge.userData.thread,grow=Math.min(1,t/.8);th.userData.grow(1-(1-grow)**3);
    const fade=Math.min(1,Math.max(0,(7.5-t)/1.5));th.material.opacity=ribbonMaterial.opacity*fade;th.children[0].material.opacity=bridgeEdgeMaterial.opacity*fade;
    if(t>1.4)yawT+=dt*.32*Math.min(1,(t-1.4)/1.2);// drift off again: from elsewhere the bridge is impossible
    if(t>7.5)endDemo();
  }
}
function endDemo(){if(demo.bridge){demo.bridge.removeFromParent();demo.bridge.userData.thread.material.dispose();demo.bridge.userData.thread.children[0].material.dispose();demo.bridge.traverse(o=>o.geometry?.dispose());demo.bridge=null;}demo.phase='turn';demo.next=elapsed+9;}
// Add ?fps to the address for a small frame-rate readout, to check the 60 fps target on a Quest. In the headset
// it sits low and to the left in view. "low" is the slowest second of the last 30; "slow" counts frames that
// took half as long again as they should.
const fpsMeter=new URLSearchParams(location.search).has('fps')?(()=>{
  let count=0,slow=0,since=performance.now(),text='',plane=null;const seconds=[];
  const el=Object.assign(document.createElement('div'),{id:'fps-meter'});
  el.style.cssText='position:fixed;left:8px;bottom:8px;z-index:99;font:600 13px system-ui,sans-serif;color:#fff;background:rgba(43,33,64,.85);padding:4px 9px;border-radius:8px;pointer-events:none';
  document.body.append(el);
  return (now,dt)=>{
    const target=renderer.xr.getSession()?.frameRate||60;
    count++;if(dt>1.5/target)slow++;
    if(now-since>=1000){
      const rate=count*1000/(now-since);seconds.push(rate);if(seconds.length>30)seconds.shift();
      text=`${Math.round(rate)} fps · low ${Math.round(Math.min(...seconds))} · slow ${Math.round(slow*100/count)}%`+(vr.on?` · ${Math.round(target)} Hz`:'');
      el.textContent=text;count=slow=0;since=now;plane?.material.map.userData.draw();
    }
    if(vr.on){
      plane??=(()=>{const tex=textTexture(512,80,(g,w,h)=>{g.clearRect(0,0,w,h);g.fillStyle='rgba(43,33,64,.85)';g.beginPath();g.roundRect(0,0,w,h,20);g.fill();g.fillStyle='#fff';g.font='600 34px system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(text,w/2,h/2,w-24);});
        const m=new THREE.Mesh(new THREE.PlaneGeometry(.12,.12*80/512),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));m.renderOrder=50;vr.rig.add(m);return m;})();
      plane.position.copy(vr.cam.position).add(new V3(-.09,-.11,-.42).applyQuaternion(vr.cam.quaternion));plane.quaternion.copy(vr.cam.quaternion);plane.visible=true;
    }else if(plane)plane.visible=false;
  };
})():null;
function loop(now){
  // Attaching an XR session is asynchronous. Do not submit a desktop camera frame in between.
  if(vr.starting)return;
  if(vr.on){
    if(!renderer.xr.getCamera().cameras.length)return;
    // Interactions and island placement use this frame's tracked pose, not the previous render's.
    renderer.xr.updateCamera(vr.cam);
  }
  const dt=Math.max(0,Math.min((now-lastTime)/1000,.1));lastTime=Math.max(lastTime,now);elapsed+=dt;if(dt>0)fps+=(1/dt-fps)*.05;
  if(rewind){updateRewind(dt);updateAir(dt);art.scale(scene.scale.x);showOutlines(vr.on);renderer.render(scene,camera);drawOverlay();updateHud(now);return;}
  if(mode==='intro'&&!reducedMotion())titleDemo(dt);// the title screen: the island turns slowly behind it
  updateCamera(dt);if(vr.on)vrFrame(dt);fpsMeter?.(now,dt);
  art.scale(scene.scale.x);showOutlines(vr.on);
  if(maker?.editing){
    walkerMesh.position.copy(top(walker.node));animateWalker(dt);updateAir(dt);waveFlags(homeFlags,reducedMotion()?0:elapsed);
    renderer.render(scene,vr.on?vr.cam:camera);ctx.clearRect(0,0,W,H);return;
  }
  if(!vr.on){detect(now);readings=hands.map(h=>readHand(h.points));}
  updateHands(dt);updateL(now,dt);
  const taken=linkedIds(),lining=anyMoving()?[]:pairs.filter(p=>!taken.has(p.id)&&lined(p,camera));
  aligned=lining.filter(p=>sightClear(p.seam,viewDir(camera),cells));
  const readyIds=new Set(aligned.map(p=>p.id));
  ahead=anyMoving()?[]:[...new Map(futures.filter(f=>!taken.has(f.id)&&!readyIds.has(f.id)&&joinsFrom(f,camera,W,H,f.world)).map(f=>[f.id,f])).values()];
  const waitingIds=new Set(ahead.map(p=>p.id));
  blocked=lining.filter(p=>!readyIds.has(p.id)&&!waitingIds.has(p.id));
  if(!story.open){updateMovers(dt);updateWalker(dt);}animateWalker(dt);animatePlates(dt);animateEyes();updateFade();updateFalling(dt);updateCoach();followHint();
  if(vr.on){updateVRCues(dt);updateVRHint();}
  recordTemporal();
  finale?.update(dt,reducedMotion());
  if(goalSpin&&!reducedMotion())goalSpin.rotation.y+=dt*2;
  waveFlags(homeFlags,reducedMotion()?0:elapsed);
  // Smoke drifts up from the chimney and thins out.
  for(const p of smoke){p.visible=!reducedMotion()&&settings.quality!=='low';const k=(elapsed*.22+p.userData.phase)%1;p.position.set(.20+Math.sin(k*5+p.userData.phase*9)*.06+k*.12,1.06+k*.9,-.16);p.scale.setScalar(.12+k*.3);p.material.opacity=Math.sin(k*Math.PI)*.55;}
  ribbonMaterial.opacity=reducedMotion()?.46:.46+Math.sin(elapsed*1.6)*.06;animateJoins();updateSparks(dt);updateAir(dt);
  if(vr.on)renderer.render(scene,vr.cam);else{renderer.render(scene,camera);drawOverlay();}
  updateHud(now);
}

function begin(next,resume=true){endDemo();mode=next;$('intro').hidden=true;document.body.classList.remove('at-title');document.body.classList.toggle('hands',next==='camera');
  if(maker?.active){unlockSound();setMusic(settings.music,PALETTES.indexOf(palette));return;}
  // Resume the campaign; old extra-level links return to the saved campaign stop.
  const locationURL=new URL(location.href);locationURL.searchParams.delete('extra');window.history.replaceState(null,'',locationURL);
  if(resume)loadLevel(resumeLevelIndex());
  homeView();snapCamera();
  unlockSound();setMusic(settings.music,PALETTES.indexOf(palette));const card=$('title-card');card.hidden=true;void card.offsetWidth;card.hidden=false;showLevelDialogue();}

$('start-mouse').addEventListener('click',()=>begin('mouse'));
$('reset').addEventListener('click',()=>{restartLevel();closeMenu();});
$('next').addEventListener('click',()=>nextLevel());
const chapterIndex=i=>(LEVELS[i].palette??i)%CHAPTERS.length;
function nextLevel(){
  // A second pinch/click cannot restart an in-flight chapter transition.
  if(vcard.kind==='place'||!$('page').hidden)return;
  // Finish/capture the old level now; its delayed completion must not reclaim the next page.
  finishCelebration?.();vcard.doneFor=winEpoch;$('done').hidden=true;
  if(maker?.active){maker.edit();return;}
  if(extraIndex!==null){if(extraIndex+1<EXTRA_LEVELS.length)loadExtra(extraIndex+1);else openAlbum(true);return;}
  const position=LEVEL_ORDER.indexOf(levelIndex),i=LEVEL_ORDER[(position+1)%LEVEL_ORDER.length];
  if(position===LEVEL_ORDER.length-1||chapterIndex(i)===chapterIndex(levelIndex)){loadLevel(i);return;}
  progress.at=i;saveProgress();
  const was=chapterIndex(levelIndex),now=chapterIndex(i);
  const shots=LEVEL_ORDER.filter(k=>chapterIndex(k)===was).map(k=>photoOf(LEVELS[k].name)).filter(Boolean).slice(-4);
  if(vr.on){$('done').hidden=true;vcard.place={next:i,title:CHAPTERS[now],line:countLevels(now),shots};openCard('place');return;}
  $('page-photos').innerHTML=shots.map((src,k)=>`<img src="${src}" alt="" style="--r:${[-6,4,-2,7][k]}deg;--d:${k*.12}s">`).join('');
  $('page-chapter').textContent=CHAPTERS[now];$('page-line').textContent=countLevels(now);
  $('done').hidden=true;const page=$('page');page.hidden=false;page.dataset.next=i;
  setTimeout(()=>{if(!page.hidden)play('place');},300);
}
function turnPage(){const page=$('page');if(page.hidden)return;page.hidden=true;loadLevel(+page.dataset.next);}
$('page').addEventListener('click',turnPage);
addEventListener('keydown',e=>{if(!$('page').hidden&&(e.key==='Enter'||e.key===' '))turnPage();});
$('undo').addEventListener('click',undo);
$('hint').addEventListener('click',()=>askHint());
$('clear').addEventListener('click',()=>{if(frames.some(canDrop))remember('photo');for(const f of frames.slice())if(canDrop(f))removeFrame(f,false);flash(frames.length?NO_DROP():'Photos cleared.');play('remove');closeMenu();});
$('frame-tool').addEventListener('click',()=>{frameTool=!frameTool;if(frameTool){moveTool=false;setMobileTray(null);}});
$('move-tool').addEventListener('click',()=>{moveTool=!moveTool;if(moveTool)frameTool=false;});
$('fit-tool').addEventListener('click',()=>fitPuzzle());
$('view-buttons').addEventListener('click',()=>{const hidden=!$('view-controls').hidden;$('view-controls').hidden=hidden;$('view-buttons').setAttribute('aria-expanded',String(!hidden));closeMenu();});
let menuReturnFocus=null;
function closeMenu(){
  const wasOpen=!$('menu').hidden,hadFocus=$('menu').contains(document.activeElement);
  $('menu').hidden=true;
  for(const id of ['menu-toggle','title-settings'])$(id).setAttribute('aria-expanded','false');
  if(wasOpen&&hadFocus&&menuReturnFocus?.isConnected)menuReturnFocus.focus({preventScroll:true});
}
function toggleMenu(){
  if(!$('menu').hidden){closeMenu();return;}
  menuReturnFocus=document.activeElement;setMobileTray(null);$('menu').hidden=false;
  for(const id of ['menu-toggle','title-settings'])$(id).setAttribute('aria-expanded','true');
  $('menu-close').focus({preventScroll:true});
}
$('menu').addEventListener('click',e=>{if(e.target===$('menu'))closeMenu();});
$('menu-toggle').addEventListener('click',()=>toggleMenu());
$('album-tool').addEventListener('click',()=>{closeMenu();if(maker?.active)maker.close();openAlbum();});
$('album-close').addEventListener('click',closeAlbum);
// Modal controls keep keyboard focus, and game shortcuts wait until the panel closes.
addEventListener('keydown',e=>{
  const modal=!$('menu').hidden?$('menu'):!$('done').hidden&&$('album').hidden&&$('page').hidden?$('done'):null;
  if(!modal||vr.on)return;
  if(e.key==='Escape'&&modal===$('menu')){e.preventDefault();closeMenu();}
  if(e.key==='Tab'){
    const items=[...modal.querySelectorAll('button,input,select,a[href],summary')].filter(el=>!el.disabled&&el.getClientRects().length);
    const first=items[0],last=items.at(-1),current=document.activeElement;
    if(!modal.contains(current)||(e.shiftKey?current===first:current===last)){e.preventDefault();(e.shiftKey?last:first)?.focus();}
  }
  e.stopImmediatePropagation();
},true);
overlay.addEventListener('pointerdown',closeMenu);
for(const [id,dy,dp] of [['view-left',-15,0],['view-right',15,0],['view-up',0,8],['view-down',0,-8]])$(id).addEventListener('click',()=>{turnView(dy,dp);setTimeout(snapToAlignment,0);});
$('view-home').addEventListener('click',()=>{if(!directing)homeView();});
$('view-in').addEventListener('click',()=>{moveCloser(.75);snapSoon(0);});
$('view-out').addEventListener('click',()=>{moveCloser(1/.75);snapSoon(0);});
addEventListener('keydown',e=>{
  if(story.open)return;
  if(maker?.key(e))return;
  if(rewind){e.preventDefault();if(e.key==='Escape')finishRewind();return;}
  if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||e.target instanceof HTMLTextAreaElement||e.target.isContentEditable)return;
  const k=e.key;
  if(k==='Escape'&&!$('menu').hidden){closeMenu();return;}
  if(k==='Escape'&&finishCelebration){finishCelebration();return;}
  if(k==='Escape'&&mobileTray){const name=mobileTray;setMobileTray(null);$(name+'-toggle').focus({preventScroll:true});return;}
  if(!$('album').hidden){if(k==='Escape'||k==='l'||k==='L')closeAlbum();return;}
  if(mode==='intro')return;
  if(/^Digit[123]$/.test(e.code)&&!e.ctrlKey&&!e.altKey&&!e.metaKey){e.preventDefault();if(!e.repeat){const i=Number(e.code.at(-1))-1;if(e.shiftKey)saveCheckpoint(i);else restoreCheckpoint(i);}return;}
  if(k==='l'||k==='L')openAlbum();
  else if(k==='r'||k==='R')restartLevel();
  else if(k==='n'||k==='N')adjacentLevel(1);
  else if(k==='p'||k==='P')adjacentLevel(-1);
  else if(k==='f'||k==='F'){frameTool=!frameTool;if(frameTool)moveTool=false;}
  else if(k==='m'||k==='M'){moveTool=!moveTool;if(moveTool)frameTool=false;}
  else if(k==='Backspace'||k==='Delete'){const f=frames.at(-1);if(f&&!canDrop(f))flash(NO_DROP());else if(f){removeFrame(f);flash('Photo dropped.');play('remove');}}
  else if(k==='z'||k==='Z')undo();
  else if(k==='h'||k==='H')askHint();
  else if(k==='0')fitPuzzle();
  else if(k==='`')$('opt-debug').click();
  else if(k==='ArrowLeft')turnView(-10,0);
  else if(k==='ArrowRight')turnView(10,0);
  else if(k==='ArrowUp')turnView(0,6);
  else if(k==='ArrowDown')turnView(0,-6);
  // WASD moves the eye: W/S closer and further, A/D sideways, Q/E down and up.
  else if(k==='w'||k==='W')moveCloser(.85);
  else if(k==='s'||k==='S')moveCloser(1/.85);
  else if(k==='a'||k==='A')slide(40,0);
  else if(k==='d'||k==='D')slide(-40,0);
  else if(k==='q'||k==='Q')slide(0,-40);
  else if(k==='e'||k==='E')slide(0,40);
  if(k.startsWith('Arrow'))e.preventDefault();
});
addEventListener('keyup',e=>{if(!maker?.editing&&(e.key.startsWith('Arrow')||'wasdqeWASDQE'.includes(e.key)))snapSoon();});
addEventListener('resize',resize);
for(const type of ['pointerdown','keydown'])addEventListener(type,unlockSound,{capture:true});

// Lets automated checks drive the game without a camera.
const findSeam=(a,b)=>{const id=[a,b].map(String).sort().join();return [...pairs,...futures].find(p=>[p.seam.a,p.seam.b].map(String).sort().join()===id);};
window.__illusion={
  landmarkState:()=>({...goalLandmark?.userData.destinationDetail}),
  captureView:()=>{renderer.render(scene,camera);return $('world').toDataURL('image/png');},
  walkerPose:()=>({at:walkerMesh.position.toArray(),up:new V3(0,1,0).applyQuaternion(walkerMesh.quaternion).toArray(),spawn:top(start).toArray(),spawnUp:(start.up??Y_UP).toArray(),visible:walkerMesh.visible,opacity:walkerMaterials[0].opacity}),
  storyState:()=>story.current(),
  albumPreview,
  fitPuzzle:()=>fitPuzzle(true),fitState:()=>({points:framingPoints().map(p=>project(new V3(...p))),insets:fitInsets()}),
  previews:()=>previewSegments(connectionGroups(),p=>project(new V3(...p))),
  checkpoints:()=>({slots:checkpointSlots.map(s=>s&&{state:s.state,savedAt:s.savedAt}),live:checkpointState(),stable:checkpointStable(),rewinding:!!rewind,retraced:rewind?.retraced,pose:temporalPose(),samples:trail.points.length}),
  saveCheckpoint,restoreCheckpoint,deleteCheckpoint,
  feedbackState:()=>feedback&&elapsed<feedback.until?feedback:null,
  artState:()=>({...art.stats(),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,memory:{...renderer.info.memory}}),
  atmosphereState:()=>nightAir?.stats??{kind:'day',motes:motes.length},
  experienceState:()=>({settings:{...settings},reducedMotion:reducedMotion(),pixelRatio:renderer.getPixelRatio(),shadows:renderer.shadowMap.enabled,audio:audioState(),finale:finale?.state()??null,progressAt:progress.at}),
  state:()=>({mode,tracking:!!landmarker,level:levelIndex,levelNumber:campaignNumber(LEVEL_ORDER,levelIndex),extra:extraIndex,name:level.name,capacity:level.frames,frames:frames.length,links:frames.reduce((s,f)=>s+f.links.length,0),aligned:aligned.length,
    complete,rewinding:!!rewind,walker:walker.state,directing,movers:movers.map(m=>m.moving?'moving':m.k),node:walker.node&&[walker.node.x,walker.node.y,walker.node.z],view:{yaw:yawT/DEG,pitch:pitchT/DEG,zoom:zoomT,target:targetT.toArray()},
    dir:viewDir(camera),blocked:blocked.length,ahead:ahead.length,hands:hands.length,undo:history.length}),
  project:([x,y,z])=>project(new V3(x,y,z)),
  seams:()=>pairs.map(p=>({id:p.id,a:[p.a.x,p.a.y,p.a.z],b:[p.b.x,p.b.y,p.b.z],off:misalign(p,camera),at:project(seamPoint(p))})),
  setView:(yawDeg,pitchDeg)=>{yawT=yawDeg*DEG;pitchT=pitchDeg*DEG;snapCamera();},
  // Look along a direction at once, optionally centred on a point.
  demo:()=>({phase:demo.phase,bridge:!!demo.bridge}),
  look:(dir,at)=>{lookAlong(dir,at&&new V3(...at));snapCamera();},
  snap:()=>{snapToAlignment();snapCamera();},
  closer:k=>{moveCloser(k);snapCamera();},
  futures:()=>futures.map(f=>f.id),
  photoState:()=>frames.map(f=>({born:f.born,view:f.view,visible:f.group.visible,links:f.links.map(p=>({id:p.id,error:misalign(p,f.cam)}))})),
  frameRect:hintFrameRect,
  previewPhoto:poly=>photoPreview(poly),
  replacementState:poly=>{const p=replacementPreview(poly);return p&&{lost:p.lost.map(s=>s.id),blocked:p.blocked,index:p.index};},
  photoInspection:()=>{const p=photoInspectionDetails();return p&&{index:p.index,action:p.action,links:p.links.map(l=>l.id),closing:p.exclusive.map(l=>l.id),waiting:p.waiting.map(l=>l.id),hidden:p.hidden,blocked:p.blocked,text:photoInspectionText(p)};},
  practiceState:()=>{
    const ready=!!hint.plan&&hint.key===hintKey(),st=ready?hint.plan.step:null;
    return {active:practice.active,stage:practice.step?.id,ready,step:st,way:st?.type==='frame'?wayRing(st):null};
  },
  // Each photo bridge's frame: across (its width), along (a to b) and up, in world space.
  bridges:()=>frames.flatMap(f=>f.ribbons.children.map(r=>{const e=r.userData.thread.matrix.elements;return {across:e.slice(0,3),along:e.slice(4,7),up:e.slice(8,11),at:e.slice(12,15)};})),
  // Look along a seam's line (a seam that exists now, or one that will after a swing).
  lineUp:(a,b)=>{const p=findSeam(a,b);if(!p)return false;lookAlong(seamLine(p.seam).u);snapCamera();return true;},
  seamAt:(a,b)=>{const p=findSeam(a,b);return p&&project(seamPoint(p));},
  loadLevel,loadExtra,
  extraLevels:()=>EXTRA_LEVELS.map(L=>({name:L.name,group:L.extraGroup})),
  eyes:()=>eyes.map(e=>({at:e.point.toArray(),face:eyePose(level,positions(),e).face,beam:e.beam})),
  solid:k=>cells.has(k),
  // Play a level given as data (for testing pieces on their own).
  loadData:L=>loadLevel(0,L),
  // Remove the frame made nearest a spot.
  removeNear:d=>{const f=frames.slice().sort((a,b)=>angleBetween(viewDir(a.cam),d)-angleBetween(viewDir(b.cam),d))[0];if(!f||!canDrop(f))return false;removeFrame(f);return true;},
  // Send the walker to a block top, as a tap would.
  goTo:c=>sendWalker(nodeOf(c)),
  // Every block top the walker can get to right now.
  // The block top under a screen point, as a tap would find it.
  pick:(x,y)=>{const n=nodeAtScreen(x,y);return n&&[n.x,n.y,n.z];},
  // Every walkable top whose middle can be seen, and what a tap on that middle picks.
  pickCheck:()=>nodes.flatMap(n=>{
    const t=top(n),q=project(t);if(q.z>1||q.x<0||q.y<0||q.x>W||q.y>H)return [];
    if(!visibleTop(n,q))return [];
    const p=nodeAtScreen(q.x,q.y);return [{at:[n.x,n.y,n.z],got:p&&[p.x,p.y,p.z]}];
  }),
  reach:()=>[...routes().keys()].map(n=>[n.x,n.y,n.z]),
  onDelete:(x,y)=>!!hitDelete(x,y),
  plates:()=>plates.filter(p=>p.at).map(p=>({at:p.at,screen:project(top({x:p.at[0],y:p.at[1],z:p.at[2]}))})),
  tile:c=>project(top({x:c[0],y:c[1],z:c[2]})),
  undo,
  hint:(on=true)=>askHint(on),
  hintState:()=>{const ready=hint.on&&!!hint.plan&&hint.key===hintKey(),st=ready?hint.plan.step:null;
    return {on:hint.on,tier:hint.tier,note:hint.note,ready,step:st,moves:hint.plan?.moves,way:st?.type==='frame'?wayRing(st):null};},
  inject:list=>{injected=list;},
  vrAim:p=>{const q=vrScreen(new V3(...p)),n=q.z<1?flatPick(q):null;return {q:[q.x,q.y,q.z],n:n&&[n.x,n.y,n.z]};},
  vrTilt:(x,y)=>{const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,0));for(const p of [vr.anchor,vr.goal])p.quat.premultiply(q);},vrReach:()=>[...routes().keys()].filter(n=>n!==walker.node).map(n=>({at:[n.x,n.y,n.z],room:scene.localToWorld(top(n)).toArray()})),
  vrSize:size=>{vr.goal.size=THREE.MathUtils.clamp(size,.12,.6);},
  vrPress:label=>[...vcard.buttons,...vr.buttons].find(b=>b.userData.label===label)?.userData.act(),
  vr:()=>({on:vr.on,starting:!!vr.starting,turn:vr.turn,head:vr.cam.position.toArray(),hands:vr.hands.map(h=>({look:h.model?.mode??null,mesh:h.model?.mesh??null,trusted:h.trusted!==false,wrist:h.hand.joints.wrist?.position.toArray()??null,tip:h.hand.joints['index-finger-tip']?.visible?h.hand.joints['index-finger-tip'].position.toArray():null,side:h.side,pinched:h.pinched,point:h.point?.toArray()??null,gap:h.gap,grip:!!h.grip,grabbing:!!h.grabbing,open:h.shape?.open??null,center:h.shape?.center.toArray()??null,ray:h.hasRay?{origin:h.rayOrigin.toArray(),dir:h.rayDir.toArray()}:null,target:h.target?.node?{at:[h.target.node.x,h.target.node.y,h.target.node.z],reach:!!h.target.reach,touch:!!h.target.touch}:h.target?.button?{button:h.target.button.userData.label}:null})),grabbed:!!grab.key,ar:!!vr.ar,room:!!(vr.ar&&settings.vrRoom),sky:!!vr.sky?.visible,prints:frames.map(f=>({visible:f.group.visible,scale:f.group.scale.x})),align:vr.align?{yaw:vr.align.yaw,pitch:vr.align.pitch}:null,snap:VR_SNAP_DEG,pointer:{hover:!!vr.hover?.visible,trail:pointer.trail.filter(m=>m.visible).length,beams:vr.hands.filter(h=>h.beam?.visible).length},
    controllers:vr.controllers.map(h=>({side:h.side,pinched:h.pinched,point:h.point?.toArray()??null,origin:h.origin.toArray(),direction:h.direction.toArray()})),
    framing:!!vr.framing,frameLabel:vr.frameLabel?.visible?vr.frameWords:null,cues:{near:cueNear(),edges:cue.edges.filter(m=>m.visible).length,focus:!!cue.focus?.g.visible,focusCurrent:!!cue.focus?.g.visible&&pairs.some(p=>p.seam===cue.focus.target),gold:!!cue.focus?.g.visible&&cue.focus.mat.color.getHex()===0xffd36b},hint:{shown:vhint.group.visible,tier:hint.tier,ring:!!vhint.ring?.visible,ringAt:vhint.ring?.visible?vhint.ring.getWorldPosition(new V3()).toArray():null,edges:vhint.edges.filter(m=>m.visible).length,pulses:vhint.pulses.filter(m=>m.visible).length,ghost:!!vhint.ghost?.visible,prints:vhint.prints.filter(m=>m.visible).length},guide:vr.guide?.step??null,guideTarget:vr.guide?.target??null,hold:vr.hold.state,charge:vr.hold.charge,palm:(p=>p&&{normal:p.normal.toArray(),open:p.open,pinched:p.pinched})(palmOf(vr.hands.find(h=>h.side==='left'))),island:{at:vr.anchor.pos.toArray(),size:vr.anchor.size,up:Y_UP.clone().applyQuaternion(vr.anchor.quat).toArray()},panel:vr.panelText,panelAt:vr.panel?.getWorldPosition(new V3()).toArray(),panelSize:vr.panel?vr.panel.getWorldScale(new V3()).x:null,story:story.current(),card:vcard.kind,buttons:[...vr.buttons,...vcard.buttons].map(b=>({label:b.userData.label,disabled:b.userData.disabled,where:b.userData.where??null,at:b.getWorldPosition(new V3()).toArray()})),menu:{scale:vr.tray.getWorldScale(new V3()).x,shown:menu.shown,visible:vr.tray.visible,at:vr.tray.getWorldPosition(new V3()).toArray(),normal:new V3(0,0,1).transformDirection(vr.tray.matrixWorld).toArray()}}),
  enterVR,exitVR:()=>renderer.xr.getSession()?.end(),nextLevel,albumChapters:()=>albumChapters().map(c=>({name:c.name,levels:c.levels})),
  // A point on the island (level coordinates) in the room.
  toRoom:p=>scene.localToWorld(new V3(...p)).toArray()
};

if(new URLSearchParams(location.search).has('debug'))document.body.classList.add('dev');
resize();loadLevel(resumeLevelIndex());
renderer.setAnimationLoop(loop);

// Only the separate experiments/level-maker.html entry loads and installs an editor.
// The campaign shares its renderer and rules without loading editor assets or drafts.
export function enableLevelMaker(createLevelMaker,onClose){
  maker=createLevelMaker({
  scene,camera,overlay,
  current:()=>{
    if(mode==='intro'){
      const extra=progress.route==='extras'?EXTRA_LEVELS.findIndex(L=>L.name===progress.extra):-1;
      const index=Number.isInteger(progress.at)&&progress.at>=0&&progress.at<LEVELS.length?progress.at:0;
      return {level:structuredClone(extra>=0?EXTRA_LEVELS[extra]:LEVELS[index]),index,extra:extra>=0?extra:null};
    }
    return {level:structuredClone(level),index:levelIndex,extra:extraIndex};
  },
  view:()=>({yaw:yawT/DEG,pitch:pitchT/DEG,zoom:zoomT,target:targetT.toArray()}),
  begin:()=>{begin('mouse');closeMenu();closeAlbum();$('page').hidden=true;practice.force=null;practice.active=false;$('coach').hidden=true;},
  preview:(L,{fresh,editing,view:chosenView}={})=>{
    const keep=chosenView??{yaw:yawT/DEG,pitch:pitchT/DEG,zoom:zoomT,target:targetT.toArray()};
    loadLevel(0,L);frameTool=moveTool=false;
    if(editing){center.set(0,0,0);radius=12;art.fit(center,radius);}
    if(!fresh){yawT=keep.yaw*DEG;pitchT=keep.pitch*DEG;zoomT=keep.zoom;targetT.fromArray(keep.target);snapCamera();}
    if(vr.on){vr.framing=null;vr.quad.visible=vr.outline.visible=false;for(const h of [...vr.hands,...(vr.controllers??[])])h.used=true;placeIsland();}
    $('title-card').hidden=true;
  },
  leave:onClose,
  fit:()=>fitPuzzle(true),turn:turnView,slide,zoom:moveCloser,vrTurn:amount=>{vr.turn+=amount;},sound:()=>play('place'),enterVR,exitVR:()=>renderer.xr.getSession()?.end()
});
  Object.assign(window.__illusion,{maker:()=>maker.state(),makerOpen:()=>maker.open()});
  return maker;
}
