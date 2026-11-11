// More places for the trip (see illusion-themes.js for how a theme works): Santorini, Lantern night,
// the snowy mountains, the ice palace, the glow forest, the cloud kingdom and space. As everywhere, only
// looks: beams, shy stones and plates are never themed.
import * as THREE from './vendor/three.module.js';
import {softBox,surfaceMaterial,litGeometry,decorMaterial} from './illusion-art.js';
import {painted,PAINT,canvasTexture,col,glow} from './illusion-themes.js';
import {curvedRoof} from './illusion-kyoto.js';

// The six face colours of a block from its paint (sides shaded; the top its own colour).
const facesOf=(paint,top=0xffffff)=>{const c=col(paint),k=f=>c.clone().multiplyScalar(f).getHex();return [k(1),k(.9),top,k(.5),k(.96),k(.84)];};
// A banner: a picture on a small plane hung on a wall.
const bannerOf=(map,w,h)=>({material:new THREE.MeshBasicMaterial({map,transparent:true,alphaTest:.4,side:THREE.DoubleSide}),geometry:new THREE.PlaneGeometry(w,h),every:.07});
// A walkway edge: a rail along each side, posts at the tile's ends, and something extra on some tiles.
function edging({rail,post,railAt=.8,postH=.3,extra=null}){
  return c=>{
    const out=[],[ax,az]=c.s;
    for(const side of [-1,1]){
      const x=c.x+az*side*.44,z=c.z+ax*side*.44;
      if(rail){const r=new THREE.Mesh(rail,PAINT);r.position.set(x,c.y+railAt,z);r.rotation.y=ax?0:Math.PI/2;out.push(r);}
      if(post)for(const e of [-.42,.42]){const p=new THREE.Mesh(post,PAINT);p.position.set(x+ax*e,c.y+.5+postH/2,z+az*e);out.push(p);}
      if(extra)out.push(...extra(c,x,z,side));
    }
    return out;
  };
}
const even=c=>((c.x+c.z)%2+2)%2===0;
// A door or window lit from inside (the goal light), arched.
function archLight(light,w,h,z,y=.01){const s=new THREE.Shape();s.moveTo(-w/2,0);s.lineTo(-w/2,h-w/2);s.absarc(0,h-w/2,w/2,Math.PI,0,true);s.lineTo(w/2,0);s.closePath();light.geometry=new THREE.ShapeGeometry(s,10);light.position.set(0,y,z);}

// ---------- Santorini ----------
// A whitewashed village on the cliffs: white walls (a few in soft ochre and peach), blue doors and
// shutters, flagstones with white joints, bougainvillea on the walls, low white parapets, a blue-domed
// chapel at the goal.
const whitewash=canvasTexture(128,128,(g,n)=>{
  const grad=g.createLinearGradient(0,0,0,n);grad.addColorStop(0,'#ffffff');grad.addColorStop(1,'#e6e9f0');g.fillStyle=grad;g.fillRect(0,0,n,n);
  // Soft brushed plaster.
  for(let i=0;i<40;i++){g.fillStyle=`rgba(${i%2?255:200},${i%2?255:205},${i%2?255:220},.12)`;g.beginPath();g.ellipse((i*37)%n,(i*53)%n,10+i%7*3,4+i%5,i,0,Math.PI*2);g.fill();}
  g.fillStyle='rgba(255,255,255,.8)';g.fillRect(0,0,n,7);g.fillStyle='rgba(120,130,160,.12)';g.fillRect(0,7,n,2);
});
const flagstones=canvasTexture(128,128,(g,n)=>{
  g.fillStyle='#e9e4da';g.fillRect(0,0,n,n);
  g.strokeStyle='#ffffff';g.lineWidth=3.5;g.lineJoin='round';
  // Irregular stones, outlined in whitewash.
  for(const p of [[[4,4],[50,6],[46,44],[8,40]],[[54,4],[124,8],[118,38],[50,44]],[[8,46],[44,48],[40,90],[4,86]],[[48,48],[86,42],[90,84],[44,92]],[[92,42],[124,42],[124,96],[94,88]],[[4,92],[40,94],[46,124],[4,124]],[[48,96],[92,90],[96,124],[50,124]],[[98,94],[124,100],[124,124],[100,124]]]){
    g.fillStyle=`rgba(200,190,175,${.15+(p[0][0]%3)*.06})`;g.beginPath();p.forEach(([x,y])=>g.lineTo(x,y));g.closePath();g.fill();g.stroke();
  }
});
const blueDoor=canvasTexture(128,128,g=>{
  g.fillStyle='#ffffff';g.beginPath();g.moveTo(42,118);g.lineTo(42,58);g.arc(64,58,22,Math.PI,0);g.lineTo(86,118);g.closePath();g.fill();
  g.fillStyle='rgba(255,255,255,.35)';g.fillRect(48,64,32,2);g.fillRect(63,40,2,78);
});
const bougainvillea=canvasTexture(64,64,(g,n)=>{
  for(let i=0;i<70;i++){const a=i*2.4,r=Math.sqrt(i/70)*26,x=n/2+Math.cos(a)*r,y=n/2+Math.sin(a)*r*.8+4;g.fillStyle=i%5===0?'#5d9a4a':i%3?'#e0479a':'#f07ab8';g.beginPath();g.arc(x,y,3.4,0,Math.PI*2);g.fill();}
});
const parapet=painted(softBox(1,.2,.12),col(0xffffff),{lo:.82}),parapetCap=painted(softBox(1,.035,.15),col(0x3f78c4),{lo:.8});
const santoriniEdge=edging({rail:parapet,railAt:.6,extra:(c,x,z)=>{const cap=new THREE.Mesh(parapetCap,PAINT);cap.position.set(x,c.y+.72,z);cap.rotation.y=c.s[0]?0:Math.PI/2;return [cap];}});
const SANTORINI_BLUE=0x2f6fc4;
function chapel(P,{light,spin}){
  const g=new THREE.Group();
  const body=new THREE.Mesh(painted(softBox(.6,.5,.6),col(0xffffff),{lo:.78}),PAINT);body.position.y=.25;g.add(body);
  const drum=new THREE.Mesh(painted(new THREE.CylinderGeometry(.22,.22,.12,48),col(0xffffff),{lo:.8}),PAINT);drum.position.y=.56;g.add(drum);
  const dome=new THREE.Mesh(painted(new THREE.SphereGeometry(.24,48,32,0,Math.PI*2,0,Math.PI/2),col(SANTORINI_BLUE),{lo:.7}),PAINT);dome.position.y=.62;g.add(dome);
  const cross=new THREE.Mesh(painted(softBox(.02,.14,.02),col(0xf2d27a)),PAINT);cross.position.y=.93;g.add(cross);
  const bar=new THREE.Mesh(painted(softBox(.08,.02,.02),col(0xf2d27a)),PAINT);bar.position.y=.95;g.add(bar);
  // A bell arch over the door.
  const arch=new THREE.Mesh(painted(softBox(.3,.26,.06),col(0xffffff),{lo:.8}),PAINT);arch.position.set(0,.63,.27);g.add(arch);
  const bell=new THREE.Mesh(painted(new THREE.ConeGeometry(.04,.07,32),col(0xc89a4a)),PAINT);bell.position.set(0,.66,.31);g.add(bell);
  archLight(light,.16,.3,.302);g.add(light);
  spin.position.y=1.25;g.add(spin);
  return g;
}

