// Finger-frame gesture maths. Pure functions over 21-point hand landmarks
// (MediaPipe / WebXR joint order) in screen pixels, so the same rules can be
// reused when the input later comes from Quest hand tracking.

export const tuning={
  indexReach:.55,  // index MCP->tip length, as a fraction of palm size
  thumbReach:.4,   // thumb MCP->tip length, as a fraction of palm size
  curl:1.15,       // a finger is curled when wrist->tip < wrist->PIP * curl
  curledNeeded:2,  // of middle, ring and pinky
  minAngle:50,maxAngle:130, // thumb-to-index angle, degrees
  minFrame:60,     // smallest frame side, px
  pinchOn:.3,pinchOff:.45, // thumb-index tip gap, as a fraction of palm size, to start and end a pinch
  extend:1.2,      // a finger is straight when wrist->tip > wrist->PIP * extend (an open palm needs all four)
  openGap:.5,      // an L needs the thumb and index tips at least this far apart, so a pinch never reads as an L
  graceMs:250,     // keep the frame alive through brief tracking dropouts
  smoothing:14     // higher follows the hands faster
};

const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y}), add=(a,b)=>({x:a.x+b.x,y:a.y+b.y}), scale=(a,s)=>({x:a.x*s,y:a.y*s});
const len=v=>Math.hypot(v.x,v.y), dist=(a,b)=>len(sub(a,b)), dot=(a,b)=>a.x*b.x+a.y*b.y, cross=(a,b)=>a.x*b.y-a.y*b.x;
const unit=v=>{const l=len(v)||1;return{x:v.x/l,y:v.y/l};};
const rotate=(v,a)=>({x:v.x*Math.cos(a)-v.y*Math.sin(a),y:v.x*Math.sin(a)+v.y*Math.cos(a)});
const QUARTER=Math.PI/2;

// Where the thumb line and index line meet: the corner of the "L".
function lineMeet(p,u,q,v){const d=cross(u,v);if(Math.abs(d)<1e-6)return scale(add(p,q),.5);const t=cross(sub(q,p),v)/d;return add(p,scale(u,t));}

export function readHand(p){
  const palm=dist(p[0],p[9])||1;
  const thumb=sub(p[4],p[2]), index=sub(p[8],p[5]);
  // The thumb tip segment follows the visible edge of the frame better than the whole bent thumb.
  const thumbDir=unit(sub(p[4],p[3])), indexDir=unit(index);
  const angle=Math.acos(Math.max(-1,Math.min(1,dot(thumbDir,indexDir))))*180/Math.PI;
  const curled=[9,13,17].filter(f=>dist(p[0],p[f+3])<dist(p[0],p[f+1])*tuning.curl).length;
  const checks={
    index:len(index)>palm*tuning.indexReach&&dist(p[0],p[8])>dist(p[0],p[6]),
    thumb:len(thumb)>palm*tuning.thumbReach,
    curled:curled>=tuning.curledNeeded,
    angle:angle>=tuning.minAngle&&angle<=tuning.maxAngle
  };
  const tipGap=dist(p[4],p[8])/palm;
  const isL=checks.index&&checks.thumb&&checks.curled&&checks.angle&&tipGap>tuning.openGap;
  // An open palm: all four fingers straight and the thumb away from the index (so never a pinch or an L).
  const extended=[5,9,13,17].filter(f=>dist(p[0],p[f+3])>dist(p[0],p[f+1])*tuning.extend).length;
  const isPalm=extended===4&&tipGap>tuning.openGap;
  const palmPoint=scale([0,5,9,13,17].reduce((a,i)=>add(a,p[i]),{x:0,y:0}),1/5);
  return {isL,isPalm,palmPoint,checks,curled,angle,tipGap,thumbDir,indexDir,corner:lineMeet(p[3],thumbDir,p[5],indexDir),pinchPoint:scale(add(p[4],p[8]),.5)};
}

// Two L-shaped hands at opposite corners make a frame {cx,cy,w,h,angle}.
export function frameFromHands(a,b){
  if(!a?.isL||!b?.isL)return null;
  const toB=sub(b.corner,a.corner);
  // Each hand's fingers must open toward the other hand, or it is not a frame.
  if(dot(add(a.thumbDir,a.indexDir),toB)<=0||dot(add(b.thumbDir,b.indexDir),toB)>=0)return null;
  // Frame tilt: average the index directions modulo 90 degrees. Thumbs bend too much to trust.
  let s=0,c=0;for(const d of [a.indexDir,b.indexDir]){const t=Math.atan2(d.y,d.x)*4;s+=Math.sin(t);c+=Math.cos(t);}
  const angle=Math.atan2(s,c)/4;
  const local=rotate(toB,-angle), w=Math.abs(local.x), h=Math.abs(local.y);
  if(w<tuning.minFrame||h<tuning.minFrame)return null;
  const center=scale(add(a.corner,b.corner),.5);
  return {cx:center.x,cy:center.y,w,h,angle};
}

export function frameCorners(f){
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx,sy])=>add({x:f.cx,y:f.cy},rotate({x:sx*f.w/2,y:sy*f.h/2},f.angle)));
}

export function frameContains(f,pt,margin=0){
  const l=rotate(sub(pt,{x:f.cx,y:f.cy}),-f.angle);
  return Math.abs(l.x)<=f.w/2-margin&&Math.abs(l.y)<=f.h/2-margin;
}

// Pinch with hysteresis, so a pinch near the threshold does not flicker on and off.
export const isPinching=(hand,wasPinching)=>hand.tipGap<(wasPinching?tuning.pinchOff:tuning.pinchOn);

// Point inside a convex polygon, in either winding order.
export function pointInPolygon(poly,pt){
  let side=0;
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],c=cross(sub(b,a),sub(pt,a));
    if(c!==0){const s=Math.sign(c);if(side&&s!==side)return false;side=s;}
  }
  return true;
}

// Smooths raw frames, survives short dropouts, and fades the frame in and out.
export class FrameTracker{
  constructor(){this.frame=null;this.alpha=0;this.lastSeen=-Infinity;}
  update(raw,now,dt){
    if(raw){
      if(!this.frame||this.alpha<.05)this.frame={...raw};
      else{
        const f=this.frame,k=1-Math.exp(-tuning.smoothing*dt);
        // A frame tilted 90 degrees is the same frame with width and height swapped.
        let da=raw.angle-f.angle;const turns=Math.round(da/QUARTER);da-=turns*QUARTER;
        const [w,h]=turns%2?[raw.h,raw.w]:[raw.w,raw.h];
        f.cx+=(raw.cx-f.cx)*k;f.cy+=(raw.cy-f.cy)*k;f.w+=(w-f.w)*k;f.h+=(h-f.h)*k;f.angle+=da*k;
      }
      this.lastSeen=now;
    }
    const target=now-this.lastSeen<=tuning.graceMs?1:0;
    this.alpha+=(target-this.alpha)*(1-Math.exp(-12*dt));
    if(!target&&this.alpha<.01){this.frame=null;this.alpha=0;}
    return this.frame?{...this.frame,alpha:this.alpha}:null;
  }
}
