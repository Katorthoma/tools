// ==UserScript==
// @name         Audible Hi-Res Cover Opener
// @namespace    https://github.com/Katorthoma/tools
// @version      0.2.5
// @description  Adds an expand button to Audible cover art and opens the highest-resolution cover reported by Audible's catalog API.
// @author       Katorthoma
// @license      MIT
// @homepageURL  https://github.com/Katorthoma/tools/tree/main/userscripts/audible-cover-opener
// @supportURL   https://github.com/Katorthoma/tools/issues
// @updateURL    https://raw.githubusercontent.com/Katorthoma/tools/main/userscripts/audible-cover-opener/Audible-Hi-Res-Cover-Opener.user.js
// @downloadURL  https://raw.githubusercontent.com/Katorthoma/tools/main/userscripts/audible-cover-opener/Audible-Hi-Res-Cover-Opener.user.js
// @match        https://www.audible.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM.xmlHttpRequest
// @grant        GM.openInTab
// @grant        GM.getValue
// @grant        GM.setValue
// @connect      api.audible.com
// @noframes
// @run-at       document-idle
// ==/UserScript==

// Privacy note: cookie-free catalog requests depend on userscript-manager support
// for GM_xmlhttpRequest's `anonymous` option. Tampermonkey and Violentmonkey
// honor it; Greasemonkey 4 may ignore it and send Audible cookies.

