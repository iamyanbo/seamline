import * as THREE from './vendor/three.module.js';
import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';

// One material language, fourteen places. Values are albedo, not baked light/shadow colours.
// Walkable caps stay on the exact game grid; the architecture is built below that surface.
export const ART={
  Home:{wall:0xc97559,cap:0xffefd4,base:0x87473e,accent:0xe2b16a,rail:0x654447,material:'plaster',floor:'stone',sky:['#fff2da','#edc9b9','#bdc7db'],sun:0xffe0b3},
  Castle:{wall:0xc4b7a3,cap:0xf5e5c9,base:0x786f78,accent:0x9d4253,rail:0x586079,material:'stone',floor:'flag',sky:['#f7e3cd','#c8c9d8','#8d9fb8'],sun:0xffd5ac},
  Beach:{wall:0x70c7b3,cap:0xffe4b3,base:0x427f82,accent:0xf28670,rail:0xa67b53,material:'wood',floor:'wood',variants:[0x70c7b3,0xe99382,0xe9c77e,0x83b8d6],sky:['#fdf5dc','#b7dfdf','#79b1cd'],sun:0xffe5bb},
  Kyoto:{wall:0xc47f65,cap:0xf5e8ce,base:0x746b62,accent:0xbb8c49,rail:0x3f5850,material:'wood',floor:'stone',sky:['#fff0d8','#d5ddd0','#8baaa3'],sun:0xffdfae},
  Desert:{wall:0xde9b62,cap:0xffe2af,base:0x9e6149,accent:0x438e91,rail:0x96704b,material:'stone',floor:'mosaic',sky:['#fff0d3','#ebc39f','#cc9588'],sun:0xffd09b},
  Santorini:{wall:0xfff7e9,cap:0xf3e4c8,base:0xd5d9da,accent:0x3674b5,rail:0x3674b5,material:'plaster',floor:'flag',variants:[0xfff7e9,0xf4e8d6,0xecece1,0xf4d8c3],sky:['#f5f0de','#b9d6e0','#6c9dbe'],sun:0xffe1b4},
  Venice:{wall:0xc77665,cap:0xf9e8ce,base:0x6c535d,accent:0x80a394,rail:0x35534f,material:'plaster',floor:'herringbone',night:true,variants:[0xc77665,0xdbac74,0xd79d96,0xebd8bd],sky:['#554a68','#897d94','#b295a1'],sun:0xffd3a4},
  'Lantern night':{wall:0xb56e5c,cap:0xead1ad,base:0x67505b,accent:0xd3a74f,rail:0x59434c,material:'wood',floor:'wood',night:true,sky:['#231d36','#42465c','#6c6a7a'],sun:0xffdcaa},
  'Snowy mountains':{wall:0x9a6748,cap:0xf7fcff,base:0x68564f,accent:0xb4c6cb,rail:0x5a5e54,material:'wood',floor:'snow',sky:['#e7eef3','#b7cedc','#8b9fb9'],sun:0xffe2ba},
  'Ice palace':{wall:0x85cddc,cap:0xe9faff,base:0x4b8da7,accent:0xbce8e0,rail:0x79afc5,material:'marble',floor:'ice',night:true,gloss:.18,sky:['#152d46','#31516a','#688590'],sun:0xcbe7ff},
  'Glow forest':{wall:0x517b69,cap:0xa8c9a2,base:0x2a4548,accent:0xd0b975,rail:0x476656,material:'stone',floor:'moss',night:true,sky:['#172f32','#2e5051','#6b8980'],sun:0xe2efc7},
  'Cloud kingdom':{wall:0xf2e8da,cap:0xfff5de,base:0xc2acb9,accent:0xc89c52,rail:0xd9b773,material:'marble',floor:'marble',sky:['#fff4d9','#e4c9c8','#b8bfd7'],sun:0xffe2ac},
  'The stars':{wall:0x445577,cap:0xe1e6ec,base:0x2b3655,accent:0xc3a45c,rail:0xb0965c,material:'marble',floor:'celestial',night:true,sky:['#17233e','#354566','#716e8b'],sun:0xd8e5ff},
  Space:{wall:0xa3b1c1,cap:0xeaf1f0,base:0x3e5068,accent:0xd88a4b,rail:0x7e9cae,material:'metal',floor:'panel',night:true,sky:['#080e20','#1d2d46','#4a6475'],sun:0xe0edff},
  'Glass Garden':{wall:0xa1bfa5,cap:0xf1edd3,base:0x5a8275,accent:0xc18b77,rail:0x497d6b,material:'plaster',floor:'garden',variants:[0xa1bfa5,0xc9cfa7,0xe2cbb1],sky:['#f4efd3','#cbdcc3','#8fb7ae'],sun:0xffe3b5},
  Copperworks:{wall:0xc68e70,cap:0xf6dfbd,base:0x715856,accent:0xc29a52,rail:0x527f79,material:'metal',floor:'panel',variants:[0xc68e70,0xc3ab86,0x7bada1],sky:['#e9d8b8','#b9c7c1','#688d98'],sun:0xffd5aa},
  'Coral Sanctuary':{wall:0xdca7ae,cap:0xffeddb,base:0x84758e,accent:0x64b2b6,rail:0x6d9da8,material:'marble',floor:'shell',variants:[0xdca7ae,0xa6c9c4,0xe8c5b6],sky:['#dcece2','#93c5c5','#547c9b'],sun:0xe1f3e7}
};

