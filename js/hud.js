      // ---------------- HUD dragging ----------------
      (function(){
        const hud = document.getElementById('hud');
        let dragging = false, offX = 0, offY = 0;

        function clampAndPlace(clientX, clientY){
          const maxX = window.innerWidth - hud.offsetWidth - 4;
          const maxY = window.innerHeight - hud.offsetHeight - 4;
          const x = Math.min(Math.max(4, clientX - offX), Math.max(4, maxX));
          const y = Math.min(Math.max(4, clientY - offY), Math.max(4, maxY));
          hud.style.left = x + 'px';
          hud.style.top = y + 'px';
          hud.style.transform = 'none';
        }

        function startDrag(clientX, clientY){
          dragging = true;
          const rect = hud.getBoundingClientRect();
          offX = clientX - rect.left;
          offY = clientY - rect.top;
          document.body.style.userSelect = 'none';
          hud.classList.add('dragging');
          return true;
        }
        function endDrag(){
          if(!dragging) return;
          dragging = false;
          document.body.style.userSelect = '';
          hud.classList.remove('dragging');
          afterStateChange();
        }

        hud.addEventListener('mousedown', e => {
          startDrag(e.clientX, e.clientY);
        });
        window.addEventListener('mousemove', e => {
          if(!dragging) return;
          clampAndPlace(e.clientX, e.clientY);
        });
        window.addEventListener('mouseup', endDrag);

        hud.addEventListener('touchstart', e => {
          const t = e.touches[0];
          if(!t) return;
          if(startDrag(t.clientX, t.clientY)) e.preventDefault();
        }, { passive:false });
        window.addEventListener('touchmove', e => {
          if(!dragging) return;
          const t = e.touches[0];
          if(!t) return;
          e.preventDefault();
          clampAndPlace(t.clientX, t.clientY);
        }, { passive:false });
        window.addEventListener('touchend', endDrag);
        window.addEventListener('touchcancel', endDrag);
      })();

