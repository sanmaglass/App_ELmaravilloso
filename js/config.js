// Configuration
// La anon key de Supabase es una clave PÚBLICA (sb_publishable_...) diseñada
// para estar en código cliente. La seguridad real viene del RLS en Supabase.
// localStorage actúa como override para poder cambiarlas desde Settings.

const _defaultUrl = 'https://ybonpeapvpdseqbtlysx.supabase.co';
const _defaultKey = 'sb_publishable_WPhGxSOnQ4RN1aJBKGnj0g_TnZFPWIB';

window.AppConfig = {
    supabaseUrl: localStorage.getItem('supabase_url') || _defaultUrl,
    supabaseKey: localStorage.getItem('supabase_key') || _defaultKey,
    version: '1.7.1'
};

// Persistir defaults en localStorage para que Settings los muestre correctamente
if (!localStorage.getItem('supabase_url')) localStorage.setItem('supabase_url', _defaultUrl);
if (!localStorage.getItem('supabase_key')) localStorage.setItem('supabase_key', _defaultKey);
