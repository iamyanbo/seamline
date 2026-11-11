// Your hands in a headset: a smooth, skinned hand (the standard WebXR generic hand, in vendor/hands) in
// the game's warm paper colour, its skeleton driven by the tracked joints, so it bends and stretches
// with your own hand. Shading is a gentle light from above with a pale rim, so the hand reads as a solid
// shape in any level's light. The thumb and index tips warm to gold as they come together for a pinch.
// Until the mesh has loaded (or if it cannot load) a simpler hand made of rounded segments stands in.
// In the real room (passthrough) your own hands are there to see, so the hand is not drawn: it becomes
// a cut-out instead, clearing a hand-shaped window through anything virtual behind it, so your real hand
// shows in front of the island as it would in front of a real thing.
// A ghost hand (the guide's demonstrations) is the same hand, see-through: it is drawn into depth first
// so only its front surface shows, evenly. Its joints come as positions only; orientJoints() turns them
// to match, as a tracked hand's would be.
import {GLTFLoader} from './vendor/loaders/GLTFLoader.js';
import {clone as cloneSkinned} from './vendor/utils/SkeletonUtils.js';

const FINGERS=[
  ['thumb-metacarpal','thumb-phalanx-proximal','thumb-phalanx-distal','thumb-tip'],
  ...['index','middle','ring','pinky'].map(f=>['metacarpal','phalanx-proximal','phalanx-intermediate','phalanx-distal','tip'].map(j=>`${f}-finger-${j}`))
];
const JOINTS=['wrist',...FINGERS.flat()];
const BONES=FINGERS.flatMap(chain=>[['wrist',chain[0]],...chain.slice(1).map((j,i)=>[chain[i],j])]);
const PALM=new Set(['index','middle','ring','pinky'].map(f=>`${f}-finger-metacarpal`));
const TIPS=new Set(['thumb-phalanx-distal','thumb-tip','index-finger-phalanx-distal','index-finger-tip']);
// Radii (metres) for the stand-in hand when the headset gives none.
const fallback=n=>n==='wrist'?.016:n.includes('metacarpal')?.011:n.endsWith('tip')?.0075:n.startsWith('thumb')?.0105:n.startsWith('pinky')?.0075:.009;
const radiusOf=(n,joint)=>{
  const r=joint?.jointRadius;let base=r>0?Math.min(.02,Math.max(.005,r)):fallback(n);
  if(n==='wrist')base=Math.min(Math.max(base,.015),.018);else if(PALM.has(n))base=Math.min(Math.max(base,.011),.013);
  return base;
};

// Shading shared by both hands. vTip is how close a point is to the pinching fingertips.
const fragment=`
uniform vec3 uColor;
uniform vec3 uTip;
uniform float uTipMix;
uniform vec3 uRim;
uniform float uOpacity;
varying vec3 vNormal;
varying vec3 vView;
varying float vTip;
void main(){
  vec3 n=normalize(vNormal),v=normalize(vView);
  float facing=abs(dot(n,v));
  // A soft key light from above and a little in front, wrapped so the shadow side stays light.
  float key=dot(n,normalize(vec3(0.25,0.85,0.45)))*0.5+0.5;
  vec3 base=mix(uColor,uTip,vTip*uTipMix);
  vec3 col=base*(0.7+0.36*key);
  col=mix(col,uRim,pow(1.0-facing,2.4)*0.5);
  gl_FragColor=vec4(col,uOpacity);
  #include <colorspace_fragment>
}`;
const CLEAR='void main(){gl_FragColor=vec4(0.0);}';
// The skinned hand: the mesh's own skinning, then the same shading.
const skinnedVertex=`
#include <common>
#include <skinning_pars_vertex>
uniform vec3 uThumb;
uniform vec3 uIndex;
varying vec3 vNormal;
varying vec3 vView;
varying float vTip;
void main(){
  #include <beginnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  vec4 mv=modelViewMatrix*vec4(transformed,1.0);
  vNormal=normalize(normalMatrix*objectNormal);
  vView=-mv.xyz;
  vTip=1.0-smoothstep(0.01,0.03,min(distance(transformed,uThumb),distance(transformed,uIndex)));
  gl_Position=projectionMatrix*mv;
}`;
// The stand-in hand: instanced knuckles and tapered bones.
const segmentVertex=`
attribute float aTaper;
attribute float aTip;
varying vec3 vNormal;
varying vec3 vView;
varying float vTip;
void main(){
  vec3 p=position;
  #ifdef TAPER
  p.xz*=mix(1.0,aTaper,position.y+0.5);
  #endif
  vec4 mv=modelViewMatrix*instanceMatrix*vec4(p,1.0);
  vNormal=normalize(normalMatrix*mat3(instanceMatrix)*normal);
  vView=-mv.xyz;
  vTip=aTip;
  gl_Position=projectionMatrix*mv;
}`;

