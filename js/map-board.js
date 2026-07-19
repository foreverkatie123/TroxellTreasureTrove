      // ---------------- Map / Grid ----------------
      const stage = document.getElementById('stage');
      const mapLayer = document.getElementById('mapLayer');
      const mapImage = document.getElementById('mapImage');
      const mapVideo = document.getElementById('mapVideo');
      const gridOverlay = document.getElementById('gridOverlay');
      const fogCanvas = document.getElementById('fogCanvas');
      const fogCtx = fogCanvas.getContext('2d', { willReadFrequently:true });
      const effectsLayer = document.getElementById('effectsLayer');
      const effectsGroup = document.getElementById('effectsGroup');
      const previewGroup = document.getElementById('previewGroup');
      const rulerGroup = document.getElementById('rulerGroup');
      const emptyState = document.getElementById('emptyState');
      const dropzone = document.getElementById('dropzone');
      const fileInput = document.getElementById('fileInput');
      const maskFileInput = document.getElementById('maskFileInput');

      let scale = 1, panX = 0, panY = 0;
      let imgW = 0, imgH = 0;
      let gridOn = true, gridSize = 88, gridOpacity = 0.30, gridMajor = 5, gridColor = '#7ad4e0';
      let zoomLocked = true;

      // Source mode: 'image' | 'video' | null
      let sourceMode = 'overlay';
      let captureStream = null;

      // Fog of war state
      let maskData = null;
      let regions = new Set();
      let shown = new Set();
      let fogEnabled = false;

      // Combat tool state
      let feetPerSquare = 5;
      let mode = 'view'; // 'view' | 'ruler' | 'spell'
      let pendingEffect = null; // {shape, dtype}
      let effects = [];
      let dragOrigin = null;
      let panDragging = false, lastX = 0, lastY = 0;

      // Remote
      let remoteWin = null; // legacy browser fallback

      function isValidMaskPixel(r,g,b,a){
        return a > 20 && !(r < 8 && g < 8 && b < 8);
      }

      function screenToImage(clientX, clientY){
        const rect = stage.getBoundingClientRect();
        return { x: (clientX - rect.left - panX) / scale, y: (clientY - rect.top - panY) / scale };
      }

      function stopCapture(){
        if(captureStream){
          captureStream.getTracks().forEach(t => t.stop());
          captureStream = null;
        }
        mapVideo.srcObject = null;
      }

      function onSourceReady(){
        emptyState.classList.add('hidden');
        maskData = null; regions = new Set();
        updateFogUI();
        resetView();
        drawGrid();
        resizeOverlays();
        renderFog();
        renderAllEffects();
      }

      function loadImageFile(file){
        if(!file || !file.type.startsWith('image/')) return;
        stopCapture();
        sourceMode = 'image';
        mapVideo.style.display = 'none';
        mapImage.style.display = 'block';
        updateCaptureStatus();
        const url = URL.createObjectURL(file);
        mapImage.onload = function(){
          imgW = mapImage.naturalWidth;
          imgH = mapImage.naturalHeight;
          mapImage.style.width = imgW + 'px';
          mapImage.style.height = imgH + 'px';
          onSourceReady();
        };
        mapImage.src = url;
      }

      async function startCapture(){
        if(!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia){
          alert('Screen/window capture is not supported in this browser. Try a recent Chrome or Edge.');
          return;
        }
        try{
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: 30 },
            audio: false
          });
          stopCapture();
          captureStream = stream;
          sourceMode = 'video';
          mapImage.style.display = 'none';
          mapVideo.style.display = 'block';
          mapVideo.srcObject = stream;

          const track = stream.getVideoTracks()[0];
          if(track){
            track.addEventListener('ended', () => {
              updateCaptureStatus('Capture ended - source window was closed or sharing stopped.');
            });
          }

          mapVideo.onloadedmetadata = function(){
            imgW = mapVideo.videoWidth;
            imgH = mapVideo.videoHeight;
            mapVideo.style.width = imgW + 'px';
            mapVideo.style.height = imgH + 'px';
            updateCaptureStatus('Live: ' + (track && track.label ? track.label : 'captured source'));
            onSourceReady();
          };
        }catch(err){
          // User cancelled the picker or capture failed - not an error worth alarming over
          if(err && err.name !== 'NotAllowedError'){
            console.warn('Capture failed:', err);
          }
        }
      }

      function updateCaptureStatus(msg){
        const el = document.getElementById('captureStatus');
        if(sourceMode === 'video'){
          el.style.display = 'block';
          el.textContent = msg || 'Live capture active';
        } else if(msg){
          el.style.display = 'block';
          el.textContent = msg;
        } else {
          el.style.display = 'none';
        }
      }

      // Kill native image drag/select/copy-out anywhere on the map - it was hijacking
      // mouse-drag gestures away from ruler/spell/fog handling.
      mapLayer.addEventListener('dragstart', e => e.preventDefault());
      mapLayer.addEventListener('selectstart', e => e.preventDefault());
      mapLayer.addEventListener('contextmenu', e => e.preventDefault());
      mapImage.addEventListener('dragstart', e => e.preventDefault());

      // Block the mouse's back/forward side buttons anywhere on the page - a stray
      // click of button 3/4 while working the map otherwise navigates the browser
      // away and wipes the loaded map/mask (only revealed-fog progress is saved).
      ['mousedown','mouseup','auxclick'].forEach(ev => {
        window.addEventListener(ev, e => {
          if(e.button === 3 || e.button === 4){ e.preventDefault(); e.stopPropagation(); }
        }, true);
      });

      // Warn before any page unload/reload/navigation so the map & mask (which are
      // not saved to disk) can't be lost silently mid-session.
      window.addEventListener('beforeunload', e => {
        if(imgW && sourceMode !== 'overlay'){ e.preventDefault(); e.returnValue = ''; }
      });

      fileInput.addEventListener('change', e => loadImageFile(e.target.files[0]));
      document.getElementById('loadMapBtn').addEventListener('click', () => fileInput.click());
      document.getElementById('captureBtn').addEventListener('click', startCapture);
      document.getElementById('captureBtnInline').addEventListener('click', startCapture);
      dropzone.addEventListener('click', (e) => { if(e.target.id !== 'captureBtnInline') fileInput.click(); });
      ['dragover','dragenter'].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add('hover'); }));
      ['dragleave','drop'].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.remove('hover'); }));
      dropzone.addEventListener('drop', e => { loadImageFile(e.dataTransfer.files[0]); });
      stage.addEventListener('dragover', e => e.preventDefault());
      stage.addEventListener('drop', e => { e.preventDefault(); if(e.dataTransfer.files[0]) loadImageFile(e.dataTransfer.files[0]); });

      function applyTransform(){
        mapLayer.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
        document.getElementById('zoomReadout').textContent = Math.round(scale*100) + '% - ' + (zoomLocked ? 'zoom locked' : 'scroll to zoom') + ', drag to pan';
      }

      function resetView(){
        const vw = stage.clientWidth, vh = stage.clientHeight;
        const fitScale = Math.min(vw / imgW, vh / imgH);
        scale = fitScale;
        panX = (vw - imgW * scale) / 2;
        panY = (vh - imgH * scale) / 2;
        applyTransform();
      }
      document.getElementById('resetViewBtn').addEventListener('click', resetView);
      window.addEventListener('resize', () => { if(imgW) resetView(); });

      function fogModeActive(){ return fogEnabled && !!maskData; }

      function updateCursorClass(){
        stage.classList.toggle('crosshairMode', mode === 'ruler' || mode === 'spell' || fogModeActive());
      }

      stage.addEventListener('mousedown', e => {
        if(emptyState.classList.contains('hidden') === false) return;
        e.preventDefault(); // stops native image-drag/selection ghost from hijacking the gesture
        if(mode === 'ruler' || mode === 'spell'){
          dragOrigin = screenToImage(e.clientX, e.clientY);
          return;
        }
        if(fogModeActive()) return;
        panDragging = true; lastX = e.clientX; lastY = e.clientY;
        stage.classList.add('dragging');
      });
      window.addEventListener('mousemove', e => {
        if(panDragging){
          const dx = e.clientX - lastX, dy = e.clientY - lastY;
          panX += dx; panY += dy;
          lastX = e.clientX; lastY = e.clientY;
          applyTransform();
          return;
        }
        if(dragOrigin){
          const cur = screenToImage(e.clientX, e.clientY);
          if(mode === 'ruler') updateRulerPreview(dragOrigin, cur);
          else if(mode === 'spell') updateSpellPreview(dragOrigin, cur);
        }
      });
      window.addEventListener('mouseup', e => {
        if(panDragging){ panDragging = false; stage.classList.remove('dragging'); return; }
        if(dragOrigin){
          const cur = screenToImage(e.clientX, e.clientY);
          if(mode === 'ruler'){ updateRulerPreview(dragOrigin, cur); }
          else if(mode === 'spell'){ finalizeSpell(dragOrigin, cur); }
          dragOrigin = null;
        }
      });
      stage.addEventListener('click', e => {
        if(emptyState.classList.contains('hidden') === false) return;
        if(mode !== 'view') return;
        if(!fogModeActive()) return;
        handleFogClick(e.clientX, e.clientY);
      });

      stage.addEventListener('wheel', e => {
        if(emptyState.classList.contains('hidden') === false) return;
        e.preventDefault();
        if(zoomLocked) return;
        const rect = stage.getBoundingClientRect();
        const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
        const factor = e.deltaY < 0 ? 1.08 : 0.925;
        const newScale = Math.min(6, Math.max(0.1, scale * factor));
        panX = cx - (cx - panX) * (newScale/scale);
        panY = cy - (cy - panY) * (newScale/scale);
        scale = newScale;
        applyTransform();
      }, { passive:false });

      function drawGrid(){
        gridOverlay.style.width = imgW + 'px';
        gridOverlay.style.height = imgH + 'px';
        if(!gridOn || !imgW){
          gridOverlay.style.backgroundImage = 'none';
          return;
        }
        const rgba = hexToRgba(gridColor, gridOpacity);
        const rgbaMajor = hexToRgba(gridColor, Math.min(1, gridOpacity*1.8));
        const majorSize = gridSize * gridMajor;
        gridOverlay.style.backgroundImage = `
          linear-gradient(to right, ${rgbaMajor} 1px, transparent 1px),
          linear-gradient(to bottom, ${rgbaMajor} 1px, transparent 1px),
          linear-gradient(to right, ${rgba} 1px, transparent 1px),
          linear-gradient(to bottom, ${rgba} 1px, transparent 1px)
        `;
        gridOverlay.style.backgroundSize = `
          ${majorSize}px ${majorSize}px,
          ${majorSize}px ${majorSize}px,
          ${gridSize}px ${gridSize}px,
          ${gridSize}px ${gridSize}px
        `;
      }
      function hexToRgba(hex, a){
        const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
        return `rgba(${r},${g},${b},${a})`;
      }

      document.getElementById('gridToggle').addEventListener('click', function(){
        gridOn = !gridOn;
        this.classList.toggle('on', gridOn);
        drawGrid();
        afterStateChange();
      });
      document.getElementById('gridSize').addEventListener('input', function(){
        gridSize = parseFloat(this.value) || 88; drawGrid(); afterStateChange();
      });
      document.getElementById('gridOpacity').addEventListener('input', function(){
        gridOpacity = this.value/100; drawGrid(); afterStateChange();
      });
      document.getElementById('gridMajor').addEventListener('input', function(){
        gridMajor = parseInt(this.value) || 5; drawGrid(); afterStateChange();
      });
      document.getElementById('zoomLockToggle').addEventListener('click', function(){
        zoomLocked = !zoomLocked;
        this.classList.toggle('on', zoomLocked);
        applyTransform();
        afterStateChange();
      });
      document.querySelectorAll('.swatch').forEach(sw => {
        sw.addEventListener('click', function(){
          document.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
          this.classList.add('selected');
          gridColor = this.dataset.color;
          drawGrid();
          afterStateChange();
        });
      });

      const loadMaskBtn = document.getElementById('loadMaskBtn');
      const fogStatus = document.getElementById('fogStatus');
      const fogToggleRow = document.getElementById('fogToggleRow');
      const fogToggle = document.getElementById('fogToggle');
      const fogRevealAllBtn = document.getElementById('fogRevealAllBtn');
      const fogResetBtn = document.getElementById('fogResetBtn');
      const fogBtn = document.getElementById('fogBtn');

      function resizeOverlays(){
        fogCanvas.width = imgW; fogCanvas.height = imgH;
        fogCanvas.style.width = imgW + 'px'; fogCanvas.style.height = imgH + 'px';
        effectsLayer.setAttribute('width', imgW);
        effectsLayer.setAttribute('height', imgH);
        effectsLayer.setAttribute('viewBox', `0 0 ${imgW} ${imgH}`);
        effectsLayer.style.width = imgW + 'px'; effectsLayer.style.height = imgH + 'px';
      }

      loadMaskBtn.addEventListener('click', () => { if(imgW) maskFileInput.click(); });
      maskFileInput.addEventListener('change', e => loadMaskFile(e.target.files[0]));

      function loadMaskFile(file){
        if(!file || !file.type.startsWith('image/') || !imgW) return;
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = function(){
          const tmp = document.createElement('canvas');
          tmp.width = imgW; tmp.height = imgH;
          const tctx = tmp.getContext('2d', { willReadFrequently:true });
          tctx.drawImage(img, 0, 0, imgW, imgH);
          maskData = tctx.getImageData(0, 0, imgW, imgH);

          regions = new Set();
          const d = maskData.data;
          for(let i=0;i<d.length;i+=4){
            const r=d[i], g=d[i+1], b=d[i+2], a=d[i+3];
            if(isValidMaskPixel(r,g,b,a)) regions.add(r+','+g+','+b);
          }
          fogEnabled = true;
          updateFogUI();
          renderFog();
          URL.revokeObjectURL(url);
        };
        img.src = url;
      }

      function updateFogUI(){
        loadMaskBtn.disabled = !imgW;
        const hasMask = !!maskData;
        fogToggleRow.classList.toggle('disabled', !hasMask);
        fogToggle.classList.toggle('on', fogEnabled && hasMask);
        fogRevealAllBtn.disabled = !hasMask;
        fogResetBtn.disabled = !hasMask;
        fogBtn.classList.toggle('active', fogEnabled && hasMask);
        if(!imgW) fogStatus.textContent = 'No map loaded yet';
        else if(!hasMask) fogStatus.textContent = 'No fog mask loaded';
        else fogStatus.textContent = regions.size + ' region' + (regions.size===1?'':'s') + ' loaded - ' + shown.size + ' revealed';
        updateCursorClass();
        afterStateChange();
      }

      fogToggle.addEventListener('click', function(){ if(maskData){ fogEnabled = !fogEnabled; updateFogUI(); renderFog(); } });
      fogBtn.addEventListener('click', function(){ if(maskData){ fogEnabled = !fogEnabled; updateFogUI(); renderFog(); } });
      fogRevealAllBtn.addEventListener('click', function(){ if(maskData){ shown = new Set(regions); updateFogUI(); renderFog(); } });
      fogResetBtn.addEventListener('click', function(){ if(maskData){ shown = new Set(); updateFogUI(); renderFog(); } });

      function handleFogClick(clientX, clientY){
        const p = screenToImage(clientX, clientY);
        const ix = Math.floor(p.x), iy = Math.floor(p.y);
        if(ix < 0 || iy < 0 || ix >= imgW || iy >= imgH) return;
        const i = (iy * imgW + ix) * 4;
        const d = maskData.data;
        const r = d[i], g = d[i+1], b = d[i+2], a = d[i+3];
        if(!isValidMaskPixel(r,g,b,a)) return;
        const key = r+','+g+','+b;
        if(shown.has(key)) shown.delete(key); else shown.add(key);
        updateFogUI();
        renderFog();
      }

      function renderFog(){
        if(!imgW) return;
        fogCtx.clearRect(0,0,fogCanvas.width,fogCanvas.height);
        if(!fogEnabled || !maskData) return;

        fogCtx.fillStyle = '#000';
        fogCtx.fillRect(0,0,imgW,imgH);
        if(shown.size === 0) return;

        const out = fogCtx.createImageData(imgW, imgH);
        const s = maskData.data, d = out.data;
        for(let i=0;i<s.length;i+=4){
          const r=s[i], g=s[i+1], b=s[i+2], a=s[i+3];
          if(!isValidMaskPixel(r,g,b,a)) continue;
          if(shown.has(r+','+g+','+b)){ d[i]=255; d[i+1]=255; d[i+2]=255; d[i+3]=255; }
        }
        const tmp = document.createElement('canvas');
        tmp.width = imgW; tmp.height = imgH;
        tmp.getContext('2d').putImageData(out, 0, 0);
        fogCtx.globalCompositeOperation = 'destination-out';
        fogCtx.drawImage(tmp, 0, 0);
        fogCtx.globalCompositeOperation = 'source-over';
      }

      const rulerToggle = document.getElementById('rulerToggle');
      const rulerBtn = document.getElementById('rulerBtn');

      function clearRuler(){ rulerGroup.innerHTML = ''; }

      function updateRulerPreview(o, c){
        const dist = Math.hypot(c.x - o.x, c.y - o.y);
        const squares = dist / gridSize;
        const feet = Math.round(squares * feetPerSquare);
        rulerGroup.innerHTML = `
          <line class="rulerLine" x1="${o.x}" y1="${o.y}" x2="${c.x}" y2="${c.y}"/>
          <circle cx="${o.x}" cy="${o.y}" r="4" style="fill:var(--accent-bright)"/>
          <text class="rulerLabel" x="${(o.x+c.x)/2}" y="${(o.y+c.y)/2 - 10}" text-anchor="middle">${feet} ft (${squares.toFixed(1)} sq)</text>
        `;
      }

      function setRulerMode(on){
        if(on){
          if(!imgW) return;
          mode = 'ruler';
          pendingEffect = null;
          previewGroup.innerHTML = '';
          updateFxArmBtn();
        } else {
          if(mode === 'ruler') mode = 'view';
          clearRuler();
        }
        updateModeUI();
      }
      function toggleRuler(){ setRulerMode(mode !== 'ruler'); }
      rulerToggle.addEventListener('click', toggleRuler);
      rulerBtn.addEventListener('click', toggleRuler);

      const fxShapeSel = document.getElementById('fxShape');
      const fxTypeSel = document.getElementById('fxType');
      const fxArmBtn = document.getElementById('fxArmBtn');
      const fxClearAllBtn = document.getElementById('fxClearAllBtn');
      const effectsListEl = document.getElementById('effectsList');

      function computeGeometry(shape, o, c){
        const dx = c.x - o.x, dy = c.y - o.y;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        if(shape === 'cone'){
          const half = 0.4636;
          return {
            ox:o.x, oy:o.y, length:dist,
            p2x:o.x+dist*Math.cos(angle-half), p2y:o.y+dist*Math.sin(angle-half),
            p3x:o.x+dist*Math.cos(angle+half), p3y:o.y+dist*Math.sin(angle+half)
          };
        }
        if(shape === 'line'){
          const halfW = gridSize/2;
          const ux = dist ? dx/dist : 1, uy = dist ? dy/dist : 0;
          const px = -uy, py = ux;
          return {
            x1:o.x+px*halfW, y1:o.y+py*halfW,
            x2:o.x-px*halfW, y2:o.y-py*halfW,
            x3:c.x-px*halfW, y3:c.y-py*halfW,
            x4:c.x+px*halfW, y4:c.y+py*halfW,
            length:dist
          };
        }
        if(shape === 'circle') return { cx:o.x, cy:o.y, r:dist };
        return { x:Math.min(o.x,c.x), y:Math.min(o.y,c.y), w:Math.abs(dx), h:Math.abs(dy) };
      }

      function shapeDistance(shape, geo){
        if(shape === 'cone' || shape === 'line') return geo.length;
        if(shape === 'circle') return geo.r;
        return Math.max(geo.w, geo.h);
      }

      function labelPos(shape, geo, o, c){
        if(shape === 'circle') return { x:geo.cx, y:geo.cy };
        if(shape === 'square') return { x:geo.x+geo.w/2, y:geo.y+geo.h/2 };
        return { x:(o.x+c.x)/2, y:(o.y+c.y)/2 };
      }

      function feetLabel(dist){
        const squares = dist / gridSize;
        const feet = Math.round(squares * feetPerSquare);
        return feet + ' ft';
      }

      function shapeSvg(shape, geo, cls){
        if(shape === 'cone') return `<polygon class="${cls}" points="${geo.ox},${geo.oy} ${geo.p2x},${geo.p2y} ${geo.p3x},${geo.p3y}"/>`;
        if(shape === 'line') return `<polygon class="${cls}" points="${geo.x1},${geo.y1} ${geo.x2},${geo.y2} ${geo.x3},${geo.y3} ${geo.x4},${geo.y4}"/>`;
        if(shape === 'circle') return `<circle class="${cls}" cx="${geo.cx}" cy="${geo.cy}" r="${geo.r}"/>`;
        return `<rect class="${cls}" x="${geo.x}" y="${geo.y}" width="${geo.w}" height="${geo.h}"/>`;
      }

      function updateSpellPreview(o, c){
        if(!pendingEffect) return;
        const geo = computeGeometry(pendingEffect.shape, o, c);
        const dist = shapeDistance(pendingEffect.shape, geo);
        const label = feetLabel(dist);
        const pos = labelPos(pendingEffect.shape, geo, o, c);
        previewGroup.innerHTML = shapeSvg(pendingEffect.shape, geo, 'fxPreview') +
          `<text class="fxLabel" x="${pos.x}" y="${pos.y}" text-anchor="middle">${label}</text>`;
      }

      function finalizeSpell(o, c){
        if(!pendingEffect) return;
        const shape = pendingEffect.shape, dtype = pendingEffect.dtype;
        const geo = computeGeometry(shape, o, c);
        const dist = shapeDistance(shape, geo);
        if(dist >= 4){
          const pos = labelPos(shape, geo, o, c);
          const id = 'fx' + Date.now() + Math.floor(Math.random()*1000);
          effects.push({ id, shape, dtype, geo, label: feetLabel(dist), lx: pos.x, ly: pos.y });
          renderAllEffects();
          updateEffectsListUI();
        }
        previewGroup.innerHTML = '';
        mode = 'view'; pendingEffect = null;
        updateModeUI();
        afterStateChange();
      }

      function renderAllEffects(){
        if(!imgW){ effectsGroup.innerHTML = ''; return; }
        effectsGroup.innerHTML = effects.map(fx =>
          shapeSvg(fx.shape, fx.geo, 'fxShape fx-' + fx.dtype) +
          `<text class="fxLabel" x="${fx.lx}" y="${fx.ly}" text-anchor="middle">${fx.label}</text>`
        ).join('');
      }

      function shapeName(shape){
        return { cone:'Cone', line:'Line', circle:'Circle', cylinder:'Cylinder', cube:'Cube' }[shape] || shape;
      }
      function typeName(dtype){
        return { frost:'Frost', poison:'Poison', acid:'Acid', fire:'Fire', radient:'Radient', necrotic:'Necrotic', force:'Force', lightning: 'Lightning', pyshic:'Psychic', thunder:'Thunder', generic:'Generic' }[dtype] || dtype;
      }

      function updateEffectsListUI(){
        effectsListEl.innerHTML = effects.map(fx => `
          <div class="fxCard">
            <div class="fxDot fx-${fx.dtype}"></div>
            <div class="fxInfo">${shapeName(fx.shape)} • ${typeName(fx.dtype)} • ${fx.label}</div>
            <button class="removeBtn" data-fxid="${fx.id}">✕</button>
          </div>
        `).join('');
        effectsListEl.querySelectorAll('.removeBtn').forEach(btn => {
          btn.addEventListener('click', () => removeEffect(btn.dataset.fxid));
        });
        fxClearAllBtn.disabled = effects.length === 0;
      }

      function removeEffect(id){
        effects = effects.filter(f => f.id !== id);
        renderAllEffects();
        updateEffectsListUI();
        afterStateChange();
      }
      function clearAllEffects(){
        effects = [];
        renderAllEffects();
        updateEffectsListUI();
        afterStateChange();
      }
      fxClearAllBtn.addEventListener('click', clearAllEffects);

      function updateFxArmBtn(){
        fxArmBtn.disabled = !imgW;
        if(mode === 'spell'){
          fxArmBtn.textContent = 'Cancel Placement';
          fxArmBtn.classList.add('armed');
          fxArmBtn.classList.remove('primary');
        } else {
          fxArmBtn.textContent = 'Drag on Map to Place';
          fxArmBtn.classList.remove('armed');
          fxArmBtn.classList.add('primary');
        }
      }

      fxArmBtn.addEventListener('click', () => {
        if(mode === 'spell'){
          mode = 'view'; pendingEffect = null; previewGroup.innerHTML = '';
          updateModeUI();
          return;
        }
        if(!imgW) return;
        pendingEffect = { shape: fxShapeSel.value, dtype: fxTypeSel.value };
        mode = 'spell';
        clearRuler();
        updateModeUI();
      });

      function updateModeUI(){
        rulerToggle.classList.toggle('on', mode === 'ruler');
        rulerBtn.classList.toggle('active', mode === 'ruler');
        updateFxArmBtn();
        updateCursorClass();
        syncRemote();
      }

      document.getElementById('feetPerSquare').addEventListener('input', function(){
        const v = parseFloat(this.value);
        if(!isNaN(v) && v > 0){ feetPerSquare = v; afterStateChange(); }
      });

      const settingsDrawer = document.getElementById('settingsDrawer');
      const initDrawer = document.getElementById('initDrawer');
      const logDrawer = document.getElementById('logDrawer');
      const diceDrawer = document.getElementById('diceDrawer');
      function toggleDrawer(d){ d.classList.toggle('open'); }
      document.getElementById('gearBtn').addEventListener('click', () => toggleDrawer(settingsDrawer));
      document.getElementById('initBtn').addEventListener('click', () => WidgetShell.toggleOpen('initiative'));
      document.getElementById('initCloseBtn').addEventListener('click', () => WidgetShell.setOpen('initiative', false));
      document.getElementById('logBtn').addEventListener('click', () => WidgetShell.toggleOpen('combatLog'));
      document.getElementById('logCloseBtn').addEventListener('click', () => WidgetShell.setOpen('combatLog', false));
      document.getElementById('diceBtn').addEventListener('click', () => WidgetShell.toggleOpen('diceRoller'));
      document.getElementById('diceCloseBtn').addEventListener('click', () => WidgetShell.setOpen('diceRoller', false));

      WidgetShell.register('initiative', initDrawer, {
        title: 'Initiative',
        resizable: true,
        minW: 260, minH: 220,
        defaultOpen: { combat: false, exploration: false, town: false }
      });
      WidgetShell.register('combatLog', logDrawer, {
        title: 'Combat Log',
        resizable: true,
        minW: 260, minH: 200,
        defaultOpen: { combat: false, exploration: false, town: false }
      });
      WidgetShell.register('diceRoller', diceDrawer, {
        title: 'Dice',
        resizable: true,
        minW: 260, minH: 320,
        defaultOpen: { combat: false, exploration: false, town: false }
      });

