// suggestions.js — Sección "Mejoras" para que el equipo sugiera ideas
window.Views = window.Views || {};

(function () {
    const MAX_TITLE = 80;
    const MAX_DESC = 500;

    function timeAgo(isoStr) {
        if (!isoStr) return '';
        const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
        if (diff < 60) return 'hace un momento';
        if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
        if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
        const d = Math.floor(diff / 86400);
        return d === 1 ? 'ayer' : `hace ${d} días`;
    }

    function nombreDesdeEmail(email) {
        if (!email) return '—';
        const name = email.split('@')[0].replace(/[._]/g, ' ');
        return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    const STATUS_CFG = {
        pendiente:  { label: 'Enviada',     icon: 'ph-clock',       color: '#d97706', bg: 'rgba(217,119,6,0.12)' },
        vista:      { label: 'Vista',       icon: 'ph-eye',         color: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
        en_proceso: { label: 'En proceso',  icon: 'ph-gear',        color: '#7c3aed', bg: 'rgba(124,58,237,0.12)' },
        implementada: { label: 'Implementada', icon: 'ph-check-circle', color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
        descartada: { label: 'Descartada',  icon: 'ph-x-circle',    color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
    };

    async function render(container) {
        const supabase = window.SyncV2?.client;
        const tenantId = window.Auth?.getTenantId();
        const userId = window.Auth?.session?.user?.id;
        const userEmail = window.Auth?.session?.user?.email || '';
        const isEmp = window._isEmployee;

        if (!supabase || !tenantId) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:40px;">Sin conexión a la nube.</p>';
            return;
        }

        // Cargar sugerencias
        let suggestions = [];
        try {
            let query = supabase.from('suggestions')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false })
                .limit(50);

            // Employee solo ve las suyas (reasignar — .eq devuelve nuevo objeto)
            if (isEmp) query = query.eq('user_id', userId);

            const { data, error } = await query;
            if (error) throw error;
            suggestions = data || [];
        } catch (e) {
            console.error('[suggestions] Error cargando:', e);
        }

        const listHTML = suggestions.length ? suggestions.map(s => {
            const st = STATUS_CFG[s.status] || STATUS_CFG.pendiente;
            return `
            <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:14px; padding:16px; margin-bottom:12px;">
                <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
                    <span style="font-weight:700; font-size:0.95rem; color:var(--text-primary); word-break:break-word;">${window.escapeHTML ? window.escapeHTML(s.title) : s.title}</span>
                    <span style="display:inline-flex; align-items:center; gap:4px; background:${st.bg}; color:${st.color}; border-radius:20px; padding:3px 10px; font-size:0.75rem; font-weight:700; white-space:nowrap;">
                        <i class="ph ${st.icon}" style="font-size:0.85rem;"></i> ${st.label}
                    </span>
                </div>
                ${s.description ? `<p style="margin:0 0 8px; font-size:0.85rem; color:var(--text-muted); word-break:break-word; white-space:pre-line;">${window.escapeHTML ? window.escapeHTML(s.description) : s.description}</p>` : ''}
                <div style="display:flex; align-items:center; gap:12px; font-size:0.75rem; color:var(--text-muted);">
                    ${!isEmp ? `<span>${nombreDesdeEmail(s.user_email)}</span>` : ''}
                    <span>${timeAgo(s.created_at)}</span>
                </div>
                ${s.admin_response ? `
                <div style="margin-top:10px; padding:10px 12px; background:rgba(37,99,235,0.06); border-left:3px solid #3b82f6; border-radius:0 8px 8px 0;">
                    <div style="font-size:0.75rem; font-weight:700; color:#3b82f6; margin-bottom:4px;">Respuesta del admin</div>
                    <p style="margin:0; font-size:0.85rem; color:var(--text-primary); word-break:break-word;">${window.escapeHTML ? window.escapeHTML(s.admin_response) : s.admin_response}</p>
                </div>` : ''}
            </div>`;
        }).join('') : `
            <div style="text-align:center; padding:40px 20px;">
                <i class="ph ph-lightbulb" style="font-size:3rem; color:var(--text-muted); opacity:0.4;"></i>
                <p style="color:var(--text-muted); margin:12px 0 0; font-size:0.9rem;">Aún no hay sugerencias.<br>¡Sé la primera en proponer una mejora!</p>
            </div>`;

        container.innerHTML = `
            <style>
                .sug-form-card { background:var(--bg-card); border:1px solid var(--border); border-radius:16px; padding:20px; margin-bottom:24px; }
                .sug-input { width:100%; padding:10px 12px; background:var(--bg-input, var(--bg-secondary)); border:1px solid var(--border); border-radius:10px; color:var(--text-primary); font:inherit; font-size:0.9rem; box-sizing:border-box; transition:border-color 0.2s; }
                .sug-input:focus { outline:none; border-color:var(--primary); box-shadow:0 0 0 2px rgba(76,141,255,0.15); }
                .sug-textarea { resize:vertical; min-height:80px; max-height:200px; }
                .sug-btn { width:100%; padding:12px; background:linear-gradient(135deg, #8b5cf6, #6d28d9); color:#fff; border:none; border-radius:12px; font:inherit; font-weight:700; font-size:0.92rem; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; transition:opacity 0.2s; }
                .sug-btn:disabled { opacity:0.5; cursor:not-allowed; }
                .sug-btn:active:not(:disabled) { transform:scale(0.98); }
                .sug-counter { font-size:0.72rem; color:var(--text-muted); text-align:right; margin-top:4px; }
            </style>
            <div style="max-width:600px; margin:0 auto; padding:0 16px 32px;">
                <!-- Header -->
                <div style="text-align:center; margin-bottom:20px;">
                    <div style="display:inline-flex; align-items:center; justify-content:center; width:48px; height:48px; background:linear-gradient(135deg, #8b5cf624, #6d28d924); border-radius:14px; margin-bottom:8px;">
                        <i class="ph-fill ph-lightbulb" style="font-size:1.5rem; color:#8b5cf6;"></i>
                    </div>
                    <h2 style="margin:0; font-size:1.15rem; color:var(--text-primary);">Ideas y Mejoras</h2>
                    <p style="margin:6px 0 0; font-size:0.82rem; color:var(--text-muted);">¿Qué te gustaría que la app pudiera hacer?</p>
                </div>

                <!-- Formulario -->
                <div class="sug-form-card">
                    <input type="text" id="sug-title" class="sug-input" placeholder="Ej: Poder ver el historial de precios" maxlength="${MAX_TITLE}" style="margin-bottom:10px;">
                    <textarea id="sug-desc" class="sug-input sug-textarea" placeholder="Explica tu idea con más detalle (opcional)..." maxlength="${MAX_DESC}"></textarea>
                    <div class="sug-counter"><span id="sug-desc-count">0</span>/${MAX_DESC}</div>
                    <button id="btn-send-sug" class="sug-btn" style="margin-top:12px;">
                        <i class="ph ph-paper-plane-tilt"></i> Enviar sugerencia
                    </button>
                </div>

                <!-- Lista -->
                <div style="margin-bottom:8px;">
                    <span style="font-size:0.78rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">
                        ${isEmp ? 'Mis sugerencias' : 'Todas las sugerencias'} (${suggestions.length})
                    </span>
                </div>
                ${listHTML}
            </div>
        `;

        // ── Event listeners ──
        const descInput = container.querySelector('#sug-desc');
        const counter = container.querySelector('#sug-desc-count');
        if (descInput && counter) {
            descInput.addEventListener('input', () => {
                counter.textContent = descInput.value.length;
            });
        }

        const btnSend = container.querySelector('#btn-send-sug');
        if (btnSend) {
            btnSend.addEventListener('click', async () => {
                const title = container.querySelector('#sug-title')?.value.trim();
                if (!title) {
                    window.showToast?.('Escribe tu idea');
                    return;
                }
                const desc = descInput?.value.trim() || null;

                btnSend.disabled = true;
                btnSend.innerHTML = '<i class="ph ph-spinner" style="animation:spin 1s linear infinite;"></i> Enviando...';

                try {
                    const { error } = await supabase.from('suggestions').insert({
                        tenant_id: tenantId,
                        user_id: userId,
                        user_email: userEmail,
                        title: title.slice(0, MAX_TITLE),
                        description: desc ? desc.slice(0, MAX_DESC) : null,
                        status: 'pendiente'
                    });
                    if (error) throw error;
                    window.showToast?.('¡Sugerencia enviada! Gracias');
                    // Re-render
                    render(container);
                } catch (e) {
                    console.error('[suggestions] Error enviando:', e);
                    window.showToast?.('No se pudo enviar, intenta de nuevo');
                    btnSend.disabled = false;
                    btnSend.innerHTML = '<i class="ph ph-paper-plane-tilt"></i> Enviar sugerencia';
                }
            });
        }
    }

    window.Views.suggestions = function (container) {
        render(container);
    };
})();
