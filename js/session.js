const STORAGE_KEY = 'blackstoneTvSession_v2';
      let saveTimer = null;

      function buildSessionData(){
        const rect = initDrawer.getBoundingClientRect();
        const hudEl = document.getElementById('hud');
        const hudRect = hudEl.getBoundingClientRect();
        const hudMoved = hudEl.style.transform === 'none';
        return {
          combatants, activeId, round, nextId,
          autoSort, manualOrder, lairAction, combatStarted,
          combatLog, logNextId,
          diceType, diceCount, diceModifier, diceAdvMode, logDiceRolls, rollHistory, rollNextId,
          diceMaterial, diceTrail,
          gridOn, gridSize, gridOpacity, gridMajor, gridColor, zoomLocked,
          fogEnabled, shownRegions: [...shown],
          feetPerSquare, effects, hudScale,
          timers, nextTimerId,
          initPos: { left: rect.left, top: rect.top },
          hudPos: hudMoved ? { left: hudRect.left, top: hudRect.top } : null,
          widgetShell: WidgetShell.getState()
        };
      }

      function saveSession(){
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          try{
            localStorage.setItem(STORAGE_KEY, JSON.stringify(buildSessionData()));
          }catch(err){
            console.warn('Session save failed:', err);
          }
        }, 300);
      }

      function restoreSession(){
        let raw;
        try{ raw = localStorage.getItem(STORAGE_KEY); }catch(err){ return; }
        if(!raw){
          // fall back to old v1 session (pre roster support) so nobody loses their game mid-upgrade
          try{ raw = localStorage.getItem('blackstoneTvSession_v1'); }catch(err){}
        }
        if(!raw) return;
        let data;
        try{ data = JSON.parse(raw); }catch(err){ return; }
        applySessionData(data);
      }

      // Applies a session data object (from localStorage OR a Firestore cloud save) to live state.
      function applySessionData(data){
        combatants = (data.combatants || []).map(c => ({
          id: c.id, name: c.name, init: c.init,
          notes: c.notes !== undefined ? c.notes : (typeof c.hp === 'string' ? c.hp : ''),
          hp: typeof c.hp === 'number' ? c.hp : null,
          maxHp: typeof c.maxHp === 'number' ? c.maxHp : null,
          tempHp: typeof c.tempHp === 'number' ? c.tempHp : 0,
          ac: typeof c.ac === 'number' ? c.ac : null,
          rosterId: c.rosterId || null,
          delayed: !!c.delayed,
          ready: !!c.ready,
          legendaryMax: typeof c.legendaryMax === 'number' ? c.legendaryMax : 0,
          legendaryLeft: typeof c.legendaryLeft === 'number' ? c.legendaryLeft : (typeof c.legendaryMax === 'number' ? c.legendaryMax : 0),
          conditions: Array.isArray(c.conditions) ? c.conditions.filter(id => conditionInfo(id)) : [],
          exhaustion: typeof c.exhaustion === 'number' ? Math.max(0, Math.min(6, c.exhaustion)) : 0,
          concentrating: !!c.concentrating,
          concentrationSpell: c.concentrationSpell || '',
          concentrationRounds: typeof c.concentrationRounds === 'number' ? c.concentrationRounds : 0,
          spellSlots: c.spellSlots && typeof c.spellSlots === 'object' ? c.spellSlots : {},
          preparedSpells: Array.isArray(c.preparedSpells) ? c.preparedSpells : []
        }));
        activeId = data.activeId ?? null;
        round = data.round || 1;
        nextId = data.nextId || 1;

        autoSort = data.autoSort !== undefined ? !!data.autoSort : true;
        combatStarted = data.combatStarted !== undefined ? !!data.combatStarted : (round > 1);
        combatLog = Array.isArray(data.combatLog) ? data.combatLog : [];
        logNextId = data.logNextId || (combatLog.length ? Math.max(...combatLog.map(e => e.id || 0)) + 1 : 1);
        renderLog();

        diceType = [4,6,8,10,12,20,100].includes(data.diceType) ? data.diceType : 20;
        diceCount = typeof data.diceCount === 'number' ? Math.max(1, Math.min(20, data.diceCount)) : 1;
        diceModifier = typeof data.diceModifier === 'number' ? Math.max(-20, Math.min(20, data.diceModifier)) : 0;
        diceAdvMode = ['normal','adv','dis'].includes(data.diceAdvMode) ? data.diceAdvMode : 'normal';
        logDiceRolls = !!data.logDiceRolls;
        rollHistory = Array.isArray(data.rollHistory) ? data.rollHistory : [];
        rollNextId = data.rollNextId || (rollHistory.length ? Math.max(...rollHistory.map(e => e.id || 0)) + 1 : 1);
        diceMaterial = DICE_MATERIALS.some(m => m.id === data.diceMaterial) ? data.diceMaterial : 'crystal';
        diceTrail = DICE_TRAILS.some(t => t.id === data.diceTrail) ? data.diceTrail : 'none';
        diceLogToggleEl.classList.toggle('on', logDiceRolls);
        updateDiceControlsUI();
        renderDiceHistory();
        renderMaterialGrid();
        renderTrailGrid();
        manualOrder = Array.isArray(data.manualOrder) ? data.manualOrder : [];
        lairAction = data.lairAction && typeof data.lairAction === 'object'
          ? { enabled: !!data.lairAction.enabled, initCount: data.lairAction.initCount || 20, triggered: !!data.lairAction.triggered }
          : { enabled:false, initCount:20, triggered:false };
        autoSortToggleEl.classList.toggle('on', autoSort);
        lairToggleEl.classList.toggle('on', lairAction.enabled);
        lairConfigRowEl.style.display = lairAction.enabled ? '' : 'none';
        lairInitCountEl.value = lairAction.initCount;

        gridOn = data.gridOn !== undefined ? data.gridOn : true;
        gridSize = data.gridSize || 88;
        gridOpacity = data.gridOpacity !== undefined ? data.gridOpacity : 0.30;
        gridMajor = data.gridMajor || 5;
        gridColor = data.gridColor || '#7ad4e0';
        zoomLocked = data.zoomLocked !== undefined ? data.zoomLocked : true;

        fogEnabled = !!data.fogEnabled;
        shown = new Set(data.shownRegions || []);

        feetPerSquare = data.feetPerSquare || 5;
        effects = data.effects || [];

        hudScale = typeof data.hudScale === 'number' ? Math.min(2.5, Math.max(0.6, data.hudScale)) : 1;
        applyHudScale();

        timers = Array.isArray(data.timers) ? data.timers : [];
        nextTimerId = data.nextTimerId || (timers.length ? Math.max(...timers.map(t => t.id || 0)) + 1 : 1);
        renderTimers();

        document.getElementById('gridToggle').classList.toggle('on', gridOn);
        document.getElementById('gridSize').value = gridSize;
        document.getElementById('gridOpacity').value = Math.round(gridOpacity * 100);
        document.getElementById('gridMajor').value = gridMajor;
        document.querySelectorAll('.swatch').forEach(s => s.classList.toggle('selected', s.dataset.color === gridColor));
        document.getElementById('zoomLockToggle').classList.toggle('on', zoomLocked);
        document.getElementById('feetPerSquare').value = feetPerSquare;

        if(data.widgetShell){
          WidgetShell.loadState(data.widgetShell);
          WidgetShell.setLayout(WidgetShell.getCurrentLayout());
        } else if(data.initPos && typeof data.initPos.left === 'number'){
          // Legacy session predating the widget shell/layout system - migrate the
          // remembered Initiative panel position into the new "Combat" layout.
          const maxX = Math.max(4, window.innerWidth - 300 - 4);
          const maxY = Math.max(4, window.innerHeight - 100 - 4);
          const x = Math.min(Math.max(4, data.initPos.left), maxX);
          const y = Math.min(Math.max(4, data.initPos.top), maxY);
          initDrawer.style.left = x + 'px';
          initDrawer.style.top = y + 'px';
          initDrawer.style.right = 'auto';
          WidgetShell.recordRect('initiative');
        }
        if(typeof renderLayoutPanel === 'function') renderLayoutPanel();

        if(data.hudPos && typeof data.hudPos.left === 'number'){
          const hudEl = document.getElementById('hud');
          const maxX = Math.max(4, window.innerWidth - 4);
          const maxY = Math.max(4, window.innerHeight - 4);
          const x = Math.min(Math.max(4, data.hudPos.left), maxX);
          const y = Math.min(Math.max(4, data.hudPos.top), maxY);
          hudEl.style.left = x + 'px';
          hudEl.style.top = y + 'px';
          hudEl.style.transform = 'none';
        }

        if(combatants.length){
          const note = document.getElementById('restoredNote');
          if(note) note.style.display = 'block';
        }

        render(); updateFogUI(); updateEffectsListUI(); renderAllEffects(); clearRuler();
      }

      document.getElementById('clearSessionBtn').addEventListener('click', () => {
        try{ localStorage.removeItem(STORAGE_KEY); }catch(err){}
        combatants = []; activeId = null; round = 1; nextId = 1;
        autoSort = true; manualOrder = []; lairAction = { enabled:false, initCount:20, triggered:false };
        combatStarted = false; condPickerOpenFor = null;
        combatLog = []; logNextId = 1; renderLog();
        diceType = 20; diceCount = 1; diceModifier = 0; diceAdvMode = 'normal'; logDiceRolls = false;
        rollHistory = []; rollNextId = 1;
        diceMaterial = 'crystal'; diceTrail = 'none';
        diceLogToggleEl.classList.remove('on');
        updateDiceControlsUI();
        renderDiceHistory();
        renderMaterialGrid();
        renderTrailGrid();
        autoSortToggleEl.classList.add('on');
        lairToggleEl.classList.remove('on');
        lairConfigRowEl.style.display = 'none';
        lairInitCountEl.value = 20;
        shown = new Set(); fogEnabled = false; effects = [];
        hudScale = 1; applyHudScale();
        timers = []; nextTimerId = 1; renderTimers();
        WidgetShell.LAYOUT_DEFS.forEach(d => WidgetShell.resetLayout(d.id));
        render(); updateFogUI(); updateEffectsListUI(); renderAllEffects(); clearRuler();
      });