// Smooth colour and broad light define the blocks. No photographic grain or bump maps.
const assetErrors=[];
export const artReady=Promise.resolve();
export const softBox=(w=1,h=1,d=1,r=.018)=>new RoundedBoxGeometry(w,h,d,1,Math.min(r,w*.15,h*.15,d*.15));
export function surfaceMaterial(kind='plaster',options={}){
  return new THREE.MeshStandardMaterial({roughness:kind==='marble'?.68:.86,...options});
}
const copyMaterial=m=>m.clone();

// Paint only albedo on decoration. Keep the original smooth normals; actual lights shape it.
export function litGeometry(geometry,color,{fade=null,k=0}={}){
  const c=fade?color.clone().lerp(fade,k):color,out=new Float32Array(geometry.attributes.position.count*3);
  for(let i=0;i<out.length;i+=3)c.toArray(out,i);
  geometry.setAttribute('color',new THREE.BufferAttribute(out,3));return geometry;
}
export const decorMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8});
const css=c=>'#'+new THREE.Color(c).getHexString();
function floorMap(p){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const g=canvas.getContext('2d'),t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;
  const draw=()=>{
    g.fillStyle=css(p.cap);g.fillRect(0,0,512,512);
    g.lineWidth=1.5;g.strokeStyle='rgba(45,45,48,.075)';
    if(p.floor==='wood'){
      for(let y=170;y<512;y+=170){g.beginPath();g.moveTo(0,y);g.lineTo(512,y);g.stroke();}
    }else if(p.floor==='garden'){
      g.strokeStyle='rgba(74,119,88,.14)';g.strokeRect(14,14,484,484);g.beginPath();g.moveTo(256,14);g.lineTo(256,498);g.moveTo(14,256);g.lineTo(498,256);g.stroke();
    }else if(p.floor==='shell'){
      g.strokeStyle='rgba(170,108,136,.12)';for(const r of [90,170,250,330]){g.beginPath();g.arc(256,512,r,Math.PI,2*Math.PI);g.stroke();}
    }else if(p.floor==='herringbone'){
      g.save();g.translate(256,256);g.rotate(Math.PI/4);g.strokeStyle='rgba(95,54,44,.075)';
      for(let y=-500;y<500;y+=128)for(let x=-500;x<500;x+=256){g.strokeRect(x+(y/128%2)*128,y,256,128);}g.restore();
    }else if(p.floor==='flag'){
      g.strokeRect(5,5,502,502);
      for(const [a,b] of [[[192,5],[180,310]],[[180,310],[5,302]],[[180,310],[507,295]],[[320,300],[335,507]]]){g.beginPath();g.moveTo(...a);g.lineTo(...b);g.stroke();}
    }else if(p.floor==='snow'){
      g.strokeStyle='rgba(127,166,185,.08)';g.lineWidth=3;g.beginPath();g.moveTo(25,480);g.bezierCurveTo(120,450,380,485,490,444);g.stroke();
    }else if(p.floor==='ice'){
      g.strokeStyle='rgba(255,255,255,.2)';g.lineWidth=2;
      for(const pts of [[[0,160],[170,220],[220,512]],[[170,220],[345,155],[512,200]],[[345,155],[380,0]]]){g.beginPath();pts.forEach(p=>g.lineTo(...p));g.stroke();}
    }else if(p.floor==='panel'){
      g.strokeStyle='rgba(49,77,91,.12)';g.lineWidth=2;g.strokeRect(20,20,472,472);
      g.globalAlpha=.4;g.fillStyle=css(p.accent);g.fillRect(214,22,84,6);g.globalAlpha=1;
    }else{
      g.strokeRect(3,3,506,506);
      if(p.floor==='stone'){g.beginPath();g.moveTo(256,4);g.lineTo(256,508);g.stroke();}
      if(['marble','celestial','mosaic'].includes(p.floor)){
        g.strokeStyle=css(p.accent);g.globalAlpha=.22;g.lineWidth=2;g.strokeRect(22,22,468,468);
        for(const x of [22,490])for(const y of [22,490]){g.save();g.translate(x,y);g.rotate(Math.PI/4);g.fillStyle=css(p.accent);g.fillRect(-5,-5,10,10);g.restore();}g.globalAlpha=1;
      }
    }
    t.needsUpdate=true;
  };
  draw();return t;
}

