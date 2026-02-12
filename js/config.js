// ⚠️ SECURITY WARNING ⚠️
// This file contains your Supabase API credentials and is publicly accessible.
// For production use, consider:
// 1. Using environment variables (not available in static sites)
// 2. Implementing proper Row Level Security (RLS) in Supabase
// 3. Using the Supabase "anon" key (public) with strict RLS policies
// 4. Never committing sensitive keys to public repositories
// 
// Current approach: This uses the public "anon" key which is safe ONLY if:
// - You have Row Level Security (RLS) enabled on all tables
// - Your RLS policies properly restrict access
// - You never use the "service_role" key in client-side code

window.AppConfig = {
    supabaseUrl: 'https://ybonpeapvpdseqbtlysx.supabase.co',
    supabaseKey: 'sb_publishable_WPhGxSOnQ4RN1aJBKGnj0g_TnZFPWIB' // Public anon key
};
