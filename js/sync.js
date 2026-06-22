// ──────────────────────────────────────────────────────────────────
// Sync UI Helpers — showToast + updateIndicator
// La lógica de sincronización real vive en js/sync/sync-v2.js
// Este archivo solo mantiene las funciones de UI que el resto del
// código referencia como window.Sync.showToast / updateIndicator.
// ──────────────────────────────────────────────────────────────────
window.Sync = {
    _toastQueue: [],
    _isProcessingToasts: false,

    showToast: function (message, type = 'info') {
        this._toastQueue.push({ message, type });
        if (!this._isProcessingToasts) {
            this._processToastQueue();
        }
    },

    _processToastQueue: async function () {
        if (this._toastQueue.length === 0) {
            this._isProcessingToasts = false;
            return;
        }

        this._isProcessingToasts = true;

        // Si hay muchas notificaciones, agruparlas
        if (this._toastQueue.length > 3) {
            const types = new Set(this._toastQueue.map(t => t.type));
            const primaryType = types.has('success') ? 'success' : 'info';
            const count = this._toastQueue.length;
            this._toastQueue = [{ message: `${count} actualizaciones`, type: primaryType }];
        }

        const { message, type } = this._toastQueue.shift();

        const toast = document.createElement('div');
        toast.className = `sync-toast toast-${type}`;
        const icon = document.createElement('i');
        icon.className = `ph ${type === 'success' ? 'ph-check-circle' : type === 'error' ? 'ph-warning-circle' : 'ph-info'}`;
        icon.style.fontSize = '1.2rem';
        const span = document.createElement('span');
        span.textContent = message;
        const div = document.createElement('div');
        div.className = 'toast-content';
        div.style.cssText = 'display:flex; align-items:center; gap:8px;';
        div.appendChild(icon);
        div.appendChild(span);
        toast.appendChild(div);
        document.body.appendChild(toast);

        await new Promise(r => setTimeout(r, 3000));

        toast.classList.add('fading');
        setTimeout(() => toast.remove(), 500);

        setTimeout(() => this._processToastQueue(), 200);
    },

    updateIndicator: (status, errorMsg = '') => {
        const el = document.getElementById('sync-indicator');
        const text = document.getElementById('sync-text');
        if (!el || !text) return;

        el.style.cursor = 'pointer';

        switch (status) {
            case 'syncing':
                el.style.color = 'var(--accent)';
                el.innerHTML = '<i class="ph ph-arrows-clockwise ph-spin"></i> <span id="sync-text">Sincronizando...</span>';
                el.title = 'Buscando cambios en la red...';
                break;
            case 'realtime':
                el.style.color = '#8b5cf6';
                el.innerHTML = '<i class="ph ph-broadcast"></i> <span id="sync-text">Tiempo Real</span>';
                el.title = 'Conectado instantáneamente con otros dispositivos. Haz clic para refrescar todo.';
                break;
            case 'connected':
                el.style.color = '#10b981';
                el.innerHTML = `<i class="ph ph-cloud-check"></i> <span id="sync-text">${errorMsg || 'En Línea'}</span>`;
                el.title = "Conectado. Haz clic para forzar sincronización manual.";
                break;
            case 'error':
                el.style.color = '#ef4444';
                el.innerHTML = '<i class="ph ph-cloud-slash"></i> <span id="sync-text">Error Nube</span>';
                el.title = errorMsg + " - Haz clic para intentar reconectar.";
                break;
            case 'off':
            default:
                el.style.color = 'var(--text-muted)';
                el.innerHTML = '<i class="ph ph-cloud-slash"></i> <span id="sync-text">Solo Local</span>';
                el.title = "Trabajando en modo local. Haz clic para intentar conectar.";
                break;
        }
    }
};
