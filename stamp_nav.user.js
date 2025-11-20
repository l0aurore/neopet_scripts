// ==UserScript==
// @name         Neopets Stamp Album - Next/Previous Navigation
// @namespace    https://www.neopets.com/
// @version      1.1
// @description  Adds Next / Previous buttons above the stamp album table to navigate page_id 0..48 while preserving URL params (owner, type, etc.).
// @author       laurore
// @match        https://www.neopets.com/stamps.phtml*
// @update       https://github.com/l0aurore/neopet_scripts/blob/main/stamp_nav.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // configuration
  const MIN_PAGE = 0;
  const MAX_PAGE = 48;

  // helper: parse current page_id from URL (default MIN_PAGE)
  function getCurrentPage() {
    try {
      const params = new URLSearchParams(window.location.search);
      const p = params.get('page_id');
      const n = (p !== null && !isNaN(parseInt(p, 10))) ? parseInt(p, 10) : MIN_PAGE;
      return Math.min(MAX_PAGE, Math.max(MIN_PAGE, n));
    } catch (e) {
      return MIN_PAGE;
    }
  }

  // helper: build URL with new page_id while preserving other params
  function buildUrlWithPage(page) {
    const url = new URL(window.location.href);
    const params = url.searchParams;
    params.set('page_id', String(page));
    url.search = params.toString();
    return url.toString();
  }

  // find the stamp album table:
  function findStampTable() {
    // Prefer table with width=450 and containing at least one image with 'stamp' in src
    const tables = Array.from(document.querySelectorAll('table[width="450"], table[width="450"][height="450"]'));
    for (const t of tables) {
      if (t.querySelector('img[src*="stamp"], img[src*="/items/sta"], img[src*="/items/stamp"]')) return t;
    }
    // fallback: find any table that contains a stamp img
    const anyTable = Array.from(document.querySelectorAll('table')).find(t => t.querySelector('img[src*="stamp"], img[src*="/items/sta"], img[src*="/items/stamp"]'));
    return anyTable || null;
  }

  // create UI container and buttons
  function createNavUI(currentPage) {
    const container = document.createElement('div');
    container.style.textAlign = 'center';
    container.style.margin = '10px auto';
    container.style.fontFamily = 'Arial, Helvetica, sans-serif';
    container.style.display = 'flex';
    container.style.justifyContent = 'center';
    container.style.alignItems = 'center';
    container.style.gap = '8px';

    // form (visual)
    const form = document.createElement('form');
    form.style.display = 'inline-block';
    form.style.margin = '0';
    form.style.padding = '4px';

    const prevBtn = document.createElement('input');
    prevBtn.type = 'button';
    prevBtn.value = 'Previous';
    prevBtn.title = 'Previous page';
    prevBtn.style.padding = '6px 10px';
    prevBtn.style.cursor = 'pointer';

    const nextBtn = document.createElement('input');
    nextBtn.type = 'button';
    nextBtn.value = 'Next';
    nextBtn.title = 'Next page';
    nextBtn.style.padding = '6px 10px';
    nextBtn.style.cursor = 'pointer';

    const info = document.createElement('span');
    info.textContent = `Page ${currentPage} / ${MAX_PAGE}`;
    info.style.fontWeight = 'bold';
    info.style.margin = '0 6px';

    form.appendChild(prevBtn);
    form.appendChild(info);
    form.appendChild(nextBtn);
    container.appendChild(form);

    // handlers
    function updateButtonsAndInfo(newPage) {
      info.textContent = `Page ${newPage} / ${MAX_PAGE}`;
      prevBtn.disabled = (newPage <= MIN_PAGE);
      nextBtn.disabled = (newPage >= MAX_PAGE);
      prevBtn.style.opacity = prevBtn.disabled ? '0.5' : '1';
      nextBtn.style.opacity = nextBtn.disabled ? '0.5' : '1';
    }

    prevBtn.addEventListener('click', function (e) {
      e.preventDefault();
      const p = getCurrentPage();
      const target = Math.max(MIN_PAGE, p - 1);
      if (target !== p) window.location.href = buildUrlWithPage(target);
    });

    nextBtn.addEventListener('click', function (e) {
      e.preventDefault();
      const p = getCurrentPage();
      const target = Math.min(MAX_PAGE, p + 1);
      if (target !== p) window.location.href = buildUrlWithPage(target);
    });

    // keyboard support: left/right arrows
    window.addEventListener('keydown', function (ev) {
      // don't trigger while typing into form elements
      const tag = (ev.target && ev.target.tagName) ? ev.target.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || ev.target.isContentEditable) return;
      if (ev.key === 'ArrowLeft') {
        const p = getCurrentPage();
        const target = Math.max(MIN_PAGE, p - 1);
        if (target !== p) window.location.href = buildUrlWithPage(target);
      } else if (ev.key === 'ArrowRight') {
        const p = getCurrentPage();
        const target = Math.min(MAX_PAGE, p + 1);
        if (target !== p) window.location.href = buildUrlWithPage(target);
      }
    });

    updateButtonsAndInfo(currentPage);
    return container;
  }

  // main: locate table and insert UI above it
  function insertNavAboveTable() {
    const table = findStampTable();
    if (!table) {
      // no table found: try again after a short delay in case of delayed render
      setTimeout(() => {
        const t2 = findStampTable();
        if (t2) {
          const ui = createNavUI(getCurrentPage());
          t2.parentNode.insertBefore(ui, t2);
        }
      }, 600);
      return;
    }
    const ui = createNavUI(getCurrentPage());
    table.parentNode.insertBefore(ui, table);
  }

  // run
  insertNavAboveTable();

})();
