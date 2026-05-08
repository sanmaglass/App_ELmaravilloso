// Auth Module — Supabase Auth (login, registro, logout, sesión)
// Se carga DESPUÉS de config.js y ANTES de sync modules.
// Expone window.Auth para uso en main.js

window.Auth = {
    client: null,
    session: null,
    tenantId: null,

    // Inicializa el cliente Supabase Auth
    init() {
        const url = localStorage.getItem('supabase_url') || window.AppConfig.supabaseUrl;
        const key = localStorage.getItem('supabase_key') || window.AppConfig.supabaseKey;
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

    // Registro de nuevo usuario
    async register(email, password) {
        if (!this.client) throw new Error('Auth no inicializado');
        const { data, error } = await this.client.auth.signUp({ email, password });
        if (error) throw error;
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
            return null;
        }

        this.tenantId = data.tenant_id;
        localStorage.setItem('wm_tenant_id', data.tenant_id);
        localStorage.setItem('wm_user_role', data.role);
        return data;
    },

    // Obtener tenant_id actual (para usar en queries)
    getTenantId() {
        return this.tenantId || localStorage.getItem('wm_tenant_id');
    },

    // Obtener el access token para pasarlo al cliente Supabase de SyncV2
    getAccessToken() {
        return this.session?.access_token || null;
    }
};

// Función global para logout (usada por settings.js)
window.AppSignOut = () => window.Auth.logout();
