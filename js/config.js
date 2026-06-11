// Configuration
// La anon key de Supabase es una clave PÚBLICA (sb_publishable_...) diseñada
// para estar en código cliente. La seguridad real viene del RLS en Supabase.
// localStorage actúa como override para poder cambiarlas desde Settings.

// Supabase config — hardcoded, no overridable from client
// La anon key es pública (sb_publishable_), la seguridad viene del RLS.
window.AppConfig = Object.freeze({
    supabaseUrl: 'https://ybonpeapvpdseqbtlysx.supabase.co',
    supabaseKey: 'sb_publishable_WPhGxSOnQ4RN1aJBKGnj0g_TnZFPWIB',
    version: '1.7.1'
});
