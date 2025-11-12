// ==UserScript==
// @name         Neopets - Retire Pets (quickref & training)
// @namespace    https://www.neopets.com/
// @version      1.5
// @description  "retire" your pets from trainning, available on island, pirate, secret ninja, and quickref.
// @author       laurore
// @match        https://www.neopets.com/quickref.phtml*
// @match        https://www.neopets.com/island/training.phtml*type=status
// @match        https://www.neopets.com/island/fight_training.phtml*type=status
// @match        https://www.neopets.com/pirates/academy.phtml?*type=status
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'neopets_retired_pets_v1';
  const TEMP_SHOW_MS = 8000;
  const PROCESS_DEBOUNCE_MS = 1000;

  // ---------- Storage helpers ----------
  function loadRetired() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw || '[]') || [];
    } catch (e) { console.error('Failed to load retired pets:', e); return []; }
  }
  function saveRetired(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set(list.map(n => n.trim()))])); }
    catch (e) { console.error('Failed to save retired pets:', e); }
  }
  function normalizeName(name) { return (name || '').toLowerCase().trim(); }
  function isRetired(name) { if (!name) return false; return loadRetired().some(x => normalizeName(x) === normalizeName(name)); }
  function addRetired(name) { if (!name) return; const list = loadRetired(); list.push(name); saveRetired(list); }
  function removeRetired(name) { if (!name) return; const n = normalizeName(name); saveRetired(loadRetired().filter(x => normalizeName(x) !== n)); }

  // ---------- UI helpers ----------
  function createPanel() {
    const panel = document.createElement('div');
    panel.id = 'retired-pets-panel';
    Object.assign(panel.style, {
      position: 'fixed', left: '12px', bottom: '12px', zIndex: 9999,
      background: 'rgba(255,255,255,0.95)', border: '1px solid #888',
      padding: '8px', boxShadow: '0 2px 8px rgba(0,0,0,.2)',
      maxWidth: '420px', fontSize: '13px', fontFamily: 'Arial,sans-serif',
      borderRadius: '6px', maxHeight: '70vh', overflow: 'auto'
    });
    return panel;
  }
  function smallBtn(text) {
    const b = document.createElement('button');
    b.textContent = text;
    Object.assign(b.style, { margin: '4px 6px 4px 0', border: '1px solid #666', background: '#f1f1f1', padding: '4px 8px', cursor: 'pointer', borderRadius: '4px', fontSize: '12px' });
    return b;
  }

  // ---------- Quickref (unchanged) ----------
  function enhanceQuickref() {
    const anchors = Array.from(document.querySelectorAll('a[href*="/petlookup.phtml?pet="]'));
    if (!anchors.length) return;
    const panel = createPanel(); panel.style.maxWidth = '520px';
    panel.innerHTML = '<div><b>Retire from training — quickref</b></div>';
    const hint = document.createElement('div'); hint.style.fontSize='12px'; hint.style.marginBottom='6px';
    hint.textContent = 'Toggle to retire/un-retire a pet. Retired pets will be hidden on training status pages.'; panel.appendChild(hint);
    const listContainer = document.createElement('div'); listContainer.style.maxHeight='38vh'; listContainer.style.overflow='auto'; panel.appendChild(listContainer);
    document.body.appendChild(panel);

    function rebuildPanelList() {
      listContainer.innerHTML = '';
      const retired = loadRetired();
      if (!retired.length) { const empty = document.createElement('div'); empty.style.fontSize='12px'; empty.style.opacity='0.8'; empty.textContent='No retired pets yet.'; listContainer.appendChild(empty); return; }
      retired.slice().sort((a,b)=>a.localeCompare(b)).forEach(name => {
        const row = document.createElement('div'); row.style.display='flex'; row.style.justifyContent='space-between'; row.style.alignItems='center'; row.style.marginBottom='4px';
        const nm = document.createElement('span'); nm.textContent = name; nm.style.fontSize='13px'; row.appendChild(nm);
        const ubtn = smallBtn('Un-retire'); ubtn.onclick = () => { removeRetired(name); anchors.forEach(a=>{ const pet = extractPetnameFromAnchor(a); if (normalizeName(pet)===normalizeName(name)){ const cb = a.nextSibling && a.nextSibling.querySelector ? a.nextSibling.querySelector('input[type=checkbox]') : null; if(cb) cb.checked=false; } }); rebuildPanelList(); };
        row.appendChild(ubtn); listContainer.appendChild(row);
      });
    }

    anchors.forEach(a => {
      const petname = extractPetnameFromAnchor(a);
      if (!petname) return;
      if (a.dataset.retireAdded) return;
      a.dataset.retireAdded = '1';
      const wrapper = document.createElement('span'); wrapper.style.marginLeft='6px'; wrapper.style.display='inline-block'; wrapper.style.verticalAlign='middle';
      const cb = document.createElement('input'); cb.type='checkbox'; cb.title='Mark pet as retired from training'; cb.style.verticalAlign='middle'; cb.checked = isRetired(petname);
      cb.addEventListener('click', function(ev){ ev.stopPropagation(); ev.preventDefault(); if (this.checked) addRetired(petname); else removeRetired(petname); rebuildPanelList(); });
      const lbl = document.createElement('span'); lbl.textContent=' retired'; lbl.style.fontSize='12px'; lbl.style.marginLeft='4px'; lbl.style.verticalAlign='middle'; lbl.style.opacity = cb.checked ? '1' : '0.6';
      cb.addEventListener('change', ()=>{ lbl.style.opacity = cb.checked ? '1' : '0.6'; });
      wrapper.appendChild(cb); wrapper.appendChild(lbl); a.parentNode.insertBefore(wrapper, a.nextSibling);
    });

    rebuildPanelList();
  }
  function extractPetnameFromAnchor(a) {
    if (!a || !a.href) return null;
    try { const url = new URL(a.href, location.origin); if (url.pathname.endsWith('/petlookup.phtml') && url.searchParams.get('pet')) return url.searchParams.get('pet').trim(); }
    catch(e){}
    return (a.textContent || '').trim() || null;
  }

  // ---------- Training page (fixed active-list behavior) ----------
  function enhanceTrainingPage() {
    const panel = createPanel(); panel.style.left='12px'; panel.style.bottom='12px'; panel.innerHTML = '<b>Retired Pets — Training</b>';

    // Controls
    const controlsDiv = document.createElement('div'); controlsDiv.style.marginTop='6px';
    const showAllBtn = smallBtn('Show retired temporarily'); const hideAllBtn = smallBtn('Hide retired');
    controlsDiv.appendChild(showAllBtn); controlsDiv.appendChild(hideAllBtn);
    panel.appendChild(controlsDiv);

    // Active select
    const activeLabel = document.createElement('div'); activeLabel.style.fontSize='12px'; activeLabel.style.marginTop='8px'; activeLabel.textContent='Active pets on page:';
    panel.appendChild(activeLabel);
    const activeSelect = document.createElement('select'); activeSelect.multiple=true; activeSelect.size=6; activeSelect.style.width='50%'; activeSelect.style.marginTop='6px'; activeSelect.style.boxSizing='border-box'; activeSelect.style.overflowY='auto';
    panel.appendChild(activeSelect);

    const activeBtns = document.createElement('div'); activeBtns.style.marginTop='8px';
    const retireSelectedBtn = smallBtn('Retire selected'); const retireAllBtn = smallBtn('Retire all');
    activeBtns.appendChild(retireSelectedBtn); activeBtns.appendChild(retireAllBtn); panel.appendChild(activeBtns);

    // Retired select
    const selectLabel = document.createElement('div'); selectLabel.style.fontSize='12px'; selectLabel.style.marginTop='12px'; selectLabel.textContent='Retired pets:';
    panel.appendChild(selectLabel);
    const retiredSelect = document.createElement('select'); retiredSelect.multiple=true; retiredSelect.size=8; retiredSelect.style.width='50%'; retiredSelect.style.marginTop='6px'; retiredSelect.style.boxSizing='border-box'; retiredSelect.style.overflowY='auto';
    panel.appendChild(retiredSelect);

    const dropdownBtns = document.createElement('div'); dropdownBtns.style.marginTop='8px';
    const unretireSelectedBtn = smallBtn('Un-retire selected'); const unretireAllBtn = smallBtn('Un-retire all');
    dropdownBtns.appendChild(unretireSelectedBtn); dropdownBtns.appendChild(unretireAllBtn); panel.appendChild(dropdownBtns);

    const hint = document.createElement('div'); hint.style.fontSize='12px'; hint.style.opacity='0.9'; hint.style.marginTop='8px'; hint.textContent = 'Select one or more (shft, ctrl / cmm, option) '; panel.appendChild(hint);
    const hint2 = document.createElement('div'); hint2.style.fontSize='12px'; hint2.style.opacity='0.9'; hint2.style.marginTop='16px'; hint2.textContent = 'and use the buttons to (un-)retire.'; panel.appendChild(hint2);

    document.body.appendChild(panel);

    // interaction guards
    let userInteractingWithActive = false, userInteractingWithRetired = false;
    function attachInteractionGuards(selectElem, flagSetter) {
      if (!selectElem) return;
      const setTrue = ()=>flagSetter(true); const setFalse = ()=>flagSetter(false);
      selectElem.addEventListener('focus', setTrue, true);
      selectElem.addEventListener('mousedown', setTrue, true);
      selectElem.addEventListener('mouseenter', setTrue, true);
      selectElem.addEventListener('blur', setFalse, true);
      selectElem.addEventListener('mouseup', setFalse, true);
      selectElem.addEventListener('mouseleave', setFalse, true);
    }
    attachInteractionGuards(activeSelect, v => userInteractingWithActive = v);
    attachInteractionGuards(retiredSelect, v => userInteractingWithRetired = v);

    // preserve select state helper
    let lastRetiredJson = '', lastActiveJson = '';
    function rebuildSelectPreserve(selectElem, items, placeholderText) {
      if (!selectElem) return;
      const interacting = (selectElem === activeSelect) ? userInteractingWithActive : userInteractingWithRetired;
      const itemsJson = JSON.stringify(items || []);
      const lastJson = (selectElem === activeSelect) ? lastActiveJson : lastRetiredJson;
      if (interacting) return; // don't rebuild while interacting
      if (itemsJson === lastJson) return;
      const prevSelected = Array.from(selectElem.selectedOptions || []).map(o=>o.value);
      const prevScroll = selectElem.scrollTop || 0;
      selectElem.innerHTML = '';
      if (!items || items.length === 0) {
        const opt = document.createElement('option'); opt.textContent = placeholderText || '(none)'; opt.disabled=true; selectElem.appendChild(opt);
      } else {
        items.forEach(name => { const opt = document.createElement('option'); opt.value = name; opt.textContent = name; if (prevSelected.includes(name)) opt.selected = true; selectElem.appendChild(opt); });
      }
      setTimeout(()=>{ try { selectElem.scrollTop = prevScroll; Array.from(selectElem.options).forEach(opt=>{ if(prevSelected.includes(opt.value)) opt.selected = true; }); } catch(e){} }, 0);
      if (selectElem === activeSelect) lastActiveJson = itemsJson; else lastRetiredJson = itemsJson;
    }

    function rebuildRetiredSelect() { const retired = loadRetired().slice().sort((a,b)=>a.localeCompare(b)); rebuildSelectPreserve(retiredSelect, retired, '(no retired pets)'); }
    function rebuildActiveSelect(activeNames) { const unique = Array.from(new Set((activeNames||[]).map(n=> (n||'').trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b)); rebuildSelectPreserve(activeSelect, unique, '(no active pets found)'); }

    // show temporarily
    showAllBtn.onclick = () => {
      const hidden = Array.from(document.querySelectorAll('[data-retired-hidden="1"]'));
      if (!hidden.length) return;
      hidden.forEach(el=>{ try{ el.style.display=''; el.dataset.tempShown='1'; }catch(e){} });
      setTimeout(()=>{ const tempEls = Array.from(document.querySelectorAll('[data-temp-shown="1"]')); tempEls.forEach(el=>{ try{ delete el.dataset.tempShown; }catch(e){} }); scheduleProcessTrainingList(true); }, TEMP_SHOW_MS);
    };
      hideAllBtn.onclick = () => {
          const retiredRows = Array.from(document.querySelectorAll('[data-retired-hidden="1"], tr[data-placeholder-by]'));
          retiredRows.forEach(el => {
              try {
                  el.style.display = 'none';
                  el.dataset.retiredHidden = '1';
                  delete el.dataset.tempShown;
              } catch(e){}
          });
          scheduleProcessTrainingList(true);
      };




    // retire/unretire actions — force immediate refresh so active list updates now
    retireSelectedBtn.onclick = () => { const selected = Array.from(activeSelect.selectedOptions||[]).map(o=>o.value).filter(Boolean); if (!selected.length) return; selected.forEach(name=>addRetired(name)); scheduleProcessTrainingList(true); rebuildRetiredSelect(); };
    retireAllBtn.onclick = () => { const all = Array.from(activeSelect.options||[]).map(o=>o.value).filter(Boolean); if (!all.length) return; all.forEach(name=>addRetired(name)); scheduleProcessTrainingList(true); rebuildRetiredSelect(); };
    unretireSelectedBtn.onclick = () => { const selected = Array.from(retiredSelect.selectedOptions||[]).map(o=>o.value).filter(Boolean); if (!selected.length) return; selected.forEach(name=>removeRetired(name)); scheduleProcessTrainingList(true); rebuildRetiredSelect(); };
    unretireAllBtn.onclick = () => { loadRetired().forEach(n=>removeRetired(n)); scheduleProcessTrainingList(true); rebuildRetiredSelect(); };

    // ---- processing logic (robust detection) ----
    let processTimer = null;
    function scheduleProcessTrainingList(forceImmediate=false) {
      if (processTimer) clearTimeout(processTimer);
      if (forceImmediate) processTrainingList(); else processTimer = setTimeout(processTrainingList, PROCESS_DEBOUNCE_MS);
    }

    function processTrainingList() {
      // Build sets from both bolds and anchors (union). This avoids missing pets when markup varies.
      const activeNamesSet = new Set();

      // 1) detect via <b> "NAME (Level N)" pattern
      const bolds = Array.from(document.querySelectorAll('b'));
      bolds.forEach(b => {
        const txt = (b.textContent||'').trim();
        const m = txt.match(/^(.+?)\s*\(Level\s*\d+\).*$/i);
        if (!m) return;
        const petname = m[1].trim();
        if (!petname) return;
        const tr = b.closest('tr');
        if (isRetired(petname)) {
          if (tr && tr.dataset && tr.dataset.tempShown === '1') activeNamesSet.add(petname);
          else if (tr) hideRowAndNext(tr, petname);
        } else {
          if (tr && tr.dataset && tr.dataset.retiredHidden === '1') { tr.style.display=''; delete tr.dataset.retiredHidden; }
          const next = tr ? tr.nextElementSibling : null;
          if (next && next.dataset && next.dataset.retiredHidden === '1') { next.style.display=''; delete next.dataset.retiredHidden; }
          activeNamesSet.add(petname);
        }
      });

      // 2) also detect via anchors (petlookup links) to catch pages that don't use the same <b> markup
      const anchors = Array.from(document.querySelectorAll('a[href*="/petlookup.phtml?pet="]'));
      anchors.forEach(a => {
        const pn = extractPetnameFromAnchor(a);
        if (!pn) return;
        const tr = a.closest('tr') || a.parentElement;
        if (isRetired(pn)) {
          if (tr && tr.dataset && tr.dataset.tempShown === '1') activeNamesSet.add(pn);
          else if (tr) hideRowAndNext(tr, pn);
        } else {
          activeNamesSet.add(pn);
          if (tr && tr.dataset && tr.dataset.retiredHidden === '1') { tr.style.display=''; delete tr.dataset.retiredHidden; }
        }
      });

      // Now update selects with union of detected active names
      const activeNames = Array.from(activeNamesSet);
      rebuildActiveSelect(activeNames);
      rebuildRetiredSelect();
    }

    function hideRowAndNext(rowOrElem, petname) {
      let row = rowOrElem;
      if (row && row.tagName && row.tagName.toLowerCase() !== 'tr') {
        const maybeTr = row.closest && row.closest('tr');
        if (maybeTr) row = maybeTr;
      }
      if (!row) return;
      if (row.dataset && row.dataset.retiredHidden === '1') return;
      try { row.style.display='none'; row.dataset.retiredHidden = '1'; } catch(e){}
      const next = row.nextElementSibling;
      if (next) { try { next.style.display='none'; next.dataset.retiredHidden='1'; } catch(e){} }

      if (!row.parentNode) return;
      const existingPh = Array.from(row.parentNode.querySelectorAll('tr[data-placeholder-by]')).find(tr=>tr.dataset.placeholderBy && normalizeName(tr.dataset.placeholderBy)===normalizeName(petname));
      if (existingPh) { if (existingPh.dataset.tempShown === '1') existingPh.style.display=''; else existingPh.style.display=''; return; }
      const placeholder = document.createElement('tr'); placeholder.dataset.placeholder='1'; placeholder.dataset.placeholderBy = petname;
      const td = document.createElement('td'); td.colSpan = 3; td.style.background='#fff4f0'; td.style.border='1px dashed #e07a00'; td.style.padding='6px'; td.style.fontSize='13px';
      td.innerHTML = `<b>${escapeHtml(petname)}</b> — retired from training &nbsp;`;
      const unbtn = document.createElement('button'); unbtn.textContent='Un-retire'; unbtn.style.marginLeft='8px'; unbtn.style.cursor='pointer';
      unbtn.onclick = (ev)=>{ ev.stopPropagation(); removeRetired(petname); try{ placeholder.remove(); }catch(e){} try{ row.style.display=''; delete row.dataset.retiredHidden; if(next){ next.style.display=''; delete next.dataset.retiredHidden; } }catch(e){} scheduleProcessTrainingList(true); };
      td.appendChild(unbtn); placeholder.appendChild(td);
      try{ row.parentNode.insertBefore(placeholder, row); }catch(e){}
    }

    // initial run + observer
    scheduleProcessTrainingList(true);
    const mo = new MutationObserver(() => { scheduleProcessTrainingList(); });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
  }

  // ---------- helpers ----------
  function escapeHtml(s) { return (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m])); }

  // ---------- entry ----------
  (function main() {
    const url = location.href;
    if (url.includes('/quickref.phtml')) enhanceQuickref();
    else if ((url.includes('/island/training.phtml') || url.includes('/island/fight_training.phtml')) || url.includes('academy.phtml?') && url.includes('type=status')) enhanceTrainingPage();
  })();

})();
