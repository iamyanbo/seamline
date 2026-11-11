import * as THREE from './vendor/three.module.js';
import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';
import {ART,surfaceMaterial,batchArchitecture} from './illusion-art.js';
import {curvedRoof} from './illusion-kyoto.js';

// One small landmark per level. Shared finishes keep repeated visits inexpensive.
const finishes=new Map();
const profiles={Home:{body:0xe7cbb0,roof:0xb95842,wood:0x785149},Beach:{body:0xb5ddd2,roof:0xdb7962,wood:0xb39065},'Snowy mountains':{body:0xa67a58,roof:0x59443f,wood:0x654c40},Venice:{body:0xd99d80,roof:0xa85c4b,wood:0x567569},Desert:{body:0xf1d9b7,roof:0x5eaaaa,wood:0x987252,dome:true},Santorini:{body:0xfff9e9,roof:0x3674b5,wood:0x3674b5,dome:true}};
function materials(name){
 if(finishes.has(name))return finishes.get(name);
 const a=ART[name]??ART.Home,p=profiles[name]??(name==='Glow forest'?{body:a.wall,roof:0xc65b50,wood:0x647b52}:name==='Lantern night'?{body:a.wall,roof:0x713f36,wood:0x4b302a}:{body:a.wall,roof:a.accent,wood:a.rail}),make=(kind,color,options={})=>surfaceMaterial(kind,{color,...options});
 const kit={wall:make(name==='Snowy mountains'?'wood':'plaster',p.body),roof:make('stone',p.roof),tile:make('stone',new THREE.Color(p.roof).lerp(new THREE.Color(a.cap),.13)),wood:make('wood',p.wood),trim:make('stone',a.cap),dark:make('wood',0x463b39),metal:make('metal',0xb28a52,{metalness:.55,roughness:.4}),glass:make('glass',0xffdba0,{emissive:0xffb45d,emissiveIntensity:name==='Snowy mountains'||name==='Venice'?.45:.16,roughness:.25}),snow:make('snow',0xf2f8fc),leaf:make('leaf',0x719b65),joint:make('ice',0xc5dfeb)};
 finishes.set(name,kit);return kit;
}
function arch(w,h){const s=new THREE.Shape();s.moveTo(-w/2,0);s.lineTo(-w/2,h-w/2);s.absarc(0,h-w/2,w/2,Math.PI,0,true);s.lineTo(w/2,0);s.closePath();return s;}
function framedArch(w,h,border,depth){const s=arch(w+border*2,h+border);const hole=new THREE.Path();hole.moveTo(-w/2,0);hole.lineTo(w/2,0);hole.lineTo(w/2,h-w/2);hole.absarc(0,h-w/2,w/2,0,Math.PI,false);hole.lineTo(-w/2,0);s.holes.push(hole);return new THREE.ExtrudeGeometry(s,{depth,steps:1,curveSegments:20,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:2});}
export function createDestinationHouse(name,{light,spin}){
 if(!profiles[name])return null;
 const g=new THREE.Group(),m=materials(name),domed=!!profiles[name].dome,snow=name==='Snowy mountains',venice=name==='Venice',h=venice?.73:.6,w=.62,d=.56,base=.05,rise=snow?.31:.27,eave=base+h,ridge=eave+rise;
 const add=(geo,mat,x=0,y=0,z=0)=>{const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);return mesh;};
 const box=(x,y,z,mat,px,py,pz,r=.012)=>add(new RoundedBoxGeometry(x,y,z,2,Math.min(r,x*.15,y*.15,z*.15)),mat,px,py,pz);
 // Separate wall panels leave an actual recess behind the luminous doorway.
 box(.70,.055,.64,m.trim,0,.027,0);
 box(.045,h,d,m.wall,-w/2+.0225,base+h/2,0);box(.045,h,d,m.wall,w/2-.0225,base+h/2,0);
 box(w,h,.04,m.wall,0,base+h/2,-d/2+.02);
 const front=new THREE.Shape();front.moveTo(-w/2,0);front.lineTo(w/2,0);front.lineTo(w/2,h);front.lineTo(-w/2,h);front.closePath();
 const door=arch(.23,.43),hole=new THREE.Path(door.getPoints(24));front.holes.push(hole);
 const facade=new THREE.ExtrudeGeometry(front,{depth:.04,curveSegments:20,steps:1,bevelEnabled:true,bevelSize:.006,bevelThickness:.006,bevelSegments:2});
 add(facade,m.wall,0,base,d/2-.04);
 add(framedArch(.23,.43,.035,.035),m.trim,0,base,d/2+.003);
 light.geometry=new THREE.ShapeGeometry(arch(.23,.43),24);light.position.set(0,base,.23);g.add(light);
 box(.30,.035,.13,m.trim,0,.04,.30);box(.22,.024,.025,m.wood,0,.06,.335);
 for(const x of [-.125,.125])box(.018,.32,.04,m.dark,x,base+.16,.245,.004);
 if(!domed){
 // A filled gable, with a small round attic window and a raised surround.
 const triangle=new THREE.Shape();triangle.moveTo(-w/2,0);triangle.lineTo(w/2,0);triangle.lineTo(0,rise*.88);triangle.closePath();
 for(const z of [-d/2,d/2-.015])add(new THREE.ExtrudeGeometry(triangle,{depth:.018,steps:1,bevelEnabled:true,bevelSize:.005,bevelThickness:.004,bevelSegments:2}),m.wall,0,eave,z);
 const atticY=eave+.09;
 add(new THREE.CylinderGeometry(.045,.045,.012,32).rotateX(Math.PI/2),m.glass,0,atticY,d/2+.013);
 add(new THREE.TorusGeometry(.048,.009,8,32),m.trim,0,atticY,d/2+.024);
 box(.006,.075,.01,m.wood,0,atticY,d/2+.035,.002);box(.075,.006,.01,m.wood,0,atticY,d/2+.035,.002);
 // Deep eaves, rounded fascia and overlapping courses of small ceramic tiles.
 const half=.40,angle=Math.atan2(rise,half),length=Math.hypot(half,rise),roofDepth=.72;
 for(const side of [-1,1]){
  const panel=box(length+.015,.045,roofDepth,m.roof,side*half/2,eave+rise/2,0,.012);panel.rotation.z=-side*angle;
  for(const z of [-roofDepth/2,roofDepth/2]){const fascia=box(length+.025,.048,.035,m.wood,side*half/2,eave+rise/2-.018,z,.008);fascia.rotation.z=-side*angle;}
  if(snow){const cap=box(length+.025,.065,roofDepth+.025,m.snow,side*half/2,eave+rise/2+.042,0,.028);cap.rotation.z=-side*angle;}
  else for(let row=0;row<4;row++)for(let column=0;column<6;column++){
   const t=(row+.5)/4,x=side*half*t,y=ridge-rise*t+.041+(3-row)*.004,z=-roofDepth/2+(column+.5)*roofDepth/6;
   const tile=box(length/4-.004,.021,roofDepth/6-.004,(row+column)%4?m.roof:m.tile,x,y,z,.008);tile.rotation.z=-side*angle;
  }
 }
 add(new THREE.CylinderGeometry(.029,.029,roofDepth+.03,20).rotateX(Math.PI/2),snow?m.snow:m.tile,0,ridge+.03,0);
 }else{
  // A layered drum and a ribbed dome replace the old box-and-hemisphere silhouette.
  box(.68,.04,.62,m.trim,0,eave+.02,0);
  add(new THREE.CylinderGeometry(.25,.27,.09,64),m.trim,0,eave+.075,0);
  add(new THREE.CylinderGeometry(.265,.265,.018,64),m.metal,0,eave+.12,0);
  add(new THREE.SphereGeometry(.27,64,32,0,Math.PI*2,0,Math.PI/2),m.roof,0,eave+.13,0);
  for(let rib=0;rib<12;rib++){
   const a=rib*Math.PI/6,points=Array.from({length:13},(_,i)=>{const t=.10+i/12*(Math.PI/2-.10);return new THREE.Vector3(Math.sin(a)*.273*Math.sin(t),eave+.13+.273*Math.cos(t),Math.cos(a)*.273*Math.sin(t));});
   add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),18,.0035,6),m.tile);
  }
  if(name==='Desert'){
   add(new THREE.SphereGeometry(.023,24,12),m.metal,0,eave+.435,0);
   add(new THREE.CylinderGeometry(.006,.012,.07,24),m.metal,0,eave+.40,0);
   for(const side of [-1,1])box(.012,.02,.50,m.roof,side*.325,.15,0,.003);
   for(const x of [-.25,.25])box(.095,.025,.012,m.roof,x,.15,.29,.003);
   for(let col=0;col<4;col++)for(let row=0;row<2;row++)box(.066,.005,.044,(col+row)%2?m.roof:m.trim,(col-1.5)*.071,.063,.29+row*.05,.002);
   const canopy=box(.38,.025,.15,m.roof,0,.49,.33,.007);canopy.rotation.x=.12;
   for(const x of [-.17,.17])box(.012,.09,.012,m.metal,x,.435,.375,.003);
  }else{
   // An open bell cote and a small cross retain the chapel's blue-and-white identity.
   add(framedArch(.12,.19,.028,.048),m.trim,0,eave+.04,.245);
   add(new THREE.LatheGeometry([new THREE.Vector2(.035,0),new THREE.Vector2(.027,.012),new THREE.Vector2(.018,.045),new THREE.Vector2(.008,.053)],32),m.metal,0,eave+.105,.267);
   add(new THREE.SphereGeometry(.008,16,10),m.dark,0,eave+.10,.267);
   box(.014,.12,.014,m.metal,0,eave+.455,0,.003);box(.065,.014,.014,m.metal,0,eave+.47,0,.003);
  }
 }
 // Framed side windows, sill shadows, shutters and timber corner posts.
 for(const side of [-1,1]){
  const x=side*(w/2+.007),y=base+h*.52,z=-.025;
  box(.014,.20,.19,m.dark,x,y,z,.008);box(.018,.16,.15,m.glass,x+side*.008,y,z,.007);
  box(.022,.016,.22,m.trim,x+side*.01,y+.106,z,.004);box(.055,.022,.23,m.trim,x+side*.016,y-.11,z,.005);
  box(.025,.17,.009,m.wood,x+side*.02,y,z,.003);box(.025,.009,.16,m.wood,x+side*.02,y,z,.003);
  if(venice)for(const dz of [-.14,.14]){box(.025,.20,.067,m.wood,x+side*.01,y,z+dz,.004);for(let n=0;n<4;n++)box(.029,.009,.057,m.trim,x+side*.02,y-.065+n*.043,z+dz,.002);}
  for(const zz of [-d/2+.015,d/2+.015])box(.035,h+.02,.035,m.wood,side*(w/2+.002),base+h/2,zz,.006);
 }
 if(snow||name==='Beach')for(let i=0;i<6;i++)for(const side of [-1,1])box(.012,.012,d-.06,m.wood,side*(w/2+.011),base+.07+i*(h-.08)/6,0,.003);
 if(!domed){
 // A capped chimney with a dark opening, rather than a solid block on the roof.
 const cx=.20,cz=-.16,cy=eave+rise*.6+.09;
 box(.12,.22,.12,m.trim,cx,cy,cz,.012);box(.15,.025,.15,m.trim,cx,cy+.12,cz,.007);box(.09,.004,.09,m.dark,cx,cy+.135,cz,.002);
 if(snow){box(.165,.025,.165,m.snow,cx,cy+.15,cz,.012);for(const x of [-.32,-.18,.19,.33])add(new THREE.ConeGeometry(.012,.065+Math.abs(x)*.06,12),m.snow,x,eave-.025,.37).rotation.z=Math.PI;}
 }
 // Only static opaque pieces are batched; the goal glow and animated marker stay live.
 spin.position.y=Math.max(1.36,ridge+.36);spin.userData.noBatch=true;g.add(spin);
 batchArchitecture(g);g.userData.destinationDetail={version:3,style:name,recessedDoor:true,roofCourses:snow||domed?0:4};
 return g;
}

