// ==UserScript==
// @name         Podium Hi-Res Cover Opener
// @namespace    https://github.com/Katorthoma/tools
// @version      0.1.0
// @description  Adds an expand button to Podium Entertainment cover art and opens the direct, non-resized cover image.
// @author       Katorthoma
// @license      MIT
// @homepageURL  https://github.com/Katorthoma/tools/tree/main/userscripts/podium-cover-opener
// @supportURL   https://github.com/Katorthoma/tools/issues
// @updateURL    https://raw.githubusercontent.com/Katorthoma/tools/main/userscripts/podium-cover-opener/Podium-Hi-Res-Cover-Opener.user.js
// @downloadURL  https://raw.githubusercontent.com/Katorthoma/tools/main/userscripts/podium-cover-opener/Podium-Hi-Res-Cover-Opener.user.js
// @match        https://podiumentertainment.com/*
// @match        https://www.podiumentertainment.com/*
// @grant        GM_openInTab
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM.openInTab
// @grant        GM.getValue
// @grant        GM.setValue
// @noframes
// @run-at       document-idle
// ==/UserScript==

(() => {
    'use strict';

    const DEBUG = false;
    const ASSET_HOST = 'assets.podiumentertainment.com';
    const processedImages = new WeakSet();
    const pendingRoots = new Set();
    const openedStateCache = new Map();
    let scanScheduled = false;

    injectStyles();
    scan(document);

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes') {
                queueScan(mutation.target);
                continue;
            }

            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) queueScan(node);
            }
        }
        scheduleScan();
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'srcset']
    });

    function debug(...args) {
        if (DEBUG) console.debug('[Podium Hi-Res Cover Opener]', ...args);
    }

    function queueScan(node) {
        if (!(node instanceof Element)) return;

        if (pendingRoots.size >= 32) {
            pendingRoots.clear();
            pendingRoots.add(document.documentElement);
            return;
        }

        pendingRoots.add(node);
    }

    function scheduleScan() {
        if (scanScheduled) return;
        scanScheduled = true;

        requestAnimationFrame(() => {
            scanScheduled = false;
            const roots = [...pendingRoots];
            pendingRoots.clear();
            for (const root of roots) scan(root);
        });
    }

    function scan(root) {
        if (root.matches?.('img')) enhanceCover(root);
        root.querySelectorAll?.('img').forEach(enhanceCover);
    }

    function enhanceCover(img) {
        if (processedImages.has(img)) return;

        const directUrl = extractDirectCoverUrl(img);
        if (!directUrl) return;

        const host = img.parentElement;
        if (!host) return;

        processedImages.add(img);

        if (host.querySelector(':scope > .podium-hires-cover-button')) return;

        const bestUrl = preferMediumCover(directUrl);
        const coverId = getCoverId(bestUrl);
        const rawName = String(img.alt || '').trim() || 'Podium cover';
        const accessibleName = rawName.length > 60
            ? `${rawName.slice(0, 57).trimEnd()}…`
            : rawName;

        host.classList.add('podium-hires-cover-host');

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'podium-hires-cover-button';
        button.dataset.coverId = coverId;
        button.setAttribute('aria-label', `Open full-size cover for ${accessibleName}`);
        button.title = 'Open full-size cover image';
        button.innerHTML = `${expandIconSvg()}<span class="podium-hires-cover-check" aria-hidden="true">✓</span>`;

        const stopPress = (event) => event.stopPropagation();
        for (const eventName of ['pointerdown', 'mousedown', 'mouseup']) {
            button.addEventListener(eventName, stopPress, true);
        }

        button.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();

            if (!canUseGmOpenInTab()) {
                console.error('[Podium Hi-Res Cover Opener] GM_openInTab is unavailable.');
                return;
            }

            if (!isSafeCoverUrl(bestUrl)) {
                console.error('[Podium Hi-Res Cover Opener] Refusing untrusted cover URL:', bestUrl);
                return;
            }

            debug('Opening cover', bestUrl);

            try {
                await openInBackground(bestUrl);
                await markCoverOpened(coverId);
            } catch (error) {
                console.error('[Podium Hi-Res Cover Opener]', error);
            }
        }, true);

        host.appendChild(button);

        applyOpenedState(button, coverId)
            .catch((error) => debug('Opened-state lookup failed', error));
    }

    function extractDirectCoverUrl(img) {
        const candidates = [
            img.currentSrc,
            img.getAttribute('src'),
            ...extractSrcsetUrls(img.getAttribute('srcset'))
        ].filter(Boolean);

        for (const candidate of candidates) {
            const direct = unwrapNextImageUrl(candidate);
            if (direct && isSafeCoverUrl(direct)) return direct;
        }

        return null;
    }

    function extractSrcsetUrls(srcset) {
        if (!srcset) return [];
        return srcset
            .split(',')
            .map((entry) => entry.trim().split(/\s+/)[0])
            .filter(Boolean);
    }

    function unwrapNextImageUrl(value) {
        try {
            const parsed = new URL(value, location.origin);

            if (parsed.hostname === ASSET_HOST) return parsed.href;

            if (parsed.origin === location.origin && parsed.pathname === '/_next/image') {
                const source = parsed.searchParams.get('url');
                if (!source) return null;
                return new URL(source, location.origin).href;
            }
        } catch {
            return null;
        }

        return null;
    }

    function preferMediumCover(url) {
        try {
            const parsed = new URL(url);
            parsed.pathname = parsed.pathname.replace(
                '/small/direct_cover_art/',
                '/medium/direct_cover_art/'
            );
            return parsed.href;
        } catch {
            return url;
        }
    }

    function isSafeCoverUrl(url) {
        try {
            const parsed = new URL(url);
            return parsed.protocol === 'https:' &&
                parsed.hostname === ASSET_HOST &&
                parsed.pathname.includes('/direct_cover_art/') &&
                /\.(?:jpe?g|png|webp)$/i.test(parsed.pathname);
        } catch {
            return false;
        }
    }

    function getCoverId(url) {
        try {
            const filename = new URL(url).pathname.split('/').pop() || url;
            return filename.replace(/\.[^.]+$/, '');
        } catch {
            return url;
        }
    }

    function canUseGmOpenInTab() {
        return typeof GM_openInTab === 'function' ||
            (typeof GM !== 'undefined' && typeof GM.openInTab === 'function');
    }

    async function openInBackground(url) {
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

        throw new Error('No supported background-tab API is available');
    }

    function openedStorageKey(coverId) {
        return `opened:${coverId}`;
    }

    async function getPrivateValue(key, defaultValue = false) {
        try {
            if (typeof GM_getValue === 'function') return GM_getValue(key, defaultValue);
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

    async function isCoverOpened(coverId) {
        if (openedStateCache.has(coverId)) return openedStateCache.get(coverId);

        const lookup = getPrivateValue(openedStorageKey(coverId), false)
            .then(Boolean);

        openedStateCache.set(coverId, lookup);
        const opened = await lookup;
        if (openedStateCache.get(coverId) !== true) openedStateCache.set(coverId, opened);
        return openedStateCache.get(coverId) === true;
    }

    async function applyOpenedState(button, coverId) {
        if (await isCoverOpened(coverId)) markButtonOpened(button);
    }

    async function markCoverOpened(coverId) {
        openedStateCache.set(coverId, true);
        await setPrivateValue(openedStorageKey(coverId), true);

        const escaped = CSS.escape(coverId);
        document.querySelectorAll(`.podium-hires-cover-button[data-cover-id="${escaped}"]`)
            .forEach(markButtonOpened);
    }

    function markButtonOpened(button) {
        button.classList.add('podium-hires-cover-opened');
        if (!button.title.includes('previously opened')) {
            button.title += ' • previously opened';
        }
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
            .podium-hires-cover-host {
                position: relative !important;
            }

            .podium-hires-cover-button {
                position: absolute;
                top: 6px;
                right: 6px;
                z-index: 2147483000;
                width: 28px;
                height: 28px;
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

            .podium-hires-cover-button:hover {
                opacity: 0.98;
                background: rgba(255, 255, 255, 0.94);
                box-shadow: 0 2px 5px rgba(0, 0, 0, 0.28);
            }

            .podium-hires-cover-button:focus-visible {
                opacity: 1;
                outline: 2px solid #7a66f0;
                outline-offset: 1px;
            }

            .podium-hires-cover-button svg {
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

            .podium-hires-cover-button svg path {
                vector-effect: non-scaling-stroke;
            }

            .podium-hires-cover-check {
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

            .podium-hires-cover-opened .podium-hires-cover-check {
                opacity: 1;
                transform: scale(1);
            }

            .podium-hires-cover-opened {
                border-color: rgba(28, 128, 52, 0.55);
            }

            @media (max-width: 600px) {
                .podium-hires-cover-button {
                    width: 25px;
                    height: 25px;
                    top: 5px;
                    right: 5px;
                }
            }
        `;
        document.head.appendChild(style);
    }
})();
