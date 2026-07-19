// ---------------- Timers ----------------
      // Global timers list: { id, type, label, direction:'down'|'up', value, total, paused }
      // 'countdown' | 'spell' | 'torch' | 'potion' all count DOWN in combat rounds.
      // 'combat' counts UP in combat rounds, tracking how long the fight has run.
      // Mutated only via commands from the DM Remote; rendered read-only on the TV.
      let timers = [];
      let nextTimerId = 1;

      const TIMER_PRESETS = {
        countdown: { icon:'⏳', label:'Countdown', defaultRounds:3 },
        spell:     { icon:'✨', label:'Spell Duration', defaultRounds:10 },
        torch:     { icon:'🔥', label:'Torch', defaultRounds:60 },
        potion:    { icon:'🧪', label:'Potion', defaultRounds:10 },
        combat:    { icon:'⚔️', label:'Combat Timer', defaultRounds:0 }
      };

      function timerPreset(type){ return TIMER_PRESETS[type] || TIMER_PRESETS.countdown; }

      function addTimer(type, label, rounds){
        const preset = timerPreset(type);
        const isUp = type === 'combat';
        const startVal = isUp ? 0 : Math.max(0, parseInt(rounds, 10) || preset.defaultRounds);
        const t = {
          id: nextTimerId++,
          type: TIMER_PRESETS[type] ? type : 'countdown',
          label: (label || '').trim() || preset.label,
          direction: isUp ? 'up' : 'down',
          value: startVal,
          total: isUp ? 0 : startVal,
          paused: false
        };
        timers.push(t);
        logEvent(`${preset.icon} ${t.label} timer started${isUp ? '' : ` (${startVal} rd${startVal===1?'':'s'})`}`);
        renderTimers();
        afterStateChange();
        return t;
      }

      function removeTimer(id){
        const t = timers.find(x => x.id === id);
        timers = timers.filter(x => x.id !== id);
        if(t) logEvent(`${timerPreset(t.type).icon} ${t.label} timer removed`);
        renderTimers();
        afterStateChange();
      }

      function toggleTimerPause(id){
        const t = timers.find(x => x.id === id);
        if(!t) return;
        t.paused = !t.paused;
        renderTimers();
        afterStateChange();
      }

      function advanceTimers(){
        let changed = false;
        timers.forEach(t => {
          if(t.paused) return;
          if(t.direction === 'down'){
            if(t.value > 0){
              t.value = Math.max(0, t.value - 1);
              changed = true;
              if(t.value === 0){
                logEvent(`${timerPreset(t.type).icon} ${t.label} has run out!`);
              }
            }
          } else {
            t.value++;
            changed = true;
          }
        });
        if(changed) renderTimers();
      }

      function renderTimers(){
        const panel = document.getElementById('timersPanel');
        const list = document.getElementById('timersList');
        if(!timers.length){
          panel.classList.add('hidden');
          list.innerHTML = '';
          return;
        }
        panel.classList.remove('hidden');
        list.innerHTML = timers.map(t => {
          const preset = timerPreset(t.type);
          const expired = t.direction === 'down' && t.value === 0;
          const valueText = t.direction === 'up'
            ? `${t.value} rd${t.value === 1 ? '' : 's'}`
            : `${t.value}${t.total ? ' / ' + t.total : ''} rd${t.value === 1 ? '' : 's'}`;
          return `
            <div class="timerCard${expired ? ' expired' : ''}${t.paused ? ' paused' : ''}">
              <span class="timerIcon">${preset.icon}</span>
              <span class="timerLabel">${escapeHtml(t.label)}</span>
              <span class="timerValue">${expired ? 'Expired' : valueText}</span>
              ${t.paused ? '<span class="timerPausedTag">Paused</span>' : ''}
            </div>
          `;
        }).join('');
      }