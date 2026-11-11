// Themes: each chapter is a place with its own look. A theme sets the stone (colours and the pattern on
// tops and sides), how a walkway is edged, what stands in place of windows and the home at the goal.
// These assets add no walkable tiles. Opaque railings and parapets do affect visibility;
// illusion-rails.js shares their geometry with the solver. Beams and plates stay recognisable.
import * as THREE from './vendor/three.module.js';
import {softBox,surfaceMaterial,litGeometry,decorMaterial} from './illusion-art.js';
import {kyotoLacquer,kyotoRoof,kyotoBrass,createKyotoHome,curvedRoof} from './illusion-kyoto.js';
const V3=THREE.Vector3;
const canvasTexture=(w,h,draw)=>{if(typeof document==='undefined')return new THREE.Texture();const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;};
const col=hex=>new THREE.Color(hex);
// Decoration carries only base colour. Preserve smooth normals and use the chapter lighting.
export const painted=litGeometry;
export const PAINT=decorMaterial;

// ---------- Castle ----------
// Pale limestone at dawn: cut blocks in courses on the sides, flagstones on top, slate-blue roofs and red
// banners. Walkways have battlements.
const SLATE=0x5f6f96,BANNER=0xc0444a,GOLD=0xf2c45a,IRON=0x3d3445,WOOD=0x9a6a4a;
// Cut stone: four courses, the joints staggered, a pale lip under the top edge and a shade toward the bottom.
const ashlar=canvasTexture(128,128,(g,n)=>{
  const grad=g.createLinearGradient(0,0,0,n);grad.addColorStop(0,'#ffffff');grad.addColorStop(1,'#bdb5b3');g.fillStyle=grad;g.fillRect(0,0,n,n);
  g.fillStyle='rgba(255,255,255,.55)';g.fillRect(0,0,n,8);
  g.strokeStyle='rgba(70,50,50,.2)';g.lineWidth=2.5;
  for(let r=0;r<4;r++){
    const y=10+r*29.5;g.beginPath();g.moveTo(0,y);g.lineTo(n,y);g.stroke();
    for(let x=(r%2?21:0)+42;x<n;x+=42){g.beginPath();g.moveTo(x,y);g.lineTo(x,y+29.5);g.stroke();}
  }
  // A few stones a shade lighter or darker, so the wall isn't too even.
  for(const [x,y,a] of [[4,12,.07],[66,41,-.06],[26,71,.06],[88,100,-.05]]){g.fillStyle=a>0?`rgba(255,255,255,${a})`:`rgba(60,40,40,${-a})`;g.fillRect(x,y,38,27);}
});
// Flagstones: four slabs with mortar between, and a worn lip round the edge.
const flags=canvasTexture(128,128,(g,n)=>{
  const glow=g.createRadialGradient(n/2,n/2,n*.1,n/2,n/2,n*.75);glow.addColorStop(0,'#ffffff');glow.addColorStop(1,'#e8e2e0');g.fillStyle=glow;g.fillRect(0,0,n,n);
  g.strokeStyle='rgba(90,70,70,.22)';g.lineWidth=2.5;
  for(const [x,y,w,h] of [[8,8,64,50],[72,8,48,70],[8,58,40,62],[48,78,72,42]]){g.beginPath();g.roundRect(x,y,w,h,4);g.stroke();}
  g.strokeStyle='rgba(255,255,255,.85)';g.lineWidth=2;g.beginPath();g.roundRect(5,5,n-10,n-10,6);g.stroke();
});
// An arrow slit: a tall narrow opening with a rounded top, cut dark into the wall, on a pale stone surround.
const slit=canvasTexture(128,128,(g)=>{
  g.fillStyle='rgba(255,255,255,.35)';g.beginPath();g.roundRect(50,22,28,90,12);g.fill();
  g.fillStyle='#fff';g.beginPath();g.roundRect(58,30,12,74,6);g.fill();
});
// A banner: red cloth with a gold sun, cut into two tails at the bottom.
const bannerTexture=canvasTexture(64,128,(g,w,h)=>{
  g.fillStyle='#c0444a';g.beginPath();g.moveTo(0,0);g.lineTo(w,0);g.lineTo(w,h);g.lineTo(w/2,h-20);g.lineTo(0,h);g.closePath();g.fill();
  g.fillStyle='rgba(0,0,0,.12)';g.fillRect(0,0,w,10);g.fillStyle='rgba(255,255,255,.12)';g.fillRect(4,0,4,h-6);
  g.fillStyle='#f2c45a';g.beginPath();g.arc(w/2,50,13,0,Math.PI*2);g.fill();
  g.strokeStyle='#f2c45a';g.lineWidth=3;for(let i=0;i<8;i++){const a=i*Math.PI/4;g.beginPath();g.moveTo(w/2+Math.cos(a)*16,50+Math.sin(a)*16);g.lineTo(w/2+Math.cos(a)*22,50+Math.sin(a)*22);g.stroke();}
  g.fillStyle='#f2c45a';g.fillRect(6,h-38,w-12,3);
});
const bannerMaterial=new THREE.MeshBasicMaterial({map:bannerTexture,transparent:true,side:THREE.DoubleSide,alphaTest:.5});
const bannerGeometry=new THREE.PlaneGeometry(.34,.68);