// The hand meshes, loaded once per side.
const meshes={};
const loadMesh=side=>meshes[side]??=new GLTFLoader().loadAsync(new URL(`./vendor/hands/${side}.glb`,import.meta.url).href);

// Joint turns from joint positions alone (WebXR's convention: each joint looks down its bone, -z toward
// the fingertip, +y out of the back of the hand or nail). The fingers bend about the palm's width; the
// thumb's nail faces along the palm, across the hand.
export function orientJoints(THREE,joints,side){
  const V3=THREE.Vector3,P=n=>joints[n].position,w=P('wrist');
  const n=new V3().crossVectors(P('pinky-finger-metacarpal').clone().sub(w),P('index-finger-metacarpal').clone().sub(w)).normalize();
  const back=n.multiplyScalar(side==='left'?-1:1),toward=P('middle-finger-phalanx-proximal').clone().sub(w).normalize();
  const width=new V3().crossVectors(back,toward).normalize(),m=new THREE.Matrix4(),x=new V3(),y=new V3(),z=new V3();
  const set=(name,dir,up)=>{
    z.copy(dir).negate().normalize();y.copy(up).addScaledVector(z,-up.dot(z));
    if(y.lengthSq()<1e-8)y.copy(back).addScaledVector(z,-back.dot(z));
    y.normalize();x.crossVectors(y,z);(joints[name].quaternion??=new THREE.Quaternion()).setFromRotationMatrix(m.makeBasis(x,y,z));
  };
  set('wrist',toward,back);
  for(const chain of FINGERS){
    const thumb=chain[0].startsWith('thumb');let dir=null;
    chain.forEach((name,i)=>{
      if(i<chain.length-1)dir=P(chain[i+1]).clone().sub(P(name)).normalize();
      const up=thumb?new V3().crossVectors(dir,back).multiplyScalar(side==='left'?1:-1):new V3().crossVectors(width,dir.clone().negate());
      set(name,dir,up);
    });
  }
  return joints;
}

