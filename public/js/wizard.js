// Guided character creator for the player page.
// Needs: window.DND (dnd-data.js), window.WZ (wizard-data.js) and window.PlayerApp (set up in index.html).
// One decision per screen, big tap targets, works on phones and laptops.
(function(){
  const DND = window.DND, WZ = window.WZ;
  const DRAFT_KEY = 'troxellWizardDraft_v1';
  const AB = DND.ABILITIES;
  const AB_NAME = DND.ABILITY_LABELS;
  const STD_ARRAY = [15,14,13,12,10,8];
  const mod = s => Math.floor((s - 10) / 2);
  const sgn = n => n >= 0 ? '+' + n : String(n);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $ = (sel, root) => (root || document).querySelector(sel);

  // ---------- state ----------
  let W = null;
  let stepIdx = 0;
  let live = { races:null, backgrounds:null, raceKeys:{}, bgKeys:{}, detail:{}, loading:false, failed:false };
  let classFilter = 'all';

  function freshState(){
    return { name:'', ruleset:'2024', cls:'', sub:'', race:'', raceKind:'', bg:'', raceAsi:{}, bgAsi:{}, scores:{}, skills:[], gear:0,
             cantrips:[], l1:[], gearMode:'pack', cart:{}, budget:null, choices:{}, isCustom:false, customTraits:'', persona:{traits:'',ideals:'',bonds:'',flaws:''}, extraRaceSkills:[] };
  }
  function saveDraft(){ try{ localStorage.setItem(DRAFT_KEY, JSON.stringify({ W, stepIdx })); }catch(e){} }
  function loadDraft(){ try{ return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); }catch(e){ return null; } }
  function clearDraft(){ try{ localStorage.removeItem(DRAFT_KEY); }catch(e){} }

  // ---------- derived helpers ----------
  const is2014 = () => W.ruleset === '2014';
  const subLevel = () => WZ.subclassLevel(W.cls, W.ruleset);
  const needsSub = () => W.cls && subLevel() <= 1;
  const subList = () => is2014() ? (DND.SUBCLASSES[W.cls] || []) : (WZ.SUBCLASSES_2024[W.cls] || DND.SUBCLASSES[W.cls] || []);
  const choiceSets = () => W && W.cls ? WZ.choiceSetsFor(W.cls).filter(c => c.known(1, W.ruleset) > 0) : [];
  const casterStyle = () => WZ.CASTER_STYLE[W.cls];
  const castsAtL1 = () => casterStyle() && !WZ.firstSpellLevel[W.cls];

  function raceBonusDef(){ return is2014() ? (WZ.RACE_BONUS[W.race] || null) : null; }
  function bonusTotals(){
    const t = {}; AB.forEach(a => t[a] = 0);
    const rb = raceBonusDef();
    if(rb && rb.fixed) Object.keys(rb.fixed).forEach(a => t[a] += rb.fixed[a]);
    if(rb && rb.pick) Object.keys(W.raceAsi).forEach(a => t[a] += W.raceAsi[a] || 0);
    if(!is2014()) Object.keys(W.bgAsi).forEach(a => t[a] += W.bgAsi[a] || 0);
    return t;
  }
  function finalScores(){
    const b = bonusTotals(), o = {};
    AB.forEach(a => o[a] = (W.scores[a] || 10) + b[a]);
    return o;
  }
  function localBg(){ return DND.BACKGROUNDS[W.bg] || null; }
  function bgSkills(){ const b = localBg(); return b ? b.skills.filter(s => DND.SKILLS.some(k => k.name === s)) : []; }
  function raceSkillsFixed(){ const r = WZ.RACE_SKILLS[W.race]; return (is2014() && r && r.fixed) || []; }
  function raceSkillPicks(){ const r = WZ.RACE_SKILLS[W.race]; return (is2014() && r && r.pick) || 0; }
  function classPicks(){ return DND.CLASS_SKILL_CHOICES[W.cls] || { count:0, options:[] }; }
  const alreadyHave = () => new Set([...bgSkills(), ...raceSkillsFixed()]);

  function spellCaps(){
    const fs = finalScores();
    const m = fs[DND.SPELLCASTING_ABILITY[W.cls]] != null ? mod(fs[DND.SPELLCASTING_ABILITY[W.cls]]) : 0;
    const style = casterStyle();
    const cantrips = (DND.CANTRIPS_KNOWN[W.cls] || [])[0] || 0;
    let l1 = 0, prepared = 0;
    if(style === 'known') l1 = (DND.SPELLS_KNOWN[W.cls] || [])[0] || 0;
    else if(style === 'book'){ l1 = 6; prepared = Math.max(1, m + 1); }
    else if(style === 'prepared'){ l1 = Math.max(1, m + 1); prepared = l1; }
    else if(style === 'halfprep'){ l1 = Math.max(1, m + Math.floor(1/2)); prepared = l1; }
    return { cantrips, l1, prepared, style };
  }

  // ---------- steps ----------
  function stepList(){
    const s = ['intro','class'];
    if(needsSub()) s.push('subclass');
    s.push('species','background','abilities','skills','gear');
    if(choiceSets().length) s.push('choices');
    if(castsAtL1()) s.push('spells');
    s.push('finish');
    return s;
  }
  const TITLES = { choices:'Class choices', intro:'Name & rules', class:'Pick a class', subclass:'Pick a subclass', species:'Pick a species', background:'Pick a background',
                   abilities:'Ability scores', skills:'Choose skills', gear:'Starting gear', spells:'Choose spells', finish:'Final touches' };

  // ---------- container ----------
  function root(){ return $('#wizardScreen'); }
  function render(){
    const steps = stepList();
    if(stepIdx >= steps.length) stepIdx = steps.length - 1;
    const key = steps[stepIdx];
    const el = root();
    const pct = Math.round((stepIdx) / (steps.length - 1) * 100);
    el.innerHTML = `
      <div class="wzTop">
        <button class="wzX" id="wzCancel" aria-label="Cancel">✕</button>
        <div class="wzProg"><div class="wzProgBar" style="width:${pct}%"></div></div>
        <div class="wzStepNum">${stepIdx + 1}/${steps.length}</div>
      </div>
      <h2 class="wzTitle">${TITLES[key]}</h2>
      <div id="wzBody" class="wzBody"></div>
      <div class="wzNav">
        <button class="btn wzBack" id="wzBack" ${stepIdx === 0 ? 'style="visibility:hidden"' : ''}>← Back</button>
        <button class="btn primary wzNext" id="wzNext">${key === 'finish' ? 'Create character ✓' : 'Next →'}</button>
      </div>
      <div class="wzHint" id="wzHint"></div>`;
    $('#wzCancel').onclick = cancel;
    $('#wzBack').onclick = () => { stepIdx = Math.max(0, stepIdx - 1); saveDraft(); render(); window.scrollTo(0,0); };
    $('#wzNext').onclick = () => {
      const why = invalid(key);
      if(why){ $('#wzHint').textContent = why; return; }
      if(key === 'finish') return create();
      stepIdx++; saveDraft(); render(); window.scrollTo(0,0);
    };
    BUILD[key]($('#wzBody'));
    refreshNext();
  }
  function refreshNext(){
    const key = stepList()[stepIdx];
    const why = invalid(key);
    const nx = $('#wzNext');
    if(nx) nx.classList.toggle('disabled', !!why);
    const hint = $('#wzHint');
    if(hint) hint.textContent = why || '';
  }
  async function cancel(){
    if(W && (W.name || W.cls) && !(await UI.confirm('Your answers are saved on this device so you can pick up again later.', { title:'Leave character creation?', ok:'Leave', cancel:'Keep going' }))) return;
    saveDraft();
    PlayerApp.show('charListScreen');
  }

  // ---------- validation ----------
  function invalid(key){
    switch(key){
      case 'intro': return W.name.trim() ? '' : 'Give your character a name to continue.';
      case 'class': return W.cls ? '' : 'Tap a class to choose it.';
      case 'subclass': return W.sub ? '' : 'Pick one to continue.';
      case 'species': {
        if(!W.race) return 'Tap a species to choose it.';
        const rb = raceBonusDef();
        if(rb && rb.pick && Object.keys(W.raceAsi).length < rb.pick.length) return 'Choose where your species bonuses go.';
        return '';
      }
      case 'background': {
        if(!W.bg) return 'Tap a background to choose it.';
        if(!is2014() && !bgAsiValid()) return 'Choose where your +2 / +1 (or three +1) bonuses go.';
        return '';
      }
      case 'abilities': return AB.every(a => W.scores[a]) ? '' : (W.manual ? 'Enter a number from 3 to 20 for every ability.' : 'Give every ability a score — or tap “Recommended”.');
      case 'skills': {
        const need = classPicks().count;
        const have = W.skills.length;
        if(have < need) return `Pick ${need - have} more class skill${need - have > 1 ? 's' : ''}.`;
        const rp = raceSkillPicks();
        if(rp && W.extraRaceSkills.length < rp) return `Pick ${rp - W.extraRaceSkills.length} more species skill${rp - W.extraRaceSkills.length > 1 ? 's' : ''}.`;
        return '';
      }
      case 'spells': {
        const c = spellCaps();
        if(W.cantrips.length < c.cantrips) return `Pick ${c.cantrips - W.cantrips.length} more cantrip${c.cantrips - W.cantrips.length > 1 ? 's' : ''}.`;
        if(W.l1.length < c.l1) return `Pick ${c.l1 - W.l1.length} more level 1 spell${c.l1 - W.l1.length > 1 ? 's' : ''}.`;
        return '';
      }
      case 'choices': { for(const c of choiceSets()){ const n = c.known(1, W.ruleset), have = (W.choices[c.id] || []).length; if(have < n) return `Pick ${n - have} more ${c.noun}${n - have > 1 ? 's' : ''}.`; } return ''; }
      case 'gear': return W.gearMode === 'buy' && goldLeft() < 0 ? 'You\'re over budget — remove something or raise your starting gold.' : '';
      default: return '';
    }
  }
  function bgAsiValid(){
    const v = Object.values(W.bgAsi).filter(Boolean);
    const sum = v.reduce((a,b) => a + b, 0);
    return (v.length === 2 && sum === 3) || (v.length === 3 && sum === 3);
  }

  // ---------- live (Open5e) detail helpers ----------
  const clean = t => esc(String(t || '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/^#+\s*/gm, '').replace(/\|[-: |]+\|/g, '').trim());
  const para = t => clean(t).split(/\n{2,}|\n/).filter(Boolean).map(x => '<p>' + x + '</p>').join('');
  function detailHtml(d){
    let h = '';
    if(d.desc) h += para(d.desc);
    const lists = [d.traits, d.benefits, d.features].filter(Array.isArray);
    lists.forEach(arr => arr.forEach(t => {
      if(!t || !t.name) return;
      h += '<p><b>' + esc(t.name) + '.</b> ' + clean(t.desc || t.description || '') + '</p>';
    }));
    return h || '<p>No description available — details are on your sheet after creation.</p>';
  }
  // Fetch + show a live species/background description inside `box`.
  function showLiveDetail(endpoint, name, key, box, cur){
    if(!key){ box.innerHTML = '<p>Full details will be on your character sheet after creation.</p>'; return; }
    const cacheKey = endpoint + ':' + key;
    const paint = d => { if(box.isConnected && cur() === name) box.innerHTML = detailHtml(d); };
    if(live.detail[cacheKey]) return paint(live.detail[cacheKey]);
    box.innerHTML = '<p class="wzDim">Loading description…</p>';
    PlayerApp.liveDetail(endpoint, key).then(d => { live.detail[cacheKey] = d; paint(d); })
      .catch(() => { if(box.isConnected) box.innerHTML = '<p>Couldn\'t load the description (Open5e unreachable). Details will be on your sheet after creation.</p>'; });
  }
  const cartNames = () => Object.keys(W.cart || {});
  function currentAc(fs){
    if(W.gearMode === 'buy') return WZ.acFromItems(cartNames(), mod(fs.dex), mod(fs.con), mod(fs.wis), W.cls);
    const g = (WZ.GEAR[W.cls] || [])[W.gear] || { ac:{kind:'none'} };
    return WZ.armorClass(g.ac, mod(fs.dex), mod(fs.con), mod(fs.wis));
  }
  const budgetOf = () => W.budget != null ? W.budget : (WZ.START_GOLD[W.cls] || 0);
  const cartCost = () => Object.values(W.cart || {}).reduce((t, c) => t + (c.gp || 0) * c.qty, 0);
  const goldLeft = () => Math.round((budgetOf() - cartCost()) * 100) / 100;
  const bgGold = () => { const b = localBg(); let g = 0; if(b && b.equipment) b.equipment.split(',').forEach(x => { const m = x.trim().match(/^(\d+)\s*gp$/i); if(m) g += +m[1]; }); return g; };

  // ---- shop data (Open5e items/weapons/armor, with built-in fallback) ----
  const shop = { list:null, loading:false, failed:false };
  function normShop(o, cat){
    if(!o || !o.name) return null;
    if(o.is_magic || (o.rarity && /uncommon|rare|very|legendary|artifact/i.test(JSON.stringify(o.rarity)))) return null;
    let c = cat;
    if(!c){
      const raw = o.category ? (o.category.name || o.category.key || o.category) : '';
      c = /weapon/i.test(raw) ? 'Weapons' : /armor|shield/i.test(raw) ? 'Armor' : 'Gear';
    }
    return { name:o.name, cat:c, gp:WZ.parseGp(o.cost) };
  }
  function loadShop(cb){
    if(shop.list || shop.loading) return;
    shop.loading = true;
    const get = ep => PlayerApp.liveAll(ep).catch(() => []);
    Promise.all([get('weapons'), get('armor'), get('items')]).then(([w, a, i]) => {
      const seen = new Set(), out = [];
      [[w,'Weapons'],[a,'Armor'],[i,null]].forEach(([arr, cat]) => (arr || []).forEach(o => {
        const n = normShop(o, cat); if(!n) return;
        const k = n.name.toLowerCase(); if(seen.has(k)) return; seen.add(k); out.push(n);
      }));
      if(out.length < 10){ shop.failed = true; shop.list = WZ.SHOP_FALLBACK.slice(); } else shop.list = out;
    }).catch(() => { shop.failed = true; shop.list = WZ.SHOP_FALLBACK.slice(); })
      .then(() => { shop.loading = false; cb(); });
  }

  const l1Features = () => (DND.CLASS_FEATURES[W.cls] || []).filter(f => f[0] <= 1);

  // ---------- step builders ----------
  const BUILD = {};

  BUILD.intro = body => {
    body.innerHTML = `
      <p class="wzLead">Let's build your hero one small choice at a time. You can change anything later on the full sheet.</p>
      <label>Character name</label>
      <input type="text" id="wzName" value="${esc(W.name)}" placeholder="e.g. Thorn Ironfoot" maxlength="60" autocomplete="off">
      <label style="margin-top:18px">Which rules are you playing?</label>
      <div class="wzTwo">
        <button class="wzChoice ${W.ruleset === '2024' ? 'sel' : ''}" data-rs="2024"><b>2024 rules</b><span>Newer Player's Handbook</span></button>
        <button class="wzChoice ${W.ruleset === '2014' ? 'sel' : ''}" data-rs="2014"><b>2014 rules</b><span>The original 5e books</span></button>
      </div>
      <p class="wzNote">Not sure? Ask your DM. Starting at level 1 — your DM can bump you up later on the full sheet.</p>`;
    $('#wzName').oninput = e => { W.name = e.target.value; saveDraft(); refreshNext(); };
    body.querySelectorAll('[data-rs]').forEach(b => b.onclick = () => {
      if(W.ruleset !== b.dataset.rs){
        W.ruleset = b.dataset.rs; W.choices = {}; W.isCustom = false; W.race = ''; W.raceAsi = {}; W.bg = ''; W.bgAsi = {}; W.sub = '';
        W.scores = {}; W.skills = []; W.extraRaceSkills = [];
      }
      body.querySelectorAll('[data-rs]').forEach(x => x.classList.toggle('sel', x === b));
      saveDraft(); refreshNext();
    });
    setTimeout(() => { if(!W.name && window.innerWidth > 700) $('#wzName').focus(); }, 50);
  };

  BUILD.class = body => {
    const FILTERS = [['all','All'],['beginner','Easy to learn'],['fighting','Fighting'],['magic','Magic'],['stealth','Sneaky'],['support','Helping'],['tank','Tough']];
    const render = () => {
      const list = WZ.CLASS_ORDER.filter(c => {
        const i = WZ.CLASS_INFO[c];
        if(classFilter === 'all') return true;
        if(classFilter === 'beginner') return i.diff === 1;
        return i.tags.includes(classFilter);
      });
      body.innerHTML = `
        <div class="wzFilters">${FILTERS.map(f => `<button class="chip ${classFilter === f[0] ? 'selected' : ''}" data-f="${f[0]}">${f[1]}</button>`).join('')}</div>
        <div class="wzGrid">${list.map(c => {
          const i = WZ.CLASS_INFO[c];
          const sel = W.cls === c;
          return `<div class="wzCard ${sel ? 'sel' : ''}" data-c="${c}">
            <div class="wzCardTop"><b>${c}</b>
              <span class="wzDiff d${i.diff}">${['','Easy','Medium','More to track'][i.diff]}</span></div>
            <div class="wzTag">${esc(i.tag)}</div>
            ${sel ? `<ul class="wzDoes">${i.does.map(d => `<li>${esc(d)}</li>`).join('')}</ul>
              <div class="wzKey"><b>Most important scores:</b> ${esc(i.key)}</div>
              <div class="wzKey"><b>Hit die:</b> d${DND.CLASS_HIT_DIE[c]}</div>
              ${(DND.CLASS_FEATURES[c] || []).filter(f => f[0] <= 1).length ? `<div class="wzFeat"><b>You get at level 1:</b>${(DND.CLASS_FEATURES[c] || []).filter(f => f[0] <= 1).map(f => `<p><b>${esc(f[1])}.</b> ${esc(f[2])}</p>`).join('')}</div>` : ''}` : ''}
          </div>`;
        }).join('')}</div>`;
      body.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { classFilter = b.dataset.f; render(); });
      body.querySelectorAll('[data-c]').forEach(card => card.onclick = () => {
        if(W.cls !== card.dataset.c){
          W.cls = card.dataset.c; W.sub = ''; W.choices = {}; W.skills = []; W.scores = {}; W.gear = 0; W.cantrips = []; W.l1 = [];
        }
        saveDraft(); render(); refreshNext();
        const sel = body.querySelector('.wzCard.sel'); if(sel) sel.scrollIntoView({ block:'nearest', behavior:'smooth' });
      });
    };
    render();
  };

  BUILD.subclass = body => {
    const list = subList();
    body.innerHTML = `<p class="wzLead">${W.cls}s choose their subclass right away. Here's what each one is known for:</p>
      <div class="wzGrid">${list.map(n => `<div class="wzCard ${W.sub === n ? 'sel' : ''}" data-s="${esc(n)}">
        <b>${esc(n)}</b><div class="wzTag">${esc(WZ.subBlurb(n) || 'See your DM or the book for details.')}</div></div>`).join('')}</div>
      <p class="wzNote">Don't see yours (like a Tasha's or Xanathar's option)? Pick any for now and type it in on the full sheet.</p>`;
    body.querySelectorAll('[data-s]').forEach(c => c.onclick = () => {
      W.sub = c.dataset.s; body.querySelectorAll('[data-s]').forEach(x => x.classList.toggle('sel', x === c)); saveDraft(); refreshNext();
    });
  };

  function loadLive(){
    if(is2014() || live.races || live.loading || live.failed) return;
    live.loading = true;
    Promise.all([PlayerApp.liveIndex('races'), PlayerApp.liveIndex('backgrounds')]).then(([r, b]) => {
      live.races = r.map(x => x.name); live.backgrounds = b.map(x => x.name); if(!live.races.length || !live.backgrounds.length) live.failed = true;
      r.forEach(x => live.raceKeys[x.name] = x.key); b.forEach(x => live.bgKeys[x.name] = x.key);
    }).catch(() => { live.failed = true; }).then(() => {
      live.loading = false;
      const k = stepList()[stepIdx];
      if(k === 'species' || k === 'background') render();
    });
  }

  BUILD.species = body => {
    loadLive();
    let names;
    if(is2014() || live.failed || !live.races) names = Object.keys(DND.RACE_TRAITS);
    else names = live.races;
    const waiting = !is2014() && !live.races && !live.failed;
    const have = new Set([...names, ...Object.keys(DND.RACE_TRAITS)].map(x => x.toLowerCase()));
    const extras = Object.keys(WZ.SPECIES_EXTRA).filter(n => !have.has(n.toLowerCase())).sort();
    body.innerHTML = `${!is2014() && live.failed ? '<p class="wzNote">Couldn\'t reach the 2024 list — showing the classic species instead.</p>' : ''}
      ${waiting ? '<p class="wzNote">Loading 2024 species…</p>' : ''}
      <div class="wzGrid wzSmall">${names.map(n => `<div class="wzCard ${W.race === n && !W.isCustom ? 'sel' : ''}" data-r="${esc(n)}"><b>${esc(n)}</b></div>`).join('')}</div>
      <details class="wzMore" ${(extras.includes(W.race) || W.isCustom) ? 'open' : ''}><summary>More species (other books) &amp; custom</summary>
        <div class="wzGrid wzSmall" style="margin-top:8px">${extras.map(n => `<div class="wzCard ${W.race === n && !W.isCustom ? 'sel' : ''}" data-r="${esc(n)}"><b>${esc(n)}</b></div>`).join('')}
        <div class="wzCard ${W.isCustom ? 'sel' : ''}" data-custom="1"><b>✎ Custom species…</b></div></div></details>
      <div id="wzRaceInfo"></div>`;
    body.querySelectorAll('[data-r]').forEach(c => c.onclick = () => {
      if(W.race !== c.dataset.r || W.isCustom){ W.race = c.dataset.r; W.isCustom = false; W.raceAsi = {}; W.extraRaceSkills = []; W.skills = []; }
      saveDraft(); BUILD.species(body); refreshNext();
    });
    body.querySelectorAll('[data-custom]').forEach(c => c.onclick = () => {
      if(!W.isCustom){ W.isCustom = true; W.race = W.customName || ''; W.raceAsi = {}; W.extraRaceSkills = []; W.skills = []; }
      saveDraft(); BUILD.species(body); refreshNext();
    });
    const info = $('#wzRaceInfo', body);
    if(W.isCustom){
      info.innerHTML = `<div class="wzInfo"><b>Custom species</b><p>Name your species and describe its traits. They'll be saved on your sheet's Features tab. Adjust ability scores on the sheet if your species gives bonuses.</p>
        <input type="text" id="wzCName" placeholder="Species name" value="${esc(W.customName || '')}" maxlength="40">
        <textarea id="wzCTraits" rows="4" placeholder="Traits (darkvision, speed, special abilities…)" style="margin-top:8px">${esc(W.customTraits)}</textarea></div>`;
      $('#wzCName', info).oninput = e => { W.customName = e.target.value; W.race = e.target.value.trim(); saveDraft(); refreshNext(); };
      $('#wzCTraits', info).oninput = e => { W.customTraits = e.target.value; saveDraft(); };
    } else if(W.race){
      const traits = DND.RACE_TRAITS[W.race];
      const extra = WZ.SPECIES_EXTRA[W.race];
      let h = `<div class="wzInfo"><b>${esc(W.race)}</b>`;
      if(traits) h += `<p>${esc(traits)}</p>`;
      else if(extra && !live.raceKeys[W.race]) h += `<p>${esc(extra)}</p><p class="wzDim">Exact traits are in your book — add them on the sheet's Features tab${is2014() ? ', and adjust ability scores on the Core tab' : ''}.</p>`;
      else h += '<div id="wzLiveBox"><p class="wzDim">Loading description…</p></div>';
      h += '</div>';
      info.innerHTML = h;
      if(!traits && !(extra && !live.raceKeys[W.race])) showLiveDetail('races', W.race, live.raceKeys[W.race], $('#wzLiveBox', info), () => W.race);
      const rb = raceBonusDef();
      if(rb){
        const fixed = rb.fixed ? Object.keys(rb.fixed).map(a => `${AB_NAME[a]} ${sgn(rb.fixed[a])}`).join(', ') : '';
        let html = `<div class="wzInfo"><b>Ability bonuses</b>${fixed ? `<p>Automatic: ${fixed}</p>` : ''}`;
        if(rb.pick){
          html += `<p>Choose where to put ${rb.pick.map(p => sgn(p)).join(' and ')} (different scores${rb.fixed ? ', not the ones above' : ''}):</p>`;
          rb.pick.forEach((amt, idx) => {
            const cur = Object.keys(W.raceAsi).find(a => W.raceAsi[a] === amt && (idx === 0 || rb.pick[0] !== amt || true) ) ;
            html += `<div class="wzPickRow"><span>${sgn(amt)} to</span><select data-pick="${idx}">
              <option value="">— choose —</option>${AB.filter(a => !(rb.fixed && rb.fixed[a])).map(a => `<option value="${a}">${AB_NAME[a]}</option>`).join('')}</select></div>`;
          });
        }
        html += '</div>';
        info.insertAdjacentHTML('beforeend', html);
        if(rb.pick){
          const sels = info.querySelectorAll('[data-pick]');
          // restore from state: raceAsi is {ability: amount}; order amounts to selects
          const entries = Object.keys(W.raceAsi);
          const used = {};
          rb.pick.forEach((amt, idx) => {
            const a = entries.find(x => W.raceAsi[x] === amt && !used[x]);
            if(a){ used[a] = 1; sels[idx].value = a; }
          });
          const sync = () => {
            const o = {};
            sels.forEach((s, idx) => { if(s.value) o[s.value] = (o[s.value] || 0) + rb.pick[idx]; });
            // disallow the same ability twice
            const vals = [...sels].map(s => s.value).filter(Boolean);
            if(new Set(vals).size !== vals.length){ $('#wzHint').textContent = 'Pick different scores for each bonus.'; return; }
            W.raceAsi = o; saveDraft(); refreshNext();
          };
          sels.forEach(s => s.onchange = sync);
        }
      }
      if(!is2014()) info.insertAdjacentHTML('beforeend', '<p class="wzNote">In the 2024 rules your ability bonuses come from your background (next step).</p>');
    }
  };

  BUILD.background = body => {
    loadLive();
    let names;
    if(is2014() || live.failed || !live.backgrounds) names = Object.keys(DND.BACKGROUNDS);
    else names = live.backgrounds;
    const waiting = !is2014() && !live.backgrounds && !live.failed;
    body.innerHTML = `${waiting ? '<p class="wzNote">Loading 2024 backgrounds…</p>' : ''}
      <div class="wzGrid wzSmall">${names.map(n => `<div class="wzCard ${W.bg === n ? 'sel' : ''}" data-b="${esc(n)}"><b>${esc(n)}</b></div>`).join('')}</div>
      <div id="wzBgInfo"></div>`;
    body.querySelectorAll('[data-b]').forEach(c => c.onclick = () => {
      if(W.bg !== c.dataset.b){ W.bg = c.dataset.b; W.skills = []; if(!is2014()) W.bgAsi = {}; }
      saveDraft(); BUILD.background(body); refreshNext();
    });
    const info = $('#wzBgInfo', body);
    if(!W.bg) return;
    const b = localBg();
    let h = `<div class="wzInfo"><b>${esc(W.bg)}</b>`;
    if(b){
      h += `<p>${esc(b.featureDesc || '')}</p>
        <p><b>Skills:</b> ${esc(b.skills.join(', ') || '—')}</p>`;
      if(b.tools && b.tools !== 'None') h += `<p><b>Tools:</b> ${esc(b.tools)}</p>`;
    } else h += '<div id="wzLiveBox"><p class="wzDim">Loading description…</p></div>';
    h += '</div>';
    info.innerHTML = h;
    if(!b) showLiveDetail('backgrounds', W.bg, live.bgKeys[W.bg], $('#wzLiveBox', info), () => W.bg);
    if(!is2014()){
      info.insertAdjacentHTML('beforeend', `<div class="wzInfo"><b>Ability bonuses</b>
        <p>Pick <b>+2 and +1</b> for two different scores, or <b>+1 to three</b> scores.</p>
        <div class="wzTwo"><button class="wzChoice ${Object.keys(W.bgAsi).length === 3 ? '' : 'sel'}" data-mode="21"><b>+2 / +1</b></button>
        <button class="wzChoice ${Object.keys(W.bgAsi).length === 3 ? 'sel' : ''}" data-mode="111"><b>+1 / +1 / +1</b></button></div>
        <div id="wzBgAsi"></div></div>`);
      const asiBox = $('#wzBgAsi', info);
      let mode = Object.keys(W.bgAsi).length === 3 ? '111' : '21';
      const drawAsi = () => {
        const amts = mode === '21' ? [2,1] : [1,1,1];
        const keys = Object.keys(W.bgAsi);
        asiBox.innerHTML = amts.map((amt, idx) => `<div class="wzPickRow"><span>${sgn(amt)} to</span><select data-bi="${idx}">
          <option value="">— choose —</option>${AB.map(a => `<option value="${a}">${AB_NAME[a]}</option>`).join('')}</select></div>`).join('');
        const sels = asiBox.querySelectorAll('select');
        const used = {};
        amts.forEach((amt, idx) => { const a = keys.find(k => W.bgAsi[k] === amt && !used[k]); if(a){ used[a] = 1; sels[idx].value = a; } });
        sels.forEach(s => s.onchange = () => {
          const vals = [...sels].map(x => x.value).filter(Boolean);
          if(new Set(vals).size !== vals.length){ $('#wzHint').textContent = 'Pick different scores for each bonus.'; return; }
          const o = {}; sels.forEach((x, i) => { if(x.value) o[x.value] = amts[i]; });
          W.bgAsi = o; saveDraft(); refreshNext();
        });
      };
      drawAsi();
      info.querySelectorAll('[data-mode]').forEach(btn => btn.onclick = () => {
        mode = btn.dataset.mode; W.bgAsi = {};
        info.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('sel', x === btn));
        drawAsi(); refreshNext();
      });
    }
  };

  BUILD.abilities = body => {
    const hasAll = AB.every(a => W.scores[a]);
    const bt = bonusTotals();
    const used = {}; AB.forEach(a => { if(W.scores[a]) used[W.scores[a]] = (used[W.scores[a]] || 0) + 1; });
    const isStd = AB.every(a => !W.scores[a] || STD_ARRAY.includes(W.scores[a])) && !W.rolled;
    body.innerHTML = `
      <p class="wzLead">Six scores describe what your character is good at. Start with the <b>Recommended</b> button, then tweak if you like.</p>
      <div class="wzBtnRow">
        <button class="btn primary small" id="wzRec">${W.manual ? '★ Best fit for my numbers' : '★ Recommended for ' + esc(W.cls)}</button>
        <button class="btn small" id="wzRoll">🎲 Roll 4d6</button>
        <button class="btn small ${W.manual ? 'on' : ''}" id="wzManual">✎ Enter my own</button>
        <button class="btn small" id="wzStd">Standard array</button>
        <button class="btn small" id="wzClear">Clear</button>
      </div>
      <label class="wzCheck"><input type="checkbox" id="wzReroll" ${W.reroll1 === false ? '' : 'checked'}> Reroll any 1s when rolling digitally (each 1 is rerolled once)</label>
      ${W.rolled && W.rollLog ? `<div class="wzInfo wzRollLog"><b>Your rolls</b>${W.rollLog.map(r => `<p><b>${r.total}</b> — ${r.dice.map(d => `<span class="${d.drop ? 'drop' : ''}">${d.v}${d.re ? '<sup title="rerolled a ' + d.was + '">↻</sup>' : ''}</span>`).join(' ')}</p>`).join('')}<p class="wzDim">Lowest die of each set is dropped (crossed out). ↻ = rerolled a 1.</p></div>` : ''}
      <div class="wzAbList">${AB.map(a => {
        const base = W.scores[a], tot = base ? base + bt[a] : null;
        return `<div class="wzAb ${a === (WZ.PRIORITY[W.cls] || [])[0] ? 'top' : ''}">
          <div class="wzAbHead"><b>${AB_NAME[a]}</b><span class="wzAbMod">${tot ? sgn(mod(tot)) : '–'}</span></div>
          <div class="wzAbHelp">${esc(WZ.ABILITY_HINT[a])}</div>
          <div class="wzAbRow">
            ${W.manual
              ? `<input type="number" inputmode="numeric" min="3" max="20" step="1" class="wzNum" data-man="${a}" value="${base || ''}" placeholder="3–20">`
              : W.rolled
              ? `<select data-ab="${a}"><option value="">—</option>${(W.rollPool || []).map((v,i) => `<option value="${i}" ${W.rollAssign && W.rollAssign[a] === i ? 'selected' : ''} ${Object.values(W.rollAssign || {}).includes(i) && W.rollAssign[a] !== i ? 'disabled' : ''}>${v}</option>`).join('')}</select>`
              : `<select data-ab="${a}"><option value="">—</option>${STD_ARRAY.map(v => `<option value="${v}" ${base === v ? 'selected' : ''} ${used[v] && base !== v ? 'disabled' : ''}>${v}</option>`).join('')}</select>`}
            ${bt[a] ? `<span class="wzBonus">${sgn(bt[a])} bonus</span>` : ''}
            <span class="wzTotal">${tot ? 'Total <b>' + tot + '</b>' : ''}</span>
          </div></div>`;
      }).join('')}</div>
      <p class="wzNote">${W.manual ? 'Type the numbers you rolled at the table (before species or background bonuses — those are added for you). Tap “Best fit” to have the app assign your six numbers to the best scores for your class.' : W.rolled ? 'Assign each rolled number to a score.' : 'Using the standard array: 15, 14, 13, 12, 10, 8 — one for each score.'}</p>`;

    $('#wzRec').onclick = () => {
      const order = WZ.PRIORITY[W.cls];
      if(W.manual){
        const vals = AB.map(a => W.scores[a]).filter(Boolean).sort((x, y) => y - x);
        if(vals.length < 6){ $('#wzHint').textContent = 'Enter all six numbers first, then tap Best fit.'; return; }
        W.scores = {}; order.forEach((a, i) => W.scores[a] = vals[i]);
        saveDraft(); BUILD.abilities(body); refreshNext(); return;
      }
      const pool = W.rolled && W.rollPool ? [...W.rollPool].map((v,i) => [v,i]).sort((a,b) => b[0]-a[0]) : STD_ARRAY.map((v,i) => [v,i]);
      W.scores = {}; if(W.rolled) W.rollAssign = {};
      order.forEach((a, i) => { W.scores[a] = pool[i][0]; if(W.rolled) W.rollAssign[a] = pool[i][1]; });
      saveDraft(); BUILD.abilities(body); refreshNext();
    };
    $('#wzRoll').onclick = () => {
      const d6 = () => 1 + Math.floor(Math.random() * 6);
      const rr = W.reroll1 !== false;
      const roll = () => {
        const dice = [1,2,3,4].map(() => { let v = d6(), was = 0; if(rr && v === 1){ was = 1; v = d6(); } return { v, re: !!was, was }; });
        const lowest = dice.reduce((m, d, i) => d.v < dice[m].v ? i : m, 0);
        dice[lowest].drop = true;
        return { total: dice.filter(d => !d.drop).reduce((t, d) => t + d.v, 0), dice };
      };
      const sets = [roll(),roll(),roll(),roll(),roll(),roll()].sort((a,b) => b.total - a.total);
      W.rollLog = sets;
      W.rolled = true; W.manual = false; W.rollPool = sets.map(x => x.total);
      W.scores = {}; W.rollAssign = {};
      WZ.PRIORITY[W.cls].forEach((a, i) => { W.scores[a] = W.rollPool[i]; W.rollAssign[a] = i; });
      saveDraft(); BUILD.abilities(body); refreshNext();
    };
    $('#wzReroll').onchange = e => { W.reroll1 = e.target.checked; saveDraft(); };
    $('#wzManual').onclick = () => { W.manual = true; W.rolled = false; W.rollPool = null; W.rollAssign = null; W.scores = {}; saveDraft(); BUILD.abilities(body); refreshNext(); };
    $('#wzStd').onclick = () => { W.manual = false; W.rolled = false; W.rollPool = null; W.rollAssign = null; W.scores = {}; saveDraft(); BUILD.abilities(body); refreshNext(); };
    body.querySelectorAll('input[data-man]').forEach(inp => inp.oninput = () => {
      const a = inp.dataset.man, v = parseInt(inp.value, 10);
      if(v >= 3 && v <= 20) W.scores[a] = v; else delete W.scores[a];
      const box = inp.closest('.wzAb');
      const tot = W.scores[a] ? W.scores[a] + bonusTotals()[a] : null;
      box.querySelector('.wzAbMod').textContent = tot ? sgn(mod(tot)) : '–';
      box.querySelector('.wzTotal').innerHTML = tot ? 'Total <b>' + tot + '</b>' : '';
      inp.classList.toggle('bad', !!inp.value && !W.scores[a]);
      saveDraft(); refreshNext();
    });
    $('#wzClear').onclick = () => { W.scores = {}; W.rolled = false; W.rollPool = null; W.rollAssign = null; saveDraft(); BUILD.abilities(body); refreshNext(); };
    body.querySelectorAll('select[data-ab]').forEach(s => s.onchange = () => {
      const a = s.dataset.ab;
      if(W.rolled){
        if(s.value === ''){ delete W.scores[a]; delete W.rollAssign[a]; }
        else { const i = +s.value; W.scores[a] = W.rollPool[i]; W.rollAssign[a] = i; }
      } else {
        if(s.value === '') delete W.scores[a]; else W.scores[a] = +s.value;
      }
      saveDraft(); BUILD.abilities(body); refreshNext();
    });
  };

  BUILD.skills = body => {
    const have = alreadyHave();
    const cp = classPicks();
    const rp = raceSkillPicks();
    const skillAb = n => (DND.SKILLS.find(s => s.name === n) || {}).ability;
    const chip = (n, group, sel, locked) => `<button class="wzSkill ${sel ? 'sel' : ''} ${locked ? 'locked' : ''}" data-g="${group}" data-n="${esc(n)}" ${locked ? 'disabled' : ''}>
      ${esc(n)}<small>${(skillAb(n) || '').toUpperCase()}</small></button>`;
    let html = '';
    if(have.size) html += `<div class="wzInfo"><b>You already get</b><p>${[...have].map(esc).join(', ')} <span class="wzDim">(from your ${bgSkills().length ? 'background' : ''}${bgSkills().length && raceSkillsFixed().length ? ' and ' : ''}${raceSkillsFixed().length ? 'species' : ''})</span></p></div>`;
    html += `<p class="wzLead">Choose <b>${cp.count}</b> skills from your ${esc(W.cls)} list <span class="wzCount">(${W.skills.length}/${cp.count})</span></p>
      <div class="wzSkillGrid">${cp.options.map(n => chip(n, 'cls', W.skills.includes(n), have.has(n))).join('')}</div>`;
    if(rp){
      const choices = DND.SKILLS.map(s => s.name).filter(n => !have.has(n) && !W.skills.includes(n));
      html += `<p class="wzLead" style="margin-top:18px">Your species also grants <b>${rp}</b> skill${rp > 1 ? 's' : ''} of your choice <span class="wzCount">(${W.extraRaceSkills.length}/${rp})</span></p>
        <div class="wzSkillGrid">${DND.SKILLS.map(s => s.name).map(n => chip(n, 'race', W.extraRaceSkills.includes(n), have.has(n) || W.skills.includes(n))).join('')}</div>`;
    }
    body.innerHTML = html;
    body.querySelectorAll('.wzSkill').forEach(b => b.onclick = () => {
      const n = b.dataset.n;
      const list = b.dataset.g === 'cls' ? W.skills : W.extraRaceSkills;
      const max = b.dataset.g === 'cls' ? cp.count : rp;
      const i = list.indexOf(n);
      if(i >= 0) list.splice(i, 1);
      else if(list.length < max) list.push(n);
      else return;
      saveDraft(); BUILD.skills(body); refreshNext();
    });
  };

  BUILD.gear = body => {
    const buy = W.gearMode === 'buy';
    body.innerHTML = `<div class="wzTwo" style="margin-bottom:14px">
        <button class="wzChoice ${buy ? '' : 'sel'}" data-gm="pack"><b>Starting package</b><span>Quick — pick a ready-made kit</span></button>
        <button class="wzChoice ${buy ? 'sel' : ''}" data-gm="buy"><b>Buy my own</b><span>Spend your starting gold</span></button></div>
      <div id="wzGearBody"></div>`;
    body.querySelectorAll('[data-gm]').forEach(b => b.onclick = () => { W.gearMode = b.dataset.gm; saveDraft(); BUILD.gear(body); refreshNext(); });
    const box = $('#wzGearBody', body);
    return buy ? buildShop(box) : buildPackages(box);
  };

  function buildPackages(box){
    const opts = WZ.GEAR[W.cls] || [];
    const fs = finalScores();
    box.innerHTML = `<p class="wzLead">Pick a starting loadout. It sets your armor class and fills your inventory — you can change it later.</p>
      <div class="wzGrid">${opts.map((o, i) => {
        const ac = WZ.armorClass(o.ac, mod(fs.dex), mod(fs.con), mod(fs.wis));
        return `<div class="wzCard ${W.gear === i ? 'sel' : ''}" data-g="${i}"><div class="wzCardTop"><b>${esc(o.label)}</b><span class="wzDiff d1">AC ${ac}</span></div>
          <div class="wzTag">${o.items.map(esc).join(' · ')}</div></div>`;
      }).join('')}</div>
      ${localBg() && localBg().equipment ? `<div class="wzInfo"><b>Plus your background gear</b><p>${esc(localBg().equipment)}</p></div>` : ''}`;
    box.querySelectorAll('[data-g]').forEach(c => c.onclick = () => { W.gear = +c.dataset.g; saveDraft(); buildPackages(box); });
  }

  function buildShop(box){
    let cat = 'All', q = '';
    box.innerHTML = `<p class="wzLead">Spend your starting gold. Ask your DM how much you have — it's usually set by your class, and you can change the number.</p>
      <div class="wzBudget"><label>Starting gold</label><input type="number" inputmode="numeric" min="0" id="wzBudget" value="${budgetOf()}"><div class="wzLeft" id="wzLeft"></div></div>
      <input type="text" id="wzShopQ" placeholder="Search weapons, armor, gear…" autocomplete="off">
      <div class="wzFilters" style="margin-top:8px">${['All','Weapons','Armor','Gear'].map(c => `<button class="chip ${c === 'All' ? 'selected' : ''}" data-cat="${c}">${c}</button>`).join('')}</div>
      <div id="wzShopNote" class="wzNote"></div>
      <div id="wzShopRes" class="wzShopList"></div>
      <h3 class="wzH">Your gear</h3><div id="wzCart" class="wzShopList"></div>
      <div class="wzNote" id="wzCartAc"></div>`;
    const money = () => {
      const left = goldLeft(), el = $('#wzLeft', box);
      el.innerHTML = `Left: <b class="${left < 0 ? 'over' : ''}">${left === 0 ? '0 gp' : left < 0 ? '−' + WZ.fmtGp(-left) : WZ.fmtGp(left)}</b>`;
      $('#wzCartAc', box).textContent = 'Armor class with this gear: ' + currentAc(finalScores()) + (bgGold() ? `  ·  Your background also gives you ${bgGold()} gp (added after).` : '');
      refreshNext();
    };
    const drawCart = () => {
      const names = cartNames();
      $('#wzCart', box).innerHTML = names.length ? names.map(n => { const c = W.cart[n]; return `<div class="wzShopRow"><div class="wzShopName"><b>${esc(n)}</b><small>${c.gp == null ? 'price unknown' : WZ.fmtGp(c.gp * c.qty)}</small></div>
        <div class="wzQty"><button data-q="-1" data-n="${esc(n)}">−</button><span>${c.qty}</span><button data-q="1" data-n="${esc(n)}">＋</button></div></div>`; }).join('')
        : '<p class="wzDim">Nothing yet — search above and tap ＋.</p>';
      $('#wzCart', box).querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
        const c = W.cart[b.dataset.n]; if(!c) return;
        c.qty += +b.dataset.q; if(c.qty <= 0) delete W.cart[b.dataset.n];
        saveDraft(); drawCart(); money();
      });
    };
    const drawRes = () => {
      const note = $('#wzShopNote', box);
      if(!shop.list){ note.textContent = 'Loading equipment from Open5e…'; $('#wzShopRes', box).innerHTML = ''; return; }
      note.textContent = shop.failed ? 'Couldn\'t reach Open5e — showing a built-in list of standard gear.' : '';
      const ql = q.trim().toLowerCase();
      const list = shop.list.filter(i => (cat === 'All' || i.cat === cat) && (!ql || i.name.toLowerCase().includes(ql)))
        .sort((a, b) => a.name.localeCompare(b.name)).slice(0, 40);
      $('#wzShopRes', box).innerHTML = list.length ? list.map(i => `<div class="wzShopRow"><div class="wzShopName"><b>${esc(i.name)}</b><small>${esc(i.cat)} · ${WZ.fmtGp(i.gp)}</small></div>
        <button class="wzAdd" data-add="${esc(i.name)}">＋</button></div>`).join('') + (shop.list.length > 40 && !ql ? '<p class="wzDim">Showing 40 — type to search the rest.</p>' : '')
        : '<p class="wzDim">No matches.</p>';
      $('#wzShopRes', box).querySelectorAll('[data-add]').forEach(b => b.onclick = () => {
        const it = shop.list.find(x => x.name === b.dataset.add); if(!it) return;
        if(W.cart[it.name]) W.cart[it.name].qty++; else W.cart[it.name] = { qty:1, gp:it.gp };
        saveDraft(); drawCart(); money();
      });
    };
    $('#wzBudget', box).oninput = e => { const v = parseFloat(e.target.value); W.budget = isNaN(v) ? 0 : Math.max(0, v); saveDraft(); money(); };
    $('#wzShopQ', box).oninput = e => { q = e.target.value; drawRes(); };
    box.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { cat = b.dataset.cat; box.querySelectorAll('[data-cat]').forEach(x => x.classList.toggle('selected', x === b)); drawRes(); });
    drawRes(); drawCart(); money();
    loadShop(() => { if(box.isConnected) drawRes(); });
  }

  BUILD.choices = body => {
    let h = '';
    choiceSets().forEach(c => {
      const n = c.known(1, W.ruleset), mine = W.choices[c.id] = W.choices[c.id] || [];
      h += `<p class="wzLead"><b>${esc(c.label)}</b> — choose <b>${n}</b> <span class="wzCount">(${mine.length}/${n})</span></p>
        <div class="wzGrid">${c.options(W.ruleset).map(o => `<div class="wzCard ${mine.includes(o.n) ? 'sel' : ''}" data-set="${esc(c.id)}" data-n="${esc(o.n)}"><div class="wzCardTop"><b>${esc(o.n)}</b>${o.min > 1 || o.req ? `<span class="wzDiff ${o.min > 1 ? 'd3' : 'd2'}">${[o.min > 1 ? 'Lvl ' + o.min : '', o.req].filter(Boolean).map(esc).join(' · ')}</span>` : ''}</div><div class="wzTag">${esc(o.b)}</div></div>`).join('')}</div>`;
    });
    h += '<p class="wzNote">Tags show prerequisites as a guide — at level 1 pick ones with no level tag, and confirm anything else with your DM or book. You can change these later on the sheet.</p>';
    body.innerHTML = h;
    body.querySelectorAll('[data-set]').forEach(card => card.onclick = () => {
      const c = choiceSets().find(x => x.id === card.dataset.set), mine = W.choices[c.id], n = card.dataset.n, max = c.known(1, W.ruleset);
      const i = mine.indexOf(n); if(i >= 0) mine.splice(i, 1); else if(mine.length < max) mine.push(n); else return;
      const y = window.scrollY; saveDraft(); BUILD.choices(body); refreshNext(); window.scrollTo(0, y);
    });
  };

  BUILD.spells = body => {
    const caps = spellCaps();
    const lists = WZ.SPELL_LISTS[W.cls];
    const sp = n => WZ.SPELLS[n] || [0, ''];
    const card = (n, group, sel, full) => `<div class="wzSpell ${sel ? 'sel' : ''} ${!sel && full ? 'full' : ''}" data-g="${group}" data-n="${esc(n)}">
        <div><b>${esc(n)}</b>${(group === 'c' ? lists.rec : lists.recL1).includes(n) ? '<span class="wzStar">★ good pick</span>' : ''}</div>
        <small>${esc(sp(n)[1])}</small></div>`;
    const styleNote = { known:'You know these spells permanently.', book:'These go in your spellbook. Each day you prepare ' + caps.prepared + ' of them.',
      prepared:'Each day you can prepare ' + caps.prepared + ' spells from the whole list — pick a starter set now.', halfprep:'Each day you prepare ' + caps.prepared + ' spells.' }[caps.style] || '';
    const cFull = W.cantrips.length >= caps.cantrips, lFull = W.l1.length >= caps.l1;
    let html = `<p class="wzNote">Spells marked ★ are friendly first picks. ${styleNote}</p>`;
    if(caps.cantrips) html += `<h3 class="wzH">Cantrips <span class="wzCount">${W.cantrips.length}/${caps.cantrips}</span></h3><p class="wzDim">Cast as often as you like.</p>
      <div class="wzSpellGrid">${lists.cantrips.map(n => card(n, 'c', W.cantrips.includes(n), cFull)).join('')}</div>`;
    html += `<h3 class="wzH">Level 1 spells <span class="wzCount">${W.l1.length}/${caps.l1}</span></h3>
      <div class="wzSpellGrid">${lists.l1.map(n => card(n, 'l', W.l1.includes(n), lFull)).join('')}</div>`;
    body.innerHTML = html;
    body.querySelectorAll('.wzSpell').forEach(c => c.onclick = () => {
      const n = c.dataset.n, list = c.dataset.g === 'c' ? W.cantrips : W.l1, max = c.dataset.g === 'c' ? caps.cantrips : caps.l1;
      const i = list.indexOf(n);
      if(i >= 0) list.splice(i, 1); else if(list.length < max) list.push(n); else return;
      const y = window.scrollY; saveDraft(); BUILD.spells(body); refreshNext(); window.scrollTo(0, y);
    });
  };

  BUILD.finish = body => {
    const b = localBg();
    if(b && !W.persona.traits && !W.persona.ideals && !W.persona.bonds && !W.persona.flaws && !W.personaTouched){
      // gentle prefill from the background so the boxes are not blank
      W.persona = { traits:b.trait || '', ideals:b.ideal || '', bonds:b.bond || '', flaws:b.flaw || '' };
    }
    const fs = finalScores();
    const g = (WZ.GEAR[W.cls] || [])[W.gear] || { ac:{kind:'none'}, items:[] };
    const hit = DND.CLASS_HIT_DIE[W.cls];
    const hp = hit + mod(fs.con) + (is2014() && W.race === 'Dwarf (Hill)' ? 1 : 0);
    const ac = currentAc(fs);
    body.innerHTML = `
      <div class="wzSummary">
        <div class="wzSumName">${esc(W.name)}</div>
        <div class="wzSumSub">${esc(W.race)} ${esc(W.cls)}${W.sub ? ' — ' + esc(W.sub) : ''} · ${esc(W.bg)}</div>
        <div class="wzStats">
          <div><b>${Math.max(1, hp)}</b><span>HP</span></div><div><b>${ac}</b><span>AC</span></div>
          <div><b>${WZ.RACE_SPEED[W.race] || 30}</b><span>Speed</span></div><div><b>${sgn(mod(fs.dex))}</b><span>Initiative</span></div></div>
        <div class="wzAbMini">${AB.map(a => `<div><span>${a.toUpperCase()}</span><b>${fs[a]}</b><small>${sgn(mod(fs[a]))}</small></div>`).join('')}</div>
      </div>
      <div class="wzInfo"><b>What you get</b>
        ${l1Features().map(f => `<p><b>${esc(f[1])}.</b> ${esc(f[2])}</p>`).join('')}
        ${DND.RACE_TRAITS[W.race] ? `<p><b>${esc(W.race)}:</b> ${esc(DND.RACE_TRAITS[W.race])}</p>` : (live.detail['races:' + live.raceKeys[W.race]] ? `<p><b>${esc(W.race)}</b></p>${detailHtml(live.detail['races:' + live.raceKeys[W.race]])}` : '')}
        ${localBg() && localBg().feature ? `<p><b>${esc(localBg().feature)}.</b> ${esc(localBg().featureDesc || '')}</p>` : ''}
      </div>
      <p class="wzLead" style="margin-top:14px">Optional: who are you? (Skip any you like — you can fill these in later.)</p>
      ${[['traits','Personality traits'],['ideals','Ideals — what you believe'],['bonds','Bonds — who/what you care about'],['flaws','Flaws']].map(([k, l]) =>
        `<label>${l}</label><textarea data-p="${k}" rows="2">${esc(W.persona[k])}</textarea>`).join('')}`;
    body.querySelectorAll('[data-p]').forEach(t => t.oninput = () => { W.persona[t.dataset.p] = t.value; W.personaTouched = true; saveDraft(); });
  };

  // ---------- build the character document ----------
  function buildCharacter(){
    const base = PlayerApp.blankCharacter(W.name.trim());
    const fs = finalScores();
    const g = (WZ.GEAR[W.cls] || [])[W.gear] || { items:[], ac:{kind:'none'} };
    const hit = DND.CLASS_HIT_DIE[W.cls];
    const hpMax = Math.max(1, hit + mod(fs.con) + (is2014() && W.race === 'Dwarf (Hill)' ? 1 : 0));
    const skillProf = {};
    [...W.skills, ...W.extraRaceSkills, ...bgSkills(), ...raceSkillsFixed()].forEach(s => { skillProf[s] = 1; });
    const saveProf = {}; (DND.CLASS_SAVE_PROFS[W.cls] || []).forEach(a => saveProf[a] = true);

    // inventory (gear package + background kit); "×N" suffix becomes quantity; "N gp" becomes gold
    let gold = 0;
    const inv = {};
    const addItem = (raw) => {
      let name = String(raw).trim(); if(!name) return;
      const gp = name.match(/^(\d+)\s*gp$/i); if(gp){ gold += +gp[1]; return; }
      let qty = 1; const m = name.match(/^(.*?)\s*[×x]\s*(\d+)$/); if(m){ name = m[1]; qty = +m[2]; }
      name = name.charAt(0).toUpperCase() + name.slice(1);
      inv[name] = (inv[name] || 0) + qty;
    };
    if(W.gearMode === 'buy'){ Object.keys(W.cart).forEach(n => { inv[n] = (inv[n] || 0) + W.cart[n].qty; }); }
    else g.items.forEach(addItem);
    const b = localBg(); if(b && b.equipment) b.equipment.split(',').forEach(addItem);
    const inventory = Object.keys(inv).map(n => ({ name:n, quantity:inv[n] }));

    // spells
    const spells = [];
    if(castsAtL1()){
      const c = spellCaps();
      W.cantrips.forEach(n => spells.push({ name:n, level:0, prepared:true }));
      W.l1.forEach((n, i) => spells.push({ name:n, level:1, prepared: c.style === 'book' ? i < c.prepared : true }));
    }

    // proficiencies text (same style the sheet writes itself)
    const profLines = [];
    const allSk = Object.keys(skillProf); if(allSk.length) profLines.push('Skills: ' + allSk.join(', '));
    if(b && b.tools && b.tools !== 'None') profLines.push('Tools: ' + b.tools);
    if(b && b.languages && b.languages !== 'None') profLines.push('Languages: ' + b.languages);

    const feats = [];
    if(W.isCustom && W.customTraits.trim()) feats.push({ name: W.race + ' traits', desc: W.customTraits.trim() });
    else if(!W.isCustom && !DND.RACE_TRAITS[W.race] && WZ.SPECIES_EXTRA[W.race]) feats.push({ name: W.race, desc: WZ.SPECIES_EXTRA[W.race] + ' (Add the exact traits from your book here.)' });
    if(b && b.feature) feats.push({ name: b.feature, desc: b.featureDesc || '' });

    return Object.assign(base, {
      name: W.name.trim(), level:1, class:W.cls, subclass: needsSub() ? W.sub : '', race:W.race, background:W.bg, ruleset:W.ruleset,
      stats: fs, hp_current:hpMax, hp_max:hpMax, ac: currentAc(fs),
      speed: WZ.RACE_SPEED[W.race] || 30, gold: gold + (W.gearMode === 'buy' ? Math.max(0, Math.floor(goldLeft())) : 0), skillProf, saveProf,
      proficiencies: profLines.join('\n'), feats, spells, inventory,
      personality: Object.assign({}, W.persona),
      choices: Object.fromEntries(Object.entries(W.choices || {}).map(([k, v]) => [k, [...v]])),
      notes: ''
    });
  }

  function create(){
    const btn = $('#wzNext'); btn.classList.add('disabled'); btn.textContent = 'Creating…';
    let data;
    try{ data = buildCharacter(); }catch(e){ btn.classList.remove('disabled'); btn.textContent = 'Create character ✓'; UI.alert(e.message, { title:'Something went wrong building the character' }); return; }
    PlayerApp.createCharacter(data).then(id => { clearDraft(); W = null; PlayerApp.openCharSheet(id); })
      .catch(err => { btn.classList.remove('disabled'); btn.textContent = 'Create character ✓'; UI.alert(err.message, { title:'Could not save the character' }); });
  }

  // ---------- public ----------
  async function start(){
    const draft = loadDraft();
    const hasDraft = draft && draft.W && (draft.W.name || draft.W.cls);
    const resume = hasDraft && await UI.confirm((draft.W.name ? '“' + draft.W.name + '”' : 'Your character') + ' is partly built. Pick up where you left off?', { title:'Unfinished character', ok:'Continue', cancel:'Start over' });
    if(resume){ W = Object.assign(freshState(), draft.W); stepIdx = draft.stepIdx || 0; }
    else { W = freshState(); stepIdx = 0; clearDraft(); }
    classFilter = 'all';
    PlayerApp.show('wizardScreen');
    render(); window.scrollTo(0, 0);
  }
  window.Wizard = { start, _buildForTest: () => buildCharacter(), _state: () => W };

  // ---------- styles (mobile first) ----------
  const css = `
  #wizardScreen{ padding:16px; }
  .wzTop{ display:flex; align-items:center; gap:12px; margin-bottom:10px; }
  .wzX{ background:none; border:1px solid var(--border); color:var(--text-dim); border-radius:8px; width:40px; height:40px; font-size:16px; cursor:pointer; flex-shrink:0; }
  .wzProg{ flex:1; height:8px; background:#0d1318; border:1px solid var(--border); border-radius:8px; overflow:hidden; }
  .wzProgBar{ height:100%; background:var(--accent); transition:width .25s; }
  .wzStepNum{ font-size:12px; color:var(--text-dim); min-width:34px; text-align:right; }
  .wzTitle{ font-family:'Cinzel',serif; color:var(--accent-bright); font-size:20px; margin:6px 0 12px; }
  .wzLead{ color:var(--text); font-size:14px; line-height:1.5; margin:0 0 12px; }
  .wzNote{ color:var(--text-dim); font-size:12.5px; line-height:1.5; margin:12px 0 0; }
  .wzDim{ color:var(--text-dim); font-size:12px; }
  .wzBody label{ display:block; margin:12px 0 6px; font-size:13px; color:var(--text-dim); }
  .wzBody input[type=text], .wzBody select, .wzBody textarea{ font-size:16px; }
  .wzTwo{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .wzChoice{ background:#0d1318; border:2px solid var(--border); color:var(--text); border-radius:10px; padding:14px 10px; cursor:pointer; text-align:center; min-height:56px; font-size:14px; }
  .wzChoice span{ display:block; color:var(--text-dim); font-size:11.5px; margin-top:4px; }
  .wzChoice.sel{ border-color:var(--accent); background:#0f2328; }
  .wzFilters{ display:flex; gap:6px; overflow-x:auto; padding-bottom:8px; margin-bottom:6px; -webkit-overflow-scrolling:touch; }
  .wzFilters .chip{ flex-shrink:0; min-height:36px; }
  .wzGrid{ display:grid; grid-template-columns:1fr; gap:10px; }
  .wzGrid.wzSmall{ grid-template-columns:1fr 1fr; }
  .wzCard{ background:#0d1318; border:2px solid var(--border); border-radius:10px; padding:12px; cursor:pointer; min-height:48px; }
  .wzCard:hover{ border-color:#3a5260; }
  .wzCard.sel{ border-color:var(--accent); background:#0f2328; }
  .wzCardTop{ display:flex; justify-content:space-between; align-items:center; gap:8px; }
  .wzCard b{ font-size:14.5px; color:var(--text); }
  .wzTag{ color:var(--text-dim); font-size:12.5px; line-height:1.45; margin-top:4px; }
  .wzDiff{ font-size:10.5px; padding:2px 8px; border-radius:20px; border:1px solid var(--border); white-space:nowrap; color:var(--text-dim); }
  .wzDiff.d1{ color:#7fd6a0; border-color:#2f6b49; } .wzDiff.d2{ color:#e0c26a; border-color:#6b5a2a; } .wzDiff.d3{ color:#e29a7a; border-color:#6b402f; }
  .wzDoes{ margin:8px 0 6px; padding-left:18px; color:var(--text); font-size:12.5px; line-height:1.55; }
  .wzKey{ font-size:12px; color:var(--text-dim); margin-top:4px; } .wzKey b{ font-size:12px; color:var(--text); }
  .wzFeat{ margin-top:8px; font-size:12.5px; color:var(--text); } .wzFeat p{ margin:6px 0 0; color:var(--text-dim); line-height:1.5; } .wzFeat > b{ font-size:12px; }
  .wzInfo{ background:#0d1318; border:1px solid var(--border); border-radius:10px; padding:12px; margin-top:12px; font-size:13px; }
  .wzInfo p{ margin:6px 0 0; color:var(--text-dim); line-height:1.5; font-size:12.5px; }
  .wzPickRow{ display:flex; align-items:center; gap:10px; margin-top:8px; } .wzPickRow span{ min-width:62px; color:var(--text); font-size:13px; }
  .wzPickRow select{ margin-top:0; }
  .wzBtnRow{ display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px; } .wzBtnRow .btn{ margin-top:0; min-height:42px; }
  .wzAbList{ display:grid; grid-template-columns:1fr; gap:10px; }
  .wzAb{ background:#0d1318; border:1px solid var(--border); border-radius:10px; padding:10px 12px; }
  .wzAb.top{ border-color:#2f6a74; }
  .wzAbHead{ display:flex; justify-content:space-between; align-items:center; } .wzAbMod{ font-family:'Cinzel',serif; font-size:20px; color:var(--accent-bright); }
  .wzAbHelp{ font-size:11.5px; color:var(--text-dim); margin:2px 0 8px; }
  .wzAbRow{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; } .wzAbRow select{ width:90px; margin-top:0; }
  .wzAbRow input.wzNum{ width:90px; margin-top:0; text-align:center; } .wzAbRow input.wzNum.bad{ border-color:var(--danger); }
  .wzBtnRow .btn.on{ border-color:var(--accent); color:var(--accent-bright); }
  .wzCheck{ display:flex !important; align-items:center; gap:8px; text-transform:none; letter-spacing:0; font-size:12.5px; margin:0 0 12px; cursor:pointer; }
  .wzCheck input{ width:20px; height:20px; margin:0; flex-shrink:0; }
  .wzRollLog p{ margin:4px 0 0; } .wzRollLog .drop{ text-decoration:line-through; opacity:.45; } .wzRollLog sup{ color:#e0c26a; }
  .wzBudget{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:12px; } .wzBudget label{ margin:0 !important; } .wzBudget input{ width:100px; margin-top:0; }
  .wzLeft{ margin-left:auto; font-size:14px; color:var(--text-dim); } .wzLeft b{ color:#7fd6a0; font-size:17px; } .wzLeft b.over{ color:var(--danger); }
  .wzShopList{ display:grid; gap:6px; margin-top:8px; }
  .wzShopRow{ display:flex; align-items:center; justify-content:space-between; gap:10px; background:#0d1318; border:1px solid var(--border); border-radius:10px; padding:8px 10px; min-height:48px; }
  .wzShopName{ min-width:0; } .wzShopName b{ font-size:13.5px; display:block; overflow:hidden; text-overflow:ellipsis; } .wzShopName small{ color:var(--text-dim); font-size:11.5px; }
  .wzAdd, .wzQty button{ width:40px; height:40px; border-radius:8px; border:1px solid var(--border); background:var(--accent); color:#06171a; font-size:18px; cursor:pointer; flex-shrink:0; }
  .wzQty{ display:flex; align-items:center; gap:8px; flex-shrink:0; } .wzQty button{ background:#0d1318; color:var(--text); } .wzQty span{ min-width:18px; text-align:center; }
  .wzMore{ margin-top:12px; } .wzMore summary{ cursor:pointer; color:var(--accent-bright); font-size:13px; padding:6px 0; }
  .wzBonus{ font-size:11.5px; color:#7fd6a0; } .wzTotal{ margin-left:auto; font-size:12.5px; color:var(--text-dim); } .wzTotal b{ color:var(--text); font-size:15px; }
  .wzSkillGrid{ display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .wzSkill{ background:#0d1318; border:2px solid var(--border); color:var(--text); border-radius:10px; padding:10px 12px; min-height:46px; font-size:13.5px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; text-align:left; }
  .wzSkill small{ color:var(--text-dim); font-size:10.5px; }
  .wzSkill.sel{ border-color:var(--accent); background:#0f2328; }
  .wzSkill.locked{ opacity:.35; cursor:not-allowed; }
  .wzCount{ color:var(--accent-bright); font-size:13px; font-weight:600; }
  .wzH{ font-size:15px; margin:18px 0 4px; color:var(--text); }
  .wzSpellGrid{ display:grid; grid-template-columns:1fr; gap:8px; margin-top:8px; }
  .wzSpell{ background:#0d1318; border:2px solid var(--border); border-radius:10px; padding:10px 12px; cursor:pointer; min-height:48px; }
  .wzSpell small{ display:block; color:var(--text-dim); font-size:12px; margin-top:3px; line-height:1.4; }
  .wzSpell.sel{ border-color:var(--accent); background:#0f2328; } .wzSpell.full{ opacity:.4; }
  .wzSpell b{ font-size:13.5px; } .wzStar{ margin-left:8px; font-size:10.5px; color:#e0c26a; }
  .wzSummary{ background:#0d1318; border:1px solid var(--border); border-radius:12px; padding:14px; margin-bottom:16px; }
  .wzSumName{ font-family:'Cinzel',serif; font-size:20px; color:var(--accent-bright); }
  .wzSumSub{ color:var(--text-dim); font-size:13px; margin:2px 0 12px; }
  .wzStats{ display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:10px; }
  .wzStats div, .wzAbMini div{ background:var(--panel); border:1px solid var(--border); border-radius:8px; text-align:center; padding:8px 4px; }
  .wzStats b{ display:block; font-size:18px; } .wzStats span, .wzAbMini span{ font-size:10.5px; color:var(--text-dim); }
  .wzAbMini{ display:grid; grid-template-columns:repeat(6,1fr); gap:6px; } .wzAbMini b{ display:block; font-size:15px; } .wzAbMini small{ color:var(--accent-bright); font-size:11px; }
  .wzNav{ display:flex; gap:10px; margin-top:20px; position:sticky; bottom:0; padding:12px 0 6px; background:linear-gradient(transparent, var(--panel) 28%); }
  .wzNav .btn{ margin-top:0; min-height:48px; font-size:15px; } .wzBack{ flex:1; } .wzNext{ flex:2; }
  .wzNext.disabled{ opacity:.45; }
  .wzHint{ min-height:18px; font-size:12.5px; color:#e0a83f; text-align:center; margin-top:4px; }
  @media (min-width:700px){
    .wzGrid{ grid-template-columns:1fr 1fr; } .wzGrid.wzSmall{ grid-template-columns:repeat(3,1fr); }
    .wzSkillGrid{ grid-template-columns:repeat(3,1fr); } .wzSpellGrid{ grid-template-columns:1fr 1fr; }
    .wzAbList{ grid-template-columns:1fr 1fr; } #wizardScreen{ padding:24px; }
  }
  @media (max-width:380px){
    .wzAbMini{ grid-template-columns:repeat(3,1fr); } .wzSkillGrid{ grid-template-columns:1fr; } .wzGrid.wzSmall{ grid-template-columns:1fr; }
  }`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
})();