// Battlements: a low parapet along a walkway's closed side, with two merlons on it. Low enough that the
// traveller shows over it, and only for looks. Set just inside the wall, so no face lies on the block's own
// (two faces in one plane flicker), and exactly a tile long, so neighbours meet without overlapping.
const parapetGeometry=softBox(1,.16,.12),merlonGeometry=softBox(.24,.17,.12);
function battlements(c,mat){
  const out=[],[ax,az]=c.s;
  for(const side of [-1,1]){
    const x=c.x+az*side*.43,z=c.z+ax*side*.43,rot=ax?0:Math.PI/2;
    const wall=new THREE.Mesh(parapetGeometry,mat);wall.position.set(x,c.y+.58,z);wall.rotation.y=rot;out.push(wall);
    for(const o of [-.25,.25]){const m=new THREE.Mesh(merlonGeometry,mat);m.position.set(x+ax*o,c.y+.745,z+az*o);m.rotation.y=rot;out.push(m);}
  }
  return out;
}

// The home: a round keep with battlements, a slate cone roof and a flag, its door lit from inside.
function keep(P,{light,spin}){
  const g=new THREE.Group(),stone=col(P.faces[2]).lerp(col(P.faces[0]),.25);
  const body=new THREE.Mesh(painted(new THREE.CylinderGeometry(.36,.4,.95,40),stone,{lo:.7}),PAINT);body.position.y=.475;g.add(body);
  for(let i=0;i<8;i++){const a=i*Math.PI/4,m=new THREE.Mesh(painted(softBox(.14,.14,.12),stone,{lo:.7}),PAINT);m.position.set(Math.sin(a)*.36,1.0,Math.cos(a)*.36);m.rotation.y=a;g.add(m);}
  const roof=new THREE.Mesh(painted(new THREE.ConeGeometry(.42,.62,48),col(SLATE),{lo:.68}),PAINT);roof.position.y=1.33;g.add(roof);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.42,6),new THREE.MeshBasicMaterial({color:IRON}));pole.position.y=1.8;g.add(pole);
  const flag=pennant(.3,.16,BANNER);flag.position.set(0,1.94,0);g.add(flag);
  // The doorway: an arch on the front, glowing.
  const s=new THREE.Shape();s.moveTo(-.16,0);s.lineTo(-.16,.36);s.absarc(0,.36,.16,Math.PI,0,true);s.lineTo(.16,0);s.closePath();
  light.geometry=new THREE.ShapeGeometry(s,12);light.position.set(0,.02,.385);g.add(light);
  spin.position.y=2.2;g.add(spin);
  g.userData.flags=[flag];
  return g;
}
// A pennant on a pole: a strip of cloth that waves (wave(t) moves its vertices).
function pennant(w,h,color){
  const geo=new THREE.PlaneGeometry(w,h,8,1).translate(w/2,0,0),m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));
  const base=geo.attributes.position.array.slice();
  m.userData.wave=(t,phase=0)=>{const p=geo.attributes.position;for(let i=0;i<p.count;i++){const x=base[i*3],k=x/w;p.setZ(i,Math.sin(t*4+phase-x*9)*.05*k);p.setY(i,base[i*3+1]*(1-k*.45));}p.needsUpdate=true;};
  return m;
}


