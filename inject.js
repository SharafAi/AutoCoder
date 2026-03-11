/**
 * AutoCoder Injection Script
 * Purpose: Automates data entry for container logistics portals.
 * Security: This script runs in the 'MAIN' world to successfully interact with 
 * complex web frameworks (Angular/React) used in logistics portals.
 * Compliance: Zero use of eval() or remote code execution. 
 * Ads are sandboxed in isolated iframes.
 */
(function () {
  if (document.getElementById('autoCopyWrapper')) return;

  let list = [];
  let index = 0;
  let listLocked = false;
  let currentContainer = '';
  let singleCode = ''; // Code to apply to all containers

  // Stored element selectors (Arrays)
  let containerInputSelectors = [];
  let searchSelectors = [];
  let addButtonSelectors = [];
  let codeInputSelectors = [];
  let confirmSelectors = [];
  let isAutomating = false;
  let fileHandle = null; // For File System Access API

  // Verification tracking
  let containerResults = []; // Track success/failure for each container
  let verificationLog = []; // Detailed log of all operations

  // Element caching - remember elements once found
  let cachedElements = {
    containerInput: null,
    codeInput: null,
    searchButton: null,
    addButton: null,
    confirmButton: null
  };

  // Get storage key based on current domain
  const storageKey = `autoCoder_${window.location.hostname}`;

  // Load saved selectors from localStorage or config.json
  async function loadSavedSelectors(forceConfig = false) {
    try {
      let data = null;

      // 1. Try LocalStorage first (unless forced to use config)
      if (!forceConfig) {
        const saved = localStorage.getItem(storageKey);
        if (saved) data = JSON.parse(saved);
      }

      // 2. If no data or forced, try config.json
      if (!data || forceConfig) {
        try {
          // Add timestamp to prevent caching
          const url = chrome.runtime.getURL(`config.json?t=${Date.now()}`);
          const response = await fetch(url);
          if (response.ok) {
            data = await response.json();
            warn('Loaded settings from config.json');
            if (forceConfig) alert('Settings loaded from config.json!');
          } else {
            if (forceConfig) alert('Failed to load config.json');
          }
        } catch (err) {
          console.log('No config.json found or failed to load');
          if (forceConfig) alert('Error loading config.json: ' + err.message);
        }
      }

      if (data) {
        // Handle both old (string) and new (array) formats
        const toArray = (val) => Array.isArray(val) ? val : (val ? [val] : []);

        containerInputSelectors = toArray(data.containerInput);
        searchSelectors = toArray(data.search);
        addButtonSelectors = toArray(data.addButton);
        codeInputSelectors = toArray(data.codeInput);
        confirmSelectors = toArray(data.confirm);
        singleCode = data.globalCode || '';

        // Update UI
        updateStatus(statusContainer, selectContainerInputBtn, containerInputSelectors.length);
        updateStatus(statusSearch, selectSearchBtn, searchSelectors.length);
        updateStatus(statusAdd, selectAddButtonBtn, addButtonSelectors.length);
        updateStatus(statusCode, selectCodeInputBtn, codeInputSelectors.length);
        updateStatus(statusConfirm, selectConfirmBtn, confirmSelectors.length);

        // Update Code Input
        if (singleCode) {
          const codeInput = document.getElementById('aft_global_code');
          if (codeInput) codeInput.value = singleCode;
        }

        checkReadyToStart();
      }
    } catch (e) {
      console.error('Failed to load selectors:', e);
    }
  }

  function updateStatus(statusEl, btnEl, count) {
    if (count > 0) {
      statusEl.textContent = 'Ready';
      statusEl.classList.add('active');
      btnEl.classList.add('selected');
      btnEl.querySelector('span').textContent = 'Selected';
    } else {
      statusEl.textContent = statusEl.id.includes('container') || statusEl.id.includes('code') ? 'Not Ready' : 'Optional';
      statusEl.classList.remove('active');
      btnEl.classList.remove('selected');
      btnEl.querySelector('span').textContent = 'Select';
    }
  }

  // ... (rest of code) ...



  // ---- UI Updates for Load Button ----
  // Add Load Button next to Connect File
  const footerBtns = document.querySelector('.aft-settings-view > div:last-child');
  if (footerBtns) {
    const loadBtn = document.createElement('button');
    loadBtn.className = 'aft-btn aft-btn-secondary';
    loadBtn.textContent = 'Reload Config';
    loadBtn.title = 'Force reload from config.json';
    loadBtn.onclick = () => loadSavedSelectors(true);
    footerBtns.insertBefore(loadBtn, footerBtns.firstChild);
  }

  // Save selectors to localStorage and File System
  async function saveSelectors() {
    try {
      const data = {
        containerInput: containerInputSelectors,
        search: searchSelectors,
        addButton: addButtonSelectors,
        codeInput: codeInputSelectors,
        confirm: confirmSelectors,
        globalCode: singleCode,
        savedAt: new Date().toISOString()
      };

      // 1. Save to LocalStorage
      localStorage.setItem(storageKey, JSON.stringify(data));

      // 2. Save to File (if connected)
      if (fileHandle) {
        try {
          const writable = await fileHandle.createWritable();
          await writable.write(JSON.stringify(data, null, 2));
          await writable.close();
          warn('✓ Saved to config.json directly!');
        } catch (err) {
          console.error('Failed to write to file:', err);
          warn('⚠ Failed to save to file. Connection lost?');
          fileHandle = null;
          document.getElementById('aft_connect_file').textContent = 'Connect Config File';
          document.getElementById('aft_connect_file').classList.remove('aft-btn-success');
        }
      }
    } catch (e) {
      console.error('Failed to save selectors:', e);
    }
  }

  // Validate if cached element is still in DOM and visible
  function isElementValid(element) {
    return element && document.body.contains(element) && element.offsetParent !== null;
  }

  // Find element by stable attributes (fallback when selectors fail)
  function findByStableAttributes(elementType) {
    warn(`Trying stable attributes for ${elementType}...`);

    switch (elementType) {
      case 'containerInput':
        // Look for input with placeholder containing "container"
        const containerInputs = Array.from(document.querySelectorAll('input[type="text"]'));
        return containerInputs.find(el => {
          const placeholder = (el.placeholder || '').toLowerCase();
          const name = (el.name || '').toLowerCase();
          const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
          const ngModel = el.getAttribute('ng-model') || '';

          return (placeholder.includes('container') ||
            name.includes('container') ||
            ariaLabel.includes('container') ||
            ngModel.includes('container')) &&
            el.offsetParent !== null;
        });

      case 'codeInput':
        // Look for input inside a modal/dialog - try multiple strategies

        // Strategy 1: Look in md-dialog elements
        const mdDialogs = document.querySelectorAll('md-dialog');
        warn(`Found ${mdDialogs.length} md-dialog element(s)`);

        for (const dialog of mdDialogs) {
          // Check if dialog or its container is visible
          const isVisible = dialog.offsetParent !== null ||
            getComputedStyle(dialog).display !== 'none' ||
            dialog.querySelector('input[type="text"]')?.offsetParent !== null;

          warn(`md-dialog visible: ${isVisible}, offsetParent: ${dialog.offsetParent !== null}, display: ${getComputedStyle(dialog).display}`);

          if (isVisible) {
            const inputs = dialog.querySelectorAll('input[type="text"], input:not([type])');
            warn(`Found ${inputs.length} input(s) in md-dialog`);
            const visibleInput = Array.from(inputs).find(inp => inp.offsetParent !== null);
            if (visibleInput) {
              warn(`✓ Found visible input in md-dialog`);
              return visibleInput;
            }
          }
        }

        // Strategy 2: Look in .md-dialog-container
        const dialogContainers = document.querySelectorAll('.md-dialog-container');
        warn(`Found ${dialogContainers.length} .md-dialog-container element(s)`);

        for (const container of dialogContainers) {
          const isVisible = container.offsetParent !== null ||
            getComputedStyle(container).display !== 'none';

          warn(`Container visible: ${isVisible}`);

          if (isVisible) {
            const inputs = container.querySelectorAll('input[type="text"], input:not([type])');
            warn(`Found ${inputs.length} input(s) in container`);
            const visibleInput = Array.from(inputs).find(inp => inp.offsetParent !== null);
            if (visibleInput) {
              warn(`✓ Found visible input in .md-dialog-container`);
              return visibleInput;
            }
          }
        }

        // Strategy 3: Look for any modal-like structure
        const modals = document.querySelectorAll('.modal, [role="dialog"]');
        warn(`Found ${modals.length} generic modal(s)`);

        for (const modal of modals) {
          if (modal.offsetParent !== null) {
            const inputs = modal.querySelectorAll('input[type="text"]');
            const visibleInput = Array.from(inputs).find(inp => inp.offsetParent !== null);
            if (visibleInput) {
              warn(`✓ Found visible input in generic modal`);
              return visibleInput;
            }
          }
        }

        warn('⚠ No input found in any modal structure');
        return null;

      case 'searchButton':
        // Look for button with search icon or text
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(el => {
          const text = el.textContent.toLowerCase();
          const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
          const hasSearchIcon = el.querySelector('svg, i, [class*="search"]');

          return (text.includes('search') || ariaLabel.includes('search') || hasSearchIcon) &&
            el.offsetParent !== null;
        });

      case 'addButton':
        // Look for button with "add" text in visible table row
        const addButtons = Array.from(document.querySelectorAll('button'));
        return addButtons.find(el => {
          const text = el.textContent.toLowerCase();
          const inTable = el.closest('table, tbody, tr');
          return text.includes('add') && inTable && el.offsetParent !== null;
        });

      case 'confirmButton':
        // Look for save/confirm button in modal
        const modalButtons = Array.from(document.querySelectorAll('md-dialog button, .modal button, [role="dialog"] button'));
        return modalButtons.find(el => {
          const text = el.textContent.toLowerCase();
          return (text.includes('save') || text.includes('confirm') || text.includes('ok')) &&
            el.offsetParent !== null;
        });
    }

    return null;
  }

  // Smart element finder with multiple strategies
  function findElementSmart(elementType, selectors) {
    // Strategy 1: Check cached element first
    if (cachedElements[elementType] && isElementValid(cachedElements[elementType])) {
      warn(`✓ Using cached ${elementType}`);
      return cachedElements[elementType];
    }

    // Strategy 2: Try saved selectors
    const element = findElement(selectors);
    if (element) {
      cachedElements[elementType] = element;
      warn(`✓ Found and cached ${elementType} via selectors`);
      return element;
    }

    // Strategy 3: Try stable attributes
    const fallbackElement = findByStableAttributes(elementType);
    if (fallbackElement) {
      cachedElements[elementType] = fallbackElement;
      warn(`✓ Found and cached ${elementType} via stable attributes`);
      return fallbackElement;
    }

    warn(`✗ Could not find ${elementType} with any strategy`);
    return null;
  }

  function clearSavedSelectors() {
    try {

      localStorage.removeItem(storageKey);
      // We also want to save the empty state to the file if connected
      if (fileHandle) {
        saveSelectors();
      }
    } catch (e) {
      console.error('Failed to clear selectors:', e);
    }
  }

  // Helper to find element using array of selectors
  function findElement(selectors, requireVisible = true) {
    if (!selectors || !Array.isArray(selectors)) return null;

    for (const selector of selectors) {
      try {
        let element = null;

        // Handle custom :contains syntax
        if (selector.includes(':contains(')) {
          const match = selector.match(/^(.*?):contains\(['"]?(.*?)['"]?\)$/);
          if (match) {
            const cssPart = match[1];
            const textPart = match[2];
            const candidates = document.querySelectorAll(cssPart);

            // 1. Try to find VISIBLE element
            element = Array.from(candidates).find(el => el.textContent.trim() === textPart && el.offsetParent !== null);

            // 2. Fallback: Find ANY element if not requiring visible
            if (!element && !requireVisible) {
              element = Array.from(candidates).find(el => el.textContent.trim() === textPart);
              if (element) warn(`Using hidden/fallback element for: ${selector}`);
            }
          }
        } else {
          // Standard selector
          const candidates = document.querySelectorAll(selector);

          // 1. Try to find VISIBLE element
          element = Array.from(candidates).find(el => el.offsetParent !== null);

          // 2. Fallback: Find ANY element if not requiring visible
          if (!element && !requireVisible && candidates.length > 0) {
            element = candidates[0];
            warn(`Using hidden/fallback element for: ${selector}`);
          }
        }

        if (element) {
          warn(`✓ Found element using selector: ${selector.substring(0, 80)}${selector.length > 80 ? '...' : ''}`);
          return element;
        }
      } catch (e) {
        // Ignore invalid selectors in list
      }
    }
    return null;
  }

  // ---- Styles ----
  const style = document.createElement('style');
  style.textContent = `
    #autoCopyWrapper { position: fixed; bottom: 24px; right: 40px; width: 380px; background: #1e1e1e; color: #e0e0e0; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; -webkit-font-smoothing: antialiased; border-radius: 12px; padding: 0; z-index: 2147483647; box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1); box-sizing: border-box; overflow: hidden; display: flex; flex-direction: column; font-size: 13px; line-height: 1.5; }
    #autoCopyWrapper * { box-sizing: border-box; }
    
    /* Header */
    .aft-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #252526; border-bottom: 1px solid #333; flex-shrink: 0; height: 48px; }
    .aft-title { font-size: 14px; font-weight: 600; color: #fff; letter-spacing: 0.5px; }
    .aft-header-actions { display: flex; gap: 8px; align-items: center; }
    
    /* Buttons */
    .aft-icon-btn { background: transparent; border: none; color: #858585; cursor: pointer; padding: 6px; border-radius: 4px; transition: all 0.2s; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; min-width: 32px; min-height: 32px; }
    .aft-icon-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
    
    .aft-btn { width: 100%; padding: 8px 12px; border: none; border-radius: 4px; font-weight: 500; font-size: 13px; cursor: pointer; transition: all 0.2s; text-align: center; }
    .aft-btn-primary { background: #007acc; color: #fff; }
    .aft-btn-primary:hover { background: #0062a3; }
    .aft-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; background: #333; color: #888; }
    .aft-btn-danger { background: #3a3d41; color: #f48771; border: 1px solid rgba(244, 135, 113, 0.3); }
    .aft-btn-danger:hover { background: rgba(244, 135, 113, 0.1); }
    .aft-btn-secondary { background: #3a3d41; color: #ccc; }
    .aft-btn-secondary:hover { background: #45484e; color: #fff; }

    /* Body */
    .aft-body { padding: 0; display: flex; flex-direction: column; flex: 1; position: relative; height: 320px; }
    .aft-main-view { padding: 16px; display: flex; flex-direction: column; gap: 12px; height: 100%; overflow-y: auto; }
    
    /* Settings Overlay (Internal) */
    .aft-settings-view { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #1e1e1e; z-index: 10; display: none; flex-direction: column; padding: 16px; gap: 12px; overflow-y: auto; }
    .aft-settings-view.show { display: flex; }
    .aft-settings-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #333; }
    .aft-settings-title { font-weight: 600; color: #fff; font-size: 14px; }
    .aft-back-btn { background: transparent; border: none; color: #007acc; cursor: pointer; padding: 0; font-size: 13px; display: flex; align-items: center; gap: 4px; }
    .aft-back-btn:hover { text-decoration: underline; }

    /* Sections */
    .aft-section { background: #252526; border: 1px solid #333; border-radius: 4px; overflow: hidden; }
    .aft-section-header { padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; background: #2d2d2d; }
    .aft-section-header:hover { background: #333; }
    .aft-section-title { font-size: 12px; font-weight: 600; color: #ccc; text-transform: uppercase; }
    .aft-section-content { padding: 0; }
    
    /* Drag Box */
    .aft-drag-box { background: #252526; border: 1px solid #333; border-radius: 4px; padding: 12px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 4px; }
    .aft-drag-label { font-size: 11px; color: #858585; text-transform: uppercase; font-weight: 600; }
    .aft-drag-value { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 600; color: #fff; letter-spacing: 0.5px; }
    
    /* Input Field */
    .aft-input-group { margin-bottom: 16px; }
    .aft-input-label { font-size: 11px; color: #ccc; text-transform: uppercase; font-weight: 700; margin-bottom: 6px; display: block; letter-spacing: 0.5px; }
    .aft-text-input { width: 100%; background: #252526; border: 1px solid #3e3e42; color: #fff; padding: 12px; border-radius: 6px; font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace; font-size: 13px; outline: none; transition: all 0.2s ease; text-transform: uppercase; letter-spacing: 0.5px; }
    .aft-text-input:focus { border-color: #007acc; background: #252526; box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2); }
    .aft-text-input::placeholder { color: #444; }
    
    /* List */
    .aft-list-container { background: #1e1e1e; border: 1px solid #333; border-radius: 4px; height: 140px; overflow: hidden; display: flex; flex-direction: column; }
    #aft_list, #aft_ul { width: 100%; height: 100%; background: transparent; border: none; color: #ccc; padding: 12px; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; line-height: 1.5; resize: none; outline: none; overflow-y: auto; }
    #aft_ul { list-style: none; margin: 0; padding: 0; }
    .aft-li { padding: 8px 12px; border-bottom: 1px solid #2d2d2d; display: flex; align-items: center; gap: 8px; transition: background 0.1s; }
    .aft-li.done { color: #4ec9b0; opacity: 0.7; }
    .aft-li.current { background: #094771; color: #fff; border-left: 2px solid #007acc; }
    .aft-li.pending { color: #858585; }

    /* Footer */
    .aft-footer { padding: 8px 16px; background: #252526; border-top: 1px solid #333; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #858585; flex-shrink: 0; }
    .aft-progress-bar { height: 4px; background: #333; border-radius: 2px; flex: 1; margin-right: 12px; overflow: hidden; }
    .aft-progress-fill { height: 100%; background: #007acc; width: 0%; transition: width 0.3s ease; }

    /* Selectors */
    .aft-selector-row { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
    .aft-selector-header { display: flex; justify-content: space-between; align-items: center; }
    .aft-selector-label { font-size: 12px; color: #ccc; font-weight: 500; }
    .aft-selector-status { font-size: 11px; color: #f48771; font-weight: 600; }
    .aft-selector-status.active { color: #4ec9b0; }
    .aft-selector-btn { width: 100%; padding: 6px 10px; background: #2d2d2d; color: #ccc; border: 1px solid #333; border-radius: 4px; font-size: 12px; cursor: pointer; text-align: left; display: flex; justify-content: space-between; align-items: center; }
    .aft-selector-btn:hover { background: #333; border-color: #444; }
    .aft-selector-btn.selected { border-color: #007acc; background: rgba(0, 122, 204, 0.1); color: #fff; }

    /* Warning */


    /* Picker Overlay */
    .aft-element-highlight { outline: 2px solid #007acc !important; box-shadow: 0 0 0 4px rgba(0, 122, 204, 0.2) !important; z-index: 2147483646; }
    .aft-picker-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: transparent; z-index: 2147483647; cursor: crosshair; }
    .aft-picker-tooltip { position: fixed; background: #252526; color: #fff; padding: 6px 10px; border-radius: 4px; font-size: 12px; pointer-events: none; z-index: 2147483647; box-shadow: 0 4px 12px rgba(0,0,0,0.5); border: 1px solid #454545; }
    
    
    /* Donation Modal */
    .aft-donation-view { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #1e1e1e; z-index: 20; display: none; flex-direction: column; padding: 16px; gap: 12px; overflow-y: auto; }
    .aft-donation-view.show { display: flex; }
    .aft-donation-content { display: flex; flex-direction: column; gap: 20px; align-items: center; color: #ccc; font-size: 14px; line-height: 1.6; text-align: center; padding: 8px 16px; }
    .aft-donation-text { text-align: justify; padding: 16px; background: rgba(255, 255, 255, 0.05); border-radius: 8px; border: 1px solid #333; margin-bottom: 8px; }
    .aft-donation-qr { width: 100%; max-width: 200px; border-radius: 12px; border: 4px solid #fff; user-select: none; pointer-events: none; -webkit-user-drag: none; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
    .aft-copyright { font-size: 10px; color: #555; margin-top: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; opacity: 0.8; font-family: system-ui, -apple-system, sans-serif; }

    /* Export Modal */
    .aft-export-modal { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #1e1e1e; z-index: 20; display: none; flex-direction: column; padding: 16px; gap: 12px; }
    .aft-export-modal.show { display: flex; }
    .aft-export-textarea { flex: 1; background: #252526; border: 1px solid #333; color: #ccc; padding: 8px; font-family: 'Consolas', 'Monaco', monospace; font-size: 11px; resize: none; outline: none; border-radius: 4px; }
    .aft-export-info { font-size: 11px; color: #858585; line-height: 1.4; }

    /* Ad Container */
    .aft-ad-container { border-top: 1px solid #333; background: #1a1a1b; padding: 8px 16px; display: flex; flex-direction: column; align-items: center; gap: 6px; flex-shrink: 0; }
    .aft-ad-label { font-size: 8px; color: #444; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; align-self: flex-start; margin-bottom: 2px; }
    .aft-ad-iframe { border: none; overflow: hidden; background: transparent; width: 100%; height: 50px; max-width: 320px; }


  `;
  document.head.appendChild(style);

  // ---- UI ----
  const wrapper = document.createElement('div');
  wrapper.id = 'autoCopyWrapper';
  wrapper.innerHTML = `
    <div class="aft-header">
      <div class="aft-title">AutoCoder</div>
      <div class="aft-header-actions">
        <button id="aft_donate_btn" class="aft-icon-btn" title="Donate">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0l2.5 5.5 5.5 2.5-5.5 2.5L8 16l-2.5-5.5L0 8l5.5-2.5L8 0z"/></svg>
        </button>
        <button id="aft_settings_btn" class="aft-icon-btn" title="Settings">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M9.1 0.5L9.6 2.6C10.2 2.8 10.7 3.1 11.2 3.4L13.2 2.6L14.7 5.2L13 6.6C13 6.9 13 7.2 13 7.5C13 7.8 13 8.1 13 8.4L14.7 9.8L13.2 12.4L11.2 11.6C10.7 11.9 10.2 12.2 9.6 12.4L9.1 14.5H6.9L6.4 12.4C5.8 12.2 5.3 11.9 4.8 11.6L2.8 12.4L1.3 9.8L3 8.4C3 8.1 3 7.8 3 7.5C3 7.2 3 6.9 3 6.6L1.3 5.2L2.8 2.6L4.8 3.4C5.3 3.1 5.8 2.8 6.4 2.6L6.9 0.5H9.1ZM8 5C6.6 5 5.5 6.1 5.5 7.5C5.5 8.9 6.6 10 8 10C9.4 10 10.5 8.9 10.5 7.5C10.5 6.1 9.4 5 8 5Z"/></svg>
        </button>
        <button id="aft_close" class="aft-icon-btn" title="Close">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/></svg>
        </button>
      </div>
    </div>
    
    <div class="aft-body">
      <!-- Main View -->
      <div class="aft-main-view" id="aft_main_view">
        <div class="aft-drag-box" id="aft_drag_target" draggable="true">
          <div class="aft-drag-label">Current Container</div>
          <div class="aft-drag-value" id="aft_current_display">Waiting...</div>
        </div>

        <div class="aft-input-group">
          <label class="aft-input-label" for="aft_global_code">Code</label>
          <input type="text" id="aft_global_code" class="aft-text-input" autocomplete="off">
        </div>
        
        <div class="aft-list-container" id="aft_list_wrapper">
          <textarea id="aft_list" placeholder="Paste containers here..."></textarea>
        </div>
        
        <div style="display: flex; gap: 8px; margin-top: auto;">
          <button id="aft_auto_start" class="aft-btn aft-btn-primary" disabled>Start Automation</button>
          <button id="aft_clear" class="aft-btn aft-btn-secondary">Clear</button>
        </div>
      </div>
      
      <!-- Settings View (Overlay) -->
      <div class="aft-settings-view" id="aft_settings_view">
        <div class="aft-settings-header">
          <button class="aft-back-btn" id="aft_settings_back">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M7.78 12.53a.75.75 0 0 1-1.06 0L2.47 8.28a.75.75 0 0 1 0-1.06l4.25-4.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L4.81 7h8.44a.75.75 0 0 1 0 1.5H4.81l2.97 2.97a.75.75 0 0 1 0 1.06Z"/></svg>
            Back
          </button>
          <div class="aft-settings-title">Calibration</div>
        </div>
        
        <!-- Input Fields Section -->
        <div class="aft-section-title" style="margin: 8px 0 4px 0; color: #007acc;">Input Fields</div>
        
        <div class="aft-selector-row">
          <div class="aft-selector-header">
            <div class="aft-selector-label">Container Input</div>
            <div class="aft-selector-status" id="aft_status_container">Not Ready</div>
          </div>
          <button id="aft_select_container_input" class="aft-selector-btn">
            <span>Select Input</span>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/></svg>
          </button>
        </div>

        <div class="aft-selector-row">
          <div class="aft-selector-header">
            <div class="aft-selector-label">Code Input</div>
            <div class="aft-selector-status" id="aft_status_code">Not Ready</div>
          </div>
          <button id="aft_select_code_input" class="aft-selector-btn">
             <span>Select Input</span>
             <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/></svg>
          </button>
        </div>

        <!-- Action Buttons Section -->
        <div class="aft-section-title" style="margin: 16px 0 4px 0; color: #f48771;">Action Buttons</div>

        <div class="aft-selector-row">
          <div class="aft-selector-header">
            <div class="aft-selector-label">Search Button</div>
            <div class="aft-selector-status" id="aft_status_search">Optional</div>
          </div>
          <button id="aft_select_search" class="aft-selector-btn">
            <span>Select Button</span>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/></svg>
          </button>
        </div>

        <div class="aft-selector-row">
          <div class="aft-selector-header">
            <div class="aft-selector-label">Add Button</div>
            <div class="aft-selector-status" id="aft_status_add">Optional</div>
          </div>
          <button id="aft_select_add_button" class="aft-selector-btn">
             <span>Select Button</span>
             <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/></svg>
          </button>
        </div>

        <div class="aft-selector-row">
          <div class="aft-selector-header">
            <div class="aft-selector-label">Confirm Button</div>
            <div class="aft-selector-status" id="aft_status_confirm">Optional</div>
          </div>
          <button id="aft_select_confirm" class="aft-selector-btn">
             <span>Select Button</span>
             <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425a.247.247 0 0 1 .02-.022Z"/></svg>
          </button>
        </div>

        <div style="margin-top: auto; display: flex; gap: 8px;">
            <button id="aft_connect_file" class="aft-btn aft-btn-secondary" title="Save directly to config.json">Connect Config File</button>
            <button id="aft_export_config" class="aft-btn aft-btn-secondary" title="View config JSON">Export Config</button>
            <button id="aft_clear_selectors" class="aft-btn aft-btn-danger">Reset All</button>
        </div>
      </div>

      <!-- Ad Section (Dual Network for Max Payout) -->
      <div class="aft-ad-container">
        <div class="aft-ad-label">Sponsored (Unit 1 & 2)</div>
        <iframe id="aft_ad_1" class="aft-ad-iframe" src="https://ad.a-ads.com/2430155?size=320x50" scrolling="no" allowtransparency="true"></iframe>
        <iframe id="aft_ad_2" class="aft-ad-iframe" src="https://ad.a-ads.com/2430163?size=320x50" scrolling="no" allowtransparency="true"></iframe>
      </div>


       
       <!-- Donation View (Overlay) -->
       <div class="aft-donation-view" id="aft_donation_view">
         <div class="aft-settings-header">
           <button class="aft-back-btn" id="aft_donation_back">
             <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M7.78 12.53a.75.75 0 0 1-1.06 0L2.47 8.28a.75.75 0 0 1 0-1.06l4.25-4.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L4.81 7h8.44a.75.75 0 0 1 0 1.5H4.81l2.97 2.97a.75.75 0 0 1 0 1.06Z"/></svg>
             Back
           </button>
           <div class="aft-settings-title">Support AutoCoder</div>
         </div>
         <div class="aft-donation-content">
             <div class="aft-donation-text">
                Your support helps keep this tool free and improving for everyone.<br><br>
                I built AutoCoder because I know how much time and effort goes into adding tracking codes to containers. Many of us come hours before duty time just to enter those codes one by one, and after shifting we spend more time removing them again. It’s slow and tiring, and I wanted to make this part of our work easier for all of us.<br><br>
                What started as a small idea has now become a tool I’m glad to share with the team.<br><br>
                If AutoCoder has helped make your workflow smoother, you’re welcome to support its development. Every contribution helps me maintain the tool and continue improving it.
             </div>
             <img src="data:image/jpeg;base64,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nnzkOyll+GO1cD6llfTr6wdOvrCtTzSK9/saon4E8+ch5pFe/wBjVE/AnnzkOyll+GO1cD6llfTr6wdOvrCtTzSK9/saon4E8+ch5pFe/wBjVE/AnnzkOyll+GO1cD6llfTr6wdOvrCtTzSK9/saon4E8+ch5pFe/wBjVE/AnnzkOyll+GO1cD6llfTr6wdOvrCtTzSK9/saon4E8+ch5pFe/wBjVE/AnnzkOyll+GO1cD6llfTr6wdOvrCtTzSK9/saon4E8+ch5pFe/wBjVE/AnnzkOyll+GO1cD6llfTr6wdOvrCtTzSK9/saon4E8+ch5pFe/wBjVE/AnnzkOyll+GO1cD6llfTr6wdOvrCtTzSK9/saon4E8+ch5pFe/wBjVE/AnnzkOyll+GO1cD6llfTr6wdOvrCtTzSK9/saon4E8+ch5pFe/wBjVE/AnnzkOyll+GO1cD6llfTr6wdOvrCtTzSK9/saon4E8+ch5pFe/wBjVE/AnnzkOyll+GO1cD6llfTr6wdOvrCtTzSK9/saon4E8+ch5pFe/wBjVE/AnnzkOyll+GO1cD6llfTr6wdOvrCtTzSK9/saon4E8+ch5pFe/wBjVE/AnnzkOyll+GO1cD6llfTr6wdOvrCtTzSK9/saon4E8+ch5pFe/wBjVE/AnnzkOyll+GO1cD6llfTr6wdOvrCtTzSK9/saon4E8+ch5pFe/wBjVE/AnnzkOyll+GO1cD6llfTr6wdOvrCtTzSK9/saon4E8+ch5pFe/wBjVE/AnnzkOyll+GO1cD6llfTr6wdOvrCtTzSK9/saon4E8+ch5pFe/wBjVE/AnnzkOyll+GO1cD6llfTr6wdOvrCtTzSK9/saon4E8+ch5pFe/wBjVE/AnnzkOyll+GO1cD6llfTr6wdOvrCtTzSK9/saon4E8+ch5pFe/wBjVE/AnnzkOyll+GO1cD6llfTr6wdOvrCtTzSK9/saon4E8+ch5pFe/wBjVE/AnnzkOyll+GO1cD6llfTr6wdOvrCtTzSK9/saon4E8+ch5pFe/wBjVE/AnnzkOyll+GO1cD6llfTr6wdOvrCtTzSK9/saon4E8+ch5pFe/wBjVE/AnnzkOyll+GO1cD6llfTr6wdOvrCtTzSK9/saon4E8+ch5pFe/wBjVE/AnnzkOyll+GO1cD6llfTr6wdO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" draggable="false" class="aft-donation-qr" alt="Donation QR Code">
             <div class="aft-copyright">&copy; Xayro Industries</div>
         </div>
       </div>

       <!-- Export View (Overlay) -->
       <div class="aft-export-modal" id="aft_export_view">
          <div class="aft-settings-header">
            <button class="aft-back-btn" id="aft_export_back">Back</button>
            <div class="aft-settings-title">Export Configuration</div>
          </div>
          <div class="aft-export-info">Download this as <code>config.json</code> and replace the file in your extension folder, then reload the extension.</div>
          <textarea class="aft-export-textarea" id="aft_export_area" readonly></textarea>
          <div style="display: flex; gap: 8px;">
            <button id="aft_download_config" class="aft-btn aft-btn-primary">Download as File</button>
            <button id="aft_copy_export" class="aft-btn aft-btn-secondary">Copy to Clipboard</button>
          </div>
       </div>
      

    </div>
    
    <div class="aft-footer">
      <div class="aft-progress-bar">
        <div class="aft-progress-fill" id="aft_progress_fill"></div>
      </div>
      <div id="aft_progress_text">0/0</div>
    </div>
  `;
  document.body.appendChild(wrapper);

  // ---- Elements ----
  const listWrapper = document.getElementById('aft_list_wrapper');
  let listArea = document.getElementById('aft_list');
  const dragBox = document.getElementById('aft_drag_target');
  const currentDisplay = document.getElementById('aft_current_display');
  const progressFill = document.getElementById('aft_progress_fill');
  const progressText = document.getElementById('aft_progress_text');

  const closeBtn = document.getElementById('aft_close');
  const clearBtn = document.getElementById('aft_clear');
  const autoBtn = document.getElementById('aft_auto_start');

  const selectContainerInputBtn = document.getElementById('aft_select_container_input');
  const selectSearchBtn = document.getElementById('aft_select_search');
  const selectAddButtonBtn = document.getElementById('aft_select_add_button');
  const selectCodeInputBtn = document.getElementById('aft_select_code_input');
  const selectConfirmBtn = document.getElementById('aft_select_confirm');

  const statusContainer = document.getElementById('aft_status_container');
  const statusSearch = document.getElementById('aft_status_search');
  const statusAdd = document.getElementById('aft_status_add');
  const statusCode = document.getElementById('aft_status_code');
  const statusConfirm = document.getElementById('aft_status_confirm');

  // Settings View Elements
  const settingsBtn = document.getElementById('aft_settings_btn');
  const settingsView = document.getElementById('aft_settings_view');
  const settingsBackBtn = document.getElementById('aft_settings_back');
  const clearSelectorsBtn = document.getElementById('aft_clear_selectors');
  const exportConfigBtn = document.getElementById('aft_export_config');
  const connectFileBtn = document.getElementById('aft_connect_file');

  // Donation View
  const donationBtn = document.getElementById('aft_donate_btn');
  const donationView = document.getElementById('aft_donation_view');
  const donationBackBtn = document.getElementById('aft_donation_back');

  // Export Config Elements
  const exportView = document.getElementById('aft_export_view');
  const exportBack = document.getElementById('aft_export_back');
  const exportArea = document.getElementById('aft_export_area');
  const copyExportBtn = document.getElementById('aft_copy_export');

  // Helper to close all overlays
  function closeAllOverlays() {
    settingsView.classList.remove('show');
    if (donationView) donationView.classList.remove('show');
    if (exportView) exportView.classList.remove('show');
  }

  // Settings Toggle
  settingsBtn.onclick = () => {
    closeAllOverlays();
    settingsView.classList.add('show');
  };

  settingsBackBtn.onclick = () => {
    settingsView.classList.remove('show');
  };

  // Donation Toggle
  if (donationBtn) {
    donationBtn.onclick = () => {
      closeAllOverlays();
      if (donationView) donationView.classList.add('show');
    };
  }

  if (donationBackBtn) {
    donationBackBtn.onclick = () => {
      if (donationView) donationView.classList.remove('show');
    };
  }

  // Connect File Handler
  if (connectFileBtn) {
    connectFileBtn.onclick = async () => {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{
            description: 'JSON Config File',
            accept: { 'application/json': ['.json'] }
          }],
          multiple: false
        });

        fileHandle = handle;
        connectFileBtn.textContent = "✓ Connected";
        connectFileBtn.classList.add('aft-btn-success');
        warn('File connected successfully! Changes will be saved live.');

        // Initial save to sync
        saveSelectors();

      } catch (err) {
        console.error('File connection failed:', err);
        warn('File connection cancelled or failed.');
      }
    };
  }

  // Export Config
  // Export Config
  // const exportView = document.getElementById('aft_export_view'); // MOVED UP
  // const exportBack = document.getElementById('aft_export_back'); // MOVED UP
  // const exportArea = document.getElementById('aft_export_area'); // MOVED UP
  // const copyExportBtn = document.getElementById('aft_copy_export'); // MOVED UP

  exportBack.onclick = () => {
    exportView.classList.remove('show');
  };

  copyExportBtn.onclick = () => {
    exportArea.select();
    document.execCommand('copy');
    copyExportBtn.textContent = "Copied!";
    setTimeout(() => copyExportBtn.textContent = "Copy to Clipboard", 2000);
  };

  // Add download button functionality
  const downloadConfigBtn = document.getElementById('aft_download_config');
  if (downloadConfigBtn) {
    downloadConfigBtn.onclick = () => {
      const config = {
        containerInput: containerInputSelectors,
        search: searchSelectors,
        addButton: addButtonSelectors,
        codeInput: codeInputSelectors,
        confirm: confirmSelectors,
        globalCode: singleCode
      };
      const json = JSON.stringify(config, null, 2);

      // Create download
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'config.json';
      a.click();
      URL.revokeObjectURL(url);

      downloadConfigBtn.textContent = "Downloaded!";
      setTimeout(() => downloadConfigBtn.textContent = "Download as File", 2000);
      warn('Config downloaded as config.json - Replace the file in your extension folder!');
    };
  }

  exportConfigBtn.onclick = () => {
    const config = {
      containerInput: containerInputSelectors,
      search: searchSelectors,
      addButton: addButtonSelectors,
      codeInput: codeInputSelectors,
      confirm: confirmSelectors,
      globalCode: singleCode
    };
    const json = JSON.stringify(config, null, 2);

    exportArea.value = json;
    exportView.classList.add('show');
  };

  // Clear selectors button
  if (clearSelectorsBtn) {
    clearSelectorsBtn.onclick = () => {
      warn('🔄 Reset button clicked!');

      if (confirm('Reset all calibration settings?\n\nThis will clear all saved selectors and code for this domain.')) {
        warn('User confirmed reset');

        containerInputSelectors = [];
        searchSelectors = [];
        addButtonSelectors = [];
        codeInputSelectors = [];
        confirmSelectors = [];
        singleCode = '';

        statusContainer.textContent = 'Not Ready';
        statusSearch.textContent = 'Optional';
        statusAdd.textContent = 'Optional';
        statusCode.textContent = 'Not Ready';
        statusConfirm.textContent = 'Optional';

        statusContainer.classList.remove('active');
        statusSearch.classList.remove('active');
        statusAdd.classList.remove('active');
        statusCode.classList.remove('active');
        statusConfirm.classList.remove('active');

        selectContainerInputBtn.classList.remove('selected');
        selectSearchBtn.classList.remove('selected');
        selectAddButtonBtn.classList.remove('selected');
        selectCodeInputBtn.classList.remove('selected');
        selectConfirmBtn.classList.remove('selected');

        selectContainerInputBtn.querySelector('span').textContent = 'Select Input';
        selectSearchBtn.querySelector('span').textContent = 'Select Button';
        selectAddButtonBtn.querySelector('span').textContent = 'Select Button';
        selectCodeInputBtn.querySelector('span').textContent = 'Select Input';
        selectConfirmBtn.querySelector('span').textContent = 'Select Button';

        // Clear code input
        const codeInput = document.getElementById('aft_global_code');
        if (codeInput) codeInput.value = '';

        clearSavedSelectors();
        checkReadyToStart();
        warn('✓ All calibration settings reset successfully!');
      } else {
        warn('Reset cancelled by user');
      }
    };
  } else {
    console.error('Reset button not found!');
  }

  // Load saved selectors from localStorage
  // MOVED TO END TO ENSURE UI IS READY
  // loadSavedSelectors();
  // checkReadyToStart();

  // Initialize
  (async () => {
    await loadSavedSelectors();
    checkReadyToStart();
  })();

  // ---- Utility ----
  function warn(msg, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = '[AutoCoder]:';

    // Add to verification log
    verificationLog.push({ time: timestamp, message: msg, type });

    // Console output with emoji indicators
    const emoji = {
      'success': '✓',
      'warning': '⚠',
      'error': '✗',
      'search': '🔍',
      'info': 'ℹ'
    };

    const icon = emoji[type] || '';
    console.log(`${prefix} ${icon} ${msg}`);
  }

  function formatContainer(line) {
    const clean = (line || '').replace(/\s+/g, '');
    const m = clean.match(/^([A-Za-z]{4})(\d{3})(\d{4})$/);
    return m ? `${m[1]}${m[2]}${m[3]}` : clean || null;
  }

  function renderList() {
    if (!listLocked) return;
    let ul = document.getElementById('aft_ul');
    if (!ul) {
      listWrapper.innerHTML = `<ul id="aft_ul"></ul>`;
      ul = document.getElementById('aft_ul');
    } else {
      ul.innerHTML = '';
    }

    list.forEach((v, i) => {
      const li = document.createElement('li');
      li.className = 'aft-li';
      if (i < index) {
        li.classList.add('done');
        li.innerHTML = `${v}`;
      } else if (i === index) {
        li.classList.add('current');
        li.textContent = `> ${v}`;
      } else {
        li.classList.add('pending');
        li.textContent = v;
      }
      ul.appendChild(li);
    });

    const pct = list.length ? Math.round((index / list.length) * 100) : 0;
    progressFill.style.width = `${pct}%`;
    progressText.textContent = `${index}/${list.length}`;

    const cur = ul.children[index];
    if (cur) cur.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function checkReadyToStart() {
    // Minimum requirement: Container Input + List (all buttons are optional)
    const ready = containerInputSelectors.length > 0 && listLocked;
    autoBtn.disabled = !ready;
    return ready;
  }

  // ---- Element Picker ----
  function createElementPicker(callback, message = "Click on the element to select") {
    const overlay = document.createElement('div');
    overlay.className = 'aft-picker-overlay';
    overlay.style.pointerEvents = 'none'; // Let clicks pass through

    const tooltip = document.createElement('div');
    tooltip.className = 'aft-picker-tooltip';
    tooltip.textContent = message + ' (ESC to cancel)';
    document.body.appendChild(tooltip);

    let currentHighlight = null;
    let targetElement = null;

    function removeHighlight() {
      if (currentHighlight) {
        currentHighlight.classList.remove('aft-element-highlight');
        currentHighlight = null;
      }
    }

    function cleanup() {
      removeHighlight();
      overlay.remove();
      tooltip.remove();
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('click', handleClick, true);
    }

    function handleEscape(e) {
      if (e.key === 'Escape') {
        cleanup();
        warn('Selection cancelled');
      }
    }

    function handleMouseMove(e) {
      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (target && !wrapper.contains(target) && target !== tooltip) {
        removeHighlight();
        currentHighlight = target;
        targetElement = target;
        target.classList.add('aft-element-highlight');
      }
      tooltip.style.left = (e.clientX + 15) + 'px';
      tooltip.style.top = (e.clientY + 15) + 'px';
    }

    function handleClick(e) {
      // Check if we're clicking on our wrapper or tooltip
      if (wrapper.contains(e.target) || e.target === tooltip) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // Use the stored target element from mousemove
      if (targetElement && !wrapper.contains(targetElement)) {
        // Generate ALL possible selectors
        const selectors = generateAllSelectors(targetElement);
        cleanup();
        callback(selectors, targetElement);
      }

      return false;
    }

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('click', handleClick, true);
    document.body.appendChild(overlay);
  }

  function generateAllSelectors(element) {
    const selectors = [];

    // Helper to add a selector if it's unique and valid
    const addIfUniqueAndValid = (selector, type) => {
      try {
        if (!selector || selectors.includes(selector)) return;

        let isUnique = false;

        // Custom handling for :contains
        if (selector.includes(':contains')) {
          const match = selector.match(/^(.*?):contains\("(.*?)"\)$/);
          if (match) {
            const cssPart = match[1];
            const textPart = match[2].replace(/\\"/g, '"'); // Unescape quotes
            try {
              const candidates = document.querySelectorAll(cssPart);
              const matches = Array.from(candidates).filter(el => el.textContent.trim() === textPart);
              if (matches.length === 1) isUnique = true;
            } catch (e) { /* invalid css part */ }
          }
        } else {
          // Standard CSS selector
          if (document.querySelectorAll(selector).length === 1) isUnique = true;
        }

        if (isUnique) {
          selectors.push(selector);
          warn(`Generated selector (${type}): ${selector}`);
        }
      } catch (e) {
        // Ignore invalid selectors
      }
    };

    // 1. ID (if stable-looking)
    if (element.id && !/\d{5,}/.test(element.id) && !/^[a-z0-9]{20,}$/i.test(element.id) && !/^ng-/.test(element.id)) {
      addIfUniqueAndValid(`#${CSS.escape(element.id)}`, 'ID');
    }

    // 2. Placeholder
    if (element.placeholder && element.placeholder.trim()) {
      addIfUniqueAndValid(`[placeholder="${CSS.escape(element.placeholder)}"]`, 'Placeholder');
    }

    // 3. Aria-Label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) {
      addIfUniqueAndValid(`[aria-label="${CSS.escape(ariaLabel)}"]`, 'Aria-Label');
    }

    // 4. Name (if stable-looking)
    if (element.name && element.name.trim()) {
      const isDynamicName = /\d{4,}/.test(element.name) || /^(field|input|ng)-\w+/.test(element.name);
      if (!isDynamicName) {
        addIfUniqueAndValid(`[name="${CSS.escape(element.name)}"]`, 'Name');
      }
    }

    // 5. Data-* attributes
    const dataAttrs = Array.from(element.attributes).filter(attr => attr.name.startsWith('data-'));
    for (const attr of dataAttrs) {
      if (!/\d{5,}/.test(attr.value)) { // Skip dynamic-looking data values
        addIfUniqueAndValid(`[${attr.name}="${CSS.escape(attr.value)}"]`, `Data-${attr.name}`);
      }
    }

    // 6. Type + Placeholder combination for inputs
    if (element.tagName === 'INPUT' && element.type && element.placeholder) {
      addIfUniqueAndValid(`input[type="${element.type}"][placeholder="${CSS.escape(element.placeholder)}"]`, 'Type+Placeholder');
    }

    // 7. Text Content (for buttons/labels)
    if (['BUTTON', 'A', 'SPAN', 'LABEL'].includes(element.tagName)) {
      const text = element.textContent.trim();
      if (text) {
        // Try direct text match
        // Note: :contains is not standard, we don't escape it here as it's custom handled, but we should be careful
        // Actually, our findElement handles :contains, but querySelectorAll in addIfUniqueAndValid will throw!
        // So we need to skip validation for :contains or handle it specially.
        // My previous code had: if (s.includes(':contains')) return true; inside the filter.
        // But addIfUniqueAndValid uses querySelectorAll.

        // We need to modify addIfUniqueAndValid to handle :contains or skip it.
        // For now, let's just rely on the try-catch I added to addIfUniqueAndValid.
        // But wait, if it throws, it won't be added!
        // So I need to modify addIfUniqueAndValid to allow :contains without validation, OR validate it manually.

        const directTextSelector = `${element.tagName.toLowerCase()}:not([class*="aft-"]):not([id*="aft_"]):not([data-aft-ignore]):contains("${text.replace(/"/g, '\\"')}")`;
        addIfUniqueAndValid(directTextSelector, 'Text Content');

        // Try text content with parent context (class-based)
        const parent = element.parentElement;
        if (parent && parent.className && typeof parent.className === 'string') {
          const parentClasses = parent.className.split(' ').filter(c => c.trim() && !c.match(/active|focus|hover|selected|disabled|open|closed|visible|hidden|ng-/i));
          for (const pClass of parentClasses) {
            const contextSelector = `.${CSS.escape(pClass)} ${element.tagName.toLowerCase()}:contains("${text.replace(/"/g, '\\"')}")`;
            addIfUniqueAndValid(contextSelector, 'Text Content + Parent Class');
          }
        }
      }
    }

    // 8. Stable Class combinations
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.split(' ')
        .filter(c => c.trim() && !c.match(/active|focus|hover|selected|disabled|open|closed|visible|hidden|ng-/i));

      // Try single unique class
      for (const cls of classes) {
        addIfUniqueAndValid(`.${CSS.escape(cls)}`, 'Single Class');
      }

      // Try class combinations (up to 3)
      if (classes.length >= 2) {
        const classCombo = '.' + classes.slice(0, 3).map(c => CSS.escape(c)).join('.');
        addIfUniqueAndValid(classCombo, 'Class Combo');
      }
    }

    // 9. Structural path (as a last resort, always generated)
    let path = [];
    let current = element;
    let depth = 0;
    const maxDepth = 6;

    while (current && current !== document.body && depth < maxDepth) {
      let selectorPart = current.tagName.toLowerCase();

      // Add ID if stable
      if (current.id && !/\d{5,}/.test(current.id) && !/^[a-z0-9]{20,}$/i.test(current.id) && !/^ng-/.test(current.id)) {
        selectorPart += `#${CSS.escape(current.id)}`;
      } else {
        let stableClass = null;
        // Add stable class if available
        if (current.className && typeof current.className === 'string') {
          stableClass = current.className.split(' ')
            .filter(c => c.trim() && !c.match(/active|focus|hover|selected|disabled|open|closed|visible|hidden|ng-/i))[0];
          if (stableClass) {
            selectorPart += `.${CSS.escape(stableClass)}`;
          }
        }

        // Add nth-of-type only if necessary and no unique ID/class
        const siblings = Array.from(current.parentElement?.children || [])
          .filter(el => el.tagName === current.tagName);
        if (siblings.length > 1 && !current.id && !(current.className && stableClass)) {
          const index = siblings.indexOf(current) + 1;
          selectorPart += `:nth-of-type(${index})`;
        }
      }
      path.unshift(selectorPart);
      current = current.parentElement;
      depth++;
    }

    const finalPath = path.join(' > ');
    // Always add the path, even if we're not sure it's unique (better than nothing)
    if (!selectors.includes(finalPath)) {
      selectors.push(finalPath);
      warn(`Generated fallback path: ${finalPath}`);
    }

    return selectors;
  }

  // ---- Selector Buttons (Updated for Multi-Selector) ----
  selectContainerInputBtn.onclick = () => {
    createElementPicker((selectors, element) => {
      if (selectors.length === 0) {
        alert('No selectors found! Did you click the background? Please click a specific input field.');
        return;
      }
      containerInputSelectors = selectors;
      console.log('[AutoCoder] Container Input Selectors:', selectors);
      updateStatus(statusContainer, selectContainerInputBtn, selectors.length);
      saveSelectors();
      checkReadyToStart();
    }, 'Click on the CONTAINER INPUT field');
  };

  selectSearchBtn.onclick = () => {
    createElementPicker((selectors, element) => {
      if (selectors.length === 0) {
        alert('No selectors found! Did you click the background? Please click a specific button.');
        return;
      }
      searchSelectors = selectors;
      console.log('[AutoCoder] Search Button Selectors:', selectors);
      updateStatus(statusSearch, selectSearchBtn, selectors.length);
      saveSelectors();
      checkReadyToStart();
    }, 'Click on the SEARCH BUTTON');
  };

  selectAddButtonBtn.onclick = () => {
    createElementPicker((selectors, element) => {
      if (selectors.length === 0) {
        alert('No selectors found! Did you click the background? Please click a specific button.');
        return;
      }
      addButtonSelectors = selectors;
      console.log('[AutoCoder] Add Button Selectors:', selectors);
      updateStatus(statusAdd, selectAddButtonBtn, selectors.length);
      saveSelectors();
      checkReadyToStart();
    }, 'Click on the ADD BUTTON');
  };

  selectCodeInputBtn.onclick = () => {
    createElementPicker((selectors, element) => {
      if (selectors.length === 0) {
        alert('No selectors found! Did you click the background? Please click a specific input field.');
        return;
      }
      codeInputSelectors = selectors;
      console.log('[AutoCoder] Code Input Selectors:', selectors);
      updateStatus(statusCode, selectCodeInputBtn, selectors.length);
      saveSelectors();
      checkReadyToStart();
    }, 'Click on the CODE INPUT field');
  };

  selectConfirmBtn.onclick = () => {
    createElementPicker((selectors, element) => {
      if (selectors.length === 0) {
        alert('No selectors found! Did you click the background? Please click a specific button.');
        return;
      }
      confirmSelectors = selectors;
      console.log('[AutoCoder] Confirm Button Selectors:', selectors);
      updateStatus(statusConfirm, selectConfirmBtn, selectors.length);
      saveSelectors();
      checkReadyToStart();
    }, 'Click on the CONFIRM/BOTTOM BUTTON');
  };

  // ---- Paste List ----
  function handlePaste(e) {
    if (listLocked) { warn('List is locked. Clear to start over.'); return; }
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text') || '';
    const candidates = text.split(/\r?\n/);
    const validList = candidates.map(x => x.trim()).filter(Boolean).map(formatContainer).filter(Boolean);
    if (validList.length > 0) {
      list = validList;
      index = 0;
      currentContainer = list[index] || '';
      currentDisplay.textContent = currentContainer;
      listLocked = true;
      renderList();
      checkReadyToStart();
    } else {
      warn('No valid containers found.');
    }
  }
  listArea.addEventListener('paste', handlePaste);

  // Helper to set value for React/Angular/Vue inputs
  function setNativeValue(element, value) {
    const lastValue = element.value;
    element.value = value;

    // 1. Try AngularJS specific update
    if (window.angular) {
      try {
        const ngEl = window.angular.element(element);
        const ngModel = ngEl.controller('ngModel');
        if (ngModel) {
          ngModel.$setViewValue(value);
          ngModel.$render();
          warn('Updated via AngularJS ngModel');
        }
      } catch (e) {
        // Ignore if not angular or failed
      }
    }

    // 2. Focus
    element.dispatchEvent(new Event('focus', { bubbles: true }));

    // 3. Input
    const event = new Event('input', { bubbles: true });
    // React 15/16 hack
    const tracker = element._valueTracker;
    if (tracker) {
      tracker.setValue(lastValue);
    }
    element.dispatchEvent(event);

    // 4. Change
    element.dispatchEvent(new Event('change', { bubbles: true }));

    // 5. Blur (Critical for Angular)
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  // Helper to trigger robust clicks
  // Helper to trigger robust clicks
  function triggerClick(element) {
    // Just use standard click - dispatching extra events causes double-clicks/form issues
    try {
      element.click();
    } catch (e) {
      // Fallback if click() fails (rare)
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      element.dispatchEvent(event);
    }
  }

  // Helper to get current code from button (for verification)
  async function getCodeFromButton(containerValue, retries = 3) {
    warn(`🔍 Checking current code for container: ${containerValue}`, 'search');

    let attempts = 0;
    while (attempts < retries) {
      const table = document.querySelector('table.pure-table');
      if (table) {
        const firstRow = table.querySelector('tbody tr');
        if (firstRow) {
          const btn = firstRow.querySelector('button');
          if (btn) {
            const text = btn.textContent.trim();

            // Check if it says "Add Code" or "Add" (no code present)
            if (text.includes('Add Code') || text === 'Add') {
              warn(`No code found on container (button says: "${text}")`, 'info');
              return null;
            }

            // Otherwise, the button text IS the code
            warn(`Found existing code: "${text}"`, 'success');
            return text;
          } else {
            warn('No button found in first row', 'warning');
          }
        } else {
          warn('No rows found in table', 'warning');
        }
      } else {
        warn('Table not found', 'warning');
      }

      attempts++;
      if (attempts < retries) {
        warn(`Retry ${attempts}/${retries} to find code...`, 'info');
        await sleep(300);
      }
    }

    warn('Could not determine current code after retries', 'warning');
    return undefined; // undefined means we couldn't check
  }

  // Helper to wait for element to appear
  async function waitForElement(selectors, timeout = 10000) {
    const start = Date.now();
    let lastLog = 0;
    let attemptCount = 0;

    warn(`Waiting for element with ${selectors.length} selector(s)...`);

    while (Date.now() - start < timeout) {
      if (!isAutomating) return null; // Stop if automation stopped

      const el = findElement(selectors);
      if (el && el.offsetParent !== null) {
        warn(`✓ Element found after ${Math.round((Date.now() - start) / 1000)}s`);
        return el; // Must be visible
      }

      // Log every 2 seconds with more detail
      if (Date.now() - lastLog > 2000) {
        attemptCount++;
        const remaining = Math.round((timeout - (Date.now() - start)) / 1000);
        warn(`Still looking for element... (${remaining}s remaining)`);

        // Every 10 seconds, show which selectors we're trying
        if (attemptCount % 5 === 0) {
          warn(`Trying selectors: ${selectors.slice(0, 2).join(', ')}${selectors.length > 2 ? '...' : ''}`);
        }

        lastLog = Date.now();
      }

      await sleep(500);
    }

    warn(`⚠ Element not found after ${timeout / 1000}s timeout`);
    return null;
  }

  async function processNextContainer() {
    if (!listLocked || index >= list.length) {
      // Show final verification report
      showVerificationReport();

      currentDisplay.textContent = "All Done";
      currentDisplay.style.color = "#69db7c";
      isAutomating = false;
      autoBtn.textContent = "Start Automation";
      autoBtn.disabled = false;
      warn('Automation completed!', 'success');
      return;
    }

    try {
      const currentContainerValue = list[index];
      const containerIndex = index; // Store for result tracking
      warn(`\n========== Processing Container ${index + 1}/${list.length}: ${currentContainerValue} ==========`, 'info');

      // Initialize result object for this container
      const result = {
        container: currentContainerValue,
        index: containerIndex,
        expectedCode: singleCode,
        actualCode: null,
        status: 'processing',
        attempts: 0,
        error: null
      };

      // Step 1: Fill container input with retry
      let containerInput = findElementSmart('containerInput', containerInputSelectors);

      if (!containerInput) {
        warn('Container input not found with any strategy! Retrying...', 'warning');
        await sleep(1000);
        containerInput = findElementSmart('containerInput', containerInputSelectors);
      }

      if (!containerInput) {
        warn('Container input not found after retry!', 'error');
        result.status = 'failed';
        result.error = 'Container input field not found';
        containerResults.push(result);

        alert('Could not find Container Input field!\n\nPlease:\n1. Check if the page has changed\n2. Recalibrate in Settings if needed');
        isAutomating = false;
        autoBtn.textContent = "Start Automation";
        return;
      }

      // Clear and set new value
      setNativeValue(containerInput, currentContainerValue);
      containerInput.focus();

      // Verify container value is set
      if (containerInput.value === currentContainerValue) {
        warn(`Container input verified: ${currentContainerValue}`, 'success');
      } else {
        warn(`Container input mismatch, retrying...`, 'warning');
        setNativeValue(containerInput, currentContainerValue);
        await sleep(50);
      }

      // Step 2: Search Button (Optional)
      if (searchSelectors.length > 0) {
        const searchEl = findElementSmart('searchButton', searchSelectors);
        if (searchEl) {
          if (searchEl.disabled) {
            warn('Search button disabled, waiting...', 'warning');
            await sleep(300);
          }
          triggerClick(searchEl);
          warn('Clicked search button, waiting for results...', 'success');
          await sleep(1500); // Wait for search results to load
        } else {
          warn('Search button not found (optional, continuing...)', 'warning');
        }
      }

      // PRE-CHECK: Verify if code already exists and is CORRECT
      const preCheckCode = await getCodeFromButton(currentContainerValue, 3);

      // Normalize codes for comparison (treat space/empty as "no code")
      const expectedCode = singleCode.trim();
      const currentCode = preCheckCode === null ? '' : preCheckCode;

      // Check if we're removing code (user entered space or empty)
      const isRemovingCode = expectedCode === '';

      if (isRemovingCode) {
        // User wants to REMOVE code
        if (currentCode === '') {
          // Container already has no code - skip
          warn(`✓ Container already has no code - SKIPPING`, 'success');
          result.status = 'skipped';
          result.actualCode = '';
          result.attempts = 0;
          containerResults.push(result);

          // Move to next container
          index++;
          currentContainer = index < list.length ? list[index] : "DONE";
          currentDisplay.textContent = currentContainer;
          renderList();

          await sleep(300);
          if (isAutomating && index < list.length) {
            processNextContainer();
          } else if (index >= list.length) {
            processNextContainer(); // Trigger completion
          }
          return;
        } else {
          warn(`Container has code "${currentCode}", will remove it (set to empty)`, 'info');
        }
      } else {
        // User wants to ADD/UPDATE code
        if (currentCode === expectedCode) {
          // Code already matches what we want!
          warn(`✓ Container already has correct code "${expectedCode}" - SKIPPING`, 'success');
          result.status = 'skipped';
          result.actualCode = currentCode;
          result.attempts = 0;
          containerResults.push(result);

          // Move to next container
          index++;
          currentContainer = index < list.length ? list[index] : "DONE";
          currentDisplay.textContent = currentContainer;
          renderList();

          await sleep(300);
          if (isAutomating && index < list.length) {
            processNextContainer();
          } else if (index >= list.length) {
            processNextContainer(); // Trigger completion
          }
          return;
        } else if (currentCode !== '') {
          warn(`Container has different code "${currentCode}", will update to "${expectedCode}"`, 'info');
        } else {
          warn(`Container has no code, will add "${expectedCode}"`, 'info');
        }
      }

      // Step 3: Click add button (Optional) - Wait for it to appear after search
      let needsCodeEntry = false;

      if (addButtonSelectors.length > 0) {
        // Clear code input cache before clicking add (modal will have new element)
        cachedElements.codeInput = null;

        warn('Looking for Add button in first row of search results...', 'search');
        let addButton = null;
        let retries = 8; // Try for up to 6.4 seconds (8 * 800ms)

        while (retries > 0 && !addButton) {
          // Specific strategy: Look ONLY in the first row of the table
          const table = document.querySelector('table.pure-table');
          if (table) {
            const firstRow = table.querySelector('tbody tr'); // Get first row
            if (firstRow) {
              // Check for any button in this row
              const btn = firstRow.querySelector('button');
              if (btn) {
                const text = btn.textContent.trim();
                if (text.includes('Add Code') || text.includes('Add')) {
                  addButton = btn;
                  needsCodeEntry = true;
                  warn('Found Add button in first row', 'success');
                } else {
                  // Button exists with code - we'll update it
                  addButton = btn;
                  needsCodeEntry = true;
                  warn(`Found button with code "${text}", clicking to update`, 'info');
                }
              }
            }
          }

          if (!addButton) {
            if (retries > 1) {
              warn(`Waiting for search results/button... (${retries - 1} retries remaining)`, 'info');
              await sleep(800);
            }
            retries--;
          }
        }

        if (addButton) {
          result.attempts++;
          triggerClick(addButton);
          warn('Clicked Add/Edit button, waiting for modal...', 'success');
          await sleep(600); // Wait for modal to appear
        } else {
          warn('Add button not found in first row after search', 'warning');
          result.status = 'failed';
          result.error = 'Add button not found';
          containerResults.push(result);

          // Move to next
          index++;
          currentContainer = index < list.length ? list[index] : "DONE";
          currentDisplay.textContent = currentContainer;
          renderList();

          await sleep(300);
          if (isAutomating && index < list.length) {
            processNextContainer();
          } else if (index >= list.length) {
            processNextContainer();
          }
          return;
        }
      }

      // Step 4: Fill code input (Only if code value exists)
      if (singleCode && needsCodeEntry) {
        warn('Looking for code input field...', 'search');

        // Try smart detection with retry
        let codeInput = null;
        let retries = 4;

        while (retries > 0 && !codeInput) {
          codeInput = findElementSmart('codeInput', codeInputSelectors);

          if (!codeInput) {
            warn(`Code input not found, ${retries - 1} retries remaining...`, 'warning');
            retries--;
            if (retries > 0) await sleep(300);
          }
        }

        if (codeInput) {
          // Paste and verify code with fast retry
          let verified = false;
          let verifyRetries = 5;

          while (verifyRetries > 0 && !verified) {
            setNativeValue(codeInput, singleCode);
            codeInput.focus();
            await sleep(30); // Minimal wait for value to settle

            if (codeInput.value === singleCode) {
              verified = true;
              warn(`Code verified in input: ${singleCode}`, 'success');
            } else {
              warn(`Code not set (current: "${codeInput.value}"), retry ${6 - verifyRetries}/5...`, 'warning');
              verifyRetries--;
            }
          }

          if (!verified) {
            warn('Warning: Code verification failed in input field!', 'error');
            result.status = 'failed';
            result.error = 'Code input verification failed';
            containerResults.push(result);

            alert(`Could not set code in input for container ${currentContainerValue}.\n\nAutomation paused.`);
            isAutomating = false;
            autoBtn.textContent = "Resume Automation";
            return;
          }

          // Minimal wait after verification
          await sleep(50);
        } else {
          warn('Code input not found after all retries!', 'error');
          result.status = 'failed';
          result.error = 'Code input field not found';
          containerResults.push(result);

          alert(`Could not find Code Input for container ${currentContainerValue}.\n\nAutomation paused.`);
          isAutomating = false;
          autoBtn.textContent = "Resume Automation";
          return;
        }
      }

      // Step 5: Confirm/Save Button
      if (confirmSelectors.length > 0 && needsCodeEntry) {
        const confirmBtn = findElementSmart('confirmButton', confirmSelectors);
        if (confirmBtn) {
          warn('Clicking Save/Confirm button...', 'success');
          triggerClick(confirmBtn);
          await sleep(500); // Wait for save to complete and modal to close
        } else {
          warn('Confirm button not found (optional, continuing...)', 'warning');
        }
      }

      // POST-SAVE VERIFICATION: Check if code was actually saved
      warn('🔍 POST-SAVE VERIFICATION: Checking if code was saved...', 'search');

      // Re-search for container to refresh results
      if (searchSelectors.length > 0) {
        const searchEl = findElementSmart('searchButton', searchSelectors);
        if (searchEl) {
          triggerClick(searchEl);
          await sleep(1500); // Wait for search results
        }
      }

      const postSaveCode = await getCodeFromButton(currentContainerValue, 3);
      const postSaveActual = postSaveCode === null ? '' : postSaveCode;

      // Check verification based on whether we're adding or removing
      let verificationPassed = false;
      if (isRemovingCode) {
        // Removing code: verify container has no code
        verificationPassed = (postSaveActual === '');
      } else {
        // Adding code: verify container has expected code
        verificationPassed = (postSaveActual === expectedCode);
      }

      if (verificationPassed) {
        const action = isRemovingCode ? 'removed' : 'confirmed';
        const displayCode = isRemovingCode ? '(no code)' : `"${expectedCode}"`;
        warn(`✓✓✓ VERIFICATION SUCCESS: Code ${displayCode} ${action} on container!`, 'success');
        result.status = 'success';
        result.actualCode = postSaveActual;
        containerResults.push(result);
      } else {
        const expectedDisplay = isRemovingCode ? '(no code)' : `"${expectedCode}"`;
        const actualDisplay = postSaveActual === '' ? '(no code)' : `"${postSaveActual}"`;
        warn(`✗✗✗ VERIFICATION FAILED: Expected ${expectedDisplay}, found ${actualDisplay}`, 'error');

        // Retry once
        if (result.attempts < 2) {
          warn(`Retrying container ${currentContainerValue}... (Attempt ${result.attempts + 1}/2)`, 'warning');
          await sleep(500);
          // Don't increment index, will retry same container
          processNextContainer();
          return;
        } else {
          warn(`Failed after ${result.attempts} attempts`, 'error');
          result.status = 'failed';
          result.actualCode = postSaveCode;
          result.error = `Verification failed: expected "${singleCode}", found "${postSaveCode}"`;
          containerResults.push(result);
        }
      }

      // Step 6: Move to next container
      index++;
      currentContainer = index < list.length ? list[index] : "DONE";
      currentDisplay.textContent = currentContainer;
      renderList();

      // Clear cached elements for next iteration (except container input which stays the same)
      cachedElements.codeInput = null;
      cachedElements.addButton = null;
      cachedElements.confirmButton = null;

      await sleep(150); // Minimal transition to next container

      // Continue if still automating
      if (isAutomating && index < list.length) {
        processNextContainer();
      } else if (index >= list.length) {
        processNextContainer(); // Trigger completion
      }

    } catch (error) {
      warn('Error during automation: ' + error.message, 'error');
      console.error(error);

      // Log error in results
      containerResults.push({
        container: list[index],
        index: index,
        expectedCode: singleCode,
        actualCode: null,
        status: 'error',
        attempts: 0,
        error: error.message
      });

      isAutomating = false;
      autoBtn.textContent = "Start Automation";
    }
  }

  // Show final verification report
  function showVerificationReport() {
    if (containerResults.length === 0) return;

    const successCount = containerResults.filter(r => r.status === 'success').length;
    const skippedCount = containerResults.filter(r => r.status === 'skipped').length;
    const failedCount = containerResults.filter(r => r.status === 'failed' || r.status === 'error').length;
    const totalCount = containerResults.length;

    warn(`\n========== VERIFICATION REPORT ==========`, 'info');
    warn(`Total Containers: ${totalCount}`, 'info');
    warn(`✓ Success: ${successCount}`, 'success');
    warn(`⊘ Skipped (already correct): ${skippedCount}`, 'info');
    warn(`✗ Failed: ${failedCount}`, 'error');

    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      z-index: 2147483648;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Segoe UI', Roboto, sans-serif;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: #1e1e1e;
      color: #e0e0e0;
      border-radius: 8px;
      padding: 24px;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    `;

    let failedList = '';
    const failed = containerResults.filter(r => r.status === 'failed' || r.status === 'error');
    if (failed.length > 0) {
      failedList = '<div style="margin-top: 16px; padding: 12px; background: rgba(244, 135, 113, 0.1); border-left: 3px solid #f48771; border-radius: 4px;">';
      failedList += '<div style="font-weight: 600; color: #f48771; margin-bottom: 8px;">Failed Containers:</div>';
      failed.forEach(r => {
        failedList += `<div style="font-family: monospace; font-size: 12px; margin: 4px 0; color: #ccc;">
          ${r.container} - ${r.error || 'Unknown error'}
        </div>`;
      });
      failedList += '</div>';
    }

    content.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="margin: 0; font-size: 20px; color: #fff;">Verification Report</h2>
        <button id="aft_close_report" style="background: transparent; border: none; color: #858585; cursor: pointer; font-size: 24px; padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 4px;">×</button>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px;">
        <div style="background: #252526; padding: 16px; border-radius: 4px; border-left: 3px solid #4ec9b0;">
          <div style="font-size: 28px; font-weight: 700; color: #4ec9b0;">${successCount}</div>
          <div style="font-size: 12px; color: #858585; text-transform: uppercase;">Success</div>
        </div>
        <div style="background: #252526; padding: 16px; border-radius: 4px; border-left: 3px solid #f48771;">
          <div style="font-size: 28px; font-weight: 700; color: #f48771;">${failedCount}</div>
          <div style="font-size: 12px; color: #858585; text-transform: uppercase;">Failed</div>
        </div>
      </div>

      <div style="background: #252526; padding: 12px; border-radius: 4px; margin-bottom: 16px;">
        <div style="font-size: 12px; color: #858585; margin-bottom: 4px;">Total Processed</div>
        <div style="font-size: 16px; font-weight: 600; color: #fff;">${totalCount} containers</div>
        <div style="font-size: 12px; color: #858585; margin-top: 4px;">${skippedCount} skipped (already had correct code)</div>
      </div>

      ${failedList}

      <div style="display: flex; gap: 8px; margin-top: 20px;">
        ${failedCount > 0 ? `<button id="aft_export_failed" style="flex: 1; padding: 10px; background: #3a3d41; color: #ccc; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 500;">Export Failed Containers</button>` : ''}
        <button id="aft_close_report_btn" style="flex: 1; padding: 10px; background: #007acc; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 500;">Close</button>
      </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Close button handlers
    const closeBtn = document.getElementById('aft_close_report');
    const closeBtn2 = document.getElementById('aft_close_report_btn');
    const closeHandler = () => modal.remove();

    if (closeBtn) closeBtn.onclick = closeHandler;
    if (closeBtn2) closeBtn2.onclick = closeHandler;

    // Export failed containers
    const exportBtn = document.getElementById('aft_export_failed');
    if (exportBtn) {
      exportBtn.onclick = () => {
        const failedContainers = failed.map(r => r.container).join('\n');
        const blob = new Blob([failedContainers], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'failed_containers.txt';
        a.click();
        URL.revokeObjectURL(url);
        warn('Failed containers exported', 'success');
      };
    }

    // Close on background click
    modal.onclick = (e) => {
      if (e.target === modal) closeHandler();
    };
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ---- Auto Start ----
  autoBtn.onclick = async () => {
    if (isAutomating) {
      // Stop automation
      isAutomating = false;
      autoBtn.textContent = "Start Automation";
      warn('Automation stopped');
      return;
    }

    if (!checkReadyToStart()) {
      warn("Please select all elements and paste container list first!");
      return;
    }

    // Get code from UI input (preserve spaces - they're valid for clearing codes)
    const codeInputVal = document.getElementById('aft_global_code').value;
    singleCode = codeInputVal.toUpperCase();
    saveSelectors(); // Save code to storage

    // Log what we're about to do
    warn(`Automation config: Container=${containerInputSelectors.length > 0}, Search=${searchSelectors.length > 0}, Add=${addButtonSelectors.length > 0}, Code=${codeInputSelectors.length > 0 && !!singleCode}, Confirm=${confirmSelectors.length > 0}`);

    // CRITICAL: Check if user provided code but didn't calibrate code input
    if (singleCode && codeInputSelectors.length === 0) {
      alert('⚠️ You entered a code but have not calibrated the Code Input field!\n\nPlease:\n1. Click Settings (gear icon)\n2. Click "Select Input" for Code Input\n3. Click on the code input field on the page\n4. Try automation again');
      warn('ERROR: Code provided but Code Input not calibrated!');
      return;
    }

    if (codeInputSelectors.length > 0 && !singleCode) {
      warn("Code input is calibrated but no code provided. Will skip code entry.");
    }

    isAutomating = true;
    autoBtn.textContent = "Stop Automation";
    warn('Starting automation...', 'info');

    // Reset verification tracking
    containerResults = [];
    verificationLog = [];

    // Clear cache at start for fresh detection
    cachedElements = {
      containerInput: null,
      codeInput: null,
      searchButton: null,
      addButton: null,
      confirmButton: null
    };

    await sleep(200);
    processNextContainer();
  };

  // ---- Clear ----
  clearBtn.onclick = () => {
    if (isAutomating) {
      warn('Stop automation first!');
      return;
    }

    list = [];
    index = 0;
    currentContainer = '';
    listLocked = false;
    singleCode = '';

    // Clear element cache
    cachedElements = {
      containerInput: null,
      codeInput: null,
      searchButton: null,
      addButton: null,
      confirmButton: null
    };

    currentDisplay.textContent = 'Waiting...';
    currentDisplay.style.color = '#fff';
    progressFill.style.width = '0%';
    progressText.textContent = '0/0';

    listWrapper.innerHTML = '';
    const ta = document.createElement('textarea');
    ta.id = 'aft_list';
    ta.placeholder = 'Paste containers here...';
    listWrapper.appendChild(ta);
    listArea = ta;
    listArea.addEventListener('paste', handlePaste);

    warn('List cleared!');
  };

  closeBtn.onclick = () => {
    if (isAutomating && !confirm('Automation is running. Are you sure you want to close?')) {
      return;
    }
    wrapper.remove();
  };

  // ---- Double Ad Rotation (Maximize Earnings) ----
  const ad1 = document.getElementById('aft_ad_1');
  const ad2 = document.getElementById('aft_ad_2');

  if (ad1 && ad2) {
    // Refresh both ads every 2 minutes (120,000ms) to double  passive payout
    setInterval(() => {
      ad1.src = `https://ad.a-ads.com/2430155?size=320x50&_t=${Date.now()}`;
      ad2.src = `https://ad.a-ads.com/2430163?size=320x50&_t=${Date.now()}`;
    }, 120000);
  }

})();