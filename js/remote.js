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

      // Keeps only recognized damage-type ids, so a bad/old payload can't poison
      // a combatant's defense lists with junk that'll never match on applyDamage.
      function sanitizeDefenseList(list){
        if(!Array.isArray(list)) return [];
        return list.filter(id => typeof damageTypeInfo === 'function' ? !!damageTypeInfo(id) : true);
      }

      function clampHp(c){
        if(c.maxHp !== null && c.maxHp !== undefined){
          if(c.hp !== null && c.hp > c.maxHp) c.hp = c.maxHp;
        }
        if(c.hp !== null && c.hp < 0) c.hp = 0;
        if(c.tempHp !== null && c.tempHp < 0) c.tempHp = 0;
      }

      function buildSnapshot(){
        if(typeof syncAllGroups === 'function') syncAllGroups(); // group members' records must be current
        const sorted = [...combatants].sort((a,b) => b.init - a.init)
          .map(c => Object.assign({}, c, {
            hasToken: typeof findTokenForCombatant === 'function' ? !!findTokenForCombatant(c.id) : false,
            memberTokens: (c.group && typeof tokens !== 'undefined')
              ? tokens.filter(t => t.combatantId === c.id && typeof t.memberIdx === 'number').map(t => t.memberIdx)
              : []
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
          effects: effects.map(f => ({ id:f.id, shape:f.shape, dtype:f.dtype, label:f.label })),
          lairAction: { enabled: lairAction.enabled, initCount: lairAction.initCount, triggered: lairAction.triggered },
          gridOn: typeof gridOn === 'boolean' ? gridOn : true,
          hudScale: typeof hudScale === 'number' ? hudScale : 1
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
              monsterKey: typeof payload.monsterKey === 'string' ? payload.monsterKey : null,
              delayed: false, ready: false, legendaryMax: 0, legendaryLeft: 0,
              legendaryResistMax: 0, legendaryResistLeft: 0, legendaryReactMax: 0, legendaryReactLeft: 0, conditions: [], exhaustion: 0,
              absorb: sanitizeDefenseList(payload.absorb),
              resistances: sanitizeDefenseList(payload.resistances),
              immunities: sanitizeDefenseList(payload.immunities),
              vulnerabilities: sanitizeDefenseList(payload.vulnerabilities)
            };
            if(parseInt(payload.groupSize) >= 2 && typeof makeGroup === 'function'){
              // Swarm: one initiative slot, N members each with their own HP
              c.group = makeGroup(c.name, payload.groupSize, c.hp);
            }
            combatants.push(c);
            if(!combatStarted) refreshPreStartActive();
            else if(activeId === null) activeId = c.id;
            logEvent(c.group ? `${c.name} ×${c.group.members.length} join initiative as a group (${c.init})` : `${c.name} joins initiative (${c.init})`);
            render();
            break;
          }
          case 'selectGroupMember': {
            const c = findCombatant(payload.id);
            if(!c || !c.group) break;
            selectGroupMember(c, payload.idx);
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
              monsterKey: typeof payload.monsterKey === 'string' ? payload.monsterKey : null,
              delayed: false, ready: false, legendaryMax: 0, legendaryLeft: 0,
              legendaryResistMax: 0, legendaryResistLeft: 0, legendaryReactMax: 0, legendaryReactLeft: 0, conditions: [], exhaustion: 0,
              absorb: sanitizeDefenseList(payload.absorb),
              resistances: sanitizeDefenseList(payload.resistances),
              immunities: sanitizeDefenseList(payload.immunities),
              vulnerabilities: sanitizeDefenseList(payload.vulnerabilities)
            };
            if(parseInt(payload.groupSize) >= 2 && typeof makeGroup === 'function'){
              c.group = makeGroup(c.name, payload.groupSize, c.hp); // swarm of a roster creature
            }
            combatants.push(c);
            if(!combatStarted) refreshPreStartActive();
            else if(activeId === null) activeId = c.id;
            logEvent(c.group ? `${c.name} ×${c.group.members.length} join initiative as a group (${c.init})` : `${c.name} joins initiative (${c.init})`);
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
          case 'placeToken': if(typeof placeToken === 'function') placeToken(payload.id, payload.memberIdx); break;
          case 'removeToken': if(typeof removeToken === 'function') removeToken(payload.id, payload.memberIdx); break;
          case 'placeGroupTokens': if(typeof placeGroupTokens === 'function') placeGroupTokens(payload.id); break;
          case 'setTokenColor': {
            const c = combatants.find(x => x.id === payload.id);
            if(c){
              c.tokenColor = payload.color || null;
              if(typeof renderTokens === 'function') renderTokens();
              afterStateChange();
            }
            break;
          }
          case 'setTokenSize': {
            const c = combatants.find(x => x.id === payload.id);
            if(c){
              c.tokenSize = Math.max(1, Math.min(4, payload.size || 1));
              if(typeof renderTokens === 'function') renderTokens();
              afterStateChange();
            }
            break;
          }
          case 'applyDamage': {
            const c = findCombatant(payload.id);
            if(!c) break;
            let amt = Math.max(0, parseFloat(payload.amount) || 0);
            let note = '';
            let healAmount = 0;
            if(payload.dtype && typeof applyDamageDefenses === 'function'){
              const result = applyDamageDefenses(c, amt, payload.dtype);
              amt = result.amount;
              note = result.note;
              healAmount = result.healAmount || 0;
            }
            const dealt = amt;
            if(c.tempHp && c.tempHp > 0){
              const absorbedTemp = Math.min(c.tempHp, amt);
              c.tempHp -= absorbedTemp;
              amt -= absorbedTemp;
            }
            if(c.hp === null || c.hp === undefined) c.hp = c.maxHp !== null ? c.maxHp : 0;
            c.hp -= amt;
            if(healAmount > 0) c.hp += healAmount;
            clampHp(c);
            if(healAmount > 0){
              const info = typeof damageTypeInfo === 'function' ? damageTypeInfo(payload.dtype) : null;
              logEvent(`🟢 ${c.name} absorbs the ${info ? info.label : payload.dtype} damage and heals ${healAmount}${typeof c.hp === 'number' ? ` (${c.hp}${c.maxHp !== null ? '/' + c.maxHp : ''} HP)` : ''}`);
            } else {
              logEvent(`💥 ${c.name} takes ${dealt} damage${note}${typeof c.hp === 'number' ? ` (${c.hp}${c.maxHp !== null ? '/' + c.maxHp : ''} HP)` : ''}`);
            }
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
            if(payload.name !== undefined && payload.name !== null && payload.name !== '') c.name = payload.name;
            if(payload.init !== undefined && payload.init !== null && payload.init !== '' && !isNaN(parseFloat(payload.init))) c.init = parseFloat(payload.init);
            if(payload.maxHp !== undefined) c.maxHp = payload.maxHp === '' || payload.maxHp === null ? null : parseFloat(payload.maxHp);
            if(payload.hp !== undefined) c.hp = payload.hp === '' || payload.hp === null ? null : parseFloat(payload.hp);
            if(payload.tempHp !== undefined) c.tempHp = payload.tempHp === '' || payload.tempHp === null ? 0 : parseFloat(payload.tempHp);
            if(payload.ac !== undefined) c.ac = payload.ac === '' || payload.ac === null ? null : parseFloat(payload.ac);
            clampHp(c);
            logEvent(`${c.name}'s stats updated`);
            render();
            break;
          }
          case 'toggleCondition': {
            const c = findCombatant(payload.id);
            if(!c) break;
            if(!c.conditions) c.conditions = [];
            const cond = payload.cond;
            const info = conditionInfo(cond);
            const idx = c.conditions.indexOf(cond);
            if(idx >= 0){
              c.conditions.splice(idx, 1);
              logEvent(`${c.name} is no longer ${info ? info.label : cond}`);
            } else {
              c.conditions.push(cond);
              logEvent(`${info ? info.icon + ' ' : ''}${c.name} is now ${info ? info.label : cond}`);
            }
            render();
            break;
          }
          case 'setExhaustion': {
            const c = findCombatant(payload.id);
            if(!c) break;
            c.exhaustion = Math.max(0, Math.min(6, parseInt(payload.value) || 0));
            logEvent(`⚠️ ${c.name} exhaustion → ${c.exhaustion}`);
            render();
            break;
          }
          case 'setLairEnabled': {
            lairAction.enabled = !!payload.on;
            if(!lairAction.enabled && activeId === 'LAIR'){
              const ids = idsInOrder();
              activeId = ids.length ? ids[0] : null;
            }
            if(typeof refreshPreStartActive === 'function') refreshPreStartActive();
            render();
            break;
          }
          case 'setLairInitCount': {
            const v = parseInt(payload.value);
            lairAction.initCount = isNaN(v) ? 20 : v;
            if(typeof refreshPreStartActive === 'function') refreshPreStartActive();
            render();
            break;
          }
          case 'lairTrigger': {
            lairAction.triggered = !lairAction.triggered;
            logEvent(lairAction.triggered ? '🏛 Lair Action used' : '🏛 Lair Action reset');
            render();
            break;
          }
          case 'spendLegendary': {
            const c = findCombatant(payload.id);
            if(!c) break;
            c.legendaryLeft = Math.max(0, (c.legendaryLeft || 0) - 1);
            logEvent(`👑 ${c.name} spends a legendary action (${c.legendaryLeft} left)`);
            render();
            break;
          }
          case 'resetLegendary': {
            const c = findCombatant(payload.id);
            if(!c) break;
            c.legendaryLeft = c.legendaryMax || 0;
            logEvent(`👑 ${c.name}'s legendary actions reset`);
            render();
            break;
          }
          case 'setLegendaryMax': {
            const c = findCombatant(payload.id);
            if(!c) break;
            const v = Math.max(0, Math.min(9, parseInt(payload.value) || 0));
            c.legendaryMax = v;
            c.legendaryLeft = v;
            render();
            break;
          }
          case 'spendLegendaryResist': {
            const c = findCombatant(payload.id);
            if(!c) break;
            c.legendaryResistLeft = Math.max(0, (c.legendaryResistLeft || 0) - 1);
            logEvent(`🔁 ${c.name} uses a legendary resistance (${c.legendaryResistLeft} left)`);
            render();
            break;
          }
          case 'resetLegendaryResist': {
            const c = findCombatant(payload.id);
            if(!c) break;
            c.legendaryResistLeft = c.legendaryResistMax || 0;
            logEvent(`🔁 ${c.name}'s legendary resistances reset`);
            render();
            break;
          }
          case 'spendLegendaryReact': {
            const c = findCombatant(payload.id);
            if(!c) break;
            c.legendaryReactLeft = Math.max(0, (c.legendaryReactLeft || 0) - 1);
            logEvent(`↩️ ${c.name} uses a legendary reaction (${c.legendaryReactLeft} left)`);
            render();
            break;
          }
          case 'resetLegendaryReact': {
            const c = findCombatant(payload.id);
            if(!c) break;
            c.legendaryReactLeft = c.legendaryReactMax || 0;
            logEvent(`↩️ ${c.name}'s legendary reactions reset`);
            render();
            break;
          }
          case 'setLegendaryReactMax': {
            const c = findCombatant(payload.id);
            if(!c) break;
            const v = Math.max(0, Math.min(9, parseInt(payload.value) || 0));
            c.legendaryReactMax = v;
            c.legendaryReactLeft = v;
            render();
            break;
          }
          case 'setLegendaryReact': {
            // Shows/hides the Legendary Reaction row (separate from the LA/LR toggle).
            const c = findCombatant(payload.id);
            if(!c) break;
            c.legendaryReact = !!payload.value;
            render();
            break;
          }
          case 'setLegendary': {
            // Shows/hides the Legendary Actions + Resistance rows for this creature.
            // Values are kept when hidden, so toggling back on restores them.
            const c = findCombatant(payload.id);
            if(!c) break;
            c.legendary = !!payload.value;
            render();
            break;
          }
          case 'setLegendaryResistMax': {
            const c = findCombatant(payload.id);
            if(!c) break;
            const v = Math.max(0, Math.min(9, parseInt(payload.value) || 0));
            c.legendaryResistMax = v;
            c.legendaryResistLeft = v;
            render();
            break;
          }
          case 'setDamageDefense': {
            const c = findCombatant(payload.id);
            if(!c) break;
            const dtype = payload.dtype;
            if(!dtype || (typeof damageTypeInfo === 'function' && !damageTypeInfo(dtype))) break;
            const category = payload.category; // 'absorb' | 'resist' | 'immune' | 'vulnerable' | null/other clears it
            if(!c.absorb) c.absorb = [];
            if(!c.resistances) c.resistances = [];
            if(!c.immunities) c.immunities = [];
            if(!c.vulnerabilities) c.vulnerabilities = [];
            c.absorb = c.absorb.filter(d => d !== dtype);
            c.resistances = c.resistances.filter(d => d !== dtype);
            c.immunities = c.immunities.filter(d => d !== dtype);
            c.vulnerabilities = c.vulnerabilities.filter(d => d !== dtype);
            if(category === 'absorb') c.absorb.push(dtype);
            else if(category === 'resist') c.resistances.push(dtype);
            else if(category === 'immune') c.immunities.push(dtype);
            else if(category === 'vulnerable') c.vulnerabilities.push(dtype);
            render();
            break;
          }
          case 'toggleGrid': {
            if(!imgW) break;
            gridOn = !gridOn;
            const gridToggleEl = document.getElementById('gridToggle');
            if(gridToggleEl) gridToggleEl.classList.toggle('on', gridOn);
            if(typeof drawGrid === 'function') drawGrid();
            afterStateChange();
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