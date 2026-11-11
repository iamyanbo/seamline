import * as THREE from './vendor/three.module.js';
import {surfaceMaterial,softBox,batchArchitecture} from './illusion-art.js';
const side=surfaceMaterial('stone',{color:0xdac9a8,roughness:.8});
export const kyotoMetal=new THREE.MeshStandardMaterial({color:0x263f38,metalness:.55,roughness:.32});
export const kyotoLacquer=new THREE.MeshPhysicalMaterial({color:0xaf3b24,roughness:.28,clearcoat:.7,clearcoatRoughness:.23});
export const kyotoRoof=new THREE.MeshStandardMaterial({color:0x2b3c3b,metalness:.25,roughness:.38});
export const kyotoBrass=new THREE.MeshStandardMaterial({color:0xc29a53,metalness:.72,roughness:.28});

// Curved eaves and smooth columns give the chapter's destination an architectural silhouette.
// All of this sits on the goal tile; it does not change its walkable edge or the puzzle graph.
const paper=new THREE.MeshStandardMaterial({color:0xe3d6b8,roughness:.9,emissive:0xffb45e,emissiveIntensity:.12});
const roofSurface=kyotoRoof.clone();roofSurface.side=THREE.DoubleSide;
const roofUnderside=kyotoLacquer.clone();roofUnderside.side=THREE.BackSide;
export function curvedRoof(width,height){
  const points=[],indices=[],rows=14,cols=24;
  for(let side=0;side<4;side++){
    const base=points.length/3,angle=side*Math.PI/2;
    for(let r=0;r<=rows;r++)for(let c=0;c<=cols;c++){
      const t=r/rows,u=c/cols*2-1,span=width*.5*(1-.72*t),x=u*span,z=span;
      const y=height*t*t+.045*Math.pow(Math.abs(u),6)*Math.pow(1-t,3);
      points.push(x*Math.cos(angle)+z*Math.sin(angle),y,-x*Math.sin(angle)+z*Math.cos(angle));
    }
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const a=base+r*(cols+1)+c,b=a+cols+1;indices.push(a,a+1,b,a+1,b+1,b);
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function createKyotoHome({light=null,spin=null}={}){
  const group=new THREE.Group();
  const add=(geometry,material,x,y,z)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;};
  add(new THREE.CylinderGeometry(.34,.38,.08,32),side,0,.04,0);
  for(let floor=0;floor<3;floor++){
    const y=.08+floor*.34,w=.47-floor*.095;
    add(softBox(w,.23,w),paper,0,y+.115,0);
    for(const x of [-1,1])for(const z of [-1,1])add(new THREE.CylinderGeometry(.016,.022,.25,16),kyotoLacquer,x*w*.5,y+.125,z*w*.5);
    for(const z of [-1,1])add(softBox(w+.04,.035,.035),kyotoLacquer,0,y+.215,z*w*.5);
    for(const face of floor?[-1,1]:[-1]){
      for(const x of [-.25,0,.25])add(softBox(.009,.16,.009),kyotoLacquer,x*w,y+.13,face*(w/2+.008));
      for(const yy of [.09,.16])add(softBox(w-.04,.009,.009),kyotoLacquer,0,y+yy,face*(w/2+.008));
    }
    const roof=add(curvedRoof(w+.3,.15),roofSurface,0,y+.24,0);
    // A thin underside makes the eaves read as a roof rather than a single polygon.
    const under=add(roof.geometry.clone(),roofUnderside,0,y+.224,0);under.castShadow=false;
  }
  add(new THREE.CylinderGeometry(.008,.016,.24,20),kyotoBrass,0,1.19,0);
  for(const y of [1.1,1.15,1.2])add(new THREE.TorusGeometry(.035,.006,8,24).rotateX(Math.PI/2),kyotoBrass,0,y,0);
  if(light){const door=new THREE.Shape();door.moveTo(-.075,0);door.lineTo(-.075,.18);door.quadraticCurveTo(0,.22,.075,.18);door.lineTo(.075,0);door.closePath();light.geometry=new THREE.ShapeGeometry(door);light.position.set(0,.08,.242);group.add(light);}
  if(spin){spin.userData.noBatch=true;spin.position.y=1.5;group.add(spin);}
  batchArchitecture(group);
  return group;
}