// ---------- The beach ----------
// Beach huts on stilts over the sea: clapboard walls in four paints (one per column), plank decks, rope
// along the walkways, life rings on the walls and gulls overhead.
// Clapboard: horizontal boards, each with a shadow under its lip, painted (the colour comes per hut).
const clapboard=canvasTexture(128,128,(g,n)=>{
  g.fillStyle='#ffffff';g.fillRect(0,0,n,n);
  for(let y=10;y<n;y+=16){g.fillStyle='rgba(60,70,90,.16)';g.fillRect(0,y+12,n,3);g.fillStyle='rgba(255,255,255,.6)';g.fillRect(0,y,n,2);}
  g.fillStyle='rgba(255,255,255,.7)';g.fillRect(0,0,n,8);g.fillStyle='rgba(60,70,90,.12)';g.fillRect(0,8,n,2);
});
// A deck of planks on top, with a pale edge.
const deck=canvasTexture(128,128,(g,n)=>{
  g.fillStyle='#ffffff';g.fillRect(0,0,n,n);
  g.strokeStyle='rgba(110,80,50,.22)';g.lineWidth=2;for(let x=0;x<=n;x+=21.3){g.beginPath();g.moveTo(x,0);g.lineTo(x,n);g.stroke();}
  g.fillStyle='rgba(110,80,50,.06)';for(let x=0;x<n;x+=42.6)g.fillRect(x+2,0,17,n);
  g.fillStyle='rgba(110,80,50,.3)';for(let x=10;x<n;x+=21.3)for(const y of [14,n-14]){g.beginPath();g.arc(x,y,1.6,0,Math.PI*2);g.fill();}
  g.strokeStyle='rgba(255,255,255,.85)';g.lineWidth=3;g.strokeRect(3,3,n-6,n-6);
});
// The six face colours of a painted hut, from its paint (sides shaded, the deck the same for every hut).
const hutFaces=paint=>{const c=col(paint),k=f=>c.clone().multiplyScalar(f).getHex();return [k(1),k(.9),0xf2dfc4,k(.5),k(.96),k(.84)];};
const ROPE=0xe8d3a8,DRIFT=0xc9a77c,STRIPE=0x5bb8c9,CORAL=0xee7f6b,LEAF=0x6fae6a,BARK=0xa98563;
// A round porthole window with a pale frame.
const porthole=canvasTexture(128,128,g=>{
  g.fillStyle='rgba(255,255,255,.45)';g.beginPath();g.arc(64,62,25,0,Math.PI*2);g.fill();
  g.fillStyle='#fff';g.beginPath();g.arc(64,62,18,0,Math.PI*2);g.fill();
});
// A life ring: red and white quarters.
const lifeRing=canvasTexture(64,64,(g,w)=>{
  const c=w/2;
  for(let i=0;i<4;i++){g.fillStyle=i%2?'#ffffff':'#e8604f';g.beginPath();g.arc(c,c,28,i*Math.PI/2,(i+1)*Math.PI/2);g.arc(c,c,16,(i+1)*Math.PI/2,i*Math.PI/2,true);g.closePath();g.fill();}
  g.strokeStyle='rgba(90,60,50,.35)';g.lineWidth=1.5;g.beginPath();g.arc(c,c,28,0,Math.PI*2);g.stroke();g.beginPath();g.arc(c,c,16,0,Math.PI*2);g.stroke();
});
const lifeRingMaterial=new THREE.MeshBasicMaterial({map:lifeRing,transparent:true,alphaTest:.5,side:THREE.DoubleSide});
const lifeRingGeometry=new THREE.PlaneGeometry(.36,.36).translate(0,.06,0);
// Boardwalk rope: a short post at each corner of the tile and a rope between them along each side.
const postGeometry=painted(new THREE.CylinderGeometry(.035,.04,.34,6),col(DRIFT),{lo:.7}),ropeGeometry=painted(new THREE.CylinderGeometry(.014,.014,1,5).rotateZ(Math.PI/2),col(ROPE),{lo:.8});
function boardwalk(c){
  const out=[],[ax,az]=c.s;
  for(const side of [-1,1]){
    const x=c.x+az*side*.42,z=c.z+ax*side*.42;
    for(const e of [-.42,.42]){const p=new THREE.Mesh(postGeometry,PAINT);p.position.set(x+ax*e,c.y+.67,z+az*e);out.push(p);}
    const rope=new THREE.Mesh(ropeGeometry,PAINT);rope.position.set(x,c.y+.78,z);rope.rotation.y=ax?0:Math.PI/2;out.push(rope);
  }
  return out;
}
// A beach hut: striped walls, a pitched roof, and a lit doorway (the home at the goal).
const hutStripes=canvasTexture(64,64,(g,w,h)=>{g.fillStyle='#ffffff';g.fillRect(0,0,w,h);g.fillStyle='#5bb8c9';for(let x=0;x<w;x+=16)g.fillRect(x,0,8,h);});
function hut(P,{light,spin}){
  const g=new THREE.Group();
  const body=new THREE.Mesh(softBox(.62,.62,.56),surfaceMaterial('wood',{map:hutStripes,roughness:.64}));body.position.y=.31;g.add(body);
  const roofShape=new THREE.Shape();roofShape.moveTo(-.4,0);roofShape.lineTo(0,.3);roofShape.lineTo(.4,0);roofShape.closePath();
  const roof=new THREE.Mesh(painted(new THREE.ExtrudeGeometry(roofShape,{depth:.66,bevelEnabled:false}).translate(0,0,-.33),col(CORAL),{lo:.7}),PAINT);roof.position.y=.62;g.add(roof);
  const step=new THREE.Mesh(painted(softBox(.4,.05,.14),col(DRIFT)),PAINT);step.position.set(0,.025,.33);g.add(step);
  const s=new THREE.Shape();s.moveTo(-.12,0);s.lineTo(-.12,.4);s.lineTo(.12,.4);s.lineTo(.12,0);s.closePath();
  light.geometry=new THREE.ShapeGeometry(s);light.position.set(0,.06,.285);g.add(light);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.01,.01,.36,6),new THREE.MeshBasicMaterial({color:0x6a5a52}));pole.position.y=1.08;g.add(pole);
  const flag=pennant(.24,.13,CORAL);flag.position.y=1.2;g.add(flag);
  spin.position.y=1.5;g.add(spin);
  g.userData.flags=[flag];return g;
}
function palm(fog,k,h=.9,lean=.25){
  const g=new THREE.Group(),n=5;let x=0,y=0;
  for(let i=0;i<n;i++){const seg=new THREE.Mesh(painted(new THREE.CylinderGeometry(.045-i*.004,.055-i*.004,h/n,6),col(BARK),{fade:fog,k,lo:.65}),PAINT);const t=(i+.5)/n;seg.position.set(lean*t*t,h*t,0);seg.rotation.z=-lean*t*1.2;g.add(seg);x=lean;y=h;}
  for(let i=0;i<6;i++){const a=i*Math.PI/3+.3,leaf=new THREE.Mesh(painted(new THREE.ConeGeometry(.07,.55,4).rotateZ(-Math.PI/2).translate(.27,0,0).scale(1,.25,1),col(LEAF),{fade:fog,k,lo:.6}),PAINT);leaf.position.set(x,y,0);leaf.rotation.set(0,a,-.35);g.add(leaf);}
  return g;
}

