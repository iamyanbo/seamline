// Small photo-reactive inhabitants, using the same world and capture geometry as
// the ordinary paths. This module has no renderer or browser dependencies.
import {movedPoint,hiddenAlong,add,scale,dot,cross,norm} from './illusion-geometry.js';
export function eyePose(L,ks,eye){
  const host=(L.movers??[]).findIndex(m=>m.blocks.some(b=>b.slice(0,3).join()===eye.at.join()));
  const at=host<0?eye.at:movedPoint(L.movers[host],ks[host],eye.at).slice(0,3);
  const turn=eye.shy?eye.beam:host,m=turn<0?null:L.movers?.[turn];
  const a=m?(m.angle??180)*(ks[turn]??0)*Math.PI/180:0,c=Math.cos(a),s=Math.sin(a),[x,z]=eye.face;
  return {point:[at[0],at[1]+.85,at[2]],at,face:[x*c+z*s,0,-x*s+z*c]};
}
export function eyeBounds(point){return [point,...[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].map(d=>add(point,scale(d,.32)))];}
export function photographedEyes(L,ks,dir,cells,inside=()=>true){
  return (L.eyes??[]).reduce((mask,eye,i)=>{
    const p=eyePose(L,ks,eye);
    return dot(p.face,dir)>=.35&&eyeBounds(p.point).every(inside)&&!hiddenAlong(cells,p.point,dir,'')?mask|1<<i:mask;
  },0);
}
export function photoBasis(dir){
  const h=Math.hypot(dir[0],dir[2]),right=h?[dir[2]/h,0,-dir[0]/h]:[1,0,0];
  return {right,up:norm(cross(dir,right))};
}
export function photoBox(points,dir,pad=.14){
  if(!points.length)return null;const {right,up}=photoBasis(dir),xs=points.map(p=>dot(p,right)),ys=points.map(p=>dot(p,up));
  return [Math.min(...xs)-pad,Math.max(...xs)+pad,Math.min(...ys)-pad,Math.max(...ys)+pad];
}
export function boxContains(box,dir){const {right,up}=photoBasis(dir);return p=>{const x=dot(p,right),y=dot(p,up);return x>=box[0]-1e-8&&x<=box[1]+1e-8&&y>=box[2]-1e-8&&y<=box[3]+1e-8;};}
export function boxCorners(box,dir){const {right,up}=photoBasis(dir);return [[box[0],box[2]],[box[1],box[2]],[box[1],box[3]],[box[0],box[3]]].map(([x,y])=>add(scale(right,x),scale(up,y)));}
export function seamPhotoPoints(s){return [s.ea,s.eb].flatMap(e=>[add(e.mid,e.half),add(e.mid,scale(e.half,-1)),e.inside]);}
