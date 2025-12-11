// ==UserScript==
// @name         Neopets — stamp overhaul
// @namespace    neopets
// @version      2.0
// @description  Tracks album completion, hides completed albums, alphabetizes incomplete ones, and navigation skips completed pages.
// @author.      laurore
// @update.      raw
// @match        *://www.neopets.com/stamps.phtml*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

(function(){

/* -----------------------------------------------------------
   MODULE 1 — Stamp Album Completion Tracker + Auto-Hider
----------------------------------------------------------- */

(function ALBUM_TRACKER() {
    "use strict";

    const urlParams = new URLSearchParams(location.search);
    const type = urlParams.get("type") || "";
    const pageId = urlParams.get("page_id");

    function loadData() {
        return GM_getValue("albumData", {
            albums: {},
            maxPageId: 0
        });
    }

    function saveData(data) {
        GM_setValue("albumData", data);
    }

    function isProgressPage() {
        return type === "progress";
    }

    function isAlbumPage() {
        return type === "album" && pageId !== null;
    }

    function parseProgressPage() {
        const data = loadData();

        const rows = [...document.querySelectorAll("table tr")].filter(
            tr => tr.querySelector('a[href*="page_id"]')
        );

        rows.forEach(row => {
            const link = row.querySelector('a[href*="page_id"]');
            if (!link) return;

            const urlObj = new URL(link.href, location.origin);
            const id = urlObj.searchParams.get("page_id");
            const name = link.textContent.trim();

            const percentCell = row.querySelector('td font b') || row.querySelector('td b');
            if (!percentCell) return;

            const percentText = percentCell.textContent.trim().replace("%", "");
            const percent = parseInt(percentText, 10);
            const complete = percent === 100;

            data.albums[id] = { name, complete };
            data.maxPageId = Math.max(data.maxPageId, Number(id));
        });

        saveData(data);
    }

    function hideCompletedOnOverview() {
        const data = loadData();

        const rows = [...document.querySelectorAll("table tr")].filter(
            tr => tr.querySelector('a[href*="page_id"]')
        );

        rows.forEach(row => {
            const link = row.querySelector('a[href*="page_id"]');
            const urlObj = new URL(link.href, location.origin);
            const id = urlObj.searchParams.get("page_id");

            if (data.albums[id]?.complete) row.style.display = "none";
        });
    }

    function hideCompletedOnAlbumPages() {
        const data = loadData();
        const realId = pageId;

        if (!data.albums[realId]?.complete) return;

        const sidebarLinks = [...document.querySelectorAll('a[href*="stamps.phtml?type=album&page_id="]')];
        const index = Number(realId) - 1;

        const link = sidebarLinks[index];
        if (!link) return;

        const parent = link.closest("tr") || link.closest("p") || link;
        parent.style.display = "none";
    }

    if (isProgressPage()) {
        parseProgressPage();
        hideCompletedOnOverview();
    } else if (isAlbumPage()) {
        hideCompletedOnAlbumPages();
    }
})();


/* -----------------------------------------------------------
   MODULE 2 — Navigation (Modified to Skip Completed Albums)
----------------------------------------------------------- */

(function NAVIGATION() {
    'use strict';

    if (!location.search.includes("type=album")) return;

    const MIN_PAGE = 0;
    const MAX_PAGE = 49;

    const albumData = GM_getValue("albumData", { albums: {} });

    function isIncomplete(id) {
        return !albumData.albums[id]?.complete;
    }

    function findNextIncomplete(current) {
        for (let i = current + 1; i <= MAX_PAGE; i++) {
            if (isIncomplete(i)) return i;
        }
        return current;
    }

    function findPrevIncomplete(current) {
        for (let i = current - 1; i >= MIN_PAGE; i--) {
            if (isIncomplete(i)) return i;
        }
        return current;
    }

    function getCurrentPage() {
        const params = new URLSearchParams(window.location.search);
        const n = parseInt(params.get('page_id') || "0", 10);
        return Math.min(MAX_PAGE, Math.max(MIN_PAGE, n));
    }

    function buildUrlWithPage(page) {
        const url = new URL(window.location.href);
        url.searchParams.set('page_id', String(page));
        return url.toString();
    }

    function findStampTable() {
        const tables = Array.from(document.querySelectorAll('table[width="450"], table[width="450"][height="450"]'));
        for (const t of tables) {
            if (t.querySelector('img[src*="stamp"], img[src*="items"]')) return t;
        }
        return Array.from(document.querySelectorAll('table'))
            .find(t => t.querySelector('img[src*="stamp"]'));
    }

    function createNavUI(curr) {
        const div = document.createElement("div");
        div.style.textAlign = "center";
        div.style.margin = "10px";

        const prev = document.createElement("button");
        prev.textContent = "Previous";

        const next = document.createElement("button");
        next.textContent = "Next";

        const info = document.createElement("span");
        info.style.margin = "0 8px";
        info.textContent = `Page ${curr}`;

        prev.onclick = () => {
            const p = getCurrentPage();
            const newPage = findPrevIncomplete(p);
            if (newPage !== p) location.href = buildUrlWithPage(newPage);
        };

        next.onclick = () => {
            const p = getCurrentPage();
            const newPage = findNextIncomplete(p);
            if (newPage !== p) location.href = buildUrlWithPage(newPage);
        };

        window.addEventListener("keydown", ev => {
            if (ev.key === "ArrowLeft") {
                const p = getCurrentPage();
                const newPage = findPrevIncomplete(p);
                if (newPage !== p) location.href = buildUrlWithPage(newPage);
            }
            if (ev.key === "ArrowRight") {
                const p = getCurrentPage();
                const newPage = findNextIncomplete(p);
                if (newPage !== p) location.href = buildUrlWithPage(newPage);
            }
        });

        div.append(prev, info, next);
        return div;
    }

    const table = findStampTable();
    if (table) table.before(createNavUI(getCurrentPage()));

})();


/* -----------------------------------------------------------
   MODULE 3 — Alphabetized Album List (Now Skips Completed)
----------------------------------------------------------- */

(function ALPHABETIZE() {
    'use strict';

    if (!location.search.includes("type=album")) return;

    const albumData = GM_getValue("albumData", { albums: {} });

    function normalize(s){ return s.replace(/\s+/g,' ').trim().toLowerCase(); }

    function findAlbumParagraph() {
        const xpath = "//b[normalize-space(text())='My Stamp Album']";
        const res = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const b = res.singleNodeValue;

        if (b) {
            let el = b.nextSibling;
            while (el && el.nodeType !== 1) el = el.nextSibling;
            if (el?.tagName?.toLowerCase() === "p") return el;
        }

        return Array.from(document.querySelectorAll("p"))
            .find(p => p.querySelectorAll('a[href*="stamps.phtml?type=album"]').length >= 3);
    }

    const albumP = findAlbumParagraph();
    if (!albumP) return;

    const anchors = Array.from(albumP.querySelectorAll('a[href*="stamps.phtml?type=album"]'));

    const unique = [];
    const seen = new Set();

    anchors.forEach(a => {
        const text = a.textContent.trim();
        const href = a.getAttribute("href") || a.href;
        if (!seen.has(text + "|" + href)) {
            seen.add(text + "|" + href);
            unique.push({ text, href });
        }
    });

    // Filter out completed albums
    const filtered = unique.filter(it => {
        try {
            const url = new URL(it.href, location.origin);
            const pid = url.searchParams.get("page_id");
            return !(pid && albumData.albums[pid]?.complete);
        } catch {
            return true;
        }
    });

    filtered.sort((a,b)=>normalize(a.text).localeCompare(normalize(b.text)));

    function buildBlock(list){
        const wrap = document.createElement("div");
        wrap.style.margin = "8px 0";
        wrap.style.padding = "6px";
        wrap.style.background = "white";
        wrap.style.border = "1px solid #ccc";

        const title = document.createElement("div");
        title.innerHTML = "<b>My Stamp Albums — A → Z</b>";
        wrap.append(title);

        const line = document.createElement("div");
        list.forEach((it,i)=>{
            const a = document.createElement("a");
            a.href = it.href;
            a.innerHTML = "<b>" + it.text + "</b>";
            line.append(a);
            if (i < list.length - 1) line.append(" | ");
        });
        wrap.append(line);

        const btn = document.createElement("button");
        btn.textContent = "Show original order";
        btn.style.marginTop = "6px";

        wrap.append(btn);

        btn.onclick = () => {
            const hidden = albumP.style.display === "none";
            albumP.style.display = hidden ? "" : "none";
            wrap.style.display = hidden ? "none" : "";
        };

        return wrap;
    }

    const block = buildBlock(filtered);
    albumP.before(block);
    albumP.style.display = "none";
})();

})();
