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
          aoe: lastAoe,
          undo: { count: undoStack.length, label: undoStack.length ? undoStack[undoStack.length - 1].label : '' },
          handoutLabels: handoutLabelsOn,
          handouts: handoutList(),   // geometry only — the image itself is never re-broadcast
          combatLog: combatLog.slice(-80), // includes dmOnly lines — the Remote shows everything, the TV filters them
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


      // ---- Damage application (shared by single-target damage and area effects) ----
      // Applies defenses (absorb / immune / resist / vulnerable), then temp HP, then HP, and logs it.
      // Returns { dealt, healed } — `dealt` is the damage actually taken after defenses.
      function applyDamageToCombatant(c, rawAmt, dtype, nameOverride){
        let amt = Math.max(0, rawAmt || 0);
        let note = '';
        let healAmount = 0;
        const nm = nameOverride || c.name;
        if(dtype && typeof applyDamageDefenses === 'function'){
          const result = applyDamageDefenses(c, amt, dtype);
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
        const hpTxt = typeof c.hp === 'number' ? ` (${c.hp}${c.maxHp !== null ? '/' + c.maxHp : ''} HP)` : '';
        if(healAmount > 0){
          const info = typeof damageTypeInfo === 'function' ? damageTypeInfo(dtype) : null;
          logEvent(`🟢 ${nm} absorbs the ${info ? info.label : dtype} damage and heals ${healAmount}${hpTxt}`);
        } else {
          logEvent(`💥 ${nm} takes ${dealt} damage${note}${hpTxt}`);
        }
        return { dealt, healed: healAmount };
      }

      // "8d6", "2d6+1d4+3", "24" → { total, text } (null if it isn't a dice expression)
      function rollDiceExpression(expr){
        const src = String(expr ?? '').replace(/\s+/g, '').toLowerCase();
        if(!src) return null;
        const terms = src.match(/[+-]?(\d*d\d+|\d+)/g);
        if(!terms || terms.join('') !== src) return null;
        let total = 0; const parts = [];
        terms.forEach(t => {
          const sign = t.startsWith('-') ? -1 : 1;
          const body = t.replace(/^[+-]/, '');
          if(body.includes('d')){
            const [n, sides] = body.split('d');
            const count = Math.min(100, parseInt(n || '1', 10) || 1), s = Math.max(1, parseInt(sides, 10) || 1);
            const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * s));
            const sum = rolls.reduce((a, b) => a + b, 0);
            total += sign * sum;
            parts.push(`${sign < 0 ? '-' : ''}${count}d${s}[${rolls.join(',')}]`);
          } else {
            total += sign * parseInt(body, 10);
            parts.push(`${sign < 0 ? '-' : (parts.length ? '+' : '')}${body}`);
          }
        });
        return { total: Math.max(0, total), text: parts.join(' ').replace(/ \+/g, '+') };
      }

      // ---- Area effect: one damage roll, each target rolls its own save ----
      let aoeSeq = 0;
      let lastAoe = null; // { seq, rows:[{id,name,natural,bonus,total,success,dealt}] } — sent to the Remote in the snapshot
      const SAVE_LABELS = { str:'STR', dex:'DEX', con:'CON', int:'INT', wis:'WIS', cha:'CHA' };
      function runAreaDamage(p){
        const dmg = rollDiceExpression(p.amount);
        if(!dmg){ logEvent('⚠️ Area effect: couldn\'t read the damage — use a number or dice like 8d6+2', { dmOnly: true }); return; }
        const targets = (Array.isArray(p.targets) ? p.targets : []).map(t => ({ t, c: findCombatant(t.id) })).filter(x => x.c);
        if(!targets.length) return;
        const dtypeInfo = p.dtype && typeof damageTypeInfo === 'function' ? damageTypeInfo(p.dtype) : null;
        const ab = SAVE_LABELS[p.ability] ? p.ability : null;
        const dc = parseInt(p.dc, 10);
        const hasSave = !!(ab && dc > 0);
        const half = p.onSave !== 'none';
        logEvent(`🌀 ${p.label ? p.label + ': ' : 'Area effect: '}${dmg.total} ${dtypeInfo ? dtypeInfo.label.toLowerCase() + ' ' : ''}damage (${dmg.text})` +
          (hasSave ? ` — DC ${dc} ${SAVE_LABELS[ab]} save, ${half ? 'half' : 'no damage'} on a success` : ' — no save'),
          { dmOnly: targets.every(x => x.c.hidden) });
        const rows = [];
        const resolveOne = (c, name, t) => {
          let success = false, natural = null, bonus = parseInt(t.bonus, 10) || 0, total = null, rollTxt = '';
          if(hasSave){
            const manual = (t.roll !== undefined && t.roll !== null && t.roll !== '' && !isNaN(parseFloat(t.roll))) ? parseFloat(t.roll) : null;
            if(manual !== null){ natural = manual; rollTxt = `${natural} (rolled at the table)`; }
            else {
              const a = 1 + Math.floor(Math.random() * 20), b = 1 + Math.floor(Math.random() * 20);
              if(p.adv === 'adv'){ natural = Math.max(a, b); rollTxt = `${natural} (adv: ${a}, ${b})`; }
              else if(p.adv === 'dis'){ natural = Math.min(a, b); rollTxt = `${natural} (dis: ${a}, ${b})`; }
              else { natural = a; rollTxt = String(a); }
            }
            total = natural + bonus;
            success = total >= dc;
          }
          const amt = (hasSave && success) ? (half ? Math.floor(dmg.total / 2) : 0) : dmg.total;
          logSecret = !!c.hidden;
          if(hasSave) logEvent(`🎲 ${name} ${SAVE_LABELS[ab]} save: ${rollTxt}${bonus ? (bonus > 0 ? '+' : '') + bonus : ''} = ${total} vs DC ${dc} — ${success ? 'success' : 'fails'}`);
          let dealt = 0;
          if(amt > 0) dealt = applyDamageToCombatant(c, amt, p.dtype, name).dealt;
          else logEvent(`🛡 ${name} takes no damage`);
          logSecret = false;
          rows.push({ id: c.id, name, natural, bonus, total, success, dealt });
        };
        targets.forEach(({ t, c }) => {
          if(c.group){
            // Swarm: every standing member makes its own save
            const orig = c.group.sel;
            c.group.members.forEach((m, i) => {
              if(typeof m.hp === 'number' && m.hp <= 0) return;
              selectGroupMember(c, i);
              resolveOne(c, c.group.members[i].name, t);
            });
            selectGroupMember(c, orig);
          } else resolveOne(c, c.name, t);
        });
        lastAoe = { seq: ++aoeSeq, rows };
        render();
      }

      // ---- Undo: one tap reverts the last HP / condition change (mis-taps mid-fight) ----
      // Before each of these commands we copy the HP-ish fields of the creatures it can touch.
      const UNDO_ACTIONS = { applyDamage:'damage', applyHeal:'healing', setCombatantStats:'stat edit', toggleCondition:'condition change', setExhaustion:'exhaustion change', areaDamage:'area damage' };
      const undoStack = [];
      function undoSnap(c){
        return { hp: c.hp, maxHp: c.maxHp, tempHp: c.tempHp || 0, ac: c.ac, exhaustion: c.exhaustion || 0,
          conditions: (c.conditions || []).slice(), group: c.group ? JSON.parse(JSON.stringify(c.group)) : null };
      }
      function pushUndo(action, payload){
        if(!UNDO_ACTIONS[action]) return;
        if(typeof syncAllGroups === 'function') syncAllGroups();   // swarm: write the selected member back first
        const ids = action === 'areaDamage' ? (Array.isArray(payload && payload.targets) ? payload.targets.map(t => t.id) : []) : [payload && payload.id];
        const list = combatants.filter(x => ids.includes(x.id));
        if(!list.length) return;
        const who = list.length === 1 ? list[0].name : 'several creatures';
        undoStack.push({ label: `${UNDO_ACTIONS[action]} on ${who}`, snaps: list.map(c => ({ id: c.id, s: undoSnap(c) })) });
        if(undoStack.length > 25) undoStack.shift();
      }
      function undoLast(){
        const u = undoStack.pop();
        if(!u) return;
        let secret = false;
        u.snaps.forEach(({ id, s }) => {
          const c = combatants.find(x => x.id === id);
          if(!c) return;                                   // removed since — nothing to restore
          if(c.hidden) secret = true;
          c.hp = s.hp; c.maxHp = s.maxHp; c.tempHp = s.tempHp; c.ac = s.ac; c.exhaustion = s.exhaustion;
          c.conditions = s.conditions.slice();
          c.group = s.group ? JSON.parse(JSON.stringify(s.group)) : c.group;
          if(c.group && typeof selectGroupMember === 'function') selectGroupMember(c, c.group.sel);   // re-mirror the selected member
        });
        logEvent(`↩ Undid ${u.label}`, { dmOnly: secret });
        render();
      }

      // Commands aimed at a hidden combatant log as DM-only (see combat-log.js)
      function handleRemoteCommand(action, payload){
        if(action === 'undo'){ undoLast(); return; }
        pushUndo(action, payload);
        const target = (payload && payload.id !== undefined && typeof payload.id === 'number') ? combatants.find(x => x.id === payload.id) : null;
        logSecret = !!(target && target.hidden && action !== 'setHidden');
        try{ return handleRemoteCommandInner(action, payload); }
        finally{ logSecret = false; }
      }
      function handleRemoteCommandInner(action, payload){
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
            c.hidden = !!payload.hidden; // added as an ambusher: in the tracker, not on the TV
            c.uses = (typeof sanitizeUses === 'function') ? sanitizeUses(payload.uses) : [];
            if(parseInt(payload.groupSize) >= 2 && typeof makeGroup === 'function'){
              // Swarm: one initiative slot, N members each with their own HP
              c.group = makeGroup(c.name, payload.groupSize, c.hp);
            }
            combatants.push(c);
            if(!combatStarted) refreshPreStartActive();
            else if(activeId === null) activeId = c.id;
            logEvent(c.group ? `${c.name} ×${c.group.members.length} join initiative as a group (${c.init})` : `${c.name} joins initiative (${c.init})`, { dmOnly: c.hidden });
            render();
            break;
          }
          case 'addUse': {
            const c = findCombatant(payload.id);
            if(!c || !payload.name) break;
            if(!Array.isArray(c.uses)) c.uses = [];
            if(c.uses.length >= 12) break;
            c.uses = sanitizeUses(c.uses.concat([{ name: payload.name, kind: payload.kind, max: payload.max, left: payload.max, rechargeMin: payload.rechargeMin, ready: true }]));
            render();
            break;
          }
          case 'removeUse': {
            const c = findCombatant(payload.id);
            if(!c || !Array.isArray(c.uses)) break;
            c.uses = c.uses.filter(u => u.id !== payload.useId);
            render();
            break;
          }
          case 'spendUse': {
            const c = findCombatant(payload.id);
            const u = c && Array.isArray(c.uses) ? c.uses.find(x => x.id === payload.useId) : null;
            if(!u) break;
            if(u.kind === 'recharge'){ if(!u.ready) break; u.ready = false; logEvent(`🔥 ${c.name} uses ${u.name} (spent until it recharges)`); }
            else { if(u.left <= 0) break; u.left--; logEvent(`🔥 ${c.name} uses ${u.name} (${u.left}/${u.max} left)`); }
            render();
            break;
          }
          case 'resetUse': {
            const c = findCombatant(payload.id);
            const u = c && Array.isArray(c.uses) ? c.uses.find(x => x.id === payload.useId) : null;
            if(!u) break;
            if(u.kind === 'recharge') u.ready = true; else u.left = u.max;
            logEvent(`↺ ${c.name}: ${u.name} restored`);
            render();
            break;
          }
          case 'rollRecharge': {
            const c = findCombatant(payload.id);
            const u = c && Array.isArray(c.uses) ? c.uses.find(x => x.id === payload.useId) : null;
            if(!u || u.kind !== 'recharge' || u.ready) break;
            rollRecharge(c, u, false);
            render();
            break;
          }
          case 'showHandout': {
            showHandout(payload || {});
            break;
          }
          case 'hideHandout': {
            hideHandout(payload && payload.uid);
            break;
          }
          case 'setHandoutLabels': { setHandoutLabels(payload && payload.on); break; }
          case 'updateHandout': {
            updateHandout(payload || {});
            break;
          }
          case 'setHidden': {
            const c = findCombatant(payload.id);
            if(!c) break;
            const was = !!c.hidden;
            c.hidden = !!payload.value;
            if(was && !c.hidden) logEvent(`👁 ${c.name} is revealed!`);          // public
            else if(!was && c.hidden) logEvent(`🕶 ${c.name} is hidden from the TV`, { dmOnly: true });
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
            c.hidden = !!payload.hidden; // added as an ambusher: in the tracker, not on the TV
            c.uses = (typeof sanitizeUses === 'function') ? sanitizeUses(payload.uses) : [];
            if(parseInt(payload.groupSize) >= 2 && typeof makeGroup === 'function'){
              c.group = makeGroup(c.name, payload.groupSize, c.hp); // swarm of a roster creature
            }
            combatants.push(c);
            if(!combatStarted) refreshPreStartActive();
            else if(activeId === null) activeId = c.id;
            logEvent(c.group ? `${c.name} ×${c.group.members.length} join initiative as a group (${c.init})` : `${c.name} joins initiative (${c.init})`, { dmOnly: c.hidden });
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
            combatStarted = false; condPickerOpenFor = null; undoStack.length = 0;
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
            applyDamageToCombatant(c, parseFloat(payload.amount) || 0, payload.dtype);
            render();
            break;
          }
          case 'areaDamage': { runAreaDamage(payload); break; }
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

