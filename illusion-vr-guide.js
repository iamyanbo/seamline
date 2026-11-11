// The optional VR guide. Open How to play to see demonstration hands beside the island. They
// show each way of playing, one at a time: touch a path to walk, grab, resize, hold, spin, look down,
// set down, take a photo. Each step moves on when the player does it, never by dismissing a card. Skip
// ends it. Reloading never restarts it; How to play replays it.
import {GHOST_JOINTS,GHOST_RELAXED,GHOST_PINCH,GHOST_FIST} from './illusion-ghost-hands.js';
import {createHandModel,orientJoints} from './illusion-vr-hands.js';

const J=n=>GHOST_JOINTS.indexOf(n);
const INDEX=new Set(GHOST_JOINTS.map((n,i)=>n.startsWith('index-finger')&&n!=='index-finger-metacarpal'?i:-1).filter(i=>i>=0));
const WRIST=J('wrist'),KNUCKLE=J('middle-finger-phalanx-proximal'),INDEX_BASE=J('index-finger-metacarpal'),PINKY_BASE=J('pinky-finger-metacarpal'),THUMB_TIP=J('thumb-tip'),INDEX_TIP=J('index-finger-tip');
const GLOW=0xfff1d0,GOLD=0xffd36b;
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const ramp=(t,a,b)=>ease((t-a)/(b-a));