// ---------- Kyoto ----------
// A misty spring morning: shrine-red lacquer under white plaster on dark pillars, grey paving on top, red
// torii gates over the walkways (like the paths at Fushimi Inari), paper windows, red lanterns, cherry
// petals falling and a pagoda at the goal.
const VERMILION=0xe0553d,TORII_BLACK=0x3a3036,BLOSSOM=0xf6c2cf,MOSS=0x9cbf86,PAPER=0xfff4dc,ROOF=0x4a4a5c;
const paving=canvasTexture(128,128,(g,n)=>{
  g.fillStyle='#ffffff';g.fillRect(0,0,n,n);
  g.strokeStyle='rgba(80,80,100,.2)';g.lineWidth=2.5;
  for(const [x,y,w,h] of [[6,6,58,58],[64,6,58,58],[6,64,58,58],[64,64,58,58]]){g.beginPath();g.roundRect(x,y,w,h,3);g.stroke();}
  g.fillStyle='rgba(80,80,100,.05)';g.fillRect(64,6,58,58);g.fillRect(6,64,58,58);
});
// Shrine lacquer: vermilion with a fine grain, a band of white plaster under the top edge, and a black
// lacquered foot. Painted in its own colours (the faces only shade it).
const shrine=canvasTexture(128,128,(g,n)=>{
  g.fillStyle='#ffffff';g.fillRect(0,0,n,30);
  g.fillStyle='#d9503a';g.fillRect(0,30,n,86);
  g.fillStyle='rgba(120,20,10,.12)';for(let x=3;x<n;x+=9)g.fillRect(x,30,2,86);
  g.fillStyle='rgba(255,220,200,.18)';g.fillRect(0,32,n,3);
  g.fillStyle='#2e2528';g.fillRect(0,26,n,4);g.fillRect(0,116,n,12);
  g.fillStyle='rgba(255,255,255,.75)';g.fillRect(0,0,n,8);
});
// A paper window: a lattice of little squares.
const shoji=canvasTexture(128,128,g=>{
  g.fillStyle='rgba(255,255,255,.4)';g.fillRect(38,30,52,58);
  g.fillStyle='#fff';g.fillRect(42,34,44,50);
  g.fillStyle='rgba(0,0,0,0)';g.clearRect(42+14,34,2,50);g.clearRect(42+28,34,2,50);g.clearRect(42,34+16,44,2);g.clearRect(42,34+32,44,2);
});
// A red paper lantern hanging on the wall.
const lanternTex=canvasTexture(64,128,(g,w,h)=>{
  g.fillStyle='#3a3036';g.fillRect(w/2-1,0,2,22);g.fillRect(w/2-12,20,24,6);g.fillRect(w/2-12,h-34,24,6);
  g.fillStyle='#e0553d';g.beginPath();g.ellipse(w/2,(26+h-34)/2,22,(h-60)/2,0,0,Math.PI*2);g.fill();
  g.strokeStyle='rgba(120,30,20,.35)';g.lineWidth=1.5;for(let y=36;y<h-40;y+=10){g.beginPath();g.moveTo(w/2-20,y);g.lineTo(w/2+20,y);g.stroke();}
  g.fillStyle='rgba(255,230,200,.35)';g.beginPath();g.ellipse(w/2-6,(26+h-34)/2-6,6,16,0,0,Math.PI*2);g.fill();
});
const kyotoLanternMaterial=new THREE.MeshBasicMaterial({map:lanternTex,transparent:true,alphaTest:.5,side:THREE.DoubleSide});
const kyotoLanternGeometry=new THREE.PlaneGeometry(.22,.44);
// A torii over a walkway tile: two red posts, a black top beam with upturned ends, and a tie beam below.
// The posts stand at the tile's closed sides, so they never stand in the walkway. On every other tile
// (a row of gates), and not where a block sits two above (the gate would cut into it).
const toriiPost=new THREE.CylinderGeometry(.045,.055,1.05,24),toriiTop=(()=>{
  const s=new THREE.Shape();s.moveTo(-.58,0);s.quadraticCurveTo(0,-.065,.58,0);s.lineTo(.6,.09);s.quadraticCurveTo(0,.025,-.6,.09);s.closePath();
  return new THREE.ExtrudeGeometry(s,{depth:.12,bevelEnabled:true,bevelSize:.008,bevelThickness:.008,bevelSegments:2,steps:1}).translate(0,0,-.06);
})(),toriiTie=softBox(.98,.055,.07);
const coveredGateRoof=curvedRoof(1.12,.13);coveredGateRoof.userData.artShared=true;
const coveredGateCap=softBox(.32,.025,.32);coveredGateCap.userData.artShared=true;
function torii(c,mat,around){
  const out=[],[ax,az]=c.s,rot=ax?Math.PI/2:0;
  if(!c.gate&&((c.x+c.z)%2+2)%2||around?.has(`${c.x},${c.y+2},${c.z}`))return out;
  if(c.gate){
    // A shallow roof on four posts reads as a gate from the final side-on photograph too.
    for(const side of [-1,1])for(const end of [-1,1]){
      const post=new THREE.Mesh(toriiPost,kyotoLacquer);post.position.set(c.x+az*side*.44+ax*end*.33,c.y+1.02,c.z+ax*side*.44+az*end*.33);out.push(post);
    }
    for(const side of [-1,1]){const tie=new THREE.Mesh(toriiTie,kyotoLacquer);tie.position.set(c.x+ax*side*.33,c.y+1.44,c.z+az*side*.33);tie.rotation.y=rot;out.push(tie);}
    const roof=new THREE.Mesh(coveredGateRoof,kyotoRoof);roof.position.set(c.x,c.y+1.55,c.z);out.push(roof);
    const cap=new THREE.Mesh(coveredGateCap,kyotoRoof);cap.position.set(c.x,c.y+1.675,c.z);out.push(cap);return out;
  }
  for(const side of [-1,1]){const p=new THREE.Mesh(toriiPost,kyotoLacquer);p.position.set(c.x+az*side*.44,c.y+1.02,c.z+ax*side*.44);p.castShadow=true;out.push(p);}
  const top=new THREE.Mesh(toriiTop,kyotoRoof);top.position.set(c.x,c.y+1.56,c.z);top.rotation.y=rot;top.castShadow=true;out.push(top);
  const tie=new THREE.Mesh(toriiTie,kyotoLacquer);tie.position.set(c.x,c.y+1.38,c.z);tie.rotation.y=rot;out.push(tie);
  const plate=new THREE.Mesh(softBox(.09,.13,.02),kyotoBrass);plate.position.set(c.x+ax*.045,c.y+1.4,c.z+az*.045);plate.rotation.y=rot;out.push(plate);
  return out;
}
const kyotoHome=(P,parts)=>createKyotoHome(parts);

