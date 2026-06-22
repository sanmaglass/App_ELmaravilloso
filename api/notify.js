// ──────────────────────────────────────────────────────────────
// /api/notify — Envía notificaciones Web Push (llega con la app cerrada)
// Disparado por: Vercel Cron (diario) y/o Supabase pg_cron (instantáneo).
// Auth: header "Authorization: Bearer <CRON_SECRET>" (lo manda Vercel Cron)
//       o ?secret=<CRON_SECRET> para pruebas manuales.
// Jobs: ?job=pulse  → recordatorios vencidos (idempotente, marca push_sent_at)
//       ?job=daily  → resumen de la mañana (ventas ayer, por cobrar, pendientes)
//       ?job=all    → ambos (default)
// ──────────────────────────────────────────────────────────────
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
    VAPID_SUBJECT,
    CRON_SECRET
} = process.env;

// Fecha YYYY-MM-DD en zona horaria de Chile
function dateCL(offsetDays = 0) {
    const d = new Date(Date.now() + offsetDays * 86400000);
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
}
function money(n) {
    return '$' + Math.round(+n || 0).toLocaleString('es-CL');
}

export default async function handler(req, res) {
    try {
        // ── Autorización ──
        const auth = req.headers.authorization || '';
        if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
            return res.status(401).json({ error: 'no autorizado' });
        }
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !VAPID_PRIVATE_KEY || !VAPID_PUBLIC_KEY) {
            return res.status(500).json({ error: 'faltan variables de entorno (Supabase/VAPID)' });
        }

        const job = (req.query && req.query.job) || 'all';
        webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:samyweco123@gmail.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
        const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

        const { data: subs, error: subErr } = await sb.from('push_subscriptions').select('*');
        if (subErr) return res.status(500).json({ error: 'error leyendo suscripciones' });
        if (!subs || !subs.length) return res.status(200).json({ ok: true, msg: 'sin suscripciones' });

        // Enviar un payload a todas las suscripciones (de un tenant, o todas si tenantId es null)
        const sendToTenant = async (tenantId, payload) => {
            const targets = subs.filter(s => !tenantId || s.tenant_id === tenantId);
            let sent = 0;
            for (const s of targets) {
                try {
                    await webpush.sendNotification(
                        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                        JSON.stringify(payload)
                    );
                    sent++;
                } catch (e) {
                    // 404/410 = suscripción muerta → limpiar
                    if (e.statusCode === 404 || e.statusCode === 410) {
                        await sb.from('push_subscriptions').delete().eq('id', s.id);
                    }
                }
            }
            return sent;
        };

        const out = { reminders: 0, daily: 0, sent: 0 };

        // ── 1) PULSE: recordatorios vencidos aún no notificados ──
        if (job === 'all' || job === 'pulse') {
            const nowISO = new Date().toISOString();
            const { data: due } = await sb.from('reminders')
                .select('*')
                .lte('next_run', nowISO)
                .is('push_sent_at', null)
                .eq('completed', 0)
                .eq('deleted', 0);
            for (const r of (due || [])) {
                if (r.snoozed_until && new Date(r.snoozed_until) > new Date()) continue;
                out.sent += await sendToTenant(r.tenant_id, {
                    title: '⏰ ' + (r.title || 'Recordatorio'),
                    body: r.notes || 'Tienes un recordatorio pendiente',
                    tag: 'rem-' + r.id,
                    data: { url: '/' }
                });
                out.reminders++;
                await sb.from('reminders')
                    .update({ push_sent_at: new Date().toISOString(), push_status: 'sent' })
                    .eq('id', r.id);
            }
        }

        // ── 2) DAILY: resumen de la mañana ──
        if (job === 'all' || job === 'daily') {
            const ayer = dateCL(-1);
            const [elev, man] = await Promise.all([
                sb.from('eleventa_sales').select('total').eq('date_local', ayer).eq('deleted', false),
                sb.from('daily_sales').select('total').eq('date', ayer).eq('deleted', false)
            ]);
            const ventasAyer = [...(elev.data || []), ...(man.data || [])]
                .reduce((s, r) => s + (+r.total || 0), 0);

            const limite = dateCL(3);
            const { data: cred } = await sb.from('purchase_invoices')
                .select('amount, paidAmount, dueDate')
                .eq('paymentMethod', 'Crédito')
                .eq('paymentStatus', 'Pendiente')
                .eq('deleted', false)
                .lte('dueDate', limite);
            const porPagar = (cred || []).reduce((s, i) => s + ((+i.amount || 0) - (+i.paidAmount || 0)), 0);
            const nCred = (cred || []).length;

            const { count: pend } = await sb.from('reminders')
                .select('id', { count: 'exact', head: true })
                .eq('completed', 0).eq('deleted', 0);

            const partes = [`Ventas ayer: ${money(ventasAyer)}`];
            if (nCred) partes.push(`${nCred} factura(s) a crédito por vencer (${money(porPagar)})`);
            if (pend) partes.push(`${pend} recordatorio(s) pendiente(s)`);

            out.sent += await sendToTenant(null, {
                title: '☀️ Resumen del día — El Maravilloso',
                body: partes.join(' · '),
                tag: 'daily-' + dateCL(),
                data: { url: '/' }
            });
            out.daily = 1;
        }

        return res.status(200).json({ ok: true, ...out });
    } catch (e) {
        console.error('notify error:', e);
        return res.status(500).json({ error: 'fallo interno' });
    }
}