const kits=new Map();
function makeKit(name){
  const p=ART[name]??ART.Home,materials=[];
  const make=(kind,opts)=>{const m=surfaceMaterial(kind,opts);materials.push(m);return m;};
  const wall=make(p.material,{color:p.wall,roughness:p.gloss? .5:.86,metalness:p.material==='metal'?.2:0});
  const top=new THREE.MeshStandardMaterial({map:floorMap(p),roughness:p.gloss? .5:.82,metalness:p.floor==='panel'?.08:0});
  const cap=make('plaster',{color:p.cap});
  const base=make('plaster',{color:new THREE.Color(p.base).lerp(new THREE.Color(p.wall),.35)});
  const trim=make('plaster',{color:new THREE.Color(p.wall).lerp(new THREE.Color(p.cap),.25)});
  const accent=new THREE.MeshStandardMaterial({color:p.accent,metalness:['Cloud kingdom','The stars','Space'].includes(name)?.35:.12,roughness:.62});
  const rail=new THREE.MeshStandardMaterial({color:p.rail,metalness:p.material==='wood'?.05:.2,roughness:.72});
  const window=new THREE.MeshPhysicalMaterial({color:0x486d78,metalness:.12,roughness:.22,clearcoat:.65});
  const litWindow=new THREE.MeshStandardMaterial({color:0xffdb97,emissive:0xffb75d,emissiveIntensity:.45,roughness:.6});
  const paper=new THREE.MeshStandardMaterial({color:0xf0b878,emissive:0xffb15c,emissiveIntensity:.35,roughness:.85});
  const mover=make('plaster',{color:0x9c8db1,roughness:.8});
  const moverTop=top.clone();moverTop.map=floorMap({...p,cap:0xe0d9eb,accent:0xb7a2d2,floor:'panel'});moverTop.roughness=.8;
  const moverBase=copyMaterial(base);moverBase.color.setHex(0x786c8b);
  const shy=make('marble',{color:0xeee1df,roughness:.68});
  const variants=(p.variants??[p.wall]).map(color=>{const m=copyMaterial(wall);m.color.setHex(color);return m;});
  const start=top.clone();start.map=floorMap({...p,cap:0xffe5a9,floor:'stone'});
  const kit={name,p,wall,top,cap,base,trim,accent,rail,window,litWindow,paper,mover,moverTop,moverBase,shy,start,variants,materials};kits.set(name,kit);return kit;
}

