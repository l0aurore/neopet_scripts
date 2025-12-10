// ==UserScript==
// @name         Sales History Sorter
// @namespace    neopets
// @version      1.1
// @description  Add sortable headers to sales history table, can change accending or deccending
// @match        *://www.neopets.com/market.phtml?type=sales
// @author       Laurore
// @update       https://github.com/l0aurore/neopet_scripts
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- repeatedly look for the table until it exists ---
    const waitForTable = setInterval(() => {

        // Search all frames too
        const docs = [document, ...Array.from(window.frames).map(f => f.document)];

        let headerCells = null;
        let headerDoc = null;

        for (const doc of docs) {
            try {
                const cells = doc.querySelectorAll("td[bgcolor='#dddd77'] b");
                if (cells && cells.length >= 4) {
                    headerCells = cells;
                    headerDoc = doc;
                    break;
                }
            } catch {}
        }

        if (!headerCells) return; // keep waiting

        clearInterval(waitForTable);

        console.log("Sales History: Found header cells!", headerCells);

        const headerRow = headerCells[0].closest("tr");
        const table = headerRow.closest("table");

        if (!headerRow || !table) {
            console.log("Sorter: Could not locate table properly.");
            return;
        }

        // Build list of all rows
        function getRows() {
            return Array.from(headerRow.parentElement.querySelectorAll("tr"))
                .filter(r => r !== headerRow);
        }

        // Add sort buttons
        headerCells.forEach((cell, index) => {
            const td = cell.parentElement;
            td.style.cursor = "pointer";

            const arrow = headerDoc.createElement("span");
            arrow.textContent = " ▲▼";
            arrow.style.fontSize = "10px";
            arrow.style.marginLeft = "4px";
            td.appendChild(arrow);

            let asc = true;

            td.addEventListener("click", () => {
                sortColumn(index, asc);
                asc = !asc;
                arrow.textContent = asc ? " ▲▼" : " ▼▲";
            });
        });

        // Sorting function
        function sortColumn(col, asc) {
            const rows = getRows();
            const sorted = rows.sort((a, b) => {
                const A = a.children[col]?.innerText.trim() || "";
                const B = b.children[col]?.innerText.trim() || "";

                let vA = A, vB = B;

                if (col === 0) {               // Date
                    vA = parseDate(A);
                    vB = parseDate(B);
                } else if (col === 3) {        // Price
                    vA = parsePrice(A);
                    vB = parsePrice(B);
                } else {                       // Text
                    vA = A.toLowerCase();
                    vB = B.toLowerCase();
                }

                if (vA < vB) return asc ? -1 : 1;
                if (vA > vB) return asc ? 1 : -1;
                return 0;
            });

            sorted.forEach(r => headerRow.parentElement.appendChild(r));
        }

        // Helpers
        function parseDate(str) {
            const p = str.split("/");
            if (p.length !== 3) return 0;
            return new Date(p[2], p[0] - 1, p[1]).getTime();
        }

        function parsePrice(str) {
            return parseInt(str.replace(/[^\d]/g, "")) || 0;
        }

    }, 300);

})();