export function createVRGuide(THREE,game){
  const V3=THREE.Vector3,group=new THREE.Group();group.visible=false;game.rig.add(group);

  // A demonstration hand: the player's own hand, see-through and glowing, posed between relaxed,
  // pinching and closed, or closed with the index finger out to touch.
  function ghost(side){
    const model=createHandModel(THREE,{ghost:true,color:GLOW,side});group.add(model.group);
    const joints=Object.fromEntries(GHOST_JOINTS.map(n=>[n,{position:new V3(),quaternion:new THREE.Quaternion(),visible:true}]));
    const q=new THREE.Quaternion(),world=GHOST_JOINTS.map(n=>joints[n].position);
    return {
      world,
      hide(){model.hide();},
      // blend 0 relaxed .. 1 pinching, `fist` 0 .. 1 closed; the hand's palm faces `palm`, its fingers
      // point along `fingers`, and its pinch point (or palm middle, or index tip) sits at `at`. `point`
      // 0 .. 1 straightens the index finger out of the fist.
      pose(blend,{at,palm,fingers,by='pinch',fist=0,point=0},opacity){
        const local=GHOST_RELAXED.map((r,i)=>{const p=new V3(...r).lerp(new V3(...GHOST_PINCH[i]),blend).lerp(new V3(...GHOST_FIST[i]),fist);return INDEX.has(i)?p.lerp(new V3(...r),point):p;});
        if(side==='right')for(const p of local)p.x=-p.x;
        const w=local[WRIST],a=local[side==='right'?INDEX_BASE:PINKY_BASE].clone().sub(w),b=local[side==='right'?PINKY_BASE:INDEX_BASE].clone().sub(w);
        const n0=new V3().crossVectors(a,b).normalize(),f0=local[KNUCKLE].clone().sub(w);f0.addScaledVector(n0,-f0.dot(n0)).normalize();
        const n1=palm.clone().normalize(),f1=fingers.clone().addScaledVector(n1,-fingers.dot(n1)).normalize();
        const from=new THREE.Matrix4().makeBasis(new V3().crossVectors(n0,f0),n0,f0),to=new THREE.Matrix4().makeBasis(new V3().crossVectors(n1,f1),n1,f1);
        q.setFromRotationMatrix(to.multiply(from.transpose()));
        const origin=by==='pinch'?local[THUMB_TIP].clone().lerp(local[INDEX_TIP],.5):by==='index'?local[INDEX_TIP].clone():w.clone().lerp(local[KNUCKLE],.55);
        local.forEach((p,i)=>{world[i].copy(p).sub(origin).applyQuaternion(q).add(at);});
        orientJoints(THREE,joints,side);
        model.update(joints,{opacity:opacity*.62,tipMix:blend});
      },
      pinchPoint(){return world[THUMB_TIP].clone().lerp(world[INDEX_TIP],.5);}
    };
  }
  const left=ghost('left'),right=ghost('right');
  // A ring that fills on the demonstration palm; the frame between two demonstration pinches.
  const ring=new THREE.Mesh(new THREE.RingGeometry(.03,.038,48,1,Math.PI/2,-Math.PI*2),new THREE.MeshBasicMaterial({color:GOLD,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false,depthTest:false}));
  const frame=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([new V3(),new V3(),new V3(),new V3()]),new THREE.LineBasicMaterial({color:GOLD,transparent:true,opacity:0,depthWrite:false,depthTest:false}));
  // The demonstration hand's pointing beam.
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(1,1,1,6,1,true),new THREE.MeshBasicMaterial({color:GOLD,transparent:true,opacity:0,depthWrite:false,depthTest:false}));
  const beamTo=(a,b,opacity)=>{beam.visible=opacity>.01;beam.position.copy(a).lerp(b,.5);beam.quaternion.setFromUnitVectors(new V3(0,1,0),b.clone().sub(a).normalize());beam.scale.set(.0015,a.distanceTo(b),.0015);beam.material.opacity=opacity;};
  for(const o of [ring,frame,beam]){o.renderOrder=13;o.visible=false;group.add(o);}
  // The path to walk to, glowing on the island.
  const mark=new THREE.Mesh(new THREE.RingGeometry(.22,.36,40),new THREE.MeshBasicMaterial({color:GOLD,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));
  mark.rotation.x=-Math.PI/2;mark.renderOrder=3;mark.visible=false;game.scene.add(mark);

  // Where things are from where the player stands.
  function view(){
    const head=game.head().clone(),island=game.islandAt().clone();
    const toward=island.clone().sub(head).normalize(),flat=toward.clone().setY(0).normalize();
    const right=new V3().crossVectors(flat,new V3(0,1,0)).normalize();
    return {head,island,toward,flat,right,up:new V3(0,1,0)};
  }
  const hideDemo=()=>{left.hide();right.hide();ring.visible=frame.visible=beam.visible=false;mark.visible=false;};

  const STEPS=[
    {id:'walk',
      text:hands=>hands?'Touch the glowing path with a fingertip to walk there.':'Point at the glowing path and pull the trigger.',
      begin(s){s.from=game.walkerNode();s.target=game.walkTarget();if(!s.target)s.skip=true;},
      done:s=>game.walkerNode()!==s.from||game.walking(),
      sparkleAt:s=>s.target&&game.top(s.target),
      demo(t,s,v){
        const tile=game.toRoom(game.top(s.target)),o=ramp(t,0,.4)*(1-ramp(t,2.1,2.5));
        const down=Math.exp(-Math.pow((t-1.3)/.18,2));
        if(game.hands()){
          // A hand comes in over the path, index finger out, and taps it.
          const lift=.07*(1-ramp(t,.6,1.2))+.035*(1-down),at=tile.clone().addScaledVector(v.up,lift+.004);
          right.pose(0,{at,palm:v.up.clone().multiplyScalar(-1).addScaledVector(v.flat,.6),fingers:v.flat.clone().addScaledVector(v.up,-.9),by:'index',fist:1,point:1},o);
        }else{
          // A controller's beam reaching out to the path, then the trigger.
          const at=v.head.clone().addScaledVector(v.flat,.3).addScaledVector(v.up,-.22).addScaledVector(v.right,.1);
          beamTo(at,at.clone().lerp(tile,ramp(t,.3,.9)),o*.7);
        }
        mark.visible=true;mark.position.copy(game.top(s.target)).add(new V3(0,.03,0));
        mark.scale.setScalar(1+.25*down+.06*Math.sin(t*4));mark.material.opacity=.7+.3*down;
      }},
    {id:'grab',
      text:hands=>hands?'Make a fist with your left hand beside the island to pick it up, then move or turn your hand.':'Squeeze the grip button beside the island to pick it up, then move it.',
      done(s){
        if(!game.grabbing()){s.base=null;return false;}
        const now=game.islandPose();s.base??=now;
        return now.pos.distanceTo(s.base.pos)>.08||now.quat.angleTo(s.base.quat)>.5;
      },
      demo(t,s,v){
        // The left hand comes in open, closes into a fist, then carries and turns.
        const size=game.islandSize(),side=v.island.clone().addScaledVector(v.right,-size*1.05).addScaledVector(v.flat,-size*.3);
        const carry=ramp(t,1.1,2),at=side.addScaledVector(v.right,-.02*carry).addScaledVector(v.up,.06*carry);
        const turn=new THREE.Quaternion().setFromAxisAngle(v.up,.7*carry),fingers=v.right.clone().applyQuaternion(turn);
        left.pose(0,{at,palm:v.right.clone().applyQuaternion(turn),fingers:fingers.clone().addScaledVector(v.up,.6),by:'palm',fist:ramp(t,.55,.9)},ramp(t,0,.4)*(1-ramp(t,2.2,2.6)));
      }},
    {id:'resize',
      text:hands=>hands?'Hold it with your left fist, then pinch beside it with your right hand and pull away to make it bigger.':'Squeeze both grip buttons and pull apart to make the island bigger.',
      begin(s){s.size=game.islandPose().size;},
      done:s=>{const k=game.islandPose().size/s.size;return k>1.3||k<.77;},
      demo(t,s,v){
        const size=game.islandSize(),o=ramp(t,0,.4)*(1-ramp(t,2.2,2.6));
        const fistAt=v.island.clone().addScaledVector(v.right,-size*.95).addScaledVector(v.flat,-size*.3);
        left.pose(0,{at:fistAt,palm:v.right.clone(),fingers:v.up.clone().addScaledVector(v.flat,.4),by:'palm',fist:ramp(t,.3,.6)},o);
        const pull=size*(.95+.6*ramp(t,1.1,2)),pinchAt=v.island.clone().addScaledVector(v.right,pull).addScaledVector(v.flat,-size*.3);
        right.pose(ramp(t,.6,.9),{at:pinchAt,palm:v.right.clone().multiplyScalar(-1).addScaledVector(v.up,-.5),fingers:v.flat.clone().multiplyScalar(-1).addScaledVector(v.right,-.5)},o);
      }},
    {id:'hold',hands:true,
      text:()=>'Hold your left hand out, palm up, and keep it still.',
      done:()=>game.holding(),
      demo(t,s,v){
        const at=v.head.clone().addScaledVector(v.flat,.36).addScaledVector(v.up,-.26).addScaledVector(v.right,-.1);
        const o=ramp(t,0,.4)*(1-ramp(t,2.3,2.7));
        left.pose(0,{at,palm:v.up,fingers:v.flat,by:'palm'},o);
        ring.visible=t>.5&&o>.05;ring.position.copy(at).addScaledVector(v.up,.015);ring.quaternion.setFromUnitVectors(new V3(0,0,1),v.up);
        ring.material.opacity=.85*o;ring.geometry.setDrawRange(0,6*Math.ceil(48*ramp(t,.5,1.6)));
      }},
    {id:'spin',hands:true,
      text:()=>'Pinch beside it with your right hand and drag round to spin it.',
      begin(s){s.spun=game.spun();},
      done:s=>!game.holding()||game.spun()-s.spun>1,
      demo(t,s,v){
        // A right-hand pinch at the island's edge, carried round it.
        const size=game.islandSize(),c=game.islandAt(),r=size*1.05,o=ramp(t,0,.4)*(1-ramp(t,2.2,2.6));
        const a=-.5+1.4*ramp(t,.8,2),dir=v.right.clone().multiplyScalar(Math.cos(a)).addScaledVector(v.flat,-Math.sin(a));
        right.pose(ramp(t,.4,.7),{at:c.clone().addScaledVector(dir,r),palm:new V3(0,-1,0).addScaledVector(dir,-.4),fingers:dir.clone().multiplyScalar(-1)},o);
      }},
    {id:'tilt',hands:true,
      text:()=>'Tilt your hand toward you to look down from above.',
      done:()=>!game.holding()||game.islandFacingYou()>.82},
    {id:'leave',hands:true,
      text:()=>'Close your hand to leave the island where it is.',
      done:()=>!game.holding()},
    {id:'photo',
      text:hands=>hands?'Pinch with both hands to make a frame, then let go to take the photo.':'Pull both triggers to make a frame, then let go to take the photo.',
      begin(s){s.from=game.photos();},
      done:s=>game.photos()!==s.from,
      demo(t,s,v){
        const c=v.head.clone().addScaledVector(v.toward,.4),spread=ramp(t,.6,1.5);
        const o=ramp(t,0,.4)*(1-ramp(t,2.3,2.7)),pinch=ramp(t,.3,.55)*(1-ramp(t,1.75,1.95));
        const pl=c.clone().addScaledVector(v.right,-.025-.075*spread).addScaledVector(v.up,.02+.045*spread);
        const pr=c.clone().addScaledVector(v.right,.025+.075*spread).addScaledVector(v.up,-.02-.045*spread);
        left.pose(pinch,{at:pl,palm:v.right.clone().multiplyScalar(.5).add(new V3(0,-.8,0)),fingers:v.toward},o);
        right.pose(pinch,{at:pr,palm:v.right.clone().multiplyScalar(-.5).add(new V3(0,-.8,0)),fingers:v.toward},o);
        const a=pl,b=pr,d=b.clone().sub(a),hr=v.right,hu=new V3().crossVectors(hr,v.toward).normalize();
        frame.geometry.setFromPoints([a,a.clone().addScaledVector(hr,d.dot(hr)),b,a.clone().addScaledVector(hu,d.dot(hu))]);
        const flash=Math.exp(-Math.pow((t-1.95)/.12,2));
        frame.visible=t>.55&&t<2.3;frame.material.opacity=Math.min(1,pinch*1.2)*o*.9+flash;
      }}
  ];

  const g={active:false,index:0,step:null,state:{},at:0,rest:0,text:''};
  function enter(i){
    g.index=i;g.step=STEPS[i];g.state={};g.at=game.now();hideDemo();
    if(!g.step){finish(true);return;}
    if(g.step.hands&&!game.hands()){enter(i+1);return;}
    g.step.begin?.(g.state);if(g.state.skip)enter(i+1);
  }
  function finish(done){
    g.active=false;group.visible=false;hideDemo();if(done)game.seen();
    if(done){game.play('place');game.sparkle(game.center(),{count:26,spread:game.radius()*.7,color:0xffe7a8});}
  }
  return {
    get active(){return g.active;},
    get step(){return g.active?g.step?.id??null:null;},
    get target(){const t=g.active&&g.state.target;return t?[t.x,t.y,t.z]:null;},
    start(){g.active=true;group.visible=true;g.rest=0;enter(0);},
    skip(){if(g.active)finish(false);},
    // Leaving VR part way through: the guide shows again next time.
    stop(){g.active=false;group.visible=false;hideDemo();},
    // Called every frame in VR. Returns the panel's text while the guide is running.
    update(){
      if(!g.active)return null;
      const hands=game.hands(),any=hands||game.controllers();
      if(!any){hideDemo();return 'How to play\nHold your hands up in front of you.\n';}
      const s=g.step,t=game.now()-g.at;
      if(g.rest){
        // A short pause between steps, so each success can land.
        if(game.now()>=g.rest){g.rest=0;enter(g.index+1);if(!g.active)return null;}
        else hideDemo();
      }else if(s.done(g.state)){
        game.play('place');const at=s.sparkleAt?.(g.state)??game.center();
        game.sparkle(at,{count:16,spread:game.radius()*.25,color:0xffe7a8});
        g.rest=game.now()+.9;hideDemo();
      }else if(s.demo){
        if(t>.6)s.demo((t-.6)%2.9,g.state,view());else hideDemo();
      }
      const shown=g.rest?STEPS.slice(g.index+1).find(x=>!x.hands||hands)??null:g.step;
      const count=STEPS.filter(x=>!x.hands||hands),n=shown?count.indexOf(shown)+1:count.length;
      return `How to play\n${shown?shown.text(hands):'That is everything.'}\n${n} of ${count.length}`;
    }
  };
}
