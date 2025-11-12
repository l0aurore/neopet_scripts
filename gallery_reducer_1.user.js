// ==UserScript==
// @name         Auto-check & cap stock to 1
// @namespace    neopets
// @author       laurore
// @version      1
// @description  For each gallery/remove item: if stock > 1, set stock to 1 and check its remove checkbox. Scrolls to bottom when done. Observes dynamic changes too.
// @match        *://*.neopets.com/gallery/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Main worker: finds qty inputs, enforces <=1, and checks corresponding checkbox
    function processItems() {
        // selector targets:
        // - text inputs that were shown in your snippet (class remove_item_class)
        // - inputs whose name starts with remove_qty_arr[ (fallback)
        const selectors = [
            "input.remove_item_class",
            "input[name^='remove_qty_arr']",
            "input[type='text'][name*='remove_qty_arr']",
            "input[type='text'][data-r_id]"
        ];
        const nodes = document.querySelectorAll(selectors.join(","));

        let modifiedCount = 0;

        nodes.forEach((el) => {
            try {
                // get the item id (72369 in your example)
                let itemId = null;
                if (el.dataset && el.dataset.r_id) itemId = el.dataset.r_id;
                if (!itemId && el.id) {
                    // sometimes id is like 'qty_72369' - try to extract digits
                    const m = el.id.match(/(\d{3,})/);
                    if (m) itemId = m[1];
                }
                if (!itemId && el.name) {
                    const m = el.name.match(/\[(\d+)\]/);
                    if (m) itemId = m[1];
                }

                // parse numeric value (tolerant)
                const rawVal = (el.value ?? el.getAttribute('value') ?? '').toString().trim();
                const num = Number(rawVal === '' ? el.dataset.prv_value ?? rawVal : rawVal);
                if (Number.isNaN(num)) return; // skip non-numeric

                if (num > 1) {
                    // set the visible qty to 1
                    el.value = '1';
                    // update data attributes if present
                    if (el.dataset) {
                        el.dataset.prvValue = '1';
                        el.dataset.prv_value = '1';
                    }
                    // update attributes that sites sometimes use
                    if (el.hasAttribute('data-prv_value')) el.setAttribute('data-prv_value', '1');
                    if (el.hasAttribute('data-prv-rank')) el.setAttribute('data-prv-rank', el.getAttribute('data-prv-rank'));
                    if (el.hasAttribute('value')) el.setAttribute('value', '1');

                    // try to update related hidden input (example id: h_72369 or name remove_h_qty_arr[72369])
                    if (itemId) {
                        const hiddenById = document.getElementById('h_' + itemId);
                        if (hiddenById) {
                            hiddenById.value = '1';
                            if (hiddenById.hasAttribute('value')) hiddenById.setAttribute('value', '1');
                        }
                        // fallback: hidden input by name
                        const hiddenByName = document.querySelector(`input[name^='remove_h_qty_arr'][name*='[${itemId}]']`);
                        if (hiddenByName) {
                            hiddenByName.value = '1';
                            if (hiddenByName.hasAttribute('value')) hiddenByName.setAttribute('value', '1');
                        }

                        // find and check the checkbox: try id 'ch_<id>' then checkbox with value='<id>'
                        let chk = document.getElementById('ch_' + itemId);
                        if (!chk) {
                            chk = document.querySelector(`input[type='checkbox'].check_box_remove[value='${itemId}']`)
                                || document.querySelector(`input[type='checkbox'][value='${itemId}']`);
                        }
                        if (chk) {
                            chk.checked = true;
                            // also set checked attribute for form serialization safety
                            chk.setAttribute('checked', 'checked');
                        }
                    }

                    // optionally dispatch input/change events so frameworks detect changes
                    dispatchInputEvents(el);

                    modifiedCount++;
                }
            } catch (err) {
                // don't break on single failures
                console.warn('processItems: error processing element', el, err);
            }
        });

        // Scroll to bottom if we modified anything (or always, as desired)
        if (modifiedCount > 0) {
            // smooth scroll; if you prefer instant, replace behavior: 'smooth' with behavior: 'auto'
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        }
        return modifiedCount;
    }

    // Helper to dispatch input/change events (helps if the page uses JS frameworks)
    function dispatchInputEvents(el) {
        try {
            const evInput = new Event('input', { bubbles: true, cancelable: true });
            el.dispatchEvent(evInput);
            const evChange = new Event('change', { bubbles: true, cancelable: true });
            el.dispatchEvent(evChange);
        } catch (e) {
            // ignore
        }
    }

    // Run once on load
    function runOnce() {
        setTimeout(() => {
            processItems();
        }, 250); // small delay to allow site scripts to finish initial rendering
    }

    // Observe mutations to catch dynamically added items
    const observer = new MutationObserver((mutations) => {
        // If new nodes are added, re-run processing (throttle to avoid too-frequent runs)
        let added = false;
        for (const m of mutations) {
            if (m.addedNodes && m.addedNodes.length) {
                added = true;
                break;
            }
        }
        if (added) {
            // debounce: run after short delay so multiple mutations batch together
            if (observer._debounceTimer) clearTimeout(observer._debounceTimer);
            observer._debounceTimer = setTimeout(() => {
                processItems();
            }, 300);
        }
    });

    // Start observing the document body (if available)
    function startObserving() {
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        } else {
            // fallback to trying again shortly
            setTimeout(startObserving, 300);
        }
    }

    // Add a Tampermonkey menu command to force the script to run again
    if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('Run stock->1 & check boxes', () => processItems());
    } else {
        // create a simple floating button as fallback
        createFloatingButton();
    }

    function createFloatingButton() {
        const btn = document.createElement('button');
        btn.textContent = 'Cap stock → 1';
        btn.style.position = 'fixed';
        btn.style.right = '12px';
        btn.style.bottom = '12px';
        btn.style.zIndex = 99999;
        btn.style.padding = '8px 10px';
        btn.style.borderRadius = '6px';
        btn.style.border = '1px solid #333';
        btn.style.background = '#fff';
        btn.style.cursor = 'pointer';
        btn.addEventListener('click', () => processItems());
        document.body.appendChild(btn);
    }

    // Initial run & observe
    runOnce();
    startObserving();

    // Expose function for console/manual runs if needed:
    window.__capStockToOne = processItems;

})();
