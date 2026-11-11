// VR interface: plain photographic paper, ink labels and contact-sheet controls.
// Canvas textures share a consistent visual hierarchy across the shelf and every card.
const INK='#30352f',INK_SOFT='#686d64',PAPER='#f4f0e7',GOLD='#456577',GOLD_SOFT='#456577',LINE='rgba(57,62,53,.18)';
const SERIF='"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,"Noto Serif",serif';
const SANS='system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';

// A single sheet with a narrow edge, rather than a glossy panel or a stack of outlines.
function card(g,x,y,w,h,r,{fill=PAPER,shadow=.1,lift=2}={}){
  g.save();g.shadowColor=`rgba(45,42,34,${Math.min(shadow,.12)})`;g.shadowBlur=7;g.shadowOffsetY=Math.min(lift,3);
  g.fillStyle=fill;g.beginPath();g.roundRect(x,y,w,h,Math.min(r,8));g.fill();
  g.shadowColor='transparent';g.strokeStyle=LINE;g.lineWidth=1;g.stroke();g.restore();
}
// The panel above the island: a title, one plain line, and a footer that shows either the guide's
// progress (dots) or the level's photos (taken and available counts).
export function drawPanel(g,w,h,text){
  const [title='',line='',foot='']=text.split('\n');
  g.clearRect(0,0,w,h);
  card(g,28,20,w-56,h-60,34);

  g.textAlign='center';g.textBaseline='alphabetic';
  g.fillStyle=INK;g.font=`600 54px ${SERIF}`;g.fillText(title,w/2,98,w-120);
  rule(g,w/2,122);
  g.fillStyle=INK_SOFT;g.font=`32px ${SANS}`;g.fillText(line,w/2,168,w-120);
  const fy=222,progress=/^(\d+) of (\d+)$/.exec(foot),photos=/^Photos (\d+)\/(\d+)(?: · (.*))?$/.exec(foot);
  if(progress){
    const at=+progress[1],n=+progress[2],gap=30;
    for(let i=0;i<n;i++){
      const x=w/2+(i-(n-1)/2)*gap;g.beginPath();g.arc(x,fy-8,i+1===at?9:6,0,Math.PI*2);
      if(i+1<=at){g.fillStyle=i+1===at?GOLD:GOLD_SOFT;g.fill();}else{g.strokeStyle=LINE;g.lineWidth=2;g.stroke();}
    }
  }else if(photos){
    const taken=+photos[1],slots=+photos[2],note=photos[3]??'';
    const available=Math.max(0,slots-taken);
    g.fillStyle=INK_SOFT;g.font=`26px ${SANS}`;
    g.fillText(`${taken} photo${taken===1?'':'s'} taken \u00b7 ${available} available${note?' \u00b7 '+note:''}`,w/2,fy,w-120);
  }else if(foot){g.fillStyle=INK_SOFT;g.font=`26px ${SANS}`;g.fillText(foot,w/2,fy,w-120);}
}

