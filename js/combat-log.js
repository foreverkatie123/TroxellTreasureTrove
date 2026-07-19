      // ---------------- Combat Log ----------------
      let combatLog = [];   // { id, time:'HH:MM:SS', text }
      let logNextId = 1;
      const LOG_MAX_ENTRIES = 300;
      const logListEl = document.getElementById('logList');
      const logInputEl = document.getElementById('logInput');

      function formatLogTime(d){
        return d.toLocaleTimeString(undefined, { hour:'2-digit', minute:'2-digit', second:'2-digit' });
      }

      function logEvent(text){
        combatLog.push({ id: logNextId++, time: formatLogTime(new Date()), text });
        if(combatLog.length > LOG_MAX_ENTRIES) combatLog.splice(0, combatLog.length - LOG_MAX_ENTRIES);
        renderLog();
        afterStateChange();
      }

      function renderLog(){
        if(!combatLog.length){
          logListEl.innerHTML = '<div id="logEmpty">No log entries yet. Actions you take (turns, damage, conditions...) log here automatically - or type your own above.</div>';
          return;
        }
        logListEl.innerHTML = combatLog.slice().reverse().map(e => `
          <div class="logEntry">
            <span class="logTime">${e.time}</span>
            <span class="logText">${escapeHtml(e.text)}</span>
          </div>
        `).join('');
      }

      document.getElementById('logAddBtn').addEventListener('click', submitLogEntry);
      logInputEl.addEventListener('keydown', e => { if(e.key === 'Enter') submitLogEntry(); });
      function submitLogEntry(){
        const text = logInputEl.value.trim();
        if(!text) return;
        logEvent(text);
        logInputEl.value = '';
        logInputEl.focus();
      }
      document.getElementById('logClearBtn').addEventListener('click', () => {
        combatLog = [];
        renderLog();
        afterStateChange();
      });

