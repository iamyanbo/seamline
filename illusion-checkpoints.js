// Checkpoints contain plain data, never live Three.js objects or GPU resources.
export const CHECKPOINT_LIMIT=3;
export function levelRevision(level){
  const layout=[level.blocks,level.movers,level.shy,level.ghosts,level.crumble,level.frames,level.start,level.goal];
  // Keep existing saves for unchanged puzzles. Explicit collision-profile edits invalidate theirs.
  if(level.railScale||level.railSetback)layout.push({railScale:level.railScale??1,railSetback:level.railSetback??.08});
  if(level.eyes?.length)layout.push({eyes:level.eyes});
  const source=JSON.stringify(layout);
  let hash=2166136261;for(let i=0;i<source.length;i++)hash=Math.imul(hash^source.charCodeAt(i),16777619);
  return (hash>>>0).toString(36);
}
// IndexedDB keeps campaign checkpoints separate from the album's localStorage quota.
// Writes resolve only after their transaction commits, so "saved" means durable.
export class PersistentCheckpointStore{
  constructor(database){this.database=database;this.memory=new Map();this.connection=null;}
  open(){
    if(!this.connection)this.connection=new Promise((resolve,reject)=>{
      if(!this.database){reject(Error('Storage unavailable'));return;}
      const request=this.database.open('frameshift-checkpoints',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('levels');
      request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db);};
      request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('Storage busy'));
    });
    return this.connection;
  }
  async read(level){
    const key=level.name+'|'+levelRevision(level),cached=this.memory.get(key);if(cached)return structuredClone(cached);
    try{
      const db=await this.open(),data=await new Promise((resolve,reject)=>{const request=db.transaction('levels').objectStore('levels').get(level.name);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
      if(data?.revision===levelRevision(level)&&Array.isArray(data.slots)){this.memory.set(key,data.slots);return structuredClone(data.slots);}
    }catch{}
    return [null,null,null];
  }
  async write(level,slots){
    const data={revision:levelRevision(level),slots:structuredClone(slots.slice(0,CHECKPOINT_LIMIT))};
    this.memory.set(level.name+'|'+data.revision,data.slots);
    try{
      const db=await this.open();await new Promise((resolve,reject)=>{const tx=db.transaction('levels','readwrite');tx.objectStore('levels').put(data,level.name);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});return true;
    }catch{return false;}
  }
}
// Replays retain the actual movement path, including corners and rides. Long experiments are
// compressed into a short rewind. Across reloads, the persisted endpoint still restores exactly.
export class TemporalTrail{
  constructor(limit=3600){this.limit=limit;this.reset();}
  reset(){this.points=[];this.cursor=0;this.epoch=Math.random().toString(36).slice(2);}
  push(pose){this.points.push({...structuredClone(pose),cursor:++this.cursor});if(this.points.length>this.limit)this.points.shift();return this.cursor;}
  mark(){return {epoch:this.epoch,cursor:this.cursor};}
  backTo(mark,current,target){
    if(mark?.epoch!==this.epoch||mark.cursor<(this.points[0]?.cursor??0))return [current,target];
    const path=this.points.filter(p=>p.cursor>=mark.cursor).reverse();
    return [current,...path,target];
  }
}
const mix=(a,b,t)=>a+(b-a)*t;
const arc=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
function quaternion(a,b,t){
  let dot=a.reduce((sum,v,i)=>sum+v*b[i],0);if(dot<0){b=b.map(v=>-v);dot=-dot;}
  if(dot>.9995){const q=a.map((v,i)=>mix(v,b[i],t)),length=Math.hypot(...q);return q.map(v=>v/length);}
  const angle=Math.acos(Math.min(1,dot)),sin=Math.sin(angle);
  return a.map((v,i)=>(v*Math.sin((1-t)*angle)+b[i]*Math.sin(t*angle))/sin);
}
export function blendPose(a,b,t){
  const vec=(x,y)=>x.map((v,i)=>mix(v,y[i],t));
  return {at:vec(a.at,b.at),orientation:quaternion(a.orientation??[0,0,0,1],b.orientation??[0,0,0,1],t),face:arc(a.face,b.face,t),angles:a.angles.map((v,i)=>arc(v,b.angles[i],t)),
    offsets:a.angles.map((_,i)=>vec(a.offsets?.[i]??[0,0,0],b.offsets?.[i]??[0,0,0])),
    view:{target:vec(a.view.target,b.view.target),yaw:arc(a.view.yaw,b.view.yaw,t),pitch:mix(a.view.pitch,b.view.pitch,t),zoom:mix(a.view.zoom,b.view.zoom,t)}};
}