// ---------- Lantern night ----------
// A festival on the water at night: red lacquer and dark wood, paper windows all lit, red lanterns on the
// walls, strings of little lanterns along the walkways, a tea house at the goal, and sky lanterns
// drifting up into the dark.
const lacquer=canvasTexture(128,128,(g,n)=>{
  g.fillStyle='#ffffff';g.fillRect(0,0,n,n);
  g.fillStyle='rgba(255,255,255,.6)';g.fillRect(0,0,n,6);g.fillStyle='#f2c45a';g.fillRect(0,8,n,3);
  g.fillStyle='rgba(40,10,10,.55)';g.fillRect(0,n-22,n,22);g.fillStyle='#f2c45a';g.fillRect(0,n-24,n,2);
  g.fillStyle='rgba(60,10,10,.18)';g.fillRect(6,14,4,n-38);g.fillRect(n-10,14,4,n-38);
});
const darkPlanks=canvasTexture(128,128,(g,n)=>{
  g.fillStyle='#ffffff';g.fillRect(0,0,n,n);
  g.strokeStyle='rgba(40,20,20,.35)';g.lineWidth=2;for(let y=0;y<=n;y+=25.6){g.beginPath();g.moveTo(0,y);g.lineTo(n,y);g.stroke();}
  g.fillStyle='rgba(40,20,20,.08)';for(let y=0;y<n;y+=51.2)g.fillRect(0,y+2,n,22);
});
const paperWindow=canvasTexture(128,128,g=>{g.fillStyle='#ffffff';g.fillRect(40,44,48,52);g.strokeStyle='rgba(0,0,0,.35)';g.lineWidth=3;g.strokeRect(40,44,48,52);g.beginPath();g.moveTo(64,44);g.lineTo(64,96);g.moveTo(40,70);g.lineTo(88,70);g.stroke();});
const redLantern=canvasTexture(64,128,(g,w,h)=>{
  g.fillStyle='#2a1a1a';g.fillRect(w/2-1,0,2,22);g.fillRect(w/2-9,20,18,6);g.fillRect(w/2-9,94,18,6);
  const r=g.createRadialGradient(w/2,60,4,w/2,60,30);r.addColorStop(0,'#ffd27a');r.addColorStop(.5,'#f05a3a');r.addColorStop(1,'#b82a24');g.fillStyle=r;g.beginPath();g.ellipse(w/2,60,24,34,0,0,Math.PI*2);g.fill();
  g.strokeStyle='rgba(120,20,20,.5)';g.lineWidth=1.5;for(const dx of [-12,0,12]){g.beginPath();g.ellipse(w/2,60,Math.abs(dx)+2,34,0,0,Math.PI*2);g.stroke();}
  g.fillStyle='#f2c45a';g.fillRect(w/2-1,100,2,18);
});
const LANTERN_GLOW=0xffa45a;
const ropeLine=painted(new THREE.CylinderGeometry(.01,.01,1,4).rotateZ(Math.PI/2),col(0x3a2622)),woodPost=painted(softBox(.06,.42,.06),col(0x3a2622),{lo:.7});
const lanternEdge=edging({rail:ropeLine,post:woodPost,railAt:.92,postH:.42,extra:(c,x,z)=>{
  // Two little lanterns hanging from the rope on each tile.
  const out=[],[ax,az]=c.s;
  for(const e of [-.2,.2]){const l=new THREE.Mesh(lanternBall,lanternMat);l.position.set(x+ax*e,c.y+.84,z+az*e);out.push(l);const gl=glow(LANTERN_GLOW,.42);gl.position.copy(l.position);out.push(gl);}
  return out;
}});
const lanternBall=new THREE.SphereGeometry(.05,10,8).scale(1,1.25,1),lanternMat=new THREE.MeshBasicMaterial({color:0xffa060});
function teaHouse(P,{light,spin}){
  const g=new THREE.Group(),red=col(0xc8463c),dark=col(0x2e1a1c);
  const body=new THREE.Mesh(painted(softBox(.56,.42,.5),red,{lo:.72}),PAINT);body.position.y=.21;g.add(body);
  for(const [y,s] of [[.47,.86],[.78,.6]]){
    const roof=new THREE.Mesh(painted(curvedRoof(s,.16),dark,{lo:.66}),PAINT);roof.position.y=y;g.add(roof);
  }
  const upper=new THREE.Mesh(painted(softBox(.34,.22,.3),red,{lo:.72}),PAINT);upper.position.y=.64;g.add(upper);
  const tip=new THREE.Mesh(painted(new THREE.ConeGeometry(.04,.14,8),col(0xf2c45a)),PAINT);tip.position.y=.93;g.add(tip);
  for(const x of [-.32,.32]){const l=new THREE.Mesh(lanternBall,lanternMat);l.position.set(x,.36,.27);g.add(l);const gl=glow(LANTERN_GLOW,.5);gl.position.copy(l.position);g.add(gl);}
  archLight(light,.16,.28,.252);g.add(light);
  spin.position.y=1.25;g.add(spin);
  return g;
}

