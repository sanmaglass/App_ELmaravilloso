// Auth Module — Supabase Auth (login, registro, logout, sesión)
// Se carga DESPUÉS de config.js y ANTES de sync modules.
// Expone window.Auth para uso en main.js

window.Auth = {
    client: null,
    session: null,
    tenantId: null,
    _role: null,

    // Retorna el rol desde memoria (fuente de verdad server-side).
    // Si Auth aún no cargó el tenant, retorna 'employee' (restrictivo por defecto).
    getRole() {
        return this._role || 'employee';
    },

    // Inicializa el cliente Supabase Auth
    init() {
        const url = window.AppConfig.supabaseUrl;
        const key = window.AppConfig.supabaseKey;
        if (!url || !key) return false;
        this.client = supabase.createClient(url, key);
        return true;
    },

    // Verifica si hay sesión activa (auto-refresh de token incluido)
    async getSession() {
        if (!this.client) return null;
        const { data, error } = await this.client.auth.getSession();
        if (error || !data.session) return null;
        this.session = data.session;
        return data.session;
    },

    // Login con email/password
    async login(email, password) {
        if (!this.client) throw new Error('Auth no inicializado');
        const { data, error } = await this.client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        this.session = data.session;

        // Obtener tenant_id del usuario
        await this._loadTenant();

        // Guardar estado compatible con el sistema actual
        localStorage.setItem('wm_auth', 'true');
        localStorage.setItem('wm_auth_email', email);
        localStorage.setItem('wm_user', email.split('@')[0]);
        localStorage.setItem('wm_session_version', '3'); // Nueva versión para Supabase Auth

        return data;
    },

    // Recuperar contraseña
    async resetPassword(email) {
        if (!this.client) throw new Error('Auth no inicializado');
        const redirectUrl = window.location.origin + '/';
        const { error } = await this.client.auth.resetPasswordForEmail(email, {
            redirectTo: redirectUrl
        });
        if (error) throw error;
    },

    // Cerrar sesión
    async logout() {
        if (this.client) {
            await this.client.auth.signOut();
        }
        this.session = null;
        this.tenantId = null;
        this._role = null;
        localStorage.removeItem('wm_auth');
        localStorage.removeItem('wm_auth_token');
        localStorage.removeItem('wm_auth_email');
        localStorage.removeItem('wm_user');
        localStorage.removeItem('wm_session_version');
        localStorage.removeItem('wm_tenant_id');
        window.location.reload();
    },

    // Cargar tenant_id desde user_tenants
    async _loadTenant() {
        if (!this.session) return null;
        const { data, error } = await this.client
            .from('user_tenants')
            .select('tenant_id, role')
            .eq('user_id', this.session.user.id)
            .eq('active', true)
            .limit(1)
            .single();

        if (error || !data) {
            console.warn('⚠️ Usuario sin tenant asignado');
            this.tenantId = null;
            this._role = null; // restrictivo por defecto
            return null;
        }

        this.tenantId = data.tenant_id;
        this._role = data.role; // fuente de verdad — viene del servidor
        localStorage.setItem('wm_tenant_id', data.tenant_id);
        localStorage.setItem('wm_user_role', data.role); // cache de respaldo (no usar para auth)
        return data;
    },

    // Obtener tenant_id actual (para usar en queries)
    getTenantId() {
        return this.tenantId || localStorage.getItem('wm_tenant_id');
    }
};

// Función global para logout (usada por settings.js)
window.AppSignOut = () => window.Auth.logout();

// --- Session Inactivity Timeout ---
window.InactivityGuard = {
    _timer: null,

    start() {
        const raw = window.Constants && window.Constants.INACTIVITY_LIMIT_MS;
        const limit = (raw === undefined || raw === null) ? (5 * 60 * 1000) : raw;
        // limit <= 0 → auto-logout deshabilitado (sesión persistente en el dispositivo)
        if (!limit || limit <= 0) {
            console.log('InactivityGuard: deshabilitado — sesión persistente');
            return;
        }
        const reset = () => {
            clearTimeout(this._timer);
            this._timer = setTimeout(() => this._handleTimeout(), limit);
        };
        const events = ['click', 'keypress', 'scroll', 'touchstart', 'mousemove'];
        events.forEach(e => document.addEventListener(e, reset, { passive: true }));
        reset(); // arrancar el timer inicial
    },

    _handleTimeout() {
        // Limpiar datos sensibles de sesión
        const keysToRemove = [
            'wm_auth', 'wm_auth_token', 'wm_auth_email', 'wm_user',
            'wm_session_version', 'wm_tenant_id', 'wm_user_role',
            'sii_api_key', 'sii_rut',
            'company_rut', 'company_name', 'company_giro'
        ];
        keysToRemove.forEach(k => localStorage.removeItem(k));
        sessionStorage.removeItem('sii_password');
        localStorage.removeItem('sii_password');
        // También limpiar cualquier cache SII con prefijo
        Object.keys(localStorage)
            .filter(k => k.startsWith('sii_') || k.startsWith('cache_sii'))
            .forEach(k => localStorage.removeItem(k));

        // Logout Supabase si hay sesión activa
        if (window.Auth && window.Auth.client) {
            window.Auth.client.auth.signOut().catch(() => {});
        }
        window.location.reload();
    }
};
