// Preview strokes sit on the actual entrance edges. Shape, as well as colour, carries state.
export const PREVIEW_STYLES={ready:{color:'#ffe2a0',dash:[]},held:{color:'#b7eee1',dash:[]},waiting:{color:'#d4c7f1',dash:[5,5]},blocked:{color:'#df9f93',dash:[2,5]}};
export function previewSegments(groups,project){
 const seen=new Set(),out=[];
 for(const kind of ['held','ready','waiting','blocked'])for(const p of groups[kind]??[]){
  const seam=p.seam??p;
  for(const edge of [seam.ea,seam.eb]){
   const a=project(edge.mid.map((v,i)=>v-edge.half[i])),b=project(edge.mid.map((v,i)=>v+edge.half[i]));
   if(a.z>1||b.z>1)continue;
   const key=[a,b].map(p=>`${Math.round(p.x)},${Math.round(p.y)}`).sort().join('|');if(seen.has(key))continue;seen.add(key);
   out.push({kind,a,b,id:seam.id});
  }
 }
 return out;
}
export function drawPreviewEdges(ctx,segments,time,reduced=false){
 ctx.save();ctx.lineCap='round';
 for(const {kind,a,b} of segments){
  const {color,dash}=PREVIEW_STYLES[kind],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(length<2)continue;
  const stroke=()=>{ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();};
  ctx.setLineDash(dash);ctx.lineDashOffset=kind==='waiting'&&!reduced?-time*7:0;
  ctx.shadowBlur=0;ctx.strokeStyle='rgba(36,32,52,.28)';ctx.lineWidth=6;stroke();
  ctx.strokeStyle=color;ctx.lineWidth=kind==='blocked'?2:3;ctx.shadowColor=color;ctx.shadowBlur=kind==='ready'?8:3;stroke();ctx.shadowBlur=0;ctx.setLineDash([]);
  const nx=-dy/length,ny=dx/length;
  if(kind==='blocked'){
   for(const t of [.3,.7]){const x=a.x+dx*t,y=a.y+dy*t;ctx.beginPath();ctx.moveTo(x-nx*4-dx/length*2,y-ny*4-dy/length*2);ctx.lineTo(x+nx*4+dx/length*2,y+ny*4+dy/length*2);ctx.stroke();}
  }else if(kind==='ready'){
   const t=reduced?.5:time*.32%1,span=Math.min(.17,10/length),lo=Math.max(0,t-span),hi=Math.min(1,t+span);
   ctx.strokeStyle='#fffdf1';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(a.x+dx*lo,a.y+dy*lo);ctx.lineTo(a.x+dx*hi,a.y+dy*hi);ctx.stroke();
  }
 }
 ctx.restore();
}