// ---------- The snowy mountains ----------
// A village high in the mountains: walls of smooth stone washed in soft winter colours, deep snow
// lying on every top and drifting over the edges, warm windows, wreaths on the doors, snow-capped fence
// posts along the walkways and a chalet at the goal. Snow falls.
const snowStone=canvasTexture(128,128,(g,n)=>{
  const grad=g.createLinearGradient(0,0,0,n);grad.addColorStop(0,'#ffffff');grad.addColorStop(1,'#e4e8ee');g.fillStyle=grad;g.fillRect(0,0,n,n);
  // Big dressed stones, laid in courses, each a little lighter at its top.
  for(let row=0,y=22;y<n;row++,y+=26){
    for(let x=(row%2)*-22;x<n;x+=44){const s=g.createLinearGradient(0,y,0,y+26);s.addColorStop(0,'rgba(255,255,255,.35)');s.addColorStop(1,'rgba(90,100,120,.10)');g.fillStyle=s;g.beginPath();g.roundRect(x+2,y+2,40,22,5);g.fill();}
    g.fillStyle='rgba(90,100,125,.16)';g.fillRect(0,y,n,2);
  }
  // Snow along the top edge, soft and uneven, with a little blue shadow under it.
  g.fillStyle='rgba(120,140,180,.18)';for(let x=-6;x<n+8;x+=16){g.beginPath();g.ellipse(x+8,17,11,6+(x*7%5),0,0,Math.PI*2);g.fill();}
  g.fillStyle='#ffffff';g.fillRect(0,0,n,12);for(let x=-6;x<n+8;x+=16){g.beginPath();g.ellipse(x+8,12,10,4+(x*7%5),0,0,Math.PI*2);g.fill();}
});
const snowTop=canvasTexture(128,128,(g,n)=>{
  g.fillStyle='#ffffff';g.fillRect(0,0,n,n);
  for(let i=0;i<14;i++){g.fillStyle='rgba(170,195,230,.12)';g.beginPath();g.ellipse((i*41)%n,(i*29)%n,20,8,i,0,Math.PI*2);g.fill();}
  g.strokeStyle='rgba(170,195,230,.35)';g.lineWidth=3;g.strokeRect(2,2,n-4,n-4);
});
const cabinWindow=canvasTexture(128,128,g=>{
  g.fillStyle='#ffffff';g.fillRect(42,44,44,44);g.fillStyle='rgba(0,0,0,.25)';g.fillRect(62,44,4,44);g.fillRect(42,64,44,4);
  g.fillStyle='rgba(255,255,255,.9)';g.fillRect(36,88,56,6);g.fillRect(38,38,52,6);
});
const wreath=canvasTexture(64,64,(g,n)=>{
  for(let i=0;i<40;i++){const a=i/40*Math.PI*2;g.fillStyle=i%2?'#3f7a4a':'#5a9a5c';g.beginPath();g.ellipse(n/2+Math.cos(a)*18,n/2+Math.sin(a)*18,6,4,a,0,Math.PI*2);g.fill();}
  g.fillStyle='#d8403a';for(let i=0;i<8;i++){const a=i/8*Math.PI*2+.3;g.beginPath();g.arc(n/2+Math.cos(a)*18,n/2+Math.sin(a)*18,2.2,0,Math.PI*2);g.fill();}
  g.beginPath();g.moveTo(n/2,n-14);g.lineTo(n/2-8,n-4);g.lineTo(n/2,n-8);g.lineTo(n/2+8,n-4);g.closePath();g.fill();
});
const fenceRail=painted(softBox(1,.05,.04),col(0x7a5236),{lo:.7}),fencePost=painted(softBox(.07,.36,.07),col(0x6a4630),{lo:.7}),snowCap=painted(softBox(.1,.04,.1),col(0xffffff),{lo:.92});
const snowEdge=edging({rail:fenceRail,post:fencePost,railAt:.72,postH:.36,extra:(c,x,z)=>{const [ax,az]=c.s;return [-.42,.42].map(e=>{const m=new THREE.Mesh(snowCap,PAINT);m.position.set(x+ax*e,c.y+.88,z+az*e);return m;});}});
function chalet(P,{light,spin}){
  const g=new THREE.Group(),wood=col(0xa0623e);
  const body=new THREE.Mesh(painted(softBox(.56,.42,.5),wood,{lo:.7}),PAINT);body.position.y=.21;g.add(body);
  const s=new THREE.Shape();s.moveTo(-.4,0);s.lineTo(0,.36);s.lineTo(.4,0);s.closePath();
  const roof=new THREE.Mesh(painted(new THREE.ExtrudeGeometry(s,{depth:.6,bevelEnabled:false}).translate(0,0,-.3),col(0x5a4038),{lo:.7}),PAINT);roof.position.y=.42;g.add(roof);
  // Snow on both slopes.
  for(const side of [-1,1]){const snow=new THREE.Mesh(painted(softBox(.5,.04,.64),col(0xffffff),{lo:.9}),PAINT);snow.position.set(side*.2,.6,0);snow.rotation.z=-side*.73;g.add(snow);}
  const chimney=new THREE.Mesh(painted(softBox(.09,.22,.09),col(0x8a8a92),{lo:.7}),PAINT);chimney.position.set(.18,.7,-.1);g.add(chimney);
  archLight(light,.15,.26,.252);g.add(light);
  spin.position.y=1.2;g.add(spin);
  return g;
}

