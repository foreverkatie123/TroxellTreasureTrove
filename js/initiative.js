// ---------------- Conditions ----------------
      const CONDITIONS = [
        { id:'blinded', label:'Blinded', icon:'🙈' },
        { id:'charmed', label:'Charmed', icon:'💞' },
        { id:'concentrating', label:'Concentrating', icon:'🔮' },
        { id:'deafened', label:'Deafened', icon:'🔇' },
        { id:'frightened', label:'Frightened', icon:'😱' },
        { id:'grappled', label:'Grappled', icon:'🤝' },
        { id:'incapacitated', label:'Incapacitated', icon:'💫' },
        { id:'invisible', label:'Invisible', icon:'👻' },
        { id:'paralyzed', label:'Paralyzed', icon:'🧊' },
        { id:'petrified', label:'Petrified', icon:'🗿' },
        { id:'poisoned', label:'Poisoned', icon:'☠️' },
        { id:'prone', label:'Prone', icon:'⬇️' },
        { id:'restrained', label:'Restrained', icon:'🕸️' },
        { id:'stunned', label:'Stunned', icon:'🌀' },
        { id:'unconscious', label:'Unconscious', icon:'😵' }
      ];
      function conditionInfo(id){ return CONDITIONS.find(c => c.id === id); }
      let condPickerOpenFor = null; // combatant id whose condition picker is currently expanded

      // ---------------- Initiative / Combatants ----------------
      // Combatant shape: { id, name, init, notes, hp, maxHp, tempHp, ac, rosterId,
      //                     delayed, ready, legendaryMax, legendaryLeft }
      // hp/maxHp/ac are null until set via the roster or DM Remote quick controls.
      let combatants = [];
      let activeId = null;      // combatant id (number) or 'LAIR'
      let round = 1;
      let nextId = 1;
      let autoSort = true;
      let manualOrder = [];     // used when autoSort is false: [{type:'c',id}|{type:'lair'}]
      let lairAction = { enabled:false, initCount:20, triggered:false };
      let combatStarted = false; // becomes true once Next/Prev Turn is used; until then, the
                                  // active seat auto-tracks the highest initiative (or manual order's top)

      const listEl = document.getElementById('combatantList');
      const roundNumEl = document.getElementById('roundNum');
      const autoSortToggleEl = document.getElementById('autoSortToggle');
      const lairToggleEl = document.getElementById('lairToggle');
      const lairConfigRowEl = document.getElementById('lairConfigRow');
      const lairInitCountEl = document.getElementById('lairInitCount');

      // ---- Turn order engine ----
      function syncManualOrder(){
        const validIds = new Set(combatants.map(c => c.id));
        manualOrder = manualOrder.filter(e => e.type === 'lair' ? lairAction.enabled : validIds.has(e.id));
        combatants.forEach(c => {
          if(!manualOrder.some(e => e.type === 'c' && e.id === c.id)) manualOrder.push({ type:'c', id:c.id });
        });
        if(lairAction.enabled && !manualOrder.some(e => e.type === 'lair')) manualOrder.push({ type:'lair' });
      }

      function turnOrder(){
        if(autoSort){
          const list = combatants.map(c => ({ type:'c', id:c.id, init:c.init }));
          if(lairAction.enabled) list.push({ type:'lair', id:'LAIR', init:lairAction.initCount });
          list.sort((a, b) => {
            if(a.init !== b.init) return b.init - a.init;
            if(a.type === 'lair' && b.type !== 'lair') return 1;   // lair loses ties
            if(b.type === 'lair' && a.type !== 'lair') return -1;
            return 0;
          });
          return list;
        }
        syncManualOrder();
        return manualOrder.slice();
      }

      function resolveEntry(e){
        if(e.type === 'lair') return { type:'lair', id:'LAIR', name:'Lair Action', init: lairAction.initCount };
        const c = combatants.find(x => x.id === e.id);
        return c ? Object.assign({ type:'c' }, c) : null;
      }

      function idsInOrder(){
        return turnOrder().map(e => e.type === 'lair' ? 'LAIR' : e.id);
      }

      function refreshPreStartActive(){
        if(combatStarted) return;
        const ids = idsInOrder();
        activeId = ids.length ? ids[0] : null;
      }

      function onRoundStart(){
        combatants.forEach(c => { if(c.legendaryMax > 0) c.legendaryLeft = c.legendaryMax; });
        lairAction.triggered = false;
        advanceTimers();
        advanceConcentration();
      }

      function advanceConcentration(){
        combatants.forEach(c => {
          if(!c.concentrating) return;
          c.concentrationRounds = Math.max(0, (c.concentrationRounds || 0) - 1);
          if(c.concentrationRounds <= 0){
            logEvent(`🔮 ${c.name}'s concentration on ${c.concentrationSpell || 'their spell'} ends.`);
            c.concentrating = false;
            c.concentrationSpell = '';
          }
        });
      }

      let hudScale = 1; // 1 = 100%; adjustable from the DM Remote's Settings panel
      function applyHudScale(){
        document.getElementById('hud').style.setProperty('--hud-scale', hudScale);
      }
      applyHudScale();

      function updateHud(order){
        const hud = document.getElementById('hud');
        if(!order.length){ hud.classList.add('hidden'); return; }
        hud.classList.remove('hidden');
        const idx = order.findIndex(e => (e.type === 'lair' ? 'LAIR' : e.id) === activeId);
        const active = idx >= 0 ? order[idx] : order[0];
        const onDeck = order.length > 1 ? order[(Math.max(idx, 0) + 1) % order.length] : null;
        document.getElementById('hudRoundNum').textContent = round;
        document.getElementById('hudActive').textContent = active ? active.name : '-';
        document.getElementById('hudOnDeckName').textContent = onDeck ? onDeck.name : '-';
      }

      function render(){
        const order = turnOrder().map(resolveEntry).filter(Boolean);
        listEl.innerHTML = '';
        order.forEach(entry => listEl.appendChild(entry.type === 'lair' ? buildLairCard(entry) : buildCombatantCard(entry)));
        wireCardEvents();
        roundNumEl.textContent = round;
        updateHud(order);
        afterStateChange();
      }

      function escapeHtml(s){
        const d = document.createElement('div'); d.textContent = s; return d.innerHTML;
      }

      function buildCombatantCard(c){
        const card = document.createElement('div');
        card.className = 'card' + (c.id === activeId ? ' active' : '');
        card.dataset.key = 'c:' + c.id;
        let statusHtml = '';
        if(c.hp !== null && c.hp !== undefined){
          if(c.hp <= 0) statusHtml = '<span class="downIcon" title="Down">💀</span>';
          else if(c.maxHp && c.hp <= c.maxHp / 2) statusHtml = '<span class="statusDot bloodied" title="Bloodied"></span>';
        }
        const delayedBadge = c.delayed ? '<span class="statusBadge delayedBadge">Delaying</span>' : '';
        const readyBadge = c.ready ? '<span class="statusBadge readyBadge">Ready</span>' : '';
        const legendaryMax = c.legendaryMax || 0;
        const legendaryLeft = c.legendaryLeft || 0;
        const pips = legendaryMax > 0
          ? `<div class="laPips" title="${legendaryLeft} of ${legendaryMax} legendary actions left">${
              Array.from({length: legendaryMax}, (_, i) => `<span class="laPip${i < legendaryLeft ? ' filled' : ''}"></span>`).join('')
            }</div>
             <button class="laMiniBtn" data-action="spend" data-id="${c.id}" title="Spend a legendary action">−</button>
             <button class="laMiniBtn" data-action="reset" data-id="${c.id}" title="Reset to full">↺</button>`
          : '';

        const conditions = c.conditions || [];
        const exhaustion = c.exhaustion || 0;
        const chips = [
          ...conditions.map(id => {
            const info = conditionInfo(id);
            if(!info) return '';
            return `<span class="condChip" data-action="removeCond" data-id="${c.id}" data-cond="${id}" title="Click to remove"><span class="icon">${info.icon}</span>${info.label}</span>`;
          }),
          exhaustion > 0
            ? `<span class="condChip" data-action="removeCond" data-id="${c.id}" data-cond="exhaustion" title="Click to clear"><span class="icon">⚠️</span>Exhaustion ${exhaustion}</span>`
            : ''
        ].filter(Boolean).join('');
        const chipsHtml = chips ? `<div class="condChips">${chips}</div>` : '';

        const concHtml = c.concentrating
          ? `<div class="concBadge">🔮 Concentrating: ${escapeHtml(c.concentrationSpell || 'spell')} — ${c.concentrationRounds} rd${c.concentrationRounds === 1 ? '' : 's'}</div>`
          : '';

        const pickerOpen = condPickerOpenFor === c.id;
        const pickerHtml = pickerOpen ? `
          <div class="condPicker">
            ${CONDITIONS.map(cond => `
              <div class="condPickerItem${conditions.includes(cond.id) ? ' active' : ''}" data-action="toggleCond" data-id="${c.id}" data-cond="${cond.id}">
                <span class="icon">${cond.icon}</span><span>${cond.label}</span>
              </div>
            `).join('')}
            <div class="exhaustionRow">
              <span>⚠️ Exhaustion</span>
              <div class="exhaustionStepper">
                <button data-action="exhMinus" data-id="${c.id}">−</button>
                <span class="lvl">${exhaustion}</span>
                <button data-action="exhPlus" data-id="${c.id}">+</button>
              </div>
            </div>
          </div>
        ` : '';

        card.innerHTML = `
          <div class="cardMain">
            <span class="cardDrag" title="Drag to reorder">⠿</span>
            <div class="initNum">${c.init}</div>
            <div style="flex:1;min-width:0;">
              <div class="name">${escapeHtml(c.name)}${statusHtml}${delayedBadge}${readyBadge}</div>
            </div>
            <button class="removeBtn" data-id="${c.id}">✕</button>
          </div>
          ${c.notes ? `<div class="notesLine">${escapeHtml(c.notes)}</div>` : ''}
          ${chipsHtml}
          ${concHtml}
          <div class="cardToolbar">
            <button class="toolBtn delayBtn${c.delayed ? ' active' : ''}" data-action="delay" data-id="${c.id}">⏸ Delay</button>
            <button class="toolBtn readyBtn${c.ready ? ' active' : ''}" data-action="ready" data-id="${c.id}">⚡ Ready</button>
            <button class="toolBtn${pickerOpen ? ' active' : ''}" data-action="toggleCondPicker" data-id="${c.id}">🩹 Condition</button>
            <div class="laBox">
              <label>LA</label>
              <input type="number" class="laMaxInput" min="0" max="9" value="${legendaryMax}" data-id="${c.id}" title="Legendary actions per round (0 = none)">
              ${pips}
            </div>
          </div>
          ${pickerHtml}
        `;
        return card;
      }

      function buildLairCard(entry){
        const card = document.createElement('div');
        card.className = 'card lairCard' + (activeId === 'LAIR' ? ' active' : '');
        card.dataset.key = 'lair:LAIR';
        card.innerHTML = `
          <div class="cardMain">
            <span class="cardDrag" title="Drag to reorder">⠿</span>
            <span class="lairTitle">🏛 Lair Action</span>
            <span class="lairInitTag">init ${entry.init}</span>
          </div>
          <div class="cardToolbar">
            <button class="toolBtn readyBtn${lairAction.triggered ? ' active' : ''}" data-action="lairTrigger">
              ${lairAction.triggered ? '✓ Used this round' : 'Mark Used'}
            </button>
          </div>
        `;
        return card;
      }

      function wireCardEvents(){
        listEl.querySelectorAll('.removeBtn').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id);
            const removed = combatants.find(c => c.id === id);
            combatants = combatants.filter(c => c.id !== id);
            if(condPickerOpenFor === id) condPickerOpenFor = null;
            if(activeId === id){
              const ids = idsInOrder();
              activeId = ids.length ? ids[0] : null;
            }
            if(removed) logEvent(`${removed.name} removed from combat`);
            render();
          });
        });
        listEl.querySelectorAll('[data-action="delay"]').forEach(btn => {
          btn.addEventListener('click', () => {
            const c = combatants.find(x => x.id === parseInt(btn.dataset.id));
            if(!c) return;
            c.delayed = !c.delayed;
            if(c.delayed) c.ready = false;
            logEvent(c.delayed ? `⏸ ${c.name} delays their turn` : `▶ ${c.name} is no longer delaying`);
            render();
          });
        });
        listEl.querySelectorAll('[data-action="ready"]').forEach(btn => {
          btn.addEventListener('click', () => {
            const c = combatants.find(x => x.id === parseInt(btn.dataset.id));
            if(!c) return;
            c.ready = !c.ready;
            if(c.ready) c.delayed = false;
            logEvent(c.ready ? `⚡ ${c.name} readies an action` : `${c.name}'s readied action resolves`);
            render();
          });
        });
        listEl.querySelectorAll('[data-action="lairTrigger"]').forEach(btn => {
          btn.addEventListener('click', () => {
            lairAction.triggered = !lairAction.triggered;
            logEvent(lairAction.triggered ? '🏛 Lair Action used' : '🏛 Lair Action reset');
            render();
          });
        });
        listEl.querySelectorAll('[data-action="spend"]').forEach(btn => {
          btn.addEventListener('click', () => {
            const c = combatants.find(x => x.id === parseInt(btn.dataset.id));
            if(!c) return;
            c.legendaryLeft = Math.max(0, (c.legendaryLeft || 0) - 1);
            logEvent(`👑 ${c.name} spends a legendary action (${c.legendaryLeft} left)`);
            render();
          });
        });
        listEl.querySelectorAll('[data-action="reset"]').forEach(btn => {
          btn.addEventListener('click', () => {
            const c = combatants.find(x => x.id === parseInt(btn.dataset.id));
            if(!c) return;
            c.legendaryLeft = c.legendaryMax || 0;
            logEvent(`👑 ${c.name}'s legendary actions reset`);
            render();
          });
        });
        listEl.querySelectorAll('.laMaxInput').forEach(input => {
          input.addEventListener('change', () => {
            const c = combatants.find(x => x.id === parseInt(input.dataset.id));
            if(!c) return;
            const v = Math.max(0, Math.min(9, parseInt(input.value) || 0));
            c.legendaryMax = v;
            c.legendaryLeft = v;
            render();
          });
        });
        listEl.querySelectorAll('[data-action="toggleCondPicker"]').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id);
            condPickerOpenFor = condPickerOpenFor === id ? null : id;
            render();
          });
        });
        listEl.querySelectorAll('[data-action="toggleCond"]').forEach(item => {
          item.addEventListener('click', () => {
            const c = combatants.find(x => x.id === parseInt(item.dataset.id));
            if(!c) return;
            if(!c.conditions) c.conditions = [];
            const cond = item.dataset.cond;
            const info = conditionInfo(cond);
            const idx = c.conditions.indexOf(cond);
            if(idx >= 0){ c.conditions.splice(idx, 1); logEvent(`${c.name} is no longer ${info ? info.label : cond}`); }
            else { c.conditions.push(cond); logEvent(`${info ? info.icon + ' ' : ''}${c.name} is now ${info ? info.label : cond}`); }
            render();
          });
        });
        listEl.querySelectorAll('[data-action="removeCond"]').forEach(chip => {
          chip.addEventListener('click', () => {
            const c = combatants.find(x => x.id === parseInt(chip.dataset.id));
            if(!c) return;
            const cond = chip.dataset.cond;
            if(cond === 'exhaustion'){ c.exhaustion = 0; logEvent(`⚠️ ${c.name}'s exhaustion cleared`); }
            else if(c.conditions){
              c.conditions = c.conditions.filter(x => x !== cond);
              const info = conditionInfo(cond);
              logEvent(`${c.name} is no longer ${info ? info.label : cond}`);
            }
            render();
          });
        });
        listEl.querySelectorAll('[data-action="exhMinus"]').forEach(btn => {
          btn.addEventListener('click', () => {
            const c = combatants.find(x => x.id === parseInt(btn.dataset.id));
            if(!c) return;
            c.exhaustion = Math.max(0, (c.exhaustion || 0) - 1);
            logEvent(`⚠️ ${c.name} exhaustion → ${c.exhaustion}`);
            render();
          });
        });
        listEl.querySelectorAll('[data-action="exhPlus"]').forEach(btn => {
          btn.addEventListener('click', () => {
            const c = combatants.find(x => x.id === parseInt(btn.dataset.id));
            if(!c) return;
            c.exhaustion = Math.min(6, (c.exhaustion || 0) + 1);
            logEvent(`⚠️ ${c.name} exhaustion → ${c.exhaustion}`);
            render();
          });
        });
        listEl.querySelectorAll('.cardDrag').forEach(handle => attachCardDrag(handle));
      }

      // ---- Drag to reorder ----
      function attachCardDrag(handleEl){
        let dragging = false;
        function getCard(){ return handleEl.closest('.card'); }
        function start(clientY){
          const card = getCard(); if(!card) return;
          dragging = true;
          card.classList.add('draggingCard');
        }
        function move(clientY){
          if(!dragging) return;
          const draggingCard = listEl.querySelector('.draggingCard');
          if(!draggingCard) return;
          const cards = [...listEl.querySelectorAll('.card')];
          let target = null;
          for(const c of cards){
            if(c === draggingCard) continue;
            const rect = c.getBoundingClientRect();
            if(clientY < rect.top + rect.height / 2){ target = c; break; }
          }
          if(target) listEl.insertBefore(draggingCard, target);
          else listEl.appendChild(draggingCard);
        }
        function end(){
          if(!dragging) return;
          dragging = false;
          const draggingCard = listEl.querySelector('.draggingCard');
          if(draggingCard) draggingCard.classList.remove('draggingCard');
          const keys = [...listEl.querySelectorAll('.card')].map(c => c.dataset.key);
          manualOrder = keys.map(k => {
            const [type, id] = k.split(':');
            return type === 'lair' ? { type:'lair' } : { type:'c', id: parseInt(id) };
          });
          if(autoSort){
            autoSort = false;
            autoSortToggleEl.classList.remove('on');
          }
          refreshPreStartActive();
          render();
        }
        handleEl.addEventListener('mousedown', e => {
          e.preventDefault();
          start(e.clientY);
          const mm = ev => move(ev.clientY);
          const mu = () => { end(); window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); };
          window.addEventListener('mousemove', mm);
          window.addEventListener('mouseup', mu);
        });
        handleEl.addEventListener('touchstart', e => {
          const t = e.touches[0]; if(!t) return;
          e.preventDefault(); start(t.clientY);
          const tm = ev => { const tt = ev.touches[0]; if(tt){ ev.preventDefault(); move(tt.clientY); } };
          const te = () => {
            end();
            window.removeEventListener('touchmove', tm);
            window.removeEventListener('touchend', te);
            window.removeEventListener('touchcancel', te);
          };
          window.addEventListener('touchmove', tm, { passive:false });
          window.addEventListener('touchend', te);
          window.addEventListener('touchcancel', te);
        }, { passive:false });
      }

      // ---- Auto-sort / Lair Action config UI ----
      autoSortToggleEl.addEventListener('click', () => {
        if(autoSort){
          manualOrder = turnOrder(); // snapshot current auto order before disabling
          autoSort = false;
        } else {
          autoSort = true;
        }
        autoSortToggleEl.classList.toggle('on', autoSort);
        refreshPreStartActive();
        render();
      });

      lairToggleEl.addEventListener('click', () => {
        lairAction.enabled = !lairAction.enabled;
        lairToggleEl.classList.toggle('on', lairAction.enabled);
        lairConfigRowEl.style.display = lairAction.enabled ? '' : 'none';
        if(!lairAction.enabled && activeId === 'LAIR'){
          const ids = idsInOrder();
          activeId = ids.length ? ids[0] : null;
        }
        refreshPreStartActive();
        render();
      });

      lairInitCountEl.addEventListener('change', () => {
        const v = parseInt(lairInitCountEl.value);
        lairAction.initCount = isNaN(v) ? 20 : v;
        refreshPreStartActive();
        render();
      });

      document.getElementById('addBtn').addEventListener('click', addCombatant);
      document.getElementById('addInit').addEventListener('keydown', e => { if(e.key === 'Enter') addCombatant(); });
      document.getElementById('addName').addEventListener('keydown', e => { if(e.key === 'Enter') addCombatant(); });

      function addCombatant(){
        const nameEl = document.getElementById('addName');
        const initEl = document.getElementById('addInit');
        const name = nameEl.value.trim();
        const init = parseFloat(initEl.value);
        if(!name || isNaN(init)) return;
        const c = {
          id: nextId++, name, init, notes:'', hp:null, maxHp:null, tempHp:0, ac:null, rosterId:null,
          delayed:false, ready:false, legendaryMax:0, legendaryLeft:0, conditions:[], exhaustion:0,
          concentrating:false, concentrationSpell:'', concentrationRounds:0,
          spellSlots:{}, preparedSpells:[]
        };
        combatants.push(c);
        if(!combatStarted) refreshPreStartActive();
        else if(activeId === null) activeId = c.id;
        logEvent(`${name} joins initiative (${init})`);
        nameEl.value = ''; initEl.value = '';
        nameEl.focus();
        render();
      }

      document.getElementById('clearBtn').addEventListener('click', () => {
        combatants = []; activeId = null; round = 1; manualOrder = []; lairAction.triggered = false;
        combatStarted = false; condPickerOpenFor = null;
        logEvent('— Combat cleared —');
        render();
      });

      function nameForId(id){
        if(id === 'LAIR') return 'Lair Action';
        const c = combatants.find(x => x.id === id);
        return c ? c.name : null;
      }

      function nextTurn(){
        combatStarted = true;
        const ids = idsInOrder();
        if(!ids.length) return;
        const idx = ids.indexOf(activeId);
        const nextIdx = (idx + 1) % ids.length;
        if(nextIdx === 0 && idx !== -1){ round++; onRoundStart(); logEvent(`— Round ${round} —`); }
        activeId = ids[nextIdx];
        const nm = nameForId(activeId);
        if(nm) logEvent(`▶ ${nm}'s turn`);
        render();
      }
      function prevTurn(){
        combatStarted = true;
        const ids = idsInOrder();
        if(!ids.length) return;
        const idx = ids.indexOf(activeId);
        const prevIdx = (idx - 1 + ids.length) % ids.length;
        if(idx === 0 && round > 1) round--;
        activeId = ids[prevIdx];
        const nm = nameForId(activeId);
        if(nm) logEvent(`◀ back to ${nm}'s turn`);
        render();
      }
      document.getElementById('nextTurnBtn').addEventListener('click', nextTurn);
      document.getElementById('prevTurnBtn').addEventListener('click', prevTurn);