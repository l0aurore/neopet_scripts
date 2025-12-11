// ==UserScript==
// @name         Neopets - Bottled Faerie Blesser
// @namespace    neopets
// @version      1.3
// @description  Auto-use bottled faeries. Menu page to pick bottle and pet. Press B in inventory to use 1 bottle, alert will pop up when that bottle is gone
// @match        https://www.neopets.com/inventory.phtml*
// @match        https://www.neopets.com/use-faerie-menu*
// @match        https://www.neopets.com/useobject.phtml*
// @author       laurore
// @update       https://github.com/l0aurore/neopet_scripts/edit/main/bottle_faerie.user.js
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle

// ==/UserScript==

(async function () {
  'use strict';

  // --- Configuration ---
  const BOTTLES = [
    "Unidentifiable Weak Bottled Faerie",
    "Weak Bottled Air Faerie",
    "Weak Bottled Dark Faerie",
    "Weak Bottled Earth Faerie",
    "Weak Bottled Fire Faerie",
    "Weak Bottled Grey Faerie",
    "Weak Bottled Light Faerie",
    "Weak Bottled Water Faerie"
  ];

  const BOTTLE_IMAGES = {
  "Weak Bottled Fire Faerie": "https://images.neopets.com/items/bd_botfae1_fire.gif",
  "Weak Bottled Light Faerie": "https://images.neopets.com/items/bd_botfae1_light.gif",
  "Weak Bottled Air Faerie": "https://images.neopets.com/items/bd_botfae1_air.gif",
  "Weak Bottled Dark Faerie": "https://images.neopets.com/items/bd_botfae1_dark.gif",
  "Weak Bottled Water Faerie": "https://images.neopets.com/items/bd_botfae1_water.gif",
  "Weak Bottled Earth Faerie": "https://images.neopets.com/items/bd_botfae1_earth.gif",
  "Unidentifiable Weak Bottled Faerie": "https://images.neopets.com/items/bd_botfae1_meta.gif",
  "Weak Bottled Grey Faerie": "https://images.neopets.com/items/243c17ijcl.gif",
  };

  // --- Helpers ---
  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
  function waitForSelector(selector, timeout = 8000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const obs = new MutationObserver(() => {
        const found = document.querySelector(selector);
        if (found) {
          obs.disconnect();
          resolve(found);
        }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      if (timeout) {
        setTimeout(() => {
          obs.disconnect();
          reject(new Error('Timeout waiting for ' + selector));
        }, timeout);
      }
    });
  }
  // alias used by older code
  const waitFor = waitForSelector;

  // --- Menu page implementation (opens a blank tab UI) ---
 async function openMenuTab() {
  const html = `
    <html>
    <head>
      <meta charset="utf-8">
      <title>Faerie Menu</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; padding: 12px; }
        h1 { font-size: 18px; margin-bottom: 8px; }
        .row { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
        .icon {opacity: 1; transition: opacity 0.15s ease-out;}
        .icon.selected { opacity: 0.5; filter: grayscale(100%); }
        .label { font-size:13px; margin-left:6px; }
        .controls { margin-top:12px; }
        .save { margin-top:10px; padding:6px 10px; cursor:pointer;
                border-radius:6px; border:0; background:#10b981;
                color:white; font-weight:600; }
        .note { margin-top:8px; color:#555; font-size:12px; }
        input[type=text] { padding:6px; font-size:14px; width:220px;
                           border-radius:6px; border:1px solid #bbb; }
      </style>
    </head>
    <body>
      <h1>Pick a Bottled Faerie & Pet</h1>
      <div class="row" id="iconsRow"></div>
      <div class="controls">
        <div style="margin-top:10px">
          <label class="label">Pet name: </label>
          <input id="petInput" type="text" placeholder="e.g. Rustycat59" />
        </div>
        <button id="saveBtn" class="save">Save Settings</button>
        <div class="note">Settings are saved automatically. You can save repeatedly without closing.</div>
      </div>
      <div id="status" style="margin-top:10px;color:green;"></div>
    </body>
    </html>
  `;

  // Create a unique URL every time → no reuse
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);

  const w = window.open(url, "_blank");
  if (!w) {
    alert("Popup blocked. Enable popups for this site.");
    return;
  }

  // Give the new window time to parse
  w.addEventListener("load", async () => {
    const doc = w.document;

    const savedBottle = await GM_getValue("faerie_selected", "") || "";
    const savedPet = await GM_getValue("faerie_pet", "") || "";

    // Restore pet
    doc.getElementById("petInput").value = savedPet;

    const iconsRow = doc.getElementById("iconsRow");

    // Add bottle icons
    BOTTLES.forEach(b => {
      const img = doc.createElement("img");
      img.src = BOTTLE_IMAGES[b] || "";
      img.title = b;
      img.alt = b;
      img.className = "icon" + (savedBottle === b ? " selected" : "");
      img.dataset.value = b;
      Object.assign(img.style, {
        width: "40px",
        height: "40px",
        objectFit: "contain",
        cursor: "pointer"
      });

      img.addEventListener("click", () => {
        [...iconsRow.querySelectorAll(".icon")].forEach(i =>
          i.classList.remove("selected")
        );
        img.classList.add("selected");
        doc.getElementById("status").textContent = `Selected: ${b}`;
      });

      iconsRow.appendChild(img);
    });

    // Save settings
    doc.getElementById("saveBtn").addEventListener("click", async () => {
      const selected = iconsRow.querySelector(".icon.selected");
      const bottleVal = selected ? selected.dataset.value : "";
      const pet = doc.getElementById("petInput").value.trim();

      if (!bottleVal) {
        doc.getElementById("status").textContent =
          "Please select a bottled faerie.";
        doc.getElementById("status").style.color = "red";
        return;
      }
      if (!pet) {
        doc.getElementById("status").textContent =
          "Please enter a pet name.";
        doc.getElementById("status").style.color = "red";
        return;
      }

      await GM_setValue("faerie_selected", bottleVal);
      await GM_setValue("faerie_pet", pet);

      doc.getElementById("status").textContent =
        `Saved: ${bottleVal} → ${pet}`;
      doc.getElementById("status").style.color = "green";
    });
  });
}


  // --- Inventory page UI additions & use flow ---
  async function addInventoryButtonsIfNeeded() {
    if (!location.pathname.includes('inventory.phtml')) return;

    await sleep(200);

    // Avoid adding twice
    if (document.getElementById('faerie_quick_buttons_container')) return;

    // Top container
    const heading = document.querySelector('h1') || document.querySelector('h2') || document.querySelector('title') || document.body;
    const container = document.createElement('div');
    container.id = 'faerie_quick_buttons_container';
    container.style.margin = '8px 0';
    container.style.display = 'flex';
    container.style.gap = '8px';
    container.style.alignItems = 'center';

    // OPEN MENU button (explicit)
    const openMenuBtn = document.createElement('button');
    openMenuBtn.id = 'faerie_open_menu_btn';
    openMenuBtn.textContent = 'Open Faerie Menu';
    Object.assign(openMenuBtn.style, { padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', border: '1px solid #888', background: '#ffd24d' });
    openMenuBtn.addEventListener('click', (e) => { e.preventDefault(); openMenuTab(); });

    // Use Saved Bottle (single use)
    const useBtn = document.createElement('button');
    useBtn.id = 'faerie_use_saved_btn';
    useBtn.textContent = 'Use Saved Bottle (once)';
    Object.assign(useBtn.style, { padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', border: '1px solid #888' });
    useBtn.addEventListener('click', async (e) => { e.preventDefault(); await useSavedBottleFlow(); });

    container.appendChild(openMenuBtn);
    container.appendChild(useBtn);

    // insert near heading
    try {
      if (heading && heading.parentNode) heading.parentNode.insertBefore(container, heading.nextSibling);
      else document.body.insertBefore(container, document.body.firstChild);
    } catch (err) {
      document.body.insertBefore(container, document.body.firstChild);
    }

    // Floating Start/Stop and Open Menu (so it's always visible)
    const startBtn = document.createElement('button');
    startBtn.textContent = 'Use Faerie(B)';
    Object.assign(startBtn.style, {
      position: "fixed", top: "80px", right: "20px", padding: "8px 14px",
      zIndex: 9999, fontSize: "14px", background: "#7fd282", border: "2px solid #444",
      borderRadius: "6px", cursor: "pointer"
    });
    document.body.appendChild(startBtn);

    const stopBtn = document.createElement('button');
    stopBtn.textContent = 'Cancel (Esc)';
    Object.assign(stopBtn.style, {
      position: "fixed", top: "120px", right: "20px", padding: "8px 14px",
      zIndex: 9999, fontSize: "14px", background: "#ff7a7a", border: "2px solid #444",
      borderRadius: "6px", cursor: "pointer"
    });
    document.body.appendChild(stopBtn);

    // Also add a floating "Open Menu" to the stack
    const floatOpen = document.createElement('button');
    floatOpen.textContent = 'Open Faerie Menu';
    Object.assign(floatOpen.style, {
      position: "fixed", top: "40px", right: "20px", padding: "8px 14px",
      zIndex: 9999, fontSize: "14px", background: "#ffd24d", border: "2px solid #444",
      borderRadius: "6px", cursor: "pointer"
    });
    floatOpen.onclick = () => openMenuTab();
    document.body.appendChild(floatOpen);

    startBtn.onclick = () => startFromMenu();
    stopBtn.onclick = () => stopRun();

    // Key handlers
    document.addEventListener("keydown", (e) => {
      if (e.key === "b" || e.key === "B") {
        startFromMenu();
      } else if (e.key === "Escape") {
        stopRun();
      }
    });

    // Auto-continue if active run exists
    (async function autoContinueOnLoad() {
      const active = await GM_getValue("faerieRunActive", false);
      let remaining = parseInt(await GM_getValue("faerieRemaining", 0), 10) || 0;
      if (active && remaining > 0) {
        console.log(`[FaerieRunner] continuing run: ${remaining} remaining`);
        await sleep(400);
        attemptUseOnce();
      }
    })();

    // --- Start / Stop ---
    async function startFromMenu() {
        const bottle = await GM_getValue("faerie_selected", "");
        const pet = await GM_getValue("faerie_pet", "");

        if (!bottle || !pet) {
            alert("Missing settings. Open the menu, set bottle and pet, then save.");
            return;
        }

        // Always use EXACTLY **1** faerie automatically.
        const qty = 1;

        await GM_setValue("faerieRemaining", qty);
        await GM_setValue("faerieRunActive", true);

        console.log(`[FaerieRunner] Starting run: 1 x "${bottle}" → ${pet}`);

        // No popup, no prompt. Just start.
        await sleep(200);
        attemptUseOnce();
    }


    async function stopRun() {
      await GM_setValue("faerieRunActive", false);
      await GM_setValue("faerieRemaining", 0);
      alert("Faerie run stopped.");
    }

    // --- Use saved bottle once (button) ---
    async function useSavedBottleFlow() {
      const bottle = await GM_getValue('faerie_selected', '');
      const pet = await GM_getValue('faerie_pet', '');
      if (!bottle || !pet) {
        alert('No saved bottle or pet. Open the menu and save settings first.');
        return;
      }
      await attemptUseOnce({ oneShot: true });
    }

    // --- Core: attempt to use one bottle iteration ---
    async function attemptUseOnce(opts = {}) {
      try {
        const active = await GM_getValue("faerieRunActive", false);
        let remaining = parseInt(await GM_getValue("faerieRemaining", 0), 10) || 0;
        const bottleName = await GM_getValue("faerie_selected", "");
        const petName = await GM_getValue("faerie_pet", "");

        if (!opts.oneShot && (!active || remaining <= 0)) {
          await GM_setValue("faerieRunActive", false);
          await GM_setValue("faerieRemaining", 0);
          console.log("[FaerieRunner] No active run or nothing remaining.");
          return;
        }

        console.log(`[FaerieRunner] Remaining before use: ${remaining}`);

        const candidates = $all("div[data-itemname]");
        const item = candidates.find(div => div.dataset && div.dataset.itemname && div.dataset.itemname.trim() === bottleName);

        if (!item) {
          alert(`No more "${bottleName}" found in inventory on this page. Stopping run.`);
          await GM_setValue("faerieRunActive", false);
          await GM_setValue("faerieRemaining", 0);
          return;
        }

        const old = document.querySelector("#iteminfo, .iteminfo");
        if (old) old.remove();

        item.click();

        const dropdown = await waitFor("form[name='item_form'] select[name='action']", 6000).catch(() => null);
        if (!dropdown) {
          alert("Action dropdown not found after clicking item. Aborting this attempt.");
          await GM_setValue("faerieRunActive", false);
          await GM_setValue("faerieRemaining", 0);
          return;
        }
        await sleep(120);

        let targetOption = [...dropdown.options].find(o => {
          const txt = o.textContent || "";
          return txt.includes(petName) || txt.toLowerCase().includes(`bless ${petName.toLowerCase()}`);
        });

        if (!targetOption) {
          targetOption = [...dropdown.options].find(o => /Bless/i.test(o.textContent || ""));
        }

        if (!targetOption) {
          alert(`Pet "${petName}" not found in the action dropdown. Stopping run.`);
          await GM_setValue("faerieRunActive", false);
          await GM_setValue("faerieRemaining", 0);
          return;
        }

        dropdown.value = targetOption.value;
        dropdown.dispatchEvent(new Event("change", { bubbles: true }));

        const submitBtn = document.querySelector(".invitem-submit") || document.querySelector("form[name='item_form'] button[type='submit']") || document.querySelector("input[type='submit']");
        if (!submitBtn) {
          alert("Submit button not found. Aborting run.");
          await GM_setValue("faerieRunActive", false);
          await GM_setValue("faerieRemaining", 0);
          return;
        }

        if (!opts.oneShot) {
          remaining = Math.max(0, remaining - 1);
          await GM_setValue("faerieRemaining", remaining);
          if (remaining === 0) {
            await GM_setValue("faerieRunActive", false);
          }
        }

        submitBtn.click();
        await sleep(1100);

        if (location.href.includes("useobject")) {
          const invLink = $all("a").find(a => /inventory\.phtml/.test(a.href));
          if (invLink) {
            await sleep(700);
            invLink.click();
            return;
          } else {
            location.href = "/inventory.phtml";
            return;
          }
        }

        await sleep(500);
        location.href = "/inventory.phtml";
        return;

      } catch (err) {
        console.error("[FaerieRunner] error in attemptUseOnce:", err);
        alert("Error during use attempt. Stopping run.");
        await GM_setValue("faerieRunActive", false);
        await GM_setValue("faerieRemaining", 0);
        return;
      }
    } // end attemptUseOnce

    return;
  } // end addInventoryButtonsIfNeeded

  /* ---------------- useobject.phtml Page Handling ---------------- */
  async function handleUseObjectPage() {
    if (!location.href.includes('useobject')) return;
    const active = await GM_getValue("faerieRunActive", false);
    const remaining = parseInt(await GM_getValue("faerieRemaining", 0), 10) || 0;
    if (active && remaining > 0) {
      await sleep(900);
      const invLink = $all("a").find(a => /inventory\.phtml/.test(a.href));
      if (invLink) { invLink.click(); return; }
      location.href = "/inventory.phtml";
    } else if (active && remaining === 0) {
      await sleep(900);
      const invLink = $all("a").find(a => /inventory\.phtml/.test(a.href));
      if (invLink) { invLink.click(); return; }
      location.href = "/inventory.phtml";
    } else {
      // not active
    }
  }

  // Global helper for single-use flow (not strictly required but handy)
  async function useSavedBottleFlow() {
    const bottle = await GM_getValue('faerie_selected', '');
    const pet = await GM_getValue('faerie_pet', '');
    if (!bottle || !pet) {
      alert('No saved bottle or pet. Open the menu and save settings first.');
      return;
    }
    if (location.pathname.includes('inventory.phtml')) {
      await addInventoryButtonsIfNeeded();
      // call will be handled by the in-page button; fallback to notify user
      alert('Press "Use Saved Bottle (once)" (near page heading) or the floating button to run once.');
    } else {
      alert('Go to your inventory page to use a saved bottle.');
    }
  }

  // --- Initialize ---
  try {
    await addInventoryButtonsIfNeeded();
    await handleUseObjectPage();
  } catch (err) {
    console.error('Initialization error:', err);
  }

})();
