// ==UserScript==
// @name         ItemDB Scraper (Session Storage)
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Scrolls and collects all items on restock page using session storage (avoids clipboard issues)
// @author       Laurore
// @match        https://itemdb.com.br/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'restock_items_session';

    // Clear session storage for this script
    GM_deleteValue(STORAGE_KEY);
    GM_setValue(STORAGE_KEY, JSON.stringify([]));

    const seen = new Set();

    async function scrollAndCollect() {
        const delay = ms => new Promise(res => setTimeout(res, ms));
        let retries = 0;
        let lastCount = 0;

        while (retries < 20) {
            window.scrollBy(0, 300);
            await delay(300);

            const links = Array.from(document.querySelectorAll('a.chakra-link')).filter(el => /\d+ NP/.test(el.textContent));
            links.forEach(link => seen.add(link.textContent.trim()));

            if (seen.size === lastCount) {
                retries++;
            } else {
                lastCount = seen.size;
                retries = 0;
                console.log(`Collected ${seen.size} items...`);
            }
        }

        const finalList = Array.from(seen).sort();
        GM_setValue(STORAGE_KEY, JSON.stringify(finalList));

        console.log(`✅ Collection done! ${finalList.length} items saved to temporary storage.`);

        // Optional: display in popup
        alert(`Finished! ${finalList.length} items saved.\nOpen the console (F12) to view.`);

        // Display result in console
        console.log("====== Item List ======");
        console.log(finalList.join("\n"));
    }

    scrollAndCollect();
})();