// ---------- The ice palace ----------
// Blocks cut from old glacier ice under the night sky: clear blue that deepens toward the bottom, with
// soft pale layers in it, snow lying on every top, soft icicles under the edges, snow-capped ice posts
// with lights along the walkways, and an igloo at the goal with a warm light inside.
const ice=canvasTexture(128,128,(g,n)=>{
  const grad=g.createLinearGradient(0,0,0,n);grad.addColorStop(0,'#f6fcff');grad.addColorStop(.55,'#d6edf8');grad.addColorStop(1,'#a8d2e8');g.fillStyle=grad;g.fillRect(0,0,n,n);
  // Pale layers pressed into the ice, soft-edged, gently wavy.
  g.filter='blur(3px)';
  for(const [y,a] of [[44,.5],[78,.35],[104,.28]]){g.fillStyle=`rgba(255,255,255,${a})`;g.beginPath();g.moveTo(-8,y);for(let x=0;x<=n+8;x+=16)g.lineTo(x,y+Math.sin(x*.06+y)*3);g.lineTo(n+8,y+7);for(let x=n+8;x>=-8;x-=16)g.lineTo(x,y+7+Math.sin(x*.05+y)*2);g.fill();}
  g.filter='none';
  // A cool shine down one side, and a few tiny bubbles caught in it.
  const shine=g.createLinearGradient(0,0,n,0);shine.addColorStop(0,'rgba(255,255,255,.45)');shine.addColorStop(.18,'rgba(255,255,255,0)');g.fillStyle=shine;g.fillRect(0,0,n,n);
  g.fillStyle='rgba(255,255,255,.7)';for(const [x,y,r] of [[30,60,1.6],[36,66,1.1],[88,90,1.4],[94,58,1],[60,112,1.3]]){g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();}
  // Snow lying along the top edge.
  g.fillStyle='rgba(110,150,190,.16)';for(let x=-6;x<n+8;x+=16){g.beginPath();g.ellipse(x+8,16,11,6,0,0,Math.PI*2);g.fill();}
  g.fillStyle='#ffffff';g.fillRect(0,0,n,11);for(let x=-6;x<n+8;x+=16){g.beginPath();g.ellipse(x+8,11,10,4+(x*7%4),0,0,Math.PI*2);g.fill();}
});
// Snow on the tops: soft, a little blue in the hollows and toward the edges.
const frost=canvasTexture(128,128,(g,n)=>{
  g.fillStyle='#ffffff';g.fillRect(0,0,n,n);
  g.filter='blur(6px)';g.fillStyle='rgba(160,200,235,.22)';for(const [x,y,w,h] of [[30,40,26,12],[90,30,20,9],[70,90,30,12],[24,100,18,8]]){g.beginPath();g.ellipse(x,y,w,h,.3,0,Math.PI*2);g.fill();}g.filter='none';
  const edge=g.createRadialGradient(n/2,n/2,n*.3,n/2,n/2,n*.75);edge.addColorStop(0,'rgba(150,190,225,0)');edge.addColorStop(1,'rgba(150,190,225,.35)');g.fillStyle=edge;g.fillRect(0,0,n,n);
});
// Icicles: soft, rounded, of different lengths, clear at the tips.
const icicles=canvasTexture(128,64,(g,w,h)=>{
  g.fillStyle='rgba(245,252,255,.95)';g.fillRect(0,0,w,7);
  for(let x=5;x<w;x+=10){const l=12+((x*7)%24),gr=g.createLinearGradient(0,6,0,6+l);gr.addColorStop(0,'rgba(240,250,255,.95)');gr.addColorStop(1,'rgba(200,232,250,.35)');
    g.fillStyle=gr;g.beginPath();g.moveTo(x-3.5,6);g.quadraticCurveTo(x-2,6+l*.7,x,6+l);g.quadraticCurveTo(x+2,6+l*.7,x+3.5,6);g.closePath();g.fill();}
});
// A post of ice with a cap of snow.
const icePost=painted(new THREE.CapsuleGeometry(.055,.2,4,12),col(0xcfeaf8),{lo:.78}),snowBall=painted(new THREE.SphereGeometry(.07,14,10).scale(1,.6,1),col(0xffffff),{lo:.92});
const iceEdge=edging({extra:(c,x,z)=>{const [ax,az]=c.s,out=[];for(const e of [-.42,.42]){const p=new THREE.Mesh(icePost,PAINT);p.position.set(x+ax*e,c.y+.65,z+az*e);out.push(p);const cap=new THREE.Mesh(snowBall,PAINT);cap.position.set(x+ax*e,c.y+.8,z+az*e);out.push(cap);}if(even(c)){const o=glow(0xffd8a0,.45);o.position.set(x,c.y+.72,z);out.push(o);}return out;}});
// Snow blocks laid in rings, for the igloo.
const iglooBlocks=canvasTexture(256,128,(g,w,h)=>{
  g.fillStyle='#ffffff';g.fillRect(0,0,w,h);g.strokeStyle='rgba(120,160,200,.45)';g.lineWidth=2;
  for(let r=0;r<6;r++){const y=h-r*h/6;g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();const k=Math.max(3,12-r*2);for(let i=0;i<k;i++){const x=(i+(r%2)*.5)*w/k;g.beginPath();g.moveTo(x,y);g.lineTo(x,y-h/6);g.stroke();}}
});
function igloo(P,{light,spin}){
  const g=new THREE.Group(),mat=surfaceMaterial('marble',{vertexColors:true,map:iglooBlocks,roughness:.32});
  const dome=new THREE.Mesh(painted(new THREE.SphereGeometry(.4,48,32,0,Math.PI*2,0,Math.PI/2),col(0xf2f8fc),{lo:.72}),mat);g.add(dome);
  // The way in: a low half-tube of snow blocks out the front, its door lit warm.
  const tunnel=new THREE.Mesh(painted(new THREE.CylinderGeometry(.17,.17,.24,48,1,true,-Math.PI/2,Math.PI).rotateX(Math.PI/2),col(0xeef6fc),{lo:.72}),mat);tunnel.position.set(0,0,.36);tunnel.material.side=THREE.DoubleSide;g.add(tunnel);
  archLight(light,.2,.17,.485);g.add(light);
  spin.position.y=.95;g.add(spin);
  return g;
}