// A cap's side is stone; its top is the exact walkable face. The core is inset by 12 mm,
// giving a real shadow line under the cap instead of a painted black outline around every cube.
const unitBox=new THREE.BoxGeometry(1,1,1),moulding=softBox(1,1,1,.025);
unitBox.userData.artShared=moulding.userData.artShared=true;
const columnGeometry=new THREE.CylinderGeometry(1,1,1,48);
columnGeometry.userData.artShared=true;
const facadeCache=new Map();
function facadeGeometry(type){
  if(facadeCache.has(type))return facadeCache.get(type);
  const circle=type==='round',square=type==='square',slit=type==='slit',w=slit?.115:.32,h=square?.32:.44,rim=.027;
  const path=(p,w,h,dy=0)=>{
    p.moveTo(-w/2,dy);p.lineTo(w/2,dy);
    if(square){p.lineTo(w/2,h+dy);p.lineTo(-w/2,h+dy);}
    else{p.lineTo(w/2,h-w/2+dy);p.absarc(0,h-w/2+dy,w/2,0,Math.PI,false);}
    p.closePath();return p;
  };
  let frame,pane;
  if(circle){frame=new THREE.TorusGeometry(.145,.025,10,40);pane=new THREE.CircleGeometry(.123,40);frame.translate(0,-.055,0);pane.translate(0,-.055,-.008);}
  else{
    const shape=path(new THREE.Shape(),w+rim*2,h+rim*2,-.26-rim),hole=path(new THREE.Path(),w,h,-.26);shape.holes.push(hole);
    frame=new THREE.ExtrudeGeometry(shape,{depth:.014,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:2,steps:1});
    pane=new THREE.ShapeGeometry(path(new THREE.Shape(),w,h,-.26));
  }
  frame.userData.artShared=pane.userData.artShared=true;
  const result={frame,pane,w,h,square};facadeCache.set(type,result);return result;
}
// Small, dimensional openings: stone surrounds, paper screens and glazed portholes.
// Local +Z faces out; every piece lies below the walkable cap and has no gameplay identity.
export function facadeAsset(kit,{lit=false,lantern=false}={}){
  const out=[],add=(g,m,x=0,y=0,z=0)=>{const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);mesh.userData.decorative=true;out.push(mesh);return mesh;};
  if(lantern){
    const body=new THREE.SphereGeometry(.072,24,16).scale(1,1.45,1);add(body,kit.paper,0,-.055,.08);
    for(const y of [-.16,.05])add(new THREE.CylinderGeometry(.038,.038,.022,20),kit.rail,0,y,.08);
    for(const y of [-.12,-.075,-.03,.015]){
      const radius=.072*Math.sqrt(Math.max(.1,1-((y+.055)/.105)**2));add(new THREE.TorusGeometry(radius,.0035,6,24).rotateX(Math.PI/2),kit.accent,0,y,.08);
    }
    add(softBox(.012,.1,.015),kit.rail,0,.105,.08);return out;
  }
  const round=['Beach','Glow forest','The stars','Space','Copperworks','Coral Sanctuary'].includes(kit.name),square=['Kyoto','Lantern night','Snowy mountains','Glass Garden'].includes(kit.name),type=round?'round':square?'square':kit.name==='Castle'?'slit':'arch';
  const g=facadeGeometry(type),screen=square&&kit.name!=='Snowy mountains';
  add(g.pane,lit||screen?kit.litWindow:kit.window,0,0,.002);
  add(g.frame,['Space','The stars','Glow forest'].includes(kit.name)?kit.accent:kit.name==='Kyoto'?kit.base:kit.cap);
  if(square){
    for(const x of screen?[-.08,0,.08]:[0])add(softBox(.009,g.h,.015),kit.rail,x,-.26+g.h/2,.02);
    add(softBox(g.w,.009,.015),kit.rail,0,-.26+g.h/2,.02);
  }
  if(!round)add(softBox(g.w+.09,.035,.065),kit.cap,0,-.28,.018);
  if(kit.name==='Glass Garden'){
    add(softBox(.34,.09,.12),kit.accent,0,-.31,.07);
    for(const x of [-.11,0,.11])add(new THREE.SphereGeometry(.055,10,8).scale(.7,1.5,.7),kit.rail,x,-.23,.09);
  }else if(kit.name==='Copperworks'){
    add(new THREE.CylinderGeometry(.018,.018,.62,10),kit.accent,.25,-.02,.04);
    for(const y of [-.23,.2])add(new THREE.TorusGeometry(.025,.008,6,12).rotateX(Math.PI/2),kit.rail,.25,y,.04);
  }else if(kit.name==='Coral Sanctuary'){
    for(let i=-2;i<=2;i++)add(new THREE.SphereGeometry(.09,12,8).scale(.45,1.3,.25),kit.accent,i*.048,.12-Math.abs(i)*.02,.035);
  }
  return out;
}
export function createArt(renderer,scene){
  const rig=new THREE.Group();scene.add(rig);
  const sky=new THREE.HemisphereLight(0xe4eeff,0xa28b7d,1.4),sun=new THREE.DirectionalLight(0xffdfb4,3.4),fill=new THREE.DirectionalLight(0xafd6ef,.7);
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.00015;sun.shadow.normalBias=.035;sun.shadow.radius=3;
  rig.add(sky,sun,sun.target,fill,fill.target);
  // Neutral studio-like reflections keep metals readable. Chapter colours belong to the key light.
  const c=document.createElement('canvas');c.width=512;c.height=256;const ctx=c.getContext('2d'),grad=ctx.createLinearGradient(0,0,0,256);
  grad.addColorStop(0,'#e2edfa');grad.addColorStop(.48,'#b3c2cd');grad.addColorStop(.55,'#796f69');grad.addColorStop(1,'#c0b39e');ctx.fillStyle=grad;ctx.fillRect(0,0,512,256);
  ctx.fillStyle='#fff5e4';ctx.fillRect(60,25,90,65);ctx.fillStyle='#cce4ff';ctx.fillRect(330,45,65,100);
  const env=new THREE.CanvasTexture(c);env.mapping=THREE.EquirectangularReflectionMapping;env.colorSpace=THREE.SRGBColorSpace;
  const pmrem=new THREE.PMREMGenerator(renderer),reflection=pmrem.fromEquirectangular(env);env.dispose();pmrem.dispose();scene.environment=reflection.texture;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;
  let kit=makeKit('Home'),ready=false,fitRadius=1,shadowScale=0;artReady.then(()=>ready=true);
  return {
    get kit(){return kit;},get ready(){return ready;},
    select(name){
      kit=kits.get(name)??makeKit(name);const p=kit.p;
      sun.color.setHex(p.sun);sun.intensity=p.night?2.2:2.7;sky.intensity=p.night?1.35:1.65;fill.intensity=p.night?1:.8;
      sky.color.set(p.night?'#c1d5ee':'#e2ebf8');sky.groundColor.set(p.night?'#5e586d':'#ad9684');
      scene.environmentIntensity=p.night?.65:.45;renderer.toneMappingExposure=p.night?1.03:1.02;
      return p;
    },
    fit(center,radius){
      sun.position.copy(center).add(new THREE.Vector3(-radius*.8,radius*1.5,radius*.85));sun.target.position.copy(center);
      fill.position.copy(center).add(new THREE.Vector3(radius,radius*.6,-radius));fill.target.position.copy(center);
      fitRadius=radius;shadowScale=0;this.scale(1);
    },
    // The shadow camera and its normal offset are in room units, not the level's. In a headset the
    // level is shrunk to an island in your hands, so they shrink with it: otherwise the shadow map
    // spans metres of empty air (coarse, shimmering shadows) and its offset is about a block wide.
    scale(s){
      if(s===shadowScale)return;shadowScale=s;
      const r=fitRadius*1.1*s,cam=sun.shadow.camera;Object.assign(cam,{left:-r,right:r,top:r,bottom:-r,near:.1*s,far:fitRadius*5*s});cam.updateProjectionMatrix();
      sun.shadow.normalBias=.035*s;
    },
    // Return one architectural piece, still owned by the original tile for picking and moving.
    piece(c,solids,{kind='stone',variant=0}={},around=null){
      const out=[],moving=kind==='mover',shy=kind==='shy';
      const wall=shy?kit.shy:moving?kit.mover:kit.variants[variant%kit.variants.length],cap=shy?kit.shy:moving?kit.moverTop:kit.cap,base=moving?kit.moverBase:kit.base;
      const top=shy?kit.shy:moving?kit.moverTop:kind==='start'?kit.start:kit.top;
      const add=(geo,mat,at,scale,decorative=false)=>{const m=new THREE.Mesh(geo,mat);m.position.set(...at);if(scale)m.scale.set(...scale);m.castShadow=m.receiveShadow=true;m.userData.decorative=decorative;out.push(m);return m;};
      for(const solid of solids){
        if(solid.box){
          const [at,h]=solid.box,band=Math.min(.075,h[1]*.28),inset=c.shape==='stair'?.004:.012;
          const core=add(unitBox,[wall,wall,top,base,wall,wall],at,[h[0]*2-inset*2,h[1]*2-band*2,h[2]*2-inset*2]);
          const upper=add(unitBox,[cap,cap,top,base,cap,cap],[at[0],at[1]+h[1]-band/2,at[2]],[h[0]*2,band,h[2]*2]);
          const lower=add(unitBox,base,[at[0],at[1]-h[1]+band/2,at[2]],[h[0]*2,band,h[2]*2]);
          // Fill between the two band planes exactly. Only the narrow vertical facade is recessed.
          core.scale.y=h[1]*2-band*2;
          if(c.shape==='wall'){
            const origin=new THREE.Vector3(...at),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...c.up));
            for(const m of [core,upper,lower]){m.position.sub(origin).applyQuaternion(q).add(origin);m.quaternion.copy(q);}
          }
          if(c.shape==='stair'||c.shape==='wall'||shy)continue;
          for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
            if(around?.has(`${c.x+dx},${c.y},${c.z+dz}`))continue;
            // A quiet lip under the cap; panel joints belong only to the space chapter.
            const y=at[1]+h[1]-band-.035;
            add(moulding,moving?kit.mover:kit.trim,[at[0]+dx*(h[0]-.009),y,at[2]+dz*(h[2]-.009)],dx?[.022,.025,h[2]*2-.055]:[h[0]*2-.055,.025,.022],true);
            if(kit.p.material==='metal'&&!moving)for(const end of [-1,1]){
              add(moulding,kit.trim,[at[0]+dx*(h[0]-.009)+dz*end*(h[0]-.075),at[1]-.012,at[2]+dz*(h[2]-.009)+dx*end*(h[2]-.075)],dx?[.022,h[1]*2-band*2-.05,.028]:[.028,h[1]*2-band*2-.05,.022],true);
            }
          }
        }else{
          const [x,z,r,y0,y1]=solid.cyl;
          // Stop the shaft inside the collars: shared end planes flicker at the base in VR.
          add(columnGeometry,[wall,cap,base],[x,(y0+y1)/2,z],[r*.96,y1-y0-.18,r*.96]);
          for(const y of [y0+.045,y1-.045])add(columnGeometry,cap,[x,y,z],[r*1.06,.09,r*1.06]);
          for(const y of [y0+.1,y1-.1])add(columnGeometry,kit.trim,[x,y,z],[r*1.015,.018,r*1.015]);
        }
      }
      return out;
    },
    finish(group){
      group.traverse(o=>{if(!o.isMesh||o.material?.transparent)return;o.castShadow=o.receiveShadow=true;});
    },
    stats:()=>({chapter:kit.name,ready,materials:kits.size,textureFiles:0,assetErrors,shadowSize:sun.shadow.mapSize.x})
  };
}

