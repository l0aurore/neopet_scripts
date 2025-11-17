// ==UserScript==
// @name         Neopets Lab Ray — Grid + Retire Pets (stable, interaction-safe)
// @namespace    https://www.neopets.com/
// @version      1.2
// @description  Grid + retire for lab2.phtml — safer rebuilds: avoid rebuilds while interacting, debounce, and only rebuild when radios change.
// @author       Laurore
// @match        https://www.neopets.com/lab2.phtml
// @update       
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  /* -------------------------
     Config & storage helpers
     ------------------------- */
  const STORAGE_KEY = 'neopets_retired_lab_pets_v1';
  const CONFIG = {
    rebuildDebounceMs: 1000,   // how long to debounce rebuilds
    interactionLockMs: 900,    // short lock after direct user interaction
    tempShowMs: 8000
  };

  function loadRetired() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') || []; }
    catch (e) { console.error(e); return []; }
  }
  function saveRetired(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set(list.map(s=>String(s).trim()))])); }
    catch (e) { console.error(e); }
  }
  function normalizeName(n){ return (n||'').toLowerCase().trim(); }
  function isRetired(n){ if(!n) return false; return loadRetired().some(x=>normalizeName(x)===normalizeName(n)); }
  function addRetired(n){ if(!n) return; const L=loadRetired(); L.push(n); saveRetired(L); }
  function removeRetired(n){ if(!n) return; const nrm=normalizeName(n); saveRetired(loadRetired().filter(x=>normalizeName(x)!==nrm)); }

  /* -------------------------
     Small DOM helpers
     ------------------------- */
  const Utils = {
    $: (s,p=document)=>p.querySelector(s),
    $$: (s,p=document)=>Array.from((p||document).querySelectorAll(s)),
    create: (tag, props={}, children=[])=>{
      const el = document.createElement(tag);
      if(props.styles) Object.assign(el.style, props.styles);
      if(props.className) el.className = props.className;
      if(props.attrs) for(const k in props.attrs) el.setAttribute(k, props.attrs[k]);
      children.forEach(c=> typeof c === 'string' ? el.appendChild(document.createTextNode(c)) : el.appendChild(c));
      return el;
    }
  };

  /* -------------------------
     State for safe rebuilding
     ------------------------- */
  let gridContainer = null;
  let lastRadioSignature = null; // string signature of radio values order
  let rebuildTimer = null;
  let interactionLocked = false;
  let userInteracting = false; // true while user is interacting with panel or grid
  let selectedPetValue = null; // preserve selection across rebuilds

  function setInteractionLock(ms = CONFIG.interactionLockMs) {
    interactionLocked = true;
    clearTimeout(rebuildTimer);
    setTimeout(()=>{ interactionLocked = false; }, ms);
  }

  function makeRadioSignature() {
    // signature is the concatenation of radios' values in DOM order
    const radios = Utils.$$('input[type="radio"][name="chosen"]');
    if (!radios.length) return '';
    return radios.map(r => String(r.value||'')).join('|');
  }

  /* -------------------------
     Extract pet info (name from image URL)
     ------------------------- */
  function extractPetItems() {
    const list = Utils.$('#bxlist');
    if (!list) return [];
    const lis = Utils.$$('li', list);
    const seen = new Set();
    const out = [];
    for (const li of lis) {
      const radio = li.querySelector('input[type="radio"]');
      if (!radio) continue;
      if (seen.has(radio.value)) continue;
      seen.add(radio.value);
      const img = li.querySelector('img');
      // extract name from image src /cpn/<name>/
      let name = null;
      if (img && img.getAttribute) {
        const src = img.getAttribute('src') || '';
        const m = src.match(/\/cpn\/([^\/?#]+)\//i);
        if (m && m[1]) name = decodeURIComponent(m[1]);
      }
      if (!name) name = radio.value || (li.querySelector('b') && li.querySelector('b').textContent.trim()) || String(radio.value);
      out.push({ li, radio, img, name: String(name).trim(), value: radio.value });
    }
    return out;
  }

  /* -------------------------
     Build grid, placeholders, and panel selects
     ------------------------- */

  function createPanelIfNeeded() {
    if (Utils.$('#lab-retire-panel')) return; // exists
    const panel = Utils.create('div', { styles: {
      position:'fixed', left:'12px', bottom:'12px', zIndex:99999,
      background:'rgba(255,255,255,0.96)', border:'1px solid #888', padding:'10px',
      boxShadow:'0 2px 12px rgba(0,0,0,0.22)', maxWidth:'420px', fontSize:'13px',
      fontFamily:'Arial,sans-serif', borderRadius:'8px', maxHeight:'60vh', overflow:'auto'
    }, attrs:{id:'lab-retire-panel'}});
    panel.innerHTML = '<div style="font-weight:700;margin-bottom:6px;">Lab Ray — Retire Pets</div>';

    const controls = Utils.create('div');
    const showBtn = Utils.create('button', {}, ['Show retired temporarily']);
    const hideBtn = Utils.create('button', {}, ['Hide retired']);
    [showBtn, hideBtn].forEach(b=>{ b.style.margin = '6px 6px 6px 0'; b.style.cursor='pointer'; });
    controls.appendChild(showBtn); controls.appendChild(hideBtn);
    panel.appendChild(controls);

    // active select
    panel.appendChild(Utils.create('div', { styles:{fontSize:'12px', marginTop:'8px'} }, ['Active pets in grid:']));
    const activeSel = Utils.create('select', { attrs:{id:'lab-active-select'}, styles:{width:'100%', boxSizing:'border-box'} });
    activeSel.size = 6; activeSel.multiple = true; activeSel.style.marginTop='6px';
    panel.appendChild(activeSel);

    const retireBtn = Utils.create('button', {}, ['Retire selected']);
    const retireAllBtn = Utils.create('button', {}, ['Retire all']);
    [retireBtn, retireAllBtn].forEach(b=>{ b.style.margin='8px 6px 0 0'; b.style.cursor='pointer'; });
    panel.appendChild(Utils.create('div', {}, [retireBtn, retireAllBtn]));

    // retired select
    panel.appendChild(Utils.create('div', { styles:{fontSize:'12px', marginTop:'12px'} }, ['Retired pets:']));
    const retiredSel = Utils.create('select', { attrs:{id:'lab-retired-select'}, styles:{width:'100%', boxSizing:'border-box'} });
    retiredSel.size = 8; retiredSel.multiple = true; retiredSel.style.marginTop='6px';
    panel.appendChild(retiredSel);

    const unretBtn = Utils.create('button', {}, ['Un-retire selected']);
    const unretAllBtn = Utils.create('button', {}, ['Un-retire all']);
    [unretBtn, unretAllBtn].forEach(b=>{ b.style.margin='8px 6px 0 0'; b.style.cursor='pointer'; });
    panel.appendChild(Utils.create('div', {}, [unretBtn, unretAllBtn]));

    const hint = Utils.create('div', { styles:{fontSize:'12px', opacity:0.9, marginTop:'10px'} }, ['Retired pets are hidden from the grid and replaced by placeholders.']);
    panel.appendChild(hint);

    document.body.appendChild(panel);

    // wire up handlers:
    showBtn.addEventListener('click', ()=>{ temporarilyShowRetired(); setInteractionLock(700); });
    hideBtn.addEventListener('click', ()=>{ applyRetireState(); setInteractionLock(300); });
    retireBtn.addEventListener('click', ()=>{ retireSelected(); setInteractionLock(); });
    retireAllBtn.addEventListener('click', ()=>{ retireAll(); setInteractionLock(); });
    unretBtn.addEventListener('click', ()=>{ unretireSelected(); setInteractionLock(); });
    unretAllBtn.addEventListener('click', ()=>{ unretireAll(); setInteractionLock(); });

    // mark user interacting when panel hovered/focused
    panel.addEventListener('mouseenter', ()=> userInteracting = true);
    panel.addEventListener('mouseleave', ()=> userInteracting = false);
    panel.addEventListener('focusin', ()=> userInteracting = true);
    panel.addEventListener('focusout', ()=> userInteracting = false);
  }

  function updatePanelSelects(activeNames, retiredNames) {
    const activeSel = Utils.$('#lab-active-select');
    const retiredSel = Utils.$('#lab-retired-select');
    if (!activeSel || !retiredSel) return;
    // helper to rebuild while preserving selection/scroll
    function rebuild(selectEl, items, placeholder) {
      const prevSel = Array.from(selectEl.selectedOptions || []).map(o=>o.value);
      const prevScroll = selectEl.scrollTop || 0;
      selectEl.innerHTML = '';
      if(!items || items.length===0) { const o = document.createElement('option'); o.textContent = placeholder; o.disabled=true; selectEl.appendChild(o); }
      else items.forEach(it => { const o = document.createElement('option'); o.value = it; o.textContent = it; if(prevSel.includes(it)) o.selected = true; selectEl.appendChild(o); });
      setTimeout(()=>{ try{ selectEl.scrollTop = prevScroll; Array.from(selectEl.options).forEach(o=>{ if(prevSel.includes(o.value)) o.selected=true; }); }catch(e){} }, 0);
    }
    rebuild(activeSel, activeNames, '(no active pets)');
    rebuild(retiredSel, retiredNames, '(no retired pets)');
  }

  /* -------------------------
     Grid creation and retire logic
     ------------------------- */
  function buildGrid(petInfos) {
    // remove previous grid if present
    if (gridContainer && gridContainer.parentNode) {
      // preserve selected pet value
      const prevSelected = selectedPetValue;
      gridContainer.remove();
      gridContainer = null;
      PetSelectorClear();
      selectedPetValue = prevSelected;
    }

    const grid = Utils.create('div', { styles: {
      display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'12px',
      padding:'12px', margin:'18px auto', maxWidth:'980px', boxSizing:'border-box'
    }, attrs:{id:'lab-grid-container'} });

    for (const p of petInfos) {
      const card = Utils.create('div', { styles:{
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start',
        padding:'8px', border:'2px solid #4169E1', borderRadius:'6px', cursor:'pointer', background:'#F8FBFF', width:'160px', height:'170px', boxSizing:'border-box'
      }});
      // image
      const img = p.img.cloneNode(true);
      Object.assign(img.style, { maxWidth:'100%', maxHeight:'100%', objectFit:'contain', marginBottom:'6px' });
      const imgWrap = Utils.create('div', { styles:{ width:'120px', height:'100px', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'6px' }});
      imgWrap.appendChild(img);
      const label = Utils.create('div', { styles:{ fontSize:'12px', textAlign:'center', fontWeight:'700', lineHeight:'1.1', fontFamily:'Arial, sans-serif' }}, [p.name]);

      const overlay = Utils.create('div', { className:'lab-selected-overlay', styles:{ position:'absolute', top:'6px', left:'6px', right:'6px', height:'18px', textAlign:'center', display:'none', fontWeight:'700', paddingTop:'1px' }}, ['SELECTED']);

      card.appendChild(imgWrap);
      card.appendChild(label);
      card.appendChild(overlay);

      card.dataset.petName = p.name;
      card.dataset.petValue = p.value;

      // clicking selects the radio without rebuilding
      card.addEventListener('click', (ev)=>{
        ev.stopPropagation();
        // don't rebuild immediately — set interaction lock
        selectedPetValue = p.value;
        // check the actual original radio and check it
        try { if (p.radio && p.radio.checked === false) p.radio.checked = true; } catch(e){ }
        highlightSelectedCard(p.value);
        setInteractionLock();
      });

      // preserve keyboard interactions: avoid rebuild while interacting with the card
      card.addEventListener('mouseenter', ()=> userInteracting = true);
      card.addEventListener('mouseleave', ()=> userInteracting = false);

      grid.appendChild(card);
      PetSelectorRegister(p.value, card, p.radio);
    }

    // insert grid into form
    const form = Utils.$('form[action="process_lab2.phtml"]');
    if (form) {
      const zaps = Utils.$('p[style*="text-align:center"]', form);
      if (zaps) form.insertBefore(grid, zaps);
      else form.appendChild(grid);
    } else {
      document.body.appendChild(grid);
    }

    gridContainer = grid;
  }

  /* Keep simple registry to map value->card & radio */
  const PetSelectorMap = new Map();
  function PetSelectorRegister(value, cardEl, radioEl) {
    PetSelectorMap.set(String(value), {cardEl, radioEl});
  }
  function PetSelectorClear(){ PetSelectorMap.clear(); }
  function highlightSelectedCard(value) {
    PetSelectorMap.forEach((entry, val) => {
      try {
        if (val === String(value)) {
          entry.cardEl.style.borderColor = '#FFD700';
          entry.cardEl.style.background = '#FFF8E1';
          const ov = entry.cardEl.querySelector('.lab-selected-overlay'); if (ov) ov.style.display='block';
        } else {
          entry.cardEl.style.borderColor = '#4169E1';
          entry.cardEl.style.background = '#F8FBFF';
          const ov = entry.cardEl.querySelector('.lab-selected-overlay'); if (ov) ov.style.display='none';
        }
      } catch(e){}
    });
  }

  function hideOriginalSliderVisuals() {
    // collapse viewport and controls but keep radios in DOM
    const wrapper = Utils.$('.bx-wrapper');
    const viewport = Utils.$('.bx-viewport');
    const controls = Utils.$('.bx-controls');
    const bxlist = Utils.$('#bxlist');

    if (viewport) { viewport.style.height='0px'; viewport.style.overflow='hidden'; viewport.style.visibility='hidden'; }
    if (controls) { controls.style.display='none'; }
    if (wrapper) { wrapper.style.margin='0'; }
    if (bxlist) {
      // keep it in DOM but visually remove it from layout
      bxlist.style.visibility = 'hidden';
      bxlist.style.height = '0px';
      bxlist.style.overflow = 'hidden';
      bxlist.style.position = 'absolute';
      bxlist.style.left = '-99999px';
    }
  }

  function hideCardAndInsertPlaceholder(card, petName) {
    // if already hidden, ignore
    if (card.dataset && card.dataset.retiredHidden === '1') return;
    try { card.style.display = 'none'; card.dataset.retiredHidden = '1'; } catch(e){}
    const placeholder = Utils.create('div', { styles:{
      width:'160px', height:'170px', display:'flex', alignItems:'center', justifyContent:'center',
      border:'2px dashed #e07a00', borderRadius:'6px', background:'#fff7f0', padding:'8px', boxSizing:'border-box', textAlign:'center'
    }});
    placeholder.dataset.placeholderBy = petName;
    const inner = Utils.create('div', { styles:{ fontSize:'13px', fontWeight:'700' }}, [ `${petName} — retired from lab` ]);
    const unbtn = Utils.create('button', {}, ['Un-retire']);
    unbtn.style.marginTop = '8px'; unbtn.style.cursor = 'pointer';
    unbtn.addEventListener('click', (ev)=> {
      ev.stopPropagation();
      removeRetired(petName);
      applyRetireState();
      setInteractionLock();
    });
    const wrapper = Utils.create('div', { styles:{ display:'flex', flexDirection:'column', alignItems:'center'} }, [inner, unbtn]);
    placeholder.appendChild(wrapper);
    try { card.parentNode.insertBefore(placeholder, card.nextSibling); } catch(e){}
  }

  function applyRetireState() {
    if (!gridContainer) return;
    const retired = loadRetired().map(s=>String(s).trim());
    const cards = Array.from(gridContainer.children || []);
    for (const card of cards) {
      const pName = card.dataset.petName || '';
      const pValue = card.dataset.petValue || '';
      if (isRetired(pName) || isRetired(pValue)) {
        hideCardAndInsertPlaceholder(card, pName || pValue);
      } else {
        try { card.style.display = ''; delete card.dataset.retiredHidden; } catch(e){}
        // remove placeholder next if matches
        const nxt = card.nextElementSibling;
        if (nxt && nxt.dataset && nxt.dataset.placeholderBy && normalizeName(nxt.dataset.placeholderBy) === normalizeName(pName || pValue)) {
          try { nxt.remove(); } catch(e){}
        }
      }
    }
    // update panel selects
    const activeNames = Array.from(gridContainer.children || []).filter(c=>!(c.dataset && c.dataset.retiredHidden==='1')).map(c=>c.dataset.petName);
    const retiredNames = loadRetired().slice().sort((a,b)=>a.localeCompare(b));
    updatePanelSelects(activeNames, retiredNames);
  }

  function temporarilyShowRetired() {
    if (!gridContainer) return;
    const cards = Array.from(gridContainer.children || []);
    for (const c of cards) {
      try { c.style.display = ''; c.dataset.tempShown = '1'; } catch(e){}
      // show placeholders too if present (they are siblings)
      const nxt = c.nextElementSibling;
      if (nxt && nxt.dataset && nxt.dataset.placeholderBy) {
        try { nxt.style.display = ''; nxt.dataset.tempShown = '1'; } catch(e){}
      }
    }
    setTimeout(()=> applyRetireState(), CONFIG.tempShowMs);
  }

  /* Panel retire actions */
  function retireSelected() {
    const sel = Utils.$('#lab-active-select');
    if (!sel) return;
    const chosen = Array.from(sel.selectedOptions || []).map(o=>o.value).filter(Boolean);
    if (!chosen.length) return;
    chosen.forEach(c=>addRetired(c));
    applyRetireState();
  }
  function retireAll() {
    const sel = Utils.$('#lab-active-select');
    if (!sel) return;
    const all = Array.from(sel.options || []).map(o=>o.value).filter(Boolean);
    all.forEach(a=>addRetired(a));
    applyRetireState();
  }
  function unretireSelected() {
    const sel = Utils.$('#lab-retired-select');
    if (!sel) return;
    const chosen = Array.from(sel.selectedOptions || []).map(o=>o.value).filter(Boolean);
    chosen.forEach(c=>removeRetired(c));
    applyRetireState();
  }
  function unretireAll() {
    loadRetired().forEach(n=>removeRetired(n));
    applyRetireState();
  }

  /* -------------------------
     Safe rebuild scheduling
     ------------------------- */
  function scheduleRebuild(reason) {
    // if user actively interacting or in interaction lock, skip scheduling
    if (interactionLocked || userInteracting) {
      // console.log('rebuild skipped (user interacting or locked):', reason);
      return;
    }
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(()=> {
      try {
        // generate radio signature and only rebuild if changed
        const sig = makeRadioSignature();
        if (sig && sig === lastRadioSignature) {
          // nothing changed
          // console.log('rebuild skipped (no signature change)');
          return;
        }
        lastRadioSignature = sig;
        processNow();
      } catch (e) {
        console.error('rebuild error', e);
      }
    }, CONFIG.rebuildDebounceMs);
  }

  function processNow() {
    // build grid: extract pet infos and build if changed
    const petInfos = extractPetItems();
    if (!petInfos.length) return;
    // build grid
    buildGrid(petInfos);
    hideOriginalSliderVisuals();
    applyRetireState();
    // if a pet had been selected before rebuild, re-highlight it
    if (selectedPetValue) highlightSelectedCard(selectedPetValue);
  }

  /* -------------------------
     MutationObserver: but conservative
     ------------------------- */
  const mo = new MutationObserver(muts => {
    // only schedule rebuild; actual rebuild will check signature and user-interaction flags
    scheduleRebuild('mutation observed');
  });

  /* -------------------------
     User interaction guards (global)
     ------------------------- */
  // mark userInteracting while focusing or clicking on page elements (inputs, selects, buttons, the grid)
  function installInteractionGuards() {
    // Track mousedown/touchstart anywhere to temporarily lock rebuilds
    document.addEventListener('mousedown', ()=> { userInteracting = true; setTimeout(()=> userInteracting = false, 800); }, true);
    document.addEventListener('touchstart', ()=> { userInteracting = true; setTimeout(()=> userInteracting = false, 800); }, true);
    // focusin/out
    window.addEventListener('focusin', ()=> { userInteracting = true; }, true);
    window.addEventListener('focusout', ()=> { setTimeout(()=> userInteracting = false, 200); }, true);

    // prevent the observer from triggering rebuilds while hovering the panel once it's built
    const checkPanelInterval = setInterval(()=> {
      const panel = Utils.$('#lab-retire-panel');
      if (!panel) return;
      panel.addEventListener('mouseenter', ()=> userInteracting = true);
      panel.addEventListener('mouseleave', ()=> userInteracting = false);
      clearInterval(checkPanelInterval);
    }, 300);
  }

  /* -------------------------
     Init
     ------------------------- */
  function init() {
    createPanelIfNeeded();
    installInteractionGuards();
    // initial signature
    lastRadioSignature = makeRadioSignature();
    // initial process
    processNow();
    // observe changes; subtree may change as the page loads additional clones
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style','class','aria-hidden'] });
    // storage sync
    window.addEventListener('storage', (ev)=> { if(ev.key === STORAGE_KEY) applyRetireState(); });
    // ensure clicks on original radios highlight cards (if user clicks radio in original list)
    document.addEventListener('click', (ev)=>{
      const r = ev.target && ev.target.matches && ev.target.matches('input[type="radio"][name="chosen"]') ? ev.target : null;
      if (r) {
        selectedPetValue = r.value;
        highlightSelectedCard(r.value);
        setInteractionLock();
      }
    }, true);
  }

  // start when ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else init();

})();
