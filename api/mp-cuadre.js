// ──────────────────────────────────────────────────────────────
// /api/mp-cuadre — Reconciliación del día: cruza ventas Eleventa
// (vía fn_caja_reconciliation) contra los pagos de Mercado Pago.
// Detecta descuadres de tarjeta / transferencia / efectivo.
//
// Auth: "Authorization: Bearer <supabase_jwt>".
//   - admin/owner → payload completo con montos.
//   - employee    → solo estado (ok/warn) por medio, SIN montos.
// El Access Token de MP vive SOLO server-side (env MP_ACCESS_TOKEN).
//
// Query:  ?date=YYYY-MM-DD  (día en zona America/Santiago; default hoy)
// ──────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MP_ACCESS_TOKEN } = process.env;
const TZ = 'America/Santiago';
const MP_API = 'https://api.mercadopago.com/v1/payments/search';
const THRESHOLD = 500; // diferencia mínima para marcar descuadre

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
    return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

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

function bucket(paymentTypeId) {
    switch (paymentTypeId) {
        case 'debit_card':
        case 'prepaid_card': return 'debito';
        case 'credit_card': return 'credito';
        case 'account_money':
        case 'bank_transfer':
        case 'digital_currency':
        case 'digital_wallet': return 'transferencia';
        default: return 'otros';
    }
}

// Trae y agrupa los pagos aprobados de MP del día.
async function fetchMp(date) {
    const off = offsetFor(date);
    const begin = `${date}T00:00:00.000${off}`;
    const end = `${date}T23:59:59.999${off}`;
    const totals = { debito: 0, credito: 0, transferencia: 0, otros: 0 };
    let count = 0, offset = 0, total = Infinity;
    const LIMIT = 50;

    while (offset < total) {
        const url = `${MP_API}?` + new URLSearchParams({
            status: 'approved', range: 'date_approved',
            begin_date: begin, end_date: end,
            sort: 'date_approved', criteria: 'asc',
            limit: String(LIMIT), offset: String(offset),
        });
        const r = await fetch(url, { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` } });
        if (!r.ok) {
            const txt = await r.text().catch(() => '');
            const err = new Error(`MP ${r.status}: ${txt.slice(0, 200)}`);
            err.mpStatus = r.status;
            throw err;
        }
        const data = await r.json();
        total = data?.paging?.total ?? 0;
        const results = data?.results || [];
        for (const p of results) {
            totals[bucket(p.payment_type_id)] += Number(p.transaction_amount) || 0;
            count++;
        }
        if (!results.length) break;
        offset += LIMIT;
    }
    const debito = Math.round(totals.debito);
    const credito = Math.round(totals.credito);
    const transferencia = Math.round(totals.transferencia);
    const otros = Math.round(totals.otros);
    return { debito, credito, transferencia, otros, totalTarjetas: debito + credito,
             total: debito + credito + transferencia + otros, count };
}

// Construye la reconciliación completa (la usa el endpoint y notify.js).
export async function buildReconciliation(sb, date) {
    const [{ data: recon }, mp] = await Promise.all([
        sb.rpc('fn_caja_reconciliation', { p_date: date }),
        fetchMp(date),
    ]);
    const r = recon || {};
    const ev = r.eleventa || {};
    const eleventa = {
        efectivo: Number(ev['Efectivo']) || 0,
        tarjeta: Number(ev['Tarjeta']) || 0,
        transferencia: Number(ev['Transferencia']) || 0,
        credito: Number(ev['Crédito']) || 0,
        mixto: Number(ev['Mixto']) || 0,
        tickets: Number(r.tickets) || 0,
    };
    const fondo = Number(r.fondo) || 0;
    const gastos = Number(r.gastos) || 0;
    const contado = r.cuadre && r.cuadre.contado != null ? Number(r.cuadre.contado) : null;
    const esperado = fondo + eleventa.efectivo - gastos;

    const diff = {
        tarjeta: eleventa.tarjeta - mp.totalTarjetas,
        transferencia: eleventa.transferencia - mp.transferencia,
        efectivo: contado != null ? contado - esperado : null,
    };
    const alerts = {
        tarjeta: Math.abs(diff.tarjeta) > THRESHOLD,
        transferencia: Math.abs(diff.transferencia) > THRESHOLD,
        efectivo: diff.efectivo != null && Math.abs(diff.efectivo) > THRESHOLD,
    };
    return {
        date, threshold: THRESHOLD, mp, eleventa,
        cash: { fondo, gastos, efectivoVentas: eleventa.efectivo, esperado, contado },
        diff, alerts,
        hayDescuadre: alerts.tarjeta || alerts.transferencia || alerts.efectivo,
    };
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

        const auth = (req.headers.authorization || '').replace('Bearer ', '');
        if (!auth) return res.status(401).json({ error: 'no autorizado' });
        const caller = await verifyJwt(auth, sb);
        if (!caller) return res.status(401).json({ error: 'token inválido' });

        const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query?.date || '') ? req.query.date : todayCL();

        let recon;
        try {
            recon = await buildReconciliation(sb, date);
        } catch (e) {
            if (e.mpStatus) return res.status(502).json({ error: 'Error consultando Mercado Pago', status: e.mpStatus });
            throw e;
        }

        // employee: solo estado, sin montos.
        if (!['admin', 'owner'].includes(caller.role)) {
            const st = (ok) => (ok ? 'warn' : 'ok');
            return res.status(200).json({
                date,
                role: 'employee',
                status: {
                    tarjeta: st(recon.alerts.tarjeta),
                    transferencia: st(recon.alerts.transferencia),
                    efectivo: st(recon.alerts.efectivo),
                },
                hayDescuadre: recon.hayDescuadre,
            });
        }

        return res.status(200).json({ role: 'admin', ...recon });
    } catch (err) {
        console.error('mp-cuadre error:', err);
        return res.status(500).json({ error: 'Error interno' });
    }
}