// A soft round glow, for lamps and lights.
const glowDot=canvasTexture(64,64,(g,n)=>{const r=g.createRadialGradient(n/2,n/2,0,n/2,n/2,n/2);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.3,'rgba(255,255,255,.6)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,n,n);});
const glow=(color,size)=>{const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowDot,color,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));s.scale.setScalar(size);return s;};
// A low wall along a walkway's closed sides (just inside the block's own wall, exactly a tile long).
const kerbGeometry=softBox(1,.12,.12);
const kerb=(c,mat)=>{const out=[],[ax,az]=c.s;for(const side of [-1,1]){const k=new THREE.Mesh(kerbGeometry,mat);k.position.set(c.x+az*side*.43,c.y+.56,c.z+ax*side*.43);k.rotation.y=ax?0:Math.PI/2;out.push(k);}return out;};

// ---------- The desert ----------
// Rose sandstone carved like Petra: layered walls with dark doorways cut into them, sand on top, low
// walls along the walkways, woven rugs hung out, a white domed house at the goal, pyramids, obelisks
// and dust in the air.
const SAND=0xe9c98f,PALM_POOL=0x5fb8c4;
const layered=canvasTexture(128,128,(g,n)=>{
  const grad=g.createLinearGradient(0,0,0,n);grad.addColorStop(0,'#ffffff');grad.addColorStop(1,'#d6c2b2');g.fillStyle=grad;g.fillRect(0,0,n,n);
  for(const [y,h,a] of [[16,9,.08],[36,14,-.07],[60,7,.07],[76,16,-.08],[100,9,.06],[114,10,-.05]]){
    g.fillStyle=a>0?`rgba(255,255,255,${a})`:`rgba(140,60,30,${-a})`;g.beginPath();g.moveTo(0,y);
    for(let x=0;x<=n;x+=16)g.lineTo(x,y+Math.sin(x*.07+y)*2);for(let x=n;x>=0;x-=16)g.lineTo(x,y+h+Math.sin(x*.05+y)*2);g.fill();
  }
  g.fillStyle='rgba(255,255,255,.55)';g.fillRect(0,0,n,8);
});
const dunesTop=canvasTexture(128,128,(g,n)=>{
  g.fillStyle='#ffffff';g.fillRect(0,0,n,n);
  let seed=11;const r=()=>(seed=(seed*16807)%2147483647)/2147483647;
  for(let i=0;i<220;i++){g.fillStyle=r()<.5?'rgba(160,100,50,.14)':'rgba(255,255,255,.7)';g.fillRect(r()*n,r()*n,1.6,1.6);}
  g.strokeStyle='rgba(170,110,60,.16)';g.lineWidth=2.5;
  for(const y of [30,60,92]){g.beginPath();g.moveTo(6,y);g.bezierCurveTo(40,y-10,80,y+10,122,y-3);g.stroke();}
  g.strokeStyle='rgba(255,255,255,.8)';g.lineWidth=2;g.beginPath();g.roundRect(5,5,n-10,n-10,8);g.stroke();
});
// A doorway cut into the rock: a round-topped opening in a stepped frame.
const doorway=canvasTexture(128,128,g=>{
  g.fillStyle='rgba(255,255,255,.35)';g.beginPath();g.moveTo(40,112);g.lineTo(40,50);g.arc(64,50,24,Math.PI,0);g.lineTo(88,112);g.closePath();g.fill();
  g.fillStyle='#fff';g.beginPath();g.moveTo(47,112);g.lineTo(47,52);g.arc(64,52,17,Math.PI,0);g.lineTo(81,112);g.closePath();g.fill();
});
const rugTexture=canvasTexture(64,128,(g,w,h)=>{
  for(const [y,c] of [[0,'#b8443a'],[16,'#e9b04a'],[24,'#b8443a'],[52,'#2f4f7a'],[60,'#b8443a'],[92,'#e9b04a'],[100,'#b8443a']]){g.fillStyle=c;g.fillRect(4,y,w-8,h);}
  g.fillStyle='#f3e2c0';for(let x=10;x<w-8;x+=10){g.beginPath();g.moveTo(x,34);g.lineTo(x+5,40);g.lineTo(x,46);g.lineTo(x-5,40);g.fill();}
  g.fillStyle='#e9b04a';for(let x=6;x<w-4;x+=5)g.fillRect(x,h-6,2,6);
});
const rugMaterial=new THREE.MeshBasicMaterial({map:rugTexture,transparent:true,alphaTest:.5,side:THREE.DoubleSide}),rugGeometry=new THREE.PlaneGeometry(.32,.62);
function domeHouse(P,{light,spin}){
  const g=new THREE.Group(),white=col(0xf6ecdc);
  const body=new THREE.Mesh(painted(softBox(.6,.5,.6),white,{lo:.72}),PAINT);body.position.y=.25;g.add(body);
  const drum=new THREE.Mesh(painted(new THREE.CylinderGeometry(.25,.27,.1,48),white,{lo:.72}),PAINT);drum.position.y=.55;g.add(drum);
  const dome=new THREE.Mesh(painted(new THREE.SphereGeometry(.26,48,32,0,Math.PI*2,0,Math.PI/2),col(0x7fb8c8),{lo:.7}),PAINT);dome.position.y=.6;g.add(dome);
  const tip=new THREE.Mesh(painted(new THREE.ConeGeometry(.03,.16,32),col(GOLD)),PAINT);tip.position.y=.94;g.add(tip);
  const s=new THREE.Shape();s.moveTo(-.11,0);s.lineTo(-.11,.24);s.absarc(0,.24,.11,Math.PI,0,true);s.lineTo(.11,0);s.closePath();
  light.geometry=new THREE.ShapeGeometry(s,10);light.position.set(0,.01,.302);g.add(light);
  const p=palm(null,0,.9,.2);p.position.set(.36,0,-.3);g.add(p);
  spin.position.y=1.3;g.add(spin);
  return g;
}

