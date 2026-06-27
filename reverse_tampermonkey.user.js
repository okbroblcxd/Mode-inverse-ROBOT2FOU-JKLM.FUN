// ==UserScript==
// @name         ROBOT2FOU – Mode Reverse (JKLM BombParty)
// @namespace    robot2fou.reverse
// @version      2.1.0
// @description  Inverse les mots envoyés au jeu (tu tapes EMMOP -> le jeu reçoit POMME) et confirme le mode reverse du bot via un code à 4 chiffres affiché dans un overlay (en bas à gauche).
// @match        *://jklm.fun/*
// @match        *://*.jklm.fun/*
// @run-at       document-start
// @all-frames   true
// @grant        none
// ==/UserScript==

/* =========================================================================
 *  COMMENT LE BOT ET LE SCRIPT COMMUNIQUENT (Explication simple)
 * =========================================================================
 * Ce script permet à votre navigateur de dialoguer en toute sécurité avec
 * le bot ROBOT2FOU sur JKLM.FUN sans que les joueurs n'aient besoin de
 * connaissances techniques. Voici comment ils interagissent en coulisses :
 *
 * 1. L'Appel du bot :
 *    Quand un modérateur tape `.mode reverse`, le bot envoie dans le chat un
 *    message technique invisible pour les profanes (ex: `REVERSE_CHALLENGE`).
 *
 * 2. La Détection par le script :
 *    Le script surveille en permanence le chat. Dès qu'il voit l'appel du bot,
 *    il utilise une formule mathématique secrète (partagée avec le bot) pour
 *    générer un code à 4 chiffres. Il affiche alors ce code sur votre écran
 *    dans un petit encadré (l'overlay).
 *
 * 3. L'Activation par le joueur :
 *    En recopiant et en envoyant ce code à 4 chiffres dans le chat, le bot
 *    valide instantanément que vous possédez le script. Il officialise
 *    l'inversion en envoyant le signal `REVERSE_ACTIVE`.
 *
 * 4. La Vérification automatique des autres joueurs :
 *    Dès que la room passe en Reverse, le script de chaque joueur présent
 *    répond automatiquement en arrière-plan au bot par un code de présence
 *    (`REVERSE_READY`). Le bot sait ainsi précisément qui a installé le script
 *    et expulsera automatiquement les joueurs non équipés avant la partie.
 * ========================================================================= */

