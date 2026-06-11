// ──────────────────────────────────────────────────────────────
// PushSubscribe — Registra SW + suscribe a Push API + guarda en Supabase
// Requiere: window.Auth (para user_id), AppConfig, DeviceId
// ──────────────────────────────────────────────────────────────

window.PushSubscribe = {
    // VAPID public key (generada 2026-05-14)
    VAPID_PUBLIC_KEY: 'BMbsRGjcT_5ZY4MS1efA8SPoxqvbMeuVM6GfaKNCzi3vfZ8YzPZ8HxG0wHxGlP-nzwA9bTlBuP7tAXPawFSEvuQ',

    _registration: null,
    _subscription: null,

    // ── Inicializar: registrar SW + suscribir ───────────────
    async init() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('[Push] Navegador no soporta Push API');
            return false;
        }

        try {
            // Registrar Service Worker
            this._registration = await navigator.serviceWorker.register(`./service-worker.js?v=${window.AppConfig?.version || '1'}`);
            console.log('[Push] SW registrado:', this._registration.scope);

            // Esperar a que el SW esté activo
            await navigator.serviceWorker.ready;

            // Verificar si ya hay suscripción
            const existing = await this._registration.pushManager.getSubscription();
            if (existing) {
                this._subscription = existing;
                console.log('[Push] Suscripción existente encontrada');
                // Re-guardar por si cambió el user_id o device_id
                await this._saveToSupabase(existing);
                return true;
            }

            return true;
        } catch (e) {
            console.error('[Push] Error inicializando:', e);
            return false;
        }
    },

    // ── Suscribir al usuario (requiere permiso) ─────────────
    async subscribe() {
        if (!this._registration) {
            const ok = await this.init();
            if (!ok) return false;
        }

        // Si ya está suscrito, re-guardar en Supabase por si falló antes
        if (this._subscription) {
            console.log('[Push] Ya suscrito, re-guardando en Supabase...');
            await this._saveToSupabase(this._subscription);
            return true;
        }

        try {
            // Pedir permiso de notificaciones
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.warn('[Push] Permiso denegado');
                return false;
            }

            // Suscribir a Push
            const applicationServerKey = this._urlBase64ToUint8Array(this.VAPID_PUBLIC_KEY);
            this._subscription = await this._registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey
            });

            console.log('[Push] Suscripción creada');

            // Guardar en Supabase
            await this._saveToSupabase(this._subscription);

            return true;
        } catch (e) {
            console.error('[Push] Error suscribiendo:', e);
            return false;
        }
    },

    // ── Desuscribir ─────────────────────────────────────────
    async unsubscribe() {
        if (!this._subscription) return true;

        try {
            await this._subscription.unsubscribe();

            // Borrar de Supabase
            const client = window.SyncV2?.client || window.Auth?.client;
            if (client) {
                const deviceId = window.DeviceId?.get() || 'unknown';
                await client
                    .from('push_subscriptions')
                    .delete()
                    .eq('device_id', deviceId);
            }

            this._subscription = null;
            console.log('[Push] Desuscrito');
            return true;
        } catch (e) {
            console.error('[Push] Error desuscribiendo:', e);
            return false;
        }
    },

    // ── Verificar si está suscrito ──────────────────────────
    isSubscribed() {
        return !!this._subscription;
    },

    // ── Guardar suscripción en Supabase ─────────────────────
    async _saveToSupabase(subscription) {
        const client = window.SyncV2?.client || window.Auth?.client;
        if (!client) {
            console.warn('[Push] Sin cliente Supabase para guardar suscripción');
            return;
        }

        const userId = window.Auth?.session?.user?.id || null;
        const tenantId = window.Auth?.getTenantId() || null;
        const deviceId = window.DeviceId?.get() || 'unknown';
        const subJson = subscription.toJSON();

        console.log('[Push] Guardando suscripción:', { userId, tenantId, deviceId, hasEndpoint: !!subJson.endpoint, hasKeys: !!subJson.keys?.p256dh });

        const record = {
            user_id: userId,
            tenant_id: tenantId,
            device_id: deviceId,
            endpoint: subJson.endpoint,
            p256dh: subJson.keys?.p256dh || null,
            auth: subJson.keys?.auth || null,
            updated_at: new Date().toISOString()
        };

        const { error } = await client
            .from('push_subscriptions')
            .upsert([record], { onConflict: 'device_id' });

        if (error) {
            console.error('[Push] Error guardando suscripción:', error.message);
        } else {
            console.log('[Push] Suscripción guardada en Supabase');
        }
    },

    // ── Helper: convertir VAPID key a Uint8Array ────────────
    _urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
};
