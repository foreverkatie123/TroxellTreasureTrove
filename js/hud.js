// ---------------- HUD dragging + resizing ----------------
// hudScale and applyHudTransform are intentionally NOT inside the IIFE below —
// session.js (save/restore) and js/remote.js (buildSnapshot, for the Remote's
// read-only size label) both need to read/set them.
let hudScale = 1; // 0.6–2.5, persisted in the session
let hudCustomPositioned = false; // true once the HUD has been dragged off its default centered spot

function applyHudTransform(){
  const hud = document.getElementById('hud');
  if(!hud) return;
  hud.style.transform = hudCustomPositioned
    ? `scale(${hudScale})`
    : `translateX(-50%) scale(${hudScale})`;
}

(function(){
  const hud = document.getElementById('hud');
  const resizeHandle = hud.querySelector('.hudResizeHandle');
  let dragging = false, offX = 0, offY = 0;
  let resizing = false, resizeStartX = 0, resizeStartY = 0, resizeStartScale = 1;

  function clampAndPlace(clientX, clientY){
    const maxX = window.innerWidth - hud.offsetWidth - 4;
    const maxY = window.innerHeight - hud.offsetHeight - 4;
    const x = Math.min(Math.max(4, clientX - offX), Math.max(4, maxX));
    const y = Math.min(Math.max(4, clientY - offY), Math.max(4, maxY));
    hud.style.left = x + 'px';
    hud.style.top = y + 'px';
    hudCustomPositioned = true;
    applyHudTransform();
  }
  function startDrag(clientX, clientY){
    dragging = true;
    const rect = hud.getBoundingClientRect();
    offX = clientX - rect.left;
    offY = clientY - rect.top;
    document.body.style.userSelect = 'none';
    hud.classList.add('dragging');
    return true;
  }
  function endDrag(){
    if(!dragging) return;
    dragging = false;
    document.body.style.userSelect = '';
    hud.classList.remove('dragging');
    afterStateChange();
  }
  hud.addEventListener('mousedown', e => {
    if(e.target.closest('.hudResizeHandle')) return; // handled separately below
    startDrag(e.clientX, e.clientY);
  });
  window.addEventListener('mousemove', e => {
    if(!dragging) return;
    clampAndPlace(e.clientX, e.clientY);
  });
  window.addEventListener('mouseup', endDrag);
  hud.addEventListener('touchstart', e => {
    if(e.target.closest('.hudResizeHandle')) return;
    const t = e.touches[0];
    if(!t) return;
    if(startDrag(t.clientX, t.clientY)) e.preventDefault();
  }, { passive:false });
  window.addEventListener('touchmove', e => {
    if(!dragging) return;
    const t = e.touches[0];
    if(!t) return;
    e.preventDefault();
    clampAndPlace(t.clientX, t.clientY);
  }, { passive:false });
  window.addEventListener('touchend', endDrag);
  window.addEventListener('touchcancel', endDrag);

  // ---- Drag the corner handle to resize, instead of a slider ----
  function startResize(clientX, clientY){
    resizing = true;
    resizeStartX = clientX;
    resizeStartY = clientY;
    resizeStartScale = hudScale;
    document.body.style.userSelect = 'none';
    hud.classList.add('resizing');
    return true;
  }
  function doResize(clientX, clientY){
    // dragging down-right grows it, up-left shrinks it
    const delta = (clientX - resizeStartX) + (clientY - resizeStartY);
    hudScale = Math.min(2.5, Math.max(0.6, resizeStartScale + delta / 220));
    applyHudTransform();
  }
  function endResize(){
    if(!resizing) return;
    resizing = false;
    document.body.style.userSelect = '';
    hud.classList.remove('resizing');
    afterStateChange();
  }
  if(resizeHandle){
    resizeHandle.addEventListener('mousedown', e => {
      e.stopPropagation(); // don't also trigger the move-drag on #hud
      startResize(e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', e => {
      if(!resizing) return;
      doResize(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', endResize);
    resizeHandle.addEventListener('touchstart', e => {
      e.stopPropagation();
      const t = e.touches[0];
      if(!t) return;
      if(startResize(t.clientX, t.clientY)) e.preventDefault();
    }, { passive:false });
    window.addEventListener('touchmove', e => {
      if(!resizing) return;
      const t = e.touches[0];
      if(!t) return;
      e.preventDefault();
      doResize(t.clientX, t.clientY);
    }, { passive:false });
    window.addEventListener('touchend', endResize);
    window.addEventListener('touchcancel', endResize);
  }

  applyHudTransform();
})();