// ---------- The glow forest ----------
// An old forest at night where everything glows a little: mossy stone, round doors lit warm, glowing
// mushrooms on the walls, vines with lights along the walkways, a mushroom house at the goal, and
// fireflies.
const mossStone=canvasTexture(128,128,(g,n)=>{
  g.fillStyle='#ffffff';g.fillRect(0,0,n,n);
  g.strokeStyle='rgba(30,50,40,.22)';g.lineWidth=2.5;for(let r=0;r<3;r++){const y=24+r*36;g.beginPath();g.moveTo(0,y);g.lineTo(n,y);g.stroke();for(let x=(r%2?24:0)+40;x<n;x+=48){g.beginPath();g.moveTo(x,y);g.lineTo(x,y+36);g.stroke();}}
  // Moss hanging from the top edge.
  g.fillStyle='#8fd6a0';g.fillRect(0,0,n,9);for(let x=0;x<n;x+=7){const l=6+((x*13)%22);g.beginPath();g.ellipse(x+3,9,3.5,l/2+2,0,0,Math.PI);g.fill();}
});
const mossTop=canvasTexture(128,128,(g,n)=>{g.fillStyle='#ffffff';g.fillRect(0,0,n,n);for(let i=0;i<60;i++){g.fillStyle=i%7?'rgba(80,140,100,.14)':'rgba(190,255,220,.6)';g.beginPath();g.arc((i*37)%n,(i*61)%n,i%7?6:1.6,0,Math.PI*2);g.fill();}g.strokeStyle='rgba(60,110,80,.3)';g.lineWidth=3;g.strokeRect(2,2,n-4,n-4);});
const roundDoor=canvasTexture(128,128,g=>{g.fillStyle='#ffffff';g.beginPath();g.arc(64,74,24,0,Math.PI*2);g.fill();g.fillStyle='rgba(0,0,0,.25)';g.fillRect(63,50,2,48);g.beginPath();g.arc(74,76,2.5,0,Math.PI*2);g.fill();});
const glowShrooms=canvasTexture(64,64,(g,n)=>{
  for(const [x,y,r,c] of [[18,40,11,'#7ff7e0'],[38,34,14,'#9fe8ff'],[50,46,8,'#c8ff9a']]){
    g.fillStyle='rgba(240,250,240,.9)';g.fillRect(x-2,y,4,16);
    const gr=g.createRadialGradient(x,y,1,x,y,r);gr.addColorStop(0,'#ffffff');gr.addColorStop(1,c);g.fillStyle=gr;g.beginPath();g.ellipse(x,y,r,r*.6,0,Math.PI,0);g.fill();
  }
});
const vine=painted(new THREE.CylinderGeometry(.018,.018,1,5).rotateZ(Math.PI/2),col(0x3f6a4a)),stalk=painted(new THREE.CylinderGeometry(.025,.035,.34,5),col(0x4a3a30),{lo:.7});
const glowEdge=edging({rail:vine,post:stalk,railAt:.82,postH:.34,extra:(c,x,z,side)=>{if(!even(c)&&side>0)return [];const [ax,az]=c.s,o=glow(side>0?0x9ff7d0:0xc8ff9a,.4);o.position.set(x+ax*.1*side,c.y+.8,z+az*.1*side);return [o];}});
function mushroomHouse(P,{light,spin}){
  const g=new THREE.Group();
  const stem=new THREE.Mesh(painted(new THREE.CylinderGeometry(.2,.25,.52,48),col(0xf4ecd8),{lo:.72}),PAINT);stem.position.y=.26;g.add(stem);
  const cap=new THREE.Mesh(painted(new THREE.SphereGeometry(.42,48,32,0,Math.PI*2,0,Math.PI/2).scale(1,.62,1),col(0xd6584a),{lo:.7}),PAINT);cap.position.y=.5;g.add(cap);
  for(let i=0;i<9;i++){const a=i*2.3,r=.15+(i%3)*.08,dot=new THREE.Mesh(painted(new THREE.SphereGeometry(.035,48,32),col(0xffffff),{lo:.9}),PAINT);dot.position.set(Math.cos(a)*r,.5+Math.sqrt(Math.max(0,.42*.42-r*r))*.62,Math.sin(a)*r);g.add(dot);}
  const under=glow(0x9ff7d0,.9);under.position.y=.46;g.add(under);
  archLight(light,.14,.24,.212);g.add(light);
  spin.position.y=1.15;g.add(spin);
  return g;
}

