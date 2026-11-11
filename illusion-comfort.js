// Portable campaign progress. Only known fields are accepted from a backup.
export const COMFORT_DEFAULTS=Object.freeze({sensitivity:1,motion:'system',quality:'high',musicVolume:.65,effectsVolume:.8});
export function comfortSettings(value={}){
  const out={...COMFORT_DEFAULTS};
  for(const key of ['sensitivity','musicVolume','effectsVolume'])if(Number.isFinite(value?.[key]))out[key]=Math.min(key==='sensitivity'?2:1,Math.max(key==='sensitivity'?.4:0,value[key]));
  if(['system','reduced','full'].includes(value?.motion))out.motion=value.motion;
  if(['high','low'].includes(value?.quality))out.quality=value.quality;
  return out;
}
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const image=v=>typeof v==='string'&&v.length<=700000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(v);
export function readProgressBackup(raw,levels){
  if(typeof raw!=='string'||raw.length>24*1024*1024)throw Error('Choose a Seamline backup smaller than 24 MB.');
  let data;try{data=JSON.parse(raw);}catch{throw Error('This file is not a readable Seamline backup.');}
  if(data?.format!=='frameshift-progress'||data.version!==1||!record(data.progress)||!record(data.progress.done))throw Error('This is not a supported Seamline progress backup.');
  const names=new Set(levels.map(L=>L.name)),done={};
  for(const [name,value] of Object.entries(data.progress.done)){
    if(!names.has(name))continue;
    if(value!==1&&!image(value))throw Error('A saved photograph in this backup is damaged.');
    done[name]=value;
  }
  const at=levels.findIndex(L=>L.name===data.progress.current);
  if(at<0)throw Error('The saved level is not available in this version of Seamline.');
  if(data.lessons!==undefined&&(!Array.isArray(data.lessons)||data.lessons.length>200||data.lessons.some(n=>typeof n!=='string')))throw Error('The saved tutorial progress is damaged.');
  const preferences=comfortSettings(data.preferences);
  for(const key of ['hints','follow','music'])if(typeof data.preferences?.[key]==='boolean')preferences[key]=data.preferences[key];
  return {done,at,preferences,lessons:(data.lessons??[]).filter(n=>names.has(n))};
}
export function makeProgressBackup(progress,settings,lessons,levels){
  return {format:'frameshift-progress',version:1,createdAt:new Date().toISOString(),progress:{current:levels[progress.at]?.name??levels[0].name,done:progress.done},preferences:{...comfortSettings(settings),hints:settings.hints,follow:settings.follow,music:settings.music},lessons:[...lessons]};
}
// Restore storage if quota or privacy settings reject any write.
export function writeBackupStorage(storage,entries){
  const previous=entries.map(([key])=>[key,storage.getItem(key)]),written=[];
  try{for(const [key,value] of entries){storage.setItem(key,JSON.stringify(value));written.push(key);}}
  catch(error){for(const [key,value] of previous)if(written.includes(key)){if(value===null)storage.removeItem(key);else storage.setItem(key,value);}throw Error('There is not enough browser storage to import this backup. Your progress has been kept.');}
}
