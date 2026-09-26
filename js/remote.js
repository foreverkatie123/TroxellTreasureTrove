document.getElementById('openRemoteBtn').addEventListener('click', openRemote);
      document.getElementById('remoteBtn').addEventListener('click', openRemote);
      const overlayInteractBtn = document.getElementById('overlayInteractBtn');
      if(overlayInteractBtn){
        let overlayInteractive = false;
        overlayInteractBtn.addEventListener('click', () => {
          overlayInteractive = !overlayInteractive;
          overlayInteractBtn.textContent = overlayInteractive ? 'Disable Overlay Interaction' : 'Enable Overlay Interaction';
          overlayInteractBtn.classList.toggle('armed', overlayInteractive);
          if(window.blackstoneDesktop) window.blackstoneDesktop.setOverlayInteractive(overlayInteractive);
        });
      }
      function openRemote(){
        if(window.blackstoneDesktop){ window.blackstoneDesktop.openController(); return; }
        if(remoteWin && !remoteWin.closed){ remoteWin.focus(); return; }
        remoteWin = window.open('controller.html', 'blackstoneDmRemote', 'width=460,height=860');
      }

      function findCombatant(id){ return combatants.find(c => c.id === id); }

      function clampHp(c){
        if(c.maxHp !== null && c.maxHp !== undefined){
          if(c.hp !== null && c.hp > c.maxHp) c.hp = c.maxHp;
        }
        if(c.hp !== null && c.hp < 0) c.hp = 0;
        if(c.tempHp !== null && c.tempHp < 0) c.tempHp = 0;
      }

      function buildSnapshot(){
        const sorted = [...combatants].sort((a,b) => b.init - a.init)
          .map(c => Object.assign({}, c, {
            hasToken: typeof findTokenForCombatant === 'function' ? !!findTokenForCombatant(c.id) : false
          }));
        const idx = sorted.findIndex(c => c.id === activeId);
        return {
          round, combatants: sorted, activeId,
          onDeckId: sorted.length > 1 ? sorted[(idx + 1) % sorted.length].id : null,
          mapLoaded: !!imgW,
          sourceMode,
          fogEnabled, hasMask: !!maskData,
          regionsTotal: regions.size, regionsShown: shown.size,
          mode, feetPerSquare,
          effects: effects.map(f => ({ id:f.id, shape:f.shape, dtype:f.dtype, label:f.label }))
        };
      }
      function syncRemote(){
        const packet = { source:'blackstoneTV', type:'state', payload: buildSnapshot() };
        if(window.blackstoneDesktop){ window.blackstoneDesktop.publishState(packet.payload); }
        if(remoteWin && !remoteWin.closed){
          try{ remoteWin.postMessage(packet, '*'); }catch(err){}
        }
      }
      setInterval(syncRemote, 1000);

      if(window.blackstoneDesktop){
        window.blackstoneDesktop.onCommand((action, payload) => handleRemoteCommand(action, payload || {}));
        window.blackstoneDesktop.onOverlayInteractive(on => {
          document.body.classList.toggle('overlayInteractive', !!on);
        });
      }

      window.addEventListener('message', e => {
        const d = e.data;
        if(!d || d.source !== 'blackstoneRemote') return;
        if(d.type === 'ready'){ syncRemote(); return; }
        if(d.type === 'command') handleRemoteCommand(d.action, d.payload || {});
      });

      function handleRemoteCommand(action, payload){
        switch(action){
          case 'nextTurn': nextTurn(); break;
          case 'prevTurn': prevTurn(); break;
          case 'addCombatant': {
            if(!payload.name || isNaN(parseFloat(payload.init))) break;
            const c = {
              id: nextId++, name: payload.name, init: parseFloat(payload.init),
              notes: payload.notes || '',
              hp: typeof payload.hp === 'number' ? payload.hp : null,
              maxHp: typeof payload.maxHp === 'number' ? payload.maxHp : null,
              tempHp: typeof payload.tempHp === 'number' ? payload.tempHp : 0,
              ac: typeof payload.ac === 'number' ? payload.ac : null,
              rosterId: payload.rosterId || null,
              delayed: false, ready: false, legendaryMax: 0, legendaryLeft: 0, conditions: [], exhaustion: 0
            };
            combatants.push(c);
            if(!combatStarted) refreshPreStartActive();
            else if(activeId === null) activeId = c.id;
            logEvent(`${c.name} joins initiative (${c.init})`);
            render();
            break;
          }
          case 'addCombatantFromRoster': {
            if(!payload.name || isNaN(parseFloat(payload.init))) break;
            const c = {
              id: nextId++, name: payload.name, init: parseFloat(payload.init),
              notes: payload.notes || '',
              hp: typeof payload.hp === 'number' ? payload.hp : null,
              maxHp: typeof payload.maxHp === 'number' ? payload.maxHp : null,
              tempHp: typeof payload.tempHp === 'number' ? payload.tempHp : 0,
              ac: typeof payload.ac === 'number' ? payload.ac : null,
              rosterId: payload.rosterId || null,
              delayed: false, ready: false, legendaryMax: 0, legendaryLeft: 0, conditions: [], exhaustion: 0
            };
            combatants.push(c);
            if(!combatStarted) refreshPreStartActive();
            else if(activeId === null) activeId = c.id;
            logEvent(`${c.name} joins initiative (${c.init})`);
            render();
            break;
          }
          case 'removeCombatant': {
            const removed = combatants.find(c => c.id === payload.id);
            combatants = combatants.filter(c => c.id !== payload.id);
            if(condPickerOpenFor === payload.id) condPickerOpenFor = null;
            if(typeof removeToken === 'function') removeToken(payload.id);
            if(activeId === payload.id){
              if(!combatStarted) refreshPreStartActive();
              else {
                const ids = idsInOrder();
                activeId = ids.length ? ids[0] : null;
              }
            }
            if(removed) logEvent(`${removed.name} removed from combat`);
            render();
            break;
          }
          case 'clearAll':
            combatants = []; activeId = null; round = 1; manualOrder = []; lairAction.triggered = false;
            combatStarted = false; condPickerOpenFor = null;
            if(typeof clearAllTokens === 'function') clearAllTokens();
            logEvent('— Combat cleared —');
            render();
            break;
          case 'placeToken': if(typeof placeToken === 'function') placeToken(payload.id); break;
          case 'removeToken': if(typeof removeToken === 'function') removeToken(payload.id); break;
          case 'applyDamage': {
            const c = findCombatant(payload.id);
            if(!c) break;
            let amt = Math.max(0, parseFloat(payload.amount) || 0);
            const dealt = amt;
            if(c.tempHp && c.tempHp > 0){
              const absorbed = Math.min(c.tempHp, amt);
              c.tempHp -= absorbed;
              amt -= absorbed;
            }
            if(c.hp === null || c.hp === undefined) c.hp = c.maxHp !== null ? c.maxHp : 0;
            c.hp -= amt;
            clampHp(c);
            logEvent(`💥 ${c.name} takes ${dealt} damage${typeof c.hp === 'number' ? ` (${c.hp}${c.maxHp !== null ? '/' + c.maxHp : ''} HP)` : ''}`);
            render();
            break;
          }
          case 'applyHeal': {
            const c = findCombatant(payload.id);
            if(!c) break;
            const amt = Math.max(0, parseFloat(payload.amount) || 0);
            if(c.hp === null || c.hp === undefined) c.hp = 0;
            c.hp += amt;
            clampHp(c);
            logEvent(`💚 ${c.name} heals ${amt}${typeof c.hp === 'number' ? ` (${c.hp}${c.maxHp !== null ? '/' + c.maxHp : ''} HP)` : ''}`);
            render();
            break;
          }
          case 'setCombatantStats': {
            const c = findCombatant(payload.id);
            if(!c) break;
            if(payload.maxHp !== undefined) c.maxHp = payload.maxHp === '' || payload.maxHp === null ? null : parseFloat(payload.maxHp);
            if(payload.hp !== undefined) c.hp = payload.hp === '' || payload.hp === null ? null : parseFloat(payload.hp);
            if(payload.tempHp !== undefined) c.tempHp = payload.tempHp === '' || payload.tempHp === null ? 0 : parseFloat(payload.tempHp);
            if(payload.ac !== undefined) c.ac = payload.ac === '' || payload.ac === null ? null : parseFloat(payload.ac);
            clampHp(c);
            render();
            break;
          }
          case 'toggleFog': if(maskData){ fogEnabled = !fogEnabled; updateFogUI(); renderFog(); } break;
          case 'revealAllFog': if(maskData){ shown = new Set(regions); updateFogUI(); renderFog(); } break;
          case 'resetFog': if(maskData){ shown = new Set(); updateFogUI(); renderFog(); } break;
          case 'setRulerMode': setRulerMode(!!payload.on); break;
          case 'armSpell': {
            if(!imgW) break;
            pendingEffect = { shape: payload.shape, dtype: payload.dtype };
            mode = 'spell';
            clearRuler();
            previewGroup.innerHTML = '';
            updateModeUI();
            break;
          }
          case 'cancelSpell': mode = 'view'; pendingEffect = null; previewGroup.innerHTML = ''; updateModeUI(); break;
          case 'removeEffect': removeEffect(payload.id); break;
          case 'clearAllEffects': clearAllEffects(); break;
          case 'setFeetPerSquare': {
            const v = parseFloat(payload.value);
            if(!isNaN(v) && v > 0){ feetPerSquare = v; document.getElementById('feetPerSquare').value = v; afterStateChange(); }
            break;
          }
          case 'startCapture': startCapture(); break;
        }
      }

      function afterStateChange(){
        saveSession();
        syncRemote();
      }