// ---------- The cloud kingdom ----------
// A palace above the clouds: white marble with a gold band, marble tiles inlaid with gold, open arches
// onto the sky, gold suns on the walls, balustrades and a domed temple at the goal.
const marble=canvasTexture(128,128,(g,n)=>{
  g.fillStyle='#ffffff';g.fillRect(0,0,n,n);
  g.strokeStyle='rgba(150,150,175,.22)';g.lineWidth=1.5;for(const [x,y,c] of [[0,40,30],[30,128,60],[80,0,-40],[128,90,-30]]){g.beginPath();g.moveTo(x,y);g.bezierCurveTo(x+c,y-30,x+40,y-60+c,x+70,y-90);g.stroke();}
  g.fillStyle='#e8c46a';g.fillRect(0,9,n,3);g.fillStyle='rgba(255,255,255,.9)';g.fillRect(0,0,n,7);
});
const marbleTile=canvasTexture(128,128,(g,n)=>{g.fillStyle='#ffffff';g.fillRect(0,0,n,n);g.strokeStyle='#e8c46a';g.lineWidth=3;g.beginPath();g.arc(n/2,n/2,30,0,Math.PI*2);g.stroke();g.lineWidth=2;g.strokeRect(10,10,n-20,n-20);g.fillStyle='rgba(232,196,106,.7)';g.beginPath();g.arc(n/2,n/2,6,0,Math.PI*2);g.fill();});
const skyArch=canvasTexture(128,128,g=>{g.fillStyle='#ffffff';g.beginPath();g.moveTo(46,108);g.lineTo(46,62);g.arc(64,62,18,Math.PI,0);g.lineTo(82,108);g.closePath();g.fill();});
const goldSun=canvasTexture(64,64,(g,n)=>{g.fillStyle='#f2c45a';for(let i=0;i<12;i++){const a=i*Math.PI/6;g.beginPath();g.moveTo(n/2+Math.cos(a)*12,n/2+Math.sin(a)*12);g.lineTo(n/2+Math.cos(a+.13)*26,n/2+Math.sin(a+.13)*26);g.lineTo(n/2+Math.cos(a-.13)*26,n/2+Math.sin(a-.13)*26);g.fill();}g.beginPath();g.arc(n/2,n/2,12,0,Math.PI*2);g.fill();g.fillStyle='#fff3c4';g.beginPath();g.arc(n/2,n/2,8,0,Math.PI*2);g.fill();});
const balRail=painted(softBox(1,.05,.1),col(0xffffff),{lo:.82}),baluster=painted(new THREE.CylinderGeometry(.025,.035,.22,8),col(0xf4f0f6),{lo:.8}),finial=painted(new THREE.SphereGeometry(.04,10,8),col(0xe8c46a));
const cloudEdge=edging({rail:balRail,railAt:.75,extra:(c,x,z)=>{const [ax,az]=c.s,out=[];for(const e of [-.3,-.1,.1,.3]){const b=new THREE.Mesh(baluster,PAINT);b.position.set(x+ax*e,c.y+.61,z+az*e);out.push(b);}if(even(c)){const f=new THREE.Mesh(finial,PAINT);f.position.set(x+ax*.42,c.y+.81,z+az*.42);out.push(f);}return out;}});
function temple(P,{light,spin}){
  const g=new THREE.Group(),w=col(0xffffff);
  const step=new THREE.Mesh(painted(new THREE.CylinderGeometry(.38,.4,.08,20),w,{lo:.8}),PAINT);step.position.y=.04;g.add(step);
  for(let i=0;i<8;i++){const a=i*Math.PI/4+Math.PI/8,c=new THREE.Mesh(painted(new THREE.CylinderGeometry(.03,.035,.4,8),w,{lo:.78}),PAINT);c.position.set(Math.cos(a)*.3,.28,Math.sin(a)*.3);g.add(c);}
  const ring=new THREE.Mesh(painted(new THREE.CylinderGeometry(.36,.36,.07,20),w,{lo:.8}),PAINT);ring.position.y=.51;g.add(ring);
  const dome=new THREE.Mesh(painted(new THREE.SphereGeometry(.3,20,10,0,Math.PI*2,0,Math.PI/2),col(0xe8c46a),{lo:.7}),PAINT);dome.position.y=.54;g.add(dome);
  const core=new THREE.Mesh(painted(new THREE.CylinderGeometry(.16,.16,.4,16),w,{lo:.8}),PAINT);core.position.y=.28;g.add(core);
  archLight(light,.12,.24,.162,.08);g.add(light);
  spin.position.y=1.2;g.add(spin);
  return g;
}

