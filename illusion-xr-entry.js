// Start headset discovery before the game module and its dependency graph load.
(() => {
  const entry=window.frameshiftXR={ready:false,checked:false,vr:false,ar:false};
  entry.apply=()=>{
    const start=document.getElementById('start-vr'),inside=document.getElementById('vr-enter');
    const available=!!navigator.xr&&(!entry.checked||entry.vr);
    start.hidden=!available;start.disabled=!entry.ready||!entry.checked||!entry.vr;
    start.setAttribute('aria-busy',String(available&&start.disabled));
    if(inside){inside.hidden=!entry.vr;inside.disabled=!entry.ready;}
    // Without a headset the VR button stays hidden; say where to find it.
    document.getElementById('intro-note').textContent=!available?'To play in VR, open this page in the Meta Quest browser.':!entry.checked?'Checking headset support...':!entry.ready?'Preparing your journey...':'';
  };
  const supported=mode=>navigator.xr?Promise.resolve().then(()=>navigator.xr.isSessionSupported(mode)).catch(()=>false):Promise.resolve(false);
  // AR discovery must not delay the VR entry button.
  entry.support=supported('immersive-vr').then(ok=>{entry.vr=ok;entry.checked=true;entry.apply();return ok;});
  entry.room=supported('immersive-ar').then(ok=>{entry.ar=ok;return ok;});
  entry.apply();
})();