// ---------- Venice ----------
// Evening on the canals: stucco houses in four warm colours (one per column) with brick showing through,
// herringbone brick underfoot, pointed windows nearly all lit, flower boxes, iron railings with lamps
// along the walkways and a bell tower at the goal.
const herringbone=canvasTexture(128,128,(g,n)=>{
  g.fillStyle='#ffffff';g.fillRect(0,0,n,n);g.strokeStyle='rgba(90,40,30,.28)';g.lineWidth=1.6;
  for(let y=-n;y<n*2;y+=16)for(let x=0;x<n;x+=16){g.beginPath();g.moveTo(x,y+x%32);g.lineTo(x+16,y+16+x%32);g.stroke();g.beginPath();g.moveTo(x+16,y+x%32);g.lineTo(x+16,y+16+x%32);g.stroke();}
  g.strokeStyle='rgba(255,255,255,.75)';g.lineWidth=3;g.strokeRect(3,3,n-6,n-6);
});
const stucco=canvasTexture(128,128,(g,n)=>{
  g.fillStyle='#ffffff';g.fillRect(0,0,n,n);
  let seed=5;const r=()=>(seed=(seed*16807)%2147483647)/2147483647;
  for(let i=0;i<30;i++){g.fillStyle=`rgba(${r()<.5?'255,255,255':'90,50,40'},.05)`;g.beginPath();g.arc(r()*n,r()*n,6+r()*14,0,Math.PI*2);g.fill();}
  // bricks showing where the plaster has fallen away
  for(const [x0,y0] of [[14,70],[86,40]]){g.fillStyle='rgba(150,60,45,.35)';for(let j=0;j<3;j++)for(let i=0;i<3-j%2;i++)g.fillRect(x0+i*10+(j%2)*5,y0+j*6,8,4);}
  g.fillStyle='rgba(255,255,255,.7)';g.fillRect(0,0,n,8);g.fillStyle='rgba(80,40,40,.18)';g.fillRect(0,12,n,4);
  g.fillStyle='rgba(40,50,70,.22)';g.fillRect(0,n-16,n,16);
});
const gothic=canvasTexture(128,128,g=>{
  g.fillStyle='#fff';g.beginPath();g.moveTo(48,96);g.lineTo(48,52);g.quadraticCurveTo(48,36,64,26);g.quadraticCurveTo(80,36,80,52);g.lineTo(80,96);g.closePath();g.fill();
  g.fillStyle='rgba(255,255,255,.5)';g.fillRect(42,96,44,5);for(let x=44;x<86;x+=6)g.fillRect(x,100,2,8);g.fillRect(42,106,44,3);
});
const flowerTexture=canvasTexture(64,32,(g,w,h)=>{
  g.fillStyle='#6a4a3a';g.fillRect(4,18,w-8,12);
  g.fillStyle='#4f7a4a';for(let x=6;x<w-6;x+=5){g.beginPath();g.arc(x,17,4,0,Math.PI*2);g.fill();}
  for(let x=8;x<w-8;x+=7){g.fillStyle=x%14?'#e8576a':'#f4a3b4';g.beginPath();g.arc(x,13+(x%3),3,0,Math.PI*2);g.fill();}
});
const flowerMaterial=new THREE.MeshBasicMaterial({map:flowerTexture,transparent:true,alphaTest:.5,side:THREE.DoubleSide}),flowerGeometry=new THREE.PlaneGeometry(.5,.25).translate(0,-.28,0);
const stuccoFaces=paint=>{const c=col(paint),k=f=>c.clone().multiplyScalar(f).getHex();return [k(1),k(.88),0xc98f7c,k(.45),k(.95),k(.82)];};
const WROUGHT=0x2c2733,LAMP=0xffcf7a;
const ironRail=painted(softBox(1,.03,.03),col(WROUGHT)),baluster=painted(softBox(.025,.3,.025),col(WROUGHT)),lampPost=painted(new THREE.CylinderGeometry(.025,.035,.75,6),col(WROUGHT)),lampHead=new THREE.MeshBasicMaterial({color:0xfff0c0});
function canalRail(c){
  const out=[],[ax,az]=c.s;
  for(const side of [-1,1]){
    const x=c.x+az*side*.44,z=c.z+ax*side*.44;
    const rail=new THREE.Mesh(ironRail,PAINT);rail.position.set(x,c.y+.82,z);rail.rotation.y=ax?0:Math.PI/2;out.push(rail);
    for(const e of [-.33,0,.33]){const b=new THREE.Mesh(baluster,PAINT);b.position.set(x+ax*e,c.y+.66,z+az*e);out.push(b);}
  }
  // A street lamp on every other tile, lit.
  if(((c.x+c.z)%2+2)%2===0){
    const x=c.x+az*.44,z=c.z+ax*.44,p=new THREE.Mesh(lampPost,PAINT);p.position.set(x,c.y+.88,z);out.push(p);
    const head=new THREE.Mesh(softBox(.09,.12,.09),lampHead);head.position.set(x,c.y+1.31,z);out.push(head);
    const g=glow(LAMP,.9);g.position.set(x,c.y+1.31,z);out.push(g);
  }
  return out;
}
function campanile(P,{light,spin},fog=null,k=0,s=1){
  const g=new THREE.Group(),brick=col(0xb5604a),stone=col(0xf0e2cc),f=c=>fog?c.clone().lerp(fog,k):c;
  const body=new THREE.Mesh(painted(softBox(.34*s,1.2*s,.34*s),f(brick),{lo:.7}),PAINT);body.position.y=.6*s;g.add(body);
  const belfry=new THREE.Mesh(painted(softBox(.4*s,.28*s,.4*s),f(stone),{lo:.72}),PAINT);belfry.position.y=1.34*s;g.add(belfry);
  for(const [x,z,r] of [[0,.201,0],[0,-.201,0],[.201,0,Math.PI/2],[-.201,0,Math.PI/2]]){const o=new THREE.Mesh(new THREE.PlaneGeometry(.18*s,.18*s),new THREE.MeshBasicMaterial({color:P.dark?0xffd98a:0x5a4a5a,side:THREE.DoubleSide}));o.position.set(x*s,1.34*s,z*s);o.rotation.y=r;g.add(o);}
  const roof=new THREE.Mesh(painted(new THREE.ConeGeometry(.3*s,.42*s,4).rotateY(Math.PI/4),f(col(0x7fa596)),{lo:.7}),PAINT);roof.position.y=1.69*s;g.add(roof);
  const angel=new THREE.Mesh(painted(new THREE.OctahedronGeometry(.05*s),col(GOLD)),PAINT);angel.position.y=1.95*s;g.add(angel);
  if(light){const sh=new THREE.Shape();sh.moveTo(-.07,0);sh.lineTo(-.07,.2);sh.absarc(0,.2,.07,Math.PI,0,true);sh.lineTo(.07,0);sh.closePath();light.geometry=new THREE.ShapeGeometry(sh,8);light.position.set(0,.01,.172);g.add(light);}
  if(spin){spin.position.y=2.2;g.add(spin);}
  if(P.dark&&!fog){const l=glow(LAMP,.8);l.position.y=1.34*s;g.add(l);}
  return g;
}
const veniceHome=(P,parts)=>campanile(P,parts);

