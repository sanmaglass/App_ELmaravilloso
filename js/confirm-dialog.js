// confirm-dialog.js — Reemplaza confirm() nativo con modal HTML propio
// Uso: const result = await window.showConfirmDialog('Título', 'Mensaje');
// Retorna: true si confirma, false si cancela

window.showConfirmDialog = function (title, message) {
    return new Promise((resolve) => {
        // Remover cualquier dialog anterior
        const prev = document.getElementById('confirm-dialog-overlay');
        if (prev) prev.remove();

        const overlay = document.createElement('div');
        overlay.id = 'confirm-dialog-overlay';
        overlay.style.cssText = [
            'position:fixed', 'inset:0', 'z-index:99999',
            'background:rgba(0,0,0,0.55)', 'backdrop-filter:blur(4px)',
            'display:flex', 'align-items:center', 'justify-content:center',
            'padding:16px', 'padding-bottom:max(16px, env(safe-area-inset-bottom))'
        ].join(';');

        // Detectar dark mode
        const isDark = document.body.classList.contains('dark-mode');
        const bgCard = isDark ? '#161b22' : '#fff';
        const borderColor = isDark ? 'rgba(240,246,252,0.10)' : 'rgba(0,0,0,0.08)';
        const textPrimary = isDark ? '#f0f6fc' : '#0f172a';
        const textMuted = isDark ? '#8b949e' : '#64748b';

        overlay.innerHTML = `
            <div id="confirm-dialog-box" role="alertdialog" aria-modal="true"
                 aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-msg"
                 style="
                    background:${bgCard};
                    border:1px solid ${borderColor};
                    border-radius:20px;
                    box-shadow:0 24px 64px rgba(0,0,0,0.35);
                    max-width:420px;
                    width:100%;
                    padding:28px 24px 20px;
                    animation:confirmDialogIn 0.18s ease;
                ">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                    <div style="
                        width:40px;height:40px;border-radius:12px;
                        background:rgba(220,38,38,0.10);
                        display:flex;align-items:center;justify-content:center;
                        flex-shrink:0;
                    ">
                        <i class="ph ph-warning" style="font-size:1.3rem;color:#dc2626;"></i>
                    </div>
                    <h3 id="confirm-dialog-title" style="
                        margin:0;font-size:1rem;font-weight:700;
                        color:${textPrimary};line-height:1.3;
                    ">${title}</h3>
                </div>
                <p id="confirm-dialog-msg" style="
                    margin:0 0 20px 0;font-size:0.9rem;
                    color:${textMuted};line-height:1.5;
                    white-space:pre-line;
                ">${message}</p>
                <div style="display:flex;gap:10px;justify-content:flex-end;">
                    <button id="confirm-dialog-cancel" style="
                        padding:9px 20px;border-radius:10px;font-size:0.88rem;font-weight:600;
                        border:1px solid ${borderColor};background:transparent;
                        color:${textMuted};cursor:pointer;min-height:44px;
                        transition:background 0.15s;
                    ">Cancelar</button>
                    <button id="confirm-dialog-ok" style="
                        padding:9px 20px;border-radius:10px;font-size:0.88rem;font-weight:600;
                        border:none;background:#dc2626;color:#fff;cursor:pointer;min-height:44px;
                        transition:background 0.15s;
                    ">Confirmar</button>
                </div>
            </div>
            <style>
                @keyframes confirmDialogIn {
                    from { opacity:0; transform:scale(0.93) translateY(8px); }
                    to   { opacity:1; transform:scale(1) translateY(0); }
                }
            </style>
        `;

        document.body.appendChild(overlay);

        const btnOk     = document.getElementById('confirm-dialog-ok');
        const btnCancel = document.getElementById('confirm-dialog-cancel');

        function close(result) {
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.15s';
            setTimeout(() => overlay.remove(), 150);
            resolve(result);
        }

        btnOk.addEventListener('click', () => close(true));
        btnCancel.addEventListener('click', () => close(false));

        // ESC para cancelar
        function onKey(e) {
            if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); close(false); }
            if (e.key === 'Enter')  { document.removeEventListener('keydown', onKey); close(true); }
        }
        document.addEventListener('keydown', onKey);

        // Focus al botón confirmar
        setTimeout(() => btnOk.focus(), 50);
    });
};

