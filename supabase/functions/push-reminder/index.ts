// ──────────────────────────────────────────────────────────────
// Edge Function: push-reminder
// Envía notificaciones push para reminders pendientes.
// Se ejecuta via pg_cron cada 1 minuto o via HTTP invoke.
//
// Variables de entorno requeridas:
//   VAPID_PRIVATE_KEY  — clave privada VAPID
//   VAPID_PUBLIC_KEY   — clave pública VAPID
//   CRON_SECRET        — secreto para autenticar invocaciones
//   SUPABASE_URL       — (auto-inyectada)
//   SUPABASE_SERVICE_ROLE_KEY — (auto-inyectada)
// ──────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? 'BMbsRGjcT_5ZY4MS1efA8SPoxqvbMeuVM6GfaKNCzi3vfZ8YzPZ8HxG0wHxGlP-nzwA9bTlBuP7tAXPawFSEvuQ';
const VAPID_SUBJECT = 'mailto:admin@elmaravilloso.cl';

interface PushSub {
  id: number;
  user_id: string;
  tenant_id: string;
  device_id: string;
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
}

interface Reminder {
  id: number;
  title: string;
  priority: string;
  next_run: string;
  tenant_id: string;
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    });
  }

  // Auth: Bearer <CRON_SECRET>
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (cronSecret) {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
  }

  try {
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
    if (!VAPID_PRIVATE_KEY) {
      return jsonResponse({ error: 'VAPID_PRIVATE_KEY no configurada' }, 500);
    }

    // Configurar web-push con VAPID
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Buscar reminders: next_run <= NOW(), no completados, no eliminados,
    // y no enviados en los últimos 5 min (evitar spam)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: reminders, error: remErr } = await supabase
      .from('reminders')
      .select('id, title, priority, next_run, tenant_id')
      .lte('next_run', new Date().toISOString())
      .eq('completed', 0)
      .eq('deleted', 0)
      .or(`push_sent_at.is.null,push_sent_at.lt.${fiveMinAgo}`);

    if (remErr) {
      console.error('Error buscando reminders:', remErr);
      return jsonResponse({ error: 'Internal server error' }, 500);
    }

    if (!reminders || reminders.length === 0) {
      return jsonResponse({ sent: 0, message: 'Sin reminders pendientes' });
    }

    // Agrupar por tenant
    const byTenant = new Map<string, Reminder[]>();
    for (const r of reminders as Reminder[]) {
      const list = byTenant.get(r.tenant_id) || [];
      list.push(r);
      byTenant.set(r.tenant_id, list);
    }

    let totalSent = 0;
    let totalFailed = 0;
    const expiredSubs: number[] = [];

    for (const [tenantId, tenantReminders] of byTenant) {
      // Obtener suscripciones push de este tenant
      const { data: subs, error: subErr } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('tenant_id', tenantId);

      if (subErr || !subs || subs.length === 0) continue;

      for (const reminder of tenantReminders) {
        const emoji = reminder.priority === 'high' ? '🔴' : '⏰';
        const payload = JSON.stringify({
          title: `${emoji} ${reminder.title}`,
          body: reminder.priority === 'high'
            ? '⚠️ ALTA PRIORIDAD — El Maravilloso'
            : 'Recordatorio — El Maravilloso',
          icon: '/assets/icon-512.png',
          badge: '/assets/icon-512.png',
          tag: `wm-reminder-${reminder.id}`,
          data: { reminderId: reminder.id }
        });

        for (const sub of subs as PushSub[]) {
          if (!sub.endpoint || !sub.p256dh || !sub.auth) continue;

          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          };

          try {
            await webpush.sendNotification(pushSubscription, payload, { TTL: 86400 });
            totalSent++;
          } catch (err: unknown) {
            const pushErr = err as { statusCode?: number };
            if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
              // Suscripción expirada
              expiredSubs.push(sub.id);
              console.log(`Suscripción expirada: ${sub.device_id}`);
            } else {
              totalFailed++;
              console.error(`Push falló para ${sub.device_id}:`, err);
            }
          }
        }

        // Marcar reminder como enviado
        await supabase
          .from('reminders')
          .update({ push_sent_at: new Date().toISOString(), push_status: 'sent' })
          .eq('id', reminder.id);
      }
    }

    // Limpiar suscripciones expiradas
    if (expiredSubs.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('id', expiredSubs);
    }

    return jsonResponse({
      sent: totalSent,
      failed: totalFailed,
      expired: expiredSubs.length,
      reminders: reminders.length
    });

  } catch (err) {
    console.error('Error general:', err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