(function () {
    'use strict';

    const REVERSE_SECRET = 'R2F-reverse-2024';

    const TOK_CHALLENGE = 'REVERSE_CHALLENGE';
    const TOK_ACTIVE    = 'REVERSE_ACTIVE';
    const TOK_READY     = 'REVERSE_READY';
    const TOK_OFF       = 'REVERSE_OFF';

    let pendingCode = null;

    function challengeCode(secret, nonce) {
        const str = `${secret}:${nonce}`;
        let h = 2166136261 >>> 0;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 16777619) >>> 0;
        }
        return String(h % 10000).padStart(4, '0');
    }

    function reverseString(s) {
        return Array.from(String(s || '')).reverse().join('');
    }

    let reverseActive = false;
    let selfPeerId = null;
    const IS_TOP = (function () { try { return window.top === window.self; } catch (_) { return true; } })();

    (function patchWebSocket() {
        const NativeSend = window.WebSocket && window.WebSocket.prototype && window.WebSocket.prototype.send;
        if (!NativeSend) return;

        function maybeReverseFrame(data) {
            if (typeof data !== 'string') return data;
            const m = data.match(/^(42[^\[]*)(\[.*\])$/s);
            if (!m) return data;
            let arr;
            try { arr = JSON.parse(m[2]); } catch (_) { return data; }
            if (!Array.isArray(arr) || arr[0] !== 'setWord' || typeof arr[1] !== 'string') return data;

            arr[1] = reverseString(arr[1]);
            return m[1] + JSON.stringify(arr);
        }

        function captureSelfPeerId(data) {
            if (typeof data !== 'string' || selfPeerId !== null) return;
            if (data.indexOf('selfPeerId') === -1) return;
            const m = data.match(/^42[^\[]*(\[.*\])$/s);
            if (!m) return;
            let arr;
            try { arr = JSON.parse(m[1]); } catch (_) { return; }
            if (Array.isArray(arr) && arr[0] === 'setup' && arr[1] && arr[1].selfPeerId != null) {
                selfPeerId = Number(arr[1].selfPeerId);
                try { console.log('[ROBOT2FOU Reverse] selfPeerId =', selfPeerId); } catch (_) {}
                try { if (window.top && window.top !== window) window.top.postMessage({ __r2fPeer: true, peerId: selfPeerId }, '*'); } catch (_) {}
            }
        }

        window.WebSocket.prototype.send = function (data) {
            if (reverseActive) {
                try { data = maybeReverseFrame(data); } catch (_) {}
            }
            return NativeSend.call(this, data);
        };

        const NativeAddEL = window.WebSocket.prototype.addEventListener;
        function hookIncoming(ws) {
            try {
                ws.addEventListener('message', (ev) => {
                    try { captureSelfPeerId(ev.data); } catch (_) {}
                });
            } catch (_) {}
        }
        const OrigWS = window.WebSocket;
        function PatchedWS(...a) {
            const ws = new OrigWS(...a);
            hookIncoming(ws);
            return ws;
        }
        PatchedWS.prototype = OrigWS.prototype;
        PatchedWS.CONNECTING = OrigWS.CONNECTING; PatchedWS.OPEN = OrigWS.OPEN;
        PatchedWS.CLOSING = OrigWS.CLOSING; PatchedWS.CLOSED = OrigWS.CLOSED;
        try { window.WebSocket = PatchedWS; } catch (_) {}

        try { console.log('[ROBOT2FOU Reverse] WebSocket patché dans', location.href); } catch (_) {}
    })();

    function applyState(active) { reverseActive = !!active; }

    function broadcastState(active) {
        applyState(active);
        const msg = { __r2fReverse: true, active: !!active };

        try {
            document.querySelectorAll('iframe').forEach(f => {
                try { f.contentWindow && f.contentWindow.postMessage(msg, '*'); } catch (_) {}
            });
        } catch (_) {}

        try { if (window.parent && window.parent !== window) window.parent.postMessage(msg, '*'); } catch (_) {}
    }

    window.addEventListener('message', (ev) => {
        const d = ev.data;
        if (!d || typeof d !== 'object') return;
        if (d.__r2fReverse) {
            applyState(d.active);
            try {
                document.querySelectorAll('iframe').forEach(f => {
                    try { if (f.contentWindow && f.contentWindow !== ev.source) f.contentWindow.postMessage(d, '*'); } catch (_) {}
                });
            } catch (_) {}
        } else if (d.__r2fAsk) {
            try { ev.source && ev.source.postMessage({ __r2fReverse: true, active: reverseActive }, '*'); } catch (_) {}
        } else if (d.__r2fPeer && d.peerId != null) {
            if (selfPeerId === null) selfPeerId = Number(d.peerId);
        }
    });

    function askParentState() {
        try { if (window.parent && window.parent !== window) window.parent.postMessage({ __r2fAsk: true }, '*'); } catch (_) {}
    }

    function setNativeValue(el, value) {
        const proto = Object.getPrototypeOf(el);
        const desc = Object.getOwnPropertyDescriptor(proto, 'value') ||
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value') ||
            Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
        if (desc && desc.set) desc.set.call(el, value);
        else el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    function findChatInput() {
        const sels = [
            '.chat textarea', '.chat input[type="text"]', '.chat input',
            '[class*="chat"] textarea', '[class*="chat"] input[type="text"]',
            'textarea',
        ];
        for (const sel of sels) {
            const el = document.querySelector(sel);
            if (el && el.offsetParent !== null) return el;
        }
        return null;
    }
    function sendChat(text) {
        const input = findChatInput();
        if (!input) return false;
        input.focus();
        setNativeValue(input, text);
        const opts = { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 };
        input.dispatchEvent(new KeyboardEvent('keydown', opts));
        input.dispatchEvent(new KeyboardEvent('keypress', opts));
        input.dispatchEvent(new KeyboardEvent('keyup', opts));
        const form = input.closest && input.closest('form');
        if (form) { try { form.requestSubmit ? form.requestSubmit() : form.submit(); } catch (_) {} }
        return true;
    }
    let overlay = null;
    function ensureOverlay() {
        if (overlay) return overlay;
        overlay = document.createElement('div');
        overlay.id = 'r2f-reverse-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', zIndex: 2147483647, left: '14px', bottom: '14px',
            background: 'rgba(20,20,28,0.96)', color: '#fff', padding: '12px 16px',
            borderRadius: '10px', font: '14px/1.4 system-ui, sans-serif',
            boxShadow: '0 4px 18px rgba(0,0,0,0.5)', border: '1px solid #6c5ce7',
            maxWidth: '260px',
        });
        (document.body || document.documentElement).appendChild(overlay);
        return overlay;
    }
    function showOverlay(code) {
        const o = ensureOverlay();
        o.innerHTML =
            `<div style="font-weight:bold;margin-bottom:6px;color:#a29bfe;display:flex;align-items:center;gap:6px;">` +
            `🔄 Mode Reverse</div>` +
            `<div style="font-size:13px;color:#dfe6e9;margin-bottom:8px;">Code à confirmer : ` +
            `<span style="background:#6c5ce7;color:#fff;padding:2px 6px;border-radius:4px;font-weight:bold;font-family:monospace;font-size:15px;">` +
            `${code}</span></div>` +
            `<div style="font-size:11px;color:#b2bec3;line-height:1.2;">Tape simplement ce code ` +
            `dans le chat pour activer.</div>`;
        o.style.display = 'block';
        clearTimeout(o._hideT);
        o._hideT = setTimeout(() => { if (overlay) overlay.style.display = 'none'; }, 60000);
    }

    function hideOverlay() { if (overlay) overlay.style.display = 'none'; }

    let readySentForNonce = null;
    let iAmActivator = false;
    function sendReadyOnce(nonce, attempt) {
        attempt = attempt || 0;
        if (!nonce || readySentForNonce === nonce) return;
        if (iAmActivator) { readySentForNonce = nonce; return; }
        if (selfPeerId === null) {
            if (attempt < 25) setTimeout(() => sendReadyOnce(nonce, attempt + 1), 400);
            return;
        }
        readySentForNonce = nonce;
        const ready = challengeCode(REVERSE_SECRET, `${nonce}:${selfPeerId}`);
        setTimeout(() => sendChat(`${TOK_READY} ${ready}`), 300 + Math.random() * 500);
    }

    let lastHandled = '';
    function handleChatText(text) {
        const t = String(text || '').trim();
        if (!t || t === lastHandled) return;

        let m = t.match(new RegExp(`${TOK_CHALLENGE}\\s+(\\S+)`));
        if (m) {
            lastHandled = t;
            pendingCode = challengeCode(REVERSE_SECRET, m[1]);
            showOverlay(pendingCode);
            return;
        }

        m = t.match(new RegExp(`${TOK_ACTIVE}\\s+(\\S+)`));
        if (m) {
            lastHandled = t;
            const nonce = m[1];
            broadcastState(true);
            pendingCode = null;
            hideOverlay();
            sendReadyOnce(nonce);
            return;
        }

        if (t.includes(TOK_OFF)) {
            lastHandled = t;
            broadcastState(false);
            pendingCode = null;
            hideOverlay();
            return;
        }
    }

    function startChatObserver() {
        if (!document.body) return;
        const obs = new MutationObserver((muts) => {
            for (const mut of muts) {
                for (const node of mut.addedNodes) {
                    const txt = (node && node.textContent) || '';
                    if (txt.includes(TOK_CHALLENGE) || txt.includes(TOK_ACTIVE) || txt.includes(TOK_OFF)) {
                        txt.split(/\n/).forEach(line => {
                            if (line.includes(TOK_CHALLENGE) || line.includes(TOK_ACTIVE) || line.includes(TOK_OFF)) handleChatText(line);
                        });
                    }
                }
            }
        });
        obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    }

    function watchSelfCodeEntry() {
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' || !pendingCode) return;
            const el = e.target;
            if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) return;
            const v = String(el.value || '').trim();
            if (v === pendingCode) {
                iAmActivator = true;
                broadcastState(true);
                pendingCode = null;
                hideOverlay();
            }
        }, true);
    }

    function onReady() {
        if (IS_TOP) {
            startChatObserver();
            watchSelfCodeEntry();
        } else {
            askParentState();
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onReady);
    } else {
        onReady();
    }
})();