// Later destinations keep their own architecture, with constructed surfaces and fittings.
export function refineDestination(group,name,{light,spin}){
 if(group.userData.destinationDetail)return group;
 const m=materials(name),add=(geo,mat,x=0,y=0,z=0)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;group.add(o);return o;};
 const box=(w,h,d,mat,x,y,z,r=.008)=>add(new RoundedBoxGeometry(w,h,d,2,Math.min(r,w*.15,h*.15,d*.15)),mat,x,y,z);
 const ring=(r,y,t=.01,mat=m.metal)=>add(new THREE.TorusGeometry(r,t,8,64).rotateX(Math.PI/2),mat,0,y,0);
 const tube=(points,r,mat)=>add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),16,r,6),mat);
 const remove=predicate=>{for(const o of group.children.slice())if(o.isMesh&&o!==light&&o!==spin&&predicate(o)){o.removeFromParent();o.geometry.dispose();}};
 const porthole=(a,y,r,bodyR,mat=m.glass)=>{
  const x=Math.sin(a)*bodyR,z=Math.cos(a)*bodyR;
  add(new THREE.CylinderGeometry(r,r,.01,32).rotateX(Math.PI/2),mat,x,y,z).rotation.y=a;
  add(new THREE.TorusGeometry(r+.006,.009,8,40),m.trim,x+Math.sin(a)*.008,y,z+Math.cos(a)*.008).rotation.y=a;
  box(r*1.8,.007,.013,m.wood,x+Math.sin(a)*.015,y,z+Math.cos(a)*.015,.002).rotation.y=a;
  box(.007,r*1.8,.013,m.wood,x+Math.sin(a)*.015,y,z+Math.cos(a)*.015,.002).rotation.y=a;
 };
 const ribs=(r,y,count=12,mat=m.metal)=>{
  for(let j=0;j<count;j++){const a=j/count*Math.PI*2;const points=Array.from({length:13},(_,i)=>{const t=.08+i/12*(Math.PI/2-.08);return [Math.sin(a)*r*Math.sin(t),y+r*Math.cos(t),Math.cos(a)*r*Math.sin(t)];});tube(points,.0045,mat);}
 };
 if(name==='Castle'){
  // Dressed stone courses and slate roof seams on the round keep.
  for(const y of [.18,.39,.60,.81])ring(.402-.04*y/.95,y,.004,m.trim);
  for(let row=0;row<4;row++)for(let j=0;j<12;j++){
   const a=(j+(row%2)*.5)*Math.PI/6,y=.085+row*.21,r=.402-.04*y/.95;
   add(new THREE.CylinderGeometry(.0025,.0025,.17,6),m.trim,Math.sin(a)*r,y+.08,Math.cos(a)*r);
  }
  for(const a of [-Math.PI/2,Math.PI/2,Math.PI]){
   const x=Math.sin(a)*.381,z=Math.cos(a)*.381;
   box(.075,.21,.014,m.trim,x,.57,z).rotation.y=a;box(.028,.15,.018,m.dark,x+Math.sin(a)*.01,.57,z+Math.cos(a)*.01,.004).rotation.y=a;
  }
  for(let i=1;i<5;i++){const t=i/5;ring(.423*(1-t),1.02+.62*t,.0035,m.dark);}
  for(let j=0;j<12;j++){const a=j*Math.PI/6;tube([[Math.sin(a)*.422,1.02,Math.cos(a)*.422],[Math.sin(a)*.21,1.33,Math.cos(a)*.21],[0,1.64,0]],.003,m.dark);}
 }else if(name==='Lantern night'){
  // Roofs now have actual thickness, carved ridge caps and framed paper windows.
  remove(o=>o.geometry.type==='BufferGeometry'&&[.47,.78].some(y=>Math.abs(o.position.y-y)<.001));
  for(const [y,w] of [[.47,.86],[.78,.6]]){
   const top=curvedRoof(w,.16),bottom=top.clone();bottom.translate(0,-.018,0);
   const roof=add(top,m.dark,0,y,0);roof.material.side=THREE.DoubleSide;add(bottom,m.wood,0,y,0);
   for(const z of [-w*.48,w*.48])tube([[-w*.48,y+.04,z],[0,y,z],[w*.48,y+.04,z]],.011,m.metal);
  }
  box(.18,.025,.18,m.dark,0,.94,0);
  box(.64,.05,.58,m.trim,0,.025,0);box(.32,.035,.15,m.trim,0,.035,.32);
  for(const side of [-1,1]){
   box(.024,.43,.026,m.wood,side*.275,.24,.255);box(.024,.43,.026,m.wood,side*.275,.24,-.255);
   box(.015,.20,.22,m.glass,side*.287,.25,0);
   for(const z of [-.07,0,.07])box(.022,.21,.009,m.wood,side*.297,.25,z,.002);
   for(const y of [.18,.25,.32])box(.022,.009,.22,m.wood,side*.297,y,0,.002);
  }
  for(const x of [-.32,.32]){
   add(new THREE.LatheGeometry([new THREE.Vector2(.025,0),new THREE.Vector2(.046,.025),new THREE.Vector2(.048,.075),new THREE.Vector2(.025,.105)],32),m.glass,x,.275,.285);
   box(.075,.012,.075,m.metal,x,.38,.285,.004);box(.018,.055,.018,m.metal,x,.415,.285,.003);
  }
 }else if(name==='Ice palace'){
  // Curved, individually separated snow blocks give the dome depth beyond a texture.
  remove(o=>o.geometry.type==='SphereGeometry'&&o.geometry.parameters.radius===.4);
  add(new THREE.SphereGeometry(.394,48,24,0,Math.PI*2,0,Math.PI/2),m.joint);
  for(let row=0;row<6;row++)for(let j=0;j<20;j++){
   const theta=.015+row*(Math.PI/2-.02)/6,span=(Math.PI/2-.02)/6-.009;
   add(new THREE.SphereGeometry(.402+row*.001,5,4,(j+(row%2)*.5)*Math.PI/10,Math.PI/10-.009,theta,span),row%3?m.snow:m.trim);
  }
  ring(.397,.012,.014,m.snow);
  light.position.z=.454;
  for(const z of [.275,.355,.435]){
   const portal=add(framedArch(.24,.21,.027,.025),m.snow,0,0,z);
  }
  for(const a of [-Math.PI/2,Math.PI/2])porthole(a,.20,.048,.35);
  add(new THREE.CylinderGeometry(.033,.045,.07,32),m.trim,0,.429,0);add(new THREE.SphereGeometry(.05,24,12).scale(1,.4,1),m.snow,0,.477,0);
 }else if(name==='Glow forest'){
  remove(o=>o.geometry.type==='CylinderGeometry'&&o.geometry.parameters.height===.52||o.geometry.type==='SphereGeometry');
  add(new THREE.LatheGeometry([new THREE.Vector2(.25,0),new THREE.Vector2(.25,.04),new THREE.Vector2(.21,.13),new THREE.Vector2(.185,.33),new THREE.Vector2(.20,.47),new THREE.Vector2(.26,.52)],48),m.trim);
  add(new THREE.LatheGeometry([new THREE.Vector2(.24,.49),new THREE.Vector2(.37,.475),new THREE.Vector2(.43,.49),new THREE.Vector2(.442,.52),new THREE.Vector2(.42,.59),new THREE.Vector2(.32,.70),new THREE.Vector2(.18,.765),new THREE.Vector2(0,.785)],64),m.roof);
  for(let j=0;j<18;j++){const a=j*Math.PI/9;tube([[Math.sin(a)*.22,.50,Math.cos(a)*.22],[Math.sin(a)*.31,.485,Math.cos(a)*.31],[Math.sin(a)*.40,.49,Math.cos(a)*.40]],.006,m.glass);}
  for(let j=0;j<9;j++){
   const a=j*2.4,r=.12+(j%3)*.075,y=r<.18?.785-r/.18*.020:.765-(r-.18)/.14*.065;
   const spot=add(new THREE.SphereGeometry(.032,20,12).scale(1,.20,1),m.snow,Math.sin(a)*r,y+.003,Math.cos(a)*r);spot.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(Math.sin(a)*r/.42,1,Math.cos(a)*r/.42).normalize());
  }
  for(const a of [-Math.PI/2,Math.PI/2])porthole(a,.28,.046,.198);
  for(let j=0;j<7;j++){const a=j/7*Math.PI*2;tube([[Math.sin(a)*.19,.10,Math.cos(a)*.19],[Math.sin(a)*.23,.04,Math.cos(a)*.23],[Math.sin(a)*.29,.018,Math.cos(a)*.29]],.016,m.wood);}
  box(.20,.025,.10,m.trim,0,.015,.255);
 }else if(name==='Cloud kingdom'){
  remove(o=>o.geometry.type==='CylinderGeometry'&&o.geometry.parameters.radiusTop===.03);
  for(let j=0;j<8;j++){
   const a=j*Math.PI/4+Math.PI/8,x=Math.cos(a)*.3,z=Math.sin(a)*.3;
   add(new THREE.LatheGeometry([new THREE.Vector2(.044,0),new THREE.Vector2(.044,.025),new THREE.Vector2(.032,.045),new THREE.Vector2(.025,.33),new THREE.Vector2(.04,.36),new THREE.Vector2(.04,.40)],32),m.trim,x,.08,z);
   box(.09,.025,.09,m.trim,x,.095,z);box(.09,.025,.09,m.trim,x,.475,z);
   for(let flute=0;flute<8;flute++){const b=flute*Math.PI/4;add(new THREE.CylinderGeometry(.002,.002,.27,6),m.wall,x+Math.sin(b)*.026,.275,z+Math.cos(b)*.026);}
  }
  ring(.38,.075,.012,m.trim);ring(.365,.49,.014,m.trim);ring(.365,.54,.009,m.metal);ribs(.303,.54,12);
  add(new THREE.SphereGeometry(.026,24,16),m.metal,0,.88,0);
 }else if(name==='The stars'){
  ring(.347,.03,.012,m.trim);ring(.335,.46,.012,m.metal);ring(.34,.51,.009,m.metal);
  for(const a of [-Math.PI/2,Math.PI/2,Math.PI])porthole(a,.28,.05,.333);
  ribs(.334,.5,10);
  const scope=new THREE.Group();scope.position.set(0,.86,.2);scope.rotation.x=.75;
  for(const y of [-.15,.03,.19]){const collar=new THREE.Mesh(new THREE.TorusGeometry(y===.19?.044:.052,.007,8,40).rotateX(Math.PI/2),m.metal);collar.position.y=y;scope.add(collar);}
  const lens=new THREE.Mesh(new THREE.CircleGeometry(.033,32).rotateX(-Math.PI/2),m.glass);lens.position.y=.215;scope.add(lens);group.add(scope);
  box(.12,.035,.10,m.trim,.21,.035,.27);
 }else if(name==='Space'){
  // Hull joints, dome ribs, an airlock collar and actual foliage inside the habitat.
  for(let j=0;j<12;j++)add(new THREE.CylinderGeometry(.362,.362,.13,6,1,true,j*Math.PI/6,Math.PI/6-.018),j%3?m.trim:m.wall,0,.12,0);
  ring(.359,.035,.012,m.wood);ring(.355,.235,.01,m.metal);ribs(.304,.24,8,m.wood);
  for(const a of [-Math.PI/2,Math.PI/2,Math.PI])porthole(a,.135,.032,.365);
  box(.23,.035,.10,m.trim,0,.23,.38);box(.20,.025,.10,m.trim,0,.02,.38);
  remove(o=>o.geometry.type==='IcosahedronGeometry');
  add(new THREE.CylinderGeometry(.062,.048,.07,32),m.wall,0,.28,0);
  for(let j=0;j<5;j++){
   const a=j*Math.PI*2/5,leaf=add(new THREE.SphereGeometry(.10,24,16).scale(.35,1,.20),m.leaf,Math.sin(a)*.04,.37,Math.cos(a)*.04);leaf.rotation.z=Math.sin(a)*.65;leaf.rotation.x=Math.cos(a)*.65;
  }
  for(let j=0;j<8;j++){const a=j*Math.PI/4;tube([[.24,.64,-.12],[.24+Math.sin(a)*.07,.61,-.12+Math.cos(a)*.07]],.0025,m.metal);}
 }
 // Smooth the still-coarse structural curves (not particles or nearby walkway props).
 group.traverse(o=>{if(o.isMesh&&o.geometry.type==='SphereGeometry'&&o.geometry.parameters.widthSegments<32){const q=o.geometry.parameters;if(q.thetaLength===Math.PI/2){const old=o.geometry;o.geometry=new THREE.SphereGeometry(q.radius,48,24,q.phiStart,q.phiLength,q.thetaStart,q.thetaLength);const attr=old.getAttribute('color');if(attr){const color=new Float32Array(o.geometry.attributes.position.count*3);for(let i=0;i<color.length;i+=3){color[i]=attr.getX(0);color[i+1]=attr.getY(0);color[i+2]=attr.getZ(0);}o.geometry.setAttribute('color',new THREE.BufferAttribute(color,3));}old.dispose();}}});
 spin.userData.noBatch=true;
 for(const flag of group.userData.flags??[])flag.traverse(o=>o.userData.noBatch=true);
 batchArchitecture(group);group.userData.destinationDetail={version:3,style:name};return group;
}
