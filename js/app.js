      window.addEventListener('keydown', e => {
        const tag = document.activeElement.tagName;
        if(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if(e.key === 'g' || e.key === 'G') toggleDrawer(settingsDrawer);
        if(e.key === 'i' || e.key === 'I') WidgetShell.toggleOpen('initiative');
        if(e.key === 'y' || e.key === 'Y') WidgetShell.toggleOpen('combatLog');
        if(e.key === 'd' || e.key === 'D') WidgetShell.toggleOpen('diceRoller');
        if(e.key === 'l' || e.key === 'L') toggleLayoutPanel();
        if(e.key === 'n' || e.key === 'N') nextTurn();
        if(e.key === 'p' || e.key === 'P') prevTurn();
        if((e.key === 'f' || e.key === 'F') && maskData){ fogEnabled = !fogEnabled; updateFogUI(); renderFog(); }
        if((e.key === 'r' || e.key === 'R') && imgW) toggleRuler();
        if(e.key === 'Escape'){
          settingsDrawer.classList.remove('open');
          WidgetShell.setOpen('initiative', false);
          WidgetShell.setOpen('combatLog', false);
          WidgetShell.setOpen('diceRoller', false);
          toggleLayoutPanel(false);
          if(mode === 'spell'){ mode = 'view'; pendingEffect = null; previewGroup.innerHTML = ''; updateModeUI(); }
          if(mode === 'ruler'){ setRulerMode(false); }
        }
      });

      function initializeTransparentOverlay(){
        if(sourceMode !== 'overlay') return;
        stopCapture();
        mapImage.style.display = 'none';
        mapVideo.style.display = 'none';
        emptyState.classList.add('hidden');
        imgW = window.innerWidth;
        imgH = window.innerHeight;
        mapLayer.style.width = imgW + 'px';
        mapLayer.style.height = imgH + 'px';
        scale = 1; panX = 0; panY = 0;
        applyTransform();
        drawGrid();
        resizeOverlays();
        renderFog();
        renderAllEffects();
      }
      window.addEventListener('resize', () => {
        if(sourceMode === 'overlay') initializeTransparentOverlay();
      });

      restoreSession();
      initializeTransparentOverlay();
      render();
      updateFogUI();
      updateEffectsListUI();
      updateModeUI();
