      // ---------------- Workspace Layout Switcher UI ----------------
      const layoutPanel = document.getElementById('layoutPanel');
      const layoutBtn = document.getElementById('layoutBtn');
      const layoutTabsEl = document.getElementById('layoutTabs');
      const layoutWidgetListEl = document.getElementById('layoutWidgetList');

      function renderLayoutPanel(){
        const current = WidgetShell.getCurrentLayout();
        layoutTabsEl.innerHTML = '';
        WidgetShell.LAYOUT_DEFS.forEach(def => {
          const tab = document.createElement('div');
          tab.className = 'layoutTab' + (def.id === current ? ' active' : '');
          tab.textContent = def.label;
          tab.addEventListener('click', () => {
            WidgetShell.setLayout(def.id);
            renderLayoutPanel();
          });
          layoutTabsEl.appendChild(tab);
        });

        layoutWidgetListEl.innerHTML = '';
        const widgets = WidgetShell.listWidgets();
        const ids = Object.keys(widgets);
        if(!ids.length){
          layoutWidgetListEl.innerHTML = '<div class="hint">No widgets registered yet.</div>';
        } else {
          ids.forEach(id => {
            const w = widgets[id];
            const row = document.createElement('div');
            row.className = 'widgetToggleRow';
            row.innerHTML = `<span>${w.title || id}</span>`;
            const sw = document.createElement('div');
            sw.className = 'switch' + (WidgetShell.isOpen(id) ? ' on' : '');
            sw.addEventListener('click', () => {
              WidgetShell.toggleOpen(id);
              sw.classList.toggle('on', WidgetShell.isOpen(id));
            });
            row.appendChild(sw);
            layoutWidgetListEl.appendChild(row);
          });
        }
      }

      function toggleLayoutPanel(force){
        const open = typeof force === 'boolean' ? force : !layoutPanel.classList.contains('open');
        layoutPanel.classList.toggle('open', open);
        layoutBtn.classList.toggle('active', open);
        if(open) renderLayoutPanel();
      }
      layoutBtn.addEventListener('click', () => toggleLayoutPanel());
      document.getElementById('resetLayoutBtn').addEventListener('click', () => {
        WidgetShell.resetLayout();
        renderLayoutPanel();
        afterStateChange();
      });
      WidgetShell.onChange(() => { afterStateChange(); renderLayoutPanel(); });

      function makeDrawerDraggable(handleEl, drawerEl, widgetId){
        let dragging = false, offX = 0, offY = 0;

        function clampAndPlace(clientX, clientY){
          const maxX = window.innerWidth - drawerEl.offsetWidth - 4;
          const maxY = window.innerHeight - drawerEl.offsetHeight - 4;
          const x = Math.min(Math.max(4, clientX - offX), Math.max(4, maxX));
          const y = Math.min(Math.max(4, clientY - offY), Math.max(4, maxY));
          drawerEl.style.left = x + 'px';
          drawerEl.style.top = y + 'px';
          drawerEl.style.right = 'auto';
        }
        function startDrag(clientX, clientY, target){
          if(target.closest && target.closest('.closeBtn')) return false;
          dragging = true;
          const rect = drawerEl.getBoundingClientRect();
          offX = clientX - rect.left;
          offY = clientY - rect.top;
          document.body.style.userSelect = 'none';
          drawerEl.classList.add('dragging');
          return true;
        }
        function endDrag(){
          if(!dragging) return;
          dragging = false;
          document.body.style.userSelect = '';
          drawerEl.classList.remove('dragging');
          WidgetShell.recordRect(widgetId);
          afterStateChange();
        }

        handleEl.addEventListener('mousedown', e => { startDrag(e.clientX, e.clientY, e.target); });
        window.addEventListener('mousemove', e => { if(dragging) clampAndPlace(e.clientX, e.clientY); });
        window.addEventListener('mouseup', endDrag);

        handleEl.addEventListener('touchstart', e => {
          const t = e.touches[0]; if(!t) return;
          if(startDrag(t.clientX, t.clientY, e.target)) e.preventDefault();
        }, { passive:false });
        window.addEventListener('touchmove', e => {
          if(!dragging) return;
          const t = e.touches[0]; if(!t) return;
          e.preventDefault();
          clampAndPlace(t.clientX, t.clientY);
        }, { passive:false });
        window.addEventListener('touchend', endDrag);
        window.addEventListener('touchcancel', endDrag);
      }
      makeDrawerDraggable(document.getElementById('initHeader'), initDrawer, 'initiative');
      makeDrawerDraggable(document.getElementById('logHeader'), logDrawer, 'combatLog');
      makeDrawerDraggable(document.getElementById('diceHeader'), diceDrawer, 'diceRoller');