(() => {
    'use strict';

    const DEBUG = false;
    const API_BASE = 'https://api.audible.com/1.0/catalog/products/';
    const IMAGE_SIZES = ['2400', '1000', '700', '500'];
    const RESPONSE_GROUPS = 'media';
    const IMAGE_HOSTS = new Set([
        'm.media-amazon.com',
        'images-na.ssl-images-amazon.com'
    ]);

    const COVER_SELECTOR = [
        'adbl-product-image img[src*="m.media-amazon.com/images/I/"]',
        '[data-asin] img[src*="m.media-amazon.com/images/I/"]',
        'a[href*="/pd/"] img[src*="m.media-amazon.com/images/I/"]'
    ].join(',');

    const processedImages = new WeakSet();
    const requestCache = new Map();
    const openedStateCache = new Map();
    const pendingScanRoots = new Set();
    const resizeCallbacks = new WeakMap();
    const observedResizeTargets = new Set();
    const repositionCallbacks = new WeakMap();
    const trackedButtons = new Set();
    const unresolvedSince = new WeakMap();

    let scanScheduled = false;
    let repositionScheduled = false;

    const resizeObserver = typeof ResizeObserver === 'function'
        ? new ResizeObserver((entries) => {
            for (const entry of entries) {
                const callbacks = resizeCallbacks.get(entry.target);
                if (!callbacks) continue;
                for (const callback of callbacks) callback();
            }
        })
        : null;

    injectStyles();

    const mutationObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) queueScan(node);
            }
        }

        scheduleScanFlush();
    });

    mutationObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    window.addEventListener('resize', scheduleAllRepositions, { passive: true });

    // Start legacy cleanup only after all module-level state and observers above
    // have been initialized. This avoids a temporal-dead-zone trap if cleanup
    // logic later grows to reference additional module state.
    const legacyHistoryMigration = runLegacyCleanupOnce()
        .catch((error) => {
            debug('Legacy cleanup failed', error);
            return false;
        });

    scan(document);

    function debug(...args) {
        if (DEBUG) console.debug('[Audible Hi-Res Cover Opener]', ...args);
    }

    function queueScan(node) {
        if (pendingScanRoots.has(document)) return;

        // Large Audible render bursts can make containment de-duplication more
        // expensive than one idempotent document scan. Collapse early.
        if (pendingScanRoots.size >= 32) {
            pendingScanRoots.clear();
            pendingScanRoots.add(document);
            return;
        }

        for (const root of pendingScanRoots) {
            if (root.contains(node)) return;
            if (node.contains(root)) pendingScanRoots.delete(root);
        }
        pendingScanRoots.add(node);
    }

    function scheduleScanFlush() {
        if (scanScheduled) return;
        scanScheduled = true;

        requestAnimationFrame(() => {
            scanScheduled = false;
            cleanupDisconnectedResizeTargets();

            const roots = [...pendingScanRoots];
            pendingScanRoots.clear();
            for (const root of roots) scan(root);
        });
    }

    function scan(root) {
        if (root.matches?.(COVER_SELECTOR)) enhanceCover(root);
        root.querySelectorAll?.(COVER_SELECTOR).forEach(enhanceCover);
    }

    function enhanceCover(img) {
        if (processedImages.has(img)) return;

        const asin = findAsin(img);
        if (!asin) {
            recordUnresolved(img);
            return;
        }

        debug('Resolved cover ASIN', asin, img);

        const host = findOverlayHost(img);
        if (!host) {
            recordUnresolved(img);
            return;
        }

        unresolvedSince.delete(img);

        // If this host was already enhanced through another matching selector/image,
        // leave it untouched rather than changing layout without adding a button.
        if (host.querySelector(':scope > .audible-hires-cover-button')) {
            processedImages.add(img);
            return;
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'audible-hires-cover-button';
        button.dataset.asin = asin;
        const rawAccessibleName = String(img.alt || '').trim() || asin;
        const accessibleName = rawAccessibleName.length > 60
            ? `${rawAccessibleName.slice(0, 57).trimEnd()}…`
            : rawAccessibleName;
        button.setAttribute('aria-label', `Open highest-resolution cover for ${accessibleName}`);
        button.title = `Open highest-resolution cover (${asin})`;
        button.innerHTML = `${expandIconSvg()}<span class="audible-hires-cover-check" aria-hidden="true">✓</span>`;

        button.addEventListener('click', (event) => handleButtonClick(event, button, asin), true);

        const stopPressPropagation = (event) => event.stopPropagation();
        for (const eventName of ['pointerdown', 'mousedown', 'mouseup']) {
            button.addEventListener(eventName, stopPressPropagation, true);
        }

        host.classList.add('audible-hires-cover-host');
        host.appendChild(button);
        processedImages.add(img);

        const reposition = () => positionButton(button, img, host);
        repositionCallbacks.set(button, reposition);
        trackedButtons.add(button);
        requestAnimationFrame(reposition);

        observeResize(img, reposition);
        observeResize(host, reposition);
        img.addEventListener('load', reposition, { passive: true });

        applyOpenedState(button, asin)
            .catch((error) => debug('Opened-state lookup failed', error));
    }

    function recordUnresolved(img) {
        const firstSeen = unresolvedSince.get(img) ?? Date.now();
        unresolvedSince.set(img, firstSeen);
        if (Date.now() - firstSeen > 5000) processedImages.add(img);
    }

    async function handleButtonClick(event, button, asin) {
        event.preventDefault();
        event.stopImmediatePropagation();

        if (button.dataset.loading === 'true') return;

        if (!canUseGmOpenInTab()) {
            showToast('A userscript manager with GM_openInTab support is required to open covers in a background tab.');
            return;
        }

        button.dataset.loading = 'true';
        button.classList.add('audible-hires-cover-loading');
        button.title = `Finding high-resolution cover for ${asin}…`;

        try {
            const result = await getBestCover(asin);
            debug('Best cover', asin, result);

            button.title = `Open ${result.size}px cover (${asin})`;
            await openWithGm(result.url);
            await markCoverOpened(asin);
        } catch (error) {
            console.error('[Audible Hi-Res Cover Opener]', error);
            button.classList.add('audible-hires-cover-error');
            button.title = `Could not retrieve high-resolution cover for ${asin}`;
            showToast(`Could not retrieve a high-resolution cover for ${asin}. Check the browser console for details.`);
            setTimeout(() => button.classList.remove('audible-hires-cover-error'), 2500);
        } finally {
            button.dataset.loading = 'false';
            button.classList.remove('audible-hires-cover-loading');
        }
    }

    function findOverlayHost(img) {
        const productImage = img.closest('adbl-product-image');
        if (productImage) return productImage;

        const picture = img.closest('picture');
        if (picture?.parentElement) return picture.parentElement;

        return img.parentElement;
    }

    function positionButton(button, img, host) {
        if (!button.isConnected || !img.isConnected || !host.isConnected) return;

        const imgRect = img.getBoundingClientRect();
        const hostRect = host.getBoundingClientRect();
        if (!imgRect.width || !imgRect.height || !hostRect.width || !hostRect.height) return;

        const size = imgRect.width < 110 ? 22 : imgRect.width < 180 ? 25 : 28;
        const inset = imgRect.width < 110 ? 4 : 6;

        const top = imgRect.top - hostRect.top + inset;
        const left = imgRect.left - hostRect.left + imgRect.width - size - inset;

        button.style.width = `${size}px`;
        button.style.height = `${size}px`;
        button.style.top = `${Math.max(0, top)}px`;
        button.style.left = `${Math.max(0, left)}px`;
        button.style.right = 'auto';
    }

    function findAsin(img) {
        // Walk outward from the image so the closest valid product identity wins.
        // This handles listing cards and carousels without searching broad containers
        // that may contain several unrelated products.
        for (let node = img; node && node !== document.body; node = node.parentElement) {
            const fromData = normalizeAsin(node.dataset?.asin);
            if (fromData) return fromData;

            if (node.matches?.('a[href*="/pd/"]')) {
                const fromLink = extractAsinFromUrl(node.href);
                if (fromLink) return fromLink;
            }
        }

        const pageAsin = extractAsinFromUrl(location.href);
        if (!pageAsin) return null;

        // Never borrow the PDP ASIN for a list/recommendation context. If an
        // unresolved image lives in one of these containers, ambiguity is safer
        // than silently associating it with the current product.
        const inListContext = Boolean(img.closest([
            'adbl-product-grid-item',
            '[data-widget="product-carousel"]',
            'adbl-carousel',
            'li',
            '[class*="carousel"]',
            '[class*="recommendation"]',
            '[class*="product-list"]'
        ].join(',')));
        if (inListContext) return null;

        // Reaching this point on a /pd/ page means COVER_SELECTOR matched an
        // adbl-product-image descendant that had no more specific ASIN identity.
        // Outside known list contexts, the page ASIN is the best available match.
        return pageAsin;
    }

    function extractAsinFromUrl(url) {
        if (!url) return null;

        try {
            const pathname = new URL(url, location.origin).pathname;
            const parts = pathname.split('/').filter(Boolean);
            const pdIndex = parts.indexOf('pd');
            if (pdIndex === -1) return null;

            for (let i = parts.length - 1; i > pdIndex; i--) {
                const asin = normalizeAsin(parts[i]);
                if (asin) return asin;
            }
        } catch {
            return null;
        }

        return null;
    }

    function normalizeAsin(value) {
        const asin = String(value || '').trim().toUpperCase();
        return /^[A-Z0-9]{10}$/.test(asin) ? asin : null;
    }

    function isSafeCoverUrl(url) {
        try {
            const parsed = new URL(url);
            return parsed.protocol === 'https:' && IMAGE_HOSTS.has(parsed.hostname);
        } catch {
            return false;
        }
    }

    async function getBestCover(asin) {
        if (requestCache.has(asin)) return requestCache.get(asin);

        const request = fetchProductImages(asin)
            .then((images) => {
                for (const size of IMAGE_SIZES) {
                    const url = images?.[size];
                    if (typeof url === 'string' && isSafeCoverUrl(url)) {
                        return { size, url };
                    }
                }
                throw new Error(`No safe supported cover size returned for ${asin}`);
            })
            .catch((error) => {
                requestCache.delete(asin);
                throw error;
            });

        requestCache.set(asin, request);
        return request;
    }

    function fetchProductImages(asin) {
        const url = new URL(`${API_BASE}${encodeURIComponent(asin)}`);
        url.searchParams.set('response_groups', RESPONSE_GROUPS);
        url.searchParams.set('image_sizes', IMAGE_SIZES.join(','));

        debug('API request', url.href);

        const legacyRequest = typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest : null;
        const modernRequest = typeof GM !== 'undefined' && typeof GM.xmlHttpRequest === 'function'
            ? GM.xmlHttpRequest.bind(GM)
            : null;

        const requester = legacyRequest || modernRequest;
        if (!requester) {
            return Promise.reject(new Error('No supported GM XMLHttpRequest API is available'));
        }

        return requestViaGm(requester, url.href);
    }

    function requestViaGm(requester, url) {
        return new Promise((resolve, reject) => {
            let settled = false;

            const finishLoad = (response) => {
                if (settled) return;
                settled = true;

                const status = Number(response?.status || 0);
                if (status < 200 || status >= 300) {
                    reject(new Error(`Audible API returned HTTP ${status || 'unknown'}`));
                    return;
                }

                try {
                    const data = typeof response.response === 'object' && response.response
                        ? response.response
                        : JSON.parse(response.responseText || '');
                    resolve(data?.product?.product_images || {});
                } catch (error) {
                    reject(new Error(`Could not parse Audible API response: ${error.message}`));
                }
            };

            const finishError = (error) => {
                if (settled) return;
                settled = true;
                reject(error instanceof Error ? error : new Error('Audible API request failed'));
            };

            const details = {
                method: 'GET',
                url,
                timeout: 15000,
                responseType: 'json',
                anonymous: true,
                headers: { Accept: 'application/json' },
                onload: finishLoad,
                onerror: () => finishError(new Error('Audible API request failed')),
                ontimeout: () => finishError(new Error('Audible API request timed out'))
            };

            try {
                const maybePromise = requester(details);
                if (maybePromise && typeof maybePromise.then === 'function') {
                    maybePromise.then(finishLoad).catch(finishError);
                }
            } catch (error) {
                finishError(error);
            }
        });
    }

    function canUseGmOpenInTab() {
        return typeof GM_openInTab === 'function' ||
            (typeof GM !== 'undefined' && typeof GM.openInTab === 'function');
    }

    async function openWithGm(url) {
        if (!isSafeCoverUrl(url)) throw new Error('Refusing to open an untrusted cover URL');

        const options = { active: false, insert: true, setParent: true };

        if (typeof GM_openInTab === 'function') {
            GM_openInTab(url, options);
            return;
        }

        if (typeof GM !== 'undefined' && typeof GM.openInTab === 'function') {
            const result = GM.openInTab(url, options);
            if (result && typeof result.then === 'function') await result;
            return;
        }

        throw new Error('No supported tab-opening API is available');
    }

    function openedStorageKey(asin) {
        return `opened:${asin}`;
    }

    async function getPrivateValue(key, defaultValue = false) {
        try {
            if (typeof GM_getValue === 'function') {
                return GM_getValue(key, defaultValue);
            }

            if (typeof GM !== 'undefined' && typeof GM.getValue === 'function') {
                return await GM.getValue(key, defaultValue);
            }
        } catch (error) {
            debug('Private storage read failed', error);
        }

        return defaultValue;
    }

    async function setPrivateValue(key, value) {
        try {
            if (typeof GM_setValue === 'function') {
                GM_setValue(key, value);
                return true;
            }

            if (typeof GM !== 'undefined' && typeof GM.setValue === 'function') {
                await GM.setValue(key, value);
                return true;
            }
        } catch (error) {
            debug('Private storage write failed', error);
        }

        return false;
    }

    async function isCoverOpened(asin) {
        if (openedStateCache.has(asin)) return openedStateCache.get(asin);

        const lookup = (async () => {
            await legacyHistoryMigration;
            return Boolean(await getPrivateValue(openedStorageKey(asin), false));
        })();

        openedStateCache.set(asin, lookup);
        const opened = await lookup;
        if (openedStateCache.get(asin) !== true) openedStateCache.set(asin, opened);
        return openedStateCache.get(asin) === true;
    }

    async function runLegacyCleanupOnce() {
        // sessionStorage is per-tab, so clear obsolete response-cache entries every load.
        // They are no longer trusted or read by this script.
        clearLegacySessionCache();

        const markerKey = 'migration:legacy-opened-history-v1';
        if (await getPrivateValue(markerKey, false)) return true;

        const migratedCleanly = await migrateLegacyOpenedHistory();
        if (!migratedCleanly) return false;

        return setPrivateValue(markerKey, true);
    }

    async function migrateLegacyOpenedHistory() {
        const prefix = 'audible-hires-cover-opened:';
        const migrations = [];

        try {
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (!key?.startsWith(prefix) || localStorage.getItem(key) !== '1') continue;

                const asin = normalizeAsin(key.slice(prefix.length));
                if (!asin) continue;

                migrations.push((async () => {
                    const stored = await setPrivateValue(openedStorageKey(asin), true);
                    if (!stored) return false;

                    try {
                        localStorage.removeItem(key);
                        return true;
                    } catch {
                        return false;
                    }
                })());
            }
        } catch {
            return false;
        }

        const results = await Promise.allSettled(migrations);
        return results.every((result) => result.status === 'fulfilled' && result.value === true);
    }

    function clearLegacySessionCache() {
        const prefix = 'audible-hires-cover:';
        try {
            for (let i = sessionStorage.length - 1; i >= 0; i--) {
                const key = sessionStorage.key(i);
                if (key?.startsWith(prefix)) sessionStorage.removeItem(key);
            }
        } catch {
            // Legacy cleanup is optional.
        }
    }

    async function applyOpenedState(button, asin) {
        if (await isCoverOpened(asin)) markButtonOpened(button);
    }

    async function markCoverOpened(asin) {
        openedStateCache.set(asin, true);
        await setPrivateValue(openedStorageKey(asin), true);

        document.querySelectorAll(`.audible-hires-cover-button[data-asin="${asin}"]`)
            .forEach(markButtonOpened);
    }

    function markButtonOpened(button) {
        button.classList.add('audible-hires-cover-opened');
        button.dataset.opened = 'true';
        if (!button.title.includes('previously opened')) {
            button.title += ' • previously opened';
        }
    }

    function observeResize(target, callback) {
        if (!resizeObserver || !target) return;

        let callbacks = resizeCallbacks.get(target);
        if (!callbacks) {
            callbacks = new Set();
            resizeCallbacks.set(target, callbacks);
            observedResizeTargets.add(target);
            resizeObserver.observe(target);
        }
        callbacks.add(callback);
    }

    function cleanupDisconnectedResizeTargets() {
        if (resizeObserver) {
            for (const target of observedResizeTargets) {
                if (target.isConnected) continue;
                resizeObserver.unobserve(target);
                observedResizeTargets.delete(target);
                resizeCallbacks.delete(target);
            }
        }

        for (const button of trackedButtons) {
            if (button.isConnected) continue;
            trackedButtons.delete(button);
            repositionCallbacks.delete(button);
        }
    }

    function scheduleAllRepositions() {
        if (repositionScheduled) return;
        repositionScheduled = true;

        requestAnimationFrame(() => {
            repositionScheduled = false;
            cleanupDisconnectedResizeTargets();
            for (const button of trackedButtons) {
                repositionCallbacks.get(button)?.();
            }
        });
    }

    function showToast(message) {
        document.querySelector('.audible-hires-cover-toast')?.remove();

        const toast = document.createElement('div');
        toast.className = 'audible-hires-cover-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('audible-hires-cover-toast-visible'));
        setTimeout(() => {
            toast.classList.remove('audible-hires-cover-toast-visible');
            setTimeout(() => toast.remove(), 200);
        }, 4200);
    }

    function expandIconSvg() {
        return `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
            </svg>`;
    }

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .audible-hires-cover-host {
                position: relative !important;
            }

            .audible-hires-cover-button {
                position: absolute;
                z-index: 2147483000;
                display: block;
                box-sizing: border-box;
                padding: 0;
                margin: 0;
                overflow: hidden;
                border: 1px solid rgba(0, 0, 0, 0.24);
                border-radius: 6px;
                background: rgba(255, 255, 255, 0.74);
                color: #182334;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.22);
                cursor: pointer;
                opacity: 0.78;
                transition: opacity 120ms ease, background 120ms ease, box-shadow 120ms ease;
                -webkit-appearance: none;
                appearance: none;
                font-size: 0;
                line-height: 0;
            }

            .audible-hires-cover-button:hover {
                opacity: 0.98;
                background: rgba(255, 255, 255, 0.94);
                box-shadow: 0 2px 5px rgba(0, 0, 0, 0.28);
            }

            .audible-hires-cover-button:focus-visible {
                opacity: 1;
                outline: 2px solid #ff9900;
                outline-offset: 1px;
            }

            .audible-hires-cover-button svg {
                position: absolute !important;
                top: 50% !important;
                left: 50% !important;
                width: 58% !important;
                height: 58% !important;
                margin: 0 !important;
                padding: 0 !important;
                display: block !important;
                transform: translate(-50%, -50%) !important;
                transform-origin: center center !important;
                fill: none;
                stroke: currentColor;
                stroke-width: 2;
                stroke-linecap: round;
                stroke-linejoin: round;
                pointer-events: none;
            }

            .audible-hires-cover-button svg path {
                vector-effect: non-scaling-stroke;
            }

            .audible-hires-cover-check {
                position: absolute !important;
                right: 1px !important;
                bottom: 1px !important;
                width: 9px !important;
                height: 9px !important;
                margin: 0 !important;
                padding: 0 !important;
                border-radius: 999px;
                background: rgba(28, 128, 52, 0.96);
                color: #fff;
                box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.78);
                font: 700 7px/9px Arial, sans-serif !important;
                text-align: center !important;
                opacity: 0;
                transform: scale(0.72);
                transform-origin: center center;
                transition: opacity 120ms ease, transform 120ms ease;
                pointer-events: none;
            }

            .audible-hires-cover-opened .audible-hires-cover-check {
                opacity: 1;
                transform: scale(1);
            }

            .audible-hires-cover-opened {
                border-color: rgba(28, 128, 52, 0.55);
            }

            .audible-hires-cover-loading {
                opacity: 0.96;
                background: rgba(255, 244, 220, 0.94);
            }

            .audible-hires-cover-loading svg {
                animation: audible-hires-cover-pulse 700ms ease-in-out infinite alternate;
            }

            .audible-hires-cover-error {
                color: #a00;
                outline: 2px solid #a00 !important;
            }

            @keyframes audible-hires-cover-pulse {
                from { opacity: 0.35; }
                to   { opacity: 1; }
            }

            .audible-hires-cover-toast {
                position: fixed;
                left: 50%;
                bottom: 28px;
                z-index: 2147483647;
                max-width: min(560px, calc(100vw - 32px));
                padding: 10px 14px;
                border-radius: 7px;
                background: rgba(20, 20, 20, 0.96);
                color: #fff;
                font: 14px/1.35 Arial, sans-serif;
                box-shadow: 0 3px 14px rgba(0, 0, 0, 0.30);
                transform: translate(-50%, 8px);
                opacity: 0;
                transition: opacity 160ms ease, transform 160ms ease;
                pointer-events: none;
            }

            .audible-hires-cover-toast-visible {
                opacity: 1;
                transform: translate(-50%, 0);
            }
        `;
        document.head.appendChild(style);
    }
})();
