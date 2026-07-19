      // ---------------- Dice Roller ----------------
      let diceType = 20;
      let diceCount = 1;
      let diceModifier = 0;
      let diceAdvMode = 'normal'; // 'normal' | 'adv' | 'dis'
      let logDiceRolls = false;
      let rollHistory = [];   // { id, time, text }
      let rollNextId = 1;
      const DICE_HISTORY_MAX = 100;
      let diceAnimTimer = null;
      let diceMaterial = 'crystal';
      let diceTrail = 'none';

      const diceTypeGridEl = document.getElementById('diceTypeGrid');
      const diceCountValEl = document.getElementById('diceCountVal');
      const diceModValEl = document.getElementById('diceModVal');
      const advBtnEl = document.getElementById('advBtn');
      const disBtnEl = document.getElementById('disBtn');
      const diceFacesEl = document.getElementById('diceFaces');
      const diceResultBigEl = document.getElementById('diceResultBig');
      const diceBreakdownEl = document.getElementById('diceBreakdown');
      const diceLogToggleEl = document.getElementById('diceLogToggle');
      const diceHistoryEl = document.getElementById('diceHistory');
      const materialGridEl = document.getElementById('materialGrid');
      const trailGridEl = document.getElementById('trailGrid');

      function rollDie(sides){ return 1 + Math.floor(Math.random() * sides); }

      function advDisAllowed(){ return diceType === 20 && diceCount === 1; }

      function hexColor(n){ return '#' + n.toString(16).padStart(6, '0'); }

      function updateDiceControlsUI(){
        diceTypeGridEl.querySelectorAll('.diceTypeBtn').forEach(btn => {
          btn.classList.toggle('active', parseInt(btn.dataset.sides) === diceType);
        });
        diceCountValEl.textContent = diceCount;
        diceModValEl.textContent = (diceModifier > 0 ? '+' : '') + diceModifier;
        const allowed = advDisAllowed();
        advBtnEl.disabled = !allowed;
        disBtnEl.disabled = !allowed;
        advBtnEl.classList.toggle('active', allowed && diceAdvMode === 'adv');
        disBtnEl.classList.toggle('active', allowed && diceAdvMode === 'dis');
      }

      // Material only affects the giant single-die physics roll (bounce/weight/sound/visual);
      // 2+ dice still use the lighter toss animation, same scope boundary as the physics engine itself.
      function renderMaterialGrid(){
        materialGridEl.innerHTML = DICE_MATERIALS.map(m => `
          <button class="materialBtn${m.id === diceMaterial ? ' active' : ''}" data-material="${m.id}"
            title="${escapeHtml(m.label)} - ${m.bounce} bounce, ${m.weight} weight">
            <span class="swatch" style="background:${hexColor(m.color)}"></span>
            ${escapeHtml(m.label)}
          </button>
        `).join('');
        materialGridEl.querySelectorAll('.materialBtn').forEach(btn => {
          btn.addEventListener('click', () => {
            diceMaterial = btn.dataset.material;
            renderMaterialGrid();
            afterStateChange();
          });
        });
      }

      function renderTrailGrid(){
        trailGridEl.innerHTML = DICE_TRAILS.map(t => `
          <button class="trailBtn${t.id === diceTrail ? ' active' : ''}" data-trail="${t.id}" title="${escapeHtml(t.label)}">
            ${t.color !== null ? `<span class="swatch" style="background:${hexColor(t.color)}"></span>` : ''}
            ${escapeHtml(t.label)}
          </button>
        `).join('');
        trailGridEl.querySelectorAll('.trailBtn').forEach(btn => {
          btn.addEventListener('click', () => {
            diceTrail = btn.dataset.trail;
            renderTrailGrid();
            afterStateChange();
          });
        });
      }

      diceTypeGridEl.querySelectorAll('.diceTypeBtn').forEach(btn => {
        btn.addEventListener('click', () => {
          diceType = parseInt(btn.dataset.sides);
          if(!advDisAllowed()) diceAdvMode = 'normal';
          updateDiceControlsUI();
          afterStateChange();
        });
      });
      document.getElementById('diceCountMinus').addEventListener('click', () => {
        diceCount = Math.max(1, diceCount - 1);
        if(!advDisAllowed()) diceAdvMode = 'normal';
        updateDiceControlsUI();
        afterStateChange();
      });
      document.getElementById('diceCountPlus').addEventListener('click', () => {
        diceCount = Math.min(20, diceCount + 1);
        if(!advDisAllowed()) diceAdvMode = 'normal';
        updateDiceControlsUI();
        afterStateChange();
      });
      document.getElementById('diceModMinus').addEventListener('click', () => {
        diceModifier = Math.max(-20, diceModifier - 1);
        updateDiceControlsUI();
        afterStateChange();
      });
      document.getElementById('diceModPlus').addEventListener('click', () => {
        diceModifier = Math.min(20, diceModifier + 1);
        updateDiceControlsUI();
        afterStateChange();
      });
      advBtnEl.addEventListener('click', () => {
        if(!advDisAllowed()) return;
        diceAdvMode = diceAdvMode === 'adv' ? 'normal' : 'adv';
        updateDiceControlsUI();
        afterStateChange();
      });
      disBtnEl.addEventListener('click', () => {
        if(!advDisAllowed()) return;
        diceAdvMode = diceAdvMode === 'dis' ? 'normal' : 'dis';
        updateDiceControlsUI();
        afterStateChange();
      });
      diceLogToggleEl.addEventListener('click', () => {
        logDiceRolls = !logDiceRolls;
        diceLogToggleEl.classList.toggle('on', logDiceRolls);
        afterStateChange();
      });

      function computeRoll(){
        const dice = [];
        let usedTotal = 0;
        if(advDisAllowed() && diceAdvMode !== 'normal'){
          const a = rollDie(20), b = rollDie(20);
          const use = diceAdvMode === 'adv' ? Math.max(a, b) : Math.min(a, b);
          let marked = false;
          [a, b].forEach(v => {
            const isUsed = !marked && v === use;
            if(isUsed) marked = true;
            dice.push({ sides:20, value:v, used:isUsed });
          });
          usedTotal = use;
        } else {
          for(let i = 0; i < diceCount; i++){
            const v = rollDie(diceType);
            dice.push({ sides:diceType, value:v, used:true });
            usedTotal += v;
          }
        }
        return { dice, modifier:diceModifier, total: usedTotal + diceModifier, advMode: advDisAllowed() ? diceAdvMode : 'normal' };
      }

      function formatRollLabel(result){
        let label = (diceCount > 1 ? diceCount : '') + 'd' + diceType;
        if(result.advMode === 'adv') label += ' (adv)';
        else if(result.advMode === 'dis') label += ' (dis)';
        if(result.modifier) label += (result.modifier > 0 ? '+' : '') + result.modifier;
        return label;
      }
      function formatBreakdown(result){
        let s = '[' + result.dice.map(d => d.value).join(', ') + ']';
        if(result.modifier) s += ' ' + (result.modifier > 0 ? '+' : '') + result.modifier;
        return s;
      }

      function buildFaceEl(sides, value, cls){
        const el = document.createElement('div');
        el.className = 'dieFace' + (cls ? ' ' + cls : '');
        el.textContent = value;
        return el;
      }

      let rollingFaceEls = [];

      function createRollingFaces(count, sides){
        diceFacesEl.innerHTML = '';
        rollingFaceEls = [];
        for(let i = 0; i < count; i++){
          const el = buildFaceEl(sides, rollDie(sides), 'rolling');
          el.style.animationDelay = Math.min(i * 35, 300) + 'ms';
          diceFacesEl.appendChild(el);
          rollingFaceEls.push(el);
        }
      }

      function tickRollingFaces(sides){
        rollingFaceEls.forEach(el => { el.textContent = rollDie(sides); });
      }

      function renderSettledFaces(result){
        diceFacesEl.innerHTML = '';
        rollingFaceEls = [];
        result.dice.forEach(d => {
          let cls = 'settled';
          if(d.sides === 20 && d.used && d.value === 20) cls += ' crit20';
          if(d.sides === 20 && d.used && d.value === 1) cls += ' crit1';
          if(!d.used) cls += ' unused';
          diceFacesEl.appendChild(buildFaceEl(d.sides, d.value, cls));
        });
      }

      const rollBtnEl = document.getElementById('rollBtn');

      function rollNow(clickEvent){
        if(diceAnimTimer){ clearInterval(diceAnimTimer); diceAnimTimer = null; }
        const result = computeRoll();
        diceResultBigEl.textContent = '';
        diceResultBigEl.className = 'diceResultBig';
        diceBreakdownEl.textContent = '';
        rollBtnEl.disabled = true;
        rollBtnEl.textContent = '🎲 Rolling…';

        const specs = result.dice.map(d => ({
          sides: d.sides, finalValue: d.value, used: d.used,
          isCritHigh: d.sides === 20 && d.used && d.value === 20 && diceCount === 1,
          isCritLow: d.sides === 20 && d.used && d.value === 1 && diceCount === 1
        }));
        const btnRect = rollBtnEl.getBoundingClientRect();
        // Launch from wherever the mouse actually clicked Roll; fall back to the button center
        // (e.g. keyboard-triggered rolls have no cursor position to grab).
        const origin = (clickEvent && clickEvent.clientX != null)
          ? { x: clickEvent.clientX, y: clickEvent.clientY }
          : { x: btnRect.left + btnRect.width / 2, y: btnRect.top + btnRect.height / 2 };

        if(GiantDiceEngine.isReady() && specs.length === 1){
          const material = findMaterial(diceMaterial);
          const trail = findTrail(diceTrail);
          GiantDiceEngine.rollGiantDie(specs[0], origin, material, trail, () => finishRoll(result));
        } else if(GiantDiceEngine.isReady()){
          const material = findMaterial(diceMaterial);
          const trail = findTrail(diceTrail);
          GiantDiceEngine.rollMultiDice(specs, origin, material, trail, String(result.total), () => finishRoll(result));
        } else {
          const animCount = result.dice.length;
          const animSides = diceType;
          createRollingFaces(animCount, animSides);
          let ticks = 0;
          const maxTicks = 12;
          diceAnimTimer = setInterval(() => {
            ticks++;
            tickRollingFaces(animSides);
            if(ticks >= maxTicks){
              clearInterval(diceAnimTimer);
              diceAnimTimer = null;
              finishRoll(result);
            }
          }, 70);
        }
      }

      function finishRoll(result){
        if(!GiantDiceEngine.isReady()) renderSettledFaces(result);
        rollBtnEl.disabled = false;
        rollBtnEl.textContent = '🎲 Roll';
        const isCrit20 = result.dice.some(d => d.sides === 20 && d.used && d.value === 20) && diceCount === 1;
        const isCrit1 = result.dice.some(d => d.sides === 20 && d.used && d.value === 1) && diceCount === 1;
        diceResultBigEl.textContent = result.total;
        diceResultBigEl.className = 'diceResultBig' + (isCrit20 ? ' crit20' : isCrit1 ? ' crit1' : '');
        diceBreakdownEl.textContent = formatBreakdown(result);

        const text = `🎲 ${formatRollLabel(result)}: ${formatBreakdown(result)} = ${result.total}`;
        rollHistory.push({ id: rollNextId++, time: formatLogTime(new Date()), text });
        if(rollHistory.length > DICE_HISTORY_MAX) rollHistory.splice(0, rollHistory.length - DICE_HISTORY_MAX);
        renderDiceHistory();
        if(logDiceRolls) logEvent(text);
        afterStateChange();
      }

      function renderDiceHistory(){
        if(!rollHistory.length){
          diceHistoryEl.innerHTML = '<div id="diceHistoryEmpty">No rolls yet.</div>';
          return;
        }
        diceHistoryEl.innerHTML = rollHistory.slice().reverse().map(e => `
          <div class="diceHistoryEntry">
            <span class="dhTime">${e.time}</span>
            <span class="dhText">${escapeHtml(e.text)}</span>
          </div>
        `).join('');
      }

      rollBtnEl.addEventListener('click', rollNow);
      document.getElementById('diceHistoryClearBtn').addEventListener('click', () => {
        rollHistory = [];
        renderDiceHistory();
        afterStateChange();
      });

      // Matter.js and PixiJS are bundled locally (see the <script> tags in <head>) so the giant
      // physics die works fully offline. If either failed to load for some reason, isReady()
      // stays false and the roller quietly keeps using the CSS tumble fallback.
      GiantDiceEngine.init(document.getElementById('diceStage')).then(ok => {
        if(ok) diceFacesEl.style.display = 'none'; // full-screen physics throw replaces the little in-panel boxes
      });
      updateDiceControlsUI();
      renderDiceHistory();
      renderMaterialGrid();
      renderTrailGrid();

