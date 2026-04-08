// Configuration - Credentials loaded from localStorage (set via Settings page)
// Never hardcode API keys in this file.

window.AppConfig = {
    supabaseUrl: localStorage.getItem('supabase_url') || null,
    supabaseKey: localStorage.getItem('supabase_key') || null
};
