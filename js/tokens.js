// =====================================================================
      // TOKENS - a draggable marker per combatant, positioned in image-space
      // coordinates on the map. Rendered into #tokensLayer, which sits above
      // the grid but below the fog canvas (see overlay.css) so a token in an
      // unrevealed region is hidden by the fog exactly like the map beneath it.
      // Dragging happens directly on the TV, the same way ruler/spell placement
      // already works - "place" is armed from the DM Remote, the actual drag
      // gesture happens wherever the mouse physically is.
      // =====================================================================
      let tokens = []; // { id, combatantId, x, y } - x/y are image-space coords
      let tokenNextId = 1;
      const tokenElements = {}; // token.id -> <g> element, reused across renders so
                                 // an in-progress drag is never wiped out mid-gesture
      let draggingTokenId = null;

      const TOKEN_PALETTE = [
        '#5ac8c0', '#e0a458', '#c9a8ff', '#7fd4ea', '#f28c8c',
        '#a8d15a', '#ffb3d1', '#f4d35e', '#8ab6ff', '#d97fb8'
      ];
      function tokenColorFor(combatantId){
        // Stable per combatant (not per token instance), so a creature keeps its
        // color if removed and placed again later.
        let hash = 0;
        const s = String(combatantId);
        for(let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
        return TOKEN_PALETTE[hash % TOKEN_PALETTE.length];
      }
      function tokenLabelFor(name){
        if(!name) return '?';
        const words = name.trim().split(/\s+/).filter(Boolean);
        if(words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
        return name.trim().slice(0, 2).toUpperCase();
      }

      function findTokenForCombatant(id){ return tokens.find(t => t.combatantId === id); }

      function viewCenterImagePoint(){
        const rect = stage.getBoundingClientRect();
        return screenToImage(rect.left + stage.clientWidth / 2, rect.top + stage.clientHeight / 2);
      }

      function placeToken(combatantId){
        if(!imgW) return; // no map loaded - nowhere to put it
        if(findTokenForCombatant(combatantId)) return; // already on the map
        const center = viewCenterImagePoint();
        // small random jitter so placing several tokens in a row doesn't stack
        // them exactly on top of each other, which would make them hard to grab
        const jitter = () => (Math.random() - 0.5) * gridSize * 0.6;
        tokens.push({ id: tokenNextId++, combatantId, x: center.x + jitter(), y: center.y + jitter() });
        renderTokens();
        afterStateChange();
      }
      function removeToken(combatantId){
        const before = tokens.length;
        tokens = tokens.filter(t => t.combatantId !== combatantId);
        if(tokens.length !== before){ renderTokens(); afterStateChange(); }
      }
      function clearAllTokens(){
        tokens = [];
        Object.keys(tokenElements).forEach(id => {
          const el = tokenElements[id];
          if(el && el.parentNode) el.parentNode.removeChild(el);
          delete tokenElements[id];
        });
      }

      function positionTokenElement(g, token){
        // Size is stashed on the element itself (set in renderTokens, where the
        // combatant lookup happens) so a drag-in-progress can keep calling this
        // without needing to re-look-up the combatant on every mousemove.
        const sizeMultiplier = g.tokenSizeMultiplier || 1;
        const r = Math.max(10, gridSize * 0.42 * sizeMultiplier);
        const base = g.querySelector('.tokenBase');
        const ring = g.querySelector('.tokenRing');
        const label = g.querySelector('.tokenLabel');
        base.setAttribute('cx', token.x); base.setAttribute('cy', token.y); base.setAttribute('r', r);
        ring.setAttribute('cx', token.x); ring.setAttribute('cy', token.y); ring.setAttribute('r', r);
        label.setAttribute('x', token.x); label.setAttribute('y', token.y);
        label.style.fontSize = Math.max(9, r * 0.6) + 'px';
      }

      function makeTokenElement(token){
        const NS = 'http://www.w3.org/2000/svg';
        const g = document.createElementNS(NS, 'g');
        g.classList.add('tokenGroup');
        g.dataset.tokenId = token.id;
        const base = document.createElementNS(NS, 'circle');
        base.classList.add('tokenBase');
        const ring = document.createElementNS(NS, 'circle');
        ring.classList.add('tokenRing');
        ring.setAttribute('fill', 'none');
        const label = document.createElementNS(NS, 'text');
        label.classList.add('tokenLabel');
        g.appendChild(base); g.appendChild(ring); g.appendChild(label);

        // Stop these from also being read by the stage underneath (panning,
        // ruler/spell placement, fog-toggle clicks) - grabbing a token should
        // only ever move the token, never anything below it.
        g.addEventListener('mousedown', e => { if(mode === 'view') e.stopPropagation(); });
        g.addEventListener('click', e => e.stopPropagation());

        g.addEventListener('pointerdown', e => {
          if(mode !== 'view') return; // don't fight an in-progress ruler/spell placement
          e.stopPropagation();
          e.preventDefault();
          draggingTokenId = token.id;
          g.classList.add('dragging');
          g.setPointerCapture(e.pointerId);
        });
        g.addEventListener('pointermove', e => {
          if(draggingTokenId !== token.id) return;
          e.stopPropagation();
          const p = screenToImage(e.clientX, e.clientY);
          token.x = p.x; token.y = p.y;
          positionTokenElement(g, token);
        });
        function endDrag(e){
          if(draggingTokenId !== token.id) return;
          draggingTokenId = null;
          g.classList.remove('dragging');
          try{ g.releasePointerCapture(e.pointerId); }catch(err){}
          afterStateChange();
        }
        g.addEventListener('pointerup', endDrag);
        g.addEventListener('pointercancel', endDrag);
        return g;
      }

      function renderTokens(){
        const layer = document.getElementById('tokensLayer');
        if(!layer) return;

        // Drop elements for tokens that no longer exist
        Object.keys(tokenElements).forEach(idStr => {
          const id = parseInt(idStr);
          if(!tokens.some(t => t.id === id)){
            const el = tokenElements[id];
            if(el && el.parentNode) el.parentNode.removeChild(el);
            delete tokenElements[id];
          }
        });

        tokens.forEach(token => {
          let g = tokenElements[token.id];
          if(!g){
            g = makeTokenElement(token);
            tokenElements[token.id] = g;
            layer.appendChild(g);
          }
          const c = (typeof combatants !== 'undefined') ? combatants.find(x => x.id === token.combatantId) : null;
          const base = g.querySelector('.tokenBase');
          const ring = g.querySelector('.tokenRing');
          const label = g.querySelector('.tokenLabel');
          base.setAttribute('fill', (c && c.tokenColor) || tokenColorFor(token.combatantId));
          label.textContent = tokenLabelFor(c ? c.name : '?');
          g.tokenSizeMultiplier = (c && c.tokenSize) || 1;

          const isActive = c && typeof activeId !== 'undefined' && activeId === c.id;
          const isDown = c && c.hp !== null && c.hp !== undefined && c.hp <= 0;
          const isBloodied = c && !isDown && c.hp !== null && c.hp !== undefined && c.maxHp && c.hp <= c.maxHp / 2;
          ring.setAttribute('stroke', isActive ? '#7ad4e0' : isBloodied ? '#d1605a' : 'rgba(0,0,0,0.35)');
          g.classList.toggle('downed', !!isDown);

          // Don't snap the position back while the user is actively dragging it -
          // that would fight their own mouse movement mid-gesture.
          if(draggingTokenId !== token.id) positionTokenElement(g, token);
        });
      }