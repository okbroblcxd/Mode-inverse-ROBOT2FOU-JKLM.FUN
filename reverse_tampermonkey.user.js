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
    let selfPeerId = null; // notre peerId dans la partie (lu sur le WebSocket)
    // Le chat (lecture des défis, overlay, envoi de READY) n'est géré que par la
    // frame du HAUT, pour éviter les doublons quand le script tourne aussi dans
    // l'iframe du jeu. L'inversion WebSocket, elle, s'applique dans toutes les frames.
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

        // Capture notre selfPeerId dans les trames entrantes "setup".
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
                // Le peerId vient du socket du JEU (souvent dans l'iframe), mais la
                // preuve READY part du chat (frame du haut) : on le partage.
                try { if (window.top && window.top !== window) window.top.postMessage({ __r2fPeer: true, peerId: selfPeerId }, '*'); } catch (_) {}
            }
        }

        window.WebSocket.prototype.send = function (data) {
            if (reverseActive) {
                try { data = maybeReverseFrame(data); } catch (_) {}
            }
            return NativeSend.call(this, data);
        };

        // On écoute les messages entrants de CHAQUE WebSocket créé.
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
            // Une autre frame (le jeu) nous communique notre peerId.
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
            `<div style="font-weight:700;color:#a29bfe">🔄 Mode Reverse</div>` +
            `<div style="margin:6px 0">Code à confirmer :</div>` +
            `<div style="font-size:26px;font-weight:800;letter-spacing:3px;color:#00d2a8">${code}</div>` +
            `<div style="margin-top:6px;opacity:.8">Tape simplement ce code<br>dans le chat pour activer.</div>`;
        o.style.display = 'block';
        clearTimeout(o._hideT);
        o._hideT = setTimeout(() => { if (overlay) overlay.style.display = 'none'; }, 60000);
    }

    function hideOverlay() { if (overlay) overlay.style.display = 'none'; }

    // Envoie la preuve REVERSE_READY UNE seule fois par nonce. Le code dépend de
    // NOTRE peerId (unique par joueur) : impossible à copier sur un autre.
    // Si le peerId n'est pas encore connu, on réessaie brièvement.
    let readySentForNonce = null;
    let iAmActivator = false; // ce navigateur a tapé le code -> déjà confirmé par le bot
    function sendReadyOnce(nonce, attempt) {
        attempt = attempt || 0;
        if (!nonce || readySentForNonce === nonce) return;
        // L'activateur (celui qui a tapé le code) est déjà confirmé par le bot :
        // inutile de polluer le chat avec un REVERSE_READY redondant.
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

    // L'inversion ne s'active QUE lorsque le joueur tape lui-même le code à 4
    // chiffres affiché dans l'overlay (exigence : pas d'activation automatique).
    // On surveille le champ de chat : si l'utilisateur envoie le code attendu,
    // on active l'inversion immédiatement de son côté (le bot confirme en
    // parallèle via REVERSE_ACTIVE).
    function watchSelfCodeEntry() {
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' || !pendingCode) return;
            const el = e.target;
            if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) return;
            const v = String(el.value || '').trim();
            if (v === pendingCode) {
                iAmActivator = true; // on a tapé le code -> le bot nous confirme déjà
                broadcastState(true);
                pendingCode = null;
                hideOverlay();
            }
        }, true);
    }

    function onReady() {
        // Seule la frame du haut gère le chat/overlay (évite les doublons READY).
        if (IS_TOP) {
            startChatObserver();
            watchSelfCodeEntry();
        } else {
            // L'iframe du jeu demande l'état courant au parent au démarrage.
            askParentState();
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onReady);
    } else {
        onReady();
    }
})();
