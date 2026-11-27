// In-page replacements for alert() / confirm() / prompt().
// Browser popups are blocked or ugly inside many phone browsers and chat-app webviews,
// so everything uses these themed dialogs instead. All return Promises.
//   UI.alert(message, {title})                    -> Promise<void>
//   UI.confirm(message, {title, ok, cancel, danger}) -> Promise<boolean>
//   UI.prompt(message, {value, placeholder, ok, readonly}) -> Promise<string|null>
(function(){
  const css = `
  .uiBackdrop{ position:fixed; inset:0; background:rgba(3,6,9,.72); display:flex; align-items:center; justify-content:center; padding:16px; z-index:10000; animation:uiFade .12s ease-out; }
  .uiBox{ width:100%; max-width:420px; background:#121a21; border:1px solid #2a3944; border-radius:14px; padding:18px; box-shadow:0 18px 50px rgba(0,0,0,.55); color:#d9e1e6; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; max-height:90vh; overflow:auto; }
  .uiTitle{ font-family:'Cinzel',serif; color:#7ad4e0; font-size:17px; margin:0 0 8px; }
  .uiMsg{ font-size:14px; line-height:1.55; white-space:pre-wrap; word-wrap:break-word; margin:0; color:#d9e1e6; }
  .uiInput{ width:100%; margin-top:12px; padding:12px; font-size:16px; border-radius:8px; border:1px solid #2a3944; background:#0d1318; color:#d9e1e6; font-family:inherit; box-sizing:border-box; }
  .uiInput:focus{ outline:none; border-color:#4fb8c9; }
  .uiBtns{ display:flex; gap:10px; margin-top:16px; justify-content:flex-end; }
  .uiBtns button{ flex:1; min-height:46px; padding:10px 14px; border-radius:8px; border:1px solid #2a3944; background:#0d1318; color:#d9e1e6; font-size:14px; font-weight:600; cursor:pointer; font-family:inherit; }
  .uiBtns button.uiOk{ background:#4fb8c9; border-color:#4fb8c9; color:#06171a; }
  .uiBtns button.uiDanger{ background:#d1605a; border-color:#d1605a; color:#fff; }
  .uiBtns button:focus-visible{ outline:2px solid #7ad4e0; outline-offset:2px; }
  .uiToast{ position:fixed; left:50%; bottom:24px; transform:translateX(-50%); background:#121a21; border:1px solid #4fb8c9; color:#d9e1e6; padding:12px 18px; border-radius:10px; font-size:14px; z-index:10001; max-width:90vw; box-shadow:0 8px 30px rgba(0,0,0,.5); }
  @keyframes uiFade{ from{opacity:0} to{opacity:1} }`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function open(build){
    return new Promise(resolve => {
      const prevFocus = document.activeElement;
      const back = document.createElement('div'); back.className = 'uiBackdrop';
      const box = document.createElement('div'); box.className = 'uiBox'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
      back.appendChild(box);
      const close = val => { document.removeEventListener('keydown', onKey, true); back.remove(); try{ prevFocus && prevFocus.focus && prevFocus.focus(); }catch(e){} resolve(val); };
      const ctl = build(box, close);
      function onKey(e){
        if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); close(ctl.cancelValue); }
        else if(e.key === 'Enter' && !(e.target && e.target.tagName === 'BUTTON')){ e.preventDefault(); ctl.submit(); }
        else if(e.key === 'Tab'){ // keep focus inside the dialog
          const f = box.querySelectorAll('button, input'); if(!f.length) return;
          const first = f[0], last = f[f.length - 1];
          if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
          else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
        }
      }
      document.addEventListener('keydown', onKey, true);
      back.addEventListener('mousedown', e => { if(e.target === back && ctl.dismissable) close(ctl.cancelValue); });
      document.body.appendChild(back);
      if(ctl.focus) ctl.focus();
    });
  }
  const el = (tag, cls, text) => { const e = document.createElement(tag); if(cls) e.className = cls; if(text != null) e.textContent = text; return e; };

  window.UI = {
    alert(message, o){
      o = o || {};
      return open((box, close) => {
        if(o.title) box.appendChild(el('h3', 'uiTitle', o.title));
        box.appendChild(el('p', 'uiMsg', message));
        const row = el('div', 'uiBtns'); const ok = el('button', 'uiOk', o.ok || 'OK'); row.appendChild(ok); box.appendChild(row);
        ok.onclick = () => close(undefined);
        return { submit: () => close(undefined), cancelValue: undefined, dismissable: true, focus: () => ok.focus() };
      });
    },
    confirm(message, o){
      o = o || {};
      return open((box, close) => {
        if(o.title) box.appendChild(el('h3', 'uiTitle', o.title));
        box.appendChild(el('p', 'uiMsg', message));
        const row = el('div', 'uiBtns');
        const no = el('button', '', o.cancel || 'Cancel'), yes = el('button', o.danger ? 'uiDanger' : 'uiOk', o.ok || 'OK');
        row.appendChild(no); row.appendChild(yes); box.appendChild(row);
        no.onclick = () => close(false); yes.onclick = () => close(true);
        return { submit: () => close(true), cancelValue: false, dismissable: true, focus: () => (o.danger ? no : yes).focus() };
      });
    },
    prompt(message, o){
      o = o || {};
      return open((box, close) => {
        box.appendChild(el('p', 'uiMsg', message));
        const inp = el('input', 'uiInput'); inp.type = 'text'; inp.value = o.value || ''; inp.placeholder = o.placeholder || ''; inp.autocomplete = 'off';
        if(o.readonly) inp.readOnly = true;
        box.appendChild(inp);
        const row = el('div', 'uiBtns');
        const no = el('button', '', o.readonly ? 'Close' : 'Cancel'), yes = el('button', 'uiOk', o.ok || 'OK');
        row.appendChild(no); if(!o.readonly) row.appendChild(yes); box.appendChild(row);
        no.onclick = () => close(null); yes.onclick = () => close(inp.value);
        return { submit: () => close(o.readonly ? null : inp.value), cancelValue: null, dismissable: true,
                 focus: () => { inp.focus(); inp.select(); } };
      });
    },
    toast(message, ms){
      const t = el('div', 'uiToast', message); t.setAttribute('role', 'status'); document.body.appendChild(t);
      setTimeout(() => t.remove(), ms || 2600);
    }
  };
})();