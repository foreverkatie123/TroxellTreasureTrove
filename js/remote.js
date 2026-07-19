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

      // ---- Firebase (campaign database — session cloud save/load) ----
      // Config lives in js/firebase-config.js (gitignored) — see js/firebase-config.example.js
      // Loaded with `defer` so a slow/offline connection can't block the TV<->Controller
      // handshake below — Firebase only finishes initializing once the page is fully ready.
      let firebaseConfig = null;
      let fbDb = null;
      let fbUser = null;
      let cloudSaveState = { status:'idle', message:'', at:null }; // surfaced to the controller via buildSnapshot
      function initFirebase(){
        firebaseConfig = window.FIREBASE_CONFIG;
        if(!firebaseConfig){
          console.warn('js/firebase-config.js is missing — copy js/firebase-config.example.js and fill in your project config.');
          return;
        }
        try{
          firebase.initializeApp(firebaseConfig);
          fbDb = firebase.firestore();
          firebase.auth().signInAnonymously().catch(() => {});
          firebase.auth().onAuthStateChanged(user => { fbUser = user; });
        }catch(err){
          console.warn('Firebase init failed on TV side:', err);
        }
      }
      window.addEventListener('DOMContentLoaded', initFirebase);

      function saveSessionToCloud(campaignId){
        if(!fbDb || !fbUser){
          cloudSaveState = { status:'error', message:'Not connected to Firebase yet — try again in a moment.', at:Date.now() };
          syncRemote();
          return;
        }
        let data;
        try{ data = buildSessionData(); }catch(err){
          cloudSaveState = { status:'error', message:'Could not gather session state: ' + err.message, at:Date.now() };
          syncRemote();
          return;
        }
        fbDb.collection('campaigns').doc(campaignId).collection('sessions').doc('current').set({
          savedAt: firebase.firestore.FieldValue.serverTimestamp(),
          savedBy: fbUser.uid,
          data
        }).then(() => {
          cloudSaveState = { status:'ok', message:'Session saved to the cloud.', at:Date.now() };
          syncRemote();
        }).catch(err => {
          cloudSaveState = { status:'error', message:'Cloud save failed: ' + err.message, at:Date.now() };
          syncRemote();
        });
      }

      function loadSessionFromCloud(campaignId){
        if(!fbDb || !fbUser){
          cloudSaveState = { status:'error', message:'Not connected to Firebase yet — try again in a moment.', at:Date.now() };
          syncRemote();
          return;
        }
        fbDb.collection('campaigns').doc(campaignId).collection('sessions').doc('current').get()
          .then(doc => {
            if(!doc.exists){
              cloudSaveState = { status:'error', message:'No cloud save found for this campaign yet.', at:Date.now() };
              syncRemote();
              return;
            }
            const payload = doc.data();
            applySessionData(payload.data || {});
            afterStateChange();
            cloudSaveState = { status:'ok', message:'Session loaded from the cloud.', at:Date.now() };
            syncRemote();
          })
          .catch(err => {
            cloudSaveState = { status:'error', message:'Cloud load failed: ' + err.message, at:Date.now() };
            syncRemote();
          });
      }

      function clampHp(c){
        if(c.maxHp !== null && c.maxHp !== undefined){
          if(c.hp !== null && c.hp > c.maxHp) c.hp = c.maxHp;
        }
        if(c.hp !== null && c.hp < 0) c.hp = 0;
        if(c.tempHp !== null && c.tempHp < 0) c.tempHp = 0;
      }

      function buildSnapshot(){
        const sorted = [...combatants].sort((a,b) => b.init - a.init);
        const idx = sorted.findIndex(c => c.id === activeId);
        return {
          round, combatants: sorted, activeId,
          onDeckId: sorted.length > 1 ? sorted[(idx + 1) % sorted.length].id : null,
          mapLoaded: !!imgW,
          sourceMode,
          fogEnabled, hasMask: !!maskData,
          regionsTotal: regions.size, regionsShown: shown.size,
          mode, feetPerSquare, hudScale,
          combatLog,
          timers,
          cloudSaveState,
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
              delayed: false, ready: false, legendaryMax: 0, legendaryLeft: 0, conditions: [], exhaustion: 0,
              concentrating: false, concentrationSpell: '', concentrationRounds: 0,
              spellSlots: {}, preparedSpells: []
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
              delayed: false, ready: false, legendaryMax: 0, legendaryLeft: 0, conditions: [], exhaustion: 0,
              concentrating: false, concentrationSpell: '', concentrationRounds: 0,
              spellSlots: {}, preparedSpells: []
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
            logEvent('— Combat cleared —');
            render();
            break;
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
            if(c.concentrating && dealt > 0){
              const dc = Math.max(10, Math.floor(dealt / 2));
              logEvent(`⚠️ ${c.name} must make a DC ${dc} Concentration save to maintain ${c.concentrationSpell || 'their spell'}.`);
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
          case 'toggleCondition': {
            const c = findCombatant(payload.id);
            if(!c) break;
            if(!Array.isArray(c.conditions)) c.conditions = [];
            const idx = c.conditions.indexOf(payload.cond);
            if(idx >= 0) c.conditions.splice(idx, 1);
            else c.conditions.push(payload.cond);
            render();
            break;
          }
          case 'setExhaustion': {
            const c = findCombatant(payload.id);
            if(!c) break;
            const v = parseInt(payload.value, 10);
            if(!isNaN(v)) c.exhaustion = Math.max(0, Math.min(6, v));
            render();
            break;
          }
          case 'setCombatantStats': {
            const c = findCombatant(payload.id);
            if(!c) break;
            if(payload.name !== undefined && payload.name !== null){
              const trimmed = String(payload.name).trim();
              if(trimmed) c.name = trimmed;
            }
            if(payload.init !== undefined && payload.init !== null && !isNaN(payload.init)){
              c.init = parseFloat(payload.init);
            }
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
          case 'setHudScale': {
            const v = parseFloat(payload.value);
            if(!isNaN(v)){ hudScale = Math.min(2.5, Math.max(0.6, v)); applyHudScale(); afterStateChange(); }
            break;
          }
          case 'addLogEntry': {
            const text = (payload.text || '').trim();
            if(text) logEvent(text);
            break;
          }
          case 'addTimer': {
            addTimer(payload.type, payload.label, payload.rounds);
            break;
          }
          case 'removeTimer': removeTimer(payload.id); break;
          case 'toggleTimerPause': toggleTimerPause(payload.id); break;
          case 'setConcentration': {
            const c = findCombatant(payload.id);
            if(!c) break;
            const spellName = (payload.spellName || '').trim() || 'a spell';
            const rounds = Math.max(1, parseInt(payload.rounds, 10) || 1);
            c.concentrating = true;
            c.concentrationSpell = spellName;
            c.concentrationRounds = rounds;
            logEvent(`🔮 ${c.name} begins concentrating on ${spellName} (${rounds} rd${rounds === 1 ? '' : 's'})`);
            render();
            break;
          }
          case 'clearConcentration': {
            const c = findCombatant(payload.id);
            if(!c || !c.concentrating) break;
            logEvent(`🔮 ${c.name}'s concentration on ${c.concentrationSpell || 'their spell'} ends.`);
            c.concentrating = false;
            c.concentrationSpell = '';
            c.concentrationRounds = 0;
            render();
            break;
          }
          case 'setSpellSlot': {
            const c = findCombatant(payload.id);
            if(!c) break;
            const level = String(Math.max(1, Math.min(9, parseInt(payload.level, 10) || 1)));
            if(!c.spellSlots) c.spellSlots = {};
            const existing = c.spellSlots[level] || { max:0, used:0 };
            let max = payload.max !== undefined ? Math.max(0, parseInt(payload.max, 10) || 0) : existing.max;
            let used = payload.used !== undefined ? Math.max(0, parseInt(payload.used, 10) || 0) : existing.used;
            used = Math.min(used, max);
            c.spellSlots[level] = { max, used };
            render();
            break;
          }
          case 'addPreparedSpell': {
            const c = findCombatant(payload.id);
            if(!c) break;
            const name = (payload.name || '').trim();
            if(!name) break;
            if(!Array.isArray(c.preparedSpells)) c.preparedSpells = [];
            c.preparedSpells.push({ id: Date.now() + '_' + Math.random().toString(36).slice(2, 7), name, used:false });
            render();
            break;
          }
          case 'togglePreparedSpell': {
            const c = findCombatant(payload.id);
            if(!c || !Array.isArray(c.preparedSpells)) break;
            const spell = c.preparedSpells.find(s => s.id === payload.spellId);
            if(spell) spell.used = !spell.used;
            render();
            break;
          }
          case 'removePreparedSpell': {
            const c = findCombatant(payload.id);
            if(!c || !Array.isArray(c.preparedSpells)) break;
            c.preparedSpells = c.preparedSpells.filter(s => s.id !== payload.spellId);
            render();
            break;
          }
          case 'startCapture': startCapture(); break;
          case 'saveSessionToCloud': saveSessionToCloud(payload.campaignId || 'default'); break;
          case 'loadSessionFromCloud': loadSessionFromCloud(payload.campaignId || 'default'); break;
        }
      }

      function afterStateChange(){
        saveSession();
        syncRemote();
      }