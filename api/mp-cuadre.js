// ──────────────────────────────────────────────────────────────
// /api/mp-cuadre — Trae los pagos de Mercado Pago de un día y los
// agrupa por tipo (débito / crédito / transferencia) para cruzarlos
// contra la caja del local (Eleventa) en "Caja del Día".
//
// Auth: "Authorization: Bearer <supabase_jwt>" de un admin/owner.
// El Access Token de MP vive SOLO server-side (env MP_ACCESS_TOKEN).
//
// Query:  ?date=YYYY-MM-DD  (día en zona America/Santiago; default hoy)
// Resp:   { date, debito, credito, transferencia, otros,
//           totalTarjetas, total, count, byType }
// ──────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MP_ACCESS_TOKEN } = process.env;
const TZ = 'America/Santiago';
const MP_API = 'https://api.mercadopago.com/v1/payments/search';

// Offset (ej "-04:00") de la zona para una fecha dada — respeta horario de verano chileno.
function offsetFor(dateStr) {
    try {
        const dtf = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' });
        const parts = dtf.formatToParts(new Date(dateStr + 'T12:00:00Z'));
        const tzn = (parts.find(p => p.type === 'timeZoneName') || {}).value || 'GMT-04:00';
        const m = tzn.match(/GMT([+-]\d{2}):?(\d{2})/);
        return m ? `${m[1]}:${m[2]}` : '-04:00';
    } catch { return '-04:00'; }
}

function todayCL() {
    return new Date().toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD
}

// Verifica JWT de Supabase y retorna rol desde user_tenants.
async function verifyJwt(token, sb) {
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data?.user) return null;
    const { data: ut } = await sb
        .from('user_tenants')
        .select('role')
        .eq('user_id', data.user.id)
        .eq('active', true)
        .limit(1)
        .single();
    if (!ut) return null;
    return { userId: data.user.id, role: ut.role };
}

// Mapea payment_type_id de MP a las categorías del cuadre.
function bucket(paymentTypeId) {
    switch (paymentTypeId) {
        case 'debit_card': return 'debito';
        case 'credit_card': return 'credito';
        case 'prepaid_card': return 'debito';
        case 'account_money':
        case 'bank_transfer':
        case 'digital_currency':
        case 'digital_wallet': return 'transferencia';
        default: return 'otros';
    }
}

export default async function handler(req, res) {
    try {
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            return res.status(500).json({ error: 'faltan variables de entorno (Supabase)' });
        }
        if (!MP_ACCESS_TOKEN) {
            return res.status(500).json({ error: 'falta MP_ACCESS_TOKEN' });
        }

        const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

        // ── Autorización: solo admin/owner ──
        const auth = (req.headers.authorization || '').replace('Bearer ', '');
        if (!auth) return res.status(401).json({ error: 'no autorizado' });
        const caller = await verifyJwt(auth, sb);
        if (!caller) return res.status(401).json({ error: 'token inválido' });
        if (!['admin', 'owner'].includes(caller.role)) {
            return res.status(403).json({ error: 'sin permisos' });
        }

        // ── Rango del día en zona Santiago ──
        const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query?.date || '') ? req.query.date : todayCL();
        const off = offsetFor(date);
        const begin = `${date}T00:00:00.000${off}`;
        const end = `${date}T23:59:59.999${off}`;

        // ── Traer pagos aprobados (paginado) ──
        const totals = { debito: 0, credito: 0, transferencia: 0, otros: 0 };
        const byType = {};
        let count = 0;
        const LIMIT = 50;
        let offset = 0;
        let total = Infinity;

        while (offset < total) {
            const url = `${MP_API}?` + new URLSearchParams({
                status: 'approved',
                range: 'date_approved',
                begin_date: begin,
                end_date: end,
                sort: 'date_approved',
                criteria: 'asc',
                limit: String(LIMIT),
                offset: String(offset),
            });
            const r = await fetch(url, { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` } });
            if (!r.ok) {
                const txt = await r.text().catch(() => '');
                console.error('MP error', r.status, txt.slice(0, 300));
                return res.status(502).json({ error: 'Error consultando Mercado Pago', status: r.status });
            }
            const data = await r.json();
            total = data?.paging?.total ?? 0;
            const results = data?.results || [];
            for (const p of results) {
                const amount = Number(p.transaction_amount) || 0;
                const pt = p.payment_type_id || 'otros';
                const b = bucket(pt);
                totals[b] += amount;
                count++;
                if (!byType[pt]) byType[pt] = { monto: 0, n: 0 };
                byType[pt].monto += amount;
                byType[pt].n++;
            }
            if (!results.length) break;
            offset += LIMIT;
        }

        const totalTarjetas = totals.debito + totals.credito;
        const grandTotal = totalTarjetas + totals.transferencia + totals.otros;

        return res.status(200).json({
            date,
            debito: Math.round(totals.debito),
            credito: Math.round(totals.credito),
            transferencia: Math.round(totals.transferencia),
            otros: Math.round(totals.otros),
            totalTarjetas: Math.round(totalTarjetas),
            total: Math.round(grandTotal),
            count,
            byType,
        });
    } catch (err) {
        console.error('mp-cuadre error:', err);
        return res.status(500).json({ error: 'Error interno' });
    }
}
