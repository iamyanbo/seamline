// The guide uses the live solver plan. Progress comes from playing, never from dismissing a card.
export const LESSON_LEVELS=new Set(['First Light','Two at Once','Look Down','The Photo Waits',"Bird's Eye",'Out of Sight','Two Keys','Passenger','Ferryman','Low Tide','White Steps','Upper Conservatory','Spiral','The Up Button','One Up, One Down','Two in Step','After You','A Little Shy','No Photobomb','Behind You']);
// Automatic demonstrations teach one unfamiliar interaction. Other encounters give a
// short rule reminder; a full solver guide remains an explicit Hint / Replay choice.
export const AUTO_LESSONS=new Set(['First Light','The Photo Waits','Out of Sight']);
export function lessonMilestone(name,{links=0,waiting=0,hidden=0}={}){
  return name==='First Light'?links>0:name==='The Photo Waits'?waiting>0:name==='Out of Sight'?hidden>0:false;
}
export const LESSON_CUES=Object.freeze({
  'Two at Once':'Click a path to walk. Your next photo replaces the one you are keeping.',
  'Look Down':'One photo can hold more than one crossing. Try looking from above.',
  "Bird's Eye":'Ride the turning path, then try a view from above.',
  'Two Keys':'You can keep two photos. Each holds its own crossings.',
  'Passenger':'The marked plate raises the lift and carries you with it.',
  'Ferryman':'Stairs join paths at different heights without a photo.',
  'Low Tide':'Both open edges must be visible from the photograph’s viewpoint.',
  'White Steps':'One plate moves both platforms. Watch both landing positions.',
  'Upper Conservatory':'This lift has a middle stop. Step off and back onto its plate to move again.',
  'Spiral':'Keep a crossing until you have used it. Your next photo replaces the oldest.',
  'The Up Button':'Step onto the marked plate to ride the platform.',
  'One Up, One Down':'One plate moves both platforms. Watch both landing positions.',
  'Two in Step':'One plate moves both platforms. Watch both landing positions.',
  'After You':'These linked platforms have different stops. Step off and back onto the plate to move again.',
  'A Little Shy':'Photograph the orb’s whole face to turn its path.',
  'No Photobomb':'An orb only reacts when its face is inside your photo.',
  'Behind You':'A photo keeps a shy stone hidden while another block covers it.'
});
const shy={rotate:'Turn the view until another block completely hides the pale shy stone.',frame:'Include the hidden stone and the block in front. Keep this photo to keep the stone hidden.'};
const linked={plate:'This plate moves both platforms. Check both landing positions.'};
const guideNotes={
  'Two at Once':{frame:'A new photo replaces the old crossing.',tap:'Cross onto the corner path before replacing the way in.'},
  'Look Down':{rotate:'Look down on the three floors.',frame:'Include both pairs of edges in this one photo.'},
  'The Photo Waits':{frame:'Include the boarding crossing and the future landing in one photo.',plate:'Step on the marked plate to ride the lift. Keep your original photo.'},
  "Bird's Eye":{plate:'The plate turns the platform and carries you with it.'},
  'Out of Sight':shy,'Behind You':shy,
  'Two Keys':{frame:'You can keep two photos here. Once full, the next replaces the oldest removable photo.'},
  'Passenger':{plate:'Step onto the plate to ride the lift to its next landing.'},
  'The Up Button':{plate:'This pad moves its platform and carries you along.'},
  'White Steps':linked,'One Up, One Down':linked,'Two in Step':linked,
  'After You':{plate:'These linked platforms have different numbers of stops. Step off and back onto the pad to move again.'},
  'Upper Conservatory':{plate:'This lift has a middle stop. Step off and back onto the plate to advance to the next stop.'},
  'Ferryman':{tap:'Stairs connect different heights without a photo.'},
  'Low Tide':{rotate:'Both joining edges must be visible. Find a view past the column.'},
  'A Little Shy':{rotate:'Look at the orb from the front.',frame:'Include its whole face to turn the path it controls.'},
  'No Photobomb':{frame:'Photographing the orb turns its path again. Leave it out when you want only a crossing.'}
};
export function lessonFor(name,s,hands=false){
  if(!LESSON_LEVELS.has(name)&&!s.force)return null;
  if(s.homeward||s.moving)return {id:'wait',action:2,label:'Walking',description:'The traveller is moving.'};
  if(!s.ready)return {id:'loading',action:0,label:'Guide',description:'Preparing the next action.'};
  const p=s.plan;
  const note=guideNotes[name]??{};
  if(!p)return {id:'wait',action:2,label:'Complete',description:'The route is complete.'};
  if(p.type==='frame')return s.there
    ?{id:'frame',action:1,label:'Photo',description:[note.frame,hands?'Pinch and drag between the marked corners.':'Drag between the marked corners.'].filter(Boolean).join(' '),target:'frame-tool'}
    :{id:'rotate',action:0,label:'Drag',description:[note.rotate,hands?'Move an open palm along the animated arrow.':'Drag along the animated arrow.'].filter(Boolean).join(' ')};
  if(p.type==='remove')return {id:'remove',action:1,label:'Remove',description:'Remove the highlighted photo.'};
  return {id:p.type==='press'?'plate':'tap',action:2,label:'Tap',description:[p.type==='press'?note.plate:note.tap,hands?'Pinch the marked tile.':'Click the marked tile.'].filter(Boolean).join(' ')};
}

// A looping demonstration: hold, drag, release. It never moves the player's camera or pointer.
export function demoPoint(a,b,time){
  const t=time%2.8,u=Math.max(0,Math.min(1,(t-.45)/1.5)),k=u*u*(3-2*u);
  return {x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k,held:t>.3&&t<2.1,alpha:t>2.3?(2.8-t)/.5:1};
}
export function drawDemoPointer(ctx,a,b,time,{hands=false,box=false,reduced=false}={}){
  const p=reduced?{...(box?b:a),held:true,alpha:1}:demoPoint(a,b,time);
  ctx.save();ctx.globalAlpha=p.alpha;ctx.lineWidth=2;ctx.setLineDash([]);
  if(box&&p.held){ctx.fillStyle='rgba(255,211,107,.1)';ctx.strokeStyle='#ffd36b';ctx.fillRect(a.x,a.y,p.x-a.x,p.y-a.y);ctx.strokeRect(a.x,a.y,p.x-a.x,p.y-a.y);}
  ctx.strokeStyle='#fff8e8';ctx.fillStyle='rgba(43,33,64,.82)';ctx.shadowColor='rgba(20,20,30,.5)';ctx.shadowBlur=6;
  ctx.translate(p.x,p.y);
  if(hands){
    ctx.beginPath();ctx.moveTo(-5,18);ctx.lineTo(-5,-4);ctx.quadraticCurveTo(0,-13,5,-4);ctx.lineTo(5,5);ctx.lineTo(13,8);ctx.quadraticCurveTo(19,12,15,23);ctx.lineTo(12,28);ctx.lineTo(1,28);ctx.closePath();ctx.fill();ctx.stroke();
  }else{
    ctx.beginPath();ctx.roundRect(-10,-6,20,30,9);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(0,-5);ctx.lineTo(0,5);ctx.moveTo(-9,5);ctx.lineTo(9,5);ctx.stroke();
  }
  if(p.held){ctx.fillStyle='#ffd36b';ctx.beginPath();ctx.arc(0,0,4,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}