// Alias corto para toast de error (complemento a showToast de sync.js)
window.showToast = function(message, type = 'info') {
    if (window.Sync && window.Sync.showToast) {
        window.Sync.showToast(message, type);
    } else {
        // Fallback mínimo si Sync aún no cargó
        console.log('[toast]', type, message);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// TAREA 2c: Forms UX helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Debounce utility
 * Uso: const handler = window.debounce(() => { ... }, 250);
 */
window.debounce = function(fn, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
};

/**
 * Auto-focus primer input visible en el modal cuando se abre.
 * También habilita Enter para submit en formularios de modales.
 * Se instala mediante MutationObserver en #modal-container.
 */
(function installModalUX() {
    function setupModalFocusAndEnter(container) {
        // Autofocus al primer input/select/textarea visible (excluye hidden y read-only)
        setTimeout(() => {
            const firstInput = container.querySelector(
                'input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([readonly]):not([disabled]),' +
                'select:not([disabled]),' +
                'textarea:not([readonly]):not([disabled])'
            );
            if (firstInput) {
                firstInput.focus();
            }
        }, 80);

        // Enter para submit: busca botón de guardar principal en el modal
        container.addEventListener('keydown', function onModalKey(e) {
            if (e.key !== 'Enter') return;
            // No disparar si el foco está en un textarea o select
            const tag = document.activeElement?.tagName;
            if (tag === 'TEXTAREA' || tag === 'SELECT') return;
            // No disparar si hay un confirm-dialog abierto (tiene su propio handler)
            if (document.getElementById('confirm-dialog-overlay')) return;
            // Buscar el botón de submit principal (primera clase btn-primary en el modal)
            const submitBtn = container.querySelector(
                '.modal .btn-primary:not([disabled]), .modal button[type="submit"]:not([disabled])'
            );
            if (submitBtn) {
                e.preventDefault();
                submitBtn.click();
            }
        });
    }

    // Observar cambios en #modal-container
    function waitForModalContainer() {
        const container = document.getElementById('modal-container');
        if (!container) {
            // El DOM puede no estar listo aún
            document.addEventListener('DOMContentLoaded', () => {
                const mc = document.getElementById('modal-container');
                if (mc) observeContainer(mc);
            });
            return;
        }
        observeContainer(container);
    }

    function observeContainer(container) {
        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                // Detecta cuando se elimina la clase 'hidden' (modal se abre)
                // o cuando se inyecta HTML (innerHTML = ...)
                if (m.type === 'childList' && m.addedNodes.length > 0) {
                    // El container acaba de recibir nuevo HTML
                    if (!container.classList.contains('hidden')) {
                        setupModalFocusAndEnter(container);
                    }
                }
                if (m.type === 'attributes' && m.attributeName === 'class') {
                    if (!container.classList.contains('hidden')) {
                        setupModalFocusAndEnter(container);
                    }
                }
            }
        });
        observer.observe(container, {
            childList: true,
            subtree: false,
            attributes: true,
            attributeFilter: ['class']
        });
    }

    // Esperar a que el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForModalContainer);
    } else {
        waitForModalContainer();
    }
})();

/**
 * Instala debounce en inputs de búsqueda identificados por los IDs conocidos.
 * Se llama automáticamente después de que las vistas se registran (en DOMContentLoaded).
 */
(function installSearchDebounce() {
    // IDs de campos de búsqueda conocidos en las vistas
    const SEARCH_IDS = [
        'supplier-search',
        'daily-search',
        'expense-search',
        'credits-search',
        'abc-filter-search',
    ];

    function applyDebounce(input) {
        if (!input || input._debounced) return;
        input._debounced = true;
        const originalHandler = input.oninput;
        // Clonar listeners existentes no es posible directamente,
        // pero podemos reemplazar con un MutationObserver en DOMContentLoaded
        // La técnica: reemplazar con un dispatchEvent debounced
        let timer;
        const nativeInput = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        input.addEventListener('input', (e) => {
            // Prevenir propagación inmediata — sólo disparar el evento de app después del debounce
        }, { capture: true });
    }

    // Mejor enfoque: parchear addEventListener globalmente sería invasivo.
    // Usamos un approach más quirúrgico: observar el DOM y cuando aparecen los search inputs
    // reemplazar su listener de 'input' por uno debounced.
    // Como las vistas son función-por-función, aplicamos debounce en la vista directamente.
    // Ver debounce aplicado en cada vista individualmente (ver views/suppliers.js, daily_sales.js, etc.)
})();