// ---------- Space ----------
// A small station on an asteroid: pale hull panels with seams and a stripe, deck plates on top,
// portholes lit blue, solar panels on the walls, rails with little blinking lights, a glass dome at the
// goal, and a great planet rising over the stars.
const hull=canvasTexture(128,128,(g,n)=>{
  const grad=g.createLinearGradient(0,0,0,n);grad.addColorStop(0,'#ffffff');grad.addColorStop(1,'#d8dce4');g.fillStyle=grad;g.fillRect(0,0,n,n);
  g.strokeStyle='rgba(60,70,90,.25)';g.lineWidth=2;g.strokeRect(4,16,n-8,n-22);g.beginPath();g.moveTo(n/2,16);g.lineTo(n/2,n-6);g.stroke();
  g.fillStyle='rgba(60,70,90,.3)';for(const [x,y] of [[10,22],[n-10,22],[10,n-12],[n-10,n-12],[n/2-6,22],[n/2+6,22]]){g.beginPath();g.arc(x,y,1.6,0,Math.PI*2);g.fill();}
  g.fillStyle='#f08a3a';g.fillRect(0,7,n,5);g.fillStyle='rgba(255,255,255,.85)';g.fillRect(0,0,n,5);
});
const deckPlate=canvasTexture(128,128,(g,n)=>{g.fillStyle='#ffffff';g.fillRect(0,0,n,n);g.strokeStyle='rgba(60,70,90,.28)';g.lineWidth=2;g.strokeRect(6,6,n-12,n-12);g.strokeStyle='rgba(60,70,90,.12)';for(let x=20;x<n-10;x+=12){g.beginPath();g.moveTo(x,14);g.lineTo(x,n-14);g.stroke();}});
const porthole=canvasTexture(128,128,g=>{g.fillStyle='rgba(255,255,255,.5)';g.beginPath();g.arc(64,62,24,0,Math.PI*2);g.fill();g.fillStyle='#fff';g.beginPath();g.arc(64,62,17,0,Math.PI*2);g.fill();});
const solar=canvasTexture(64,64,(g,n)=>{g.fillStyle='#2a4f9a';g.fillRect(6,10,n-12,n-20);g.strokeStyle='rgba(180,210,255,.6)';g.lineWidth=1;for(let x=6;x<=n-6;x+=10.4){g.beginPath();g.moveTo(x,10);g.lineTo(x,n-10);g.stroke();}for(let y=10;y<=n-10;y+=11){g.beginPath();g.moveTo(6,y);g.lineTo(n-6,y);g.stroke();}g.fillStyle='rgba(255,255,255,.2)';g.fillRect(6,10,20,n-20);});
const tubeRail=painted(new THREE.CylinderGeometry(.022,.022,1,8).rotateZ(Math.PI/2),col(0xd4dae4)),strut=painted(softBox(.05,.3,.05),col(0x9aa4b4),{lo:.7});
const spaceEdge=edging({rail:tubeRail,post:strut,railAt:.8,postH:.3,extra:(c,x,z,side)=>{if(!even(c))return [];const o=glow(side>0?0xff6a5a:0x6aff9a,.28);o.position.set(x+c.s[0]*.42,c.y+.84,z+c.s[1]*.42);return [o];}});
function habDome(P,{light,spin}){
  const g=new THREE.Group();
  const base=new THREE.Mesh(painted(new THREE.CylinderGeometry(.34,.36,.24,48),col(0xe8ecf2),{lo:.72}),PAINT);base.position.y=.12;g.add(base);
  const band=new THREE.Mesh(painted(new THREE.CylinderGeometry(.35,.35,.04,48),col(0xf08a3a)),PAINT);band.position.y=.22;g.add(band);
  const glass=new THREE.Mesh(new THREE.SphereGeometry(.3,48,32,0,Math.PI*2,0,Math.PI/2),new THREE.MeshPhysicalMaterial({color:0x9fd8ff,metalness:.08,roughness:.12,clearcoat:1,transparent:true,opacity:.5,depthWrite:false}));glass.position.y=.24;g.add(glass);
  const plant=new THREE.Mesh(painted(new THREE.IcosahedronGeometry(.12,1),col(0x7fc88a),{lo:.7}),PAINT);plant.position.y=.34;g.add(plant);
  const mast=new THREE.Mesh(painted(new THREE.CylinderGeometry(.01,.01,.36,48),col(0xc8ced8)),PAINT);mast.position.set(.24,.42,-.12);g.add(mast);
  const dish=new THREE.Mesh(painted(new THREE.SphereGeometry(.08,48,32,0,Math.PI*2,0,Math.PI/2.4),col(0xffffff),{lo:.75}),PAINT);dish.position.set(.24,.62,-.12);dish.rotation.x=Math.PI*.7;g.add(dish);
  archLight(light,.14,.18,.362);g.add(light);
  spin.position.y=1.05;g.add(spin);
  return g;
}