// Small line icons for the buttons, drawn in a 40px box centred on the origin.
const ICONS={
  'Undo':g=>{g.beginPath();g.arc(1,5,11,0,Math.PI,true);g.stroke();arrowHead(g,-10,8,Math.PI/2);},
  'Restart':g=>{const a=-Math.PI/2+.55,b=-Math.PI/2-.15+Math.PI*2;g.beginPath();g.arc(0,0,12,a,b);g.stroke();arrowHead(g,Math.cos(b)*12,Math.sin(b)*12,b+Math.PI/2);},
  'Drop photo':g=>{g.beginPath();g.roundRect(-11,-13,22,26,3);g.stroke();g.beginPath();g.moveTo(-6,-6);g.lineTo(6,6);g.moveTo(6,-6);g.lineTo(-6,6);g.stroke();},
  'Next level':g=>{g.beginPath();g.moveTo(-12,0);g.lineTo(11,0);g.stroke();arrowHead(g,12,0,0);},
  'Back to build':g=>ICONS['Undo'](g),
  'Put back':g=>{g.beginPath();g.moveTo(-12,2);g.lineTo(0,-10);g.lineTo(12,2);g.moveTo(-8,-1);g.lineTo(-8,12);g.lineTo(8,12);g.lineTo(8,-1);g.stroke();},
  'How to play':g=>{g.beginPath();g.arc(0,0,14,0,Math.PI*2);g.stroke();g.font=`700 20px ${SANS}`;g.textAlign='center';g.textBaseline='middle';g.fillText('?',0,1);},
  'Close':g=>{g.beginPath();g.moveTo(-8,-8);g.lineTo(8,8);g.moveTo(8,-8);g.lineTo(-8,8);g.stroke();},
  'Album':g=>{g.beginPath();g.roundRect(-12,-11,16,20,2);g.stroke();g.beginPath();g.roundRect(-4,-7,16,20,2);g.stroke();},
  'Previous':g=>{g.beginPath();g.moveTo(5,-10);g.lineTo(-5,0);g.lineTo(5,10);g.stroke();},
  'Next':g=>{g.beginPath();g.moveTo(-5,-10);g.lineTo(5,0);g.lineTo(-5,10);g.stroke();},
  'Skip guide':g=>{for(const x of [-6,4]){g.beginPath();g.moveTo(x-5,-9);g.lineTo(x+4,0);g.lineTo(x-5,9);g.stroke();}}
};
function arrowHead(g,x,y,angle){
  g.save();g.translate(x,y);g.rotate(angle);g.beginPath();g.moveTo(-7,-6);g.lineTo(1,0);g.lineTo(-7,6);g.stroke();g.restore();
}
// The shelf shares the desktop toolbar icons, using a quiet, high-contrast surface in VR.
const TOOL_ICONS={
  'More':['M5 11h.01v2H5z','M12 11h.01v2H12z','M19 11h.01v2H19z'],
  'Undo':['M9 7L4.5 11.5 9 16','M5 11.5h9a5 5 0 0 1 0 10h-3'],
  'Restart':['M4.6 13.5a7.5 7.5 0 1 0 2.2-6.6','M5.5 3.5v4.4h4.4'],
  'Drop photo':['M3 6.5h18v13H3z','M8.5 6.5l1.4-2.5h4.2l1.4 2.5','M10 11l4 4M14 11l-4 4'],
  'Next level':['M4 12h15','M13.5 6.5 19 12l-5.5 5.5'],
  'Back to build':['M9 7L4.5 11.5 9 16','M5 11.5h9a5 5 0 0 1 0 10h-3'],
  'Put back':['M3.5 11.5 12 4l8.5 7.5','M6 9.5V20h12V9.5','M10 20v-5h4v5'],
  'How to play':['M12 3a9 9 0 1 0 0.01 0z','M9.6 9.4a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2.9-1.2 1.7v.5','M12 16.9v.2'],
  'Skip guide':['M5 6l6 6-6 6','M12 6l6 6-6 6'],
  'Album':['M3.5 5.5l9.5-1.5 1.8 11.4-9.5 1.5z','M9.5 7h11v13h-11z','M11.5 16.5l2.5-3 2 2 1.5-1.5 1.5 2.5'],
  'Close':['M6 6l12 12','M18 6 6 18'],
  'Photos':['M3 7.5h18v12H3z','M8 7.5l1.5-2.5h5L16 7.5','M12 10.5a3.2 3.2 0 1 0 0.01 0z'],
  'Settings':['M4 7h9','M17 7h3','M4 17h3','M11 17h9','M15 4.5v5','M9 14.5v5'],
  'Story':['M4 5.5h11a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 3v-3H4z','M8 10h6','M8 13h4'],
  'Hint':['M9 17.5h6','M10 20.5h4','M12 3.5a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3.5z'],
  'Room':['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z','M12 9.2a2.8 2.8 0 1 0 0.01 0z']
};
const paths=new Map(),pathOf=d=>{let p=paths.get(d);if(!p){p=new Path2D(d);paths.set(d,p);}return p;};
// The shelf behind the tools: a paper card with a soft shadow and gently rounded corners, so every key
// sits well inside it.
export function drawToolbar(g,w,h,margin){
  g.clearRect(0,0,w,h);
  card(g,margin,margin,w-margin*2,h-margin*2,22,{shadow:.25,lift:5});
  g.strokeStyle=LINE;g.lineWidth=1.5;
  for(const fraction of [1/3,2/3]){const x=margin+(w-2*margin)*fraction;g.beginPath();g.moveTo(x,h*.26);g.lineTo(x,h*.74);g.stroke();}
}
// Quiet icon buttons share one surface. Only the focused tool gets its own highlight.
export function drawTool(g,w,h,item,hover=false){
  g.clearRect(0,0,w,h);
  const on=item.active||item.primary&&!item.disabled;
  if(hover||on)card(g,6,6,w-12,h-12,20,{fill:on?'#dde7e2':'#e2e6e3',shadow:0,lift:0});
  g.globalAlpha=item.disabled?.4:1;
  const s=h*.32/24;
  g.save();g.translate(w/2-12*s,h*.17);g.scale(s,s);g.lineWidth=1.8;g.lineCap=g.lineJoin='round';g.strokeStyle=hover||on?GOLD_SOFT:INK;
  for(const d of TOOL_ICONS[item.icon??item.label]??[])g.stroke(pathOf(d));g.restore();
  g.fillStyle=hover||on?GOLD_SOFT:INK_SOFT;g.font=`500 ${Math.round(h*.15)}px ${SANS}`;g.textAlign='center';g.textBaseline='alphabetic';
  g.fillText(item.label,w/2,h*.79,w-20);g.globalAlpha=1;
}
// A photo drawn like a polaroid: white border, slightly turned, a soft shadow.
function photoCard(g,img,cx,cy,size,turn,sky){
  g.save();g.translate(cx,cy);g.rotate(turn);
  card(g,-size/2,-size/2,size,size*1.16,6,{fill:'#fffdf8',shadow:.28,lift:8});
  const inset=size*.06,pic=size-inset*2;
  g.fillStyle=sky??'#e9dccd';g.fillRect(-size/2+inset,-size/2+inset,pic,pic);
  if(img?.complete&&img.naturalWidth){
    const n=Math.min(img.naturalWidth,img.naturalHeight);
    g.drawImage(img,(img.naturalWidth-n)/2,(img.naturalHeight-n)/2,n,n,-size/2+inset,-size/2+inset,pic,pic);
  }
  g.restore();
}
function rule(g,cx,y,half=70){
  g.strokeStyle=LINE;g.lineWidth=1.5;g.beginPath();g.moveTo(cx-half,y);g.lineTo(cx+half,y);g.stroke();
}
function wrapText(g,text,maxWidth){
  const lines=[];let line='';
  for(const word of String(text).split(' ')){const next=line?line+' '+word:word;if(line&&g.measureText(next).width>maxWidth){lines.push(line);line=word;}else line=next;}
  if(line)lines.push(line);return lines;
}
// One level in the album: its picture, number and name, and a gold tick once it is done.
export function drawLevelTile(g,w,h,{number=1,title='',done=false,current=false,img=null},hover=false){
  g.clearRect(0,0,w,h);
  const x=8,y=6,kw=w-16,kh=h-16,r=8;
  card(g,x,y,kw,kh,r,{fill:hover?'#e0e5e3':'#ece8df',shadow:hover?.3:.16,lift:hover?3:4});
  g.lineWidth=hover?6:current?4:2;g.strokeStyle=hover?GOLD:current?INK:LINE;g.beginPath();g.roundRect(x,y,kw,kh,r);g.stroke();
  const pad=14,pw=kw-pad*2,ph=kh*.56;
  g.save();g.beginPath();g.roundRect(x+pad,y+pad,pw,ph,8);g.clip();
  g.fillStyle=title==='Save here'?'#e4e1d7':'#e9dccd';g.fillRect(x+pad,y+pad,pw,ph);
  if(title==='Save here'&&!img){
    const cx=x+pad+pw/2,cy=y+pad+ph/2;g.strokeStyle=GOLD;g.lineWidth=2.5;
    g.beginPath();g.arc(cx,cy,23,0,Math.PI*2);g.stroke();g.beginPath();g.moveTo(cx-10,cy);g.lineTo(cx+10,cy);g.moveTo(cx,cy-10);g.lineTo(cx,cy+10);g.stroke();
  }
  if(img?.complete&&img.naturalWidth){
    const s=Math.max(pw/img.naturalWidth,ph/img.naturalHeight),iw=img.naturalWidth*s,ih=img.naturalHeight*s;
    g.drawImage(img,x+pad+(pw-iw)/2,y+pad+(ph-ih)/2,iw,ih);
  }
  g.restore();
  if(done){
    const cx=x+kw-pad-20,cy=y+pad+20;g.fillStyle=GOLD;g.beginPath();g.arc(cx,cy,17,0,Math.PI*2);g.fill();
    g.strokeStyle=PAPER;g.lineWidth=4;g.lineCap='round';g.beginPath();g.moveTo(cx-8,cy);g.lineTo(cx-2,cy+6);g.lineTo(cx+8,cy-6);g.stroke();
  }
  g.textAlign='center';g.textBaseline='alphabetic';
  g.fillStyle=INK_SOFT;g.font=`600 26px ${SANS}`;g.fillText(String(number).padStart(2,'0'),w/2,y+pad+ph+32);
  g.fillStyle=INK;g.font=`600 34px ${SERIF}`;g.fillText(title,w/2,y+pad+ph+70,kw-16);
}
// A pill button: paper with ink, or ink with paper for the one thing to do next. Hovered, it warms
// to gold so you can see which button a pinch will press.
// A card page: a small heading in capitals, a title, a gold rule and a line under it, and any labels for
// the rows below (each at a fraction of the height). The keys on it are separate.
// Every card uses this page, as Settings does: the heading top left, the content in the middle, the keys
// along the bottom. labels are small section headings, notes a quiet line of text, photos polaroids;
// their positions are fractions of the page.
export function drawSheet(g,w,h,{kicker='',title='',subtitle='',labels=[],notes=[],photos=[],sky=null}){
  g.clearRect(0,0,w,h);
  card(g,24,20,w-48,h-48,34);

  g.textAlign='left';g.textBaseline='alphabetic';
  g.fillStyle=INK_SOFT;g.font=`600 24px ${SANS}`;g.fillText(kicker.toUpperCase(),72,82,w-144);
  g.fillStyle=INK;g.font=`600 52px ${SERIF}`;g.fillText(title,72,144,w-144);
  if(subtitle){g.fillStyle=INK_SOFT;g.font=`italic 30px ${SERIF}`;g.fillText(subtitle,72,192,w-144);}
  rule(g,w/2,subtitle?220:180,w/2-72);
  for(const {text,y} of labels){g.fillStyle=INK_SOFT;g.font=`600 24px ${SANS}`;g.fillText(text.toUpperCase(),72,y*h,w-144);}
  g.textAlign='center';
  for(const {text,y} of notes){g.fillStyle=INK_SOFT;g.font=`italic 30px ${SERIF}`;g.fillText(text,w/2,y*h,w-144);}
  for(const p of photos)photoCard(g,p.img,p.x*w,p.y*h,p.size*w,p.turn??0,sky);
}
// One photo on the photos card: the picture, its number, and what it keeps.
export function drawPhotoTile(g,w,h,{number=1,img=null,text='',sky=null}){
  g.clearRect(0,0,w,h);
  card(g,8,6,w-16,h-16,16,{fill:'#ece8df',shadow:.12,lift:3});
  g.strokeStyle=LINE;g.lineWidth=2;g.beginPath();g.roundRect(8,6,w-16,h-16,8);g.stroke();
  const pad=18,pw=w-16-pad*2,ph=pw*.62;
  g.save();g.beginPath();g.roundRect(8+pad,6+pad,pw,ph,8);g.clip();g.fillStyle=sky??'#e9dccd';g.fillRect(8+pad,6+pad,pw,ph);
  if(img?.complete&&img.naturalWidth){const k=Math.max(pw/img.naturalWidth,ph/img.naturalHeight),iw=img.naturalWidth*k,ih=img.naturalHeight*k;g.drawImage(img,8+pad+(pw-iw)/2,6+pad+(ph-ih)/2,iw,ih);}
  g.restore();
  g.textAlign='center';g.textBaseline='alphabetic';
  g.fillStyle=INK;g.font=`600 30px ${SERIF}`;g.fillText(`Photo ${number}`,w/2,6+pad+ph+40,w-40);
  g.fillStyle=INK_SOFT;g.font=`24px ${SANS}`;
  wrapText(g,text,w-48).slice(0,3).forEach((t,i)=>g.fillText(t,w/2,6+pad+ph+74+i*30,w-40));
}
// Under the frame while you hold it: what the photo would do, and what it would replace.
export function drawFrameLabel(g,w,h,{label='',extra='',ready=false}){
  g.clearRect(0,0,w,h);
  g.font=`600 34px ${SANS}`;
  const width=Math.min(w-8,Math.max(g.measureText(label).width,g.measureText(extra).width)+56),x=(w-width)/2,bh=extra?110:64;
  g.fillStyle='#f4f0e7';g.beginPath();g.roundRect(x,4,width,bh,22);g.fill();
  g.textAlign='center';g.textBaseline='middle';
  g.fillStyle=ready?'#456d58':INK;g.fillText(label,w/2,4+32,width-24);
  if(extra){g.fillStyle=INK_SOFT;g.fillText(extra,w/2,4+78,width-24);}
}
export function drawButton(g,w,h,item,hover=false){
  g.clearRect(0,0,w,h);
  const primary=item.primary&&!item.disabled,active=item.active&&!item.disabled;
  const fill=primary?GOLD:active?'#dce6df':hover?'#e0e5e3':'#eeeae1';
  card(g,10,8,w-20,h-24,20,{fill,shadow:0,lift:0});
  if(hover){g.strokeStyle=GOLD;g.lineWidth=3;g.beginPath();g.roundRect(10,8,w-20,h-24,8);g.stroke();}
  const color=item.disabled?'#8b8e85':primary?PAPER:INK,icon=ICONS[item.label];
  g.font=`500 42px ${SANS}`;const label=item.label,textWidth=Math.min(g.measureText(label).width,w-(icon?120:60));
  const iconSpace=icon?48:0,left=w/2-(iconSpace+textWidth)/2,cy=(h-16)/2;
  if(icon){g.save();g.translate(left+18,cy);g.strokeStyle=g.fillStyle=primary?PAPER:GOLD;g.lineWidth=3;g.lineCap=g.lineJoin='round';icon(g);g.restore();}
  g.fillStyle=color;g.textAlign='left';g.textBaseline='middle';g.fillText(label,left+iconSpace,cy+1,w-(icon?120:60));
  if(active){g.fillStyle='#456d58';g.beginPath();g.arc(w-30,cy,5,0,Math.PI*2);g.fill();}
}
