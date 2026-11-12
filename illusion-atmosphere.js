import * as THREE from './vendor/three.module.js';

// Small, recognisable sources of light. These never join the picking/collision groups.
const V=THREE.Vector3;
const starMap=(()=>{
  const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');
  const glow=g.createRadialGradient(32,32,0,32,32,24);glow.addColorStop(0,'rgba(255,255,255,.8)');glow.addColorStop(.22,'rgba(255,255,255,.15)');glow.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=glow;g.fillRect(0,0,64,64);
  g.fillStyle='#fff';g.beginPath();for(const [x,y] of [[32,5],[35,29],[59,32],[35,35],[32,59],[29,35],[5,32],[29,29]])g.lineTo(x,y);g.closePath();g.fill();
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
})();
export function createNightAir(parent,box,name,anchors=[]){
  const group=new THREE.Group();group.name='night-atmosphere';parent.add(group);
  const sky=new THREE.Group();group.add(sky);
  const center=box.getCenter(new V()),size=box.getSize(new V());
  let seed=307+name.length*79,clock=0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const objects=[],materials=new Set(),geometries=new Set();
  const ownMat=m=>(materials.add(m),m),ownGeo=g=>(geometries.add(g),g.userData.artShared=true,g);
  const stats={kind:name,lanterns:0,fireflies:0,stars:0,aurora:0};
  const starry=['The stars','Space','Ice palace','Venice'].includes(name);
  if(starry){
    // Distant pinpoints, with a few quiet four-point stars. No large floating discs.
    for(let layer=0;layer<2;layer++){
      const n=layer?12:name==='Venice'?55:130,points=[];
      for(let i=0;i<n;i++)points.push(random()*2-1,random()*2-1,0);
      const g=ownGeo(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
      const m=ownMat(new THREE.PointsMaterial({color:layer?0xe5e8ff:0xbacdde,size:layer?7:1.5,map:layer?starMap:null,sizeAttenuation:false,transparent:true,opacity:layer?.5:.55,depthWrite:false}));
      sky.add(new THREE.Points(g,m));objects.push({type:'stars',m,phase:layer*2});stats.stars+=n;
    }
  }
  if(name==='Lantern night'||name==='Venice'){
    const body=ownGeo(new THREE.LatheGeometry([new THREE.Vector2(.075,-.2),new THREE.Vector2(.13,-.12),new THREE.Vector2(.15,.1),new THREE.Vector2(.11,.21)],8));
    const rim=ownGeo(new THREE.TorusGeometry(.11,.006,4,8).rotateX(Math.PI/2));
    const paper=ownMat(new THREE.MeshStandardMaterial({color:0xf4b56e,emissive:0xffac4d,emissiveIntensity:.55,roughness:.95,side:THREE.DoubleSide}));
    const bamboo=ownMat(new THREE.MeshStandardMaterial({color:0xcf985a,roughness:1}));
    const ember=ownMat(new THREE.MeshBasicMaterial({color:0xffe1a0})),flame=ownGeo(new THREE.OctahedronGeometry(.025));
    const count=name==='Venice'?6:12;
    for(let i=0;i<count;i++){
      const lantern=new THREE.Group();
      lantern.add(new THREE.Mesh(body,paper));
      for(const y of [-.2,.21]){const ring=new THREE.Mesh(rim,bamboo);ring.position.y=y;if(y<0)ring.scale.setScalar(.7);lantern.add(ring);}
      const fire=new THREE.Mesh(flame,ember);fire.position.y=-.17;fire.scale.y=1.5;lantern.add(fire);
      const home=new V(center.x+(random()-.5)*size.x*1.4,box.min.y+random()*(size.y+3),center.z+(random()-.5)*size.z*1.4);
      lantern.position.copy(home);lantern.scale.setScalar(.7+random()*.65);group.add(lantern);
      objects.push({type:'lantern',o:lantern,home,phase:random()*6.28,speed:.045+random()*.04});
    }stats.lanterns=count;
  }
  if(name==='Glow forest'){
    const n=22,body=ownGeo(new THREE.SphereGeometry(1,6,4)),wing=ownGeo(new THREE.PlaneGeometry(1,1));
    const lights=new THREE.InstancedMesh(body,ownMat(new THREE.MeshBasicMaterial({color:0xe0f7a6})),n);
    const wings=new THREE.InstancedMesh(wing,ownMat(new THREE.MeshBasicMaterial({color:0xd9ead5,transparent:true,opacity:.27,side:THREE.DoubleSide,depthWrite:false})),n*2);
    lights.frustumCulled=wings.frustumCulled=false;group.add(lights,wings);
    const homes=Array.from({length:n},(_,i)=>{
      const a=anchors.length?anchors[Math.floor(random()*anchors.length)]:center.toArray();
      return {home:new V(a[0]+(random()-.5)*1.3,a[1]+.8+random()*1.2,a[2]+(random()-.5)*1.3),phase:random()*6.28};
    });
    objects.push({type:'fireflies',lights,wings,homes});stats.fireflies=n;
  }
  if(name==='Ice palace'||name==='The stars'){
    // Transparent curtains high beyond the architecture, fading at every edge.
    // Their movement is slow enough that puzzle edges remain the visual focus.
    for(let layer=0;layer<2;layer++){
      const positions=[],uv=[],indices=[],steps=64;
      for(let i=0;i<=steps;i++){
        const u=i/steps;
        for(let side=0;side<2;side++){positions.push((u-.5)*2.6,.22+side*.25+layer*.17+Math.sin(u*6.28)*.14,.01);uv.push(u,side);}
        if(i<steps){const q=i*2;indices.push(q,q+1,q+2,q+1,q+3,q+2);}
      }
      const g=ownGeo(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);
      const m=ownMat(new THREE.ShaderMaterial({uniforms:{time:{value:0},scale:{value:.5},tint:{value:new THREE.Color(layer?0x9a92d6:0x79cdbb)}},transparent:true,depthWrite:false,side:THREE.DoubleSide,
        vertexShader:'varying vec2 vUv; uniform float time; uniform float scale; void main(){vUv=uv; vec3 p=position; p.y+=sin(uv.x*10.0+time*.12)*scale*.12; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}',
        fragmentShader:'varying vec2 vUv; uniform float time; uniform vec3 tint; void main(){float edge=sin(vUv.x*3.14159); float band=pow(sin(vUv.y*3.14159),1.6); float folds=.65+.35*sin(vUv.x*34.0+time*.16); gl_FragColor=vec4(tint,edge*edge*band*folds*.16);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'
      }));
      sky.add(new THREE.Mesh(g,m));objects.push({type:'aurora',m});stats.aurora++;
    }
  }
  const dummy=new THREE.Object3D();
  const direction=new V();
  function update(dt,camera,{reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,low=false,flat=true}={}){
    // The far sky is a flat backdrop for the screen camera; in a headset it would sit in the room as a small box of dots.
    group.visible=!low;sky.visible=flat;if(low)return;
    if(!reduced)clock+=dt;
    if(camera){
      // A distant sky stays behind the model as the player zooms and turns.
      sky.position.copy(camera.position).addScaledVector(camera.getWorldDirection(direction),camera.far*.8);sky.quaternion.copy(camera.quaternion);
      sky.scale.set((camera.right-camera.left)*.55,(camera.top-camera.bottom)*.55,1);
    }
    for(const a of objects){
      const t=clock+(a.phase??0);
      if(a.type==='stars')a.m.opacity=(a.phase?.46:.52)+Math.sin(t*.17)*.04;
      if(a.type==='aurora')a.m.uniforms.time.value=clock;
      if(a.type==='lantern'){
        const span=size.y+3,y=box.min.y+(a.home.y-box.min.y+clock*a.speed)%span;
        a.o.position.set(a.home.x+Math.sin(t*.35)*.23,y,a.home.z+Math.cos(t*.24)*.2);a.o.rotation.set(Math.sin(t*.3)*.065,t*.035,Math.cos(t*.25)*.05);
      }
      if(a.type==='fireflies'){
        a.homes.forEach(({home,phase},i)=>{
          const t=clock*.5+phase,p=home.clone().add(new V(Math.sin(t)*.45,Math.sin(t*1.4)*.17,Math.cos(t*.8)*.32));
          dummy.position.copy(p);dummy.rotation.set(0,t,0);dummy.scale.set(.018,.027,.018).multiplyScalar(.7+.3*Math.sin(t*1.8)**2);dummy.updateMatrix();a.lights.setMatrixAt(i,dummy.matrix);
          for(let side=0;side<2;side++){dummy.position.copy(p).add(new V((side?1:-1)*.027,.012,0));dummy.rotation.set(.5,side?-.6:.6,Math.sin(t*12)*.25);dummy.scale.set(.042,.018,1);dummy.updateMatrix();a.wings.setMatrixAt(i*2+side,dummy.matrix);}
        });a.lights.instanceMatrix.needsUpdate=a.wings.instanceMatrix.needsUpdate=true;
      }
    }
  }
  update(0);
  return {stats,update,dispose(){group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});group.removeFromParent();for(const m of materials)m.dispose();for(const g of geometries)g.dispose();}};
}
