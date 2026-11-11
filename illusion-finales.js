import * as THREE from './vendor/three.module.js';

const FINALES=[
  ['lanterns',0xffc879],
  ['garden',0xf3bbcf],
  ['canopy',0xe8b65e],
  ['lanterns',0xffcd8b],
  ['stars',0xbcdfff],
  ['lanterns',0xffce87],
  ['lanterns',0xffd28a],
  ['canopy',0xf2d8a0],
  ['lanterns',0xffb75f],
  ['stars',0x9de8ed],
  ['lanterns',0xffd392],
  ['garden',0xb4eab0],
  ['canopy',0xf5d59b],
  ['stars',0xc0d9ff]
];
export const chapterFinales=(levels,order)=>new Set(order.filter((i,k)=>k===order.length-1||levels[order[k+1]].palette!==levels[i].palette));

// Completion scenery lives outside the puzzle's picking and geometry groups.
export function createFinale(parent,{chapter,goal,box,kit,texture,yaw=0}){
  const [kind,color]=FINALES[chapter]??FINALES[5],group=new THREE.Group();group.name='chapter-finale';group.visible=false;parent.add(group);
  const geometries=new Set(),materials=new Set(),lamps=[],parts=[],windows=[];
  const geo=g=>(geometries.add(g),g),mat=m=>(materials.add(m),m);
  const glow=mat(new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.1,roughness:.7}));
  const frame=mat(new THREE.MeshStandardMaterial({color:0x997449,metalness:.45,roughness:.45}));
  const center=box.getCenter(new THREE.Vector3()),extent=box.getSize(new THREE.Vector3()),at=new THREE.Vector3(...goal);
  let time=0,started=false;
  const mesh=(g,m,p,s=1,host=group)=>{const o=new THREE.Mesh(g,m);o.position.copy(p);o.scale.setScalar(s);host.add(o);return o;};
  if(kind==='lanterns'){
    const paper=geo(new THREE.CylinderGeometry(.11,.14,.28,8)),rim=geo(new THREE.TorusGeometry(.11,.013,4,12));
    const halo=mat(new THREE.SpriteMaterial({map:texture,color,transparent:true,opacity:.25,depthWrite:false,blending:THREE.AdditiveBlending}));
    for(let i=0;i<12;i++){
      const a=i*Math.PI*2/12,r=.8+Math.max(extent.x,extent.z)*.42,home=new THREE.Vector3(center.x+Math.cos(a)*r,box.min.y+.2+(i%3)*.3,center.z+Math.sin(a)*r);
      const lantern=new THREE.Group();lantern.position.copy(home);group.add(lantern);mesh(paper,glow,new THREE.Vector3(),1,lantern);
      const light=new THREE.Sprite(halo);light.scale.setScalar(.8);lantern.add(light);
      for(const y of [-.14,.14]){const edge=mesh(rim,frame,new THREE.Vector3(0,y,0),1,lantern);edge.rotation.x=Math.PI/2;}
      lamps.push({object:lantern,home,delay:i*.11});
    }
  }else if(kind==='garden'||kind==='canopy'){
    // A destination pavilion: hinged ribs open like the petals of a flower.
    const pavilion=new THREE.Group();pavilion.position.copy(at).add(new THREE.Vector3(0,1.15,0));group.add(pavilion);
    const rib=geo(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(),new THREE.Vector3(.25,.9,0),new THREE.Vector3(1.25,1.1,0)),20,.025,6,false));
    const leaf=geo(new THREE.SphereGeometry(1,16,10));
    const paper=mat(new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.15,roughness:.7,transparent:true,opacity:.7,side:THREE.DoubleSide}));
    for(let i=0;i<8;i++){
      const anchor=new THREE.Group(),hinge=new THREE.Group();anchor.rotation.y=i*Math.PI/4;anchor.add(hinge);pavilion.add(anchor);
      mesh(rib,kind==='garden'?glow:frame,new THREE.Vector3(),1,hinge);
      const petal=mesh(leaf,paper,new THREE.Vector3(.75,.82,0),1,hinge);petal.scale.set(.66,.055,.25);petal.rotation.z=.42;
      parts.push({hinge,delay:i*.07});
    }
  }else{
    // Stars trace a crown behind the destination, connected by fine golden lines.
    const star=geo(new THREE.OctahedronGeometry(.11)),points=[],right=new THREE.Vector3(Math.cos(yaw*Math.PI/180),0,-Math.sin(yaw*Math.PI/180));
    for(let i=0;i<9;i++){
      const a=i*Math.PI/4,p=at.clone().addScaledVector(right,Math.cos(a)*2).add(new THREE.Vector3(0,3.4+Math.sin(a)*1.1,0));points.push(p);
      const object=mesh(star,glow,p);lamps.push({object,home:p.clone(),delay:i*.15});
    }
    const lineMat=mat(new THREE.LineBasicMaterial({color,transparent:true,opacity:0}));
    const line=new THREE.Line(geo(new THREE.BufferGeometry().setFromPoints(points)),lineMat);group.add(line);parts.push({line,lineMat});
  }
  function lightWindows(){
    const replacements=new Map();
    const replace=m=>{
      if(!m||![kit.window,kit.litWindow,kit.paper].includes(m))return m;
      if(!replacements.has(m)){const copy=mat(m.clone());copy.color.setHex(color);copy.emissive?.setHex(color);copy.emissiveIntensity=0;replacements.set(m,copy);}
      return replacements.get(m);
    };
    parent.traverse(o=>{if(!o.isMesh||!o.material)return;const original=o.material,next=Array.isArray(original)?original.map(replace):replace(original);if(Array.isArray(original)?next.some((m,i)=>m!==original[i]):next!==original){windows.push({object:o,original});o.material=next;}});
    return [...replacements.values()];
  }
  let lit=[];
  function reset(){
    for(const {object,original} of windows)object.material=original;windows.length=0;
    for(const m of lit){m.dispose();materials.delete(m);}lit=[];time=0;started=false;group.visible=false;
  }
  function update(dt,reduced=false){
    if(!started)return;time=reduced?4:Math.min(4,time+dt);
    const progress=Math.min(1,time/2.8);
    for(const m of lit)m.emissiveIntensity=progress*.9;
    for(const {object,home,delay} of lamps){
      const k=Math.max(0,Math.min(1,(time-delay)/2)),ease=k*k*(3-2*k);object.scale.setScalar(.05+.95*ease);
      object.position.copy(home);if(kind==='lanterns')object.position.y+=ease*(1.5+extent.y*.35);object.rotation.y=kind==='stars'?Math.PI/4:ease*.3;
    }
    for(const part of parts){
      if(part.hinge){const k=Math.max(0,Math.min(1,(time-part.delay)/2.1));part.hinge.rotation.z=(1-k*k*(3-2*k))*1.22;}
      if(part.lineMat)part.lineMat.opacity=Math.max(0,(progress-.25)/.75)*.65;
    }
  }
  return {kind,start(reduced=false){if(started)return;started=true;group.visible=true;lit=lightWindows();update(0,reduced);},update,reset,
    framingPoints:()=>[-2.2,2.2].flatMap(x=>[-2.2,2.2].map(z=>[at.x+x,at.y+(kind==='stars'?4.6:2.4),at.z+z])),
    state:()=>({kind,started,settled:time>=4,windows:windows.length,parts:lamps.length+parts.length}),
    dispose(){reset();group.removeFromParent();for(const m of materials)m.dispose();for(const g of geometries)g.dispose();}
  };
}
