// ──────────────────────────────────────────────────────────────
// /api/notify — Envía notificaciones Web Push
// Auth: "Authorization: Bearer <CRON_SECRET>" para cron jobs
//       "Authorization: Bearer <supabase_jwt>" para triggers de cliente (admin/owner)
// Jobs: ?job=pulse       → recordatorios vencidos
//       ?job=daily       → resumen de la mañana
//       ?job=announcement → aviso nuevo (body: { title, tenant_id })
//       ?job=invoice     → factura nueva (body: { supplier, amount, tenant_id })
//       ?job=all         → pulse + daily (default)
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

function dateCL(offsetDays = 0) {
    const d = new Date(Date.now() + offsetDays * 86400000);
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
}
function money(n) {
    return '$' + Math.round(+n || 0).toLocaleString('es-CL');
}

// Verificar JWT de Supabase y retornar user + rol
async function verifyJwt(token, sb) {
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data?.user) return null;
    // Obtener rol desde user_tenants
    const { data: ut } = await sb
        .from('user_tenants')
        .select('tenant_id, role')
        .eq('user_id', data.user.id)
        .eq('active', true)
        .limit(1)
        .single();
    if (!ut) return null;
    return { userId: data.user.id, tenantId: ut.tenant_id, role: ut.role };
}

export default async function handler(req, res) {
    try {
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !VAPID_PRIVATE_KEY || !VAPID_PUBLIC_KEY) {
            return res.status(500).json({ error: 'faltan variables de entorno (Supabase/VAPID)' });
        }

        const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
        const auth = (req.headers.authorization || '').replace('Bearer ', '');
        const job = (req.query && req.query.job) || 'all';

        // ── Autorización ──
        // Cron jobs: auth === CRON_SECRET
        // Client triggers (announcement/invoice): JWT válido de admin/owner
        const isCron = CRON_SECRET && auth === CRON_SECRET;
        let caller = null;

        if (!isCron) {
            if (!auth) return res.status(401).json({ error: 'no autorizado' });
            caller = await verifyJwt(auth, sb);
            if (!caller) return res.status(401).json({ error: 'token inválido' });
            // admin/owner puede disparar cualquier push; employee solo 'report'
            if (!['admin', 'owner'].includes(caller.role) && job !== 'report') {
                return res.status(403).json({ error: 'sin permisos' });
            }
        }

        webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:samyweco123@gmail.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

        const { data: subs, error: subErr } = await sb.from('push_subscriptions').select('*');
        if (subErr) return res.status(500).json({ error: 'error leyendo suscripciones' });
        if (!subs || !subs.length) return res.status(200).json({ ok: true, msg: 'sin suscripciones' });

        // Enviar a suscripciones de un tenant (excluir al emisor si se indica)
        const sendToTenant = async (tenantId, payload, excludeUserId = null) => {
            const targets = subs.filter(s =>
                (!tenantId || s.tenant_id === tenantId) &&
                (!excludeUserId || s.user_id !== excludeUserId)
            );
            let sent = 0;
            for (const s of targets) {
                try {
                    await webpush.sendNotification(
                        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                        JSON.stringify(payload)
                    );
                    sent++;
                } catch (e) {
                    if (e.statusCode === 404 || e.statusCode === 410) {
                        await sb.from('push_subscriptions').delete().eq('id', s.id);
                    }
                }
            }
            return sent;
        };

        const out = { sent: 0 };

        // ── ANNOUNCEMENT: aviso nuevo → push a todo el equipo ──
        if (job === 'announcement') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const title = body.title || 'Nuevo aviso';
            const tenantId = body.tenant_id || caller?.tenantId;
            const isUrgent = body.priority === 'urgente';
            out.sent = await sendToTenant(tenantId, {
                title: isUrgent ? '🔴 Aviso urgente' : '📢 Nuevo aviso',
                body: title,
                tag: 'ann-' + Date.now(),
                data: { url: '/', view: 'announcements' }
            }, caller?.userId); // no notificar al que lo publicó
            return res.status(200).json({ ok: true, ...out });
        }

        // ── REPORT: reporte de empleada → push a admins/owners del tenant ──
        if (job === 'report') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const title = body.title || 'Nuevo reporte';
            const bodyText = body.body || '';
            const tenantId = caller?.tenantId;
            // Solo notificar a admins/owners, no a otros employees
            const { data: admins } = await sb.from('user_tenants')
                .select('user_id')
                .eq('tenant_id', tenantId)
                .in('role', ['admin', 'owner'])
                .eq('active', true);
            const adminIds = new Set((admins || []).map(a => a.user_id));
            const targets = subs.filter(s =>
                s.tenant_id === tenantId && adminIds.has(s.user_id)
            );
            let sent = 0;
            for (const s of targets) {
                try {
                    await webpush.sendNotification(
                        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                        JSON.stringify({
                            title: '📋 ' + title,
                            body: bodyText,
                            tag: 'report-' + Date.now(),
                            data: { url: '/', view: 'team_admin' }
                        })
                    );
                    sent++;
                } catch (e) {
                    if (e.statusCode === 404 || e.statusCode === 410) {
                        await sb.from('push_subscriptions').delete().eq('id', s.id);
                    }
                }
            }
            out.sent = sent;
            return res.status(200).json({ ok: true, ...out });
        }

        // ── REPORT_REPLY: admin respondió reporte → push solo a la cajera que lo envió ──
        if (job === 'report_reply') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const title = body.title || 'Tu reporte';
            const bodyText = body.body || 'El admin respondió tu reporte';
            const targetUserId = body.target_user_id;
            const tenantId = caller?.tenantId;
            if (!targetUserId) return res.status(200).json({ ok: true, sent: 0 });
            const targets = subs.filter(s =>
                s.tenant_id === tenantId && s.user_id === targetUserId
            );
            let sent = 0;
            for (const s of targets) {
                try {
                    await webpush.sendNotification(
                        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                        JSON.stringify({
                            title: '💬 Respuesta a: ' + title,
                            body: bodyText,
                            tag: 'reply-' + Date.now(),
                            data: { url: '/', view: 'team_reports' }
                        })
                    );
                    sent++;
                } catch (e) {
                    if (e.statusCode === 404 || e.statusCode === 410) {
                        await sb.from('push_subscriptions').delete().eq('id', s.id);
                    }
                }
            }
            out.sent = sent;
            return res.status(200).json({ ok: true, ...out });
        }

        // ── INVOICE: factura nueva → push al owner/admins ──
        if (job === 'invoice') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const supplier = body.supplier || 'Proveedor';
            const amount = body.amount ? money(body.amount) : '';
            const tenantId = body.tenant_id || caller?.tenantId;
            out.sent = await sendToTenant(tenantId, {
                title: '🧾 Factura registrada',
                body: `${supplier}${amount ? ' — ' + amount : ''}`,
                tag: 'inv-' + Date.now(),
                data: { url: '/', view: 'purchase_invoices' }
            }, caller?.userId);
            return res.status(200).json({ ok: true, ...out });
        }

        // ── PULSE: recordatorios vencidos ──
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
                await sb.from('reminders')
                    .update({ push_sent_at: new Date().toISOString(), push_status: 'sent' })
                    .eq('id', r.id);
            }
        }

        // ── DAILY: resumen de la mañana ──
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
        }

        return res.status(200).json({ ok: true, ...out });
    } catch (e) {
        console.error('notify error:', e);
        return res.status(500).json({ error: 'fallo interno' });
    }
}
