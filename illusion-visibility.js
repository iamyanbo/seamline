const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]);
function clip(poly,a,b,limit){
 const next=[];for(let i=0;i<poly.length;i++){
  const p=poly[i],q=poly[(i+1)%poly.length],fp=a*p[0]+b*p[1]-limit,fq=a*q[0]+b*q[1]-limit;
  if(fp<=0)next.push(p);
  if((fp<0)!==(fq<0)){const t=fp/(fp-fq);next.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}
 }return next;
}
const sheet=()=>[[-1,0],[1,0],[1,160],[-1,160]];
export function sheetHitsBox(mid,half,v,[c,h]){
 let poly=sheet();for(let axis=0;axis<3;axis++)for(const side of [-1,1]){
  poly=clip(poly,side*half[axis],side*v[axis],h[axis]-1e-7-side*(mid[axis]-c[axis]));if(poly.length<3)return false;
 }return true;
}
export function sheetHitsCylinder(mid,half,v,[cx,cz,r,y0,y1]){
 let poly=clip(sheet(),half[1],v[1],y1-1e-7-mid[1]);poly=clip(poly,-half[1],-v[1],mid[1]-y0-1e-7);if(poly.length<3)return false;
 const points=poly.map(([s,t])=>[mid[0]+half[0]*s+v[0]*t-cx,mid[2]+half[2]*s+v[2]*t-cz]);
 let positive=false,negative=false,min=Infinity,area=0;
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length],d=sub(b,a),side=a[0]*b[1]-a[1]*b[0];area+=side;positive ||=side>1e-9;negative ||=side< -1e-9;
  const t=Math.max(0,Math.min(1,-dot(a,d)/(dot(d,d)||1)));min=Math.min(min,(a[0]+t*d[0])**2+(a[1]+t*d[1])**2);
 }
 return Math.abs(area)>1e-9&&!(positive&&negative)||min<(r-1e-7)**2;
}
export function sheetTriangleInterval(mid,half,v,a,b,c){
 const u=sub(b,a),w=sub(c,a),n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]],denom=dot(n,v);
 if(Math.abs(denom)<1e-10)return null;
 const t0=dot(n,sub(a,mid))/denom,t1=-dot(n,half)/denom,q0=mid.map((x,i)=>x+v[i]*t0-a[i]),q1=half.map((x,i)=>x+v[i]*t1);
 const uu=dot(u,u),uw=dot(u,w),ww=dot(w,w),det=uu*ww-uw*uw;if(det<1e-14)return null;
 const bary=q=>[(ww*dot(q,u)-uw*dot(q,w))/det,(uu*dot(q,w)-uw*dot(q,u))/det],p=bary(q0),d=bary(q1);
 let lo=-1,hi=1;
 // f0+f1*s must be positive. Ignore tangencies, not a finite part of the opening.
 for(const [f0,f1] of [[p[0],d[0]],[p[1],d[1]],[1-p[0]-p[1],-d[0]-d[1]],[t0-1e-6,t1],[160-t0,-t1]]){
  if(Math.abs(f1)<1e-12){if(f0< -1e-8)return null;continue;}
  const limit=-f0/f1;if(f1>0)lo=Math.max(lo,limit);else hi=Math.min(hi,limit);if(hi-lo<1e-7)return null;
 }
 return hi-lo>1e-7?[lo,hi]:null;
}
