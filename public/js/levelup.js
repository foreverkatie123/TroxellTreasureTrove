// Level-up walkthrough for the player sheet.
// Needs window.DND, window.WZ (wizard-data.js, for subclass lists/spell lists), window.UI and window.PlayerApp.
// Shows what the character gets at the new level, then lets the player choose: hit points, subclass,
// ability score improvement / feat, and new spells. Nothing is applied until "Level up!" is confirmed.
(function(){
  const DND = window.DND, WZ = window.WZ;
  const AB = DND.ABILITIES, AB_NAME = DND.ABILITY_LABELS;
  const mod = s => Math.floor((s - 10) / 2);
  const sgn = n => n >= 0 ? '+' + n : String(n);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $ = (sel, root) => (root || document).querySelector(sel);

  let L = null;     // working state for this level-up
  let stepIdx = 0;

  const ASI_LEVELS = { _: [4,8,12,16,19], Fighter: [4,6,8,12,14,16,19], Rogue: [4,8,10,12,16,19] };
  const asiLevels = cls => ASI_LEVELS[cls] || ASI_LEVELS._;

  function sheet(){ return PlayerApp.getSheet(); }
  const hasFeat = n => (sheet().feats || []).some(f => String(f.name).toLowerCase().startsWith(n));

  // ---------- facts about the new level ----------
  function facts(){
    const s = sheet(), cls = s.class, from = s.level, to = from + 1;
    const out = { cls, from, to };
    out.pbFrom = PlayerApp.profBonus(from); out.pbTo = PlayerApp.profBonus(to);
    out.features = (DND.CLASS_FEATURES[cls] || []).filter(f => f[0] === to);
    out.hitDie = DND.CLASS_HIT_DIE[cls] || 8;
    out.hasAsi = asiLevels(cls).includes(to);
    const subLvl = WZ.subclassLevel(cls, s.ruleset);
    out.needsSub = !s.subclass && to >= subLvl && (WZ.SUBCLASSES_2024[cls] || DND.SUBCLASSES[cls] || []).length > 0;
    // "choose N from a list" features (e.g. Warlock invocations)
    const rs = s.ruleset === '2014' ? '2014' : '2024';
    out.newChoices = WZ.choiceSetsFor(cls).map(set => ({ set, rs, n: Math.max(0, set.known(to, rs) - Math.max(set.known(from, rs), (s.choices && s.choices[set.id] ? s.choices[set.id].length : 0))) })).filter(x => x.n > 0);
    // spells
    const style = WZ.CASTER_STYLE[cls];
    out.style = style;
    const cT = DND.CANTRIPS_KNOWN[cls] || [], kT = DND.SPELLS_KNOWN[cls] || [];
    out.newCantrips = cT.length ? Math.max(0, (cT[to-1] || 0) - (cT[from-1] || 0)) : 0;
    out.newKnown = style === 'known' ? Math.max(0, (kT[to-1] || 0) - (kT[from-1] || 0)) : style === 'book' ? 2 : 0;
    out.slotsFrom = PlayerApp.slotRowsFor(cls, from);
    out.slotsTo = PlayerApp.slotRowsFor(cls, to);
    out.maxSpellLvl = out.slotsTo && out.slotsTo.rows.length ? Math.max(...out.slotsTo.rows.map(r => r.lvl)) : 0;
    out.casts = !!style && out.maxSpellLvl > 0;
    const conMod = mod(s.stats.con);
    out.conMod = conMod;
    // flat bonus hit points per level
    out.bonusHp = 0; out.bonusWhy = [];
    if(s.race === 'Dwarf (Hill)' || (s.race === 'Dwarf' && s.ruleset !== '2014')){ out.bonusHp += 1; out.bonusWhy.push('Dwarven Toughness +1'); }
    if(hasFeat('tough')){ out.bonusHp += 2; out.bonusWhy.push('Tough feat +2'); }
    if(/draconic/i.test(s.subclass || '')){ out.bonusHp += 1; out.bonusWhy.push('Draconic resilience +1'); }
    return out;
  }
  const avgHp = F => Math.floor(F.hitDie / 2) + 1;
  const hpGain = F => Math.max(1, (L.hp.value != null ? L.hp.value : 0) + F.conMod) + F.bonusHp;

  function steps(F){
    const st = ['overview', 'hp'];
    if(F.needsSub) st.push('subclass');
    if(F.hasAsi) st.push('asi');
    if(F.newChoices.length) st.push('choices');
    if(F.casts && (F.newCantrips || F.newKnown || F.style)) st.push('spells');
    st.push('review');
    return st;
  }
  const TITLES = { overview:'What you gain', hp:'Hit points', subclass:'Choose your subclass', asi:'Ability Score Improvement', choices:'New choices', spells:'New spells', review:'Ready to level up?' };

  // ---------- screen shell ----------
  const root = () => $('#levelUpScreen');
  function render(){
    const F = facts(), list = steps(F);
    if(stepIdx >= list.length) stepIdx = list.length - 1;
    const key = list[stepIdx];
    const pct = Math.round(stepIdx / (list.length - 1) * 100);
    root().innerHTML = `
      <div class="wzTop">
        <button class="wzX" id="luCancel" aria-label="Cancel">✕</button>
        <div class="wzProg"><div class="wzProgBar" style="width:${pct}%"></div></div>
        <div class="wzStepNum">${stepIdx + 1}/${list.length}</div>
      </div>
      <div class="luBadge">Level ${F.from} → ${F.to} · ${esc(F.cls)}</div>
      <h2 class="wzTitle">${TITLES[key]}</h2>
      <div id="luBody" class="wzBody"></div>
      <div class="wzNav">
        <button class="btn wzBack" id="luBack" ${stepIdx === 0 ? 'style="visibility:hidden"' : ''}>← Back</button>
        <button class="btn primary wzNext" id="luNext">${key === 'review' ? '⬆ Level up!' : 'Next →'}</button>
      </div>
      <div class="wzHint" id="luHint"></div>`;
    $('#luCancel').onclick = cancel;
    $('#luBack').onclick = () => { stepIdx = Math.max(0, stepIdx - 1); render(); window.scrollTo(0, 0); };
    $('#luNext').onclick = () => {
      const why = invalid(key, F);
      if(why){ $('#luHint').textContent = why; return; }
      if(key === 'review') return apply(F);
      stepIdx++; render(); window.scrollTo(0, 0);
    };
    BUILD[key]($('#luBody'), F);
    refresh();
  }
  function refresh(){
    const F = facts(), key = steps(F)[stepIdx], why = invalid(key, F);
    const n = $('#luNext'); if(n) n.classList.toggle('disabled', !!why);
    const h = $('#luHint'); if(h) h.textContent = why || '';
  }
  async function cancel(){
    if(!(await UI.confirm('Nothing has been changed yet.', { title:'Cancel level up?', ok:'Cancel level up', cancel:'Keep going' }))) return;
    PlayerApp.show('charSheetScreen');
  }

  function invalid(key, F){
    if(key === 'hp') return hpReady() ? '' : (L.hp.mode === 'table' ? 'Enter the number you rolled.' : 'Choose how to gain hit points.');
    if(key === 'subclass') return L.sub ? '' : 'Pick a subclass to continue.';
    if(key === 'choices'){ for(const c of F.newChoices){ const have = (L.choices[c.set.id] || []).length; if(have < c.n) return `Pick ${c.n - have} more ${c.set.noun}${c.n - have > 1 ? 's' : ''}.`; } return ''; }
    if(key === 'asi'){
      if(L.asi.mode === 'feat'){
        if(L.asi.custom) return L.asi.customName.trim() ? '' : 'Type the name of your feat.';
        if(L.asi.feat === '' || L.asi.feat == null) return 'Pick a feat.';
        const ft = DND.FEATS[L.asi.feat];
        if(ft && ft.asi && ft.asi.choose.length > 1 && !L.asi.featAb) return 'Choose which ability the feat increases.';
        return '';
      }
      const s = sheet();
      if(L.asi.mode === 'two'){ const a = L.asi.a; if(!a) return 'Pick an ability for +2.'; if((s.stats[a] || 10) + 2 > 20) return AB_NAME[a] + ' can\'t go above 20.'; return ''; }
      if(L.asi.mode === 'split'){
        const a = L.asi.a, b = L.asi.b;
        if(!a || !b) return 'Pick two different abilities for +1 each.';
        if(a === b) return 'Pick two different abilities.';
        if((s.stats[a] || 10) + 1 > 20 || (s.stats[b] || 10) + 1 > 20) return 'Scores can\'t go above 20.';
        return '';
      }
      return 'Choose an option.';
    }
    return '';
  }

  const BUILD = {};

  BUILD.overview = (body, F) => {
    const s = sheet();
    const slotTxt = r => r && r.rows.length ? r.rows.map(x => `L${x.lvl}×${x.count}`).join(' ') : '—';
    let h = `<p class="wzLead"><b>${esc(s.name || 'Your character')}</b> is about to reach <b>level ${F.to}</b>. Here's what changes:</p>
      <div class="wzInfo"><b>Always</b><p>• Hit points: roll or take the average (next step)<br>• Hit Dice: ${F.from} → ${F.to} (d${F.hitDie})</p>
      ${F.pbTo !== F.pbFrom ? `<p>• <b>Proficiency bonus goes up:</b> +${F.pbFrom} → <b>+${F.pbTo}</b> (affects attacks, saves, skills, spell DC)</p>` : `<p>• Proficiency bonus stays +${F.pbTo}</p>`}</div>`;
    h += `<div class="wzInfo"><b>New ${esc(F.cls)} features at level ${F.to}</b>` + (F.features.length
      ? F.features.map(f => `<p><b>${esc(f[1])}.</b> ${esc(f[2])}</p>`).join('')
      : '<p>No new class features listed at this level. (Subclass features arrive with your subclass — check your book or your DM.)</p>') + '</div>';
    if(F.hasAsi) h += `<div class="wzInfo"><b>Ability Score Improvement</b><p>Raise your ability scores or take a feat — you'll choose in a moment.</p></div>`;
    F.newChoices.forEach(c => { h += `<div class="wzInfo"><b>${esc(c.set.label)}</b><p>You learn <b>${c.n}</b> new ${esc(c.set.noun)}${c.n > 1 ? 's' : ''}.</p></div>`; });
    if(F.needsSub) h += `<div class="wzInfo"><b>Subclass</b><p>${esc(F.cls)}s choose a subclass by level ${WZ.subclassLevel(F.cls, s.ruleset)}. You'll pick yours now.</p></div>`;
    if(F.slotsTo) h += `<div class="wzInfo"><b>Spell slots</b><p>${slotTxt(F.slotsFrom)} → <b>${slotTxt(F.slotsTo)}</b>${F.maxSpellLvl > (F.slotsFrom && F.slotsFrom.rows.length ? Math.max(...F.slotsFrom.rows.map(r => r.lvl)) : 0) ? `<br><b>You can now cast level ${F.maxSpellLvl} spells!</b>` : ''}</p></div>`;
    if(s.ruleset === '2024') h += '<p class="wzNote">The feature text above is the classic list. Check your 2024 class page on the Features tab for the newest wording.</p>';
    body.innerHTML = h;
  };

  BUILD.hp = (body, F) => {
    const avg = avgHp(F);
    const gainAvg = Math.max(1, avg + F.conMod) + F.bonusHp;
    body.innerHTML = `<p class="wzLead">Your hit die is <b>d${F.hitDie}</b>. Your Constitution modifier is <b>${sgn(F.conMod)}</b>${F.bonusWhy.length ? ' and you also get ' + F.bonusWhy.map(esc).join(', ') : ''}.</p>
      <div class="wzTwo">
        <button class="wzChoice ${L.hp.mode === 'avg' ? 'sel' : ''}" data-m="avg"><b>Take the average</b><span>${avg} → <b>+${gainAvg} HP</b> (safe)</span></button>
        <button class="wzChoice ${L.hp.mode === 'roll' ? 'sel' : ''}" data-m="roll"><b>🎲 Roll d${F.hitDie}</b><span>${L.hp.mode === 'roll' && L.hp.value != null ? 'You rolled <b>' + L.hp.value + '</b> → +' + hpGain(F) + ' HP' : 'Could be better — or worse'}</span></button>
      </div>
      <label class="wzCheck" style="margin-top:12px"><input type="checkbox" id="luTable" ${L.hp.mode === 'table' ? 'checked' : ''}> I rolled at the table — enter my roll</label>
      <div id="luTableBox" class="${L.hp.mode === 'table' ? '' : 'hidden'}"><input type="number" inputmode="numeric" id="luTableVal" min="1" max="${F.hitDie}" placeholder="1–${F.hitDie}" value="${L.hp.mode === 'table' && L.hp.value ? L.hp.value : ''}"></div>
      <div class="wzInfo"><b>Result</b><p>${L.hp.mode ? 'Max HP <b>' + sheet().hp_max + '</b> → <b>' + (sheet().hp_max + hpGain(F)) + '</b> (+' + hpGain(F) + ')' : 'Pick an option above.'}<br><span class="wzDim">Minimum +1 per level before bonuses.</span></p></div>`;
    body.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
      if(b.dataset.m === 'avg') L.hp = { mode:'avg', value:avg };
      else L.hp = { mode:'roll', value:1 + Math.floor(Math.random() * F.hitDie) };
      BUILD.hp(body, F); refresh();
    });
    $('#luTable', body).onchange = e => {
      if(e.target.checked) L.hp = { mode:'table', value:null }; else L.hp = { mode:null, value:null };
      BUILD.hp(body, F); refresh();
    };
    const tv = $('#luTableVal', body);
    if(tv) tv.oninput = () => { const v = parseInt(tv.value, 10); L.hp = { mode:'table', value: v >= 1 && v <= F.hitDie ? v : null }; if(L.hp.value == null) L.hp.mode = 'table'; refresh();
      const info = body.querySelector('.wzInfo p'); if(info) info.innerHTML = L.hp.value ? 'Max HP <b>' + sheet().hp_max + '</b> → <b>' + (sheet().hp_max + hpGain(F)) + '</b> (+' + hpGain(F) + ')' : 'Enter a number from 1 to ' + F.hitDie + '.'; };
  };
  const hpReady = () => L.hp.mode && L.hp.value != null;

  BUILD.subclass = (body, F) => {
    const s = sheet();
    const list = s.ruleset === '2014' ? (DND.SUBCLASSES[F.cls] || []) : (WZ.SUBCLASSES_2024[F.cls] || DND.SUBCLASSES[F.cls] || []);
    body.innerHTML = `<p class="wzLead">Your subclass shapes how your ${esc(F.cls)} plays from here on:</p>
      <div class="wzGrid">${list.map(n => `<div class="wzCard ${L.sub === n ? 'sel' : ''}" data-s="${esc(n)}"><b>${esc(n)}</b><div class="wzTag">${esc(WZ.subBlurb(n) || 'See your book or DM for details.')}</div></div>`).join('')}</div>
      <label>Not listed? Type it</label><input type="text" id="luSubText" placeholder="Custom / homebrew subclass" value="${list.includes(L.sub) ? '' : esc(L.sub || '')}">`;
    body.querySelectorAll('[data-s]').forEach(c => c.onclick = () => { L.sub = c.dataset.s; BUILD.subclass(body, F); refresh(); });
    $('#luSubText', body).oninput = e => { L.sub = e.target.value.trim(); body.querySelectorAll('[data-s]').forEach(x => x.classList.remove('sel')); refresh(); };
  };

  BUILD.asi = (body, F) => {
    const s = sheet(), a = L.asi;
    const abSel = (id, val, exclude) => `<select id="${id}"><option value="">— choose —</option>${AB.map(x => `<option value="${x}" ${val === x ? 'selected' : ''} ${(s.stats[x] || 10) >= 20 ? 'disabled' : ''}>${AB_NAME[x]} (${s.stats[x] || 10}${(s.stats[x] || 10) >= 20 ? ', max' : ''})</option>`).join('')}</select>`;
    let h = `<p class="wzLead">Pick one:</p><div class="wzTwo" style="grid-template-columns:1fr">
      <button class="wzChoice ${a.mode === 'two' ? 'sel' : ''}" data-mode="two"><b>+2 to one ability</b></button>
      <button class="wzChoice ${a.mode === 'split' ? 'sel' : ''}" data-mode="split"><b>+1 to two abilities</b></button>
      <button class="wzChoice ${a.mode === 'feat' ? 'sel' : ''}" data-mode="feat"><b>Take a feat instead</b><span>A special talent — some also give +1 to an ability</span></button></div>`;
    if(a.mode === 'two') h += `<div class="wzInfo"><b>+2 to</b><div class="wzPickRow">${abSel('luA', a.a)}</div></div>`;
    if(a.mode === 'split') h += `<div class="wzInfo"><b>+1 to each</b><div class="wzPickRow">${abSel('luA', a.a)}</div><div class="wzPickRow">${abSel('luB', a.b)}</div></div>`;
    if(a.mode === 'feat'){
      h += `<div class="wzInfo"><b>Feat</b><div class="wzPickRow"><select id="luFeat"><option value="">— choose —</option>${DND.FEATS.map((f, i) => `<option value="${i}" ${String(a.feat) === String(i) && !a.custom ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}<option value="custom" ${a.custom ? 'selected' : ''}>Other (type it)…</option></select></div>`;
      if(a.custom) h += `<div class="wzPickRow"><input type="text" id="luFeatName" placeholder="Feat name" value="${esc(a.customName)}"></div><div class="wzPickRow"><input type="text" id="luFeatDesc" placeholder="What it does (optional)" value="${esc(a.customDesc)}"></div>`;
      else if(a.feat !== '' && a.feat != null){
        const ft = DND.FEATS[a.feat];
        h += `<p>${esc(ft.desc)}</p>`;
        if(ft.asi && ft.asi.choose.length > 1) h += `<p>+${ft.asi.amount} to:</p><div class="chipRow">${ft.asi.choose.map(x => `<button class="chip ${a.featAb === x ? 'selected' : ''}" data-fab="${x}">${AB_NAME[x]}</button>`).join('')}</div>`;
        else if(ft.asi) h += `<p class="wzDim">Also gives +${ft.asi.amount} ${AB_NAME[ft.asi.choose[0]]}.</p>`;
      }
      h += '</div>';
    }
    body.innerHTML = h;
    body.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { a.mode = b.dataset.mode; BUILD.asi(body, F); refresh(); });
    const A = $('#luA', body), B = $('#luB', body);
    if(A) A.onchange = () => { a.a = A.value; refresh(); };
    if(B) B.onchange = () => { a.b = B.value; refresh(); };
    const ft = $('#luFeat', body);
    if(ft) ft.onchange = () => { if(ft.value === 'custom'){ a.custom = true; a.feat = null; } else { a.custom = false; a.feat = ft.value; a.featAb = ''; const f = DND.FEATS[ft.value]; if(f && f.asi && f.asi.choose.length === 1) a.featAb = f.asi.choose[0]; } BUILD.asi(body, F); refresh(); };
    body.querySelectorAll('[data-fab]').forEach(c => c.onclick = () => { a.featAb = c.dataset.fab; BUILD.asi(body, F); refresh(); });
    const fn = $('#luFeatName', body), fd = $('#luFeatDesc', body);
    if(fn) fn.oninput = () => { a.customName = fn.value; refresh(); };
    if(fd) fd.oninput = () => { a.customDesc = fd.value; };
  };

  BUILD.choices = (body, F) => {
    const s = sheet();
    let h = '';
    F.newChoices.forEach(c => {
      const mine = L.choices[c.set.id] = L.choices[c.set.id] || [];
      const already = new Set(s.choices && s.choices[c.set.id] || []);
      h += `<p class="wzLead"><b>${esc(c.set.label)}</b> — choose <b>${c.n}</b> <span class="wzCount">(${mine.length}/${c.n})</span></p>
        <div class="wzGrid">${c.set.options(c.rs).filter(o => !already.has(o.n)).map(o => {
          const sel = mine.includes(o.n), low = o.min > F.to;
          return `<div class="wzCard ${sel ? 'sel' : ''}" data-set="${esc(c.set.id)}" data-n="${esc(o.n)}"><div class="wzCardTop"><b>${esc(o.n)}</b>${o.min > 1 || o.req ? `<span class="wzDiff ${low ? 'd3' : 'd2'}">${[o.min > 1 ? 'Lvl ' + o.min : '', o.req].filter(Boolean).map(esc).join(' · ')}</span>` : ''}</div><div class="wzTag">${esc(o.b)}</div></div>`;
        }).join('')}</div>`;
    });
    h += '<p class="wzNote">Prerequisites shown are a guide — confirm them in your book or with your DM. Want to swap an old one for a new one? Do that on the Features tab.</p>';
    body.innerHTML = h;
    body.querySelectorAll('[data-set]').forEach(card => card.onclick = () => {
      const c = F.newChoices.find(x => x.set.id === card.dataset.set), mine = L.choices[c.set.id], n = card.dataset.n;
      const i = mine.indexOf(n); if(i >= 0) mine.splice(i, 1); else if(mine.length < c.n) mine.push(n); else return;
      const y = window.scrollY; BUILD.choices(body, F); window.scrollTo(0, y); refresh();
    });
  };

  // ---------- spell search (Open5e, with built-in fallback) ----------
  let spellCache = null, spellLoading = false, spellFailed = false;
  function loadSpells(cb){
    if(spellCache || spellLoading) return;
    spellLoading = true;
    PlayerApp.liveSpells().then(list => { spellCache = list.length > 20 ? list : null; if(!spellCache) spellFailed = true; })
      .catch(() => { spellFailed = true; })
      .then(() => {
        if(!spellCache){ spellCache = Object.keys(WZ.SPELLS).map(n => ({ name:n, level:WZ.SPELLS[n][0], school:'', classes:[], desc:WZ.SPELLS[n][1] })); }
        spellLoading = false; cb();
      });
  }
  function mountSpellSearch(host, F, have){
    let q = '', lvl = 'all', mineOnly = false;
    const clsKey = F.cls.toLowerCase();
    host.innerHTML = `<h3 class="wzH">Search all spells</h3>
      <input type="text" id="luQ" placeholder="Search by name…" autocomplete="off">
      <div class="wzFilters" id="luLv" style="margin-top:8px"></div>
      <label class="wzCheck hidden" id="luMineWrap"><input type="checkbox" id="luMine"> Only my class's spell list</label>
      <div id="luNote" class="wzNote"></div><div id="luRes" class="wzShopList"></div>`;
    const draw = () => {
      const lvls = ['all', ...Array.from({ length: F.maxSpellLvl + 1 }, (_, i) => i)];
      $('#luLv', host).innerHTML = lvls.map(v => `<button class="chip ${String(lvl) === String(v) ? 'selected' : ''}" data-l="${v}">${v === 'all' ? 'All' : v === 0 ? 'Cantrip' : 'Lv ' + v}</button>`).join('');
      $('#luLv', host).querySelectorAll('[data-l]').forEach(b => b.onclick = () => { lvl = b.dataset.l; draw(); });
      const note = $('#luNote', host), res = $('#luRes', host);
      if(!spellCache){ note.textContent = 'Loading spells from Open5e…'; res.innerHTML = ''; return; }
      const hasClassData = spellCache.some(x => x.classes && x.classes.includes(clsKey));
      $('#luMineWrap', host).classList.toggle('hidden', !hasClassData);
      note.textContent = spellFailed ? 'Couldn\'t reach Open5e — showing a short built-in list. Use "Add a spell by name" below for anything else.' : '';
      const taken = n => have.has(n.toLowerCase()) || L.extra.some(x => x.name.toLowerCase() === n.toLowerCase());
      const ql = q.trim().toLowerCase();
      const list = spellCache.filter(x => x.level <= F.maxSpellLvl && (lvl === 'all' || x.level === +lvl) && (!ql || x.name.toLowerCase().includes(ql)) && (!mineOnly || !hasClassData || x.classes.includes(clsKey)) && !taken(x.name))
        .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)).slice(0, 30);
      res.innerHTML = list.length ? list.map(x => `<div class="wzShopRow"><div class="wzShopName"><b>${esc(x.name)}</b><small>${x.level === 0 ? 'Cantrip' : 'Level ' + x.level}${x.school ? ' · ' + esc(x.school) : ''}</small></div><button class="wzAdd" data-add="${esc(x.name)}" data-lv="${x.level}">＋</button></div>`).join('') : '<p class="wzDim">No matches.</p>';
      res.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { L.extra.push({ name:b.dataset.add, level:+b.dataset.lv }); const y = window.scrollY; BUILD.spells($('#luBody'), F); window.scrollTo(0, y); });
    };
    $('#luQ', host).oninput = e => { q = e.target.value; draw(); };
    $('#luMine', host).onchange = e => { mineOnly = e.target.checked; draw(); };
    draw();
    loadSpells(() => { if(host.isConnected) draw(); });
  }

  BUILD.spells = (body, F) => {
    const s = sheet(), lists = WZ.SPELL_LISTS[F.cls] || { cantrips:[], l1:[] };
    const have = new Set((s.spells || []).map(x => x.name.toLowerCase()));
    const sp = n => WZ.SPELLS[n] || [0, ''];
    const row = (n, group, sel) => `<div class="wzSpell ${sel ? 'sel' : ''}" data-g="${group}" data-n="${esc(n)}"><div><b>${esc(n)}</b></div><small>${esc(sp(n)[1])}</small></div>`;
    const cList = lists.cantrips.filter(n => !have.has(n.toLowerCase())), lList = lists.l1.filter(n => !have.has(n.toLowerCase()));
    const prepCap = F.style === 'prepared' || F.style === 'halfprep' || F.style === 'book' ? PlayerApp.preparedMax(F.cls, F.to, mod(s.stats[DND.SPELLCASTING_ABILITY[F.cls]] || 10)) : null;
    let h = `<p class="wzLead">You can now cast spells up to <b>level ${F.maxSpellLvl}</b>.</p>`;
    h += `<div class="wzInfo"><b>What you can learn</b><p>`
      + (F.newCantrips ? `• <b>${F.newCantrips}</b> new cantrip${F.newCantrips > 1 ? 's' : ''}<br>` : '')
      + (F.style === 'known' ? (F.newKnown ? `• <b>${F.newKnown}</b> new spell${F.newKnown > 1 ? 's' : ''} known (you may also swap one old spell for a new one — do that on the Spells tab)<br>` : '• No new spells known this level (you may swap one on the Spells tab)<br>') : '')
      + (F.style === 'book' ? '• <b>2</b> new spells in your spellbook<br>' : '')
      + ((F.style === 'prepared' || F.style === 'halfprep' || F.style === 'book') && prepCap ? `• You can prepare up to <b>${prepCap}</b> spells each day` : '')
      + (F.style === 'prepared' ? '<br>• You have access to your whole class list — just prepare different ones on the Spells tab' : '')
      + `</p></div>`;
    if(F.newCantrips){ h += `<h3 class="wzH">Cantrips <span class="wzCount">${L.cantrips.length}/${F.newCantrips}</span></h3><div class="wzSpellGrid">${cList.map(n => row(n, 'c', L.cantrips.includes(n))).join('') || '<p class="wzDim">No more starter cantrips in the list — add one below.</p>'}</div>`; }
    if(F.newKnown){ h += `<h3 class="wzH">Level 1 spells <span class="wzCount">${L.l1.length}/${F.newKnown}</span></h3><p class="wzDim">Spells of level 2 and up aren't in the quick list — add them by name below.</p><div class="wzSpellGrid">${lList.map(n => row(n, 'l', L.l1.includes(n))).join('')}</div>`; }
    h += '<div id="luSearchHost"></div>';
    h += `<h3 class="wzH">Add a spell by name</h3><div class="addRow"><input type="text" id="luSpName" class="addName" placeholder="Spell name"><select id="luSpLvl" class="addLevel">${[0,1,2,3,4,5,6,7,8,9].filter(x => x <= F.maxSpellLvl).map(x => `<option value="${x}">${x === 0 ? 'Cantrip' : 'Level ' + x}</option>`).join('')}</select><button class="btn small" id="luSpAdd">+ Add</button></div>`;
    if(L.extra.length) h += `<div class="wzShopList" style="margin-top:8px">${L.extra.map((x, i) => `<div class="wzShopRow"><div class="wzShopName"><b>${esc(x.name)}</b><small>${x.level === 0 ? 'Cantrip' : 'Level ' + x.level}</small></div><button class="wzAdd" data-rm="${i}" style="background:#0d1318;color:var(--text)">✕</button></div>`).join('')}</div>`;
    h += '<p class="wzNote">You can skip any of this and add spells later on the Spells tab.</p>';
    body.innerHTML = h;
    body.querySelectorAll('.wzSpell').forEach(c => c.onclick = () => {
      const n = c.dataset.n, list = c.dataset.g === 'c' ? L.cantrips : L.l1, max = c.dataset.g === 'c' ? F.newCantrips : F.newKnown;
      const i = list.indexOf(n); if(i >= 0) list.splice(i, 1); else if(list.length < max) list.push(n); else return;
      const y = window.scrollY; BUILD.spells(body, F); window.scrollTo(0, y);
    });
    $('#luSpAdd', body).onclick = () => {
      const n = $('#luSpName', body).value.trim(); if(!n) return;
      L.extra.push({ name:n, level:parseInt($('#luSpLvl', body).value, 10) || 0 });
      const y = window.scrollY; BUILD.spells(body, F); window.scrollTo(0, y);
    };
    body.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { L.extra.splice(+b.dataset.rm, 1); BUILD.spells(body, F); });
    mountSpellSearch($('#luSearchHost', body), F, have);
  };

  BUILD.review = (body, F) => {
    const s = sheet(), gain = hpGain(F), ch = [];
    ch.push(`<b>Max HP</b> ${s.hp_max} → ${s.hp_max + gain} (+${gain})`);
    if(F.pbTo !== F.pbFrom) ch.push(`<b>Proficiency bonus</b> +${F.pbFrom} → +${F.pbTo}`);
    if(L.sub) ch.push(`<b>Subclass</b> ${esc(L.sub)}`);
    if(F.hasAsi){
      const a = L.asi;
      if(a.mode === 'two') ch.push(`<b>${AB_NAME[a.a]}</b> ${s.stats[a.a]} → ${s.stats[a.a] + 2}`);
      if(a.mode === 'split') ch.push(`<b>${AB_NAME[a.a]}</b> ${s.stats[a.a]} → ${s.stats[a.a] + 1}<br><b>${AB_NAME[a.b]}</b> ${s.stats[a.b]} → ${s.stats[a.b] + 1}`);
      if(a.mode === 'feat') ch.push(`<b>Feat</b> ${esc(a.custom ? a.customName : DND.FEATS[a.feat].name)}${a.featAb ? ' (+' + DND.FEATS[a.feat].asi.amount + ' ' + AB_NAME[a.featAb] + ')' : ''}`);
    }
    F.newChoices.forEach(c => { const m = L.choices[c.set.id] || []; if(m.length) ch.push(`<b>${esc(c.set.label)}</b> ${m.map(esc).join(', ')}`); });
    const newSp = [...L.cantrips.map(n => n + ' (cantrip)'), ...L.l1.map(n => n + ' (lvl 1)'), ...L.extra.map(x => x.name + (x.level ? ' (lvl ' + x.level + ')' : ' (cantrip)'))];
    if(newSp.length) ch.push(`<b>New spells</b> ${newSp.map(esc).join(', ')}`);
    if(F.features.length) ch.push(`<b>New features</b> ${F.features.map(f => esc(f[1])).join(', ')}`);
    body.innerHTML = `<div class="wzSummary"><div class="wzSumName">${esc(s.name)}</div><div class="wzSumSub">Level ${F.from} → ${F.to} ${esc(F.cls)}</div>${ch.map(c => `<p style="margin:6px 0;font-size:13.5px">${c}</p>`).join('')}</div>
      <p class="wzNote">This saves to your character right away. Spell slots, Hit Dice and features update automatically.</p>`;
  };

  // ---------- apply ----------
  function apply(F){
    const s = sheet(), gain = hpGain(F);
    s.level = F.to;
    s.hp_max = (s.hp_max || 0) + gain;
    s.hp_current = Math.min(s.hp_max, (s.hp_current || 0) + gain);
    if(L.sub && F.needsSub) s.subclass = L.sub;
    if(F.hasAsi){
      const a = L.asi;
      if(a.mode === 'two') s.stats[a.a] = Math.min(20, (s.stats[a.a] || 10) + 2);
      if(a.mode === 'split'){ s.stats[a.a] = Math.min(20, (s.stats[a.a] || 10) + 1); s.stats[a.b] = Math.min(20, (s.stats[a.b] || 10) + 1); }
      if(a.mode === 'feat'){
        if(a.custom) s.feats.push({ name:a.customName.trim(), desc:a.customDesc || '' });
        else {
          const ft = DND.FEATS[a.feat];
          if(a.featAb && ft.asi) s.stats[a.featAb] = Math.min(20, (s.stats[a.featAb] || 10) + ft.asi.amount);
          s.feats.push({ name: a.featAb && ft.asi ? `${ft.name} (+${ft.asi.amount} ${AB_NAME[a.featAb]})` : ft.name, desc: ft.desc });
        }
      }
    }
    s.choices = s.choices || {};
    Object.keys(L.choices).forEach(id => { s.choices[id] = [...(s.choices[id] || []), ...L.choices[id]]; });
    const prepAuto = !['Cleric','Druid','Paladin','Wizard','Artificer'].includes(F.cls);
    L.cantrips.forEach(n => s.spells.push({ name:n, level:0, prepared:true }));
    L.l1.forEach(n => s.spells.push({ name:n, level:1, prepared:prepAuto }));
    L.extra.forEach(x => s.spells.push({ name:x.name, level:x.level, prepared: x.level === 0 || prepAuto }));
    PlayerApp.renderAll();
    PlayerApp.show('charSheetScreen');
    const tab = document.querySelector('#sheetTabBar [data-tab="features"]'); if(tab) tab.click();
    PlayerApp.persistSheet().then(() => UI.toast('Level ' + F.to + '! Saved ✓')).catch(err => UI.alert(err.message + '\n\nYour level up is on screen — tap Save to try again.', { title:'Couldn\'t save yet' }));
  }

  // ---------- entry ----------
  function start(){
    const s = sheet();
    if(!s) return;
    if(!s.class){ UI.alert('Pick a class on the Core tab first, then level up.', { title:'Choose a class' }); return; }
    if((s.level || 1) >= 20){ UI.alert('Level 20 is the top. Nothing further to level up!', { title:'Max level' }); return; }
    L = { choices:{}, hp:{ mode:null, value:null }, sub:'', asi:{ mode:null, a:'', b:'', feat:null, featAb:'', custom:false, customName:'', customDesc:'' }, cantrips:[], l1:[], extra:[] };
    stepIdx = 0;
    PlayerApp.show('levelUpScreen');
    render(); window.scrollTo(0, 0);
  }
  document.addEventListener('DOMContentLoaded', () => {
    const b = document.getElementById('levelUpBtn');
    if(b) b.addEventListener('click', start);
  });
  window.LevelUp = { start };

  const css = `.luBadge{ display:inline-block; font-size:12px; color:var(--accent-bright); border:1px solid var(--border); border-radius:20px; padding:3px 12px; margin-top:2px; }`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
})();