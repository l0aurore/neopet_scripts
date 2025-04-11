// ==UserScript==
// @name         Auto Opening Fight Clicker
// @namespace    neopets
// @author       Laurore
// @version      1.1
// @description  Clicks Fight, opening scene only
// @match        *://www.neopets.com/dome/arena.phtml
// @update      https://github.com/l0aurore/neopet_scripts/
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const buttonSequence = [
        { selector: '#start' }, // Fight button (ID)
    ];

    function waitForElement(selector, timeout = 1000) {
        return new Promise((resolve, reject) => {
            const interval = 100;
            let elapsed = 0;
            const check = setInterval(() => {
                const element = document.querySelector(selector);
                if (element) {
                    clearInterval(check);
                    resolve(element);
                } else if (elapsed >= timeout) {
                    clearInterval(check);
                    reject(`Timeout waiting for ${selector}`);
                }
                elapsed += interval;
            }, interval);
        });
    }

    async function clickSequence() {
        for (const btn of buttonSequence) {
            try {
                const element = await waitForElement(btn.selector);
                console.log(`Found and clicking: ${btn.selector}`);
                element.click();
            } catch (err) {
                console.log(err);
            }
        }
    }

    // Run it
    clickSequence();
})();
