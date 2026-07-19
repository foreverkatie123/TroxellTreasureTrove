      // ---------------- Giant Dice Engine (Matter.js physics + PixiJS rendering) ----------------
      // A single die is thrown from the cursor as a real rigid body: it launches, spins, bounces
      // off the window edges and off any open widget panel (the widgets already know their own
      // screen position - we just read it), slides as friction bleeds off its energy, and settles.
      // Multiple dice (diceCount > 1) still use the lighter hand-rolled toss below. If Matter.js or
      // PixiJS failed to load, isReady() stays false and the caller falls back to the CSS tumble.
      const GiantDiceEngine = (function(){
        let app = null;
        let ready = false;
        const GIANT_RADIUS = 90;   // radius in px for a single giant physics die (~180px across)

        // Multiple dice (a fireball's 8d6, say) render smaller so a whole handful fits on screen
        // and still collides sensibly with itself and the widgets.
        function radiusForCount(count){
          if(count <= 2) return 62;
          if(count <= 4) return 50;
          if(count <= 7) return 42;
          if(count <= 12) return 34;
          return 28;
        }

        async function init(container){
          if(typeof PIXI === 'undefined' || typeof Matter === 'undefined') return false;
          try{
            app = new PIXI.Application();
            await app.init({
              width: window.innerWidth, height: window.innerHeight, backgroundAlpha: 0, antialias: true,
              resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true
            });
            container.innerHTML = '';
            container.appendChild(app.canvas);
            window.addEventListener('resize', () => {
              if(app) app.renderer.resize(window.innerWidth, window.innerHeight);
            });
            ready = true;
            return true;
          }catch(err){
            console.warn('Dice physics engine failed to initialize, falling back to CSS dice:', err);
            ready = false;
            return false;
          }
        }

        function isReady(){ return ready; }

        function makeResultLabel(){
          const t = new PIXI.Text({ text:'', style:{
            fontFamily:'Cinzel, Georgia, serif', fontSize:34, fontWeight:'700',
            fill:0xffffff, align:'left', stroke:{ color:0x08131a, width:5 }
          }});
          t.anchor.set(0, 0.5);
          return t;
        }

        function spawnParticles(x, y, color, count){
          const particles = [];
          for(let i = 0; i < count; i++){
            const g = new PIXI.Graphics();
            g.circle(0, 0, 2.5 + Math.random() * 3).fill(color);
            g.x = x; g.y = y;
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 4.5;
            particles.push({ el:g, vx:Math.cos(angle) * speed, vy:Math.sin(angle) * speed - 2, life:1 });
            app.stage.addChild(g);
          }
          let frame = 0;
          const maxFrames = 32;
          function tick(){
            frame++;
            particles.forEach(p => {
              p.vy += 0.18;
              p.el.x += p.vx;
              p.el.y += p.vy;
              p.life -= 1 / maxFrames;
              p.el.alpha = Math.max(0, p.life);
            });
            if(frame >= maxFrames){
              app.ticker.remove(tick);
              particles.forEach(p => app.stage.removeChild(p.el));
            }
          }
          app.ticker.add(tick);
        }

        function fadeOutAndClear(containers, holdMs){
          setTimeout(() => {
            let frame = 0;
            const maxFrames = 22;
            function tick(){
              frame++;
              const a = Math.max(0, 1 - frame / maxFrames);
              containers.forEach(c => { c.alpha = a; });
              if(frame >= maxFrames){
                app.ticker.remove(tick);
                containers.forEach(c => { if(c.parent) app.stage.removeChild(c); });
              }
            }
            app.ticker.add(tick);
          }, holdMs);
        }

        // Static rectangle bodies ringing the full overlay, well outside the visible area so a
        // fast-moving die can't tunnel through at the corners.
        function buildWalls(w, h){
          const t = 240;
          return [
            Matter.Bodies.rectangle(w / 2, -t / 2, w + t * 2, t, { isStatic:true, restitution:0.55 }),
            Matter.Bodies.rectangle(w / 2, h + t / 2, w + t * 2, t, { isStatic:true, restitution:0.55 }),
            Matter.Bodies.rectangle(-t / 2, h / 2, t, h + t * 2, { isStatic:true, restitution:0.55 }),
            Matter.Bodies.rectangle(w + t / 2, h / 2, t, h + t * 2, { isStatic:true, restitution:0.55 })
          ];
        }

        // One static body per currently-open widget drawer, sized to its live screen rect - move
        // a panel and the next roll bounces off its new spot instead of the old one.
        function buildWidgetObstacles(){
          const bodies = [];
          document.querySelectorAll('.drawer.open').forEach(el => {
            const r = el.getBoundingClientRect();
            if(r.width < 4 || r.height < 4) return;
            bodies.push(Matter.Bodies.rectangle(
              r.left + r.width / 2, r.top + r.height / 2, r.width, r.height,
              { isStatic:true, restitution:0.55, friction:0.03, chamfer:{ radius:10 } }
            ));
          });
          return bodies;
        }

        function shapePoints(sides, r){
          if(sides === 4) return [0,-r, r*0.87,r*0.5, -r*0.87,r*0.5];
          if(sides === 8) return [0,-r, r*0.75,0, 0,r, -r*0.75,0];
          if(sides === 10) return [0,-r, r*0.7,-r*0.2, r*0.5,r, -r*0.5,r, -r*0.7,-r*0.2];
          if(sides === 12){
            const pts = [];
            for(let i = 0; i < 5; i++){ const a = -Math.PI/2 + i*(2*Math.PI/5); pts.push(r*Math.cos(a), r*Math.sin(a)); }
            return pts;
          }
          const pts = [];
          for(let i = 0; i < 8; i++){ const a = -Math.PI/2 + i*(2*Math.PI/8); pts.push(r*Math.cos(a), r*Math.sin(a)); }
          return pts;
        }

        // The giant die's look is driven by the material's "Visual" column - a few layered
        // Graphics children rather than a real shader, but each material reads distinctly.
        function makeGiantDieGraphic(sides, material, r){
          const container = new PIXI.Container();
          const color = material.color;
          const visual = material.visual;
          const pts = sides === 6 ? null : shapePoints(sides, r);

          if(visual === 'glow' || visual === 'darkglow' || visual === 'embers'){
            const glowColor = visual === 'darkglow' ? (material.accent || 0x8a4fd1)
              : visual === 'embers' ? (material.accent || 0xffb347)
              : color;
            for(let i = 3; i >= 1; i--){
              const glow = new PIXI.Graphics();
              glow.circle(0, 0, r * (1 + i * 0.18)).fill({ color: glowColor, alpha: 0.045 * i });
              container.addChild(glow);
            }
          }

          const base = new PIXI.Graphics();
          if(sides === 6){ base.roundRect(-r*0.85, -r*0.85, r*1.7, r*1.7, 8); }
          else { base.poly(pts); }
          base.fill({ color, alpha:1 });
          base.stroke({ width:2, color: visual === 'matte' ? 0x1a1410 : 0xffffff, alpha: visual === 'matte' ? 0.2 : 0.32 });
          container.addChild(base);

          if(visual !== 'matte'){
            const facets = new PIXI.Graphics();
            const n = pts ? pts.length / 2 : 4;
            for(let i = 0; i < n; i++){
              const a = (i / n) * Math.PI * 2;
              facets.moveTo(0, 0).lineTo(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92)
                .stroke({ width:1, color:0xffffff, alpha:0.1 });
            }
            container.addChild(facets);
          }

          if(visual === 'refraction' && pts){
            const n = pts.length / 2;
            for(let i = 0; i < n; i++){
              const ax = pts[i*2], ay = pts[i*2+1];
              const bx = pts[((i+1)%n)*2], by = pts[((i+1)%n)*2+1];
              const wedge = new PIXI.Graphics();
              wedge.poly([0,0, ax,ay, bx,by]).fill({ color: i % 2 === 0 ? 0xffffff : 0x000000, alpha:0.08 });
              container.addChild(wedge);
            }
          } else if(visual === 'reflections'){
            const shine = new PIXI.Graphics();
            shine.ellipse(-r*0.28, -r*0.32, r*0.34, r*0.16).fill({ color:0xffffff, alpha:0.5 });
            shine.rotation = -0.5;
            container.addChild(shine);
          } else if(visual === 'grain'){
            const grain = new PIXI.Graphics();
            for(let i = -2; i <= 2; i++){
              grain.moveTo(-r*0.8, i * r * 0.28)
                .quadraticCurveTo(0, i * r * 0.28 + r * 0.08, r*0.8, i * r * 0.28)
                .stroke({ width:1.5, color: material.accent || 0x7a4e26, alpha:0.35 });
            }
            container.addChild(grain);
          }

          return container;
        }

        function makeGiantDie(sides, material, r){
          const c = new PIXI.Container();
          c.addChild(makeGiantDieGraphic(sides, material, r));
          const text = new PIXI.Text({ text:'', style:{
            fontFamily:'Cinzel, Georgia, serif', fontSize:Math.round(r * 0.8), fontWeight:'700',
            fill:0xffffff, align:'center', stroke:{ color:0x08131a, width:Math.max(3, Math.round(r * 0.05)) }
          }});
          text.anchor.set(0.5);
          c.addChild(text);
          c._text = text;
          return c;
        }

        // A ring that expands and fades - used by several landing effects (frost ring, magic circle...).
        function spawnRing(x, y, color, alpha, startRadius, endRadius, duration){
          const ring = new PIXI.Graphics();
          ring.x = x; ring.y = y;
          app.stage.addChild(ring);
          let elapsed = 0;
          function tick(){
            elapsed += app.ticker.deltaMS;
            const t = Math.min(1, elapsed / duration);
            const r = startRadius + (endRadius - startRadius) * t;
            ring.clear();
            ring.circle(0, 0, r).stroke({ width:3, color, alpha: alpha * (1 - t) });
            if(t >= 1){ app.ticker.remove(tick); if(ring.parent) app.stage.removeChild(ring); }
          }
          app.ticker.add(tick);
        }

        // Small rectangular chips flung outward with gravity - wood's landing effect.
        function spawnChips(x, y, color, count){
          const chips = [];
          for(let i = 0; i < count; i++){
            const g = new PIXI.Graphics();
            const cw = 4 + Math.random() * 4, ch = 2 + Math.random() * 2;
            g.rect(-cw/2, -ch/2, cw, ch).fill({ color, alpha:1 });
            g.x = x; g.y = y; g.rotation = Math.random() * Math.PI * 2;
            const angle = Math.random() * Math.PI * 2, speed = 2 + Math.random() * 4;
            chips.push({ el:g, vx:Math.cos(angle) * speed, vy:Math.sin(angle) * speed - 2, rotV:(Math.random()-0.5) * 0.4, life:1 });
            app.stage.addChild(g);
          }
          let frame = 0;
          const maxFrames = 36;
          function tick(){
            frame++;
            chips.forEach(c => {
              c.vy += 0.22;
              c.el.x += c.vx; c.el.y += c.vy; c.el.rotation += c.rotV;
              c.life -= 1 / maxFrames;
              c.el.alpha = Math.max(0, c.life);
            });
            if(frame >= maxFrames){
              app.ticker.remove(tick);
              chips.forEach(c => { if(c.el.parent) app.stage.removeChild(c.el); });
            }
          }
          app.ticker.add(tick);
        }

        // scale shrinks particle counts/ring radii for multi-die rolls, where up to 20 dice can
        // each trigger their own landing effect and a full-size burst per die would be a wall of noise.
        function spawnLandingEffect(kind, x, y, material, trail, scale){
          scale = scale === undefined ? 1 : scale;
          const n = c => Math.max(3, Math.round(c * scale));
          const rs = Math.max(0.45, scale);
          switch(kind){
            case 'dust-puff': {
              const c = material.id === 'stone' ? 0x8c8c86 : material.id === 'bone' ? 0xcfc6ae : 0xb9c2c9;
              spawnParticles(x, y, c, n(14));
              spawnRing(x, y, c, 0.3, 6, 40 * rs, 450);
              break;
            }
            case 'sparkle-burst':
              spawnParticles(x, y, 0xffffff, n(10));
              spawnParticles(x, y, material.color, n(14));
              break;
            case 'wood-chips':
              spawnChips(x, y, material.accent || 0x7a4e26, n(10));
              break;
            case 'dark-burst':
              spawnParticles(x, y, material.accent || 0x8a4fd1, n(16));
              spawnRing(x, y, material.accent || 0x8a4fd1, 0.4, 6, 46 * rs, 500);
              break;
            case 'ember-burst':
              spawnParticles(x, y, 0xffb347, n(10));
              spawnParticles(x, y, 0xff5a3c, n(14));
              break;
            case 'magic-circle':
              spawnRing(x, y, trail.color, 0.65, 8, 58 * rs, 650);
              spawnParticles(x, y, trail.color, n(16));
              break;
            case 'poof-embers':
              spawnRing(x, y, 0xffcf9c, 0.4, 6, 44 * rs, 400);
              spawnParticles(x, y, trail.color, n(20));
              break;
            case 'frost-ring':
              spawnRing(x, y, trail.color, 0.7, 6, 60 * rs, 550);
              spawnParticles(x, y, 0xffffff, n(14));
              break;
            case 'spark-burst':
              spawnParticles(x, y, trail.color, n(22));
              spawnRing(x, y, trail.color, 0.5, 4, 30 * rs, 250);
              break;
            case 'smoke-cloud':
              spawnParticles(x, y, trail.color, n(16));
              break;
            case 'gold-burst':
              spawnRing(x, y, trail.color, 0.6, 4, 40 * rs, 350);
              spawnParticles(x, y, trail.color, n(20));
              break;
            case 'blood-splatter':
              spawnParticles(x, y, trail.color, n(16));
              break;
            default:
              spawnParticles(x, y, 0xffffff, n(12));
          }
        }

        // Spawns one themed particle while the die is airborne, into trailContainer (kept behind
        // the die so it reads as a trail rather than an overlay). Called on an interval from the
        // roll tick loop, not every frame.
        function spawnTrailParticle(trailContainer, trail, x, y){
          if(!trail || trail.id === 'none') return;
          const g = new PIXI.Graphics();
          let life = 0.6, vx = (Math.random()-0.5) * 0.6, vy = (Math.random()-0.5) * 0.6, grow = false;
          switch(trail.id){
            case 'arcane': {
              const s = 5 + Math.random() * 3;
              for(let i = 0; i < 4; i++){
                const a = (i / 4) * Math.PI * 2 + Math.random() * 0.4;
                g.moveTo(0, 0).lineTo(Math.cos(a) * s, Math.sin(a) * s).stroke({ width:1.4, color:trail.color, alpha:0.8 });
              }
              life = 0.9; vy = -0.3;
              break;
            }
            case 'fire':
              g.circle(0, 0, 2 + Math.random() * 2.5).fill({ color: Math.random() > 0.5 ? trail.color : 0xffd27a, alpha:0.85 });
              life = 0.45; vy = -0.8 - Math.random() * 0.6;
              break;
            case 'ice': {
              const s = 3 + Math.random() * 2;
              for(let i = 0; i < 3; i++){
                const a = (i / 3) * Math.PI;
                g.moveTo(-Math.cos(a)*s, -Math.sin(a)*s).lineTo(Math.cos(a)*s, Math.sin(a)*s).stroke({ width:1, color:trail.color, alpha:0.9 });
              }
              life = 0.7; vy = 0.5 + Math.random() * 0.4;
              break;
            }
            case 'lightning': {
              if(Math.random() < 0.6) return; // flicker rather than a solid stream
              const s = 6 + Math.random() * 5;
              const midx = (Math.random()-0.5) * s, midy = (Math.random()-0.5) * s;
              g.moveTo(-s/2, -s/2).lineTo(midx, midy).lineTo(s/2, s/2).stroke({ width:1.4, color:trail.color, alpha:0.9 });
              life = 0.22; vx = 0; vy = 0;
              break;
            }
            case 'necrotic':
              g.circle(0, 0, 4 + Math.random() * 4).fill({ color:trail.color, alpha:0.35 });
              life = 0.9; vy = -0.25; grow = true;
              break;
            case 'holy': {
              const s = 3.5;
              g.moveTo(-s, 0).lineTo(s, 0).stroke({ width:1.3, color:trail.color, alpha:0.9 });
              g.moveTo(0, -s).lineTo(0, s).stroke({ width:1.3, color:trail.color, alpha:0.9 });
              life = 0.5; vy = -0.6;
              break;
            }
            case 'blood':
              g.circle(0, 0, 2 + Math.random() * 2).fill({ color:trail.color, alpha:0.7 });
              life = 0.7; vy = 0.3;
              break;
            case 'shadow':
              g.circle(0, 0, 4 + Math.random() * 3).fill({ color:trail.color, alpha:0.4 });
              life = 0.85; vy = -0.15; grow = true;
              break;
            default:
              return;
          }
          g.x = x; g.y = y;
          trailContainer.addChild(g);
          let elapsed = 0;
          function tick(){
            elapsed += app.ticker.deltaMS / 1000;
            g.x += vx; g.y += vy;
            if(grow) g.scale.set(1 + elapsed * 1.4);
            g.alpha = Math.max(0, 1 - elapsed / life);
            if(elapsed >= life){
              app.ticker.remove(tick);
              if(g.parent) trailContainer.removeChild(g);
            }
          }
          app.ticker.add(tick);
        }

        // spec: { sides, finalValue, used, isCritHigh, isCritLow }
        // origin: { x, y } in viewport coordinates - the die launches from here (the mouse cursor)
        // material/trail: entries from DICE_MATERIALS / DICE_TRAILS (see findMaterial/findTrail)
        function rollGiantDie(spec, origin, material, trail, onSettled){
          if(!ready){ onSettled(); return; }
          try{
            app.stage.removeChildren();
            const w = app.renderer.width / app.renderer.resolution;
            const h = app.renderer.height / app.renderer.resolution;

            const engine = Matter.Engine.create();
            engine.gravity.x = 0;
            engine.gravity.y = 0; // top-down overlay: the die glides and bounces, it doesn't fall

            const obstacles = buildWidgetObstacles();
            Matter.World.add(engine.world, [...buildWalls(w, h), ...obstacles]);

            const startX = Math.min(Math.max(origin ? origin.x : w / 2, GIANT_RADIUS + 4), w - GIANT_RADIUS - 4);
            const startY = Math.min(Math.max(origin ? origin.y : h / 2, GIANT_RADIUS + 4), h - GIANT_RADIUS - 4);

            const trailContainer = new PIXI.Container();
            app.stage.addChild(trailContainer);

            const die = makeGiantDie(spec.sides, material, GIANT_RADIUS);
            die.x = startX; die.y = startY; die.alpha = 1;
            app.stage.addChild(die);

            const restitution = BOUNCE_RESTITUTION[material.bounce] || 0.55;
            const weightP = WEIGHT_PHYSICS[material.weight] || WEIGHT_PHYSICS.medium;
            const body = Matter.Bodies.circle(startX, startY, GIANT_RADIUS * 0.92, {
              restitution, friction: 0.06, frictionAir: weightP.frictionAir, density: weightP.density
            });
            const throwAngle = Math.random() * Math.PI * 2;
            const throwSpeed = (18 + Math.random() * 8) * weightP.speedMul;
            Matter.Body.setVelocity(body, { x: Math.cos(throwAngle) * throwSpeed, y: Math.sin(throwAngle) * throwSpeed });
            Matter.Body.setAngularVelocity(body, (Math.random() > 0.5 ? 1 : -1) * (0.25 + Math.random() * 0.25) * weightP.spinMul);
            Matter.World.add(engine.world, body);

            let elapsed = 0;
            let slowFrames = 0;
            let settled = false;
            let trailAccum = 0;
            let lastImpactMs = -1000;
            const TRAIL_INTERVAL_MS = 45;
            const maxDurationMs = 7000; // safety cap - natural settles land around 2-4.5s depending on material
            const SETTLE_SPEED = 0.1, SETTLE_SPIN = 0.025, SETTLE_FRAMES = 15;

            function onCollision(event){
              const speed = Matter.Vector.magnitude(body.velocity);
              if(speed < 0.6) return; // ignore the constant micro-contacts while settling
              if(elapsed - lastImpactMs < 60) return;
              lastImpactMs = elapsed;
              const pairsInvolveDie = event.pairs.some(p => p.bodyA === body || p.bodyB === body);
              if(!pairsInvolveDie) return;
              DiceSoundFX.play(material.soundId, Math.min(1, speed / 22));
            }
            Matter.Events.on(engine, 'collisionStart', onCollision);

            const resultLabel = makeResultLabel();
            resultLabel.alpha = 0;
            app.stage.addChild(resultLabel);

            function cleanupWorld(){
              Matter.Events.off(engine, 'collisionStart', onCollision);
              Matter.World.clear(engine.world);
              Matter.Engine.clear(engine);
            }

            function tick(){
              elapsed += app.ticker.deltaMS;
              Matter.Engine.update(engine, app.ticker.deltaMS);

              die.x = body.position.x;
              die.y = body.position.y;
              die.rotation = body.angle;
              if(!settled) die._text.text = String(1 + Math.floor(Math.random() * spec.sides));

              trailAccum += app.ticker.deltaMS;
              if(!settled && trailAccum >= TRAIL_INTERVAL_MS){
                trailAccum = 0;
                spawnTrailParticle(trailContainer, trail, die.x, die.y);
              }

              const speed = Matter.Vector.magnitude(body.velocity);
              const spin = Math.abs(body.angularVelocity);
              if(speed < SETTLE_SPEED && spin < SETTLE_SPIN){ slowFrames++; } else { slowFrames = 0; }

              if(!settled && (slowFrames >= SETTLE_FRAMES || elapsed > maxDurationMs)){
                settled = true;
                Matter.Body.setStatic(body, true);
                die._text.text = String(spec.finalValue);
                if(!spec.used) die.alpha = 0.35;

                const critColor = spec.isCritHigh ? 0x5ac8c0 : spec.isCritLow ? 0xd1605a : 0xffffff;
                resultLabel.text = String(spec.finalValue);
                resultLabel.style.fill = critColor;
                const spaceRight = w - (die.x + GIANT_RADIUS + 20);
                if(spaceRight > 90){
                  resultLabel.anchor.set(0, 0.5);
                  resultLabel.x = die.x + GIANT_RADIUS + 20;
                } else {
                  resultLabel.anchor.set(1, 0.5);
                  resultLabel.x = die.x - GIANT_RADIUS - 20;
                }
                resultLabel.y = Math.min(Math.max(die.y, 30), h - 30);
                resultLabel.alpha = 1;

                spawnLandingEffect(landingEffectKind(material, trail), die.x, die.y, material, trail);
                DiceSoundFX.play(material.soundId, 0.8);

                app.ticker.remove(tick);
                cleanupWorld();
                onSettled();
                fadeOutAndClear([die, resultLabel], 1300);
              }
            }
            app.ticker.add(tick);
          }catch(err){
            console.warn('Giant physics dice roll failed, falling back:', err);
            ready = false;
            onSettled();
          }
        }

        // specs: [{ sides, finalValue, used, isCritHigh, isCritLow }] - one per die (e.g. 8d6 fireball)
        // origin: { x, y } in viewport coordinates - all dice launch from here and scatter
        // material/trail: same picker as the single die, applied to every die in the roll
        // totalText: preformatted total (sum + modifier) shown once every die has settled
        function rollMultiDice(specs, origin, material, trail, totalText, onSettled){
          if(!ready){ onSettled(); return; }
          try{
            app.stage.removeChildren();
            const w = app.renderer.width / app.renderer.resolution;
            const h = app.renderer.height / app.renderer.resolution;
            const radius = radiusForCount(specs.length);

            const engine = Matter.Engine.create();
            engine.gravity.x = 0;
            engine.gravity.y = 0;

            const obstacles = buildWidgetObstacles();
            Matter.World.add(engine.world, [...buildWalls(w, h), ...obstacles]);

            const restitution = BOUNCE_RESTITUTION[material.bounce] || 0.55;
            const weightP = WEIGHT_PHYSICS[material.weight] || WEIGHT_PHYSICS.medium;
            const originX = Math.min(Math.max(origin ? origin.x : w / 2, radius + 4), w - radius - 4);
            const originY = Math.min(Math.max(origin ? origin.y : h / 2, radius + 4), h - radius - 4);

            const trailContainer = new PIXI.Container();
            app.stage.addChild(trailContainer);

            let elapsed = 0;
            let lastImpactMs = -1000;
            const trailIntervalMs = 45 * specs.length; // keep total particle output roughly constant regardless of count
            const maxDurationMs = 8000;
            const SETTLE_SPEED = 0.1, SETTLE_SPIN = 0.025, SETTLE_FRAMES = 15;
            const landingScale = Math.max(0.35, 1 / Math.sqrt(specs.length));

            const dice = specs.map(spec => {
              const startX = originX + (Math.random() - 0.5) * radius * 1.4;
              const startY = originY + (Math.random() - 0.5) * radius * 1.4;
              const die = makeGiantDie(spec.sides, material, radius);
              die.x = startX; die.y = startY; die.alpha = 1;
              app.stage.addChild(die);

              const body = Matter.Bodies.circle(startX, startY, radius * 0.92, {
                restitution, friction: 0.06, frictionAir: weightP.frictionAir, density: weightP.density
              });
              const throwAngle = Math.random() * Math.PI * 2;
              const throwSpeed = (16 + Math.random() * 9) * weightP.speedMul;
              Matter.Body.setVelocity(body, { x: Math.cos(throwAngle) * throwSpeed, y: Math.sin(throwAngle) * throwSpeed });
              Matter.Body.setAngularVelocity(body, (Math.random() > 0.5 ? 1 : -1) * (0.25 + Math.random() * 0.25) * weightP.spinMul);
              Matter.World.add(engine.world, body);

              return { spec, die, body, settled:false, slowFrames:0, trailAccum: Math.random() * trailIntervalMs };
            });

            function onCollision(event){
              const involvesADie = event.pairs.some(p =>
                dice.some(d => !d.settled && (p.bodyA === d.body || p.bodyB === d.body))
              );
              if(!involvesADie) return;
              if(elapsed - lastImpactMs < 60) return;
              lastImpactMs = elapsed;
              DiceSoundFX.play(material.soundId, 0.7);
            }
            Matter.Events.on(engine, 'collisionStart', onCollision);

            const totalLabel = makeResultLabel();
            totalLabel.alpha = 0;
            totalLabel.anchor.set(0.5, 0.5);
            app.stage.addChild(totalLabel);

            function cleanupWorld(){
              Matter.Events.off(engine, 'collisionStart', onCollision);
              Matter.World.clear(engine.world);
              Matter.Engine.clear(engine);
            }

            function tick(){
              elapsed += app.ticker.deltaMS;
              Matter.Engine.update(engine, app.ticker.deltaMS);

              let allSettled = true;
              dice.forEach(d => {
                d.die.x = d.body.position.x;
                d.die.y = d.body.position.y;
                d.die.rotation = d.body.angle;

                if(d.settled){ return; }
                allSettled = false;
                d.die._text.text = String(1 + Math.floor(Math.random() * d.spec.sides));

                d.trailAccum += app.ticker.deltaMS;
                if(d.trailAccum >= trailIntervalMs){
                  d.trailAccum = 0;
                  spawnTrailParticle(trailContainer, trail, d.die.x, d.die.y);
                }

                const speed = Matter.Vector.magnitude(d.body.velocity);
                const spin = Math.abs(d.body.angularVelocity);
                if(speed < SETTLE_SPEED && spin < SETTLE_SPIN){ d.slowFrames++; } else { d.slowFrames = 0; }

                if(d.slowFrames >= SETTLE_FRAMES || elapsed > maxDurationMs){
                  d.settled = true;
                  Matter.Body.setStatic(d.body, true);
                  d.die._text.text = String(d.spec.finalValue);
                  if(!d.spec.used) d.die.alpha = 0.35;
                  spawnLandingEffect(landingEffectKind(material, trail), d.die.x, d.die.y, material, trail, landingScale);
                  DiceSoundFX.play(material.soundId, 0.6);
                } else {
                  allSettled = false;
                }
              });

              if(allSettled){
                app.ticker.remove(tick);
                cleanupWorld();

                const avgX = dice.reduce((sum, d) => sum + d.die.x, 0) / dice.length;
                const minY = Math.min(...dice.map(d => d.die.y));
                totalLabel.text = totalText;
                totalLabel.style.fill = 0xffffff;
                totalLabel.x = Math.min(Math.max(avgX, 60), w - 60);
                totalLabel.y = Math.max(minY - radius - 34, 30);
                totalLabel.alpha = 1;
                spawnParticles(totalLabel.x, totalLabel.y, 0xffffff, 10);

                onSettled();
                fadeOutAndClear([...dice.map(d => d.die), totalLabel], 1300);
              }
            }
            app.ticker.add(tick);
          }catch(err){
            console.warn('Multi-dice physics roll failed, falling back:', err);
            ready = false;
            onSettled();
          }
        }

        return { init, isReady, rollGiantDie, rollMultiDice };
      })();

