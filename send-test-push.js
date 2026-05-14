// Uso: node send-test-push.js '{"endpoint":"...","keys":{"p256dh":"...","auth":"..."}}'
const webpush = require('web-push');

const VAPID_PUBLIC = 'BMbsRGjcT_5ZY4MS1efA8SPoxqvbMeuVM6GfaKNCzi3vfZ8YzPZ8HxG0wHxGlP-nzwA9bTlBuP7tAXPawFSEvuQ';
const VAPID_PRIVATE = '_AopsAO5BJlexwhrk_epEzJFUaiAnEkuhW_iFJOwM_g';

webpush.setVapidDetails('mailto:admin@elmaravilloso.cl', VAPID_PUBLIC, VAPID_PRIVATE);

const sub = JSON.parse(process.argv[2]);

const payload = JSON.stringify({
    title: 'Notificacion de prueba con diseno y todo para probar un QA',
    body: 'Recordatorio — El Maravilloso\nSi ves esto en tu celular, las push notifications funcionan!',
    icon: '/assets/icon-512.png',
    badge: '/assets/icon-512.png',
    tag: 'wm-test-qa'
});

webpush.sendNotification(sub, payload, { TTL: 86400 })
    .then(res => console.log('Push enviado! Status:', res.statusCode))
    .catch(err => console.error('Error:', err.statusCode, err.body));
