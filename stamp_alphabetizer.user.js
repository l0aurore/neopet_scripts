// ==UserScript==
// @name         Neopets Stamps — Alphabetize Albums 
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Hide the default album-links paragraph on Neopets stamps pages and show albums sorted A→Z.  Adds toggle to reveal original list.
// @match        https://www.neopets.com/stamps.phtml*
// @author       laurore
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    function normalizeText(s) {
        return s.replace(/\s+/g, ' ').trim().toLowerCase();
    }

    function extractAlbumAnchors(root = document) {
        return Array.from(root.querySelectorAll('a[href*="stamps.phtml?type=album"]'));
    }

    // Find the small paragraph that actually contains the album links.
    // Primary strategy: find <b>My Stamp Album</b> then the next element sibling <p>.
    // Fallback: pick the nearest <p> with multiple album anchors and no table inside.
    function findAlbumParagraph() {
        try {
            // XPath to find a <b> that exactly matches "My Stamp Album" (robust to spacing)
            const xpath = "//b[normalize-space(text())='My Stamp Album']";
            const res = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            const bnode = res.singleNodeValue;
            if (bnode) {
                // Walk to the next element sibling (skip text nodes)
                let el = bnode.nextSibling;
                while (el && el.nodeType !== 1) el = el.nextSibling;
                if (el && el.tagName && el.tagName.toLowerCase() === 'p') {
                    // sanity check: it should contain album anchors
                    const anchors = el.querySelectorAll('a[href*="stamps.phtml?type=album"]');
                    if (anchors.length >= 1) return el;
                }
                // sometimes the structure is <b>..</b><p> but the <b> is inside another element; attempt parent search:
                if (bnode.parentElement) {
                    const possibleP = bnode.parentElement.querySelector('p');
                    if (possibleP) {
                        const anchors = possibleP.querySelectorAll('a[href*="stamps.phtml?type=album"]');
                        if (anchors.length >= 1) return possibleP;
                    }
                }
            }
        } catch (e) {
            // ignore and fall back
        }

        // Fallback heuristic: find a <p> that contains multiple album anchors and no table inside (to avoid large blocks)
        const paragraphs = Array.from(document.querySelectorAll('p'));
        for (const p of paragraphs) {
            // skip paragraphs that contain tables (likely big content)
            if (p.querySelector('table')) continue;
            const anchors = p.querySelectorAll('a[href*="stamps.phtml?type=album"]');
            if (anchors.length >= 3 && p.textContent.length < 1200) { // length limit avoids huge paragraphs
                return p;
            }
        }

        // last resort: any container with album anchors but ensure it's not a table or the main content wrapper
        const anchorsAnywhere = extractAlbumAnchors(document);
        if (anchorsAnywhere.length) {
            // prefer the closest parent that is a P or DIV but with limited size
            for (const a of anchorsAnywhere) {
                let candidate = a.closest('p,div');
                if (!candidate) candidate = a.parentElement;
                if (candidate && candidate.tagName && candidate.tagName.toLowerCase() !== 'table' && candidate.textContent.length < 1200) {
                    const albumCount = candidate.querySelectorAll('a[href*="stamps.phtml?type=album"]').length;
                    if (albumCount >= 2) return candidate;
                }
            }
        }

        return null;
    }

    function buildSortedBlock(items) {
        const wrapper = document.createElement('div');
        wrapper.id = 'tm_albums_alpha';
        wrapper.style.margin = '8px 0';
        wrapper.style.padding = '6px';
        wrapper.style.background = 'rgba(255,255,255,0.95)';
        wrapper.style.border = '1px solid #ccc';
        wrapper.style.borderRadius = '6px';
        wrapper.style.fontSize = '14px';

        const title = document.createElement('div');
        title.style.marginBottom = '6px';
        title.innerHTML = '<b>My Stamp Albums — A → Z</b>';
        wrapper.appendChild(title);

        const line = document.createElement('div');
        line.style.lineHeight = '1.6';

        items.forEach((it, idx) => {
            const a = document.createElement('a');
            a.href = it.href;
            a.innerHTML = '<b>' + it.text + '</b>';
            a.style.textDecoration = 'none';
            a.style.marginRight = '6px';
            line.appendChild(a);
            if (idx < items.length - 1) {
                line.appendChild(document.createTextNode(' | '));
            }
        });
        wrapper.appendChild(line);

        const controls = document.createElement('div');
        controls.style.marginTop = '6px';
        controls.style.fontSize = '12px';

        const showOriginalBtn = document.createElement('button');
        showOriginalBtn.textContent = 'Show original order';
        showOriginalBtn.style.cursor = 'pointer';
        showOriginalBtn.style.padding = '4px 6px';
        showOriginalBtn.style.borderRadius = '4px';
        showOriginalBtn.style.border = '1px solid #888';
        showOriginalBtn.style.background = '#f6f6f6';

        controls.appendChild(showOriginalBtn);
        wrapper.appendChild(controls);

        return { wrapper, showOriginalBtn };
    }

    function run() {
        // Only operate when on stamp pages
        if (!location.pathname.includes('/stamps.phtml')) return;

        const albumParagraph = findAlbumParagraph();
        if (!albumParagraph) return;

        // Collect unique album anchors from that paragraph only
        const anchors = Array.from(albumParagraph.querySelectorAll('a[href*="stamps.phtml?type=album"]'));
        const unique = [];
        const seen = new Set();
        anchors.forEach(a => {
            const text = a.textContent.trim();
            // preserve exact href as present (relative or absolute)
            const href = a.getAttribute('href') || a.href;
            // use page_id if present to disambiguate
            let pid = '';
            try {
                const url = new URL(href, location.origin);
                pid = new URLSearchParams(url.search).get('page_id') || '';
            } catch (e) {
                pid = '';
            }
            const key = pid + '|' + text;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push({ text, href, page_id: pid });
            }
        });

        if (!unique.length) return;

        unique.sort((a, b) => {
            const na = normalizeText(a.text);
            const nb = normalizeText(b.text);
            if (na < nb) return -1;
            if (na > nb) return 1;
            return 0;
        });

        // Build sorted block and insert directly before the album paragraph
        const { wrapper, showOriginalBtn } = buildSortedBlock(unique);
        albumParagraph.parentElement.insertBefore(wrapper, albumParagraph);

        // hide only the album paragraph we found
        albumParagraph.style.display = 'none';
        albumParagraph.dataset.tmHidden = 'true';

        showOriginalBtn.addEventListener('click', function () {
            const isHidden = albumParagraph.style.display === 'none';
            if (isHidden) {
                albumParagraph.style.display = '';
                wrapper.style.display = 'none';
            } else {
                albumParagraph.style.display = 'none';
                wrapper.style.display = '';
            }
        });

        // Highlight current page_id if present
        try {
            const currentParams = new URLSearchParams(location.search);
            const currentPid = currentParams.get('page_id');
            if (currentPid !== null) {
                const link = wrapper.querySelector(`a[href*="page_id=${currentPid}"]`);
                if (link) link.style.textDecoration = 'underline';
            }
        } catch (e) { /* ignore */ }
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(run, 50);
    } else {
        document.addEventListener('DOMContentLoaded', run);
    }
})();