// Detail the existing chapter landmarks rather than replacing them with unrelated stock models.
const landmarkFinishes=new Map();
export function dressLandmark(group,name,{light=null}={}){
  const p=ART[name]??ART.Home;
  if(!landmarkFinishes.has(name))landmarkFinishes.set(name,{stone:surfaceMaterial('plaster',{color:p.cap}),metal:new THREE.MeshStandardMaterial({color:p.accent,metalness:.65,roughness:.3})});
  const {stone,metal}=landmarkFinishes.get(name);
  const band=(radius,y,height=.025,material=metal)=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,40),material);mesh.position.y=y;group.add(mesh);};
  if(name==='Castle'){band(.405,.08,.07,stone);band(.375,.82,.035,stone);band(.365,.35,.025,stone);}
  else if(name==='Santorini'){band(.245,.61,.035,stone);band(.225,.56,.015,metal);}
  else if(name==='Desert'){band(.29,.44,.025,metal);}
  else if(name==='Cloud kingdom'){band(.39,.09,.022,metal);band(.365,.49,.02,metal);}
  else if(name==='The stars'){band(.345,.08,.05,stone);band(.335,.49,.024,metal);}
  else if(name==='Space'){band(.358,.08,.025,metal);band(.345,.24,.025,metal);}
  if(['Beach','Snowy mountains','Venice'].includes(name)){
    for(const x of [-.275,.275]){const post=new THREE.Mesh(softBox(.035,.36,.035),stone);post.position.set(x,.2,.26);group.add(post);}
    const lintel=new THREE.Mesh(softBox(.52,.035,.035),stone);lintel.position.set(0,.39,.27);group.add(lintel);
  }
  // A raised, bevelled surround gives the original warm doorway a readable depth.
  const shape=light?.geometry.parameters?.shapes;
  if(shape?.getPoints){
    const points=shape.getPoints(28),outer=new THREE.Shape(points.map(v=>new THREE.Vector2(v.x*1.24,v.y*1.12)));
    outer.holes.push(new THREE.Path(points.slice().reverse()));
    const frame=new THREE.Mesh(new THREE.ExtrudeGeometry(outer,{depth:.022,curveSegments:24,steps:1,bevelEnabled:true,bevelSize:.004,bevelThickness:.004,bevelSegments:2}),stone);
    frame.position.copy(light.position);frame.position.z+=.008;group.add(frame);
  }
  group.traverse(o=>{if(o.isMesh&&!o.material?.transparent){o.castShadow=o.receiveShadow=true;}});
  return group;
}

