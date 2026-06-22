// /api/refresh-analytics — Refresca vistas materializadas de analytics
// Disparado por Vercel Cron (3x/día: 10, 13, 19 Chile = 14, 17, 23 UTC)
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

export default async function handler(req, res) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ error: 'Missing env vars' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    try {
        // 1. Refrescar vistas materializadas (orden: items → cross → stats)
        const { data: refresh, error: err1 } = await supabase.rpc('fn_refresh_analytics');
        if (err1) throw err1;

        // 2. Detectar productos nuevos y agregarlos al catálogo
        const { data: catalog, error: err2 } = await supabase.rpc('fn_auto_populate_catalog');

        return res.status(200).json({
            ok: true,
            refresh,
            nuevos_productos: catalog || 0,
            ts: new Date().toISOString()
        });
    } catch (err) {
        console.error('refresh-analytics error:', err);
        return res.status(500).json({ error: err.message || 'Error interno' });
    }
}