// ---------- The stars ----------
// An observatory among the stars: pale ivory with gold bands and stars, round windows all lit,
// moon lanterns, a thin gold rail with small crystal lamps and an observatory dome at the goal.
// Ivory: warm and pale, a thin gold band under the top and a few small gold stars.
const starStone=canvasTexture(128,128,(g,n)=>{
  const grad=g.createLinearGradient(0,0,0,n);grad.addColorStop(0,'#fffaf0');grad.addColorStop(1,'#e2d4b6');g.fillStyle=grad;g.fillRect(0,0,n,n);
  g.fillStyle='rgba(255,255,255,.7)';g.fillRect(0,0,n,8);g.fillStyle='#e2bd62';g.fillRect(0,10,n,3);
  const star=(x,y,r)=>{g.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,l=i%2?r*.35:r;g.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);}g.closePath();g.fill();};
  g.fillStyle='#e2bd62';star(34,56,7);star(92,88,5);g.fillStyle='rgba(226,189,98,.6)';star(70,40,3);star(20,100,3);star(104,50,2.5);
});
const starTile=canvasTexture(128,128,(g,n)=>{
  const glow=g.createRadialGradient(n/2,n/2,n*.1,n/2,n/2,n*.75);glow.addColorStop(0,'#fffdf6');glow.addColorStop(1,'#eee4cc');g.fillStyle=glow;g.fillRect(0,0,n,n);
  g.strokeStyle='rgba(214,176,90,.55)';g.lineWidth=2;g.beginPath();g.arc(n/2,n/2,36,0,Math.PI*2);g.stroke();
  g.fillStyle='rgba(214,176,90,.6)';for(let i=0;i<4;i++){const a=i*Math.PI/2;g.beginPath();g.moveTo(n/2+Math.cos(a)*46,n/2+Math.sin(a)*46);g.lineTo(n/2+Math.cos(a+.2)*16,n/2+Math.sin(a+.2)*16);g.lineTo(n/2+Math.cos(a-.2)*16,n/2+Math.sin(a-.2)*16);g.fill();}
  g.strokeStyle='rgba(255,255,255,.9)';g.lineWidth=2;g.beginPath();g.roundRect(5,5,n-10,n-10,6);g.stroke();
});
const roundWindow=canvasTexture(128,128,g=>{g.fillStyle='rgba(255,255,255,.45)';g.beginPath();g.arc(64,60,24,0,Math.PI*2);g.fill();g.fillStyle='#fff';g.beginPath();g.arc(64,60,18,0,Math.PI*2);g.fill();});
const moonTexture=canvasTexture(64,128,(g,w,h)=>{
  g.fillStyle='#d9b45a';g.fillRect(w/2-1,0,2,40);
  g.fillStyle='#fff3c4';g.beginPath();g.arc(w/2,72,22,0,Math.PI*2);g.fill();
  g.globalCompositeOperation='destination-out';g.beginPath();g.arc(w/2+11,66,19,0,Math.PI*2);g.fill();
  g.globalCompositeOperation='source-over';g.fillStyle='#fff3c4';g.beginPath();g.arc(w/2+8,100,3,0,Math.PI*2);g.fill();
});
const moonMaterial=new THREE.MeshBasicMaterial({map:moonTexture,transparent:true,alphaTest:.4,side:THREE.DoubleSide}),moonGeometry=new THREE.PlaneGeometry(.26,.52);
const goldRail=painted(softBox(1,.025,.025),col(0xe9c46a)),goldPost=painted(new THREE.CylinderGeometry(.015,.015,.28,6),col(0xe9c46a));
const starLamp=painted(new THREE.OctahedronGeometry(.055),col(0xffe7b4));
function starRail(c){
  const out=[],[ax,az]=c.s;
  for(const side of [-1,1]){
    const x=c.x+az*side*.44,z=c.z+ax*side*.44;
    const rail=new THREE.Mesh(goldRail,PAINT);rail.position.set(x,c.y+.78,z);rail.rotation.y=ax?0:Math.PI/2;out.push(rail);
    const p=new THREE.Mesh(goldPost,PAINT);p.position.set(x,c.y+.64,z);out.push(p);
    if(((c.x+c.z)%2+2)%2===0){
      const lamp=new THREE.Mesh(starLamp,PAINT);lamp.position.set(x,c.y+.82,z);lamp.scale.y=1.25;out.push(lamp);
      const halo=glow(0xffe8bb,.22);halo.material.opacity=.35;halo.position.copy(lamp.position);out.push(halo);
    }
  }
  return out;
}
function observatory(P,{light,spin}){
  const g=new THREE.Group();
  const body=new THREE.Mesh(painted(new THREE.CylinderGeometry(.32,.34,.5,48),col(0xe6e8ff),{lo:.7}),PAINT);body.position.y=.25;g.add(body);
  const dome=new THREE.Mesh(painted(new THREE.SphereGeometry(.33,48,32,0,Math.PI*2,0,Math.PI/2),col(0xd9b45a),{lo:.68}),PAINT);dome.position.y=.5;g.add(dome);
  const slit=new THREE.Mesh(softBox(.09,.36,.05),new THREE.MeshBasicMaterial({color:0x1a1d3a}));slit.position.set(0,.66,.2);slit.rotation.x=-.75;g.add(slit);
  const scope=new THREE.Mesh(painted(new THREE.CylinderGeometry(.035,.05,.42,48),col(0x3a3f6a)),PAINT);scope.position.set(0,.86,.2);scope.rotation.x=.75;g.add(scope);
  const s=new THREE.Shape();s.moveTo(-.09,0);s.lineTo(-.09,.2);s.absarc(0,.2,.09,Math.PI,0,true);s.lineTo(.09,0);s.closePath();
  light.geometry=new THREE.ShapeGeometry(s,8);light.position.set(0,.01,.341);g.add(light);
  spin.position.y=1.4;g.add(spin);
  return g;
}

