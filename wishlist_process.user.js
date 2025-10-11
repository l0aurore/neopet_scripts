// ==UserScript==
// @name         Neopets Wishlist Manager4
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Manage, parse, and format wishlists from Jellyneo and ItemDB with manual item entry support
// @author       You
// @match        *://*.neopets.com/*
// @match        *://items.jellyneo.net/mywishes/*
// @match        *://itemdb.com.br/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      items.jellyneo.net
// @connect      itemdb.com.br
// ==/UserScript==

(function() {
    'use strict';

    // Styles for the overlay
    const styles = `
        #wishlist-manager {
            position: fixed;
            top: 50px;
            right: 50px;
            width: 400px;
            max-height: 600px;
            background-color: #fff;
            border: 2px solid #6c3064;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            z-index: 10000;
            overflow: hidden;
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
        }
        #wishlist-manager-header {
            background-color: #6c3064;
            color: white;
            padding: 10px;
            cursor: move;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        #wishlist-manager-title {
            font-weight: bold;
            margin: 0;
        }
        #wishlist-manager-close {
            background: none;
            border: none;
            color: white;
            font-size: 18px;
            cursor: pointer;
        }
        #wishlist-manager-content {
            padding: 15px;
            overflow-y: auto;
            flex-grow: 1;
        }
        #wishlist-manager-form {
            margin-bottom: 15px;
        }
        #wishlist-manager-form input[type="text"],
        #wishlist-manager-form input[type="url"],
        #wishlist-manager-form input[type="color"] {
            width: 100%;
            padding: 8px;
            margin-bottom: 10px;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-sizing: border-box;
        }
        #wishlist-manager-form button {
            background-color: #6c3064;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 4px;
            cursor: pointer;
            margin-right: 5px;
        }
        #wishlist-manager-form button:hover {
            background-color: #8a4b85;
        }
        .wishlist-item {
            border: 1px solid #eee;
            border-radius: 4px;
            padding: 10px;
            margin-bottom: 10px;
            position: relative;
        }
        .wishlist-header {
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .wishlist-name {
            font-weight: bold;
            margin-bottom: 5px;
            display: flex;
            align-items: center;
            flex-grow: 1;
        }
        .wishlist-color-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            display: inline-block;
            margin-right: 8px;
        }
        .wishlist-toggle {
            font-size: 18px;
            color: #6c3064;
            cursor: pointer;
            transition: transform 0.3s;
            user-select: none;
            padding: 0 5px;
        }
        .wishlist-toggle.collapsed {
            transform: rotate(-90deg);
        }
        .wishlist-content {
            overflow: hidden;
            transition: max-height 0.3s ease;
        }
        .wishlist-content.collapsed {
            max-height: 0 !important;
            padding-top: 0;
            padding-bottom: 0;
            margin-top: 0;
            margin-bottom: 0;
            border-top: none;
        }
        .wishlist-actions {
            margin-top: 8px;
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        .wishlist-actions button {
            background-color: #f0f0f0;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 12px;
            cursor: pointer;
        }
        .wishlist-actions button:hover {
            background-color: #e0e0e0;
        }
        .wishlist-url {
            font-size: 12px;
            color: #666;
            word-break: break-all;
            margin-bottom: 5px;
        }
        .formatted-items {
            background-color: #f8f8f8;
            border: 1px solid #eee;
            border-radius: 4px;
            padding: 8px;
            font-size: 12px;
            max-height: 100px;
            overflow-y: auto;
            margin-top: 8px;
            white-space: pre-wrap;
            word-break: break-all;
        }
        .wl-manager-toggle {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background-color: #6c3064;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 12px;
            cursor: pointer;
            z-index: 9999;
        }
        .edit-name-input {
            width: calc(100% - 10px);
            padding: 4px;
            margin-bottom: 5px;
            border: 1px solid #ccc;
            border-radius: 4px;
        }
        .edit-buttons {
            display: flex;
            gap: 5px;
            margin-bottom: 5px;
        }
        .edit-buttons button {
            flex: 1;
            padding: 4px;
            border: 1px solid #ccc;
            border-radius: 4px;
            cursor: pointer;
        }
        .status-message {
            font-size: 12px;
            padding: 5px;
            margin-top: 5px;
            border-radius: 4px;
        }
        .status-message.success {
            background-color: #e6f7e6;
            color: #2e7d32;
        }
        .status-message.error {
            background-color: #ffebee;
            color: #c62828;
        }
        .status-message.loading {
            background-color: #e3f2fd;
            color: #1565c0;
        }
        #manual-input-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10001;
        }
        #manual-input-container {
            background: white;
            border-radius: 8px;
            padding: 20px;
            width: 80%;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            font-family: Arial, sans-serif;
        }
        #manual-items-input {
            width: 100%;
            height: 200px;
            margin-bottom: 15px;
            padding: 8px;
            border: 1px solid #ccc;
            font-family: monospace;
        }
        .manual-input-buttons {
            display: flex;
            justify-content: space-between;
            margin-bottom: 15px;
        }
        .manual-input-buttons button {
            padding: 8px 15px;
            border-radius: 4px;
            cursor: pointer;
        }
        #cancel-manual-input {
            background: #f0f0f0;
            border: 1px solid #ccc;
        }
        #process-manual-input {
            background: #6c3064;
            color: white;
            border: none;
        }
    `;

    // Check if we're on neopets.com or if we need to handle parsing
    const isNeopetsPage = window.location.hostname.includes('neopets.com');
    const isJellyNeoWishlist = window.location.hostname.includes('items.jellyneo.net') &&
                               window.location.pathname.includes('/mywishes/');
    const isItemDBPage = window.location.hostname.includes('itemdb.com.br');

    // If we're on a wishlist page that was opened for parsing
    if ((isJellyNeoWishlist || isItemDBPage) && window.location.href.includes('wl_parse=true')) {
        handleWishlistParsePage();
        return; // Don't continue with the main script
    }

    // Only proceed with the main manager on Neopets pages
    if (!isNeopetsPage) return;

    // Add styles to the page
    const styleElement = document.createElement('style');
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);

    // Create the toggle button
    const toggleButton = document.createElement('button');
    toggleButton.className = 'wl-manager-toggle';
    toggleButton.textContent = 'Wishlist Manager';
    document.body.appendChild(toggleButton);

    // Create the manager overlay
    const wishlistManager = document.createElement('div');
    wishlistManager.id = 'wishlist-manager';
    wishlistManager.style.display = 'none';

    wishlistManager.innerHTML = `
        <div id="wishlist-manager-header">
            <h3 id="wishlist-manager-title">Neopets Wishlist Manager</h3>
            <button id="wishlist-manager-close">×</button>
        </div>
        <div id="wishlist-manager-content">
            <div id="wishlist-manager-form">
                <input type="text" id="wishlist-name" placeholder="Wishlist Name">
                <input type="url" id="wishlist-url" placeholder="Wishlist URL (JellyNeo or ItemDB)">
                <div style="display: flex; align-items: center; margin-bottom: 10px;">
                    <label for="wishlist-color" style="margin-right: 10px;">Color:</label>
                    <input type="color" id="wishlist-color" value="#6c3064">
                </div>
                <div style="display: flex; margin-bottom: 10px;">
                    <button id="add-wishlist">Add Wishlist</button>
                    <button id="open-manual-input">Manual Item Entry</button>
                </div>
            </div>
            <div id="wishlists-container"></div>
        </div>
    `;

    document.body.appendChild(wishlistManager);

    // References to DOM elements
    const wishlists = JSON.parse(localStorage.getItem('neopetsWishlists') || '[]');
    const wishlistsContainer = document.getElementById('wishlists-container');
    const addWishlistButton = document.getElementById('add-wishlist');
    const openManualInputButton = document.getElementById('open-manual-input');
    const closeButton = document.getElementById('wishlist-manager-close');
    const wishlistNameInput = document.getElementById('wishlist-name');
    const wishlistUrlInput = document.getElementById('wishlist-url');
    const wishlistColorInput = document.getElementById('wishlist-color');

    // Make the wishlist manager draggable
    makeDraggable(wishlistManager, document.getElementById('wishlist-manager-header'));

    // Toggle wishlist manager visibility
    toggleButton.addEventListener('click', () => {
        wishlistManager.style.display = wishlistManager.style.display === 'none' ? 'flex' : 'none';
    });

    // Close wishlist manager
    closeButton.addEventListener('click', () => {
        wishlistManager.style.display = 'none';
    });

    // Open manual input dialog
    openManualInputButton.addEventListener('click', () => {
        showManualInputDialog();
    });

    // Add wishlist
    addWishlistButton.addEventListener('click', async () => {
        const name = wishlistNameInput.value.trim();
        const url = wishlistUrlInput.value.trim();
        const color = wishlistColorInput.value;

        if (!name || !url) {
            showStatusMessage(addWishlistButton, 'Please fill in all fields', 'error');
            return;
        }

        if (!isValidWishlistUrl(url)) {
            showStatusMessage(addWishlistButton, 'Please enter a valid JellyNeo or ItemDB wishlist URL', 'error');
            return;
        }

        // Add status message
        showStatusMessage(addWishlistButton, 'Fetching wishlist data...', 'loading');

        try {
            const items = await parseWishlist(url);
            if (items.length === 0) {
                showStatusMessage(addWishlistButton, 'No items found in wishlist', 'error');
                return;
            }

            const formattedItems = formatItems(items);

            const wishlist = {
                id: Date.now(),
                name,
                url,
                color,
                items,
                formattedItems,
                collapsed: false
            };

            wishlists.push(wishlist);
            saveWishlists();
            renderWishlists();

            // Clear form inputs
            wishlistNameInput.value = '';
            wishlistUrlInput.value = '';

            showStatusMessage(addWishlistButton, 'Wishlist added successfully!', 'success');
        } catch (error) {
            console.error('Error fetching wishlist:', error);
            showStatusMessage(addWishlistButton, 'Error fetching wishlist: ' + error.message, 'error');
        }
    });

    // Initial render of wishlists
    renderWishlists();

    // Show manual input dialog
    function showManualInputDialog() {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'manual-input-overlay';

        // Create container
        const container = document.createElement('div');
        container.id = 'manual-input-container';

        container.innerHTML = `
            <h2 style="color: #6c3064; margin-top: 0;">Manual Item Entry</h2>
            <p>Copy item names from ItemDB and paste below. Each item should be on a separate line.</p>
            <textarea id="manual-items-input" placeholder="Paste item list here..."></textarea>
            <p>Tips: Copy the entire page content and paste it here. The system will automatically filter out non-item text.</p>
            <div class="manual-input-buttons">
                <button id="cancel-manual-input">Cancel</button>
                <button id="process-manual-input">Process Items</button>
            </div>
            <div id="manual-processing-result"></div>
        `;

        overlay.appendChild(container);
        document.body.appendChild(overlay);

        // Set up event listeners
        document.getElementById('cancel-manual-input').addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        document.getElementById('process-manual-input').addEventListener('click', () => {
            const inputText = document.getElementById('manual-items-input').value;
            const items = processManualItemList(inputText);

            const resultDiv = document.getElementById('manual-processing-result');

            if (items.length === 0) {
                resultDiv.innerHTML = '<p style="color: red;">No valid items found. Please check your input.</p>';
                return;
            }

            // Format the items
            const formattedItems = formatItems(items);

            // Create a new wishlist with the processed items
            const name = wishlistNameInput.value.trim() || 'Manual Wishlist';
            const color = wishlistColorInput.value;

            const wishlist = {
                id: Date.now(),
                name,
                url: 'manual-entry',
                color,
                items,
                formattedItems,
                collapsed: false
            };

            wishlists.push(wishlist);
            saveWishlists();
            renderWishlists();

            // Clear form inputs
            wishlistNameInput.value = '';

            // Show success message and formatted items
            resultDiv.innerHTML = `
                <div class="status-message success" style="margin-bottom: 10px;">
                    ${items.length} items processed and added to your wishlists!
                </div>
                <p>Formatted Items:</p>
                <textarea style="width: 100%; height: 150px; margin-top: 5px; padding: 8px; border: 1px solid #ccc; font-family: monospace;">${formattedItems}</textarea>
                <button id="copy-formatted-items" style="margin-top: 10px; padding: 5px 10px; background: #6c3064; color: white; border: none; border-radius: 4px; cursor: pointer;">Copy to Clipboard</button>
            `;

            // Set up copy button
            document.getElementById('copy-formatted-items').addEventListener('click', () => {
                const textarea = resultDiv.querySelector('textarea');
                textarea.select();
                document.execCommand('copy');

                // Visual feedback
                const copyButton = document.getElementById('copy-formatted-items');
                const originalText = copyButton.textContent;
                copyButton.textContent = 'Copied!';
                setTimeout(() => {
                    copyButton.textContent = originalText;
                }, 2000);
            });
        });
    }

    // Process manual item list
    function processManualItemList(text) {
        // Split by lines
        let lines = text.split('\n');

        const items = [];

        for (const line of lines) {
            let cleanLine = line.trim();

            // Skip empty lines
            if (!cleanLine) continue;

            // ✅ Remove price from end (e.g. "2349 NP" or "2,349 NP")
            cleanLine = cleanLine.replace(/[\d,]+\s*NP$/, '').trim();

            // ✅ Skip if it matches any excluded term
            let shouldSkip = false;
            // Example: if (cleanLine.includes("Booktastic")) shouldSkip = true;
            if (shouldSkip) continue;

            // ✅ Skip rarity pattern
            if (cleanLine.match(/r\d+-r\d+/)) continue;

            // ✅ Skip very short lines
            if (cleanLine.length < 3) continue;

            // ✅ Deduplicate
            if (!items.includes(cleanLine)) {
                items.push(cleanLine);
            }
        }

        return items;
    }


    // Handle parsing in a new tab
    function handleWishlistParsePage() {
        const items = [];
        const currentUrl = window.location.href.replace('wl_parse=true', '').replace(/[&?]$/, '');

        console.log('Parsing wishlist page:', currentUrl);

        try {
            // Parse JellyNeo wishlist
            if (isJellyNeoWishlist) {
                const itemElements = document.querySelectorAll('.item-block-grid li');
                console.log('JellyNeo items found:', itemElements.length);

                itemElements.forEach(item => {
                    // First try to get from img alt attribute
                    const nameElem = item.querySelector('img[alt]');
                    if (nameElem && nameElem.alt) {
                        const itemName = nameElem.alt.split(' - ')[0].trim();
                        items.push(itemName);
                        console.log('Found item (img):', itemName);
                        return;
                    }

                    // Then try to get from anchor text which should be the direct name
                    const nameLink = item.querySelector('a.no-link-icon');
                    if (nameLink && nameLink.textContent) {
                        items.push(nameLink.textContent.trim());
                        console.log('Found item (link):', nameLink.textContent.trim());
                    }
                });
            }
            // Parse ItemDB page
            else if (isItemDBPage) {
                console.log('ItemDB page detected - showing manual copy instructions');

                // Instead of parsing, show instructions for manual copying
                document.body.innerHTML = `
                    <div style="text-align: center; padding: 20px; font-family: Arial, sans-serif;">
                        <h1 style="color: #6c3064;">Manual Copy Instructions</h1>
                        <p>For more accurate results, please follow these steps:</p>
                        <ol style="text-align: left; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <li>Press <strong>Ctrl+A</strong> to select all content on this page</li>
                            <li>Press <strong>Ctrl+C</strong> to copy the selected content</li>
                            <li>Close this tab and return to the Neopets page</li>
                            <li>Click the <strong>Manual Item Entry</strong> button</li>
                            <li>Paste the copied content and click <strong>Process Items</strong></li>
                        </ol>
                        <p style="margin-top: 20px;">The system will automatically filter out non-item text and format the items for you.</p>
                        <button id="close-tab-button" style="padding: 10px 15px; background: #6c3064; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 20px;">Close This Tab</button>
                    </div>
                `;

                // Add close button functionality
                document.getElementById('close-tab-button').addEventListener('click', () => {
                    window.close();
                });

                // No need to continue processing
                return;
            }

            console.log('Total items parsed:', items.length);

            // Send the items back to the opener window
            if (window.opener && items.length > 0) {
                window.opener.postMessage({
                    type: 'wishlistItems',
                    sourceUrl: currentUrl,
                    items: items
                }, '*');

                // Display a message that parsing was successful
                const body = document.body;
                const overlay = document.createElement('div');
                overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);color:white;display:flex;justify-content:center;align-items:center;z-index:99999;';

                const message = document.createElement('div');
                message.innerHTML = '<h2>Parsing Complete!</h2><p>Found ' + items.length + ' items</p><p>You can close this tab now.</p>';
                message.style.textAlign = 'center';

                overlay.appendChild(message);
                body.appendChild(overlay);

                // Close the tab after a delay
                setTimeout(() => {
                    if (window.opener) {
                        window.close();
                    }
                }, 3000);
            }
        } catch (error) {
            console.error('Error parsing wishlist:', error);
            alert('Error parsing wishlist: ' + error.message);
        }
    }

    // Parse wishlist url
    async function parseWishlist(url) {
        return new Promise((resolve, reject) => {
            // Check if it's a JellyNeo or ItemDB wishlist
            const isJellyNeo = url.includes('items.jellyneo.net');
            const isItemDB = url.includes('itemdb.com.br');

            if (!isJellyNeo && !isItemDB) {
                reject(new Error('Unsupported wishlist URL'));
                return;
            }

            // For ItemDB, suggest manual entry
            if (isItemDB) {
                showManualInputDialog();
                reject(new Error('For ItemDB pages, please use the Manual Item Entry option'));
                return;
            }

            // Add the parse parameter to the URL
            const parseUrl = new URL(url);
            parseUrl.searchParams.set('wl_parse', 'true');

            // Open the wishlist in a new tab for parsing
            const newTab = window.open(parseUrl.toString(), '_blank');

            // Set a timer to check for the parsed data
            const maxChecks = 60; // Maximum number of checks (1 minute)
            let checkCount = 0;

            const checkInterval = setInterval(() => {
                const parsedData = localStorage.getItem('parsedWishlist');

                if (parsedData) {
                    clearInterval(checkInterval);
                    const data = JSON.parse(parsedData);

                    // Only use the data if the URL matches
                    if (data.url === url.replace('wl_parse=true', '').replace(/[&?]$/, '')) {
                        localStorage.removeItem('parsedWishlist');
                        resolve(data.items);
                    } else {
                        reject(new Error('URL mismatch'));
                    }
                }

                checkCount++;
                if (checkCount >= maxChecks) {
                    clearInterval(checkInterval);
                    reject(new Error('Timed out waiting for wishlist parsing'));
                }
            }, 1000);
        });
    }

    // Format items for display
    function formatItems(items) {
        return items.map(item => `"${item}"`).join(',\n');
    }

    // Render the wishlists
    function renderWishlists() {
        wishlistsContainer.innerHTML = '';

        if (wishlists.length === 0) {
            wishlistsContainer.innerHTML = '<p>No wishlists added yet.</p>';
            return;
        }

        wishlists.forEach(wishlist => {
            const wishlistElement = document.createElement('div');
            wishlistElement.className = 'wishlist-item';

            // Create wishlist header (always visible)
            const header = document.createElement('div');
            header.className = 'wishlist-header';

            // Create wishlist name with color dot
            const nameContainer = document.createElement('div');
            nameContainer.className = 'wishlist-name';

            const colorDot = document.createElement('span');
            colorDot.className = 'wishlist-color-dot';
            colorDot.style.backgroundColor = wishlist.color;
            nameContainer.appendChild(colorDot);

            const name = document.createElement('span');
            name.textContent = wishlist.name;
            nameContainer.appendChild(name);

            // Create toggle indicator
            const toggle = document.createElement('span');
            toggle.className = 'wishlist-toggle' + (wishlist.collapsed ? ' collapsed' : '');
            toggle.textContent = '▼';

            header.appendChild(nameContainer);
            header.appendChild(toggle);

            wishlistElement.appendChild(header);

            // Create wishlist content (collapsible)
            const content = document.createElement('div');
            content.className = 'wishlist-content' + (wishlist.collapsed ? ' collapsed' : '');

            // Add wishlist URL
            if (wishlist.url !== 'manual-entry') {
                const url = document.createElement('div');
                url.className = 'wishlist-url';
                url.textContent = wishlist.url;
                content.appendChild(url);
            } else {
                const url = document.createElement('div');
                url.className = 'wishlist-url';
                url.textContent = 'Manual entry';
                content.appendChild(url);
            }

            // Add formatted items
            const formattedItemsDiv = document.createElement('div');
            formattedItemsDiv.className = 'formatted-items';
            formattedItemsDiv.textContent = wishlist.formattedItems;
            content.appendChild(formattedItemsDiv);

            // Add actions
            const actions = document.createElement('div');
            actions.className = 'wishlist-actions';

            // Copy to clipboard button
            const copyButton = document.createElement('button');
            copyButton.textContent = 'Copy to Clipboard';
            copyButton.addEventListener('click', () => {
                navigator.clipboard.writeText(wishlist.formattedItems)
                    .then(() => {
                        // Show a temporary success message
                        copyButton.textContent = 'Copied!';
                        setTimeout(() => {
                            copyButton.textContent = 'Copy to Clipboard';
                        }, 2000);
                    })
                    .catch(err => {
                        console.error('Could not copy text: ', err);

                        // Fallback to document.execCommand
                        const textarea = document.createElement('textarea');
                        textarea.value = wishlist.formattedItems;
                        textarea.style.position = 'fixed';
                        document.body.appendChild(textarea);
                        textarea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textarea);

                        copyButton.textContent = 'Copied!';
                        setTimeout(() => {
                            copyButton.textContent = 'Copy to Clipboard';
                        }, 2000);
                    });
            });
            actions.appendChild(copyButton);

            // Edit wishlist name button
            const editButton = document.createElement('button');
            editButton.textContent = 'Edit Name';
            editButton.addEventListener('click', () => {
                createEditForm(wishlist, content, actions);
            });
            actions.appendChild(editButton);

            // Delete wishlist button
            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Delete';
            deleteButton.addEventListener('click', () => {
                if (confirm(`Delete wishlist "${wishlist.name}"?`)) {
                    const index = wishlists.findIndex(wl => wl.id === wishlist.id);
                    if (index !== -1) {
                        wishlists.splice(index, 1);
                        saveWishlists();
                        renderWishlists();
                    }
                }
            });
            actions.appendChild(deleteButton);

            content.appendChild(actions);
            wishlistElement.appendChild(content);

            // Toggle collapsing on header click
            header.addEventListener('click', () => {
                wishlist.collapsed = !wishlist.collapsed;
                saveWishlists();
                toggle.classList.toggle('collapsed');
                content.classList.toggle('collapsed');
            });

            wishlistsContainer.appendChild(wishlistElement);
        });
    }

    // Create edit form for wishlist name
    function createEditForm(wishlist, contentElement, actionsElement) {
        // Hide actions
        actionsElement.style.display = 'none';

        // Create edit form
        const editForm = document.createElement('div');
        editForm.innerHTML = `
            <input type="text" class="edit-name-input" value="${wishlist.name}">
            <div class="edit-buttons">
                <button class="save-edit">Save</button>
                <button class="cancel-edit">Cancel</button>
            </div>
        `;

        // Insert form before actions
        contentElement.insertBefore(editForm, actionsElement);

        // Add event listeners
        const saveButton = editForm.querySelector('.save-edit');
        const cancelButton = editForm.querySelector('.cancel-edit');
        const nameInput = editForm.querySelector('.edit-name-input');

        saveButton.addEventListener('click', () => {
            const newName = nameInput.value.trim();
            if (newName) {
                wishlist.name = newName;
                saveWishlists();
                renderWishlists();
            }
        });

        cancelButton.addEventListener('click', () => {
            contentElement.removeChild(editForm);
            actionsElement.style.display = 'flex';
        });

        // Focus the input
        nameInput.focus();
        nameInput.select();
    }

    // Save wishlists to localStorage
    function saveWishlists() {
        localStorage.setItem('neopetsWishlists', JSON.stringify(wishlists));
    }

    // Make an element draggable
    function makeDraggable(element, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

        handle.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e.preventDefault();
            // Get the mouse cursor position at startup
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            // Call a function whenever the cursor moves
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e.preventDefault();
            // Calculate the new cursor position
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            // Set the element's new position
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
            element.style.right = 'auto';
        }

        function closeDragElement() {
            // Stop moving when mouse button is released
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    // Show status messages
    function showStatusMessage(element, message, type) {
        let statusElement = element.parentNode.querySelector('.status-message');

        if (!statusElement) {
            statusElement = document.createElement('div');
            statusElement.className = 'status-message';
            element.parentNode.appendChild(statusElement);
        }

        statusElement.textContent = message;
        statusElement.className = 'status-message ' + type;

        if (type !== 'loading') {
            // Remove the message after a delay
            setTimeout(() => {
                statusElement.remove();
            }, 3000);
        }
    }

    // Check if a URL is a valid wishlist URL
    function isValidWishlistUrl(url) {
        return (
            url.includes('items.jellyneo.net/mywishes/') ||
            url.includes('itemdb.com.br')
        );
    }

    // Listen for messages from wishlist parse tabs
    window.addEventListener('message', (event) => {
        if (event.data.type === 'wishlistItems') {
            console.log('Received parsed data:', event.data.items.length, 'items');

            // Store in localStorage for the main script to pick up
            localStorage.setItem('parsedWishlist', JSON.stringify({
                items: event.data.items,
                url: event.data.sourceUrl
            }));
        }
    });
})();
