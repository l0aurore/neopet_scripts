// ==UserScript==
// @name         Neopets Trading Post 10 Auto Selector & scroll
// @namespace    neopets
// @version      1.1
// @description  Adds a button to select the first 10 checkboxes on the Neopets Mystery Island Trading Post page
// @author       Laurore
// @match        *://www.neopets.com/island/tradingpost.phtml*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const MAX_CHECKBOXES = 10;

    // Function to create and add the selection button
    function addSelectionButton() {
        // Create the button element
        const button = document.createElement('button');
        button.textContent = 'Select First 10 Items';
        button.id = 'select-first-ten';

        // Style the button to match Neopets aesthetic
        button.style.backgroundColor = '#FFCB00';
        button.style.color = '#000';
        button.style.border = '2px solid #7B4C00';
        button.style.borderRadius = '5px';
        button.style.padding = '5px 10px';
        button.style.margin = '10px 0';
        button.style.fontWeight = 'bold';
        button.style.cursor = 'pointer';
        button.style.fontFamily = 'Verdana, Arial, Helvetica, sans-serif';
        button.style.fontSize = '12px';

        // Add hover effect
        button.addEventListener('mouseover', function() {
            this.style.backgroundColor = '#FFA800';
        });

        button.addEventListener('mouseout', function() {
            this.style.backgroundColor = '#FFCB00';
        });

        // Add click event listener
        button.addEventListener('click', selectFirstTenCheckboxes);

        // Find the appropriate location to insert the button
        const tradingPostForm = document.querySelector('form[name="trade_form"]');

        if (tradingPostForm) {
            // Insert before the first element in the form
            tradingPostForm.insertBefore(button, tradingPostForm.firstChild);
        } else {
            // Fallback: try to find a table on the page and insert before it
            const tables = document.querySelectorAll('table');

            for (const table of tables) {
                if (table.textContent.includes('Trading Post')) {
                    table.parentNode.insertBefore(button, table);
                    break;
                }
            }
        }
    }

    // Function to select the first 10 checkboxes
    function selectFirstTenCheckboxes() {
        // Find all checkboxes on the page
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');

        // First uncheck all checkboxes
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });

        // Count how many checkboxes we've checked
        let checkedCount = 0;
        let lastCheckedCheckbox = null;

        // Check the first MAX_CHECKBOXES checkboxes
        for (let i = 0; i < checkboxes.length && checkedCount < MAX_CHECKBOXES; i++) {
            // Skip any disabled checkboxes
            if (!checkboxes[i].disabled) {
                checkboxes[i].checked = true;
                checkedCount++;
                lastCheckedCheckbox = checkboxes[i];
            }
        }

        // Find the "Start Trading" button and scroll to it
        setTimeout(() => {
            // Look for the submit button with "Start Trading" text or value
            const startTradingButton = Array.from(document.querySelectorAll('input[type="submit"]')).find(
                button => button.value && button.value.includes('Start Trading')
            );

            // If found, scroll to it
            if (startTradingButton) {
                // Calculate position to scroll to (a bit above the element to provide context)
                const scrollTarget = startTradingButton.getBoundingClientRect().top + window.pageYOffset - 100;

                // Smooth scroll to the position
                window.scrollTo({
                    top: scrollTarget,
                    behavior: 'smooth'
                });
            }
            // If not found by value, try to find by nearby text or other elements
            else {
                // Look for elements containing "Start Trading" text
                const allElements = document.querySelectorAll('*');
                let startTradingElement = null;

                for (const element of allElements) {
                    if (element.textContent && element.textContent.includes('Start Trading')) {
                        startTradingElement = element;
                        break;
                    }
                }

                // If found by text, scroll to it
                if (startTradingElement) {
                    const scrollTarget = startTradingElement.getBoundingClientRect().top + window.pageYOffset - 100;
                    window.scrollTo({
                        top: scrollTarget,
                        behavior: 'smooth'
                    });
                }
                // If all else fails, scroll to the bottom of the form
                else {
                    const form = document.querySelector('form[name="trade_form"]');
                    if (form) {
                        const scrollTarget = form.getBoundingClientRect().bottom + window.pageYOffset - 200;
                        window.scrollTo({
                            top: scrollTarget,
                            behavior: 'smooth'
                        });
                    }
                }
            }
        }, 100);


    }

    // Function to check if we're on the Trading Post page with checkboxes
    function isRelevantTradingPostPage() {
        // Check if there are checkboxes on the page
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        if (checkboxes.length === 0) return false;

        // Check if the URL contains 'tradingpost.phtml'
        if (!window.location.href.includes('tradingpost.phtml')) return false;

        return true;
    }

    // Main execution
    function main() {
        // Only run on pages with checkboxes
        if (isRelevantTradingPostPage()) {
            addSelectionButton();
        }
    }

    // Add a small delay to ensure the page is fully loaded
    setTimeout(main, 500);
})();
