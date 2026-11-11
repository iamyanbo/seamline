import {PEOPLE} from './illusion-story.js';

// The level entrance uses the same dialogue cursor on screen and in VR.
export function createStoryUI({onClose,onLayout}){
  const $=id=>document.getElementById(id),dialog=$('level-dialogue');
  let scene=null,line=0,advancedAt=-Infinity;
  const entry=()=>scene?{scene,index:line,speaker:scene.lines[line][0],text:scene.lines[line][1],last:line===scene.lines.length-1}:null;
  function render(){
    const current=entry();if(!current)return;
    $('speaker-name').textContent=current.speaker;
    dialog.style.setProperty('--speaker-color',PEOPLE[current.speaker].color);
    $('conversation-line').textContent=current.text;
    $('story-next').setAttribute('aria-label',current.last?'Begin level':'Continue notes');
    $('dialogue-cue-text').textContent=current.last?'tap to begin':'tap to continue';
    const voice=dialog.querySelector('.conversation-voice');voice.classList.remove('speaking');void voice.offsetWidth;voice.classList.add('speaking');
    requestAnimationFrame(()=>{if(dialog.open)onLayout();});
  }
  const finish=()=>{scene=null;document.body.classList.remove('in-dialogue');if(dialog.open)dialog.close();};
  const advance=()=>{
    if(!scene||performance.now()-advancedAt<240)return;
    advancedAt=performance.now();if(entry().last){finish();return;}line++;render();
  };
  const back=()=>{if(scene&&line>0){line--;render();}};
  $('story-next').addEventListener('click',advance);
  $('dialogue-skip').addEventListener('click',finish);
  dialog.addEventListener('keydown',e=>{
    if(e.key==='Escape')return;
    if(e.key===' '||e.key==='Enter'||e.key==='ArrowRight'){
      if(e.target===$('dialogue-skip')&&(e.key==='Enter'||e.key===' '))return;
      e.preventDefault();e.stopPropagation();if(!e.repeat)advance();
    }else if(e.key==='ArrowLeft'){e.preventDefault();e.stopPropagation();if(!e.repeat)back();}
  });
  dialog.addEventListener('close',()=>{if(!dialog.open){scene=null;document.body.classList.remove('in-dialogue');onClose();}});
  return {
    current:()=>dialog.open?entry():null,advance,back,finish,
    get open(){return dialog.open;},reset:finish,
    show(next,title){
      if(!next){finish();return;}
      scene=next;line=0;advancedAt=-Infinity;$('dialogue-place').textContent=next.place;
      $('dialogue-title').textContent=title;
      document.body.classList.add('in-dialogue');
      render();if(!dialog.open)dialog.showModal();
    }
  };
}