export const THEMES={
  castle:{
    name:'Castle',
    faces:[0xd7c9b4,0xc2b29b,0xf3ebde,0x6a5a52,0xb9a78f,0xa8957f],edge:0x5e4b45,rail:0xcbbca6,
    top:flags,side:ashlar,
    window:{map:slit,color:0x4a3d48,every:.14},banner:{material:bannerMaterial,geometry:bannerGeometry,every:.08},
    walkway:battlements,home:keep,
    colors:{slate:SLATE,banner:BANNER,gold:GOLD,iron:IRON,wood:WOOD}
  },
  beach:{
    name:'Beach',
    faces:hutFaces(0xa8e0cf),edge:0x5d6f86,ground:0xf3dfb4,
    variants:[0xa8e0cf,0xf5a99a,0xf7dc8f,0x9fcdea].map(hutFaces),
    top:deck,side:clapboard,birds:0xffffff,
    window:{map:porthole,color:0x4f8fa6,every:.12},banner:{material:lifeRingMaterial,geometry:lifeRingGeometry,every:.07},
    walkway:boardwalk,home:hut
  },
  kyoto:{
    name:'Kyoto',
    faces:[0xffffff,0xe6e2e2,0xc9c7cc,0x3f3438,0xf6f3f3,0xdcd8d8],edge:0x3a2a2a,ground:MOSS,
    top:paving,side:shrine,air:'petals',birds:0x3a3036,
    window:{map:shoji,color:PAPER,every:.14},banner:{material:kyotoLanternMaterial,geometry:kyotoLanternGeometry,every:.07},
    walkway:torii,walkwayDecoration:true,home:kyotoHome
  },
  desert:{
    name:'Desert',
    faces:[0xeab48a,0xd89c72,0xf6dfb6,0x7a4a32,0xe2aa80,0xcc9268],edge:0x6e3f2c,ground:SAND,
    top:dunesTop,side:layered,
    window:{map:doorway,color:0x5a3428,every:.16},banner:{material:rugMaterial,geometry:rugGeometry,every:.07},
    walkway:kerb,home:domeHouse,mote:0xf6dcae
  },
  venice:{
    name:'Venice',
    faces:stuccoFaces(0xd98a6e),edge:0x3a2430,ground:0x8a7a8e,
    variants:[0xd98a6e,0xdcb066,0xd99a9a,0xe6d2b4].map(stuccoFaces),
    top:herringbone,side:stucco,
    window:{map:gothic,color:0x3a2a3a,every:.4,lit:.36},banner:{material:flowerMaterial,geometry:flowerGeometry,every:.06},
    walkway:canalRail,home:veniceHome
  },
  stars:{
    name:'The stars',
    faces:[0xffffff,0xe6dfd0,0xffffff,0x3a3040,0xf6f2ea,0xd8d0c0],edge:0x4a3e3a,ground:0x3d4380,
    top:starTile,side:starStone,
    window:{map:roundWindow,color:0x22264a,every:.22,lit:.22},banner:{material:moonMaterial,geometry:moonGeometry,every:.07},
    walkway:starRail,home:observatory,mote:0xcfe0ff
  }
};
// For the places in illusion-themes-more.js.
export {canvasTexture,col,glow,pennant};
// Waves every flag in a group (call each frame).
export function waveFlags(flags,t){flags.forEach((f,i)=>f.userData.wave?.(t,i*1.7));}