// The arches sit entirely below the walkable deck. They shape the silhouette without hiding
// the edges used for photography or adding surfaces that look like a second playable path.
export function arcadeSpan(kit,a,b,moving=false){
  const length=Math.abs(a[0]-b[0])+Math.abs(a[2]-b[2])+1,half=length/2-.02;
  const s=new THREE.Shape();s.moveTo(-half,-1.35);s.lineTo(-half,-.48);s.lineTo(half,-.48);s.lineTo(half,-1.35);
  s.lineTo(half-.18,-1.35);s.lineTo(half-.18,-1.15);s.quadraticCurveTo(0,-.55,-half+.18,-1.15);s.lineTo(-half+.18,-1.35);s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:.12,steps:1,curveSegments:12,bevelEnabled:true,bevelSize:.008,bevelThickness:.008,bevelSegments:1});g.translate(0,0,-.06);
  return [-1,1].map(side=>{const m=new THREE.Mesh(g,moving?kit.mover:kit.trim),alongX=a[0]!==b[0];
    m.position.set((a[0]+b[0])/2+(alongX?0:side*.42),a[1],(a[2]+b[2])/2+(alongX?side*.42:0));m.rotation.y=alongX?0:Math.PI/2;m.userData.decorative=true;return m;});
}

// Batch stationary architecture within each static/moving parent. Triangle ownership preserves
// exact tile picking after batching; plates, flags, transparent previews and particles stay separate.
export function batchArchitecture(parent,shared=new Set()){
  const buckets=new Map(),remove=[],disposed=new Set(),normalMatrix=new THREE.Matrix3(),v=new THREE.Vector3();
  for(const mesh of parent.children){
    if(!mesh.isMesh||mesh.children.length||mesh.userData.noBatch)continue;
    const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    if(materials.some(m=>m.transparent)||!mesh.geometry.attributes.position)continue;
    mesh.updateMatrix();normalMatrix.getNormalMatrix(mesh.matrix);
    const g=mesh.geometry,position=g.attributes.position,normal=g.attributes.normal,uv=g.attributes.uv,color=g.attributes.color,index=g.index;
    const groups=Array.isArray(mesh.material)?g.groups:[{start:0,count:index?index.count:position.count,materialIndex:0}];
    for(const group of groups){
      const material=materials[group.materialIndex??0];if(!material)continue;
      let b=buckets.get(material);if(!b){b={position:[],normal:[],uv:[],color:[],keys:[],cast:false,receive:false};buckets.set(material,b);}
      b.cast ||=mesh.castShadow;b.receive ||=mesh.receiveShadow;
      for(let j=group.start;j<group.start+group.count;j++){
        const i=index?index.getX(j):j;
        v.fromBufferAttribute(position,i).applyMatrix4(mesh.matrix);b.position.push(v.x,v.y,v.z);
        if(normal)v.fromBufferAttribute(normal,i).applyMatrix3(normalMatrix).normalize();else v.set(0,1,0);b.normal.push(v.x,v.y,v.z);
        b.uv.push(uv?uv.getX(i):0,uv?uv.getY(i):0);
        if(color)b.color.push(color.getX(i),color.getY(i),color.getZ(i));else b.color.push(1,1,1);
        if((j-group.start)%3===0)b.keys.push(mesh.userData.key??null);
      }
    }
    remove.push(mesh);if(!shared.has(g)&&!g.userData.artShared)disposed.add(g);
  }
  for(const mesh of remove)mesh.removeFromParent();for(const g of disposed)g.dispose();
  for(const [material,b] of buckets){
    const geometry=new THREE.BufferGeometry();
    for(const name of ['position','normal','uv','color'])geometry.setAttribute(name,new THREE.Float32BufferAttribute(b[name],name==='uv'?2:3));
    geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=b.cast;mesh.receiveShadow=b.receive;mesh.userData.triangleKeys=b.keys;parent.add(mesh);
  }
}
