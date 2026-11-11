// Orthographic framing changes size and position, never the direction of a puzzle view.
export function fitView(points,yaw,pitch,width,height,{left=24,right=24,top=80,bottom=100,padding=1.12,frameAspect=0}={}){
 const r=[Math.cos(yaw),0,-Math.sin(yaw)],u=[-Math.sin(yaw)*Math.sin(pitch),Math.cos(pitch),-Math.cos(yaw)*Math.sin(pitch)],v=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)];
 const dot=(p,a)=>p.reduce((s,n,i)=>s+n*a[i],0),xs=points.map(p=>dot(p,r)),ys=points.map(p=>dot(p,u)),ds=points.map(p=>dot(p,v));
 const x=(Math.min(...xs)+Math.max(...xs))/2,y=(Math.min(...ys)+Math.max(...ys))/2,d=(Math.min(...ds)+Math.max(...ds))/2;
 let spanX=Math.max(1,Math.max(...xs)-Math.min(...xs)),spanY=Math.max(1,Math.max(...ys)-Math.min(...ys));
 if(frameAspect){spanX=Math.max(spanX,spanY*frameAspect);spanY=Math.max(spanY,spanX/frameAspect);}
 const usableW=Math.max(80,width-left-right),usableH=Math.max(80,height-top-bottom),zoom=Math.max(spanX*height/usableW,spanY*height/usableH)*padding/2;
 const cx=x-(left-right)*zoom/height,cy=y+(top-bottom)*zoom/height;
 return {zoom,target:r.map((n,i)=>n*cx+u[i]*cy+v[i]*d)};
}

export function worldFramePoints(cells,goal,base=-.6){
 return [...cells.values()].flatMap(c=>[-.65,.65].flatMap(x=>[base,c.x===goal?.[0]&&c.y===goal[1]&&c.z===goal[2]?2.8:c.shape==='rail'?1.25:.75].flatMap(y=>[-.65,.65].map(z=>[c.x+x,c.y+y,c.z+z]))));
}