export function createHandModel(THREE,{ghost=false,color=0xf4ece0,side='left'}={}){
  const V3=THREE.Vector3,group=new THREE.Group();group.visible=false;
  const uniforms={uOpacity:{value:1},uColor:{value:new THREE.Color(color)},uTip:{value:new THREE.Color(0xffc861)},uTipMix:{value:0},uRim:{value:new THREE.Color(0xffffff)},
    uThumb:{value:new V3(0,-99,0)},uIndex:{value:new V3(0,-99,0)}};
  // UI surfaces write their own depth over the island. Draw tracked hands after UI so
  // each finger still falls in front of or behind the card at its real depth.
  const look=ghost?{transparent:true,depthWrite:false,depthFunc:THREE.LessEqualDepth}:{transparent:true,depthWrite:true};
  const shaded=(vertexShader,defines={})=>new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader:fragment,defines,toneMapped:false,side:THREE.DoubleSide,...look});
  const cut=(vertexShader,defines={})=>new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader:CLEAR,defines,transparent:true,blending:THREE.NoBlending,toneMapped:false,side:THREE.DoubleSide});
  const depthOnly=(vertexShader,defines={})=>new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader:CLEAR,defines,colorWrite:false,side:THREE.DoubleSide});
  let cutout=false;
  // Each part: its drawn and cut-out materials, and the order it draws in.
  const parts=[];
  const part=(mesh,vertexShader,defines)=>{
    const p={mesh,drawn:shaded(vertexShader,defines),cut:cut(vertexShader,defines)};
    mesh.material=cutout?p.cut:p.drawn;mesh.renderOrder=ghost?13:50;mesh.frustumCulled=false;parts.push(p);return p;
  };

  // The stand-in hand.
  const knuckleGeo=new THREE.SphereGeometry(1,16,12),boneGeo=new THREE.CylinderGeometry(1,1,1,14,1,true);
  const flag=(geo,count)=>{for(const name of ['aTaper','aTip'])geo.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(count).fill(name==='aTaper'?1:0),1));};
  flag(knuckleGeo,JOINTS.length);flag(boneGeo,BONES.length);
  JOINTS.forEach((n,i)=>{knuckleGeo.attributes.aTip.array[i]=TIPS.has(n)?1:0;});
  BONES.forEach(([,b],i)=>{boneGeo.attributes.aTip.array[i]=TIPS.has(b)?1:0;});
  const knuckles=new THREE.InstancedMesh(knuckleGeo,null,JOINTS.length),bones=new THREE.InstancedMesh(boneGeo,null,BONES.length);
  const standIn=new THREE.Group();standIn.add(knuckles,bones);group.add(standIn);
  part(knuckles,segmentVertex);part(bones,segmentVertex,{TAPER:''});
  if(ghost)for(const [geo,mesh] of [[knuckleGeo,knuckles],[boneGeo,bones]]){
    const depth=new THREE.InstancedMesh(geo,depthOnly(segmentVertex,geo===boneGeo?{TAPER:''}:{}),mesh.count);
    depth.instanceMatrix=mesh.instanceMatrix;depth.frustumCulled=false;depth.renderOrder=12;standIn.add(depth);
  }
  const radii=new Map(),m=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new V3(),up=new V3(0,1,0),d=new V3(),mid=new V3(),none=new THREE.Quaternion();
  function poseStandIn(joints){
    for(const n of JOINTS)if(!radii.has(n))radii.set(n,radiusOf(n,joints[n]));
    JOINTS.forEach((n,i)=>knuckles.setMatrixAt(i,m.compose(joints[n].position,none,s.setScalar(radii.get(n)))));
    const taper=boneGeo.attributes.aTaper.array;
    BONES.forEach(([a,b],i)=>{
      const A=joints[a].position,B=joints[b].position,len=A.distanceTo(B);
      // A bone never starts much wider than it ends, so the wrist does not flare into the palm.
      const ra=Math.min(radii.get(a),radii.get(b)*1.25),rb=radii.get(b);
      d.copy(B).sub(A);if(len>1e-5)q.setFromUnitVectors(up,d.multiplyScalar(1/len));
      mid.copy(A).add(B).multiplyScalar(.5);bones.setMatrixAt(i,m.compose(mid,q,s.set(ra,Math.max(len,1e-4),ra)));taper[i]=rb/ra;
    });
    knuckles.instanceMatrix.needsUpdate=bones.instanceMatrix.needsUpdate=boneGeo.attributes.aTaper.needsUpdate=true;
  }

  // The real hand, once loaded: its bones sit flat under the armature, so each takes its joint's pose.
  let skin=null;
  loadMesh(side).then(gltf=>{
    const armature=cloneSkinned(gltf.scene.children[0]),mesh=armature.getObjectByProperty('type','SkinnedMesh');
    if(!mesh)return;
    for(const o of [...armature.children])if(o!==mesh&&!JOINTS.includes(o.name))armature.remove(o);
    part(mesh,skinnedVertex);
    if(ghost){const depth=new THREE.SkinnedMesh(mesh.geometry,depthOnly(skinnedVertex));depth.bind(mesh.skeleton,mesh.bindMatrix);depth.frustumCulled=false;depth.renderOrder=12;armature.add(depth);}
    skin={armature,bones:JOINTS.map(n=>armature.getObjectByName(n))};
    if(skin.bones.some(b=>!b)){skin=null;return;}
    standIn.visible=false;group.add(armature);
  }).catch(()=>{});

  return {
    group,
    get mode(){return cutout?'cutout':'drawn';},
    get mesh(){return skin?'skinned':'segments';},
    // true: show the real hand (a cut-out); false: draw the hand.
    setCutout(on){
      if(ghost||cutout===on)return;
      cutout=on;for(const p of parts){p.mesh.material=on?p.cut:p.drawn;p.mesh.renderOrder=50;}
    },
    // joints: the tracked hand's joints (three.js XRHand), or positions with turns from orientJoints().
    // tipMix 0..1 warms the pinching fingertips.
    update(joints,{tipMix=0,opacity=1}={}){
      uniforms.uOpacity.value=opacity;
      if(opacity<.01||JOINTS.some(n=>!joints[n]?.visible)){group.visible=false;return false;}
      group.visible=true;
      if(skin)JOINTS.forEach((n,i)=>{const b=skin.bones[i];b.position.copy(joints[n].position);if(joints[n].quaternion)b.quaternion.copy(joints[n].quaternion);});
      else poseStandIn(joints);
      uniforms.uThumb.value.copy(joints['thumb-tip'].position);uniforms.uIndex.value.copy(joints['index-finger-tip'].position);
      uniforms.uTipMix.value=tipMix;
      return true;
    },
    // The hand's colour: warm paper, a little warmer when it could grab, gold while it holds.
    setColor(hex){uniforms.uColor.value.setHex(hex);},
    hide(){group.visible=false;}
  };
}