export const MORE={
  santorini:{
    name:'Santorini',
    faces:facesOf(0xffffff,0xece6dc),edge:0x5a6888,
    variants:[0xffffff,0xfaf6ee,0xf4e2c8,0xf6d6c6].map(p=>facesOf(p,0xece6dc)),
    top:flagstones,side:whitewash,birds:0xffffff,
    window:{map:blueDoor,color:SANTORINI_BLUE,every:.16},banner:bannerOf(bougainvillea,.42,.36),
    walkway:santoriniEdge,home:chapel
  },
  lantern:{
    name:'Lantern night',
    faces:[0xd2483e,0xb83e36,0x8a5a44,0x2a1416,0xc8443a,0xa83a32],edge:0x2a1012,
    top:darkPlanks,side:lacquer,air:'lanterns',birds:0x2a1a2a,
    window:{map:paperWindow,color:0xffd28a,every:.3,lit:.6},banner:bannerOf(redLantern,.2,.4),
    walkway:lanternEdge,home:teaHouse
  },
  snow:{
    name:'Snowy mountains',
    faces:facesOf(0xb4c3d6),edge:0x46506a,
    variants:[0xb4c3d6,0xd9c8b0,0xd2aeb0,0xb2c4b4].map(p=>facesOf(p)),
    top:snowTop,side:snowStone,air:'snow',birds:0x3a3a48,
    window:{map:cabinWindow,color:0x3a4a5a,every:.14},banner:bannerOf(wreath,.3,.3),
    walkway:snowEdge,home:chalet
  },
  ice:{
    name:'Ice palace',
    faces:[0xd6f2ff,0xb6e0f2,0xf4fcff,0x2a4f70,0xc6ecfb,0xa8d6ec],edge:0x1c3954,
    top:frost,side:ice,air:'snow',mote:0xdff6ff,
    window:{map:skyArch,color:0xffcf8a,every:.2,lit:.6},banner:bannerOf(icicles,.6,.3),
    walkway:iceEdge,home:igloo
  },
  glow:{
    name:'Glow forest',
    faces:[0x7fa88e,0x6a907a,0xa8d4b4,0x1e3228,0x76a088,0x60866f],edge:0x1a2a22,
    top:mossTop,side:mossStone,mote:0xc8ff9a,birds:0x1a2a2a,
    window:{map:roundDoor,color:0xffc878,every:.18,lit:.6},banner:bannerOf(glowShrooms,.38,.38),
    walkway:glowEdge,home:mushroomHouse
  },
  cloud:{
    name:'Cloud kingdom',
    faces:facesOf(0xffffff,0xfbf6ec),edge:0x6a6488,
    variants:[0xffffff,0xfbf1dc,0xf8e4e4,0xe4f0fb].map(p=>facesOf(p,0xfbf6ec)),
    top:marbleTile,side:marble,birds:0xffffff,
    window:{map:skyArch,color:0x9fc4ef,every:.16},banner:bannerOf(goldSun,.34,.34),
    walkway:cloudEdge,home:temple
  },
  space:{
    name:'Space',
    faces:facesOf(0xe8ecf2,0xdfe4ea),edge:0x252a36,
    variants:[0xe8ecf2,0xd6dbe2,0xf2e6da,0xd8ece8].map(p=>facesOf(p,0xdfe4ea)),
    top:deckPlate,side:hull,mote:0xcfe0ff,
    window:{map:porthole,color:0x9fd8ff,every:.18,lit:.6},banner:bannerOf(solar,.44,.44),
    walkway:spaceEdge,home:habDome
  }
};
