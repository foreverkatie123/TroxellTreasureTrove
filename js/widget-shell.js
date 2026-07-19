      // ---------------- Widget Shell (layouts: draggable/resizable panels) ----------------
      // Foundation for the "DM workspace" concept: widgets (draggable, resizable panels)
      // register themselves once, and a Layout (Combat / Exploration / Town) remembers
      // each widget's position, size, and open/closed state independently.
      const WidgetShell = (function(){
        const LAYOUT_KEY = 'troxellWidgetLayouts_v1';
        const LAYOUT_DEFS = [
          { id:'combat', label:'⚔ Combat' },
          { id:'exploration', label:'🧭 Exploration' },
          { id:'town', label:'🏘 Town' }
        ];
        let registry = {};      // id -> { el, title, resizable, minW, minH, defaultOpen:{layoutId:bool} }
        let layouts = null;     // layoutId -> { widgetId -> {open,x,y,w,h} }
        let currentLayout = 'combat';
        let changeCb = null;

        function emptyLayouts(){
          const l = {};
          LAYOUT_DEFS.forEach(d => l[d.id] = {});
          return l;
        }
        function ensureLayouts(){ if(!layouts) layouts = emptyLayouts(); }
        function ensureEntry(layoutId, id){
          ensureLayouts();
          if(!layouts[layoutId]) layouts[layoutId] = {};
          if(!layouts[layoutId][id]){
            const w = registry[id];
            const defOpen = w && w.defaultOpen ? !!w.defaultOpen[layoutId] : false;
            const entry = { open: defOpen };
            if(w && w.resizable){
              entry.w = w.defaultW || (w.el && w.el.offsetWidth) || 300;
              entry.h = w.defaultH || Math.min(640, Math.round(window.innerHeight * 0.72));
            }
            layouts[layoutId][id] = entry;
          }
          return layouts[layoutId][id];
        }

        function notify(){ if(changeCb) changeCb(); }

        function register(id, el, opts){
          opts = opts || {};
          registry[id] = Object.assign({ el, minW:220, minH:160 }, opts);
          ensureLayouts();
          LAYOUT_DEFS.forEach(d => ensureEntry(d.id, id));
          if(opts.resizable){
            el.style.maxHeight = 'none';
            attachResizer(id);
          }
          applyRect(id);
        }

        function applyRect(id){
          const w = registry[id]; if(!w) return;
          const st = ensureEntry(currentLayout, id);
          w.el.classList.toggle('open', !!st.open);
          if(typeof st.x === 'number'){ w.el.style.left = st.x + 'px'; w.el.style.top = st.y + 'px'; w.el.style.right = 'auto'; }
          if(typeof st.w === 'number') w.el.style.width = st.w + 'px';
          if(typeof st.h === 'number') w.el.style.height = st.h + 'px';
        }

        function applyLayout(){ Object.keys(registry).forEach(applyRect); }

        function setLayout(id){
          if(!LAYOUT_DEFS.some(d => d.id === id)) return;
          currentLayout = id;
          applyLayout();
          notify();
        }

        function recordRect(id){
          const w = registry[id]; if(!w) return;
          const st = ensureEntry(currentLayout, id);
          const rect = w.el.getBoundingClientRect();
          st.x = rect.left; st.y = rect.top; st.w = w.el.offsetWidth; st.h = w.el.offsetHeight;
          notify();
        }

        function setOpen(id, open){
          const st = ensureEntry(currentLayout, id);
          st.open = !!open;
          applyRect(id);
          notify();
        }
        function toggleOpen(id){
          const st = ensureEntry(currentLayout, id);
          setOpen(id, !st.open);
        }
        function isOpen(id){ return !!ensureEntry(currentLayout, id).open; }

        function resetLayout(layoutId){
          layoutId = layoutId || currentLayout;
          layouts[layoutId] = {};
          Object.keys(registry).forEach(id => ensureEntry(layoutId, id));
          if(layoutId === currentLayout) applyLayout();
          notify();
        }

        function attachResizer(id){
          const w = registry[id];
          const el = w.el;
          if(el.querySelector(':scope > .widgetResizeHandle')) return;
          const handle = document.createElement('div');
          handle.className = 'widgetResizeHandle';
          handle.title = 'Drag to resize';
          el.appendChild(handle);
          let resizing = false, startX = 0, startY = 0, startW = 0, startH = 0;
          function start(cx, cy){
            resizing = true; startX = cx; startY = cy;
            startW = el.offsetWidth; startH = el.offsetHeight;
            el.classList.add('resizing');
          }
          function move(cx, cy){
            if(!resizing) return;
            const nw = Math.max(w.minW, startW + (cx - startX));
            const nh = Math.max(w.minH, startH + (cy - startY));
            el.style.width = nw + 'px';
            el.style.height = nh + 'px';
          }
          function end(){
            if(!resizing) return;
            resizing = false;
            el.classList.remove('resizing');
            recordRect(id);
          }
          handle.addEventListener('mousedown', e => { e.stopPropagation(); start(e.clientX, e.clientY); });
          window.addEventListener('mousemove', e => move(e.clientX, e.clientY));
          window.addEventListener('mouseup', end);
          handle.addEventListener('touchstart', e => {
            const t = e.touches[0]; if(!t) return;
            e.stopPropagation(); e.preventDefault(); start(t.clientX, t.clientY);
          }, { passive:false });
          window.addEventListener('touchmove', e => {
            if(!resizing) return;
            const t = e.touches[0]; if(!t) return;
            e.preventDefault(); move(t.clientX, t.clientY);
          }, { passive:false });
          window.addEventListener('touchend', end);
          window.addEventListener('touchcancel', end);
        }

        function getState(){ ensureLayouts(); return { layouts, currentLayout }; }
        function loadState(state){
          if(!state || typeof state !== 'object') return;
          if(state.layouts && typeof state.layouts === 'object'){
            layouts = state.layouts;
            ensureLayouts();
          }
          if(state.currentLayout && LAYOUT_DEFS.some(d => d.id === state.currentLayout)){
            currentLayout = state.currentLayout;
          }
        }

        return {
          LAYOUT_DEFS, register, setLayout, getCurrentLayout: () => currentLayout,
          recordRect, setOpen, toggleOpen, isOpen, resetLayout, applyLayout,
          getState, loadState, onChange: cb => { changeCb = cb; },
          listWidgets: () => registry
        };
      })();

