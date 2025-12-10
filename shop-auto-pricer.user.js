// ==UserScript==
// @name         Neopets - Auto Pricer
// @namespace    neopets
// @version      1
// @description  Automatically fill Stock shop prices using last SW/SSW price - 1 NP (needs Senerio's lastnpPrice)
// @author       Laurore
// @match        *://www.neopets.com/market.phtml?type=your*
// @match        *://neopets.com/market.phtml?type=your*
// @match        *://www.neopets.com/market.phtml?order*
// @update       https://github.com/l0aurore/neopet_scripts/
// @update       https://github.com/senerio/neopets-userscripts/compare/main...l0aurore:senerio-sync:patch-1
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    const STORAGE_KEY = "np_lastsw";

    function getStoredPrice(itemName) {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        return data[itemName]?.price ?? null;

    }

    function waitForShopTable() {
        return new Promise(resolve => {
            const check = () => {
                const table = document.querySelector("form table");
                if (table) resolve(table);
                else setTimeout(check, 150);
            };
            check();
        });
    }

    function addPriceButton() {
        const noteElement = [...document.querySelectorAll("b font[color='red']")]
            .find(el => el.textContent.includes("Note"));

        if (!noteElement) return;

        const container = noteElement.closest("p") || noteElement.parentElement;

        const btn = document.createElement("button");
        btn.textContent = "Price Items";
        btn.style.margin = "10px 0";
        btn.style.padding = "6px 10px";
        btn.style.background = "#4CAF50";
        btn.style.color = "#fff";
        btn.style.border = "1px solid #3e8e41";
        btn.style.cursor = "pointer";

        btn.addEventListener("click", (e) => {
            e.preventDefault();
            autoPriceItems();
        });

        container.appendChild(document.createElement("br"));
        container.appendChild(btn);
    }

    async function autoPriceItems() {
        const table = await waitForShopTable();

        const rows = table.querySelectorAll("tbody tr");

        rows.forEach(row => {
            const nameCell = row.querySelector("td:first-child b");
            const priceInput = row.querySelector("input[name^='cost_']");

            if (!nameCell || !priceInput) return;

            const itemName = nameCell.textContent.trim();
            const lastPrice = getStoredPrice(itemName);

            let newPrice;

            if (lastPrice === null) {
                // Unknown SW price → highlight yellow, force value to 0
                priceInput.style.background = "rgb(255, 255, 180)";
                newPrice = 0;
            } else {
                // Known SW price
                priceInput.style.background = ""; // reset any highlight
                if (Number(lastPrice) === 1) {
                    newPrice = 1;
                } else {
                    newPrice = Math.max(1, Number(lastPrice) - 1);
                }
            }

            // Forcefully set the value and trigger input event
            priceInput.value = newPrice;
            priceInput.dispatchEvent(new Event('input', { bubbles: true }));
        });


        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }

    addPriceButton();
})();