// ---- Handouts: push letters / map fragments to the TV; several copies at once, each with its own
// rotation, size and position (so every side of the table can read one). Not saved in the session. ----
let handoutLabelsOn = false;       // show each copy's name tag on the TV (handy while arranging)
const handoutItems = new Map();   // uid -> { uid, place, title, text, image, seconds, rot, scale, x, y, timer, el }
// Where each "place" lands (x,y = centre of the card, in % of the screen) and which way the text faces:
// the text's top points toward the middle of the table, so people sitting on that side read it upright.
const HANDOUT_PLACES = {
  center: { x: 50, y: 50, rot: 0,   scale: 1 },
  bottom: { x: 50, y: 76, rot: 0,   scale: 0.5 },
  left:   { x: 22, y: 50, rot: 90,  scale: 0.5 },
  top:    { x: 50, y: 24, rot: 180, scale: 0.5 },
  right:  { x: 78, y: 50, rot: 270, scale: 0.5 }
};
function handoutClamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
function handoutList(){
  return Array.from(handoutItems.values()).map(h => ({ uid: h.uid, label: h.label, place: h.place, title: h.title, hasImage: !!h.image, rot: h.rot, scale: h.scale, x: h.x, y: h.y }));
}
function layoutHandout(h){
  if(!h.el) return;
  h.el.style.left = h.x + '%';
  h.el.style.top = h.y + '%';
  h.el.style.transform = `translate(-50%,-50%) rotate(${h.rot}deg) scale(${h.scale})`;
}
function removeHandout(uid){
  const h = handoutItems.get(uid);
  if(!h) return;
  if(h.timer) clearTimeout(h.timer);
  if(h.el) h.el.remove();
  handoutItems.delete(uid);
  const layer = document.getElementById('handoutLayer');
  if(layer && !handoutItems.size) layer.classList.remove('show');
}
function hideHandout(uid){
  if(uid){ removeHandout(uid); return; }
  Array.from(handoutItems.keys()).forEach(removeHandout);   // no uid = clear everything
}
function showHandout(p){
  const layer = document.getElementById('handoutLayer');
  if(!layer) return;
  const src = p.copyOf ? handoutItems.get(String(p.copyOf)) : null;     // clone content already on the TV (no re-sending the image)
  const title = String(src ? src.title : (p.title || '')).slice(0, 120);
  const text = String(src ? src.text : (p.text || '')).slice(0, 4000);
  const rawImg = src ? src.image : p.image;
  const image = (typeof rawImg === 'string' && /^data:image\/(jpeg|png|webp|gif);base64,/.test(rawImg)) ? rawImg : '';
  if(!title && !text && !image) return;

  const name = String(src ? src.name : (p.name || p.title || '')).slice(0, 60) || 'Handout';
  const place = HANDOUT_PLACES[p.place] ? p.place : (p.place === 'free' ? 'free' : 'center');
  const base = HANDOUT_PLACES[place] || HANDOUT_PLACES.center;
  // Showing to a place that is already occupied replaces that copy instead of stacking duplicates
  let uid = (typeof p.uid === 'string' && /^[\w-]{1,40}$/.test(p.uid)) ? p.uid : '';
  if(place !== 'free'){
    handoutItems.forEach(h => { if(h.place === place && h.uid !== uid) removeHandout(h.uid); });
  }
  if(!uid) uid = 'h' + Date.now().toString(36) + Math.floor(Math.random() * 1000);
  if(handoutItems.has(uid)) removeHandout(uid);
  if(handoutItems.size >= 8) removeHandout(handoutItems.keys().next().value);

  // Name tag for this copy: the name you gave it + where it sits, e.g. "Letter – Left" ("Letter (copy)" once moved by hand)
  const PLACE_WORD = { center: '', bottom: ' – Bottom', left: ' – Left', top: ' – Top', right: ' – Right', free: ' (copy)' };
  const label = String(p.label || (name + (PLACE_WORD[place] || ''))).slice(0, 80);
  const h = {
    uid, place, title, text, image, name, label,
    rot: ((((typeof p.rot === 'number' ? p.rot : base.rot) % 360) + 360) % 360),
    scale: handoutClamp(typeof p.scale === 'number' ? p.scale : base.scale, 0.15, 3),
    x: handoutClamp(typeof p.x === 'number' ? p.x : base.x, 0, 100),
    y: handoutClamp(typeof p.y === 'number' ? p.y : base.y, 0, 100),
    timer: null, el: null
  };
  const el = document.createElement('div');
  el.className = 'hoCard' + (image ? ' hasImg' : '') + (!title && !text ? ' noText' : '');
  const tag = document.createElement('div'); tag.className = 'hoTag'; tag.textContent = label; el.appendChild(tag);
  const t = document.createElement('div'); t.className = 'hoTitle'; t.textContent = title; el.appendChild(t);
  if(image){ const im = document.createElement('img'); im.className = 'hoImg'; im.alt = ''; im.src = image; el.appendChild(im); }
  const tx = document.createElement('div'); tx.className = 'hoText'; tx.textContent = text; el.appendChild(tx);
  h.el = el;
  // Direct manipulation on the TV (works while "Enable Overlay Interaction" is on):
  // drag = move, mouse wheel = resize, double-click = rotate 90°. Touch drag works too.
  let drag = null;
  el.addEventListener('pointerdown', e => {
    if(!document.body.classList.contains('overlayInteractive')) return;
    const r = layer.getBoundingClientRect();
    drag = { offX: e.clientX - (h.x / 100) * r.width, offY: e.clientY - (h.y / 100) * r.height, r };
    try{ el.setPointerCapture(e.pointerId); }catch(err){}
    el.classList.add('dragging');
    e.preventDefault();
  });
  el.addEventListener('pointermove', e => {
    if(!drag) return;
    h.x = handoutClamp(((e.clientX - drag.offX) / drag.r.width) * 100, 0, 100);
    h.y = handoutClamp(((e.clientY - drag.offY) / drag.r.height) * 100, 0, 100);
    h.place = 'free';
    layoutHandout(h);
  });
  const endDrag = () => { if(!drag) return; drag = null; el.classList.remove('dragging'); if(typeof syncRemote === 'function') syncRemote(); };
  el.addEventListener('pointerup', endDrag);
  el.addEventListener('pointercancel', endDrag);
  el.addEventListener('wheel', e => {
    if(!document.body.classList.contains('overlayInteractive')) return;
    e.preventDefault();
    h.scale = handoutClamp(h.scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1), 0.15, 3);
    h.place = 'free';
    layoutHandout(h);
    if(typeof syncRemote === 'function') syncRemote();
  }, { passive: false });
  el.addEventListener('dblclick', () => {
    if(!document.body.classList.contains('overlayInteractive')) return;
    h.rot = (h.rot + 90) % 360; h.place = 'free';
    layoutHandout(h);
    if(typeof syncRemote === 'function') syncRemote();
  });
  layer.appendChild(el);
  layoutHandout(h);
  handoutItems.set(uid, h);
  layer.classList.add('show');
  const secs = parseInt(p.seconds, 10);
  if(secs > 0) h.timer = setTimeout(() => removeHandout(uid), Math.min(secs, 3600) * 1000);
}
// Rotate / resize / move one copy. Absolute (rot, scale, x, y) or relative (rotBy, scaleBy multiplier, dx, dy).
function updateHandout(p){
  const h = handoutItems.get(String(p.uid));
  if(!h) return;
  if(typeof p.label === 'string'){
    h.label = p.label.slice(0, 80) || h.name;
    const tg = h.el && h.el.querySelector('.hoTag'); if(tg) tg.textContent = h.label;
  }
  if(typeof p.rot === 'number') h.rot = p.rot;
  if(typeof p.rotBy === 'number') h.rot += p.rotBy;
  h.rot = ((h.rot % 360) + 360) % 360;
  if(typeof p.scale === 'number') h.scale = p.scale;
  if(typeof p.scaleBy === 'number') h.scale *= p.scaleBy;
  h.scale = handoutClamp(h.scale, 0.15, 3);
  if(typeof p.x === 'number') h.x = p.x;
  if(typeof p.y === 'number') h.y = p.y;
  if(typeof p.dx === 'number') h.x += p.dx;
  if(typeof p.dy === 'number') h.y += p.dy;
  h.x = handoutClamp(h.x, 0, 100); h.y = handoutClamp(h.y, 0, 100);
  if(typeof p.label !== 'string' || p.rot !== undefined || p.rotBy !== undefined || p.x !== undefined || p.dx !== undefined || p.scale !== undefined || p.scaleBy !== undefined) h.place = 'free';   // moved by hand — no longer owns a place slot
  layoutHandout(h);
}
function setHandoutLabels(on){
  handoutLabelsOn = !!on;
  const layer = document.getElementById('handoutLayer');
  if(layer) layer.classList.toggle('labels', handoutLabelsOn);
}