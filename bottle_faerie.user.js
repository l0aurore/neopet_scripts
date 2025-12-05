// ==UserScript==
// @name         Neopets - Auto Bottled Faerie User + Persistent Runner
// @namespace    https://tampermonkey.net/
// @version      1.1
// @description  Auto-use bottled faeries on pets with a persistent run across page loads. Menu page to pick bottle, quantity, and pet. Press B to start/pause, Esc to stop.
// @match        https://www.neopets.com/inventory.phtml*
// @match        https://www.neopets.com/use-faerie-menu*
// @match        https://www.neopets.com/useobject.phtml*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @update       https://github.com/l0aurore/neopet_scripts
// ==/UserScript==

(function () {
  "use strict";

  const MENU_URL = "https://www.neopets.com/use-faerie-menu";
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

  // Helpers
  const $ = (sel, root = document) => root.querySelector(sel);
  const $all = (sel, root = document) => [...root.querySelectorAll(sel)];
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const waitFor = (selector, timeout = 7000) => new Promise((resolve, reject) => {
    const start = Date.now();
    const int = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) { clearInterval(int); resolve(el); }
      else if (Date.now() - start >= timeout) { clearInterval(int); reject("Timeout " + selector); }
    }, 100);
  });

  // Persistent run-state keys:
  // "faerieType" -> string
  // "faerieQty" -> integer target qty (for reference)
  // "faerieRemaining" -> integer remaining to use in current run
  // "petName" -> string
  // "faerieRunActive" -> boolean

  /* ---------------- Menu Page ---------------- */
  if (location.href.startsWith(MENU_URL)) {
    document.title = "Faerie Use Menu";
    document.body.innerHTML = `
      <div style="font-family: Arial, Helvetica, sans-serif; padding:20px;">
        <h2>Bottled Faerie Auto-Use Menu</h2>
        <div style="margin-bottom:10px;">
          <label><b>Select Bottled Faerie:</b></label><br>
          <select id="faerieSelect" style="width:320px; margin-top:6px;">${BOTTLES.map(b => `<option value="${b}">${b}</option>`).join("")}</select>
        </div>
        <div style="margin-bottom:10px;">
          <label><b>Quantity to Use:</b></label><br>
          <input id="faerieQty" type="number" min="1" style="width:120px; margin-top:6px;">
        </div>
        <div style="margin-bottom:18px;">
          <label><b>Pet Name:</b></label><br>
          <input id="petName" type="text" style="width:320px; margin-top:6px;">
        </div>
        <div>
          <button id="saveFaerieSettings" style="padding:8px 14px; font-size:14px;">Save Settings</button>
          <button id="startNow" style="padding:8px 14px; font-size:14px; margin-left:8px;">Save & Start Run</button>
          <div style="margin-top:12px; color:#444; font-size:13px;">
            Press <b>B</b> on the inventory page to start/pause runs. Press <b>Esc</b> to stop a run.
          </div>
        </div>
      </div>
    `;

    // Populate with saved values
    const sel = $("#faerieSelect"), qty = $("#faerieQty"), pet = $("#petName");
    sel.value = GM_getValue("faerieType", BOTTLES[0]);
    qty.value = GM_getValue("faerieQty", "");
    pet.value = GM_getValue("petName", "");

    $("#saveFaerieSettings").onclick = () => {
      GM_setValue("faerieType", sel.value);
      GM_setValue("faerieQty", qty.value);
      GM_setValue("petName", pet.value);
      alert("Settings saved.");
    };

    $("#startNow").onclick = () => {
      // Save first then start run
      GM_setValue("faerieType", sel.value);
      GM_setValue("faerieQty", qty.value);
      GM_setValue("petName", pet.value);

      const n = parseInt(qty.value, 10);
      if (!n || n <= 0) { alert("Please enter a positive quantity."); return; }
      GM_setValue("faerieRemaining", n);
      GM_setValue("faerieRunActive", true);
      alert(`Run started: ${n} x ${sel.value} -> ${pet.value}\nSwitch to your inventory and press B (or the Start button).`);
      // Optionally open inventory:
      window.open("/inventory.phtml", "_blank");
    };

    return;
  }

  /* ---------------- Inventory Page ---------------- */
  if (location.href.includes("inventory.phtml")) {

    // UI Buttons
    const openBtn = document.createElement("button");
    openBtn.textContent = "Open Faerie Use Menu";
    Object.assign(openBtn.style, {
      position: "fixed", top: "80px", right: "20px", padding: "8px 14px",
      zIndex: 9999, fontSize: "14px", background: "#ffd24d", border: "2px solid #444",
      borderRadius: "6px", cursor: "pointer"
    });
    openBtn.onclick = () => window.open(MENU_URL, "_blank");
    document.body.appendChild(openBtn);

    const startBtn = document.createElement("button");
    startBtn.textContent = "Start Faerie Run (B)";
    Object.assign(startBtn.style, {
      position: "fixed", top: "120px", right: "20px", padding: "8px 14px",
      zIndex: 9999, fontSize: "14px", background: "#7fd282", border: "2px solid #444",
      borderRadius: "6px", cursor: "pointer"
    });
    document.body.appendChild(startBtn);

    const stopBtn = document.createElement("button");
    stopBtn.textContent = "Stop Run (Esc)";
    Object.assign(stopBtn.style, {
      position: "fixed", top: "160px", right: "20px", padding: "8px 14px",
      zIndex: 9999, fontSize: "14px", background: "#ff7a7a", border: "2px solid #444",
      borderRadius: "6px", cursor: "pointer"
    });
    document.body.appendChild(stopBtn);

    startBtn.onclick = () => startFromMenu();
    stopBtn.onclick = () => stopRun();

    // Key handlers: B starts, Esc stops
    document.addEventListener("keydown", (e) => {
      if (e.key === "b" || e.key === "B") {
        startFromMenu();
      } else if (e.key === "Escape") {
        stopRun();
      }
    });

    // On load, if there's an active run with remaining > 0, continue automatically
    (async function autoContinueOnLoad() {
      const active = GM_getValue("faerieRunActive", false);
      let remaining = parseInt(GM_getValue("faerieRemaining", 0), 10);
      if (active && remaining > 0) {
        console.log(`[FaerieRunner] continuing run: ${remaining} remaining`);
        await sleep(400); // let page settle
        attemptUseOnce();
      }
    })();

    // Start logic triggered by B or start button:
    function startFromMenu() {
      const bottle = GM_getValue("faerieType", "");
      const qty = parseInt(GM_getValue("faerieQty", 0), 10);
      const pet = GM_getValue("petName", "");
      if (!bottle || !qty || !pet || qty <= 0) {
        alert("Missing settings. Open the menu, set bottle, quantity, and pet, then save.");
        return;
      }
      // Initialize remaining and active flag
      GM_setValue("faerieRemaining", qty);
      GM_setValue("faerieRunActive", true);
      alert(`Starting run: ${qty} x "${bottle}" -> ${pet}. Script will continue across inventory refreshes.`);
      // Immediately attempt one use on this load
      attemptUseOnce();
    }

    function stopRun() {
      GM_setValue("faerieRunActive", false);
      GM_setValue("faerieRemaining", 0);
      alert("Faerie run stopped.");
    }

    // Core: attempt to use one bottle (single iteration). It will decrement remaining and navigate as needed.
    async function attemptUseOnce() {
      const active = GM_getValue("faerieRunActive", false);
      let remaining = parseInt(GM_getValue("faerieRemaining", 0), 10);
      const bottleName = GM_getValue("faerieType", "");
      const petName = GM_getValue("petName", "");

      if (!active || remaining <= 0) {
        GM_setValue("faerieRunActive", false);
        GM_setValue("faerieRemaining", 0);
        console.log("[FaerieRunner] No active run or nothing remaining.");
        return;
      }

      console.log(`[FaerieRunner] Remaining before use: ${remaining}`);

      // Find the bottle div (first match)
      const item = $all("div[data-itemname]").find(div => div.dataset.itemname && div.dataset.itemname.trim() === bottleName);
      if (!item) {
        // no more bottles on this page — stop to avoid infinite loop
        alert(`No more "${bottleName}" found in inventory. Stopping run.`);
        GM_setValue("faerieRunActive", false);
        GM_setValue("faerieRemaining", 0);
        return;
      }

      try {
        // Ensure no leftover popup
        const old = document.querySelector("#iteminfo, .iteminfo");
        if (old) old.remove();

        // Click the item to open the popup
        item.click();

        // Wait for the dropdown form
        const dropdown = await waitFor("form[name='item_form'] select[name='action']", 6000);
        await sleep(120); // small pause
        // find the option for the pet
        const targetOption = [...dropdown.options].find(o => o.textContent.includes(`Bless ${petName}`));
        if (!targetOption) {
          alert(`Pet "${petName}" not found in the action dropdown. Stopping run.`);
          GM_setValue("faerieRunActive", false);
          GM_setValue("faerieRemaining", 0);
          return;
        }
        dropdown.value = targetOption.value;
        dropdown.dispatchEvent(new Event("change", { bubbles: true }));

        const submitBtn = document.querySelector(".invitem-submit");
        if (!submitBtn) {
          alert("Submit button not found. Aborting run.");
          GM_setValue("faerieRunActive", false);
          GM_setValue("faerieRemaining", 0);
          return;
        }

        // Decrement remaining now and save — this accounts for redirects / partial failures
        remaining = Math.max(0, remaining - 1);
        GM_setValue("faerieRemaining", remaining);
        if (remaining === 0) {
          GM_setValue("faerieRunActive", false);
        }

        // Click submit; site navigates to useobject.phtml
        submitBtn.click();

        // Wait a short moment for navigation to start
        await sleep(1100);

        // If we've navigated to the useobject result page, auto-redirect back to inventory.
        if (location.href.includes("useobject")) {
          // Look for a "Return to Inventory" link or similar; otherwise route to /inventory.phtml
          const invLink = $all("a").find(a => /inventory\.phtml/.test(a.href));
          if (invLink) {
            // Click it after a short pause to allow server to finish
            await sleep(700);
            invLink.click();
            return;
          } else {
            // Fallback: just go back to inventory
            location.href = "/inventory.phtml";
            return;
          }
        }

        // If not navigated, force reload inventory to ensure stack counts update
        await sleep(500);
        location.href = "/inventory.phtml";
        return;

      } catch (err) {
        console.error("[FaerieRunner] error in attemptUseOnce:", err);
        alert("Error during use attempt. Stopping run.");
        GM_setValue("faerieRunActive", false);
        GM_setValue("faerieRemaining", 0);
        return;
      }
    }

    return; // end inventory logic
  } // end inventory

  /* ---------------- useobject.phtml Page Handling ---------------- */
  if (location.href.includes("useobject.phtml")) {
    // If a run is active, auto-redirect back to inventory after a short delay.
    (async () => {
      const active = GM_getValue("faerieRunActive", false);
      const remaining = parseInt(GM_getValue("faerieRemaining", 0), 10);
      // Click any "Return to Inventory" links, or navigate back to inventory
      if (active && remaining > 0) {
        await sleep(900);
        const invLink = $all("a").find(a => /inventory\.phtml/.test(a.href));
        if (invLink) { invLink.click(); return; }
        location.href = "/inventory.phtml";
      } else if (active && remaining === 0) {
        // run finished on the server side but still in useobject - return and notify
        await sleep(900);
        const invLink = $all("a").find(a => /inventory\.phtml/.test(a.href));
        if (invLink) { invLink.click(); return; }
        location.href = "/inventory.phtml";
      } else {
        // Not an active run - do nothing
      }
    })();
  }

})();
